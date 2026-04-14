import { describe, expect, it } from "vitest";
import {
  crdtInitSchema,
  crdtSyncRequestSchema,
  crdtSyncResponseSchema,
  crdtUpdateSchema,
  fileAckSchema,
  fileNackSchema,
  joinAcceptSchema,
  joinRequestSchema,
  protocolVersion,
  wireMessageSchema
} from "./index";

describe("wireMessageSchema", () => {
  it("accepts valid protocol messages", () => {
    const result = wireMessageSchema.safeParse({
      version: protocolVersion,
      type: "PING",
      correlationId: "abc",
      payload: {}
    });
    expect(result.success).toBe(true);
  });

  it("rejects unsupported protocol versions", () => {
    const result = wireMessageSchema.safeParse({
      version: "0.9.0",
      type: "PING",
      correlationId: "abc",
      payload: {}
    });
    expect(result.success).toBe(false);
  });
});

describe("message payload schemas", () => {
  it("validates join request with workspace and session code", () => {
    const result = joinRequestSchema.safeParse({
      deviceName: "Client PC",
      clientId: "9fc495ec-7c50-49a5-b2fd-4bf33a046b9a",
      workspaceId: "workspace-1",
      sessionCode: "TIGER-42"
    });
    expect(result.success).toBe(true);
  });

  it("validates join accept payload contract", () => {
    const result = joinAcceptSchema.safeParse({
      sessionToken: "1234567890abcdef1234567890abcdef",
      workspaceName: "MyWorkspace",
      hostName: "Host-PC",
      workspaceId: "workspace-1",
      sessionCode: "TIGER-42",
      capabilities: ["read", "write"]
    });
    expect(result.success).toBe(true);
  });

  it("validates FILE_ACK and FILE_NACK payloads", () => {
    const ack = fileAckSchema.safeParse({
      sessionToken: "1234567890abcdef1234567890abcdef",
      transferId: "transfer-1",
      relativePath: "src/app.ts"
    });
    const nack = fileNackSchema.safeParse({
      sessionToken: "1234567890abcdef1234567890abcdef",
      transferId: "transfer-1",
      relativePath: "src/app.ts",
      reason: "Checksum mismatch"
    });
    expect(ack.success).toBe(true);
    expect(nack.success).toBe(true);
  });

  it("validates CRDT lifecycle payloads", () => {
    const init = crdtInitSchema.safeParse({
      sessionToken: "1234567890abcdef1234567890abcdef",
      relativePath: "src/app.ts"
    });
    const syncReq = crdtSyncRequestSchema.safeParse({
      sessionToken: "1234567890abcdef1234567890abcdef",
      relativePath: "src/app.ts"
    });
    const syncRes = crdtSyncResponseSchema.safeParse({
      relativePath: "src/app.ts",
      stateUpdate: "AAAA"
    });
    const update = crdtUpdateSchema.safeParse({
      sessionToken: "1234567890abcdef1234567890abcdef",
      relativePath: "src/app.ts",
      update: "AAAA"
    });
    expect(init.success).toBe(true);
    expect(syncReq.success).toBe(true);
    expect(syncRes.success).toBe(true);
    expect(update.success).toBe(true);
  });
});
