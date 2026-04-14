import { randomBytes, randomUUID } from "node:crypto";

const PENDING_JOIN_TTL_MS = 60_000;
const TOKEN_TTL_MS = 1000 * 60 * 60 * 2; // 2 hours

/**
 * @typedef {"VIEW_ONLY" | "VIEW_EDIT"} Permission
 *
 * @typedef {{
 *   requestId: string,
 *   workspaceId: string,
 *   clientId: string,
 *   displayName: string,
 *   requestedAt: number,
 *   socket: any,
 *   correlationId: string,
 *   timeoutHandle: NodeJS.Timeout | null
 * }} PendingJoinRecord
 *
 * @typedef {{
 *   workspaceId: string,
 *   clientId: string,
 *   displayName: string,
 *   sessionToken: string,
 *   tokenExpiresAt: number,
 *   socket: any,
 *   connectedAt: number,
 *   permission: Permission
 * }} ClientRecord
 */

const permissionToCapabilities = (permission) =>
  permission === "VIEW_EDIT" ? ["read", "write"] : ["read"];

export class SessionService {
  constructor() {
    /** @type {Map<string, PendingJoinRecord>} requestId -> record */
    this.pendingJoins = new Map();
    /** @type {Map<string, ClientRecord>} clientKey (workspaceId:clientId) -> record */
    this.clients = new Map();
    /** @type {Map<string, string>} token -> clientKey */
    this.tokenIndex = new Map();
  }

  /** @param {string} workspaceId @param {string} clientId */
  static clientKey(workspaceId, clientId) {
    return `${workspaceId}:${clientId}`;
  }

  /**
   * @param {{ workspaceId: string, clientId: string, displayName: string, correlationId: string }} params
   * @param {any} socket
   * @param {(requestId: string) => void} onTimeout
   * @returns {string} requestId
   */
  addPendingJoin(params, socket, onTimeout) {
    // Cancel any existing pending join from this socket (duplicate requests)
    for (const [rid, existing] of this.pendingJoins.entries()) {
      if (existing.socket === socket) {
        if (existing.timeoutHandle) clearTimeout(existing.timeoutHandle);
        this.pendingJoins.delete(rid);
      }
    }

    const requestId = randomUUID();
    const timeoutHandle = setTimeout(() => {
      if (this.pendingJoins.has(requestId)) {
        this.pendingJoins.delete(requestId);
        onTimeout(requestId);
      }
    }, PENDING_JOIN_TTL_MS);

    this.pendingJoins.set(requestId, {
      requestId,
      workspaceId: params.workspaceId,
      clientId: params.clientId,
      displayName: params.displayName,
      correlationId: params.correlationId,
      requestedAt: Date.now(),
      socket,
      timeoutHandle
    });
    return requestId;
  }

  getPendingJoin(requestId) {
    return this.pendingJoins.get(requestId) ?? null;
  }

  listPendingJoinsForWorkspace(workspaceId) {
    return Array.from(this.pendingJoins.values())
      .filter((r) => r.workspaceId === workspaceId)
      .map(({ socket: _socket, timeoutHandle: _to, ...rest }) => rest);
  }

  listAllPendingJoins() {
    return Array.from(this.pendingJoins.values()).map(({ socket: _socket, timeoutHandle: _to, ...rest }) => rest);
  }

  /**
   * @param {string} requestId
   * @param {Permission} permission
   * @returns {{ record: PendingJoinRecord, client: ClientRecord } | null}
   */
  approveJoin(requestId, permission) {
    const record = this.pendingJoins.get(requestId);
    if (!record) return null;
    if (record.timeoutHandle) clearTimeout(record.timeoutHandle);
    this.pendingJoins.delete(requestId);

    const sessionToken = randomBytes(24).toString("hex");
    const tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
    /** @type {ClientRecord} */
    const client = {
      workspaceId: record.workspaceId,
      clientId: record.clientId,
      displayName: record.displayName,
      sessionToken,
      tokenExpiresAt,
      socket: record.socket,
      connectedAt: Date.now(),
      permission
    };
    const key = SessionService.clientKey(record.workspaceId, record.clientId);
    this.clients.set(key, client);
    this.tokenIndex.set(sessionToken, key);
    return { record, client };
  }

