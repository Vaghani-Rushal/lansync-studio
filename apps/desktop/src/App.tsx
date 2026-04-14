import type { DiscoveryWorkspace, FileTreeNode } from "@pcconnector/shared-types";
import "./App.css";
import { useLanShareBridge } from "./hooks/useLanShareBridge";
import { HomeScreen } from "./screens/HomeScreen";
import { JoinScreen } from "./screens/JoinScreen";
import { ShareScreen } from "./screens/ShareScreen";
import { ViewerScreen } from "./screens/ViewerScreen";
import { useLanShareStore } from "./state/lanShareStore";

const buildTree = (entries: Array<{ path: string; name: string; isDirectory: boolean; size?: number; mimeType?: string }>) =>
  entries.map((entry) => ({
    id: entry.path,
    name: entry.name,
    relativePath: entry.path,
    isDirectory: entry.isDirectory,
    size: entry.size,
    mimeType: entry.mimeType
  }));

function App() {
  const { api, bridgeReady } = useLanShareBridge();
  const currentScreen = useLanShareStore((s) => s.currentScreen);
  const workspaceName = useLanShareStore((s) => s.workspaceName);
  const sessionCode = useLanShareStore((s) => s.sessionCode);
  const status = useLanShareStore((s) => s.status);
  const hostFiles = useLanShareStore((s) => s.hostFiles);
  const clientFiles = useLanShareStore((s) => s.clientFiles);
  const discovered = useLanShareStore((s) => s.discovered);
  const pendingJoins = useLanShareStore((s) => s.pendingJoins);
  const connectedClients = useLanShareStore((s) => s.connectedClients);
  const connectionState = useLanShareStore((s) => s.connectionState);
  const errorBanner = useLanShareStore((s) => s.errorBanner);
  const selectedFile = useLanShareStore((s) => s.selectedFile);
  const selectedMimeType = useLanShareStore((s) => s.selectedMimeType);
  const previewText = useLanShareStore((s) => s.previewText);
  const editorText = useLanShareStore((s) => s.editorText);
  const isDirty = useLanShareStore((s) => s.isDirty);
  const isSaving = useLanShareStore((s) => s.isSaving);
  const previewUrl = useLanShareStore((s) => s.previewUrl);
  const docxPreview = useLanShareStore((s) => s.docxPreview);
  const isCreatingWorkspace = useLanShareStore((s) => s.isCreatingWorkspace);
  const isDiscovering = useLanShareStore((s) => s.isDiscovering);
  const streamState = useLanShareStore((s) => s.streamState);
  const streamMeta = useLanShareStore((s) => s.streamMeta);

  const setScreen = useLanShareStore((s) => s.setScreen);
  const setWorkspaceName = useLanShareStore((s) => s.setWorkspaceName);
  const setSessionCode = useLanShareStore((s) => s.setSessionCode);
  const setStatus = useLanShareStore((s) => s.setStatus);
  const setHostFiles = useLanShareStore((s) => s.setHostFiles);
  const setConnectionState = useLanShareStore((s) => s.setConnectionState);
  const setErrorBanner = useLanShareStore((s) => s.setErrorBanner);
  const setSelectedFile = useLanShareStore((s) => s.setSelectedFile);
  const setDocxPreview = useLanShareStore((s) => s.setDocxPreview);
  const setIsDirty = useLanShareStore((s) => s.setIsDirty);
  const setEditorText = useLanShareStore((s) => s.setEditorText);
  const setIsSaving = useLanShareStore((s) => s.setIsSaving);
  const setIsDiscovering = useLanShareStore((s) => s.setIsDiscovering);
  const setIsCreatingWorkspace = useLanShareStore((s) => s.setIsCreatingWorkspace);
  const resetPreviewState = useLanShareStore((s) => s.resetPreviewState);
  const setStreamMeta = useLanShareStore((s) => s.setStreamMeta);
  const setStreamState = useLanShareStore((s) => s.setStreamState);

  const handleCreateWorkspace = async () => {
    if (!api || !bridgeReady) return;
    setIsCreatingWorkspace(true);
    const response = await api.createWorkspace({ workspaceName, port: 7788 });
    if (response?.ok) {
      setStatus(`Sharing ${response.workspaceName}`);
      setSessionCode(response.sessionCode ?? "");
      setHostFiles(buildTree(response.fileEntries ?? []));
      setScreen("share");
    } else {
      setStatus("Failed to create workspace");
    }
    setIsCreatingWorkspace(false);
  };

  const handleStopSession = async () => {
    if (!api || !bridgeReady) return;
    await api.stopSession();
    setStatus("Stopped");
    setHostFiles([]);
    setSessionCode("");
  };

  const handleJoinWorkspace = async (workspace: DiscoveryWorkspace) => {
    if (!api || !bridgeReady) return;
    setConnectionState("connecting");
    const result = await api.joinWorkspace(workspace);
    if (result.ok) {
      setConnectionState("awaiting_approval");
      setScreen("viewer");
      return;
    }
    setErrorBanner("Join request failed.");
    setConnectionState("disconnected");
  };

  const handleOpenFile = async (node: FileTreeNode) => {
    if (!api || !bridgeReady) return;
    setSelectedFile(node.relativePath);
    setStreamState("started");
    setStreamMeta(null);
    const pathLower = node.relativePath.toLowerCase();
    const mime = node.mimeType ?? "";
    if (pathLower.endsWith(".docx") || mime.includes("wordprocessingml")) {
      setDocxPreview({ status: "loading" });
    } else {
      setDocxPreview(null);
    }
    const response = await api.openFile(node.relativePath);
    if (!response.ok) {
      setErrorBanner(response.error ?? "Failed to open file");
      setStreamState("failed");
    }
  };

  const handleSave = async () => {
    if (!api || !selectedFile) return;
    setIsSaving(true);
    const response = await api.saveFile({ relativePath: selectedFile, content: editorText });
    if (!response.ok) {
      setErrorBanner(response.error ?? "Save failed");
    }
    setIsSaving(false);
  };

  const handleDisconnect = async () => {
    if (!api) return;
    await api.disconnectClient();
    setConnectionState("disconnected");
    resetPreviewState();
    setScreen("join");
  };

  return (
    <main className="layout professional">
      <header className="topbar">
        <h1>PC Connector Workspace</h1>
        <span className="pill">{status}</span>
      </header>

      {currentScreen === "home" ? (
        <HomeScreen discoveredCount={discovered.length} onShare={() => setScreen("share")} onJoin={() => setScreen("join")} />
      ) : null}

      {currentScreen === "share" ? (
        <ShareScreen
          workspaceName={workspaceName}
          sessionCode={sessionCode}
          status={status}
          hostFiles={hostFiles}
          pendingJoins={pendingJoins}
          connectedClients={connectedClients}
          isCreatingWorkspace={isCreatingWorkspace}
          bridgeReady={bridgeReady}
          onWorkspaceNameChange={setWorkspaceName}
          onCreateWorkspace={handleCreateWorkspace}
          onStopSession={handleStopSession}
          onApproveJoin={async (requestId) => {
            await api?.approveJoin(requestId);
          }}
          onRejectJoin={async (requestId) => {
            await api?.rejectJoin(requestId);
          }}
          onBack={() => setScreen("home")}
        />
      ) : null}

      {currentScreen === "join" ? (
        <JoinScreen
          discovered={discovered}
          isDiscovering={isDiscovering}
          connectionState={connectionState}
          errorBanner={errorBanner}
          bridgeReady={bridgeReady}
          onDismissError={() => setErrorBanner(null)}
          onStartDiscovery={async () => {
            if (!api || !bridgeReady) return;
            await api.startDiscovery();
            setIsDiscovering(true);
          }}
          onStopDiscovery={async () => {
            if (!api || !bridgeReady) return;
            await api.stopDiscovery();
            setIsDiscovering(false);
          }}
          onJoinWorkspace={handleJoinWorkspace}
          onRetry={async () => {
            if (!api || !bridgeReady) return;
            const response = await api.reconnectClient();
            if (response.ok) {
              setConnectionState("awaiting_approval");
              setScreen("viewer");
            }
          }}
          onBack={() => setScreen("home")}
        />
      ) : null}

      {currentScreen === "viewer" ? (
        <ViewerScreen
          clientFiles={clientFiles}
          selectedFile={selectedFile}
          selectedMimeType={selectedMimeType}
          previewUrl={previewUrl}
          previewText={previewText}
          editorText={editorText}
          isDirty={isDirty}
          isSaving={isSaving}
          docxPreview={docxPreview}
          bridgeReady={bridgeReady}
          streamState={streamState}
          streamMeta={streamMeta}
          onBack={() => setScreen("join")}
          onDisconnect={handleDisconnect}
          onOpenFile={handleOpenFile}
          onEditorChange={(value) => {
            setEditorText(value);
            setIsDirty(value !== previewText);
          }}
          onSave={handleSave}
        />
      ) : null}
    </main>
  );
}

