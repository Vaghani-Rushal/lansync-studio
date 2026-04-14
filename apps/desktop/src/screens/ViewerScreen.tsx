import type { FileTreeNode } from "@pcconnector/shared-types";
import { useMemo, useState } from "react";
import { CodeEditor } from "../components/viewers/CodeEditor";
import { ImageViewer } from "../components/viewers/ImageViewer";
import { PDFViewer } from "../components/viewers/PDFViewer";
import type { StreamMeta } from "../state/lanShareStore";
import { getViewerKind } from "../utils/viewerRouter";

type InternalNode = {
  id: string;
  name: string;
  relativePath: string;
  isDirectory: boolean;
  mimeType?: string;
  children: InternalNode[];
};

type Props = {
  clientFiles: FileTreeNode[];
  selectedFile: string | null;
  selectedMimeType: string | null;
  previewUrl: string | null;
  previewBuffer: ArrayBuffer | null;
  previewText: string;
  editorText: string;
  isDirty: boolean;
  isSaving: boolean;
  docxPreview: null | { status: "loading" } | { status: "ready"; html: string } | { status: "error"; message: string };
  bridgeReady: boolean;
  streamState: string;
  streamMeta: StreamMeta | null;
  editorReadOnly: boolean;
  errorBanner: string | null;
  onDismissError: () => void;
  onBack: () => void;
  onDisconnect: () => Promise<void>;
  onOpenFile: (node: FileTreeNode) => Promise<void>;
  onEditorChange: (value: string) => void;
  onSave: () => Promise<void>;
};

