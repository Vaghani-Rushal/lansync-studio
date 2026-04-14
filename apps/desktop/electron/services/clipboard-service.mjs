import { clipboard, nativeImage } from "electron";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { logger } from "./logger.mjs";

export class ClipboardService extends EventEmitter {
  constructor() {
    super();
    this.history = []; // Array of { historyId, text, image, timestamp }
    this.pollInterval = null;
    this.lastText = "";
    this.lastImage = ""; // data URL
    this.ignoreNextChange = false;
  }

  startPolling(intervalMs = 800) {
    if (this.pollInterval) return;

    // Initialize state
    this.lastText = clipboard.readText();
    const initImg = clipboard.readImage();
    this.lastImage = initImg.isEmpty() ? "" : initImg.toDataURL();

    this.pollInterval = setInterval(() => {
      this._checkClipboard();
    }, intervalMs);
    
    logger.info("Clipboard polling started");
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      logger.info("Clipboard polling stopped");
    }
  }

  _checkClipboard() {
    const text = clipboard.readText() || "";
    const img = clipboard.readImage();
    const image = img.isEmpty() ? "" : img.toDataURL();

    if (text !== this.lastText || image !== this.lastImage) {
      if (this.ignoreNextChange) {
        this.lastText = text;
        this.lastImage = image;
        this.ignoreNextChange = false;
        return;
      }

      this.lastText = text;
      this.lastImage = image;

      const item = {
        historyId: randomUUID(),
        text,
        image,
        timestamp: Date.now()
      };

      this._addToHistory(item);
      this.emit("local-clipboard-change", item);
    }
  }

  _addToHistory(item) {
    // Check if duplicate of recent
    const existingIdx = this.history.findIndex(
      (h) => h.text === item.text && h.image === item.image
    );
    if (existingIdx !== -1) {
      this.history.splice(existingIdx, 1);
    }

    this.history.unshift(item);
    if (this.history.length > 50) {
      this.history.pop();
    }
  }

  getHistory() {
    return this.history;
  }

  writeFromRemote(payload) {
    const existingIdx = this.history.findIndex((h) => h.historyId === payload.historyId);
    if (existingIdx !== -1) return; // already have it

    const item = {
      historyId: payload.historyId,
      text: payload.text || "",
      image: payload.image || "",
      timestamp: payload.timestamp
    };

    this._addToHistory(item);

    this.ignoreNextChange = true;
    
    if (item.text && item.image) {
      clipboard.write({
        text: item.text,
        image: nativeImage.createFromDataURL(item.image)
      });
    } else if (item.image) {
      clipboard.writeImage(nativeImage.createFromDataURL(item.image));
    } else if (item.text) {
      clipboard.writeText(item.text);
    }
  }

  setActiveHistoryItem(historyId) {
    const item = this.history.find((h) => h.historyId === historyId);
    if (!item) return;

    this.ignoreNextChange = true;

    if (item.text && item.image) {
      clipboard.write({
        text: item.text,
        image: nativeImage.createFromDataURL(item.image)
      });
    } else if (item.image) {
      clipboard.writeImage(nativeImage.createFromDataURL(item.image));
    } else if (item.text) {
      clipboard.writeText(item.text);
    }
    
    // Broadcast it to others as a change
    const newItem = {
      historyId: randomUUID(),
      text: item.text,
      image: item.image,
      timestamp: Date.now()
    };
    this._addToHistory(newItem);
    this.emit("local-clipboard-change", newItem);
  }
}
