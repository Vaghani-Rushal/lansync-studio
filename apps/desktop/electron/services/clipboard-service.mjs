import { clipboard, nativeImage } from "electron";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { logger } from "./logger.mjs";

/**
 * Build a CF_HDROP buffer for a single file path.
 * Layout: DROPFILES header (20 bytes) + null-terminated UTF-16 path + extra null.
 * fWide=1 tells the shell the path is Unicode.
 */
function buildCfHDropBuffer(filePath) {
  const header = Buffer.alloc(20);
  header.writeUInt32LE(20, 0);  // pFiles — offset to file list
  header.writeUInt32LE(0,  4);  // pt.x
  header.writeUInt32LE(0,  8);  // pt.y
  header.writeUInt32LE(0, 12);  // fNC
  header.writeUInt32LE(1, 16);  // fWide = 1 (Unicode paths)
  // File list: path + \0 + extra \0 terminator (wide chars)
  const pathBuf = Buffer.from(filePath + "\0\0", "ucs2");
  return Buffer.concat([header, pathBuf]);
}

/** Image file extensions we can load from disk when copied via File Explorer */
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".tif", ".ico"];

function isImagePath(filePath) {
  return IMAGE_EXTENSIONS.some((ext) => filePath.toLowerCase().endsWith(ext));
}

function extractMacFileUrls(raw) {
  if (!raw) return [];
  const cleaned = raw.replace(/\u0000/g, "\n");
  const chunks = cleaned
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  const urls = chunks.filter((part) => part.startsWith("file://"));
  const paths = [];
  for (const url of urls) {
    try {
      paths.push(fileURLToPath(url));
    } catch {
      // Ignore malformed URLs from unexpected clipboard payloads.
    }
  }
  return paths;
}

/**
 * ClipboardService – Manual-trigger mode.
 *
 * Ctrl+C  → user's normal OS copy (NOTHING happens in LAN Sync)
 * Ctrl+Shift+D → calls captureNow() → reads OS clipboard → broadcasts to network
 * Ctrl+Shift+F → calls pasteTop()   → writes top history item to OS clipboard
 */
export class ClipboardService extends EventEmitter {
  constructor() {
    super();
    /** @type {Array<{historyId:string,text:string,image:string,timestamp:number,sourceUserId?:string,sourceDisplayName?:string}>} */
    this.history = [];
    // Track the last item we wrote TO the OS clipboard ourselves
    // so that if the user later presses Ctrl+Shift+D we don't re-broadcast it.
    this._lastWrittenId = null;
    this._pollTimer = null;
    this._lastClipboardSignature = "";
    this._pollIntervalMs = 700;
  }

  // ---------------------------------------------------------------------------
  // Public API called by globalShortcut handlers in main.mjs
  // ---------------------------------------------------------------------------

  /**
   * Called when user presses Ctrl+Shift+D.
   * Reads what is currently on the OS clipboard and emits "manual-clipboard-capture".
   * Returns the item, or null if the clipboard is empty.
   */
  captureNow(options = {}) {
    const mode = options.mode === "text" || options.mode === "image" ? options.mode : "auto";
    const text = clipboard.readText() || "";

    // Step 1: Try reading a bitmap image (works for screenshots, paste from apps)
    // Note: on macOS Finder copies, readImage() may return a file icon thumbnail.
    let img = clipboard.readImage();

    // Step 2: Prefer real image file content when clipboard contains image file paths.
    // This avoids showing generic PNG/JPG file icons in preview cards on macOS.
    try {
      const filePaths = clipboard.readFilePaths?.() ?? [];
      let imageFilePath = filePaths.find((fp) => isImagePath(fp));

      // macOS Finder often publishes file references as "public.file-url"
      // rather than through readFilePaths(). Parse that format as fallback.
      if (!imageFilePath && process.platform === "darwin") {
        const formats = clipboard.availableFormats?.() ?? [];
        const fileUrlFormat = formats.find((fmt) => fmt.toLowerCase() === "public.file-url");
        if (fileUrlFormat) {
          const buf = clipboard.readBuffer(fileUrlFormat);
          const macPaths = extractMacFileUrls(buf.toString("utf8"));
          imageFilePath = macPaths.find((fp) => isImagePath(fp));
        }
      }

      // Some apps expose the copied file path only as plain text.
      if (!imageFilePath && text && (text.startsWith("/") || text.startsWith("file://"))) {
        const textPath = text.startsWith("file://") ? fileURLToPath(text) : text;
        if (isImagePath(textPath)) {
          imageFilePath = textPath;
        }
      }

      if (imageFilePath && fs.existsSync(imageFilePath)) {
        const diskImg = nativeImage.createFromPath(imageFilePath);
        if (!diskImg.isEmpty()) {
          img = diskImg;
          logger.info(`[ClipboardService] captureNow: using real image from file path: ${imageFilePath}`);
        }
      }
    } catch (err) {
      logger.warn("[ClipboardService] captureNow: failed to read file paths from clipboard:", err.message);
    }

    const image = img.isEmpty() ? "" : img.toDataURL();
    const selectedText = mode === "image" ? "" : text;
    const selectedImage = mode === "text" ? "" : image;

    if (!selectedText && !selectedImage) {
      logger.info("[ClipboardService] captureNow: clipboard is empty – nothing to send.");
      return null;
    }

    // Step 3: Guard against re-capturing the same content.
    //   This happens on macOS when the osascript Cmd+C didn't update the clipboard
    //   (e.g. selection was lost before the shortcut fired).
    //   Comparing against the MOST RECENT history entry only — not the full list —
    //   so intentional copies of older items still work.
    const latest = this.history[0];
    if (latest && latest.text === selectedText && latest.image === selectedImage) {
      logger.info("[ClipboardService] captureNow: clipboard unchanged from last capture – nothing new to share.");
      return null;
    }

    const item = {
      historyId: randomUUID(),
      text: selectedText,
      image: selectedImage,
      timestamp: Date.now(),
      sourceUserId: options.sourceUserId,
      sourceDisplayName: options.sourceDisplayName
    };

    this._addToHistory(item);
    this._lastWrittenId = null; // this is a genuine user capture
    this.emit("manual-clipboard-capture", item);
    logger.info(`[ClipboardService] captureNow: captured item ${item.historyId} | mode: ${mode} | hasImage: ${!!selectedImage} | hasText: ${!!selectedText}`);
    return item;
  }

