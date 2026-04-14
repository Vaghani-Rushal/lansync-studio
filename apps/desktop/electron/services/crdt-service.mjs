import * as Y from "yjs";

/**
 * CRDT docs are keyed per workspace + relative path so that two workspaces sharing
 * the same filename don't collide.
 */
export class CrdtService {
  constructor(workspaceService) {
    this.workspaceService = workspaceService;
    /** @type {Map<string, { doc: Y.Doc, text: Y.Text, relativePath: string, workspaceId: string, writing: boolean, dispose?: () => void }>} */
    this.docs = new Map();
  }

  static key(workspaceId, relativePath) {
    return `${workspaceId}::${relativePath}`;
  }

  async ensureDoc(workspaceId, relativePath) {
    const key = CrdtService.key(workspaceId, relativePath);
    const existing = this.docs.get(key);
    if (existing) return existing;

    const doc = new Y.Doc();
    const text = doc.getText("content");
    const initialContent = await this.workspaceService
      .readTextFile(workspaceId, relativePath)
      .catch(() => "");
    text.insert(0, initialContent);
    const entry = {
      doc,
      text,
      relativePath,
      workspaceId,
      writing: false
    };
    const observer = async () => {
      if (entry.writing) return;
      entry.writing = true;
      try {
        await this.workspaceService.writeTextFile(workspaceId, relativePath, text.toString());
      } finally {
        entry.writing = false;
      }
    };
    text.observe(observer);
    entry.dispose = () => text.unobserve(observer);
    this.docs.set(key, entry);
    return entry;
  }

  async getStateUpdate(workspaceId, relativePath) {
    const entry = await this.ensureDoc(workspaceId, relativePath);
    return Buffer.from(Y.encodeStateAsUpdate(entry.doc)).toString("base64");
  }

  async applyUpdate(workspaceId, relativePath, base64Update) {
    const entry = await this.ensureDoc(workspaceId, relativePath);
    const update = Buffer.from(base64Update, "base64");
    Y.applyUpdate(entry.doc, update);
    return Buffer.from(update).toString("base64");
  }

  clearWorkspace(workspaceId) {
    for (const [key, entry] of this.docs.entries()) {
      if (entry.workspaceId === workspaceId) {
        entry.dispose?.();
        entry.doc.destroy();
        this.docs.delete(key);
      }
    }
  }

  clearAll() {
    for (const entry of this.docs.values()) {
      entry.dispose?.();
      entry.doc.destroy();
    }
    this.docs.clear();
  }
}
