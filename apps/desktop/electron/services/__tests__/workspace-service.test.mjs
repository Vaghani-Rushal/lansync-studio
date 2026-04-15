import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WorkspaceService } from "../workspace-service.mjs";

const WS_ID = "ws-test";

const makeService = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pcconnector-"));
  const service = new WorkspaceService();
  service.addWorkspace({
    workspaceId: WS_ID,
    workspaceName: "Workspace",
    rootPath: root,
    sessionCode: "ABC123",
    defaultPermission: "VIEW_EDIT",
    createdAt: Date.now()
  });
  return { root, service };
};

describe("WorkspaceService", () => {
  it("normalizes nested paths using forward slashes", async () => {
    const { root, service } = await makeService();
    await mkdir(path.join(root, "nested"));
    await writeFile(path.join(root, "nested", "file.txt"), "hello");

    const files = await service.listFiles(WS_ID);
    const nested = files.find((entry) => entry.path === "nested/file.txt");
    expect(nested).toBeTruthy();
  });

  it("blocks path traversal outside workspace", async () => {
    const { service } = await makeService();
    expect(() => service.ensureInWorkspace(WS_ID, "../outside.txt")).toThrowError(/Invalid path requested/);
  });

  describe("writeBinaryFile", () => {
    it("writes a .docx buffer to disk", async () => {
      const { root, service } = await makeService();
      await writeFile(path.join(root, "report.docx"), Buffer.from([0x00]));

      const zipMagic = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
      await service.writeBinaryFile(WS_ID, "report.docx", zipMagic);

      const written = await readFile(path.join(root, "report.docx"));
      expect(written.slice(0, 4).toString("hex")).toBe("504b0304");
    });

    it("rejects unsupported extensions", async () => {
      const { root, service } = await makeService();
      await writeFile(path.join(root, "note.txt"), "hi");
      await expect(service.writeBinaryFile(WS_ID, "note.txt", Buffer.from("x"))).rejects.toThrow(
        /Binary write not allowed/
      );
    });

    it("rejects path traversal", async () => {
      const { service } = await makeService();
      await expect(
        service.writeBinaryFile(WS_ID, "../escape.docx", Buffer.from([0]))
      ).rejects.toThrow(/Invalid path requested/);
    });

    it("rejects non-Buffer input", async () => {
      const { root, service } = await makeService();
      await writeFile(path.join(root, "x.docx"), Buffer.from([0]));
      await expect(
        service.writeBinaryFile(WS_ID, "x.docx", "not a buffer")
      ).rejects.toThrow(/expected a Buffer/);
    });
  });
});
