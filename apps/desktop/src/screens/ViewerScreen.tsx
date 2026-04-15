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

const getFileIcon = (name: string, isDirectory: boolean, expanded?: boolean) => {
  if (isDirectory) return expanded ? "📂" : "📁";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(ext)) return "🖼";
  if (["pdf"].includes(ext)) return "📕";
  if (["doc", "docx"].includes(ext)) return "📘";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📗";
  if (["ppt", "pptx"].includes(ext)) return "📙";
  if (["mp4", "mov", "webm", "avi", "mkv"].includes(ext)) return "🎬";
  if (["mp3", "wav", "flac", "ogg", "m4a"].includes(ext)) return "🎵";
  if (["zip", "tar", "gz", "rar", "7z"].includes(ext)) return "🗜";
  if (["js", "jsx", "ts", "tsx", "py", "rs", "go", "java", "c", "cpp", "h", "rb", "php", "swift", "kt"].includes(ext)) return "⚡";
  if (["json", "yaml", "yml", "toml", "xml", "ini", "env"].includes(ext)) return "⚙";
  if (["md", "mdx", "txt", "rst"].includes(ext)) return "📝";
  if (["html", "css", "scss", "sass", "less"].includes(ext)) return "🌐";
  return "📄";
};

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
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
  const [search, setSearch] = useState("");
  const mime = selectedMimeType ?? "application/octet-stream";
  const viewerKind = getViewerKind(mime, selectedFile);
  const isText = viewerKind === "code";
  const isImage = viewerKind === "image";
  const isPdf = viewerKind === "pdf";
  const isVideo = viewerKind === "video";
  const isAudio = viewerKind === "audio";
  const isDocx = viewerKind === "docx";

  const fileCount = useMemo(() => clientFiles.filter((f) => !f.isDirectory).length, [clientFiles]);

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

  const filteredTree = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return treeNodes;
    const filter = (nodes: InternalNode[]): InternalNode[] => {
      const result: InternalNode[] = [];
      for (const node of nodes) {
        if (node.isDirectory) {
          const kids = filter(node.children);
          if (kids.length > 0 || node.name.toLowerCase().includes(query)) {
            result.push({ ...node, children: kids });
          }
        } else if (node.name.toLowerCase().includes(query)) {
          result.push(node);
        }
      }
      return result;
    };
    return filter(treeNodes);
  }, [treeNodes, search]);

  const selectedName = selectedFile ? selectedFile.split("/").pop() ?? selectedFile : null;
  const breadcrumb = selectedFile ? selectedFile.split("/").filter(Boolean) : [];
  const autoExpand = search.trim().length > 0;

  const renderTree = (nodes: InternalNode[], depth = 0) =>
    nodes.map((node) => {
      if (node.isDirectory) {
        const expanded = autoExpand || !!expandedDirs[node.relativePath];
        return (
          <li key={node.id} className="tree-item">
            <button
              className="tree-row tree-dir"
              style={{ paddingLeft: `${10 + depth * 14}px` }}
              onClick={() => setExpandedDirs((prev) => ({ ...prev, [node.relativePath]: !prev[node.relativePath] }))}
            >
              <span className="tree-chevron" data-open={expanded ? "true" : "false"}>
                ▸
              </span>
              <span className="tree-icon">{getFileIcon(node.name, true, expanded)}</span>
              <span className="tree-label">{node.name}</span>
              <span className="tree-count">{node.children.length}</span>
            </button>
            {expanded ? <ul className="file-list nested">{renderTree(node.children, depth + 1)}</ul> : null}
          </li>
        );
      }
      const isActive = selectedFile === node.relativePath;
      return (
        <li key={node.id} className={`tree-item ${isActive ? "active-row" : ""}`}>
          <button
            className="tree-row tree-file"
            style={{ paddingLeft: `${10 + depth * 14}px` }}
            disabled={!bridgeReady}
            onClick={() => onOpenFile(node as FileTreeNode)}
          >
            <span className="tree-chevron tree-chevron-spacer" />
            <span className="tree-icon">{getFileIcon(node.name, false)}</span>
            <span className="tree-label">{node.name}</span>
          </button>
        </li>
      );
    });

  const previewBadge = isImage ? "Image" : isPdf ? "PDF" : isVideo ? "Video" : isAudio ? "Audio" : isDocx ? "Document" : isText ? "Text" : selectedFile ? "File" : null;

  return (
    <section className="screen ui-shell viewer-shell">
      <div className="top-row bar-row">
        <div className="viewer-title-group">
          <h2 className="section-heading">Session Viewer</h2>
          <span className="status-pill">{streamState}</span>
          <span className={`status-pill ${editorReadOnly ? "" : "ok"}`}>{editorReadOnly ? "View only" : "Edit allowed"}</span>
        </div>
        <div className="row-wrap">
          <button className="ghost-btn" onClick={onBack}>
            Back
          </button>
          <button className="danger-btn" onClick={onDisconnect}>
            Disconnect
          </button>
        </div>
      </div>

      {errorBanner ? (
        <div className="error-banner">
          <span>{errorBanner}</span>
          <button onClick={onDismissError}>Dismiss</button>
        </div>
      ) : null}

      {streamMeta ? (
        <div className="stream-meta-row">
          <div className="stream-progress-bar">
            <div
              className="stream-progress-fill"
              style={{ width: `${Math.min(100, (streamMeta.receivedChunks / Math.max(1, streamMeta.expectedChunks)) * 100)}%` }}
            />
          </div>
          <span className="muted">
            {streamMeta.receivedChunks}/{streamMeta.expectedChunks} chunks · {formatBytes(streamMeta.fileSize)}
          </span>
        </div>
      ) : null}

      <div className="explorer-grid">
        <aside className="explorer-list card-surface">
          <div className="explorer-sidebar-head">
            <div className="explorer-sidebar-title">
              <span className="section-title" style={{ margin: 0 }}>Shared files</span>
              <span className="file-count-chip">{fileCount}</span>
            </div>
            <div className="explorer-search">
              <span className="explorer-search-icon">⌕</span>
              <input
                type="text"
                value={search}
                placeholder="Search files..."
                onChange={(e) => setSearch(e.target.value)}
                className="explorer-search-input"
              />
            </div>
          </div>

          {filteredTree.length === 0 ? (
            <div className="explorer-empty">
              <div className="explorer-empty-icon">🔍</div>
              <div>{search ? "No files match your search" : "Waiting for shared files..."}</div>
            </div>
          ) : (
            <ul className="file-list">{renderTree(filteredTree)}</ul>
          )}
        </aside>

        <div className="explorer-preview card-surface">
          {selectedFile ? (
            <>
              <div className="preview-header">
                <div className="preview-header-main">
                  <span className="preview-file-icon">{getFileIcon(selectedName ?? "", false)}</span>
                  <div className="preview-header-text">
                    <div className="preview-file-name">{selectedName}</div>
                    <div className="preview-breadcrumb">
                      {breadcrumb.slice(0, -1).map((seg, idx) => (
                        <span key={idx}>
                          {seg}
                          <span className="preview-breadcrumb-sep">/</span>
                        </span>
                      ))}
                      {breadcrumb.length === 1 ? <span className="muted">root</span> : null}
                    </div>
                  </div>
                </div>
                {previewBadge ? <span className="status-pill">{previewBadge}</span> : null}
              </div>

              <div className="preview-body">
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
                      <span className={`status-pill ${isDirty ? "" : "ok"}`}>
                        {editorReadOnly ? "View only mode" : isDirty ? "● Unsaved changes" : "✓ Saved"}
                      </span>
                      <button className="primary-btn" disabled={!selectedFile || !isDirty || isSaving || editorReadOnly} onClick={onSave}>
                        {isSaving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                    <CodeEditor value={editorText} readOnly={editorReadOnly} onChange={onEditorChange} />
                  </div>
                ) : null}
                {selectedFile && !isText && !isImage && !isPdf && !isVideo && !isAudio && !isDocx ? (
                  previewText ? <pre className="preview-text">{previewText}</pre> : <div className="info-card">Preview not available for this file type yet.</div>
                ) : null}
                {isText && !editorText ? <pre className="preview-text">{previewText}</pre> : null}
              </div>
            </>
          ) : (
            <div className="preview-empty">
              <div className="preview-empty-icon">📄</div>
              <h3 className="preview-empty-title">Select a file to preview</h3>
              <p className="muted">Choose a file from the sidebar to view, play, or edit it in place.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
