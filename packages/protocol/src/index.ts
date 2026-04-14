import { z } from "zod";

export const messageTypes = [
  "HELLO",
  "JOIN_REQUEST",
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
  "ERROR",
  "PING",
  "PONG",
  "SESSION_STOP"
] as const;

export const protocolVersion = "1.0.0";

export const wireMessageSchema = z.object({
  version: z.literal(protocolVersion),
  type: z.enum(messageTypes),
  correlationId: z.string().min(1),
  payload: z.record(z.string(), z.any())
});

export type WireMessage = z.infer<typeof wireMessageSchema>;

export const joinRequestSchema = z.object({
  deviceName: z.string().min(1),
  clientId: z.string().uuid(),
  workspaceId: z.string().optional(),
  sessionCode: z.string().min(4).optional()
});

export const joinAcceptSchema = z.object({
  sessionToken: z.string().min(16),
  workspaceName: z.string().min(1),
  hostName: z.string().min(1),
  workspaceId: z.string().min(1),
  sessionCode: z.string().min(4),
  capabilities: z.array(z.string()).default(["read"])
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

export const saveFileSchema = z.object({
  sessionToken: z.string().min(16),
  relativePath: z.string().min(1),
  content: z.string(),
  encoding: z.enum(["utf8"]).default("utf8")
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
