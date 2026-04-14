const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pcConnectorApi", {
  isBridgeReady: () => true,
  createWorkspace: (payload) => ipcRenderer.invoke("workspace:create", payload),
  listWorkspaceFiles: () => ipcRenderer.invoke("workspace:list-files"),
  startDiscovery: () => ipcRenderer.invoke("discovery:start"),
  stopDiscovery: () => ipcRenderer.invoke("discovery:stop"),
  approveJoin: (requestId) => ipcRenderer.invoke("session:approve", requestId),
  rejectJoin: (requestId) => ipcRenderer.invoke("session:reject", requestId),
  stopSession: () => ipcRenderer.invoke("session:stop"),
  joinWorkspace: (workspace) => ipcRenderer.invoke("client:join-workspace", workspace),
  openFile: (relativePath) => ipcRenderer.invoke("client:open-file", relativePath),
  cancelOpenFile: (payload) => ipcRenderer.invoke("client:cancel-open-file", payload),
  saveFile: (payload) => ipcRenderer.invoke("client:save-file", payload),
  disconnectClient: () => ipcRenderer.invoke("client:disconnect"),
  reconnectClient: () => ipcRenderer.invoke("client:reconnect"),
  onWorkspaces: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on("discovery:workspaces", handler);
    return () => ipcRenderer.removeListener("discovery:workspaces", handler);
  },
  onPendingJoins: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on("session:pending-joins", handler);
    return () => ipcRenderer.removeListener("session:pending-joins", handler);
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
  onSessionClients: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on("session:clients", handler);
    return () => ipcRenderer.removeListener("session:clients", handler);
  }
});