  /** @param {string} requestId */
  rejectJoin(requestId) {
    const record = this.pendingJoins.get(requestId);
    if (!record) return null;
    if (record.timeoutHandle) clearTimeout(record.timeoutHandle);
    this.pendingJoins.delete(requestId);
    return record;
  }

  /**
   * @param {string} token
   * @param {any} socket
   * @returns {ClientRecord | null}
   */
  validateToken(token, socket) {
    const key = this.tokenIndex.get(token);
    if (!key) return null;
    const client = this.clients.get(key);
    if (!client) return null;
    if (client.tokenExpiresAt < Date.now()) {
      this.clients.delete(key);
      this.tokenIndex.delete(token);
      return null;
    }
    if (socket && client.socket !== socket) return null;
    return client;
  }

  /**
   * @param {string} workspaceId
   * @param {string} clientId
   * @param {Permission} permission
   * @returns {ClientRecord | null}
   */
  updateClientPermission(workspaceId, clientId, permission) {
    const key = SessionService.clientKey(workspaceId, clientId);
    const client = this.clients.get(key);
    if (!client) return null;
    client.permission = permission;
    return client;
  }

  /** @param {string} workspaceId @param {string} clientId */
  removeClient(workspaceId, clientId) {
    const key = SessionService.clientKey(workspaceId, clientId);
    const client = this.clients.get(key);
    if (!client) return null;
    this.clients.delete(key);
    this.tokenIndex.delete(client.sessionToken);
    return client;
  }

  /** @param {any} socket */
  removeSocket(socket) {
    /** @type {ClientRecord[]} */
    const removed = [];
    for (const [rid, request] of this.pendingJoins.entries()) {
      if (request.socket === socket) {
        if (request.timeoutHandle) clearTimeout(request.timeoutHandle);
        this.pendingJoins.delete(rid);
      }
    }
    for (const [key, client] of this.clients.entries()) {
      if (client.socket === socket) {
        this.clients.delete(key);
        this.tokenIndex.delete(client.sessionToken);
        removed.push(client);
      }
    }
    return removed;
  }

  listConnectedClientsForWorkspace(workspaceId) {
    return Array.from(this.clients.values())
      .filter((c) => c.workspaceId === workspaceId)
      .map((c) => ({
        workspaceId: c.workspaceId,
        clientId: c.clientId,
        displayName: c.displayName,
        connectedAt: c.connectedAt,
        permission: c.permission
      }));
  }

  listAllConnectedClients() {
    return Array.from(this.clients.values()).map((c) => ({
      workspaceId: c.workspaceId,
      clientId: c.clientId,
      displayName: c.displayName,
      connectedAt: c.connectedAt,
      permission: c.permission
    }));
  }

  listConnectedSessionsForWorkspace(workspaceId) {
    return Array.from(this.clients.values())
      .filter((c) => c.workspaceId === workspaceId)
      .map((c) => ({ clientId: c.clientId, socket: c.socket, workspaceId: c.workspaceId }));
  }

  revokeWorkspace(workspaceId) {
    /** @type {ClientRecord[]} */
    const removed = [];
    for (const [rid, request] of this.pendingJoins.entries()) {
      if (request.workspaceId === workspaceId) {
        if (request.timeoutHandle) clearTimeout(request.timeoutHandle);
        this.pendingJoins.delete(rid);
      }
    }
    for (const [key, client] of this.clients.entries()) {
      if (client.workspaceId === workspaceId) {
        this.clients.delete(key);
        this.tokenIndex.delete(client.sessionToken);
        removed.push(client);
      }
    }
    return removed;
  }

  revokeAll() {
    for (const request of this.pendingJoins.values()) {
      if (request.timeoutHandle) clearTimeout(request.timeoutHandle);
      try {
        request.socket?.close();
      } catch {
        /* no-op */
      }
    }
    for (const client of this.clients.values()) {
      try {
        client.socket?.close();
      } catch {
        /* no-op */
      }
    }
    this.pendingJoins.clear();
    this.clients.clear();
    this.tokenIndex.clear();
  }
}

export { permissionToCapabilities };
