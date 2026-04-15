import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { promises as fsPromises } from "node:fs";
import { randomUUID } from "node:crypto";
import chokidar from "chokidar";
import {
  crdtInitSchema,
  crdtSyncRequestSchema,
  crdtUpdateSchema,
  displayNameSchema,
  fileAckSchema,
  fileNackSchema,
  joinRequestSchema,
  openFileSchema,
  permissionSchema,
  saveFileSchema
} from "@pcconnector/protocol";
import { DiscoveryService } from "./services/discovery-service.mjs";
import { SessionService, permissionToCapabilities } from "./services/session-service.mjs";
import { WorkspaceService } from "./services/workspace-service.mjs";
import { TransportService } from "./services/transport-service.mjs";
import { CrdtService } from "./services/crdt-service.mjs";
import { IdentityService } from "./services/identity-service.mjs";
import { AppError, toErrorPayload } from "./services/errors.mjs";
import { logger } from "./services/logger.mjs";

// ---------------------------------------------------------------------------
// Singletons
// ---------------------------------------------------------------------------
const discovery = new DiscoveryService();
const sessionService = new SessionService();
const workspaceService = new WorkspaceService();
const transportService = new TransportService(sessionService, workspaceService);
const crdtService = new CrdtService(workspaceService);
/** @type {IdentityService} */
let identityService;

/** @type {BrowserWindow | null} */
let mainWindow = null;
const SHARED_PORT = 7788;
let serverStarted = false;

// Client-side (joining) state — still single-at-a-time for the client role.
let lastJoinedWorkspace = null;
let activeSessionToken = null;
let activeJoinedWorkspaceId = null;

// Per-workspace watcher state
/** @type {Map<string, { watcher: import("chokidar").FSWatcher, timers: Map<string, NodeJS.Timeout> }>} */
const workspaceWatchers = new Map();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const generateSessionCode = () => {
  const words = ["TIGER", "BLUE", "IRON", "SWIFT", "NOVA", "FLAME", "ALPHA", "JET", "LUNA", "CRIM"];
  let attempts = 0;
  while (attempts < 50) {
    const word = words[Math.floor(Math.random() * words.length)];
    const num = Math.floor(Math.random() * 90) + 10;
    const code = `${word}-${num}`;
    if (!workspaceService.isSessionCodeInUse(code)) return code;
    attempts += 1;
  }
  return `${randomUUID().slice(0, 4).toUpperCase()}-${Math.floor(Math.random() * 90) + 10}`;
};

const sendError = (socket, correlationId, code, message) => {
  transportService.send(socket, "ERROR", correlationId, {
    code,
    message,
    retryable: false,
    source: "network"
  });
};

const pushHostSnapshot = () => {
  if (!mainWindow) return;
  const workspaces = workspaceService.listWorkspaces().map((ws) => ({
    workspaceId: ws.workspaceId,
    workspaceName: ws.workspaceName,
    rootPath: ws.singleFileName ? path.join(ws.rootPath, ws.singleFileName) : ws.rootPath,
    sessionCode: ws.sessionCode,
    defaultPermission: ws.defaultPermission,
    createdAt: ws.createdAt,
    clients: sessionService.listConnectedClientsForWorkspace(ws.workspaceId)
  }));
  mainWindow.webContents.send("host:workspaces", workspaces);
  mainWindow.webContents.send("host:pending-joins", sessionService.listAllPendingJoins());
};