export default App;
import { useEffect, useMemo, useRef, useState } from "react";
import mammoth from "mammoth";
import type { DiscoveryWorkspace, FileTreeNode, PendingJoin } from "@pcconnector/shared-types";
import "./App.css";

type DocxPreviewState =
  | null
  | { status: "loading" }
  | { status: "ready"; html: string }
  | { status: "error"; message: string };

const buildTree = (entries: Array<{ path: string; name: string; isDirectory: boolean; size?: number; mimeType?: string }>): FileTreeNode[] =>
  entries.map((entry) => ({
    id: entry.path,
    name: entry.name,
    relativePath: entry.path,
    isDirectory: entry.isDirectory,
    size: entry.size,
    mimeType: entry.mimeType
  }));

const decodeBase64Bytes = (base64: string) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

function App() {
  const api = window.pcConnectorApi;
  const bridgeReady = Boolean(api?.isBridgeReady?.());
  const [workspaceName, setWorkspaceName] = useState("MyWorkspace");
  const [hostFiles, setHostFiles] = useState<FileTreeNode[]>([]);
  const [clientFiles, setClientFiles] = useState<FileTreeNode[]>([]);
  const [discovered, setDiscovered] = useState<DiscoveryWorkspace[]>([]);
  const [pendingJoins, setPendingJoins] = useState<PendingJoin[]>([]);
  const [status, setStatus] = useState("Idle");
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [clientMessages, setClientMessages] = useState<string[]>([]);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedMimeType, setSelectedMimeType] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string>("");
  const [editorText, setEditorText] = useState<string>("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [docxPreview, setDocxPreview] = useState<DocxPreviewState>(null);
  const chunksRef = useRef<Record<string, string[]>>({});
  const previewUrlRef = useRef<string | null>(null);
  const previewMimeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!bridgeReady || !api) {
      return;
    }

    const offWorkspaces = api.onWorkspaces(setDiscovered);
    const offPending = api.onPendingJoins(setPendingJoins);
    const offMessages = api.onClientMessage((message) => {
      if (message.type === "JOIN_ACCEPT") {
        setConnectionState("connected");
      }
      if (message.type === "WORKSPACE_SNAPSHOT") {
        const entries =
          (message.payload.entries as Array<{ path: string; name: string; isDirectory: boolean; size?: number; mimeType?: string }>) ??
          [];
        setClientFiles(buildTree(entries));
      }
      if (message.type === "SESSION_STOP") {
        setConnectionState("disconnected");
        setErrorBanner("Session stopped by host.");
      }
      if (message.type === "RECONNECTING") {
        setConnectionState("connecting");
      }
      if (message.type === "ERROR") {
        const payload = message.payload as { message?: string };
        setErrorBanner(payload.message ?? "Unexpected network error");
      }
      if (message.type === "FILE_CHUNK") {
        const payload = message.payload as { relativePath: string; chunk: string; mimeType?: string };
        const current = chunksRef.current[payload.relativePath] ?? [];
        chunksRef.current[payload.relativePath] = [...current, payload.chunk];
        previewMimeRef.current = payload.mimeType ?? null;
      }
      if (message.type === "FILE_END") {
        const payload = message.payload as { relativePath: string };
        const chunks = chunksRef.current[payload.relativePath] ?? [];
        const bytes = chunks.flatMap((chunk) => Array.from(decodeBase64Bytes(chunk)));
        const uint8 = new Uint8Array(bytes);
        const mimeType = previewMimeRef.current;
        const relLower = payload.relativePath.toLowerCase();
        setSelectedMimeType(mimeType ?? null);

        const revokeBlob = () => {
          if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = null;
            setPreviewUrl(null);
          }
        };

        const isDocx =
          Boolean(mimeType?.includes("wordprocessingml")) || relLower.endsWith(".docx");

        if (mimeType?.startsWith("image/") || mimeType === "application/pdf" || mimeType?.startsWith("video/") || mimeType?.startsWith("audio/")) {
          const blob = new Blob([uint8], { type: mimeType ?? "application/octet-stream" });
          revokeBlob();
          const url = URL.createObjectURL(blob);
          previewUrlRef.current = url;
          setPreviewUrl(url);
          setPreviewText("");
          setDocxPreview(null);
        } else if (isDocx) {
          revokeBlob();
          setPreviewText("");
          setEditorText("");
          setIsDirty(false);
          setDocxPreview({ status: "loading" });
          const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
          void mammoth
            .convertToHtml({ arrayBuffer })
            .then((result) => setDocxPreview({ status: "ready", html: result.value }))
            .catch((err) =>
              setDocxPreview({
                status: "error",
                message: err instanceof Error ? err.message : String(err)
              })
            );
        } else if (mimeType === "text/plain") {
          revokeBlob();
          setDocxPreview(null);
          const text = new TextDecoder().decode(uint8);
          setPreviewText(text);
          setEditorText(text);
          setIsDirty(false);
        } else {
          revokeBlob();
          setDocxPreview(null);
          setPreviewText("");
          setEditorText("");
          setIsDirty(false);
        }
        chunksRef.current[payload.relativePath] = [];
      }
      if (message.type === "SAVE_ACK") {
        setIsDirty(false);
        setStatus("Saved");
      }
      setClientMessages((prev) => [`${message.type}: ${JSON.stringify(message.payload)}`, ...prev].slice(0, 8));
    });
    const offHostStatus = api.onHostStatus((hostStatus) => {
      setStatus(hostStatus.message ?? hostStatus.state);
    });
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      offWorkspaces();
      offPending();
      offMessages();
      offHostStatus();
    };
  }, [api, bridgeReady]);

  const discoveredCount = useMemo(() => discovered.length, [discovered.length]);
  const selectedEntry = useMemo(
    () => clientFiles.find((entry) => entry.relativePath === selectedFile) ?? null,
    [clientFiles, selectedFile]
  );
  const selectedEntryMime = selectedEntry?.mimeType ?? selectedMimeType ?? "application/octet-stream";
  const isTextPreview = selectedEntryMime === "text/plain";
  const isImagePreview = selectedEntryMime.startsWith("image/");
  const isPdfPreview = selectedEntryMime === "application/pdf";
  const isVideoPreview = selectedEntryMime.startsWith("video/");
  const isAudioPreview = selectedEntryMime.startsWith("audio/");
  const selectedLower = selectedFile?.toLowerCase() ?? "";
  const isDocx =
    selectedEntryMime.includes("wordprocessingml") || selectedLower.endsWith(".docx");
  const isLegacyWordDoc =
    selectedEntryMime === "application/msword" || (selectedLower.endsWith(".doc") && !selectedLower.endsWith(".docx"));
  const isOtherOfficeDoc =
    selectedEntryMime.includes("spreadsheetml") ||
    selectedEntryMime.includes("presentationml") ||
    isLegacyWordDoc;

  return (
    <main className="layout professional">
      <header className="topbar">
        <h1>PC Connector Workspace</h1>
        <span className="pill">{status}</span>
      </header>
      <section className="panel">
        <h2>Host Controls</h2>
        <label>Workspace Name</label>
        <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} />
        <button
          disabled={!bridgeReady || isCreatingWorkspace}
          onClick={async () => {
            if (!api || !bridgeReady) return;
            setIsCreatingWorkspace(true);
            const response = await api.createWorkspace({ workspaceName, port: 7788 });
            if (response?.ok) {
              setStatus(`Sharing ${response.workspaceName}`);
              setHostFiles(buildTree(response.fileEntries ?? []));
            } else {
              setStatus("Failed to create workspace");
            }
            setIsCreatingWorkspace(false);
          }}
        >
          {isCreatingWorkspace ? "Creating..." : "Create Workspace"}
        </button>
        <button
          disabled={!bridgeReady}
          onClick={async () => {
            if (!api || !bridgeReady) return;
            await api.stopSession();
            setStatus("Stopped");
            setHostFiles([]);
            setPendingJoins([]);
          }}
        >
          Stop Sharing
        </button>
        <p>Status: {status}</p>
        <h3>Pending Join Requests</h3>
        {pendingJoins.length === 0 ? <p>No pending requests</p> : null}
        {pendingJoins.map((request) => (
          <div className="join-request" key={request.requestId}>
            <span>{request.deviceName}</span>
            <button onClick={() => api?.approveJoin(request.requestId)}>Approve</button>
            <button onClick={() => api?.rejectJoin(request.requestId)}>Reject</button>
          </div>
        ))}
        <h3>Host Files</h3>
        <ul className="file-list compact-list">
          {hostFiles.slice(0, 12).map((node) => (
            <li key={node.id}>{node.relativePath}</li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Discovery & Join</h2>
        {!bridgeReady ? (
          <div className="error-banner">
            <span>Desktop bridge is not available. Launch the app with Electron.</span>
          </div>
        ) : null}
        {errorBanner ? (
          <div className="error-banner">
            <span>{errorBanner}</span>
            <button onClick={() => setErrorBanner(null)}>Dismiss</button>
          </div>
        ) : null}
        <button
          disabled={!bridgeReady || isDiscovering}
          onClick={async () => {
            if (!api || !bridgeReady) return;
            await api.startDiscovery();
            setIsDiscovering(true);
          }}
        >
          Start Discovery
        </button>
        <button
          disabled={!bridgeReady || !isDiscovering}
          onClick={async () => {
            if (!api || !bridgeReady) return;
            await api.stopDiscovery();
            setIsDiscovering(false);
          }}
        >
          Stop Discovery
        </button>
        <button
          disabled={!bridgeReady}
          onClick={async () => {
            if (!api || !bridgeReady) return;
            const response = await api.reconnectClient();
            if (response.ok) setConnectionState("awaiting_approval");
          }}
        >
          Retry Connection
        </button>
        <p>Connection: {connectionState}</p>
        <p>Discovered Hosts: {discoveredCount}</p>
        {discovered.map((workspace) => (
          <div className="workspace-row" key={workspace.workspaceId}>
            <div>
              <strong>{workspace.workspaceName}</strong>
              <p>
                {workspace.hostName} ({workspace.hostAddress}:{workspace.port})
              </p>
            </div>
            <button
              disabled={!bridgeReady}
              onClick={async () => {
                setConnectionState("connecting");
                if (!api || !bridgeReady) return;
                const result = await api.joinWorkspace(workspace);
                if (result.ok) setConnectionState("awaiting_approval");
              }}
            >
              Join
            </button>
          </div>
        ))}
        <h3>Client Activity</h3>
        <ul>
          {clientMessages.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </section>

      <section className="panel explorer-panel">
        <h2>Shared Explorer</h2>
        <div className="explorer-grid">
          <div className="explorer-list">
            <h3>Client Files</h3>
            <ul className="file-list">
              {clientFiles.filter((node) => !node.isDirectory).map((node) => (
                <li key={`client-${node.id}`} className={selectedFile === node.relativePath ? "active-row" : ""}>
                  <button
                    disabled={!bridgeReady}
                    onClick={async () => {
                      setSelectedFile(node.relativePath);
                      chunksRef.current[node.relativePath] = [];
                      const pathLower = node.relativePath.toLowerCase();
                      const mime = node.mimeType ?? "";
                      if (pathLower.endsWith(".docx") || mime.includes("wordprocessingml")) {
                        setDocxPreview({ status: "loading" });
                      } else {
                        setDocxPreview(null);
                      }
                      if (!api || !bridgeReady) return;
                      await api.openFile(node.relativePath);
                    }}
                  >
                    Open
                  </button>
                  <span>{node.relativePath}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="explorer-preview">
            <h3>Preview</h3>
            {selectedFile ? <p className="subtle">{selectedFile}</p> : <p className="subtle">Select a file to preview.</p>}
            {isImagePreview && previewUrl ? <img className="preview-image" src={previewUrl} alt="Preview" /> : null}
            {isPdfPreview && previewUrl ? <iframe className="preview-frame" title="PDF Preview" src={previewUrl}></iframe> : null}
            {isVideoPreview && previewUrl ? (
              <video className="preview-video" controls src={previewUrl}>
                <track kind="captions" />
              </video>
            ) : null}
            {isAudioPreview && previewUrl ? <audio className="preview-audio" controls src={previewUrl}></audio> : null}
            {isDocx && docxPreview?.status === "loading" ? (
              <p className="subtle">Rendering Word document…</p>
            ) : null}
            {isDocx && docxPreview?.status === "error" ? (
              <div className="info-card">
                <p>Could not preview this document.</p>
                <p className="subtle">{docxPreview.message}</p>
              </div>
            ) : null}
            {isDocx && docxPreview?.status === "ready" ? (
              <div className="docx-preview" dangerouslySetInnerHTML={{ __html: docxPreview.html }} />
            ) : null}
            {isOtherOfficeDoc && !isDocx ? (
              <div className="info-card">
                <p>Office document detected.</p>
                <p>In-app rendering is limited for this format. The file was received; open it locally on the host if needed.</p>
              </div>
            ) : null}
            {isTextPreview ? (
              <div className="editor-wrap">
                <div className="editor-actions">
                  <button
                    disabled={!bridgeReady || !selectedFile || !isDirty || isSaving}
                    onClick={async () => {
                      if (!api || !selectedFile) return;
                      setIsSaving(true);
                      const response = await api.saveFile({ relativePath: selectedFile, content: editorText });
                      if (!response.ok) {
                        setErrorBanner(response.error ?? "Save failed");
                      }
                      setIsSaving(false);
                    }}
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                  <span className="subtle">{isDirty ? "Unsaved changes" : "Saved"}</span>
                </div>
                <textarea
                  className="editor-textarea"
                  value={editorText}
                  onChange={(event) => {
                    setEditorText(event.target.value);
                    setIsDirty(event.target.value !== previewText);
                  }}
                />
              </div>
            ) : null}
            {!selectedFile ? null : !isTextPreview && !isImagePreview && !isPdfPreview && !isVideoPreview && !isAudioPreview && !isDocx && !isOtherOfficeDoc ? (
              <div className="info-card">Preview not available for this file type yet.</div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
