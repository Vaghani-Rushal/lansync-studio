import type { ConnectedClient, FileTreeNode } from "@pcconnector/shared-types";

type Props = {
  workspaceName: string;
  sessionCode: string;
  status: string;
  hostFiles: FileTreeNode[];
  connectedClients: ConnectedClient[];
  isCreatingWorkspace: boolean;
  sharePermission: "VIEW_ONLY" | "VIEW_EDIT";
  bridgeReady: boolean;
  onWorkspaceNameChange: (value: string) => void;
  onCreateWorkspace: () => Promise<void>;
  onSharePermissionChange: (permission: "VIEW_ONLY" | "VIEW_EDIT") => void;
  onStopSession: () => Promise<void>;
  onBack: () => void;
};

export const ShareScreen = ({
  workspaceName,
  sessionCode,
  status,
  hostFiles,
  connectedClients,
  isCreatingWorkspace,
  sharePermission,
  bridgeReady,
  onWorkspaceNameChange,
  onCreateWorkspace,
  onSharePermissionChange,
  onStopSession,
  onBack
}: Props) => {
  const isHosting = Boolean(sessionCode);
  return (
    <section className="screen ui-shell">
      <div className="top-row bar-row">
        <button className="ghost-btn" onClick={onBack}>
          Back
        </button>
        <h2 className="section-heading">{isHosting ? "Hosting session" : "Share a file or folder"}</h2>
        <span className="status-pill">{isHosting ? "Hosting" : "Setup"}</span>
      </div>

      {!isHosting ? (
        <div className="setup-steps">
          <div className="step-card card-surface">
            <div className="step-index">1</div>
            <div className="step-body">
              <div className="section-title">Select file or folder</div>
              <input value={workspaceName} onChange={(event) => onWorkspaceNameChange(event.target.value)} />
              <div className="muted">Choose the workspace folder to share on LAN.</div>
            </div>
          </div>

          <div className="step-card card-surface">
            <div className="step-index">2</div>
            <div className="step-body">
              <div className="section-title">Set permission</div>
              <div className="permission-grid">
                <button
                  className={`permission-card ${sharePermission === "VIEW_ONLY" ? "is-active" : ""}`}
                  onClick={() => onSharePermissionChange("VIEW_ONLY")}
                >
                  <div>View only</div>
                  <div className="muted">Read-only access</div>
                </button>
                <button
                  className={`permission-card ${sharePermission === "VIEW_EDIT" ? "is-active" : ""}`}
                  onClick={() => onSharePermissionChange("VIEW_EDIT")}
                >
                  <div>View + Edit</div>
                  <div className="muted">Collaborative editing</div>
                </button>
              </div>
            </div>
          </div>

          <div className="step-card card-surface">
            <div className="step-index">3</div>
            <div className="step-body">
              <div className="section-title">Start sharing</div>
              <button className="primary-btn" disabled={!bridgeReady || isCreatingWorkspace} onClick={onCreateWorkspace}>
                {isCreatingWorkspace ? "Starting..." : "Start sharing"}
              </button>
              <div className="muted">{status}</div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="host-top-row">
            <span className="live-pill">LIVE</span>
            <button className="danger-btn" disabled={!bridgeReady} onClick={onStopSession}>
              Stop sharing
            </button>
          </div>
          <div className="code-card card-surface">
            <div className="section-title">Share code</div>
            <div className="code-display">{sessionCode}</div>
            <div className="muted">Share this code with people on your network</div>
          </div>

          <div className="host-file-card card-surface">
            <div className="section-title">Active workspace</div>
            <div className="muted">{workspaceName}</div>
            <ul className="file-list compact-list">
              {hostFiles.slice(0, 8).map((node) => (
                <li key={node.id}>{node.relativePath}</li>
              ))}
            </ul>
          </div>

          <div className="section-title">Connected users ({connectedClients.length})</div>
          {connectedClients.length === 0 ? <div className="muted">No active clients</div> : null}
          {connectedClients.map((client) => (
            <div className="user-card card-surface" key={client.clientId}>
              <div>
                <strong>{client.deviceName}</strong>
                <div className="muted">{new Date(client.connectedAt).toLocaleTimeString()}</div>
              </div>
              <span className={`status-pill ${client.capabilities.includes("write") ? "ok" : ""}`}>
                {client.capabilities.includes("write") ? "Editing" : "Viewing"}
              </span>
            </div>
          ))}

          <div className="transport-card card-surface">
            <div className="muted">Transport</div>
            <div>WebSocket · :7777</div>
            <div className="muted">Discovery</div>
            <div>mDNS / Bonjour</div>
            <div className="muted">Client storage</div>
            <div className="ok-text">RAM only · 0 disk writes</div>
          </div>
        </>
      )}
    </section>
  );
};
