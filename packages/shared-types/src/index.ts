export type Permission = "VIEW_ONLY" | "VIEW_EDIT";

export type UserIdentity = {
  userId: string;
  displayName: string;
  createdAt: number;
  updatedAt: number;
};

export type DiscoveryWorkspace = {
  workspaceId: string;
  workspaceName: string;
  hostName: string;
  hostAddress: string;
  port: number;
  sessionCode?: string;
  manualHost?: string;
  manualPort?: number;
  lastSeenAt: number;
};

export type JoinRequest = {
  displayName: string;
  clientId: string;
  workspaceId: string;
  sessionCode: string;
};

export type PendingJoin = {
  requestId: string;
  workspaceId: string;
  workspaceName: string;
  clientId: string;
  displayName: string;
  requestedAt: number;
};

export type ConnectedClient = {
  workspaceId: string;
  clientId: string;
  displayName: string;
  connectedAt: number;
  permission: Permission;
};

export type HostedWorkspace = {
  workspaceId: string;
  workspaceName: string;
  rootPath: string;
  sessionCode: string;
  defaultPermission: Permission;
  createdAt: number;
  fileEntries: FileTreeNode[];
  clients: ConnectedClient[];
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
