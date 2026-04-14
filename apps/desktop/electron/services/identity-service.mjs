import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "./logger.mjs";

/**
 * Minimal persistent identity store. This is intentionally the ONLY thing
 * persisted to disk — everything else (workspaces, tokens, clients) is RAM only.
 */
export class IdentityService {
  /** @param {string} userDataDir */
  constructor(userDataDir) {
    this.filePath = path.join(userDataDir, "identity.json");
    /** @type {import("@pcconnector/shared-types").UserIdentity | null} */
    this.identity = null;
    this.loaded = false;
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.userId === "string" &&
        typeof parsed.displayName === "string" &&
        parsed.displayName.trim().length >= 2
      ) {
        this.identity = {
          userId: parsed.userId,
          displayName: parsed.displayName,
          createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : Date.now(),
          updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now()
        };
      }
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ENOENT") {
        logger.warn({ error }, "Failed to read identity file; starting fresh");
      }
      this.identity = null;
    }
    this.loaded = true;
    return this.identity;
  }

  get() {
    return this.identity;
  }

  /**
   * @param {string} rawName
   * @returns {Promise<import("@pcconnector/shared-types").UserIdentity>}
   */
  async set(rawName) {
    const displayName = this.#sanitize(rawName);
    const now = Date.now();
    const next = this.identity
      ? { ...this.identity, displayName, updatedAt: now }
      : { userId: randomUUID(), displayName, createdAt: now, updatedAt: now };
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(next, null, 2), "utf8");
    this.identity = next;
    return next;
  }

  /** @param {string} rawName */
  #sanitize(rawName) {
    if (typeof rawName !== "string") {
      throw new Error("Display name must be a string");
    }
    const trimmed = rawName.trim();
    if (trimmed.length < 2) throw new Error("Display name must be at least 2 characters");
    if (trimmed.length > 32) throw new Error("Display name must be at most 32 characters");
    if (/[\x00-\x1F\x7F]/.test(trimmed)) throw new Error("Display name contains invalid characters");
    return trimmed;
  }
}
