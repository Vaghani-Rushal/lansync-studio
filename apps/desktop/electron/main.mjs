import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { randomUUID } from "node:crypto";
import chokidar from "chokidar";
import {
  crdtInitSchema,
  crdtSyncRequestSchema,
  crdtUpdateSchema,
  fileAckSchema,
  fileNackSchema,
  joinRequestSchema,
  openFileSchema,
  saveFileSchema
} from "@pcconnector/protocol";
import { DiscoveryService } from "./services/discovery-service.mjs";
import { SessionService } from "./services/session-service.mjs";
import { WorkspaceService } from "./services/workspace-service.mjs";
import { TransportService } from "./services/transport-service.mjs";
import { CrdtService } from "./services/crdt-service.mjs";
import { AppError, toErrorPayload } from "./services/errors.mjs";
import { logger } from "./services/logger.mjs";

const discovery = new DiscoveryService();
const sessionService = new SessionService();
const workspaceService = new WorkspaceService();
const transportService = new TransportService(sessionService, workspaceService);
const crdtService = new CrdtService(workspaceService);

/** @type {BrowserWindow | null} */
let mainWindow = null;
let lastJoinedWorkspace = null;
let activeSessionToken = null;
let activeSessionCode = null;
let activeSessionPermission = "VIEW_EDIT";
let workspaceWatcher = null;
const changedFileTimers = new Map();

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

const teardownWatcher = () => {
  if (workspaceWatcher) {
    workspaceWatcher.close();
    workspaceWatcher = null;
  }
  for (const timeout of changedFileTimers.values()) {
    clearTimeout(timeout);
  }
  changedFileTimers.clear();
  crdtService.clearAll();
};

