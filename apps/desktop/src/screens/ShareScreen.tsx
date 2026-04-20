import { useState } from "react";
import type { HostedWorkspace, PendingJoin, Permission } from "@pcconnector/shared-types";

type Props = {
  hostedWorkspaces: HostedWorkspace[];
  activeHostWorkspaceId: string | null;
  pendingJoins: PendingJoin[];
  newWorkspaceName: string;
  newWorkspacePermission: Permission;
  isCreatingWorkspace: boolean;
  bridgeReady: boolean;
  status: string;
  onNewWorkspaceNameChange: (value: string) => void;
  onNewWorkspacePermissionChange: (permission: Permission) => void;
  onCreateWorkspace: () => Promise<void>;
  onSelectWorkspace: (workspaceId: string) => void;
  onStopWorkspace: (workspaceId: string) => Promise<void>;
  onUpdateClientPermission: (workspaceId: string, clientId: string, permission: Permission) => Promise<void>;
  onKickClient: (workspaceId: string, clientId: string) => Promise<void>;
  onBack: () => void;
};

const initialOf = (name: string) => (name.trim()[0] ?? "?").toUpperCase();

export const ShareScreen = ({
  hostedWorkspaces,
  activeHostWorkspaceId,
  pendingJoins,
  newWorkspaceName,
  newWorkspacePermission,
  isCreatingWorkspace,
  bridgeReady,
  status,
  onNewWorkspaceNameChange,
  onNewWorkspacePermissionChange,
  onCreateWorkspace,
  onSelectWorkspace,
  onStopWorkspace,
  onUpdateClientPermission,
  onKickClient,
  onBack
}: Props) => {
  const hasWorkspaces = hostedWorkspaces.length > 0;
  const active = hostedWorkspaces.find((w) => w.workspaceId === activeHostWorkspaceId) ?? hostedWorkspaces[0] ?? null;
  const pendingCount = pendingJoins.length;
  const pendingForActive = active ? pendingJoins.filter((p) => p.workspaceId === active.workspaceId).length : 0;
  const [copied, setCopied] = useState(false);

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  return (
    <section className="screen ui-shell">
      <div className="nav-bar">
        <button className="nav-back" onClick={onBack}>
          ← Back
        </button>
        <div className="nav-crumbs">
          <span>Home</span>
          <span className="nav-crumb-sep">/</span>
          <span className="nav-crumb-current">Share</span>
        </div>
        <div className="nav-spacer" />
        <div className="nav-actions">
          <span className="status-pill">
            <span className="dot dot-indigo" />
            {hasWorkspaces ? `${hostedWorkspaces.length} active` : "Setup"}
          </span>
        </div>
      </div>

      {pendingCount > 0 ? (
        <div className="pending-banner">
          {pendingCount} join request{pendingCount === 1 ? "" : "s"} awaiting your approval
        </div>
      ) : null}

      {hasWorkspaces ? (
        <>
          <div className="section-row">
            <p className="eyebrow">Workspaces</p>
          </div>
          <div className="workspace-tabs">
            {hostedWorkspaces.map((ws) => {
              const pendingForWs = pendingJoins.filter((p) => p.workspaceId === ws.workspaceId).length;
              const isActive = ws.workspaceId === active?.workspaceId;
              return (
                <button
                  key={ws.workspaceId}
                  className={`ws-tab ${isActive ? "is-active" : ""}`}
                  onClick={() => onSelectWorkspace(ws.workspaceId)}
                >
                  <span className={`dot ${isActive ? "dot-indigo" : "dot-gray"}`} />
                  {ws.workspaceName}
                  {pendingForWs > 0 ? <span className="ws-tab-count">{pendingForWs}</span> : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {/* Start a new workspace */}
      <div className="card-surface">
        <div className="section-row" style={{ margin: 0 }}>
          <p className="eyebrow">Start a new workspace</p>
        </div>
        <div style={{ display: "grid", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
          <div className="input-with-icon">
            <span className="input-icon">◇</span>
            <input
              value={newWorkspaceName}
              placeholder="Workspace name"
              onChange={(event) => onNewWorkspaceNameChange(event.target.value)}
            />
          </div>
          <div className="permission-grid">
            <button
              className={`permission-card ${newWorkspacePermission === "VIEW_ONLY" ? "is-active" : ""}`}
              onClick={() => onNewWorkspacePermissionChange("VIEW_ONLY")}
            >
              <div style={{ fontWeight: 510 }}>View only</div>
              <div className="muted">Default for new joiners</div>
            </button>
            <button
              className={`permission-card ${newWorkspacePermission === "VIEW_EDIT" ? "is-active" : ""}`}
              onClick={() => onNewWorkspacePermissionChange("VIEW_EDIT")}
            >
              <div style={{ fontWeight: 510 }}>View + Edit</div>
              <div className="muted">Default for new joiners</div>
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
            <button
              className="primary-btn"
              disabled={!bridgeReady || isCreatingWorkspace || newWorkspaceName.trim().length === 0}
              onClick={() => onCreateWorkspace()}
            >
              {isCreatingWorkspace ? "Starting…" : "Pick file or folder"}
            </button>
            {status ? <div className="muted">{status}</div> : null}
          </div>
        </div>
      </div>

      {active ? (
        <>
          <div className="section-row">
            <p className="eyebrow">
              <span className="dot dot-green" /> Live · {active.workspaceName}
            </p>
            <button className="danger-btn" disabled={!bridgeReady} onClick={() => onStopWorkspace(active.workspaceId)}>
              Stop sharing
            </button>
          </div>

          <div className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
            {active.rootPath}
          </div>

          <div className="session-code-card">
            <p className="eyebrow">Session code</p>
            <div className="session-code-display">{active.sessionCode}</div>
            <div className="session-code-actions">
              <button
                className={`copy-btn ${copied ? "is-copied" : ""}`}
                onClick={() => void handleCopy(active.sessionCode)}
              >
                {copied ? "✓ Copied" : "Copy code"}
              </button>
            </div>
            <div className="muted">Share this code with people on your network</div>
          </div>

          {pendingForActive > 0 ? (
            <div className="pending-banner">
              {pendingForActive} pending request{pendingForActive === 1 ? "" : "s"} — review in the popup.
            </div>
          ) : null}

          <div className="section-row">
            <p className="eyebrow">Connected users · {active.clients.length}</p>
          </div>

          {active.clients.length === 0 ? (
            <div className="muted">No users connected yet</div>
          ) : (
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              {active.clients.map((client) => (
                <div className="client-row" key={client.clientId}>
                  <div className="avatar">{initialOf(client.displayName)}</div>
                  <div className="client-body">
                    <div className="client-name">{client.displayName}</div>
                    <div className="client-meta">
                      Connected {new Date(client.connectedAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <select
                    className="permission-select"
                    value={client.permission}
                    onChange={(event) =>
                      void onUpdateClientPermission(
                        active.workspaceId,
                        client.clientId,
                        event.target.value as Permission
                      )
                    }
                  >
                    <option value="VIEW_ONLY">View only</option>
                    <option value="VIEW_EDIT">View + Edit</option>
                  </select>
                  <button
                    className="danger-btn"
                    onClick={() => {
                      if (confirm(`Remove ${client.displayName}?`)) {
                        void onKickClient(active.workspaceId, client.clientId);
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="section-row">
            <p className="eyebrow">Transport</p>
          </div>
          <div className="transport-card card-surface">
            <div className="muted">Protocol</div>
            <div>WebSocket · :7788</div>
            <div className="muted">Discovery</div>
            <div>mDNS / Bonjour</div>
            <div className="muted">Client storage</div>
            <div className="ok-text">RAM only · 0 disk writes</div>
          </div>
        </>
      ) : null}
    </section>
  );
};
