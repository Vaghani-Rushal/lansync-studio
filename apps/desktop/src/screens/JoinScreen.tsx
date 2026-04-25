import { useMemo, useState } from "react";
import type { DiscoveryWorkspace } from "@pcconnector/shared-types";

type Props = {
  discovered: DiscoveryWorkspace[];
  connectionState: "disconnected" | "connecting" | "awaiting_approval" | "connected" | "rejected";
  joinedWorkspaceName: string;
  joinRejectReason: string | null;
  errorBanner: string | null;
  bridgeReady: boolean;
  onDismissError: () => void;
  onJoinWorkspace: (workspace: DiscoveryWorkspace) => Promise<void>;
  onRetry: () => Promise<void>;
  onCancelJoin: () => void;
  onBack: () => void;
};

export const JoinScreen = ({
  discovered,
  connectionState,
  joinedWorkspaceName,
  joinRejectReason,
  errorBanner,
  bridgeReady,
  onDismissError,
  onJoinWorkspace,
  onRetry,
  onCancelJoin,
  onBack
}: Props) => {
  const [sessionCodeInput, setSessionCodeInput] = useState("");
  const matchedWorkspace = useMemo(
    () =>
      discovered.find(
        (workspace) => (workspace.sessionCode ?? "").toUpperCase() === sessionCodeInput.trim().toUpperCase()
      ) ?? null,
    [discovered, sessionCodeInput]
  );

  const isAwaiting = connectionState === "awaiting_approval";
  const isConnecting = connectionState === "connecting";
  const isRejected = connectionState === "rejected";

  return (
    <section className="screen ui-shell">
      <div className="nav-bar">
        <button className="nav-back" onClick={onBack}>
          ← Back
        </button>
        <div className="nav-crumbs">
          <span>Home</span>
          <span className="nav-crumb-sep">/</span>
          <span className="nav-crumb-current">Join</span>
        </div>
        <div className="nav-spacer" />
        <div className="nav-actions">
          <button
            className="ghost-btn"
            disabled={!bridgeReady || isAwaiting || isConnecting}
            onClick={() => void onRetry()}
          >
            Retry
          </button>
        </div>
      </div>

      {!bridgeReady ? (
        <div className="error-banner">
          <span>Desktop bridge is not available. Launch with Electron.</span>
        </div>
      ) : null}
      {errorBanner ? (
        <div className="error-banner">
          <span>{errorBanner}</span>
          <button onClick={onDismissError}>Dismiss</button>
        </div>
      ) : null}

      {isAwaiting ? (
        <div className="card-surface" style={{ textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>
            <span className="dot dot-yellow" /> Waiting
          </p>
          <h2 style={{ margin: "var(--space-5) 0", fontSize: 18, fontWeight: 510, letterSpacing: "-0.22px" }}>
            Waiting for host approval
          </h2>
          <div className="muted" style={{ maxWidth: 420, margin: "0 auto" }}>
            Your request to join <strong>{joinedWorkspaceName || "workspace"}</strong> has been sent. The host will see
            your name and decide whether to approve.
          </div>
          <button className="ghost-btn" style={{ marginTop: "var(--space-6)" }} onClick={onCancelJoin}>
            Cancel request
          </button>
        </div>
      ) : null}

      {isRejected ? (
        <div className="error-banner">
          <span>Join rejected: {joinRejectReason ?? "Host declined the request"}</span>
        </div>
      ) : null}

      {!isAwaiting ? (
        <>
          <div className="section-row">
            <p className="eyebrow">Enter session code</p>
          </div>
          <div className="code-input-box">
            <input
              value={sessionCodeInput}
              placeholder="TIGER-42"
              disabled={isConnecting}
              maxLength={16}
              onChange={(event) => setSessionCodeInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && matchedWorkspace) {
                  void onJoinWorkspace(matchedWorkspace);
                }
              }}
            />
            <button
              className="primary-btn"
              disabled={!bridgeReady || !matchedWorkspace || isConnecting}
              onClick={() => {
                if (matchedWorkspace) void onJoinWorkspace(matchedWorkspace);
              }}
            >
              {isConnecting ? "Connecting…" : "Join"}
            </button>
          </div>

          <div className="section-row">
            <p className="eyebrow">Nearby hosts · {discovered.length}</p>
            {discovered.length > 0 ? (
              <span className="muted" style={{ fontSize: 12 }}>Click a host to join</span>
            ) : null}
          </div>

          {discovered.length === 0 ? (
            <div className="card-surface muted" style={{ textAlign: "center" }}>
              Scanning the LAN… hosts will appear here automatically.
            </div>
          ) : (
            <div className="action-list">
              {discovered.map((workspace) => (
                <button
                  key={workspace.workspaceId}
                  className="action-row"
                  disabled={isConnecting}
                  onClick={() => void onJoinWorkspace(workspace)}
                >
                  <span className="dot dot-green" />
                  <div className="action-row-body">
                    <div className="action-row-title">{workspace.workspaceName}</div>
                    <div className="action-row-sub">
                      {workspace.hostName} · {workspace.hostAddress}
                      {workspace.sessionCode ? ` · ${workspace.sessionCode}` : ""}
                    </div>
                  </div>
                  <div className="action-row-chevron">→</div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
};
