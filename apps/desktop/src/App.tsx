import { useEffect, useMemo, useState } from "react";
import type { DiscoveryWorkspace, FileTreeNode, Permission } from "@pcconnector/shared-types";
import "./App.css";
import { useLanShareBridge } from "./hooks/useLanShareBridge";
import { HomeScreen } from "./screens/HomeScreen";
import { JoinScreen } from "./screens/JoinScreen";
import { ShareScreen } from "./screens/ShareScreen";
import { ViewerScreen } from "./screens/ViewerScreen";
import { NameSetupScreen } from "./screens/NameSetupScreen";
import { JoinRequestModal } from "./components/JoinRequestModal";
import { useLanShareStore } from "./state/lanShareStore";

function App() {
  const { api, bridgeReady, applyEditorChange, clearClientRamState } = useLanShareBridge();

  // Selectors
  const identity = useLanShareStore((s) => s.identity);
  const isIdentityLoaded = useLanShareStore((s) => s.isIdentityLoaded);
  const currentScreen = useLanShareStore((s) => s.currentScreen);
  const status = useLanShareStore((s) => s.status);

  const hostedWorkspaces = useLanShareStore((s) => s.hostedWorkspaces);
  const activeHostWorkspaceId = useLanShareStore((s) => s.activeHostWorkspaceId);
  const pendingJoins = useLanShareStore((s) => s.pendingJoins);
  const newWorkspaceName = useLanShareStore((s) => s.newWorkspaceName);
  const newWorkspacePermission = useLanShareStore((s) => s.newWorkspacePermission);
  const isCreatingWorkspace = useLanShareStore((s) => s.isCreatingWorkspace);

  const clientFiles = useLanShareStore((s) => s.clientFiles);
  const discovered = useLanShareStore((s) => s.discovered);
  const connectionState = useLanShareStore((s) => s.connectionState);
  const joinedWorkspaceName = useLanShareStore((s) => s.joinedWorkspaceName);
  const joinRejectReason = useLanShareStore((s) => s.joinRejectReason);
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
  const isDiscovering = useLanShareStore((s) => s.isDiscovering);
  const streamState = useLanShareStore((s) => s.streamState);
  const streamMeta = useLanShareStore((s) => s.streamMeta);
  const editorReadOnly = useLanShareStore((s) => s.editorReadOnly);

  // Actions
  const setIdentity = useLanShareStore((s) => s.setIdentity);
  const setIdentityLoaded = useLanShareStore((s) => s.setIdentityLoaded);
  const setScreen = useLanShareStore((s) => s.setScreen);
  const setStatus = useLanShareStore((s) => s.setStatus);
  const setActiveHostWorkspaceId = useLanShareStore((s) => s.setActiveHostWorkspaceId);
  const setNewWorkspaceName = useLanShareStore((s) => s.setNewWorkspaceName);
  const setNewWorkspacePermission = useLanShareStore((s) => s.setNewWorkspacePermission);
  const setIsCreatingWorkspace = useLanShareStore((s) => s.setIsCreatingWorkspace);
  const setConnectionState = useLanShareStore((s) => s.setConnectionState);
  const setJoinRejectReason = useLanShareStore((s) => s.setJoinRejectReason);
  const setErrorBanner = useLanShareStore((s) => s.setErrorBanner);
  const setSelectedFile = useLanShareStore((s) => s.setSelectedFile);
  const setDocxPreview = useLanShareStore((s) => s.setDocxPreview);
  const setIsSaving = useLanShareStore((s) => s.setIsSaving);
  const setIsDiscovering = useLanShareStore((s) => s.setIsDiscovering);
  const setStreamMeta = useLanShareStore((s) => s.setStreamMeta);
  const setStreamState = useLanShareStore((s) => s.setStreamState);
  const setHostedWorkspaces = useLanShareStore((s) => s.setHostedWorkspaces);

  const [showEditName, setShowEditName] = useState(false);

  // Load identity on first mount
  useEffect(() => {
    if (!api || isIdentityLoaded) return;
    void (async () => {
      const res = await api.getIdentity();
      setIdentity(res.identity ?? null);
      setIdentityLoaded(true);
      if (res.identity) {
        setScreen("home");
      } else {
        setScreen("identity");
      }
    })();
  }, [api, isIdentityLoaded, setIdentity, setIdentityLoaded, setScreen]);

  // When navigating to home, ensure discovery is running
  const ensureDiscoveryRunning = async () => {
    if (!api || !bridgeReady || isDiscovering) return;
    await api.startDiscovery();
    setIsDiscovering(true);
  };

  useEffect(() => {
    if (currentScreen === "home") {
      void ensureDiscoveryRunning();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScreen]);

  // Refresh hosted workspaces snapshot on entering share screen
  useEffect(() => {
    if (!api || currentScreen !== "share") return;
    void api.listHostedWorkspaces().then(setHostedWorkspaces);
  }, [api, currentScreen, setHostedWorkspaces]);

  // --- Identity handlers ---
  const handleSaveIdentity = async (displayName: string) => {
    if (!api) return { ok: false, error: "Bridge not ready" };
    const res = await api.setIdentity({ displayName });
    if (res.ok && res.identity) {
      setIdentity(res.identity);
      setShowEditName(false);
      if (currentScreen === "identity") setScreen("home");
    }
    return { ok: res.ok, error: res.error };
  };

  // --- Host handlers ---
  const handleCreateWorkspace = async () => {
    if (!api || !bridgeReady) return;
    setIsCreatingWorkspace(true);
    const response = await api.createWorkspace({
      workspaceName: newWorkspaceName,
      defaultPermission: newWorkspacePermission
    });
    if (response.ok) {
      setStatus(`Sharing ${response.workspace.workspaceName}`);
      setActiveHostWorkspaceId(response.workspace.workspaceId);
      // Refresh hosted workspaces list
      const list = await api.listHostedWorkspaces();
      setHostedWorkspaces(list);
    } else if (!("cancelled" in response && response.cancelled)) {
      const errMsg = typeof response.error === "string" ? response.error : "Failed to create workspace";
      setErrorBanner(errMsg);
      setStatus("Failed to create workspace");
    }
    setIsCreatingWorkspace(false);
  };

  const handleStopWorkspace = async (workspaceId: string) => {
    if (!api) return;
    await api.stopWorkspace({ workspaceId });
    const list = await api.listHostedWorkspaces();
    setHostedWorkspaces(list);
  };

  const handleUpdateClientPermission = async (workspaceId: string, clientId: string, permission: Permission) => {
    if (!api) return;
    const res = await api.updateClientPermission({ workspaceId, clientId, permission });
    if (!res.ok) setErrorBanner(res.error ?? "Failed to update permission");
  };

  const handleKickClient = async (workspaceId: string, clientId: string) => {
    if (!api) return;
    const res = await api.kickClient({ workspaceId, clientId });
    if (!res.ok) setErrorBanner(res.error ?? "Failed to remove user");
  };

  // --- Pending join approval handlers ---
  const handleApproveJoin = async (requestId: string, permission: Permission) => {
    if (!api) return;
    const res = await api.approveJoin({ requestId, permission });
    if (!res.ok) setErrorBanner(res.error ?? "Failed to approve");
  };

  const handleRejectJoin = async (requestId: string, reason?: string) => {
    if (!api) return;
    const res = await api.rejectJoin({ requestId, reason });
    if (!res.ok) setErrorBanner(res.error ?? "Failed to reject");
  };

  // --- Client-role handlers ---
  const handleJoinWorkspace = async (workspace: DiscoveryWorkspace) => {
    if (!api || !bridgeReady) return;
    if (!identity) {
      setErrorBanner("Please set your display name before joining");
      return;
    }
    setConnectionState("connecting");
    setJoinRejectReason(null);
    const result = await api.joinWorkspace(workspace);
    if (result.ok) {
      setConnectionState("connected");
      setScreen("viewer");
      return;
    }
    if (result.status === "rejected") {
      setConnectionState("rejected");
      setJoinRejectReason(result.reason ?? "Host rejected the request");
      return;
    }
    setErrorBanner(result.error ?? "Join request failed.");
    setConnectionState("disconnected");
  };

  const handleCancelJoin = async () => {
    if (!api) return;
    await api.disconnectClient();
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
    clearClientRamState();
    setScreen("join");
  };

  // --- Derived data for modal ---
  const workspaceNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const ws of hostedWorkspaces) map[ws.workspaceId] = ws.workspaceName;
    return map;
  }, [hostedWorkspaces]);

  const defaultPermissionByWorkspaceId = useMemo(() => {
    const map: Record<string, Permission> = {};
    for (const ws of hostedWorkspaces) map[ws.workspaceId] = ws.defaultPermission;
    return map;
  }, [hostedWorkspaces]);

  // --- Rendering ---
  if (!isIdentityLoaded) {
    return (
      <main className="layout professional">
        <header className="topbar">
          <h1>PC Connector</h1>
        </header>
        <section className="screen ui-shell">
          <div className="muted">Loading…</div>
        </section>
      </main>
    );
  }

  if (currentScreen === "identity" || showEditName) {
    return (
      <main className="layout professional">
        <header className="topbar">
          <h1>PC Connector</h1>
        </header>
        <NameSetupScreen
          initialName={identity?.displayName ?? ""}
          title={identity ? "Change your display name" : "What should we call you?"}
          submitLabel={identity ? "Save" : "Continue"}
          onSubmit={handleSaveIdentity}
          onCancel={showEditName ? () => setShowEditName(false) : undefined}
        />
      </main>
    );
  }

  return (
    <main className="layout professional">
      <header className="topbar">
        <h1>PC Connector Workspace</h1>
        <span className="pill">{status}</span>
      </header>

      {currentScreen === "home" ? (
        <HomeScreen
          identity={identity}
          discovered={discovered}
          isDiscovering={isDiscovering}
          onStartDiscovery={ensureDiscoveryRunning}
          onShare={() => setScreen("share")}
          onJoin={() => setScreen("join")}
          onEditName={() => setShowEditName(true)}
        />
      ) : null}

      {currentScreen === "share" ? (
        <ShareScreen
          hostedWorkspaces={hostedWorkspaces}
          activeHostWorkspaceId={activeHostWorkspaceId}
          pendingJoins={pendingJoins}
          newWorkspaceName={newWorkspaceName}
          newWorkspacePermission={newWorkspacePermission}
          isCreatingWorkspace={isCreatingWorkspace}
          bridgeReady={bridgeReady}
          status={status}
          onNewWorkspaceNameChange={setNewWorkspaceName}
          onNewWorkspacePermissionChange={setNewWorkspacePermission}
          onCreateWorkspace={handleCreateWorkspace}
          onSelectWorkspace={setActiveHostWorkspaceId}
          onStopWorkspace={handleStopWorkspace}
          onUpdateClientPermission={handleUpdateClientPermission}
          onKickClient={handleKickClient}
          onBack={() => setScreen("home")}
        />
      ) : null}

      {currentScreen === "join" ? (
        <JoinScreen
          discovered={discovered}
          isDiscovering={isDiscovering}
          connectionState={connectionState}
          joinedWorkspaceName={joinedWorkspaceName}
          joinRejectReason={joinRejectReason}
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
          onCancelJoin={handleCancelJoin}
          onRetry={async () => {
            if (!api || !bridgeReady) return;
            const response = await api.reconnectClient();
            if (response.ok) {
              setConnectionState("connected");
              setScreen("viewer");
            } else if (response.status === "rejected") {
              setConnectionState("rejected");
              setJoinRejectReason(response.reason ?? "Host rejected the request");
            }
          }}
          onBack={() => {
            setConnectionState("disconnected");
            setScreen("home");
          }}
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
          onEditorChange={(value) => applyEditorChange(value)}
          onSave={handleSave}
        />
      ) : null}

      {/* Host-side popup for join approvals */}
      {pendingJoins.length > 0 && hostedWorkspaces.length > 0 ? (
        <JoinRequestModal
          key={pendingJoins[0].requestId}
          pendingJoins={pendingJoins}
          workspaceNameById={workspaceNameById}
          defaultPermissionByWorkspaceId={defaultPermissionByWorkspaceId}
          onApprove={handleApproveJoin}
          onReject={handleRejectJoin}
        />
      ) : null}
    </main>
  );
}

export default App;
