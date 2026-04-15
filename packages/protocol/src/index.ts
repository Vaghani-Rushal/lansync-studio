import { z } from "zod";

export const messageTypes = [
  "HELLO",
  "JOIN_REQUEST",
  "JOIN_PENDING",
  "JOIN_ACCEPT",
  "JOIN_REJECT",
  "CLIENTS_UPDATE",
  "WORKSPACE_SNAPSHOT",
  "FILE_LIST",
  "FILE_START",
  "OPEN_FILE",
  "CANCEL_OPEN_FILE",
  "SAVE_FILE",
  "SAVE_ACK",
  "FILE_CHUNK",
  "FILE_PROGRESS",
  "FILE_END",
  "FILE_ACK",
  "FILE_NACK",
  "CRDT_INIT",
  "CRDT_SYNC_REQUEST",
  "CRDT_SYNC_RESPONSE",
  "CRDT_UPDATE",
  "PERMISSION_CHANGED",
  "SESSION_REVOKED",
  "ERROR",
  "PING",
  "PONG",
  "SESSION_STOP",
  "CLIPBOARD_SYNC"
] as const;

export const protocolVersion = "1.1.0";

export const permissionSchema = z.enum(["VIEW_ONLY", "VIEW_EDIT"]);
export type Permission = z.infer<typeof permissionSchema>;

export const wireMessageSchema = z.object({
  version: z.literal(protocolVersion),
  type: z.enum(messageTypes),
  correlationId: z.string().min(1),
  payload: z.record(z.string(), z.any())
});

export type WireMessage = z.infer<typeof wireMessageSchema>;

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(32, "Name must be at most 32 characters")
  .regex(/^[^\x00-\x1F\x7F]+$/u, "Name contains invalid characters");

export const joinRequestSchema = z.object({
  displayName: displayNameSchema,
  clientId: z.string().uuid(),
  workspaceId: z.string().min(1),
  sessionCode: z.string().min(4)
});

export const joinPendingSchema = z.object({
  requestId: z.string().min(1),
  workspaceId: z.string().min(1),
  workspaceName: z.string().min(1),
  hostName: z.string().min(1)
});

export const joinAcceptSchema = z.object({
  sessionToken: z.string().min(16),
  workspaceName: z.string().min(1),
  hostName: z.string().min(1),
  workspaceId: z.string().min(1),
  sessionCode: z.string().min(4),
  permission: permissionSchema,
  capabilities: z.array(z.string()).default(["read"])
});

export const joinRejectSchema = z.object({
  reason: z.string().min(1),
  workspaceId: z.string().optional()
});

export const permissionChangedSchema = z.object({
  workspaceId: z.string().min(1),
  permission: permissionSchema,
  capabilities: z.array(z.string())
});

export const sessionRevokedSchema = z.object({
  workspaceId: z.string().min(1),
  reason: z.string().min(1)
});

export const workspaceEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  isDirectory: z.boolean(),
  size: z.number().nonnegative().optional()
});

export const workspaceSnapshotSchema = z.object({
  workspaceId: z.string(),
  workspaceName: z.string(),
  entries: z.array(workspaceEntrySchema)
});

export const openFileSchema = z.object({
  sessionToken: z.string().min(16),
  relativePath: z.string().min(1)
});

export const fileChunkSchema = z.object({
  relativePath: z.string().min(1),
  transferId: z.string().min(1),
  sequence: z.number().nonnegative(),
  isBinary: z.boolean(),
  mimeType: z.string().optional(),
  chunk: z.string()
});

export const fileStartSchema = z.object({
  relativePath: z.string().min(1),
  transferId: z.string().min(1),
  fileSize: z.number().nonnegative(),
  expectedChunks: z.number().nonnegative(),
  isBinary: z.boolean(),
  mimeType: z.string().optional()
});

export const fileProgressSchema = z.object({
  relativePath: z.string().min(1),
  transferId: z.string().min(1),
  sentChunks: z.number().nonnegative(),
  totalChunks: z.number().nonnegative()
});

export const fileAckSchema = z.object({
  sessionToken: z.string().min(16),
  transferId: z.string().min(1),
  relativePath: z.string().min(1)
});

export const fileNackSchema = z.object({
  sessionToken: z.string().min(16),
  transferId: z.string().min(1),
  relativePath: z.string().min(1),
  reason: z.string().min(1)
});

export const saveFileSchema = z.object({
  sessionToken: z.string().min(16),
  relativePath: z.string().min(1),
  content: z.string(),
  encoding: z.enum(["utf8", "base64"]).default("utf8"),
  isBinary: z.boolean().optional()
});

export const crdtInitSchema = z.object({
  sessionToken: z.string().min(16),
  relativePath: z.string().min(1)
});

export const crdtSyncRequestSchema = z.object({
  sessionToken: z.string().min(16),
  relativePath: z.string().min(1)
});

export const crdtSyncResponseSchema = z.object({
  relativePath: z.string().min(1),
  stateUpdate: z.string().min(1)
});

export const crdtUpdateSchema = z.object({
  sessionToken: z.string().min(16),
  relativePath: z.string().min(1),
  update: z.string().min(1)
});

export const cancelOpenFileSchema = z.object({
  sessionToken: z.string().min(16),
  transferId: z.string().min(1),
  relativePath: z.string().min(1)
});

export const errorPayloadSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean().default(false),
  source: z.enum(["main", "renderer", "network", "filesystem"]),
  details: z.record(z.string(), z.any()).optional()
});

export const clipboardSyncSchema = z.object({
  historyId: z.string().uuid(),
  text: z.string().optional(),
  image: z.string().optional(),
  timestamp: z.number(),
  sessionToken: z.string().min(16).optional(),
  sourceUserId: z.string().uuid().optional(),
  sourceDisplayName: z.string().min(1).max(64).optional()
});
