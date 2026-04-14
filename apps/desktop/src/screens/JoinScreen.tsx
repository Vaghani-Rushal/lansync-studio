import { useMemo, useState } from "react";
import type { DiscoveryWorkspace } from "@pcconnector/shared-types";

type Props = {
  discovered: DiscoveryWorkspace[];
  isDiscovering: boolean;
  connectionState: string;
  errorBanner: string | null;
  bridgeReady: boolean;
  onDismissError: () => void;
  onStartDiscovery: () => Promise<void>;
  onStopDiscovery: () => Promise<void>;
  onJoinWorkspace: (workspace: DiscoveryWorkspace) => Promise<void>;
  onRetry: () => Promise<void>;
  onBack: () => void;
};

export const JoinScreen = ({
  discovered,
  isDiscovering,
  connectionState,
  errorBanner,
  bridgeReady,
  onDismissError,
  onStartDiscovery,
  onStopDiscovery,
  onJoinWorkspace,
  onRetry,
  onBack
}: Props) => {
  const discoveredCount = useMemo(() => discovered.length, [discovered.length]);
  const [sessionCodeInput, setSessionCodeInput] = useState("");
  const matchedWorkspace = useMemo(
    () => discovered.find((workspace) => (workspace.sessionCode ?? "").toUpperCase() === sessionCodeInput.trim().toUpperCase()) ?? null,
    [discovered, sessionCodeInput]
  );
  return (
    <section className="screen ui-shell">
      <div className="top-row bar-row">
        <button className="ghost-btn" onClick={onBack}>
          Back
        </button>
        <h2 className="section-heading">Join a session</h2>
        <button className="ghost-btn" disabled={!bridgeReady} onClick={onRetry}>
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
      <div className="input-row card-surface">
        <input
          value={sessionCodeInput}
          placeholder="e.g. TIGER-42"
          onChange={(event) => setSessionCodeInput(event.target.value)}
        />
        <button
          className="primary-btn"
          disabled={!bridgeReady || !matchedWorkspace}
          onClick={() => {
            if (matchedWorkspace) void onJoinWorkspace(matchedWorkspace);
          }}
        >
          Join
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
    </section>
  );
};
