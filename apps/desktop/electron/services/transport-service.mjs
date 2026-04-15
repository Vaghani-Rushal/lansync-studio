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
    this.transferAckTimeoutMs = 10_000;
    this.pendingClipboardAcks = new Map();
    this.clipboardRetryDefaults = {
      maxRetries: 2,
      initialDelayMs: 400,
      maxDelayMs: 2000,
      ttlMs: 12_000
    };
  }

  startServer(port, handlers) {
    if (this.server) {
      // Already running — just update the message handlers so multiple
      // workspaces can share the same server.
      this.handlers = handlers;
      return this.server;
    }
    this.handlers = handlers;
    this.server = new WebSocketServer({ port });
    this.server.on("connection", (socket) => {
      this.connections.add(socket);
      socket.on("message", async (buffer) => {
        try {
          const incoming = JSON.parse(buffer.toString());
          const parsed = wireMessageSchema.parse(incoming);
          await this.handlers?.onMessage?.(socket, parsed);
        } catch (error) {
          logger.error({ error }, "Invalid message");
          this.sendError(socket, error);
        }
      });
      socket.on("close", () => {
        this.connections.delete(socket);
        const removed = this.sessionService.removeSocket(socket);
        this.handlers?.onConnectionClosed?.(socket, removed);
      });
    });
    return this.server;
  }

  stopServer() {
    this.clearClipboardRetries();
    try {
      this.server?.close();
    } catch {
      /* no-op */
    }
    this.server = null;
    this.handlers = null;
    for (const socket of this.connections) {
      try {
        socket.close();
      } catch {
        /* no-op */
      }
    }
    this.connections.clear();
  }

  broadcastToWorkspace(workspaceId, type, correlationId, payload) {
    const sessions = this.sessionService.listConnectedSessionsForWorkspace(workspaceId);
    for (const session of sessions) {
      try {
        this.send(session.socket, type, correlationId, payload);
      } catch {
        /* no-op */
      }
    }
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

  cancelTransfer(transferId, requesterClientId) {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) return false;
    if (requesterClientId && transfer.ownerClientId !== requesterClientId) {
      return false;
    }
    if (transfer.ackTimeout) {
      clearTimeout(transfer.ackTimeout);
    }
    transfer.stream.destroy();
    this.activeTransfers.delete(transferId);
    return true;
  }

  finalizeTransfer(transferId, requesterClientId, accepted, reason) {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) return false;
    if (requesterClientId && transfer.ownerClientId !== requesterClientId) return false;
    if (transfer.ackTimeout) {
      clearTimeout(transfer.ackTimeout);
    }
    this.activeTransfers.delete(transferId);
    if (!accepted) {
      this.send(transfer.socket, "ERROR", randomUUID(), {
        code: "TRANSFER_INTEGRITY_FAILED",
        message: reason || "Client rejected transferred file",
        retryable: true,
        source: "network"
      });
    }
    return true;
  }

  async streamFile(socket, workspaceId, relativePath, correlationId, ownerClientId) {
    const transferId = randomUUID();
    try {
      const stream = this.workspaceService.createFileStream(workspaceId, relativePath);
      const fileMeta = await this.workspaceService.getFileMeta(workspaceId, relativePath);
      const isBinary = this.workspaceService.isBinary(relativePath);
      const mimeType = this.workspaceService.getMimeType(relativePath);
      const hash = createHash("sha256");
      let sequence = 0;

      this.activeTransfers.set(transferId, { stream, socket, relativePath, ownerClientId });

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
      const ackTimeout = setTimeout(() => {
        this.activeTransfers.delete(transferId);
        this.send(socket, "ERROR", randomUUID(), {
          code: "TRANSFER_ACK_TIMEOUT",
          message: "Client did not acknowledge transfer integrity in time",
          retryable: true,
          source: "network"
        });
      }, this.transferAckTimeoutMs);
      const existing = this.activeTransfers.get(transferId);
      if (existing) {
        this.activeTransfers.set(transferId, { ...existing, ackTimeout });
      }
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
    this.clearClipboardRetries();
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
    this.clearClipboardRetries();
    this.manualClose = true;
    this.stopHeartbeat();
    this.client?.close();
    this.client = null;
  }

  sendClipboardWithRetry(messageId, sendAttempt, options = {}) {
    if (typeof messageId !== "string" || messageId.length === 0) return;
    if (typeof sendAttempt !== "function") return;
    const ackKey = options.ackKey || messageId;
    this.ackClipboard(ackKey);

    const merged = {
      ...this.clipboardRetryDefaults,
      ...options
    };

    const entry = {
      messageId,
      ackKey,
      attempts: 0,
      startedAt: Date.now(),
      maxRetries: merged.maxRetries,
      initialDelayMs: merged.initialDelayMs,
      maxDelayMs: merged.maxDelayMs,
      ttlMs: merged.ttlMs,
      timer: null
    };

    const scheduleNext = () => {
      if (!this.pendingClipboardAcks.has(ackKey)) return;
      const delay = Math.min(
        entry.initialDelayMs * 2 ** Math.max(0, entry.attempts - 1),
        entry.maxDelayMs
      );
      entry.timer = setTimeout(runAttempt, delay);
    };

    const runAttempt = () => {
      if (!this.pendingClipboardAcks.has(ackKey)) return;

      const ageMs = Date.now() - entry.startedAt;
      if (ageMs > entry.ttlMs) {
        logger.warn(`[TransportService] clipboard retry expired for message ${messageId} (ackKey=${ackKey})`);
        this.ackClipboard(ackKey);
        return;
      }

      try {
        sendAttempt(entry.attempts);
      } catch (error) {
        logger.warn(
          `[TransportService] clipboard send attempt failed for message ${messageId} (ackKey=${ackKey}): ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      if (entry.attempts >= entry.maxRetries) {
        logger.warn(
          `[TransportService] clipboard message ${messageId} exhausted retries after ${entry.attempts + 1} attempts`
        );
        this.ackClipboard(ackKey);
        return;
      }

      entry.attempts += 1;
      scheduleNext();
    };

    this.pendingClipboardAcks.set(ackKey, entry);
    runAttempt();
  }

  ackClipboard(ackKey) {
    const entry = this.pendingClipboardAcks.get(ackKey);
    if (!entry) return false;
    if (entry.timer) {
      clearTimeout(entry.timer);
    }
    this.pendingClipboardAcks.delete(ackKey);
    return true;
  }

  clearClipboardRetries() {
    for (const entry of this.pendingClipboardAcks.values()) {
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
    }
    this.pendingClipboardAcks.clear();
  }
}
