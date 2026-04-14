import { TextEncoder } from "node:util";
import * as Y from "yjs";

export class CrdtService {
  constructor(workspaceService) {
    this.workspaceService = workspaceService;
    this.docs = new Map();
  }

  async ensureDoc(relativePath) {
    const existing = this.docs.get(relativePath);
    if (existing) return existing;

    const doc = new Y.Doc();
    const text = doc.getText("content");
    const fullPath = this.workspaceService.ensureInWorkspace(relativePath);
    const initialContent = await this.workspaceService.readTextFile(relativePath).catch(() => "");
    text.insert(0, initialContent);
    const stateUpdate = Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
    const entry = {
      doc,
      text,
      relativePath,
      writing: false,
      dispose: text.observe(async () => {
        if (entry.writing) return;
        entry.writing = true;
        try {
          await this.workspaceService.writeTextFile(relativePath, text.toString());
        } finally {
          entry.writing = false;
        }
      })
    };
    this.docs.set(relativePath, entry);
    return { ...entry, stateUpdate, fullPath };
  }

  async getStateUpdate(relativePath) {
    const entry = await this.ensureDoc(relativePath);
    return Buffer.from(Y.encodeStateAsUpdate(entry.doc)).toString("base64");
  }

  async applyUpdate(relativePath, base64Update) {
    const entry = await this.ensureDoc(relativePath);
    const update = Buffer.from(base64Update, "base64");
    Y.applyUpdate(entry.doc, update);
    return Buffer.from(update).toString("base64");
  }

  clearAll() {
    for (const entry of this.docs.values()) {
      entry.dispose?.();
      entry.doc.destroy();
    }
    this.docs.clear();
  }
}