const broadcastClientsUpdate = (workspaceId) => {
  const clients = sessionService.listConnectedClientsForWorkspace(workspaceId);
  transportService.broadcastToWorkspace(workspaceId, "CLIENTS_UPDATE", randomUUID(), {
    workspaceId,
    clients
  });
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

const teardownWorkspaceWatcher = (workspaceId) => {
  const entry = workspaceWatchers.get(workspaceId);
  if (!entry) return;
  try {
    entry.watcher.close();
  } catch {
    /* no-op */
  }
  for (const to of entry.timers.values()) clearTimeout(to);
  entry.timers.clear();
  workspaceWatchers.delete(workspaceId);
  crdtService.clearWorkspace(workspaceId);
};

const setupWorkspaceWatcher = (workspaceId, rootPath, singleFileName = null) => {
  teardownWorkspaceWatcher(workspaceId);
  const watchTarget = singleFileName ? path.join(rootPath, singleFileName) : rootPath;
  const watcher = chokidar.watch(watchTarget, { ignoreInitial: true, persistent: true });
  const timers = new Map();
  workspaceWatchers.set(workspaceId, { watcher, timers });

  watcher.on("change", (absolutePath) => {
    const relativePath = singleFileName
      ? singleFileName
      : path.relative(rootPath, absolutePath).split(path.sep).join("/");
    if (!relativePath || relativePath.startsWith("..")) return;
    const prev = timers.get(relativePath);
    if (prev) clearTimeout(prev);
    const timeout = setTimeout(async () => {
      timers.delete(relativePath);
      for (const session of sessionService.listConnectedSessionsForWorkspace(workspaceId)) {
        try {
          await transportService.streamFile(
            session.socket,
            workspaceId,
            relativePath,
            randomUUID(),
            session.clientId
          );
        } catch (error) {
          logger.warn({ error, relativePath, workspaceId }, "Failed to push changed file");
        }
      }
      const entries = await workspaceService.listFiles(workspaceId);
      const ws = workspaceService.getWorkspace(workspaceId);
      if (!ws) return;
      transportService.broadcastToWorkspace(workspaceId, "WORKSPACE_SNAPSHOT", randomUUID(), {
        workspaceId,
        workspaceName: ws.workspaceName,
        entries
      });
    }, 250);
    timers.set(relativePath, timeout);
  });
};

// ---------------------------------------------------------------------------
// WebSocket message handlers
// ---------------------------------------------------------------------------
const onWireMessage = async (socket, message) => {
  if (message.type === "PING") {
    transportService.send(socket, "PONG", message.correlationId, {});
    return;
  }

  // JOIN_REQUEST: validate workspaceId + sessionCode, register pending join,
  // surface to host renderer for approval.
  if (message.type === "JOIN_REQUEST") {
    const parsed = joinRequestSchema.safeParse(message.payload);
    if (!parsed.success) {
      sendError(socket, message.correlationId, "INVALID_JOIN_REQUEST", "Join request payload is invalid");
      return;
    }
    const { workspaceId, sessionCode, displayName, clientId } = parsed.data;
    const ws = workspaceService.getWorkspace(workspaceId);
    if (!ws) {
      transportService.send(socket, "JOIN_REJECT", message.correlationId, {
        reason: "Workspace not found",
        workspaceId
      });
      socket.close();
      return;
    }
    if (ws.sessionCode !== sessionCode) {
      transportService.send(socket, "JOIN_REJECT", message.correlationId, {
        reason: "Invalid session code",
        workspaceId
      });
      socket.close();
      return;
    }

    // Session code already validated — grant direct access.
    const permission = ws.defaultPermission ?? "VIEW_EDIT";
    const requestId = sessionService.addPendingJoin(
      {
        workspaceId,
        clientId,
        displayName,
        correlationId: message.correlationId
      },
      socket,
      () => {
        /* no-op: immediately approved below */
      }
    );
    const approval = sessionService.approveJoin(requestId, permission);
    if (!approval) {
      sendError(socket, message.correlationId, "JOIN_FAILED", "Unable to create session");
      return;
    }

    transportService.send(socket, "JOIN_ACCEPT", message.correlationId, {
      sessionToken: approval.client.sessionToken,
      workspaceName: ws.workspaceName,
      hostName: identityService?.get()?.displayName ?? app.getName(),
      workspaceId: ws.workspaceId,
      sessionCode: ws.sessionCode,
      permission,
      capabilities: permissionToCapabilities(permission)
    });

    const entries = await workspaceService.listFiles(ws.workspaceId);
    transportService.send(socket, "WORKSPACE_SNAPSHOT", randomUUID(), {
      workspaceId: ws.workspaceId,
      workspaceName: ws.workspaceName,
      entries
    });
    broadcastClientsUpdate(ws.workspaceId);
    pushHostSnapshot();
    return;
  }

  if (message.type === "OPEN_FILE") {
    const parsed = openFileSchema.safeParse(message.payload);
    if (!parsed.success) {
      sendError(socket, message.correlationId, "INVALID_OPEN_FILE", "Open file payload is invalid");
      return;
    }
    const client = sessionService.validateToken(parsed.data.sessionToken, socket);
    if (!client) {
      sendError(socket, message.correlationId, "UNAUTHORIZED", "Invalid session token");
      return;
    }
    await transportService.streamFile(
      socket,
      client.workspaceId,
      parsed.data.relativePath,
      message.correlationId,
      client.clientId
    );
    return;
  }

  if (message.type === "CANCEL_OPEN_FILE") {
    const { transferId, sessionToken } = message.payload ?? {};
    const client = sessionService.validateToken(sessionToken, socket);
    if (!client) {
      sendError(socket, message.correlationId, "UNAUTHORIZED", "Invalid session token");
      return;
    }
    if (typeof transferId === "string" && transferId.length > 0) {
      const cancelled = transportService.cancelTransfer(transferId, client.clientId);
      if (!cancelled) {
        sendError(socket, message.correlationId, "TRANSFER_CANCEL_DENIED", "Transfer not found or not owned by this client");
      }
    }
    return;
  }

  if (message.type === "SAVE_FILE") {
    const parsed = saveFileSchema.safeParse(message.payload);
    if (!parsed.success) {
      sendError(socket, message.correlationId, "INVALID_SAVE_FILE", "Save file payload is invalid");
      return;
    }
    const client = sessionService.validateToken(parsed.data.sessionToken, socket);
    if (!client) {
      sendError(socket, message.correlationId, "UNAUTHORIZED", "Invalid session token");
      return;
    }
    if (client.permission !== "VIEW_EDIT") {
      sendError(socket, message.correlationId, "PERMISSION_DENIED", "You have view-only access to this workspace");
      return;
    }
    await workspaceService.writeTextFile(client.workspaceId, parsed.data.relativePath, parsed.data.content);
    transportService.send(socket, "SAVE_ACK", message.correlationId, {
      relativePath: parsed.data.relativePath
    });
    return;
  }

  if (message.type === "CRDT_INIT") {
    const parsed = crdtInitSchema.safeParse(message.payload);
    if (!parsed.success) {
      sendError(socket, message.correlationId, "INVALID_CRDT_INIT", "CRDT init payload is invalid");
      return;
    }
    const client = sessionService.validateToken(parsed.data.sessionToken, socket);
    if (!client) {
      sendError(socket, message.correlationId, "UNAUTHORIZED", "Invalid session token");
      return;
    }
    const stateUpdate = await crdtService.getStateUpdate(client.workspaceId, parsed.data.relativePath);
    transportService.send(socket, "CRDT_SYNC_RESPONSE", message.correlationId, {
      relativePath: parsed.data.relativePath,
      stateUpdate
    });
    return;
  }

  if (message.type === "CRDT_SYNC_REQUEST") {
    const parsed = crdtSyncRequestSchema.safeParse(message.payload);
    if (!parsed.success) {
      sendError(socket, message.correlationId, "INVALID_CRDT_SYNC_REQUEST", "CRDT sync request payload is invalid");
      return;
    }
    const client = sessionService.validateToken(parsed.data.sessionToken, socket);
    if (!client) {
      sendError(socket, message.correlationId, "UNAUTHORIZED", "Invalid session token");
      return;
    }
    const stateUpdate = await crdtService.getStateUpdate(client.workspaceId, parsed.data.relativePath);
    transportService.send(socket, "CRDT_SYNC_RESPONSE", message.correlationId, {
      relativePath: parsed.data.relativePath,
      stateUpdate
    });
    return;
  }

  if (message.type === "CRDT_UPDATE") {
    const parsed = crdtUpdateSchema.safeParse(message.payload);
    if (!parsed.success) {
      sendError(socket, message.correlationId, "INVALID_CRDT_UPDATE", "CRDT update payload is invalid");
      return;
    }
    const client = sessionService.validateToken(parsed.data.sessionToken, socket);
    if (!client) {
      sendError(socket, message.correlationId, "UNAUTHORIZED", "Invalid session token");
      return;
    }
    if (client.permission !== "VIEW_EDIT") {
      sendError(socket, message.correlationId, "PERMISSION_DENIED", "You have view-only access to this workspace");
      return;
    }
    const normalizedUpdate = await crdtService.applyUpdate(
      client.workspaceId,
      parsed.data.relativePath,
      parsed.data.update
    );
    for (const target of sessionService.listConnectedSessionsForWorkspace(client.workspaceId)) {
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
      sendError(socket, message.correlationId, "INVALID_FILE_ACK", "File ACK payload is invalid");
      return;
    }
    const client = sessionService.validateToken(parsed.data.sessionToken, socket);
    if (!client) {
      sendError(socket, message.correlationId, "UNAUTHORIZED", "Invalid session token");
      return;
    }
    transportService.finalizeTransfer(parsed.data.transferId, client.clientId, true);
    return;
  }

  if (message.type === "FILE_NACK") {
    const parsed = fileNackSchema.safeParse(message.payload);
    if (!parsed.success) {
      sendError(socket, message.correlationId, "INVALID_FILE_NACK", "File NACK payload is invalid");
      return;
    }
    const client = sessionService.validateToken(parsed.data.sessionToken, socket);
    if (!client) {
      sendError(socket, message.correlationId, "UNAUTHORIZED", "Invalid session token");
      return;
    }
    transportService.finalizeTransfer(parsed.data.transferId, client.clientId, false, parsed.data.reason);
  }
};

const onConnectionClosed = (_socket, removedClients) => {
  if (Array.isArray(removedClients) && removedClients.length > 0) {
    for (const client of removedClients) {
      broadcastClientsUpdate(client.workspaceId);
    }
  }
  pushHostSnapshot();
};

const ensureServerStarted = () => {
  if (serverStarted) {
    transportService.startServer(SHARED_PORT, { onMessage: onWireMessage, onConnectionClosed });
    return;
  }
  transportService.startServer(SHARED_PORT, { onMessage: onWireMessage, onConnectionClosed });
  serverStarted = true;
};

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(async () => {
  identityService = new IdentityService(app.getPath("userData"));
  await identityService.load();
  await createWindow();
  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    for (const wsId of Array.from(workspaceWatchers.keys())) teardownWorkspaceWatcher(wsId);
    transportService.stopServer();
    transportService.disconnectClient();
    discovery.destroy();
    app.quit();
  }
});

