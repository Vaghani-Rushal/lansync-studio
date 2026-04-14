import { useState } from "react";
import type { PendingJoin, Permission } from "@pcconnector/shared-types";

type Props = {
  pendingJoins: PendingJoin[];
  workspaceNameById: Record<string, string>;
  defaultPermissionByWorkspaceId: Record<string, Permission>;
  onApprove: (requestId: string, permission: Permission) => Promise<void>;
  onReject: (requestId: string, reason?: string) => Promise<void>;
};

export const JoinRequestModal = ({
  pendingJoins,
  workspaceNameById,
  defaultPermissionByWorkspaceId,
  onApprove,
  onReject
}: Props) => {
  const current = pendingJoins[0];
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<Permission>(
    current ? defaultPermissionByWorkspaceId[current.workspaceId] ?? "VIEW_ONLY" : "VIEW_ONLY"
  );

  if (!current) return null;
  const workspaceName = workspaceNameById[current.workspaceId] ?? "Unknown workspace";

  const handleApprove = async () => {
    setBusy(true);
    await onApprove(current.requestId, permission);
    setBusy(false);
  };

  const handleReject = async () => {
    setBusy(true);
    await onReject(current.requestId);
    setBusy(false);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card card-surface">
        <div className="section-title">Connection request</div>
        <div className="muted">
          <strong>{current.displayName}</strong> wants to join <strong>{workspaceName}</strong>
        </div>
        <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
          Request received {new Date(current.requestedAt).toLocaleTimeString()}
          {pendingJoins.length > 1 ? ` · ${pendingJoins.length - 1} more waiting` : ""}
        </div>

        <div className="section-title" style={{ marginTop: 16 }}>
          Grant permission
        </div>
        <div className="permission-grid">
          <button
            className={`permission-card ${permission === "VIEW_ONLY" ? "is-active" : ""}`}
            onClick={() => setPermission("VIEW_ONLY")}
            disabled={busy}
          >
            <div>View only</div>
            <div className="muted">Read files, cannot edit</div>
          </button>
          <button
            className={`permission-card ${permission === "VIEW_EDIT" ? "is-active" : ""}`}
            onClick={() => setPermission("VIEW_EDIT")}
            disabled={busy}
          >
            <div>View + Edit</div>
            <div className="muted">Read and modify files</div>
          </button>
        </div>

        <div className="row-wrap" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button className="danger-btn" onClick={handleReject} disabled={busy}>
            Reject
          </button>
          <button className="primary-btn" onClick={handleApprove} disabled={busy}>
            Approve
          </button>
        </div>
      </div>
    </div>
  );
};
