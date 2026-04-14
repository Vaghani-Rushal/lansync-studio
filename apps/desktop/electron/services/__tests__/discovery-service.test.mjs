import { describe, expect, it } from "vitest";
import { pruneStaleWorkspaces } from "../discovery-service.mjs";

describe("pruneStaleWorkspaces", () => {
  it("removes entries older than ttl", () => {
    const now = 10_000;
    const workspaces = new Map([
      ["a", { workspaceId: "a", lastSeenAt: now - 5_000 }],
      ["b", { workspaceId: "b", lastSeenAt: now - 25_000 }]
    ]);

    const pruned = pruneStaleWorkspaces(workspaces, now, 20_000);
    expect(pruned.has("a")).toBe(true);
    expect(pruned.has("b")).toBe(false);
  });
});
