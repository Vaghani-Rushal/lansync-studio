import { mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { CrdtService } from "../crdt-service.mjs";
import { WorkspaceService } from "../workspace-service.mjs";

describe("CrdtService", () => {
  it("initializes from file and applies update", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "pcconnector-crdt-"));
    await writeFile(path.join(root, "notes.txt"), "hello", "utf8");
    const workspace = new WorkspaceService();
    workspace.setWorkspace(root, "ws-1", "Workspace");
    const service = new CrdtService(workspace);

    const initial = await service.getStateUpdate("notes.txt");
    expect(typeof initial).toBe("string");
    expect(initial.length).toBeGreaterThan(0);

    const update = await service.applyUpdate("notes.txt", initial);
    expect(typeof update).toBe("string");
    expect(update.length).toBeGreaterThan(0);

    service.clearAll();
  });
});
