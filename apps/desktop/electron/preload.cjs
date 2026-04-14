const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pcConnectorApi", {
  isBridgeReady: () => true,

  // Identity
  getIdentity: () => ipcRenderer.invoke("identity:get"),
  setIdentity: (payload) => ipcRenderer.invoke("identity:set", payload),

  // Host / workspaces
  createWorkspace: (payload) => ipcRenderer.invoke("workspace:create", payload),
  listHostedWorkspaces: () => ipcRenderer.invoke("workspace:list"),
  listWorkspaceFiles: (payload) => ipcRenderer.invoke("workspace:list-files", payload),
  stopWorkspace: (payload) => ipcRenderer.invoke("workspace:stop", payload),
  stopAllSessions: () => ipcRenderer.invoke("session:stop-all"),

  // Pending joins / approval
  approveJoin: (payload) => ipcRenderer.invoke("session:approve-join", payload),
  rejectJoin: (payload) => ipcRenderer.invoke("session:reject-join", payload),

  // Per-client management
  updateClientPermission: (payload) => ipcRenderer.invoke("session:update-client-permission", payload),
  kickClient: (payload) => ipcRenderer.invoke("session:kick-client", payload),

  // Discovery
  startDiscovery: () => ipcRenderer.invoke("discovery:start"),
  stopDiscovery: () => ipcRenderer.invoke("discovery:stop"),

  // Client (joining a remote workspace)
  joinWorkspace: (workspace) => ipcRenderer.invoke("client:join-workspace", workspace),
  openFile: (relativePath) => ipcRenderer.invoke("client:open-file", relativePath),
  crdtInit: (payload) => ipcRenderer.invoke("client:crdt-init", payload),
  crdtSyncRequest: (payload) => ipcRenderer.invoke("client:crdt-sync-request", payload),
  crdtUpdate: (payload) => ipcRenderer.invoke("client:crdt-update", payload),
  cancelOpenFile: (payload) => ipcRenderer.invoke("client:cancel-open-file", payload),
  acknowledgeFileTransfer: (payload) => ipcRenderer.invoke("client:file-ack", payload),
  rejectFileTransfer: (payload) => ipcRenderer.invoke("client:file-nack", payload),
  saveFile: (payload) => ipcRenderer.invoke("client:save-file", payload),
  disconnectClient: () => ipcRenderer.invoke("client:disconnect"),
  reconnectClient: () => ipcRenderer.invoke("client:reconnect"),
  getClientSessionState: () => ipcRenderer.invoke("client:get-session-state"),

  // Clipboard
  getClipboardHistory: () => ipcRenderer.invoke("clipboard:get-history"),
  writeClipboardItem: (payload) => ipcRenderer.invoke("clipboard:write", payload),

  // Event listeners
  onWorkspaces: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on("discovery:workspaces", handler);
    return () => ipcRenderer.removeListener("discovery:workspaces", handler);
  },
  onClientMessage: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on("client:message", handler);
    return () => ipcRenderer.removeListener("client:message", handler);
  },
  onHostStatus: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on("host:status", handler);
    return () => ipcRenderer.removeListener("host:status", handler);
  },
  onHostedWorkspaces: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on("host:workspaces", handler);
    return () => ipcRenderer.removeListener("host:workspaces", handler);
  },
  onPendingJoins: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on("host:pending-joins", handler);
    return () => ipcRenderer.removeListener("host:pending-joins", handler);
  },
  onClipboardUpdate: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on("clipboard:update", handler);
    return () => ipcRenderer.removeListener("clipboard:update", handler);
  }
});
