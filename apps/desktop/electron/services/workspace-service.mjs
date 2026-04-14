import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AppError } from "./errors.mjs";

const textExtensions = new Set([
  ".txt",
  ".md",
  ".js",
  ".ts",
  ".tsx",
  ".json",
  ".css",
  ".html",
  ".xml",
  ".yml",
  ".yaml",
  ".env",
  ".gitignore"
]);

/**
 * @typedef {{
 *   workspaceId: string,
 *   workspaceName: string,
 *   rootPath: string,
 *   sessionCode: string,
 *   defaultPermission: "VIEW_ONLY" | "VIEW_EDIT",
 *   createdAt: number
 * }} WorkspaceRecord
 */

export class WorkspaceService {
  constructor() {
    /** @type {Map<string, WorkspaceRecord>} */
    this.workspaces = new Map();
  }

  /**
   * @param {WorkspaceRecord} record
   */
  addWorkspace(record) {
    this.workspaces.set(record.workspaceId, record);
  }

  removeWorkspace(workspaceId) {
    this.workspaces.delete(workspaceId);
  }

  hasWorkspace(workspaceId) {
    return this.workspaces.has(workspaceId);
  }

  getWorkspace(workspaceId) {
    return this.workspaces.get(workspaceId) ?? null;
  }

  listWorkspaces() {
    return Array.from(this.workspaces.values());
  }

  isWorkspaceNameTaken(workspaceName) {
    const normalized = workspaceName.trim().toLowerCase();
    for (const ws of this.workspaces.values()) {
      if (ws.workspaceName.trim().toLowerCase() === normalized) return true;
    }
    return false;
  }

  isSessionCodeInUse(sessionCode) {
    for (const ws of this.workspaces.values()) {
      if (ws.sessionCode === sessionCode) return true;
    }
    return false;
  }

  /**
   * @param {string} workspaceId
   * @param {string} relativePath
   */
  ensureInWorkspace(workspaceId, relativePath) {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) {
      throw new AppError("WORKSPACE_NOT_FOUND", "Workspace is not active", false, "filesystem");
    }
    const target = path.resolve(ws.rootPath, relativePath);
    const root = path.resolve(ws.rootPath);
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new AppError("PATH_TRAVERSAL", "Invalid path requested", false, "filesystem");
    }
    return target;
  }

  normalizeRelativePath(relativePath) {
    return relativePath.split(path.sep).join("/");
  }

  getMimeType(relativePath) {
    const ext = path.extname(relativePath).toLowerCase();
    if (ext === ".pdf") return "application/pdf";
    if (ext === ".png") return "image/png";
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".gif") return "image/gif";
    if (ext === ".webp") return "image/webp";
    if (ext === ".mp4") return "video/mp4";
    if (ext === ".webm") return "video/webm";
    if (ext === ".mp3") return "audio/mpeg";
    if (ext === ".wav") return "audio/wav";
    if (ext === ".ogg") return "audio/ogg";
    if (ext === ".docx")
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (ext === ".doc") return "application/msword";
    if (ext === ".xlsx")
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (ext === ".xls") return "application/vnd.ms-excel";
    if (ext === ".pptx")
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    if (ext === ".ppt") return "application/vnd.ms-powerpoint";
    if (textExtensions.has(ext)) return "text/plain";
    return "application/octet-stream";
  }

  isBinary(relativePath) {
    return this.getMimeType(relativePath) !== "text/plain";
  }

  async listFiles(workspaceId) {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) return [];

    const walk = async (dir, base = "") => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      /** @type {Array<Record<string, unknown>>} */
      const result = [];
      for (const entry of entries) {
        const relativePath = this.normalizeRelativePath(path.join(base, entry.name));
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          result.push({
            id: relativePath,
            name: entry.name,
            path: relativePath,
            isDirectory: true,
            mimeType: "inode/directory"
          });
          result.push(...(await walk(fullPath, relativePath)));
        } else {
          const stat = await fs.stat(fullPath);
          result.push({
            id: relativePath,
            name: entry.name,
            path: relativePath,
            isDirectory: false,
            size: stat.size,
            mimeType: this.getMimeType(relativePath)
          });
        }
      }
      return result;
    };

    return walk(ws.rootPath);
  }

  createFileStream(workspaceId, relativePath) {
    const fullPath = this.ensureInWorkspace(workspaceId, relativePath);
    return createReadStream(fullPath, { highWaterMark: 64 * 1024 });
  }

  async getFileMeta(workspaceId, relativePath) {
    const fullPath = this.ensureInWorkspace(workspaceId, relativePath);
    const stat = await fs.stat(fullPath);
    return {
      relativePath,
      fileSize: stat.size,
      expectedChunks: Math.ceil(stat.size / (64 * 1024))
    };
  }

  async writeTextFile(workspaceId, relativePath, content) {
    const fullPath = this.ensureInWorkspace(workspaceId, relativePath);
    if (this.isBinary(relativePath)) {
      throw new AppError("UNSUPPORTED_EDIT_TYPE", "Editing is allowed only for text/code files", false, "filesystem", {
        relativePath
      });
    }
    await fs.writeFile(fullPath, content, "utf8");
    return { ok: true };
  }

  async readTextFile(workspaceId, relativePath) {
    const fullPath = this.ensureInWorkspace(workspaceId, relativePath);
    if (this.isBinary(relativePath)) {
      throw new AppError("UNSUPPORTED_EDIT_TYPE", "Reading as text is allowed only for text/code files", false, "filesystem", {
        relativePath
      });
    }
    return fs.readFile(fullPath, "utf8");
  }
}
