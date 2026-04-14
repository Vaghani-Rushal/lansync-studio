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

  return (
    <section className="screen ui-shell">
      <div className="top-row bar-row">
        <button className="ghost-btn" onClick={onBack}>
          Back
        </button>
        <h2 className="section-heading">{hasWorkspaces ? "Hosting workspaces" : "Share a file or folder"}</h2>
        <span className="status-pill">
          {hasWorkspaces ? `${hostedWorkspaces.length} active` : "Setup"}
        </span>
      </div>

      {pendingCount > 0 ? (
        <div className="pending-banner">
          {pendingCount} join request{pendingCount === 1 ? "" : "s"} awaiting your approval
        </div>
      ) : null}

      {hasWorkspaces ? (
        <div className="workspace-tabs">
          {hostedWorkspaces.map((ws) => {
            const pendingForWs = pendingJoins.filter((p) => p.workspaceId === ws.workspaceId).length;
            return (
              <button
                key={ws.workspaceId}
                className={`workspace-tab ${ws.workspaceId === active?.workspaceId ? "is-active" : ""}`}
                onClick={() => onSelectWorkspace(ws.workspaceId)}
              >
                {ws.workspaceName} · {ws.sessionCode}
                {pendingForWs > 0 ? ` · ${pendingForWs}⚠` : ""}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* New workspace setup card (always available) */}
      <div className="step-card card-surface">
        <div className="step-index">+</div>
        <div className="step-body">
          <div className="section-title">Start a new workspace</div>
          <input
            value={newWorkspaceName}
            placeholder="Workspace name"
            onChange={(event) => onNewWorkspaceNameChange(event.target.value)}
          />
          <div className="permission-grid" style={{ marginTop: 8 }}>
            <button
              className={`permission-card ${newWorkspacePermission === "VIEW_ONLY" ? "is-active" : ""}`}
              onClick={() => onNewWorkspacePermissionChange("VIEW_ONLY")}
            >
              <div>Default: View only</div>
              <div className="muted">Default for new joiners</div>
            </button>
            <button
              className={`permission-card ${newWorkspacePermission === "VIEW_EDIT" ? "is-active" : ""}`}
              onClick={() => onNewWorkspacePermissionChange("VIEW_EDIT")}
            >
              <div>Default: View + Edit</div>
              <div className="muted">Default for new joiners</div>
            </button>
          </div>
          <button
            className="primary-btn"
            style={{ marginTop: 12 }}
            disabled={!bridgeReady || isCreatingWorkspace || newWorkspaceName.trim().length === 0}
            onClick={onCreateWorkspace}
          >
            {isCreatingWorkspace ? "Starting..." : "Pick folder & start sharing"}
          </button>
          <div className="muted">{status}</div>
        </div>
      </div>

      {active ? (
        <>
          <div className="host-top-row">
            <span className="live-pill">LIVE</span>
            <div className="muted" style={{ flex: 1, marginLeft: 12 }}>
              {active.rootPath}
            </div>
            <button className="danger-btn" disabled={!bridgeReady} onClick={() => onStopWorkspace(active.workspaceId)}>
              Stop this workspace
            </button>
          </div>

          <div className="code-card card-surface">
            <div className="section-title">{active.workspaceName}</div>
            <div className="code-display">{active.sessionCode}</div>
            <div className="muted">Share this code with people on your network</div>
          </div>

          {pendingForActive > 0 ? (
            <div className="pending-banner">
              {pendingForActive} pending request{pendingForActive === 1 ? "" : "s"} for this workspace — review in the popup.
            </div>
          ) : null}

          <div className="section-title">Connected users ({active.clients.length})</div>
          {active.clients.length === 0 ? <div className="muted">No users connected to this workspace yet</div> : null}
          {active.clients.map((client) => (
            <div className="user-card with-controls card-surface" key={client.clientId}>
              <div>
                <strong>{client.displayName}</strong>
                <div className="muted">Connected {new Date(client.connectedAt).toLocaleTimeString()}</div>
              </div>
              <div className="user-card-controls">
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
            </div>
          ))}

          <div className="transport-card card-surface">
            <div className="muted">Transport</div>
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
