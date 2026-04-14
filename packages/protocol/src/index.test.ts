import { describe, expect, it } from "vitest";
import { protocolVersion, wireMessageSchema } from "./index";

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
