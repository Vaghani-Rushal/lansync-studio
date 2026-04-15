import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AppError } from "./errors.mjs";

const BINARY_WRITE_EXTENSIONS = new Set([".docx"]);

const textExtensions = new Set([
  // Plain / docs
  ".txt", ".md", ".markdown", ".rst", ".adoc", ".log", ".csv", ".tsv",
  // Web
  ".html", ".htm", ".css", ".scss", ".sass", ".less", ".xml", ".svg",
  ".vue", ".svelte", ".astro",
  // JS / TS
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".json5", ".jsonc",
  // Config
  ".yml", ".yaml", ".toml", ".ini", ".conf", ".cfg", ".properties",
  ".env", ".editorconfig", ".gitignore", ".gitattributes", ".dockerignore",
  ".npmrc", ".nvmrc", ".prettierrc", ".eslintrc", ".babelrc",
  // Shell / scripts
  ".sh", ".bash", ".zsh", ".fish", ".ps1", ".bat", ".cmd",
  // Languages
  ".py", ".rb", ".php", ".pl", ".lua", ".r", ".java", ".kt", ".kts",
  ".scala", ".groovy", ".go", ".rs", ".c", ".h", ".cc", ".cpp", ".hpp",
  ".cs", ".fs", ".m", ".mm", ".swift", ".dart", ".ex", ".exs", ".erl",
  ".clj", ".cljs", ".hs", ".ml", ".nim", ".zig", ".jl", ".v",
  // Data / query
  ".sql", ".graphql", ".gql", ".proto", ".prisma",
  // Build / infra
  ".dockerfile", ".makefile", ".mk", ".cmake", ".gradle", ".sbt",
  ".tf", ".tfvars", ".hcl",
  // Misc
  ".patch", ".diff", ".srt", ".vtt"
]);

const textFilenames = new Set([
  "dockerfile",
  "makefile",
  "rakefile",
  "gemfile",
  "procfile",
  "license",
  "readme",
  "changelog",
  "authors",
  "contributors"
]);

/**
 * @typedef {{
 *   workspaceId: string,
 *   workspaceName: string,
 *   rootPath: string,
 *   sessionCode: string,
 *   defaultPermission: "VIEW_ONLY" | "VIEW_EDIT",
 *   createdAt: number,
 *   singleFileName?: string | null
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
    if (ws.singleFileName) {
      const normalized = this.normalizeRelativePath(relativePath);
      if (normalized !== ws.singleFileName) {
        throw new AppError("PATH_TRAVERSAL", "Invalid path requested", false, "filesystem");
      }
      return path.join(ws.rootPath, ws.singleFileName);
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
    const base = path.basename(relativePath).toLowerCase();
    const ext = path.extname(base);
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
    const nameNoExt = ext ? base.slice(0, -ext.length) : base;
    if (textFilenames.has(base) || textFilenames.has(nameNoExt)) return "text/plain";
    return "application/octet-stream";
  }

  isBinary(relativePath) {
    const mime = this.getMimeType(relativePath);
    if (mime === "text/plain") return false;
    if (mime === "application/octet-stream") return false;
    return true;
  }

  async listFiles(workspaceId) {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) return [];

    if (ws.singleFileName) {
      const fullPath = path.join(ws.rootPath, ws.singleFileName);
      try {
        const stat = await fs.stat(fullPath);
        return [
          {
            id: ws.singleFileName,
            name: ws.singleFileName,
            path: ws.singleFileName,
            isDirectory: false,
            size: stat.size,
            mimeType: this.getMimeType(ws.singleFileName)
          }
        ];
      } catch {
        return [];
      }
    }

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

  async writeBinaryFile(workspaceId, relativePath, buffer) {
    const fullPath = this.ensureInWorkspace(workspaceId, relativePath);
    const ext = path.extname(relativePath).toLowerCase();
    if (!BINARY_WRITE_EXTENSIONS.has(ext)) {
      throw new AppError(
        "UNSUPPORTED_EDIT_TYPE",
        `Binary write not allowed for ${ext || "this file type"}`,
        false,
        "filesystem",
        { relativePath }
      );
    }
    if (!Buffer.isBuffer(buffer)) {
      throw new AppError(
        "INVALID_PAYLOAD",
        "writeBinaryFile expected a Buffer",
        false,
        "filesystem",
        { relativePath }
      );
    }
    await fs.writeFile(fullPath, buffer);
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
