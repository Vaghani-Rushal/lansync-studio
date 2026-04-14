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
  const [manualHost, setManualHost] = useState("");
  const [manualPort, setManualPort] = useState("7788");
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
          disabled={!bridgeReady || (!matchedWorkspace && (!manualHost || !manualPort))}
          onClick={() => {
            if (matchedWorkspace) {
              void onJoinWorkspace(matchedWorkspace);
              return;
            }
            void onJoinWorkspace({
              workspaceId: `manual-${manualHost}-${manualPort}`,
              workspaceName: "Manual Session",
              hostName: manualHost,
              hostAddress: manualHost,
              port: Number(manualPort || "7788"),
              sessionCode: sessionCodeInput.trim().toUpperCase(),
              lastSeenAt: Date.now(),
              manualHost,
              manualPort: Number(manualPort || "7788")
            });
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
      <div className="manual-grid card-surface">
        <div className="muted">Manual host fallback</div>
        <input value={manualHost} placeholder="Host IP e.g. 192.168.1.10" onChange={(e) => setManualHost(e.target.value)} />
        <input value={manualPort} placeholder="Port" onChange={(e) => setManualPort(e.target.value)} />
      </div>
      <div className="section-title">Or connect to a nearby device ({discoveredCount})</div>
      {discovered.map((workspace) => (
        <div className="workspace-row card-surface" key={workspace.workspaceId}>
          <div>
            <strong>{workspace.workspaceName}</strong>
            <p>
              {workspace.hostName} ({workspace.hostAddress}:{workspace.port})
            </p>
            {workspace.sessionCode ? <p className="muted">{workspace.sessionCode}</p> : null}
          </div>
          <button className="primary-btn" disabled={!bridgeReady} onClick={() => onJoinWorkspace(workspace)}>
            Join
          </button>
        </div>
      ))}
      <div className="info-panel card-surface">
        <div className="section-title">How it works</div>
        <ol>
          <li>mDNS finds host on LAN</li>
          <li>WebSocket opens direct connection</li>
          <li>Streaming happens in chunks to RAM</li>
          <li>No client disk writes</li>
        </ol>
      </div>
    </section>
  );
};