// ---------------------------------------------------------------------------
// Identity IPC
// ---------------------------------------------------------------------------
ipcMain.handle("identity:get", async () => {
  return { ok: true, identity: identityService?.get() ?? null };
});

ipcMain.handle("identity:set", async (_event, payload) => {
  try {
    const rawName = payload?.displayName;
    const validated = displayNameSchema.parse(rawName);
    const identity = await identityService.set(validated);
    return { ok: true, identity };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid display name"
    };
  }
});

// ---------------------------------------------------------------------------
// Host / Workspace IPC
// ---------------------------------------------------------------------------
ipcMain.handle("workspace:create", async (_event, payload) => {
  try {
    logger.info("workspace:create dialog opening");
    // Electron's showOpenDialog cannot combine openFile + openDirectory on
    // Windows or Linux — only macOS supports it. On those platforms we ask
    // the user which they want first, then open the matching single-mode
    // dialog so both files and folders remain selectable.
    let pickProperties;
    if (process.platform === "darwin") {
      pickProperties = ["openFile", "openDirectory", "showHiddenFiles", "treatPackageAsDirectory"];
    } else {
      const choice = mainWindow
        ? await dialog.showMessageBox(mainWindow, {
            type: "question",
            title: "Share file or folder",
            message: "What would you like to share?",
            buttons: ["File", "Folder", "Cancel"],
            defaultId: 0,
            cancelId: 2
          })
        : await dialog.showMessageBox({
            type: "question",
            title: "Share file or folder",
            message: "What would you like to share?",
            buttons: ["File", "Folder", "Cancel"],
            defaultId: 0,
            cancelId: 2
          });
      if (choice.response === 2) {
        logger.info("workspace:create dialog cancelled at chooser");
        return { ok: false, cancelled: true };
      }
      pickProperties = choice.response === 0
        ? ["openFile", "showHiddenFiles"]
        : ["openDirectory", "showHiddenFiles"];
    }
    const dialogOptions = {
      title: "Select a file or folder to share",
      buttonLabel: "Share",
      properties: pickProperties
    };
    const selected = mainWindow
      ? await dialog.showOpenDialog(mainWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    logger.info({ canceled: selected.canceled, count: selected.filePaths.length }, "workspace:create dialog result");
    if (selected.canceled || selected.filePaths.length === 0) {
      return { ok: false, cancelled: true };
    }

    const selectedPath = selected.filePaths[0];
    const selectedStat = await fsPromises.stat(selectedPath);
    const isFile = selectedStat.isFile();
    const rootPath = isFile ? path.dirname(selectedPath) : selectedPath;
    const singleFileName = isFile ? path.basename(selectedPath) : null;
    const proposedName = (payload?.workspaceName || path.basename(selectedPath)).trim();
    if (workspaceService.isWorkspaceNameTaken(proposedName)) {
      return { ok: false, error: "A workspace with this name is already being hosted" };
    }
    const defaultPermission = payload?.defaultPermission === "VIEW_ONLY" ? "VIEW_ONLY" : "VIEW_EDIT";
    const workspaceId = randomUUID();
    const sessionCode = generateSessionCode();

    workspaceService.addWorkspace({
      workspaceId,
      workspaceName: proposedName,
      rootPath,
      sessionCode,
      defaultPermission,
      createdAt: Date.now(),
      singleFileName
    });

    ensureServerStarted();
    setupWorkspaceWatcher(workspaceId, rootPath, singleFileName);

    discovery.advertiseWorkspace({
      workspaceName: proposedName,
      hostName: identityService?.get()?.displayName ?? app.getName(),
      workspaceId,
      sessionCode,
      port: SHARED_PORT
    });

    const fileEntries = await workspaceService.listFiles(workspaceId);
    const record = {
      workspaceId,
      workspaceName: proposedName,
      rootPath: singleFileName ? path.join(rootPath, singleFileName) : rootPath,
      sessionCode,
      defaultPermission,
      createdAt: Date.now(),
      fileEntries,
      clients: []
    };
    pushHostSnapshot();
    mainWindow?.webContents.send("host:status", {
      state: "advertising",
      workspaceName: proposedName,
      message: `Sharing ${proposedName}`,
      sessionCode
    });
    return { ok: true, workspace: record };
  } catch (error) {
    logger.error({ error }, "workspace:create failed");
    mainWindow?.webContents.send("host:status", { state: "error", message: "Unable to start workspace host." });
    return {
      ok: false,
      error: toErrorPayload(new AppError("HOST_START_FAILED", "Unable to start host", true, "main"))
    };
  }
});

ipcMain.handle("workspace:list", async () => {
  return workspaceService.listWorkspaces().map((ws) => ({
    ...ws,
    rootPath: ws.singleFileName ? path.join(ws.rootPath, ws.singleFileName) : ws.rootPath,
    clients: sessionService.listConnectedClientsForWorkspace(ws.workspaceId)
  }));
});

ipcMain.handle("workspace:list-files", async (_event, payload) => {
  const workspaceId = payload?.workspaceId;
  if (!workspaceId) return [];
  return workspaceService.listFiles(workspaceId);
});

ipcMain.handle("workspace:stop", async (_event, payload) => {
  const workspaceId = payload?.workspaceId;
  if (!workspaceId || !workspaceService.hasWorkspace(workspaceId)) {
    return { ok: false, error: "Workspace not found" };
  }
  // Notify clients, close sockets
  const sessions = sessionService.listConnectedSessionsForWorkspace(workspaceId);
  for (const s of sessions) {
    try {
      transportService.send(s.socket, "SESSION_REVOKED", randomUUID(), {
        workspaceId,
        reason: "Host stopped this workspace"
      });
      s.socket.close();
    } catch {
      /* no-op */
    }
  }
  sessionService.revokeWorkspace(workspaceId);
  teardownWorkspaceWatcher(workspaceId);
  discovery.stopAdvertising(workspaceId);
  workspaceService.removeWorkspace(workspaceId);

  // If no workspaces remain, stop the server entirely.
  if (workspaceService.listWorkspaces().length === 0) {
    transportService.stopServer();
    serverStarted = false;
  }
  pushHostSnapshot();
  return { ok: true };
});

ipcMain.handle("session:stop-all", async () => {
  for (const ws of workspaceService.listWorkspaces()) {
    sessionService.revokeWorkspace(ws.workspaceId);
    teardownWorkspaceWatcher(ws.workspaceId);
    discovery.stopAdvertising(ws.workspaceId);
    workspaceService.removeWorkspace(ws.workspaceId);
  }
  transportService.stopServer();
  serverStarted = false;
  pushHostSnapshot();
  mainWindow?.webContents.send("host:status", { state: "stopped", message: "Sharing stopped." });
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Join approval IPC
// ---------------------------------------------------------------------------
ipcMain.handle("session:approve-join", async (_event, payload) => {
  try {
    const requestId = payload?.requestId;
    const permissionResult = permissionSchema.safeParse(payload?.permission);
    if (!requestId || !permissionResult.success) {
      return { ok: false, error: "Invalid payload" };
    }
    const permission = permissionResult.data;
    const pending = sessionService.getPendingJoin(requestId);
    if (!pending) return { ok: false, error: "Pending join not found (may have expired)" };
    const ws = workspaceService.getWorkspace(pending.workspaceId);
    if (!ws) {
      sessionService.rejectJoin(requestId);
      return { ok: false, error: "Workspace no longer exists" };
    }

    const approval = sessionService.approveJoin(requestId, permission);
    if (!approval) return { ok: false, error: "Unable to approve join" };
    const { record, client } = approval;

    transportService.send(record.socket, "JOIN_ACCEPT", record.correlationId, {
      sessionToken: client.sessionToken,
      workspaceName: ws.workspaceName,
      hostName: identityService?.get()?.displayName ?? app.getName(),
      workspaceId: ws.workspaceId,
      sessionCode: ws.sessionCode,
      permission,
      capabilities: permissionToCapabilities(permission)
    });

    const entries = await workspaceService.listFiles(ws.workspaceId);
    transportService.send(record.socket, "WORKSPACE_SNAPSHOT", randomUUID(), {
      workspaceId: ws.workspaceId,
      workspaceName: ws.workspaceName,
      entries
    });
    broadcastClientsUpdate(ws.workspaceId);
    pushHostSnapshot();
    return { ok: true };
  } catch (error) {
    logger.error({ error }, "approve-join failed");
    return { ok: false, error: "Failed to approve" };
  }
});

ipcMain.handle("session:reject-join", async (_event, payload) => {
  const requestId = payload?.requestId;
  const reason = typeof payload?.reason === "string" && payload.reason.trim().length > 0
    ? payload.reason
    : "Host rejected the request";
  if (!requestId) return { ok: false, error: "Missing requestId" };
  const record = sessionService.rejectJoin(requestId);
  if (!record) return { ok: false, error: "Pending join not found" };
  try {
    transportService.send(record.socket, "JOIN_REJECT", record.correlationId, {
      reason,
      workspaceId: record.workspaceId
    });
    record.socket.close();
  } catch {
    /* no-op */
  }
  pushHostSnapshot();
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Per-client permission + kick
// ---------------------------------------------------------------------------
ipcMain.handle("session:update-client-permission", async (_event, payload) => {
  const permissionResult = permissionSchema.safeParse(payload?.permission);
  if (!payload?.workspaceId || !payload?.clientId || !permissionResult.success) {
    return { ok: false, error: "Invalid payload" };
  }
  const client = sessionService.updateClientPermission(
    payload.workspaceId,
    payload.clientId,
    permissionResult.data
  );
  if (!client) return { ok: false, error: "Client not found" };
  try {
    transportService.send(client.socket, "PERMISSION_CHANGED", randomUUID(), {
      workspaceId: client.workspaceId,
      permission: client.permission,
      capabilities: permissionToCapabilities(client.permission)
    });
  } catch {
    /* no-op */
  }
  broadcastClientsUpdate(payload.workspaceId);
  pushHostSnapshot();
  return { ok: true };
});

ipcMain.handle("session:kick-client", async (_event, payload) => {
  if (!payload?.workspaceId || !payload?.clientId) {
    return { ok: false, error: "Invalid payload" };
  }
  const reason = typeof payload?.reason === "string" && payload.reason.trim().length > 0
    ? payload.reason
    : "You have been removed by the host";
  const client = sessionService.removeClient(payload.workspaceId, payload.clientId);
  if (!client) return { ok: false, error: "Client not found" };
  try {
    transportService.send(client.socket, "SESSION_REVOKED", randomUUID(), {
      workspaceId: payload.workspaceId,
      reason
    });
    client.socket.close();
  } catch {
    /* no-op */
  }
  broadcastClientsUpdate(payload.workspaceId);
  pushHostSnapshot();
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Discovery IPC
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Client IPC (joining a remote workspace)
// ---------------------------------------------------------------------------
ipcMain.handle("client:join-workspace", async (_event, workspace) => {
  const identity = identityService?.get();
  if (!identity) {
    return { ok: false, error: "Please set your name before joining" };
  }
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
    const hostPort = workspace.port ?? workspace.manualPort ?? SHARED_PORT;
    transportService.connectClient(`ws://${hostAddress}:${hostPort}`, {
      onOpen: () => {
        const correlationId = randomUUID();
        transportService.send(transportService.client, "JOIN_REQUEST", correlationId, {
          displayName: identity.displayName,
          clientId: identity.userId,
          workspaceId: workspace.workspaceId,
          sessionCode: workspace.sessionCode
        });
      },
      onMessage: (message) => {
        mainWindow?.webContents.send("client:message", message);
        if (message.type === "JOIN_PENDING") {
          // keep waiting
        } else if (message.type === "JOIN_ACCEPT") {
          activeSessionToken = message.payload.sessionToken;
          activeJoinedWorkspaceId = message.payload.workspaceId;
          done({ ok: true, status: "connected" });
        } else if (message.type === "JOIN_REJECT") {
          activeSessionToken = null;
          activeJoinedWorkspaceId = null;
          transportService.disconnectClient();
          done({ ok: false, status: "rejected", reason: message.payload?.reason });
        } else if (message.type === "SESSION_REVOKED") {
          activeSessionToken = null;
          activeJoinedWorkspaceId = null;
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
  if (!transportService.client || !activeSessionToken) return { ok: false, error: "No active session" };
  const correlationId = randomUUID();
  transportService.send(transportService.client, "CRDT_INIT", correlationId, {
    sessionToken: activeSessionToken,
    relativePath: payload.relativePath
  });
  return { ok: true, correlationId };
});

ipcMain.handle("client:crdt-sync-request", async (_event, payload) => {
  if (!transportService.client || !activeSessionToken) return { ok: false, error: "No active session" };
  const correlationId = randomUUID();
  transportService.send(transportService.client, "CRDT_SYNC_REQUEST", correlationId, {
    sessionToken: activeSessionToken,
    relativePath: payload.relativePath
  });
  return { ok: true, correlationId };
});

ipcMain.handle("client:crdt-update", async (_event, payload) => {
  if (!transportService.client || !activeSessionToken) return { ok: false, error: "No active session" };
  const correlationId = randomUUID();
  transportService.send(transportService.client, "CRDT_UPDATE", correlationId, {
    sessionToken: activeSessionToken,
    relativePath: payload.relativePath,
    update: payload.update
  });
  return { ok: true, correlationId };
});

ipcMain.handle("client:cancel-open-file", async (_event, payload) => {
  if (!transportService.client || !activeSessionToken) return { ok: false, error: "No active session" };
  const correlationId = randomUUID();
  transportService.send(transportService.client, "CANCEL_OPEN_FILE", correlationId, {
    sessionToken: activeSessionToken,
    transferId: payload.transferId,
    relativePath: payload.relativePath
  });
  return { ok: true };
});

ipcMain.handle("client:file-ack", async (_event, payload) => {
  if (!transportService.client || !activeSessionToken) return { ok: false, error: "No active session" };
  const correlationId = randomUUID();
  transportService.send(transportService.client, "FILE_ACK", correlationId, {
    sessionToken: activeSessionToken,
    transferId: payload.transferId,
    relativePath: payload.relativePath
  });
  return { ok: true };
});

ipcMain.handle("client:file-nack", async (_event, payload) => {
  if (!transportService.client || !activeSessionToken) return { ok: false, error: "No active session" };
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
  if (!transportService.client || !activeSessionToken) return { ok: false, error: "No active session" };
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
  const identity = identityService?.get();
  if (!identity || !lastJoinedWorkspace) return { ok: false };
  return new Promise((resolve) => {
    const hostAddress = lastJoinedWorkspace.hostAddress ?? lastJoinedWorkspace.manualHost ?? "127.0.0.1";
    const hostPort = lastJoinedWorkspace.port ?? lastJoinedWorkspace.manualPort ?? SHARED_PORT;
    transportService.connectClient(`ws://${hostAddress}:${hostPort}`, {
      onOpen: () => {
        const correlationId = randomUUID();
        transportService.send(transportService.client, "JOIN_REQUEST", correlationId, {
          displayName: identity.displayName,
          clientId: identity.userId,
          workspaceId: lastJoinedWorkspace.workspaceId,
          sessionCode: lastJoinedWorkspace.sessionCode
        });
      },
      onMessage: (message) => {
        mainWindow?.webContents.send("client:message", message);
        if (message.type === "JOIN_ACCEPT") {
          activeSessionToken = message.payload.sessionToken;
          activeJoinedWorkspaceId = message.payload.workspaceId;
          resolve({ ok: true, status: "connected" });
        } else if (message.type === "JOIN_REJECT") {
          resolve({ ok: false, status: "rejected", reason: message.payload?.reason });
        }
      },
      onError: () => resolve({ ok: false })
    });
  });
});

ipcMain.handle("client:get-session-state", async () => {
  if (activeSessionToken && activeJoinedWorkspaceId && lastJoinedWorkspace && transportService.client) {
    return {
      hasActiveSession: true,
      workspaceId: activeJoinedWorkspaceId,
      workspace: lastJoinedWorkspace
    };
  }
  return { hasActiveSession: false };
});

ipcMain.handle("client:disconnect", async () => {
  transportService.disconnectClient();
  activeSessionToken = null;
  activeJoinedWorkspaceId = null;
  lastJoinedWorkspace = null;
  mainWindow?.webContents.send("host:status", {
    state: "client-disconnected",
    message: "Disconnected from session."
  });
  return { ok: true };
});
