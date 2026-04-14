type Props = {
  discoveredCount: number;
  onShare: () => void;
  onJoin: () => void;
};

export const HomeScreen = ({ discoveredCount, onShare, onJoin }: Props) => (
  <section className="screen home-screen panel">
    <h1>LAN Share</h1>
    <p className="subtle">Zero-storage LAN collaboration for workspace files.</p>
    <div className="home-actions">
      <button onClick={onShare}>Share a Workspace</button>
      <button onClick={onJoin}>Join a Session</button>
    </div>
    <div className="info-card">
      <strong>Nearby devices:</strong> {discoveredCount}
    </div>
  </section>
);
