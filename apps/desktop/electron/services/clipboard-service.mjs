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
  header.writeUInt32LE(20, 0); // pFiles — offset to file list
  header.writeUInt32LE(0, 4); // pt.x
  header.writeUInt32LE(0, 8); // pt.y
  header.writeUInt32LE(0, 12); // fNC
  header.writeUInt32LE(1, 16); // fWide = 1 (Unicode paths)
  // File list: path + \0 + extra \0 terminator (wide chars)
  const pathBuf = Buffer.from(filePath + "\0\0", "ucs2");
  return Buffer.concat([header, pathBuf]);
}

/** Image file extensions we can load from disk when copied via File Explorer */
const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".webp",
  ".tiff",
  ".tif",
  ".ico",
];

/**
 * ClipboardService – Manual-trigger mode.
 *
 * Ctrl/Cmd+C     → normal OS copy (no LAN Sync action)
 * capture shortcut(s) → reads OS clipboard → broadcasts to network
 * paste shortcut       → writes top history item to OS clipboard
 */
export class ClipboardService extends EventEmitter {
  constructor() {
    super();
    /** @type {Array<{historyId:string,text:string,image:string,timestamp:number}>} */
    this.history = [];
    // Track the last item we wrote TO the OS clipboard ourselves
    // so a later manual capture does not re-broadcast the same item.
    this._lastWrittenId = null;
  }

  // ---------------------------------------------------------------------------
  // Public API called by globalShortcut handlers in main.mjs
  // ---------------------------------------------------------------------------

  _readClipboardContents() {
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
          IMAGE_EXTENSIONS.some((ext) => fp.toLowerCase().endsWith(ext)),
        );
        if (imageFilePath && fs.existsSync(imageFilePath)) {
          img = nativeImage.createFromPath(imageFilePath);
          logger.info(
            `[ClipboardService] captureNow: loaded image from file path: ${imageFilePath}`,
          );
        }
      } catch (err) {
        logger.warn(
          "[ClipboardService] captureNow: failed to read file paths from clipboard:",
          err.message,
        );
      }
    }

    const image = img.isEmpty() ? "" : img.toDataURL();
    return { text, image };
  }

  /**
   * Reads current OS clipboard (text + image) and broadcasts it.
   * Returns the item, or null if clipboard has no data.
   */
  captureNow() {
    const { text, image } = this._readClipboardContents();
    if (!text && !image) {
      logger.info(
        "[ClipboardService] captureNow: clipboard is empty – nothing to send.",
      );
      return null;
    }

    // Step 3: Guard against re-capturing the same content.
    //   This happens on macOS when the osascript Cmd+C didn't update the clipboard
    //   (e.g. selection was lost before the shortcut fired).
    //   Comparing against the MOST RECENT history entry only — not the full list —
    //   so intentional copies of older items still work.
    const latest = this.history[0];
    if (latest && latest.text === text && latest.image === image) {
      logger.info(
        "[ClipboardService] captureNow: clipboard unchanged from last capture – nothing new to share.",
      );
      return null;
    }

    const item = {
      historyId: randomUUID(),
      text,
      image,
      timestamp: Date.now(),
    };

    this._addToHistory(item);
    this._lastWrittenId = null; // this is a genuine user capture
    this.emit("manual-clipboard-capture", item);
    logger.info(
      `[ClipboardService] captureNow: captured item ${item.historyId} | hasImage: ${!!image} | hasText: ${!!text}`,
    );
    return item;
  }

  /**
   * Captures only text from clipboard and broadcasts it.
   */
  captureTextOnly() {
    const { text } = this._readClipboardContents();
    if (!text) {
      logger.info(
        "[ClipboardService] captureTextOnly: clipboard text is empty.",
      );
      return null;
    }
    const latest = this.history[0];
    if (latest && latest.text === text && !latest.image) {
      logger.info(
        "[ClipboardService] captureTextOnly: text unchanged from last capture.",
      );
      return null;
    }
    const item = {
      historyId: randomUUID(),
      text,
      image: "",
      timestamp: Date.now(),
    };
    this._addToHistory(item);
    this._lastWrittenId = null;
    this.emit("manual-clipboard-capture", item);
    logger.info(
      `[ClipboardService] captureTextOnly: captured item ${item.historyId}`,
    );
    return item;
  }

  /**
   * Captures only image from clipboard/file paths and broadcasts it.
   */
  captureImageOnly() {
    const { image } = this._readClipboardContents();
    if (!image) {
      logger.info(
        "[ClipboardService] captureImageOnly: clipboard image is empty.",
      );
      return null;
    }
    const latest = this.history[0];
    if (latest && latest.image === image && !latest.text) {
      logger.info(
        "[ClipboardService] captureImageOnly: image unchanged from last capture.",
      );
      return null;
    }
    const item = {
      historyId: randomUUID(),
      text: "",
      image,
      timestamp: Date.now(),
    };
    this._addToHistory(item);
    this._lastWrittenId = null;
    this.emit("manual-clipboard-capture", item);
    logger.info(
      `[ClipboardService] captureImageOnly: captured item ${item.historyId}`,
    );
    return item;
  }

  /**
   * Captures an image directly from a file path (used for Finder/Explorer selections).
   */
  captureImageFromFilePath(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
      logger.info(
        "[ClipboardService] captureImageFromFilePath: file does not exist.",
      );
      return null;
    }
    const img = nativeImage.createFromPath(filePath);
    if (img.isEmpty()) {
      logger.warn(
        `[ClipboardService] captureImageFromFilePath: nativeImage empty for ${filePath}`,
      );
      return null;
    }
    const image = img.toDataURL();
    const latest = this.history[0];
    if (latest && latest.image === image) {
      logger.info(
        "[ClipboardService] captureImageFromFilePath: image unchanged from last capture.",
      );
      return null;
    }
    // Keep filename as context while still rendering real image preview.
    const item = {
      historyId: randomUUID(),
      text: path.basename(filePath),
      image,
      timestamp: Date.now(),
    };
    this._addToHistory(item);
    this._lastWrittenId = null;
    this.emit("manual-clipboard-capture", item);
    clipboard.writeImage(img);
    logger.info(
      `[ClipboardService] captureImageFromFilePath: captured ${item.historyId} from ${filePath}`,
    );
    return item;
  }

  /**
   * Writes the most recent history item to the OS clipboard for pasting.
   */
  pasteTop() {
    if (this.history.length === 0) {
      logger.info("[ClipboardService] pasteTop: history is empty.");
      return null;
    }
    const item = this.history[0];
    this._writeToOS(item);
    this._lastWrittenId = item.historyId;
    logger.info(
      `[ClipboardService] pasteTop: wrote item ${item.historyId} to OS clipboard`,
    );
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
    };

    this._addToHistory(item);
    this._writeToOS(item);
    this._lastWrittenId = item.historyId;
    logger.info(
      `[ClipboardService] writeFromRemote: received item ${item.historyId}`,
    );
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
    logger.info(
      `[ClipboardService] setActiveHistoryItem: re-broadcast ${newItem.historyId}`,
    );
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
      (h) => h.text === item.text && h.image === item.image,
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
          logger.warn(
            "[ClipboardService] _writeToOS: nativeImage is empty after DataURL decode – skipping",
          );
          if (item.text) clipboard.writeText(item.text);
          return;
        }
        logger.info(
          `[ClipboardService] _writeToOS: writing image ${img.getSize().width}x${img.getSize().height}`,
        );
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
