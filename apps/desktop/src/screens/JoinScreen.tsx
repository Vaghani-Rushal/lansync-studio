import { useMemo } from "react";
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
  return (
    <section className="screen panel">
      <div className="top-row">
        <h2>Join Flow (Client)</h2>
        <button onClick={onBack}>Back</button>
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
      <div className="row-wrap">
        <button disabled={!bridgeReady || isDiscovering} onClick={onStartDiscovery}>
          Start Discovery
        </button>
        <button disabled={!bridgeReady || !isDiscovering} onClick={onStopDiscovery}>
          Stop Discovery
        </button>
        <button disabled={!bridgeReady} onClick={onRetry}>
          Retry
        </button>
      </div>
      <p>Connection: {connectionState}</p>
      <p>Discovered Hosts: {discoveredCount}</p>
      {discovered.map((workspace) => (
        <div className="workspace-row" key={workspace.workspaceId}>
          <div>
            <strong>{workspace.workspaceName}</strong>
            <p>
              {workspace.hostName} ({workspace.hostAddress}:{workspace.port})
            </p>
            {workspace.sessionCode ? <p className="subtle">Code: {workspace.sessionCode}</p> : null}
          </div>
          <button disabled={!bridgeReady} onClick={() => onJoinWorkspace(workspace)}>
            Join
          </button>
        </div>
      ))}
    </section>
  );
};
