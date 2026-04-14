import { useMemo, useState } from "react";
import type { DiscoveryWorkspace } from "@pcconnector/shared-types";

type Props = {
  discovered: DiscoveryWorkspace[];
  isDiscovering: boolean;
  connectionState: "disconnected" | "connecting" | "awaiting_approval" | "connected" | "rejected";
  joinedWorkspaceName: string;
  joinRejectReason: string | null;
  errorBanner: string | null;
  bridgeReady: boolean;
  onDismissError: () => void;
  onStartDiscovery: () => Promise<void>;
  onStopDiscovery: () => Promise<void>;
  onJoinWorkspace: (workspace: DiscoveryWorkspace) => Promise<void>;
  onRetry: () => Promise<void>;
  onCancelJoin: () => void;
  onBack: () => void;
};

export const JoinScreen = ({
  discovered,
  isDiscovering,
  connectionState,
  joinedWorkspaceName,
  joinRejectReason,
  errorBanner,
  bridgeReady,
  onDismissError,
  onStartDiscovery,
  onStopDiscovery,
  onJoinWorkspace,
  onRetry,
  onCancelJoin,
  onBack
}: Props) => {
  const discoveredCount = useMemo(() => discovered.length, [discovered.length]);
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
      <div className="top-row bar-row">
        <button className="ghost-btn" onClick={onBack}>
          Back
        </button>
        <h2 className="section-heading">Join a session</h2>
        <button className="ghost-btn" disabled={!bridgeReady || isAwaiting || isConnecting} onClick={onRetry}>
          Retry
        </button>
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
        <div className="step-card card-surface">
          <div className="step-body">
            <div className="section-title">Waiting for host approval…</div>
            <div className="muted">
              Your request to join <strong>{joinedWorkspaceName || "workspace"}</strong> has been sent. The host will see
              your name and decide whether to approve.
            </div>
            <button className="ghost-btn" style={{ marginTop: 12 }} onClick={onCancelJoin}>
              Cancel request
            </button>
          </div>
        </div>
      ) : null}

      {isRejected ? (
        <div className="error-banner">
          <span>Join rejected: {joinRejectReason ?? "Host declined the request"}</span>
        </div>
      ) : null}

      {!isAwaiting ? (
        <>
          <div className="input-row card-surface">
            <input
              value={sessionCodeInput}
              placeholder="e.g. TIGER-42"
              disabled={isConnecting}
              onChange={(event) => setSessionCodeInput(event.target.value)}
            />
            <button
              className="primary-btn"
              disabled={!bridgeReady || !matchedWorkspace || isConnecting}
              onClick={() => {
                if (matchedWorkspace) void onJoinWorkspace(matchedWorkspace);
              }}
            >
              {isConnecting ? "Connecting..." : "Join"}
            </button>
          </div>
          <div className="row-wrap">
            <button disabled={!bridgeReady || isDiscovering} onClick={onStartDiscovery}>
              Start discovery
            </button>
            <button disabled={!bridgeReady || !isDiscovering} onClick={onStopDiscovery}>
              Stop discovery
            </button>
            <span className="status-pill">{connectionState}</span>
          </div>
          <div className="section-title">Nearby hosts detected: {discoveredCount}</div>
        </>
      ) : null}
    </section>
  );
};
