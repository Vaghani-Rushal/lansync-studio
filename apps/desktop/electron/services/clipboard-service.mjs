import { clipboard, nativeImage } from "electron";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
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
    /** @type {Array<{historyId:string,text:string,image:string,timestamp:number}>} */
    this.history = [];
    // Track the last item we wrote TO the OS clipboard ourselves
    // so that if the user later presses Ctrl+Shift+D we don't re-broadcast it.
    this._lastWrittenId = null;
  }

  // ---------------------------------------------------------------------------
  // Public API called by globalShortcut handlers in main.mjs
  // ---------------------------------------------------------------------------

  /**
   * Called when user presses Ctrl+Shift+D.
   * Reads what is currently on the OS clipboard and emits "manual-clipboard-capture".
   * Returns the item, or null if the clipboard is empty.
   */
  captureNow() {
    const text = clipboard.readText() || "";

    // Step 1: Try reading a bitmap image (works for screenshots, paste from apps)
    let img = clipboard.readImage();

    // Step 2: If no bitmap, check if image FILES were copied from File Explorer.
    //         Windows stores file references as CF_HDROP — readImage() returns empty.
    //         We detect those paths, find the first image file, and load it from disk.
    if (img.isEmpty()) {
      try {
        const filePaths = clipboard.readFilePaths?.() ?? [];
        const imageFilePath = filePaths.find((fp) =>
          IMAGE_EXTENSIONS.some((ext) => fp.toLowerCase().endsWith(ext))
        );
        if (imageFilePath && fs.existsSync(imageFilePath)) {
          img = nativeImage.createFromPath(imageFilePath);
          logger.info(`[ClipboardService] captureNow: loaded image from file path: ${imageFilePath}`);
        }
      } catch (err) {
        logger.warn("[ClipboardService] captureNow: failed to read file paths from clipboard:", err.message);
      }
    }

    const image = img.isEmpty() ? "" : img.toDataURL();

    if (!text && !image) {
      logger.info("[ClipboardService] captureNow: clipboard is empty – nothing to send.");
      return null;
    }

    const item = {
      historyId: randomUUID(),
      text,
      image,
      timestamp: Date.now()
    };

    this._addToHistory(item);
    this._lastWrittenId = null; // this is a genuine user capture
    this.emit("manual-clipboard-capture", item);
    logger.info(`[ClipboardService] captureNow: captured item ${item.historyId} | hasImage: ${!!image} | hasText: ${!!text}`);
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
      timestamp: payload.timestamp
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
}
