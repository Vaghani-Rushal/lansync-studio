export type DiscoveryWorkspace = {
  workspaceId: string;
  workspaceName: string;
  hostName: string;
  hostAddress: string;
  port: number;
  sessionCode?: string;
  lastSeenAt: number;
};

export type JoinRequest = {
  deviceName: string;
  clientId: string;
};

export type PendingJoin = JoinRequest & {
  requestId: string;
  requestedAt: number;
};

export type ConnectedClient = {
  clientId: string;
  deviceName: string;
  connectedAt: number;
  capabilities: string[];
};

export type FileTreeNode = {
  id: string;
  name: string;
  relativePath: string;
  isDirectory: boolean;
  size?: number;
  mimeType?: string;
  children?: FileTreeNode[];
};
