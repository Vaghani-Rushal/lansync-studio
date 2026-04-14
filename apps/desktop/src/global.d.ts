import type { ConnectedClient, DiscoveryWorkspace } from "@pcconnector/shared-types";

type Listener<T> = (payload: T) => void;

declare global {
  type WorkspaceEntry = { path: string; name: string; isDirectory: boolean; size?: number };
  type ClientMessage = { type: string; payload: Record<string, unknown> };
  type WorkspaceCreateResponse = {
    ok: boolean;
    workspaceId?: string;
    sessionCode?: string;
    workspaceName?: string;
    rootPath?: string;
    fileEntries?: WorkspaceEntry[];
  };
  interface Window {
    pcConnectorApi: {
      isBridgeReady(): boolean;
      createWorkspace(payload: { workspaceName: string; port?: number; permission?: "VIEW_ONLY" | "VIEW_EDIT" }): Promise<WorkspaceCreateResponse>;
      listWorkspaceFiles(): Promise<WorkspaceEntry[]>;
      startDiscovery(): Promise<{ ok: boolean }>;
      stopDiscovery(): Promise<{ ok: boolean }>;
      stopSession(): Promise<{ ok: boolean }>;
      joinWorkspace(workspace: DiscoveryWorkspace): Promise<{ ok: boolean }>;
      openFile(relativePath: string): Promise<{ ok: boolean; correlationId?: string; error?: string }>;
      crdtInit(payload: { relativePath: string }): Promise<{ ok: boolean; correlationId?: string; error?: string }>;
      crdtSyncRequest(payload: { relativePath: string }): Promise<{ ok: boolean; correlationId?: string; error?: string }>;
      crdtUpdate(payload: { relativePath: string; update: string }): Promise<{ ok: boolean; correlationId?: string; error?: string }>;
      cancelOpenFile(payload: { transferId: string; relativePath: string }): Promise<{ ok: boolean; error?: string }>;
      acknowledgeFileTransfer(payload: { transferId: string; relativePath: string }): Promise<{ ok: boolean; error?: string }>;
      rejectFileTransfer(payload: { transferId: string; relativePath: string; reason: string }): Promise<{ ok: boolean; error?: string }>;
      saveFile(payload: { relativePath: string; content: string }): Promise<{ ok: boolean; correlationId?: string; error?: string }>;
      disconnectClient(): Promise<{ ok: boolean }>;
      reconnectClient(): Promise<{ ok: boolean }>;
      onWorkspaces(listener: Listener<DiscoveryWorkspace[]>): () => void;
      onClientMessage(listener: Listener<ClientMessage>): () => void;
      onHostStatus(listener: Listener<{ state: string; message?: string; workspaceName?: string; sessionCode?: string }>): () => void;
      onSessionClients(listener: Listener<ConnectedClient[]>): () => void;
    };
  }
}

export {};
