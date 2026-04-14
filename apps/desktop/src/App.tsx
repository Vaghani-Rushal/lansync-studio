import { useEffect } from "react";
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
  const { api, bridgeReady, applyEditorChange } = useLanShareBridge();
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
  const previewBuffer = useLanShareStore((s) => s.previewBuffer);
  const docxPreview = useLanShareStore((s) => s.docxPreview);
  const isCreatingWorkspace = useLanShareStore((s) => s.isCreatingWorkspace);
  const isDiscovering = useLanShareStore((s) => s.isDiscovering);
  const streamState = useLanShareStore((s) => s.streamState);
  const streamMeta = useLanShareStore((s) => s.streamMeta);
  const sharePermission = useLanShareStore((s) => s.sharePermission);
  const editorReadOnly = useLanShareStore((s) => s.editorReadOnly);

  const setScreen = useLanShareStore((s) => s.setScreen);
  const setWorkspaceName = useLanShareStore((s) => s.setWorkspaceName);
  const setSessionCode = useLanShareStore((s) => s.setSessionCode);
  const setStatus = useLanShareStore((s) => s.setStatus);
  const setHostFiles = useLanShareStore((s) => s.setHostFiles);
  const setClientFiles = useLanShareStore((s) => s.setClientFiles);
  const setPendingJoins = useLanShareStore((s) => s.setPendingJoins);
  const setConnectedClients = useLanShareStore((s) => s.setConnectedClients);
  const setConnectionState = useLanShareStore((s) => s.setConnectionState);
  const setErrorBanner = useLanShareStore((s) => s.setErrorBanner);
  const setSelectedFile = useLanShareStore((s) => s.setSelectedFile);
  const setDocxPreview = useLanShareStore((s) => s.setDocxPreview);
  const setIsSaving = useLanShareStore((s) => s.setIsSaving);
  const setIsDiscovering = useLanShareStore((s) => s.setIsDiscovering);
  const setIsCreatingWorkspace = useLanShareStore((s) => s.setIsCreatingWorkspace);
  const setSharePermission = useLanShareStore((s) => s.setSharePermission);
  const resetPreviewState = useLanShareStore((s) => s.resetPreviewState);
  const setStreamMeta = useLanShareStore((s) => s.setStreamMeta);
  const setStreamState = useLanShareStore((s) => s.setStreamState);

  const handleCreateWorkspace = async () => {
    if (!api || !bridgeReady) return;
    setIsCreatingWorkspace(true);
    const response = await api.createWorkspace({ workspaceName, port: 7788, permission: sharePermission });
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
    setPendingJoins([]);
    setConnectedClients([]);
    setClientFiles([]);
    setConnectionState("disconnected");
    setSessionCode("");
    resetPreviewState();
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
    setClientFiles([]);
    setConnectedClients([]);
    setPendingJoins([]);
    resetPreviewState();
    setScreen("join");
  };

  const ensureDiscoveryRunning = async () => {
    if (!api || !bridgeReady || isDiscovering) return;
    await api.startDiscovery();
    setIsDiscovering(true);
  };

  useEffect(() => {
    if (currentScreen === "home") {
      void ensureDiscoveryRunning();
    }
  }, [currentScreen]);

  return (
    <main className="layout professional">
      <header className="topbar">
        <h1>PC Connector Workspace</h1>
        <span className="pill">{status}</span>
      </header>

      {currentScreen === "home" ? (
        <HomeScreen
          discovered={discovered}
          isDiscovering={isDiscovering}
          onStartDiscovery={ensureDiscoveryRunning}
          onShare={() => setScreen("share")}
          onJoin={() => setScreen("join")}
        />
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
          sharePermission={sharePermission}
          bridgeReady={bridgeReady}
          onWorkspaceNameChange={setWorkspaceName}
          onCreateWorkspace={handleCreateWorkspace}
          onSharePermissionChange={setSharePermission}
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
            await ensureDiscoveryRunning();
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
          previewBuffer={previewBuffer}
          previewText={previewText}
          editorText={editorText}
          isDirty={isDirty}
          isSaving={isSaving}
          docxPreview={docxPreview}
          bridgeReady={bridgeReady}
          streamState={streamState}
          streamMeta={streamMeta}
          editorReadOnly={editorReadOnly}
          errorBanner={errorBanner}
          onDismissError={() => setErrorBanner(null)}
          onBack={() => setScreen("join")}
          onDisconnect={handleDisconnect}
          onOpenFile={handleOpenFile}
          onEditorChange={(value) => {
            applyEditorChange(value);
          }}
          onSave={handleSave}
        />
      ) : null}
    </main>
  );
}

export default App;
