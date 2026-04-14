import { describe, expect, it } from "vitest";
import { SessionService } from "../session-service.mjs";

describe("SessionService", () => {
  it("approves join and validates token for same socket", () => {
    const service = new SessionService();
    const socket = { id: "socket-1" };
    const requestId = service.addPendingJoin({ deviceName: "Device", clientId: "client-1" }, socket);
    const approved = service.approveJoin(requestId);

    expect(approved).not.toBeNull();
    const validClient = service.validateToken(approved.sessionToken, socket);
    expect(validClient?.clientId).toBe("client-1");
  });

  it("rejects token usage on a different socket", () => {
    const service = new SessionService();
    const socketA = { id: "socket-a" };
    const socketB = { id: "socket-b" };
    const requestId = service.addPendingJoin({ deviceName: "Device", clientId: "client-2" }, socketA);
    const approved = service.approveJoin(requestId);

    const validClient = service.validateToken(approved.sessionToken, socketB);
    expect(validClient).toBeNull();
  });

  it("keeps strict state transitions", () => {
    const service = new SessionService();
    expect(service.getState()).toBe("idle");
    expect(service.setState("connected")).toBe(false);
    expect(service.getState()).toBe("idle");
    expect(service.setState("advertising")).toBe(true);
    expect(service.getState()).toBe("advertising");
  });
});
