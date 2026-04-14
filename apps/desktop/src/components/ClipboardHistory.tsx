import { useEffect, useState } from "react";

type ClipboardItem = {
  historyId: string;
  text?: string;
  image?: string;
  timestamp: number;
};

export function ClipboardHistory({ bridgeReady }: { bridgeReady: boolean }) {
  const [history, setHistory] = useState<ClipboardItem[]>([]);

  useEffect(() => {
    if (!bridgeReady || !window.pcConnectorApi) return;
    
    window.pcConnectorApi.getClipboardHistory().then(setHistory);

    const cleanup = window.pcConnectorApi.onClipboardUpdate((newHistory) => {
      setHistory(newHistory);
    });

    return cleanup;
  }, [bridgeReady]);

  const handleCopy = (historyId: string) => {
    if (!window.pcConnectorApi) return;
    window.pcConnectorApi.writeClipboardItem({ historyId });
  };

  return (
    <div className="clipboard-sidebar">
      <div className="clipboard-header">
        <span>📋 Shared Clipboard</span>
      </div>

      <div className="clipboard-content">
        {history.length === 0 ? (
          <div className="clipboard-empty">
            <p style={{ fontSize: "24px", margin: "0 0 10px 0" }}>📋</p>
            <p style={{ margin: "0 0 10px 0" }}>Clipboard is empty.</p>
            <p style={{ opacity: 0.7 }}>Copy text or images normally. They will sync automatically.</p>
          </div>
        ) : (
          history.map((item) => (
            <div
              key={item.historyId}
              onClick={() => handleCopy(item.historyId)}
              className="clipboard-item"
              title="Click to copy to your clipboard"
            >
              <div className="clipboard-item-meta">
                 <span>{new Date(item.timestamp).toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'})}</span>
                 <span>⎘</span>
              </div>
              {item.image && (
                <div className="clipboard-img-wrap">
                  <img src={item.image} alt="Clipboard item" className="clipboard-img" />
                </div>
              )}
              {item.text && (
                <p className="clipboard-text">
                  {item.text}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
