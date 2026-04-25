import type { DiscoveryWorkspace, UserIdentity } from "@pcconnector/shared-types";

type Props = {
  identity: UserIdentity | null;
  discovered: DiscoveryWorkspace[];
  isDiscovering: boolean;
  onStartDiscovery: () => Promise<void>;
  onShare: () => void;
  onJoin: () => void;
  onEditName: () => void;
};

export const HomeScreen = ({
  identity,
  discovered,
  isDiscovering,
  onStartDiscovery,
  onShare,
  onJoin,
  onEditName
}: Props) => (
  <section className="screen ui-shell">
    <div className="brand-block">
      <div className="brand-icon">L</div>
      <div style={{ flex: 1 }}>
        <h1>LAN Share</h1>
        <p className="muted">Real-time · Zero cloud · Pure local</p>
      </div>
      <button className="identity-chip" onClick={onEditName} title="Change your display name">
        <span className="dot dot-indigo" />
        {identity ? identity.displayName : "Set name"}
      </button>
    </div>

    <div className="section-row">
      <p className="eyebrow">Quick actions</p>
    </div>

    <div className="action-list">
      <button className="action-row" onClick={onShare}>
        <div className="action-row-icon">↑</div>
        <div className="action-row-body">
          <div className="action-row-title">Share a workspace</div>
          <div className="action-row-sub">Host one or more folders for teammates on the LAN</div>
        </div>
        <div className="action-row-chevron">→</div>
      </button>
      <button className="action-row" onClick={onJoin}>
        <div className="action-row-icon">↓</div>
        <div className="action-row-body">
          <div className="action-row-title">Join a session</div>
          <div className="action-row-sub">Enter a session code or pick a discovered host</div>
        </div>
        <div className="action-row-chevron">→</div>
      </button>
    </div>

    <div className="section-row">
      <p className="eyebrow">Nearby devices</p>
      <button
        className="arrow-link"
        disabled={isDiscovering}
        onClick={() => void onStartDiscovery()}
        style={{ fontSize: 12 }}
      >
        {isDiscovering ? "Scanning" : "Rescan"}
      </button>
    </div>

    <div className="device-list card-surface">
      {discovered.length === 0 ? (
        <div className="muted" style={{ padding: "var(--space-5) var(--space-5)" }}>
          No nearby devices yet. Start sharing on another machine to see it here.
        </div>
      ) : null}
      {discovered.map((device) => (
        <div className="device-row" key={device.workspaceId}>
          <span className={`dot ${device.sessionCode ? "dot-green" : "dot-gray"}`} />
          <div className="device-meta">
            <div className="device-name">{device.hostName}</div>
            <div className="muted">
              {device.workspaceName} · {device.hostAddress}
            </div>
          </div>
          <div className="status-pill">{device.sessionCode ? "Sharing" : "Online"}</div>
        </div>
      ))}
    </div>

    <div className="footer-chip-row">
      <span className="status-pill">
        <span className="dot dot-green" /> No internet · No cloud · LAN only
      </span>
      <span className="status-pill">
        {discovered.length} {discovered.length === 1 ? "device" : "devices"} online
      </span>
    </div>
  </section>
);
