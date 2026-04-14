import type { ConnectedClient, FileTreeNode, PendingJoin } from "@pcconnector/shared-types";

type Props = {
  workspaceName: string;
  sessionCode: string;
  status: string;
  hostFiles: FileTreeNode[];
  pendingJoins: PendingJoin[];
  connectedClients: ConnectedClient[];
  isCreatingWorkspace: boolean;
  bridgeReady: boolean;
  onWorkspaceNameChange: (value: string) => void;
  onCreateWorkspace: () => Promise<void>;
  onStopSession: () => Promise<void>;
  onApproveJoin: (requestId: string) => Promise<void>;
  onRejectJoin: (requestId: string) => Promise<void>;
  onBack: () => void;
};

export const ShareScreen = ({
  workspaceName,
  sessionCode,
  status,
  hostFiles,
  pendingJoins,
  connectedClients,
  isCreatingWorkspace,
  bridgeReady,
  onWorkspaceNameChange,
  onCreateWorkspace,
  onStopSession,
  onApproveJoin,
  onRejectJoin,
  onBack
}: Props) => (
  <section className="screen panel">
    <div className="top-row">
      <h2>Share Flow (Host)</h2>
      <button onClick={onBack}>Back</button>
    </div>
    <ol className="subtle">
      <li>Select workspace and start sharing.</li>
      <li>Wait for join requests and approve clients.</li>
      <li>Share this session code with trusted clients.</li>
    </ol>
    <label>Workspace Name</label>
    <input value={workspaceName} onChange={(event) => onWorkspaceNameChange(event.target.value)} />
    <div className="row-wrap">
      <button disabled={!bridgeReady || isCreatingWorkspace} onClick={onCreateWorkspace}>
        {isCreatingWorkspace ? "Creating..." : "Start Sharing"}
      </button>
      <button disabled={!bridgeReady} onClick={onStopSession}>
        Stop Sharing
      </button>
    </div>
    <p>Status: {status}</p>
    {sessionCode ? (
      <div className="code-box">
        <strong>Session Code</strong>
        <div>{sessionCode}</div>
      </div>
    ) : null}

    <h3>Pending Join Requests</h3>
    {pendingJoins.length === 0 ? <p className="subtle">No pending requests</p> : null}
    {pendingJoins.map((request) => (
      <div className="join-request" key={request.requestId}>
        <span>{request.deviceName}</span>
        <div>
          <button onClick={() => onApproveJoin(request.requestId)}>Approve</button>
          <button onClick={() => onRejectJoin(request.requestId)}>Reject</button>
        </div>
      </div>
    ))}

    <h3>Connected Users</h3>
    {connectedClients.length === 0 ? <p className="subtle">No active clients</p> : null}
    {connectedClients.map((client) => (
      <div className="join-request" key={client.clientId}>
        <span>{client.deviceName}</span>
        <span className="subtle">{new Date(client.connectedAt).toLocaleTimeString()}</span>
      </div>
    ))}

    <h3>Workspace Files</h3>
    <ul className="file-list compact-list">
      {hostFiles.slice(0, 30).map((node) => (
        <li key={node.id}>{node.relativePath}</li>
      ))}
    </ul>
  </section>
);
