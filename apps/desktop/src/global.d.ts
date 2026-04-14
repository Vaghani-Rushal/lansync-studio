import type {
  DiscoveryWorkspace,
  HostedWorkspace,
  PendingJoin,
  Permission,
  UserIdentity
} from "@pcconnector/shared-types";

type Listener<T> = (payload: T) => void;

declare global {
  type WorkspaceEntry = { path: string; name: string; isDirectory: boolean; size?: number; mimeType?: string };
  type ClientMessage = { type: string; payload: Record<string, unknown> };

  type WorkspaceCreateResponse =
    | { ok: true; workspace: HostedWorkspace }
    | { ok: false; cancelled?: boolean; error?: unknown };

  type IdentityResponse = { ok: boolean; identity?: UserIdentity | null; error?: string };
  type JoinResult = { ok: boolean; status?: "connected" | "rejected"; reason?: string; error?: string };

  interface Window {
    pcConnectorApi: {
      isBridgeReady(): boolean;

      // Identity
      getIdentity(): Promise<IdentityResponse>;
      setIdentity(payload: { displayName: string }): Promise<IdentityResponse>;

      // Host
      createWorkspace(payload: { workspaceName: string; defaultPermission: Permission }): Promise<WorkspaceCreateResponse>;
      listHostedWorkspaces(): Promise<HostedWorkspace[]>;
      listWorkspaceFiles(payload: { workspaceId: string }): Promise<WorkspaceEntry[]>;
      stopWorkspace(payload: { workspaceId: string }): Promise<{ ok: boolean; error?: string }>;
      stopAllSessions(): Promise<{ ok: boolean }>;

      // Approval
      approveJoin(payload: { requestId: string; permission: Permission }): Promise<{ ok: boolean; error?: string }>;
      rejectJoin(payload: { requestId: string; reason?: string }): Promise<{ ok: boolean; error?: string }>;

      // Per-client
      updateClientPermission(payload: {
        workspaceId: string;
        clientId: string;
        permission: Permission;
      }): Promise<{ ok: boolean; error?: string }>;
      kickClient(payload: { workspaceId: string; clientId: string; reason?: string }): Promise<{ ok: boolean; error?: string }>;

      // Discovery
      startDiscovery(): Promise<{ ok: boolean }>;
      stopDiscovery(): Promise<{ ok: boolean }>;

      // Client (joining)
      joinWorkspace(workspace: DiscoveryWorkspace): Promise<JoinResult>;
      openFile(relativePath: string): Promise<{ ok: boolean; correlationId?: string; error?: string }>;
      crdtInit(payload: { relativePath: string }): Promise<{ ok: boolean; correlationId?: string; error?: string }>;
      crdtSyncRequest(payload: { relativePath: string }): Promise<{ ok: boolean; correlationId?: string; error?: string }>;
      crdtUpdate(payload: { relativePath: string; update: string }): Promise<{ ok: boolean; correlationId?: string; error?: string }>;
      cancelOpenFile(payload: { transferId: string; relativePath: string }): Promise<{ ok: boolean; error?: string }>;
      acknowledgeFileTransfer(payload: { transferId: string; relativePath: string }): Promise<{ ok: boolean; error?: string }>;
      rejectFileTransfer(payload: { transferId: string; relativePath: string; reason: string }): Promise<{ ok: boolean; error?: string }>;
      saveFile(payload: { relativePath: string; content: string }): Promise<{ ok: boolean; correlationId?: string; error?: string }>;
      disconnectClient(): Promise<{ ok: boolean }>;
      reconnectClient(): Promise<JoinResult>;
      getClientSessionState(): Promise<{ hasActiveSession: boolean; workspaceId?: string; workspace?: DiscoveryWorkspace }>;

      // Clipboard
      getClipboardHistory(): Promise<Array<{ historyId: string; text?: string; image?: string; timestamp: number }>>;
      writeClipboardItem(payload: { historyId: string }): Promise<{ ok: boolean }>;

      // Listeners
      onWorkspaces(listener: Listener<DiscoveryWorkspace[]>): () => void;
      onClientMessage(listener: Listener<ClientMessage>): () => void;
      onHostStatus(listener: Listener<{ state: string; message?: string; workspaceName?: string; sessionCode?: string }>): () => void;
      onHostedWorkspaces(listener: Listener<HostedWorkspace[]>): () => void;
      onPendingJoins(listener: Listener<PendingJoin[]>): () => void;
      onClipboardUpdate(listener: Listener<Array<{ historyId: string; text?: string; image?: string; timestamp: number }>>): () => void;
    };
  }
}

export {};
