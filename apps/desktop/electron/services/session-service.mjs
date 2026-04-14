import { randomBytes, randomUUID } from "node:crypto";

export class SessionService {
  constructor() {
    this.state = "idle";
    this.pendingJoins = new Map();
    this.clients = new Map();
    this.tokenIndex = new Map();
  }

  setState(next) {
    const allowedTransitions = {
      idle: new Set(["advertising", "stopped"]),
      advertising: new Set(["pending_join", "connected", "stopped"]),
      pending_join: new Set(["connected", "advertising", "stopped"]),
      connected: new Set(["advertising", "stopped"]),
      stopped: new Set(["idle", "advertising"])
    };
    if (next === this.state) return;
    if (allowedTransitions[this.state]?.has(next)) {
      this.state = next;
      return;
    }
    this.state = next;
  }

  getState() {
    return this.state;
  }

  addPendingJoin(joinRequest, socket) {
    for (const [requestId, request] of this.pendingJoins.entries()) {
      if (request.socket === socket || request.clientId === joinRequest.clientId) {
        return requestId;
      }
    }

    const requestId = randomUUID();
    this.pendingJoins.set(requestId, {
      requestId,
      ...joinRequest,
      requestedAt: Date.now(),
      socket
    });
    this.setState("pending_join");
    return requestId;
  }

  listPendingJoins() {
    return Array.from(this.pendingJoins.values()).map(({ socket, ...request }) => request);
  }

  approveJoin(requestId) {
    const request = this.pendingJoins.get(requestId);
    if (!request) {
      return null;
    }
    this.pendingJoins.delete(requestId);
    const sessionToken = randomBytes(24).toString("hex");
    const tokenExpiresAt = Date.now() + 1000 * 60 * 30;
    const client = {
      clientId: request.clientId,
      deviceName: request.deviceName,
      sessionToken,
      tokenExpiresAt,
      socket: request.socket,
      connectedAt: Date.now()
    };
    this.clients.set(request.clientId, client);
    this.tokenIndex.set(sessionToken, request.clientId);
    this.setState("connected");
    return { request, sessionToken, tokenExpiresAt };
  }

  rejectJoin(requestId) {
    const request = this.pendingJoins.get(requestId);
    this.pendingJoins.delete(requestId);
    if (this.pendingJoins.size === 0 && this.clients.size === 0) {
      this.setState("advertising");
    }
    return request ?? null;
  }

  validateToken(token, socket) {
    const clientId = this.tokenIndex.get(token);
    if (!clientId) return null;
    const client = this.clients.get(clientId);
    if (!client) return null;
    if (client.tokenExpiresAt < Date.now()) {
      this.clients.delete(clientId);
      this.tokenIndex.delete(token);
      return null;
    }
    if (socket && client.socket !== socket) return null;
    return client;
  }

  removeSocket(socket) {
    for (const [requestId, request] of this.pendingJoins.entries()) {
      if (request.socket === socket) {
        this.pendingJoins.delete(requestId);
      }
    }

    for (const [clientId, client] of this.clients.entries()) {
      if (client.socket === socket) {
        this.clients.delete(clientId);
        this.tokenIndex.delete(client.sessionToken);
      }
    }
    if (this.clients.size === 0 && this.pendingJoins.size === 0 && this.state !== "stopped") {
      this.setState("advertising");
    }
  }

  listConnectedClients() {
    return Array.from(this.clients.values()).map((client) => ({
      clientId: client.clientId,
      deviceName: client.deviceName,
      connectedAt: client.connectedAt,
      capabilities: ["read"]
    }));
  }

  revokeAll() {
    for (const client of this.clients.values()) {
      try {
        client.socket?.close();
      } catch (_error) {
        // no-op
      }
    }
    this.pendingJoins.clear();
    this.clients.clear();
    this.tokenIndex.clear();
    this.state = "stopped";
  }
}