const setupWorkspaceWatcher = (rootPath) => {
  teardownWatcher();
  workspaceWatcher = chokidar.watch(rootPath, {
    ignoreInitial: true,
    persistent: true
  });

  workspaceWatcher.on("change", (absolutePath) => {
    const relativePath = path.relative(rootPath, absolutePath).split(path.sep).join("/");
    if (!relativePath || relativePath.startsWith("..")) return;
    if (changedFileTimers.has(relativePath)) {
      clearTimeout(changedFileTimers.get(relativePath));
    }
    const timeout = setTimeout(async () => {
      changedFileTimers.delete(relativePath);
      for (const connected of sessionService.listConnectedSessions()) {
        try {
          await transportService.streamFile(connected.socket, relativePath, randomUUID(), connected.clientId);
        } catch (error) {
          logger.warn({ error, relativePath }, "Failed to push changed file");
        }
      }
      const entries = await workspaceService.listFiles();
      for (const connected of sessionService.listConnectedSessions()) {
        transportService.send(connected.socket, "WORKSPACE_SNAPSHOT", randomUUID(), {
          workspaceId: workspaceService.getWorkspace()?.workspaceId ?? "",
          workspaceName: workspaceService.getWorkspace()?.workspaceName ?? "Workspace",
          entries
        });
      }
    }, 250);
    changedFileTimers.set(relativePath, timeout);
  });
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
    teardownWatcher();
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
    const sessionPermission = payload.permission === "VIEW_ONLY" ? "VIEW_ONLY" : "VIEW_EDIT";
    const port = payload.port ?? 7788;
    transportService.closeAll();
    teardownWatcher();
    discovery.stopAdvertising();
    sessionService.revokeAll();
    sessionService.setState("idle");

    workspaceService.setWorkspace(rootPath, workspaceId, workspaceName);
    setupWorkspaceWatcher(rootPath);
    activeSessionCode = sessionCode;
    activeSessionPermission = sessionPermission;
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
        const requestId = sessionService.addPendingJoin(
          {
            ...parsed.data,
            capabilities: activeSessionPermission === "VIEW_ONLY" ? ["read"] : ["read", "write"]
          },
          socket
        );
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
        await transportService.streamFile(socket, parsed.data.relativePath, message.correlationId, client.clientId);
        return;
      }

      if (message.type === "CANCEL_OPEN_FILE") {
        const { transferId, sessionToken } = message.payload ?? {};
        const client = sessionService.validateToken(sessionToken, socket);
        if (!client) {
          transportService.send(socket, "ERROR", message.correlationId, {
            code: "UNAUTHORIZED",
            message: "Invalid session token",
            retryable: false,
            source: "network"
          });
          return;
        }
        if (typeof transferId === "string" && transferId.length > 0) {
          const cancelled = transportService.cancelTransfer(transferId, client.clientId);
          if (!cancelled) {
            transportService.send(socket, "ERROR", message.correlationId, {
              code: "TRANSFER_CANCEL_DENIED",
              message: "Transfer not found or not owned by this client",
              retryable: false,
              source: "network"
            });
          }
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
        if (!client.capabilities?.includes("write")) {
          transportService.send(socket, "ERROR", message.correlationId, {
            code: "PERMISSION_DENIED",
            message: "This session is view-only for your client",
            retryable: false,
            source: "network"
          });
          return;
        }
        await workspaceService.writeTextFile(parsed.data.relativePath, parsed.data.content);
        transportService.send(socket, "SAVE_ACK", message.correlationId, {
          relativePath: parsed.data.relativePath
        });
        return;
      }

      if (message.type === "CRDT_INIT") {
        const parsed = crdtInitSchema.safeParse(message.payload);
        if (!parsed.success) {
          transportService.send(socket, "ERROR", message.correlationId, {
            code: "INVALID_CRDT_INIT",
            message: "CRDT init payload is invalid",
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
        const stateUpdate = await crdtService.getStateUpdate(parsed.data.relativePath);
        transportService.send(socket, "CRDT_SYNC_RESPONSE", message.correlationId, {
          relativePath: parsed.data.relativePath,
          stateUpdate
        });
        return;
      }

      if (message.type === "CRDT_SYNC_REQUEST") {
        const parsed = crdtSyncRequestSchema.safeParse(message.payload);
        if (!parsed.success) {
          transportService.send(socket, "ERROR", message.correlationId, {
            code: "INVALID_CRDT_SYNC_REQUEST",
            message: "CRDT sync request payload is invalid",
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
        const stateUpdate = await crdtService.getStateUpdate(parsed.data.relativePath);
        transportService.send(socket, "CRDT_SYNC_RESPONSE", message.correlationId, {
          relativePath: parsed.data.relativePath,
          stateUpdate
        });
        return;
      }

      if (message.type === "CRDT_UPDATE") {
        const parsed = crdtUpdateSchema.safeParse(message.payload);
        if (!parsed.success) {
          transportService.send(socket, "ERROR", message.correlationId, {
            code: "INVALID_CRDT_UPDATE",
            message: "CRDT update payload is invalid",
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
        if (!client.capabilities?.includes("write")) {
          transportService.send(socket, "ERROR", message.correlationId, {
            code: "PERMISSION_DENIED",
            message: "This session is view-only for your client",
            retryable: false,
            source: "network"
          });
          return;
        }
        const normalizedUpdate = await crdtService.applyUpdate(parsed.data.relativePath, parsed.data.update);
        for (const target of sessionService.listConnectedSessions()) {
          if (target.socket === socket) continue;
          transportService.send(target.socket, "CRDT_UPDATE", message.correlationId, {
            relativePath: parsed.data.relativePath,
            update: normalizedUpdate
          });
        }
        transportService.send(socket, "SAVE_ACK", message.correlationId, {
          relativePath: parsed.data.relativePath
        });
        return;
      }

      if (message.type === "FILE_ACK") {
        const parsed = fileAckSchema.safeParse(message.payload);
        if (!parsed.success) {
          transportService.send(socket, "ERROR", message.correlationId, {
            code: "INVALID_FILE_ACK",
            message: "File ACK payload is invalid",
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
        transportService.finalizeTransfer(parsed.data.transferId, client.clientId, true);
        return;
      }

      if (message.type === "FILE_NACK") {
        const parsed = fileNackSchema.safeParse(message.payload);
        if (!parsed.success) {
          transportService.send(socket, "ERROR", message.correlationId, {
            code: "INVALID_FILE_NACK",
            message: "File NACK payload is invalid",
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
        transportService.finalizeTransfer(parsed.data.transferId, client.clientId, false, parsed.data.reason);
      }
    },
    onConnectionClosed: () => {
      mainWindow?.webContents.send("session:pending-joins", sessionService.listPendingJoins());
      mainWindow?.webContents.send("session:clients", sessionService.listConnectedClients());
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
    capabilities: activeSessionPermission === "VIEW_ONLY" ? ["read"] : ["read", "write"]
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
  teardownWatcher();
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
    const hostAddress = workspace.hostAddress ?? workspace.manualHost ?? "127.0.0.1";
    const hostPort = workspace.port ?? workspace.manualPort ?? 7788;
    transportService.connectClient(`ws://${hostAddress}:${hostPort}`, {
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

ipcMain.handle("client:crdt-init", async (_event, payload) => {
  if (!transportService.client || !activeSessionToken) {
    return { ok: false, error: "No active session" };
  }
  const correlationId = randomUUID();
  transportService.send(transportService.client, "CRDT_INIT", correlationId, {
    sessionToken: activeSessionToken,
    relativePath: payload.relativePath
  });
  return { ok: true, correlationId };
});

ipcMain.handle("client:crdt-sync-request", async (_event, payload) => {
  if (!transportService.client || !activeSessionToken) {
    return { ok: false, error: "No active session" };
  }
  const correlationId = randomUUID();
  transportService.send(transportService.client, "CRDT_SYNC_REQUEST", correlationId, {
    sessionToken: activeSessionToken,
    relativePath: payload.relativePath
  });
  return { ok: true, correlationId };
});

ipcMain.handle("client:crdt-update", async (_event, payload) => {
  if (!transportService.client || !activeSessionToken) {
    return { ok: false, error: "No active session" };
  }
  const correlationId = randomUUID();
  transportService.send(transportService.client, "CRDT_UPDATE", correlationId, {
    sessionToken: activeSessionToken,
    relativePath: payload.relativePath,
    update: payload.update
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

ipcMain.handle("client:file-ack", async (_event, payload) => {
  if (!transportService.client || !activeSessionToken) {
    return { ok: false, error: "No active session" };
  }
  const correlationId = randomUUID();
  transportService.send(transportService.client, "FILE_ACK", correlationId, {
    sessionToken: activeSessionToken,
    transferId: payload.transferId,
    relativePath: payload.relativePath
  });
  return { ok: true };
});

ipcMain.handle("client:file-nack", async (_event, payload) => {
  if (!transportService.client || !activeSessionToken) {
    return { ok: false, error: "No active session" };
  }
  const correlationId = randomUUID();
  transportService.send(transportService.client, "FILE_NACK", correlationId, {
    sessionToken: activeSessionToken,
    transferId: payload.transferId,
    relativePath: payload.relativePath,
    reason: payload.reason
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
    const hostAddress = lastJoinedWorkspace.hostAddress ?? lastJoinedWorkspace.manualHost ?? "127.0.0.1";
    const hostPort = lastJoinedWorkspace.port ?? lastJoinedWorkspace.manualPort ?? 7788;
    transportService.connectClient(`ws://${hostAddress}:${hostPort}`, {
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
