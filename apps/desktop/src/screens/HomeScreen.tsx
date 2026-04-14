import type { DiscoveryWorkspace } from "@pcconnector/shared-types";

type Props = {
  discovered: DiscoveryWorkspace[];
  isDiscovering: boolean;
  onStartDiscovery: () => Promise<void>;
  onShare: () => void;
  onJoin: () => void;
};

export const HomeScreen = ({ discovered, isDiscovering, onStartDiscovery, onShare, onJoin }: Props) => (
  <section className="screen ui-shell">
    <div className="brand-block card-surface">
      <div className="brand-icon">L</div>
      <div>
        <h1>LAN Share</h1>
        <p className="muted">Real-time · Zero cloud · Pure local</p>
      </div>
    </div>

    <div className="action-grid">
      <button className="action-card" onClick={onShare}>
        <div className="action-title">Share a file</div>
        <div className="muted">Host a file from your disk</div>
      </button>
      <button className="action-card" onClick={onJoin}>
        <div className="action-title">Join a session</div>
        <div className="muted">Enter a share code to connect</div>
      </button>
    </div>

    <div className="section-title">Nearby Devices</div>
    <div className="device-list card-surface">
      {discovered.length === 0 ? <div className="muted">No nearby devices found yet.</div> : null}
      {discovered.map((device) => (
        <div className="device-row" key={device.workspaceId}>
          <div className="dot-live" />
          <div className="device-meta">
            <div className="device-name">{device.hostName}</div>
            <div className="muted">{device.hostAddress}</div>
          </div>
          <div className="status-pill">{device.sessionCode ? "Sharing" : "Online"}</div>
        </div>
      ))}
    </div>

    <div className="footer-chip-row">
      <span className="footer-chip">No internet · No cloud · LAN only</span>
      <button className="footer-chip" disabled={isDiscovering} onClick={() => void onStartDiscovery()}>
        {isDiscovering ? "Scanning..." : `${discovered.length} devices online`}
      </button>
    </div>
  </section>
);
