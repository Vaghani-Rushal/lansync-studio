import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { SessionService } from "../session-service.mjs";
import { TransportService } from "../transport-service.mjs";

class WorkspaceStub {
  createFileStream() {
    throw new Error("not-needed");
  }
  isBinary() {
    return false;
  }
  getMimeType() {
    return "text/plain";
  }
}

describe("TransportService integration", () => {
  /** @type {TransportService | null} */
  let transport = null;

  afterEach(() => {
    transport?.closeAll();
    transport = null;
  });

  it("accepts ws messages and replies to ping", async () => {
    const session = new SessionService();
    transport = new TransportService(session, new WorkspaceStub());
    const port = 8899;
    transport.startServer(port, {
      onMessage: async (socket, message) => {
        if (message.type === "PING") {
          transport.send(socket, "PONG", message.correlationId, {});
        }
      }
    });

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      ws.on("open", () => {
        ws.send(JSON.stringify({ version: "1.0.0", type: "PING", correlationId: "abc", payload: {} }));
      });
      ws.on("message", (buffer) => {
        const message = JSON.parse(buffer.toString());
        try {
          expect(message.type).toBe("PONG");
          ws.close();
          resolve(undefined);
        } catch (error) {
          reject(error);
        }
      });
      ws.on("error", reject);
    });
  });
});
