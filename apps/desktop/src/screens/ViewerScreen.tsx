import type { FileTreeNode } from "@pcconnector/shared-types";
import type { StreamMeta } from "../state/lanShareStore";

type Props = {
  clientFiles: FileTreeNode[];
  selectedFile: string | null;
  selectedMimeType: string | null;
  previewUrl: string | null;
  previewText: string;
  editorText: string;
  isDirty: boolean;
  isSaving: boolean;
  docxPreview: null | { status: "loading" } | { status: "ready"; html: string } | { status: "error"; message: string };
  bridgeReady: boolean;
  streamState: string;
  streamMeta: StreamMeta | null;
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
  previewText,
  editorText,
  isDirty,
  isSaving,
  docxPreview,
  bridgeReady,
  streamState,
  streamMeta,
  onBack,
  onDisconnect,
  onOpenFile,
  onEditorChange,
  onSave
}: Props) => {
  const mime = selectedMimeType ?? "application/octet-stream";
  const isText = mime === "text/plain";
  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";
  const isVideo = mime.startsWith("video/");
  const isAudio = mime.startsWith("audio/");
  const isDocx = mime.includes("wordprocessingml") || selectedFile?.toLowerCase().endsWith(".docx");

  return (
    <section className="screen panel explorer-panel">
      <div className="top-row">
        <h2>File Viewer/Editor</h2>
        <div className="row-wrap">
          <button onClick={onBack}>Back</button>
          <button onClick={onDisconnect}>Disconnect</button>
        </div>
      </div>
      <p className="subtle">Transfer: {streamState}</p>
      {streamMeta ? (
        <p className="subtle">
          {streamMeta.receivedChunks}/{streamMeta.expectedChunks} chunks ({streamMeta.fileSize} bytes)
        </p>
      ) : null}
      <div className="explorer-grid">
        <div className="explorer-list">
          <h3>Shared Files</h3>
          <ul className="file-list">
            {clientFiles.filter((node) => !node.isDirectory).map((node) => (
              <li key={node.id} className={selectedFile === node.relativePath ? "active-row" : ""}>
                <button disabled={!bridgeReady} onClick={() => onOpenFile(node)}>
                  Open
                </button>
                <span>{node.relativePath}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="explorer-preview">
          <h3>{selectedFile ?? "Select a file to preview"}</h3>
          {isImage && previewUrl ? <img className="preview-image" src={previewUrl} alt="Preview" /> : null}
          {isPdf && previewUrl ? <iframe className="preview-frame" title="PDF Preview" src={previewUrl}></iframe> : null}
          {isVideo && previewUrl ? <video className="preview-video" controls src={previewUrl}></video> : null}
          {isAudio && previewUrl ? <audio className="preview-audio" controls src={previewUrl}></audio> : null}
          {isDocx && docxPreview?.status === "loading" ? <p className="subtle">Rendering Word document...</p> : null}
          {isDocx && docxPreview?.status === "error" ? (
            <div className="info-card">
              <p>Could not preview this document.</p>
              <p className="subtle">{docxPreview.message}</p>
            </div>
          ) : null}
          {isDocx && docxPreview?.status === "ready" ? <div className="docx-preview" dangerouslySetInnerHTML={{ __html: docxPreview.html }} /> : null}
          {isText ? (
            <div className="editor-wrap">
              <div className="editor-actions">
                <button disabled={!selectedFile || !isDirty || isSaving} onClick={onSave}>
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
                <span className="subtle">{isDirty ? "Unsaved changes" : "Saved"}</span>
              </div>
              <textarea className="editor-textarea" value={editorText} onChange={(event) => onEditorChange(event.target.value)} />
            </div>
          ) : null}
          {selectedFile && !isText && !isImage && !isPdf && !isVideo && !isAudio && !isDocx ? (
            <div className="info-card">Preview not available for this file type yet.</div>
          ) : null}
          {isText && !editorText ? <pre className="preview-text">{previewText}</pre> : null}
        </div>
      </div>
    </section>
  );
};