  /**
   * Called when user presses Ctrl+Shift+F.
   * Writes the most recent history item to the OS clipboard so they can Ctrl+V it.
   */
  pasteTop() {
    if (this.history.length === 0) {
      logger.info("[ClipboardService] pasteTop: history is empty.");
      return null;
    }
    const item = this.history[0];
    this._writeToOS(item);
    this._lastWrittenId = item.historyId;
    logger.info(`[ClipboardService] pasteTop: wrote item ${item.historyId} to OS clipboard`);
    return item;
  }

  // ---------------------------------------------------------------------------
  // Called by the network message handler when a remote item arrives
  // ---------------------------------------------------------------------------

  /**
   * Receives a clipboard payload from another machine and adds it to local history.
   * Automatically writes the payload to the OS clipboard so Ctrl+V works immediately.
   */
  writeFromRemote(payload) {
    // Avoid duplicates
    if (this.history.some((h) => h.historyId === payload.historyId)) return;

    const item = {
      historyId: payload.historyId,
      text: payload.text || "",
      image: payload.image || "",
      timestamp: payload.timestamp,
      sourceUserId: payload.sourceUserId,
      sourceDisplayName: payload.sourceDisplayName
    };

    this._addToHistory(item);
    this._writeToOS(item);
    this._lastWrittenId = item.historyId;
    logger.info(`[ClipboardService] writeFromRemote: received item ${item.historyId}`);
  }

  // ---------------------------------------------------------------------------
  // Called from IPC "clipboard:write" (user clicks a history card in the UI)
  // ---------------------------------------------------------------------------

  setActiveHistoryItem(historyId) {
    const item = this.history.find((h) => h.historyId === historyId);
    if (!item) return;
    this._writeToOS(item);
    this._lastWrittenId = item.historyId;
    // Broadcast so other machines also get it
    const newItem = { ...item, historyId: randomUUID(), timestamp: Date.now() };
    this._addToHistory(newItem);
    this.emit("manual-clipboard-capture", newItem);
    logger.info(`[ClipboardService] setActiveHistoryItem: re-broadcast ${newItem.historyId}`);
  }

  getHistory() {
    return this.history;
  }

  startPolling() {
    if (this._pollTimer) return;
    this._lastClipboardSignature = this._readClipboardSignature();
    this._pollTimer = setInterval(() => {
      try {
        const signature = this._readClipboardSignature();
        if (signature === this._lastClipboardSignature) return;
        this._lastClipboardSignature = signature;
        const item = this.captureNow({ mode: "auto" });
        if (item) {
          logger.info(`[ClipboardService] startPolling: auto-captured clipboard item ${item.historyId}`);
        }
      } catch (err) {
        logger.warn("[ClipboardService] startPolling: polling tick failed:", err.message);
      }
    }, this._pollIntervalMs);
    logger.info(`[ClipboardService] startPolling: started (${this._pollIntervalMs}ms interval)`);
  }

  stopPolling() {
    if (!this._pollTimer) return;
    clearInterval(this._pollTimer);
    this._pollTimer = null;
    logger.info("[ClipboardService] stopPolling: stopped");
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  _addToHistory(item) {
    // Remove exact duplicate (same text+image content)
    const existingIdx = this.history.findIndex(
      (h) => h.text === item.text && h.image === item.image
    );
    if (existingIdx !== -1) this.history.splice(existingIdx, 1);

    this.history.unshift(item);
    if (this.history.length > 50) this.history.pop();
  }

  _writeToOS(item) {
    try {
      if (item.image) {
        const img = nativeImage.createFromDataURL(item.image);
        if (img.isEmpty()) {
          logger.warn("[ClipboardService] _writeToOS: nativeImage is empty after DataURL decode – skipping");
          if (item.text) clipboard.writeText(item.text);
          return;
        }
        logger.info(`[ClipboardService] _writeToOS: writing image ${img.getSize().width}x${img.getSize().height}`);
        if (item.text) {
          clipboard.write({ text: item.text, image: img });
        } else {
          clipboard.writeImage(img);
        }
      } else if (item.text) {
        clipboard.writeText(item.text);
      }
    } catch (err) {
      logger.error("[ClipboardService] _writeToOS error:", err);
    }
  }

  _readClipboardSignature() {
    const text = clipboard.readText() || "";
    const imageDataUrl = clipboard.readImage().toDataURL();
    const filePaths = clipboard.readFilePaths?.() ?? [];
    return JSON.stringify({
      text,
      imageDataUrl,
      filePaths
    });
  }
}
