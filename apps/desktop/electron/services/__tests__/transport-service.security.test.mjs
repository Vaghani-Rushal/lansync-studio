import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { SessionService } from "../session-service.mjs";
import { TransportService } from "../transport-service.mjs";

class WorkspaceStub {
  createFileStream() {
    return Readable.from([Buffer.from("hello")]);
  }
  async getFileMeta() {
    return { fileSize: 5, expectedChunks: 1 };
  }
  isBinary() {
    return false;
  }
  getMimeType() {
    return "text/plain";
  }
}

describe("TransportService security", () => {
  it("denies cancellation from non-owner client", async () => {
    const session = new SessionService();
    const transport = new TransportService(session, new WorkspaceStub());
    const sent = [];
    const socket = { send: (payload) => sent.push(JSON.parse(payload)) };

    const transferId = await transport.streamFile(socket, "test.txt", "corr-1", "client-owner");
    const cancelledByOther = transport.cancelTransfer(transferId, "client-other");
    const cancelledByOwner = transport.cancelTransfer(transferId, "client-owner");

    expect(cancelledByOther).toBe(false);
    expect(cancelledByOwner).toBe(true);
    expect(sent.some((msg) => msg.type === "FILE_START")).toBe(true);
    expect(sent.some((msg) => msg.type === "FILE_END")).toBe(true);
  });
});
