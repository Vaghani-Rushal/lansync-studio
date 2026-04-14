import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WorkspaceService } from "../workspace-service.mjs";

describe("WorkspaceService", () => {
  it("normalizes nested paths using forward slashes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "pcconnector-"));
    await mkdir(path.join(root, "nested"));
    await writeFile(path.join(root, "nested", "file.txt"), "hello");

    const service = new WorkspaceService();
    service.setWorkspace(root, "ws-1", "Workspace");

    const files = await service.listFiles();
    const nested = files.find((entry) => entry.path === "nested/file.txt");
    expect(nested).toBeTruthy();
  });

  it("blocks path traversal outside workspace", () => {
    const service = new WorkspaceService();
    service.setWorkspace("C:/safe-root", "ws-2", "Workspace");
    expect(() => service.ensureInWorkspace("../outside.txt")).toThrowError(/Invalid path requested/);
  });
});
