import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { joinRequestSchema, openFileSchema, saveFileSchema } from "@pcconnector/protocol";
import { DiscoveryService } from "./services/discovery-service.mjs";
import { SessionService } from "./services/session-service.mjs";
import { WorkspaceService } from "./services/workspace-service.mjs";
import { TransportService } from "./services/transport-service.mjs";
import { AppError, toErrorPayload } from "./services/errors.mjs";
import { logger } from "./services/logger.mjs";

const discovery = new DiscoveryService();
const sessionService = new SessionService();
const workspaceService = new WorkspaceService();
const transportService = new TransportService(sessionService, workspaceService);

/** @type {BrowserWindow | null} */
let mainWindow = null;
let lastJoinedWorkspace = null;
let activeSessionToken = null;
let activeSessionCode = null;

const generateSessionCode = () => {
  const words = ["TIGER", "BLUE", "IRON", "SWIFT", "NOVA", "FLAME", "ALPHA", "JET"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${word}-${num}`;
};

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    webPreferences: {
      preload: path.join(import.meta.dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) {
    await mainWindow.loadURL(devServer);
  } else {
    await mainWindow.loadFile(path.join(import.meta.dirname, "../dist/index.html"));
  }
};

app.whenReady().then(async () => {
  await createWindow();
  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    transportService.closeAll();
    discovery.destroy();
    app.quit();
  }
});

ipcMain.handle("workspace:create", async (_event, payload) => {
  try {
    const selected = await dialog.showOpenDialog({
      properties: ["openDirectory"]
    });
    if (selected.canceled || selected.filePaths.length === 0) {
      return { ok: false };
    }

    const rootPath = selected.filePaths[0];
    const workspaceName = payload.workspaceName || path.basename(rootPath);
    const workspaceId = randomUUID();
    const sessionCode = generateSessionCode();
    const port = payload.port ?? 7788;
    transportService.closeAll();
    discovery.stopAdvertising();
    sessionService.revokeAll();
    sessionService.setState("idle");

    workspaceService.setWorkspace(rootPath, workspaceId, workspaceName);
    activeSessionCode = sessionCode;
    sessionService.setState("advertising");
    discovery.advertiseWorkspace({
      workspaceName,
      hostName: app.getName(),
      workspaceId,
      sessionCode,
      port
    });

    transportService.startServer(port, {
    onMessage: async (socket, message) => {
      if (message.type === "PING") {
        transportService.send(socket, "PONG", message.correlationId, {});
        return;
      }

      if (message.type === "JOIN_REQUEST") {
        const parsed = joinRequestSchema.safeParse(message.payload);
        if (!parsed.success) {
          transportService.send(socket, "ERROR", message.correlationId, {
            code: "INVALID_JOIN_REQUEST",
            message: "Join request payload is invalid",
            retryable: false,
            source: "network"
          });
          return;
        }
        if (parsed.data.sessionCode && parsed.data.sessionCode !== activeSessionCode) {
          transportService.send(socket, "JOIN_REJECT", message.correlationId, {
            reason: "Invalid session code"
          });
          socket.close();
          return;
        }
        if (parsed.data.workspaceId && parsed.data.workspaceId !== workspaceId) {
          transportService.send(socket, "JOIN_REJECT", message.correlationId, {
            reason: "Invalid workspace"
          });
          socket.close();
          return;
        }
        const requestId = sessionService.addPendingJoin(parsed.data, socket);
        mainWindow?.webContents.send("session:pending-joins", sessionService.listPendingJoins());
        mainWindow?.webContents.send("session:clients", sessionService.listConnectedClients());
        transportService.send(socket, "HELLO", message.correlationId, { requestId, status: "pending" });
        return;
      }

      if (message.type === "OPEN_FILE") {
        const parsed = openFileSchema.safeParse(message.payload);
        if (!parsed.success) {
          transportService.send(socket, "ERROR", message.correlationId, {
            code: "INVALID_OPEN_FILE",
            message: "Open file payload is invalid",
            retryable: false,
            source: "network"
          });
          return;
        }
        const client = sessionService.validateToken(parsed.data.sessionToken, socket);
        if (!client) {
          transportService.send(socket, "ERROR", message.correlationId, {
            code: "UNAUTHORIZED",
            message: "Invalid session token",
            retryable: false,
            source: "network"
          });
          return;
        }
        await transportService.streamFile(socket, parsed.data.relativePath, message.correlationId);
        return;
      }

      if (message.type === "CANCEL_OPEN_FILE") {
        const { transferId } = message.payload ?? {};
        if (typeof transferId === "string" && transferId.length > 0) {
          transportService.cancelTransfer(transferId);
        }
        return;
      }

      if (message.type === "SAVE_FILE") {
        const parsed = saveFileSchema.safeParse(message.payload);
        if (!parsed.success) {
          transportService.send(socket, "ERROR", message.correlationId, {
            code: "INVALID_SAVE_FILE",
            message: "Save file payload is invalid",
            retryable: false,
            source: "network"
          });
          return;
        }
        const client = sessionService.validateToken(parsed.data.sessionToken, socket);
        if (!client) {
          transportService.send(socket, "ERROR", message.correlationId, {
            code: "UNAUTHORIZED",
            message: "Invalid session token",
            retryable: false,
            source: "network"
          });
          return;
        }
        await workspaceService.writeTextFile(parsed.data.relativePath, parsed.data.content);
        transportService.send(socket, "SAVE_ACK", message.correlationId, {
          relativePath: parsed.data.relativePath
        });
      }
    },
    onConnectionClosed: () => {
      mainWindow?.webContents.send("session:pending-joins", sessionService.listPendingJoins());
    }
  });

    const createdPayload = {
      ok: true,
      workspaceId,
      sessionCode,
      workspaceName,
      rootPath,
      fileEntries: await workspaceService.listFiles()
    };
    mainWindow?.webContents.send("host:status", {
      state: "advertising",
      workspaceName,
      message: `Sharing ${workspaceName}`,
      sessionCode
    });
    return createdPayload;
  } catch (error) {
    logger.error({ error }, "workspace:create failed");
    sessionService.setState("idle");
    mainWindow?.webContents.send("host:status", { state: "error", message: "Unable to start workspace host." });
    return { ok: false, error: toErrorPayload(new AppError("HOST_START_FAILED", "Unable to start host", true, "main")) };
  }
});

ipcMain.handle("workspace:list-files", async () => {
  return workspaceService.listFiles();
});

ipcMain.handle("discovery:start", async () => {
  discovery.startBrowsing((workspaces) => {
    mainWindow?.webContents.send("discovery:workspaces", workspaces);
  });
  return { ok: true };
});

ipcMain.handle("discovery:stop", async () => {
  discovery.stopBrowsing();
  return { ok: true };
});

ipcMain.handle("session:approve", async (_event, requestId) => {
  const approved = sessionService.approveJoin(requestId);
  if (!approved) {
    return { ok: false };
  }
  mainWindow?.webContents.send("session:pending-joins", sessionService.listPendingJoins());
  const workspace = workspaceService.getWorkspace();
  const entries = await workspaceService.listFiles();
  transportService.send(approved.request.socket, "JOIN_ACCEPT", randomUUID(), {
    sessionToken: approved.sessionToken,
    workspaceName: workspace?.workspaceName ?? "Workspace",
    hostName: app.getName(),
    workspaceId: workspace?.workspaceId ?? "",
    sessionCode: activeSessionCode ?? "",
    capabilities: ["read"]
  });
  transportService.send(approved.request.socket, "WORKSPACE_SNAPSHOT", randomUUID(), {
    workspaceId: workspace?.workspaceId ?? "",
    workspaceName: workspace?.workspaceName ?? "Workspace",
    entries
  });
  const clients = sessionService.listConnectedClients();
  for (const client of transportService.connections) {
    transportService.send(client, "CLIENTS_UPDATE", randomUUID(), { clients });
  }
  mainWindow?.webContents.send("session:clients", clients);
  return { ok: true };
});

ipcMain.handle("session:reject", async (_event, requestId) => {
  const rejected = sessionService.rejectJoin(requestId);
  if (rejected?.socket) {
    transportService.send(rejected.socket, "JOIN_REJECT", randomUUID(), {
      reason: "Rejected by host"
    });
    rejected.socket.close();
  }
  mainWindow?.webContents.send("session:pending-joins", sessionService.listPendingJoins());
  mainWindow?.webContents.send("session:clients", sessionService.listConnectedClients());
  return { ok: Boolean(rejected) };
});

ipcMain.handle("session:stop", async () => {
  transportService.broadcastSessionStop();
  discovery.stopAdvertising();
  sessionService.revokeAll();
  sessionService.setState("stopped");
  activeSessionCode = null;
  mainWindow?.webContents.send("host:status", { state: "stopped", message: "Sharing stopped." });
  mainWindow?.webContents.send("session:clients", []);
  return { ok: true };
});

ipcMain.handle("client:join-workspace", async (_event, workspace) => {
  lastJoinedWorkspace = workspace;
  return new Promise((resolve) => {
    let resolved = false;
    const done = (value) => {
      if (!resolved) {
        resolved = true;
        resolve(value);
      }
    };
    transportService.connectClient(`ws://${workspace.hostAddress}:${workspace.port}`, {
      onOpen: () => {
        const correlationId = randomUUID();
        transportService.send(transportService.client, "JOIN_REQUEST", correlationId, {
          deviceName: app.getName(),
          clientId: randomUUID(),
          workspaceId: workspace.workspaceId,
          sessionCode: workspace.sessionCode
        });
      },
      onMessage: (message) => {
        mainWindow?.webContents.send("client:message", message);
        if (message.type === "HELLO") {
          done({ ok: true, status: "pending_approval" });
        } else if (message.type === "JOIN_ACCEPT") {
          activeSessionToken = message.payload.sessionToken;
        } else if (message.type === "JOIN_REJECT") {
          activeSessionToken = null;
          transportService.disconnectClient();
          done({ ok: false, status: "rejected" });
        }
      },
      onReconnectAttempt: (attempt) => {
        mainWindow?.webContents.send("client:message", {
          type: "RECONNECTING",
          payload: { attempt }
        });
      },
      onReconnectFailed: () => {
        mainWindow?.webContents.send("client:message", {
          type: "ERROR",
          payload: toErrorPayload(new AppError("RECONNECT_FAILED", "Unable to reconnect", true, "network"))
        });
      },
      onError: (error) => {
        logger.error({ error }, "Client join failed");
        done({ ok: false, error: `${error}` });
      },
      onClose: () => {
        done({ ok: false, error: "Connection closed" });
      }
    });
  });
});

