import { createHash, randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { protocolVersion, wireMessageSchema } from "@pcconnector/protocol";
import { AppError, toErrorPayload } from "./errors.mjs";
import { logger } from "./logger.mjs";

export class TransportService {
  constructor(sessionService, workspaceService) {
    this.sessionService = sessionService;
    this.workspaceService = workspaceService;
    this.server = null;
    this.client = null;
    this.connections = new Set();
    this.clientHandlers = null;
    this.clientUrl = null;
    this.lastPongAt = 0;
    this.heartbeatInterval = null;
    this.watchdogInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.manualClose = false;
    this.activeTransfers = new Map();
  }

  startServer(port, handlers) {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.server = new WebSocketServer({ port });
    this.server.on("connection", (socket) => {
      this.connections.add(socket);
      socket.on("message", async (buffer) => {
        try {
          const incoming = JSON.parse(buffer.toString());
          const parsed = wireMessageSchema.parse(incoming);
          await handlers.onMessage(socket, parsed);
        } catch (error) {
          logger.error({ error }, "Invalid message");
          this.sendError(socket, error);
        }
      });
      socket.on("close", () => this.connections.delete(socket));
      socket.on("close", () => this.sessionService.removeSocket(socket));
      socket.on("close", () => handlers.onConnectionClosed?.());
    });
    return this.server;
  }

  connectClient(url, handlers) {
    this.manualClose = false;
    this.clientUrl = url;
    this.clientHandlers = handlers;
    this.client?.close();
    this.client = new WebSocket(url);
    this.client.on("open", () => {
      this.reconnectAttempts = 0;
      this.lastPongAt = Date.now();
      this.startHeartbeat();
      handlers.onOpen?.();
    });
    this.client.on("message", (buffer) => {
      try {
        const incoming = JSON.parse(buffer.toString());
        const parsed = wireMessageSchema.parse(incoming);
        if (parsed.type === "PONG") {
          this.lastPongAt = Date.now();
        }
        handlers.onMessage?.(parsed);
      } catch (error) {
        handlers.onError?.(error);
      }
    });
    this.client.on("close", () => {
      this.stopHeartbeat();
      handlers.onClose?.();
      if (!this.manualClose) {
        this.scheduleReconnect();
      }
    });
    this.client.on("error", (error) => handlers.onError?.(error));
  }

  scheduleReconnect() {
    if (!this.clientUrl || !this.clientHandlers) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.clientHandlers.onReconnectFailed?.();
      return;
    }

    this.reconnectAttempts += 1;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 8000);
    setTimeout(() => {
      this.clientHandlers.onReconnectAttempt?.(this.reconnectAttempts);
      this.connectClient(this.clientUrl, this.clientHandlers);
    }, delay);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.client?.readyState === WebSocket.OPEN) {
        this.send(this.client, "PING", randomUUID(), { at: Date.now() });
      }
    }, 5000);

    this.watchdogInterval = setInterval(() => {
      if (Date.now() - this.lastPongAt > 15000) {
        this.client?.terminate();
      }
    }, 5000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
  }

  send(socket, type, correlationId, payload) {
    socket.send(
      JSON.stringify({
        version: protocolVersion,
        type,
        correlationId,
        payload
      })
    );
  }

  sendError(socket, error) {
    const payload = toErrorPayload(
      error instanceof AppError ? error : new AppError("BAD_REQUEST", "Invalid request", false, "network")
    );
    this.send(socket, "ERROR", randomUUID(), payload);
  }

  cancelTransfer(transferId) {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) return false;
    transfer.stream.destroy();
    this.activeTransfers.delete(transferId);
    return true;
  }

  async streamFile(socket, relativePath, correlationId) {
    const transferId = randomUUID();
    try {
      const stream = this.workspaceService.createFileStream(relativePath);
      const fileMeta = await this.workspaceService.getFileMeta(relativePath);
      const isBinary = this.workspaceService.isBinary(relativePath);
      const mimeType = this.workspaceService.getMimeType(relativePath);
      const hash = createHash("sha256");
      let sequence = 0;

      this.activeTransfers.set(transferId, { stream, socket, relativePath });

      this.send(socket, "FILE_START", correlationId, {
        transferId,
        relativePath,
        fileSize: fileMeta.fileSize,
        expectedChunks: fileMeta.expectedChunks,
        isBinary,
        mimeType
      });

      for await (const chunk of stream) {
        const bufferChunk = Buffer.from(chunk);
        hash.update(bufferChunk);
        this.send(socket, "FILE_CHUNK", correlationId, {
          transferId,
          relativePath,
          sequence,
          isBinary,
          mimeType,
          chunk: bufferChunk.toString("base64")
        });
        sequence += 1;
        this.send(socket, "FILE_PROGRESS", correlationId, {
          transferId,
          relativePath,
          sentChunks: sequence,
          totalChunks: fileMeta.expectedChunks
        });
      }

      this.send(socket, "FILE_END", correlationId, {
        transferId,
        relativePath,
        receivedChunks: sequence,
        expectedChunks: fileMeta.expectedChunks,
        fileSize: fileMeta.fileSize,
        checksumSha256: hash.digest("hex")
      });
      this.activeTransfers.delete(transferId);
      return transferId;
    } catch (_error) {
      this.activeTransfers.delete(transferId);
      throw new AppError("FILE_STREAM_ERROR", "Failed to stream requested file", true, "filesystem", {
        relativePath
      });
    }
  }

  broadcastSessionStop() {
    for (const socket of this.connections) {
      this.send(socket, "SESSION_STOP", `${Date.now()}`, { reason: "Host stopped session" });
      socket.close();
    }
    this.connections.clear();
  }

  closeAll() {
    for (const transferId of this.activeTransfers.keys()) {
      this.cancelTransfer(transferId);
    }
    this.broadcastSessionStop();
    this.manualClose = true;
    this.stopHeartbeat();
    this.client?.close();
    this.server?.close();
    this.client = null;
    this.server = null;
  }

  disconnectClient() {
    this.manualClose = true;
    this.stopHeartbeat();
    this.client?.close();
    this.client = null;
  }
}