export const ViewerScreen = ({
  clientFiles,
  selectedFile,
  selectedMimeType,
  previewUrl,
  previewBuffer,
  previewText,
  editorText,
  isDirty,
  isSaving,
  docxPreview,
  bridgeReady,
  streamState,
  streamMeta,
  editorReadOnly,
  errorBanner,
  onDismissError,
  onBack,
  onDisconnect,
  onOpenFile,
  onEditorChange,
  onSave
}: Props) => {
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});
  const mime = selectedMimeType ?? "application/octet-stream";
  const viewerKind = getViewerKind(mime, selectedFile);
  const isText = viewerKind === "code";
  const isImage = viewerKind === "image";
  const isPdf = viewerKind === "pdf";
  const isVideo = viewerKind === "video";
  const isAudio = viewerKind === "audio";
  const isDocx = viewerKind === "docx";
  const treeNodes = useMemo(() => {
    const roots: InternalNode[] = [];
    const nodeMap = new Map<string, InternalNode>();
    const ensureDirNode = (relativePath: string) => {
      const existing = nodeMap.get(relativePath);
      if (existing) return existing;
      const name = relativePath.split("/").filter(Boolean).pop() ?? relativePath;
      const node: InternalNode = { id: relativePath, name, relativePath, isDirectory: true, children: [] };
      nodeMap.set(relativePath, node);
      const parentPath = relativePath.includes("/") ? relativePath.slice(0, relativePath.lastIndexOf("/")) : "";
      if (parentPath) {
        const parent = ensureDirNode(parentPath);
        if (!parent.children.find((child) => child.id === node.id)) parent.children.push(node);
      } else if (!roots.find((root) => root.id === node.id)) {
        roots.push(node);
      }
      return node;
    };
    for (const entry of clientFiles) {
      const normalized = entry.relativePath.split("\\").join("/");
      const parts = normalized.split("/").filter(Boolean);
      if (entry.isDirectory) {
        ensureDirNode(parts.join("/"));
        continue;
      }
      const fileNode: InternalNode = {
        id: entry.id,
        name: entry.name,
        relativePath: normalized,
        isDirectory: false,
        mimeType: entry.mimeType,
        children: []
      };
      const parentPath = parts.slice(0, -1).join("/");
      if (parentPath) {
        const parent = ensureDirNode(parentPath);
        parent.children.push(fileNode);
      } else {
        roots.push(fileNode);
      }
    }
    const sortTree = (nodes: InternalNode[]) => {
      nodes.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      nodes.forEach((node) => sortTree(node.children));
    };
    sortTree(roots);
    return roots;
  }, [clientFiles]);

  const renderTree = (nodes: InternalNode[], depth = 0) =>
    nodes.map((node) =>
      node.isDirectory ? (
        <li key={node.id} style={{ paddingLeft: `${depth * 12}px` }}>
          <button
            className="tree-toggle clean-btn"
            onClick={() => setExpandedDirs((prev) => ({ ...prev, [node.relativePath]: !prev[node.relativePath] }))}
          >
            {expandedDirs[node.relativePath] ? "▼" : "▶"} {node.name}
          </button>
          {expandedDirs[node.relativePath] ? <ul className="file-list">{renderTree(node.children, depth + 1)}</ul> : null}
        </li>
      ) : (
        <li key={node.id} className={selectedFile === node.relativePath ? "active-row" : ""} style={{ paddingLeft: `${depth * 12}px` }}>
          <button className="clean-btn file-open-btn" disabled={!bridgeReady} onClick={() => onOpenFile(node as FileTreeNode)}>
            {node.name}
          </button>
        </li>
      )
    );

  return (
    <section className="screen ui-shell viewer-shell">
      <div className="top-row bar-row">
        <h2 className="section-heading">Session Viewer</h2>
        <div className="row-wrap">
          <button className="ghost-btn" onClick={onBack}>
            Back
          </button>
          <button className="danger-btn" onClick={onDisconnect}>
            Disconnect
          </button>
        </div>
      </div>
      <div className="viewer-status-row">
        <span className="status-pill">{streamState}</span>
        <span className="status-pill">{editorReadOnly ? "View only" : "Edit allowed"}</span>
      </div>
      {errorBanner ? (
        <div className="error-banner">
          <span>{errorBanner}</span>
          <button onClick={onDismissError}>Dismiss</button>
        </div>
      ) : null}
      {streamMeta ? (
        <p className="muted">
          {streamMeta.receivedChunks}/{streamMeta.expectedChunks} chunks ({streamMeta.fileSize} bytes)
        </p>
      ) : null}
      <div className="explorer-grid">
        <div className="explorer-list card-surface">
          <h3 className="section-title">Shared files</h3>
          <ul className="file-list">{renderTree(treeNodes)}</ul>
        </div>
        <div className="explorer-preview card-surface">
          <h3 className="preview-file-name">{selectedFile ?? "Select a file to preview"}</h3>
          {isImage ? <ImageViewer src={previewUrl} readOnly={editorReadOnly} /> : null}
          {isPdf ? <PDFViewer data={previewBuffer} /> : null}
          {isVideo && previewUrl ? <video className="preview-video" controls src={previewUrl}></video> : null}
          {isAudio && previewUrl ? <audio className="preview-audio" controls src={previewUrl}></audio> : null}
          {isDocx ? <p className="muted">Word documents are preview-only in current build (editing disabled).</p> : null}
          {isDocx && docxPreview?.status === "loading" ? <p className="muted">Rendering Word document...</p> : null}
          {isDocx && docxPreview?.status === "error" ? (
            <div className="info-card">
              <p>Could not preview this document.</p>
              <p className="muted">{docxPreview.message}</p>
            </div>
          ) : null}
          {isDocx && docxPreview?.status === "ready" ? <div className="docx-preview" dangerouslySetInnerHTML={{ __html: docxPreview.html }} /> : null}
          {isText ? (
            <div className="editor-wrap">
              <div className="editor-actions">
                <button className="primary-btn" disabled={!selectedFile || !isDirty || isSaving || editorReadOnly} onClick={onSave}>
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
                <span className="muted">{editorReadOnly ? "View only mode" : isDirty ? "Unsaved changes" : "Saved"}</span>
              </div>
              <CodeEditor value={editorText} readOnly={editorReadOnly} onChange={onEditorChange} />
            </div>
          ) : null}
          {selectedFile && !isText && !isImage && !isPdf && !isVideo && !isAudio && !isDocx ? (
            previewText ? <pre className="preview-text">{previewText}</pre> : <div className="info-card">Preview not available for this file type yet.</div>
          ) : null}
          {isText && !editorText ? <pre className="preview-text">{previewText}</pre> : null}
        </div>
      </div>
    </section>
  );
};