ipcMain.handle("client:open-file", async (_event, relativePath) => {
  if (!transportService.client || !activeSessionToken) {
    return { ok: false, error: "No active session" };
  }
  const correlationId = randomUUID();
  transportService.send(transportService.client, "OPEN_FILE", correlationId, {
    sessionToken: activeSessionToken,
    relativePath
  });
  return { ok: true, correlationId };
});

ipcMain.handle("client:cancel-open-file", async (event, payload) => {
  void event;
  if (!transportService.client || !activeSessionToken) {
    return { ok: false, error: "No active session" };
  }
  const correlationId = randomUUID();
  transportService.send(transportService.client, "CANCEL_OPEN_FILE", correlationId, {
    sessionToken: activeSessionToken,
    transferId: payload.transferId,
    relativePath: payload.relativePath
  });
  return { ok: true };
});

ipcMain.handle("client:save-file", async (_event, payload) => {
  if (!transportService.client || !activeSessionToken) {
    return { ok: false, error: "No active session" };
  }
  const correlationId = randomUUID();
  transportService.send(transportService.client, "SAVE_FILE", correlationId, {
    sessionToken: activeSessionToken,
    relativePath: payload.relativePath,
    content: payload.content,
    encoding: "utf8"
  });
  return { ok: true, correlationId };
});

ipcMain.handle("client:reconnect", async () => {
  if (!lastJoinedWorkspace) {
    return { ok: false };
  }
  return new Promise((resolve) => {
    transportService.connectClient(`ws://${lastJoinedWorkspace.hostAddress}:${lastJoinedWorkspace.port}`, {
      onOpen: () => {
        const correlationId = randomUUID();
        transportService.send(transportService.client, "JOIN_REQUEST", correlationId, {
          deviceName: app.getName(),
          clientId: randomUUID(),
          workspaceId: lastJoinedWorkspace.workspaceId,
          sessionCode: lastJoinedWorkspace.sessionCode
        });
      },
      onMessage: (message) => {
        mainWindow?.webContents.send("client:message", message);
        if (message.type === "HELLO") {
          resolve({ ok: true, status: "pending_approval" });
        }
      },
      onError: (_error) => resolve({ ok: false })
    });
  });
});

ipcMain.handle("client:disconnect", async () => {
  transportService.disconnectClient();
  activeSessionToken = null;
  mainWindow?.webContents.send("host:status", { state: "client-disconnected", message: "Disconnected from session." });
  return { ok: true };
});
