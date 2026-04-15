import { useEffect, useState } from "react";

type ClipboardItem = {
  historyId: string;
  text?: string;
  image?: string;
  timestamp: number;
};

type Toast = { id: string; message: string; type: "copied" | "pasted" };

// Detect Mac so we show the right shortcut labels
const isMac = navigator.platform.toLowerCase().includes("mac");
const COPY_SHORTCUT = isMac ? "⌘⇧D" : "Ctrl+Shift+D";
const PASTE_SHORTCUT = isMac ? "⌘⇧F" : "Ctrl+Shift+F";

export function ClipboardHistory({ bridgeReady }: { bridgeReady: boolean }) {
  const [history, setHistory] = useState<ClipboardItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  const pushToast = (message: string, type: Toast["type"]) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2500);
  };

  // -------------------------------------------------------------------------
  // IPC listeners
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!bridgeReady || !window.pcConnectorApi) return;

    window.pcConnectorApi.getClipboardHistory().then(setHistory);

    const cleanHistory = window.pcConnectorApi.onClipboardUpdate(setHistory);
    const cleanCaptured = window.pcConnectorApi.onClipboardCaptured?.((item: ClipboardItem | null) => {
      if (item) {
        pushToast("Copied & shared with network ✓", "copied");
      } else {
        pushToast("Nothing selected to share", "pasted");
      }
    });
    const cleanPasted = window.pcConnectorApi.onClipboardPasted?.(() => {
      pushToast("Pasted to your clipboard ✓", "pasted");
    });

    return () => {
      cleanHistory?.();
      cleanCaptured?.();
      cleanPasted?.();
    };
  }, [bridgeReady]);

  // -------------------------------------------------------------------------
  // User clicks a history card → re-inject that item into OS clipboard
  // -------------------------------------------------------------------------
  const handleCopy = (historyId: string) => {
    if (!window.pcConnectorApi) return;
    window.pcConnectorApi.writeClipboardItem({ historyId });
    pushToast("Pasted to your clipboard ✓", "pasted");
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <>
      {/* Toast notifications */}
      <div style={{ position: "fixed", top: 16, right: 340, zIndex: 99999, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: t.type === "copied" ? "#1a3a2e" : "#1a2a3a",
              border: `1px solid ${t.type === "copied" ? "#3a8b57" : "#3a5b95"}`,
              color: t.type === "copied" ? "#aaf4c6" : "#7fb0ff",
              borderRadius: "8px",
              padding: "10px 16px",
              fontSize: "13px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              animation: "fadeInDown 0.25s ease",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Sidebar */}
      <div className="clipboard-sidebar">
        <div className="clipboard-header">
          <span>📋 Shared Clipboard</span>
        </div>

        {/* Shortcut hints */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #1e2d42", display: "flex", gap: 8, justifyContent: "center" }}>
          <span style={{ fontSize: "11px", background: "#0f1a2b", border: "1px solid #2a3d58", borderRadius: "6px", padding: "4px 10px", color: "#7fb0ff" }}>
            <strong>{COPY_SHORTCUT}</strong> Copy
          </span>
          <span style={{ fontSize: "11px", background: "#0f1a2b", border: "1px solid #2a3d58", borderRadius: "6px", padding: "4px 10px", color: "#7fb0ff" }}>
            <strong>{PASTE_SHORTCUT}</strong> Paste
          </span>
        </div>

        <div className="clipboard-content">
          {history.length === 0 ? (
            <div className="clipboard-empty">
              <p style={{ fontSize: "24px", margin: "0 0 10px 0" }}>📋</p>
              <p style={{ margin: "0 0 10px 0" }}>Clipboard is empty.</p>
              <p style={{ opacity: 0.7 }}>
                Press <strong>{COPY_SHORTCUT}</strong> anywhere to share what you copied.
              </p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.historyId}
                onClick={() => handleCopy(item.historyId)}
                className="clipboard-item"
                title={`Click to move to your clipboard`}
              >
                <div className="clipboard-item-meta">
                  <span>{new Date(item.timestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                  <span title="Click to paste">⎘</span>
                </div>
                {item.image && (
                  <div className="clipboard-img-wrap">
                    <img src={item.image} alt="Clipboard item" className="clipboard-img" />
                  </div>
                )}
                {item.text && (
                  <p className="clipboard-text">{item.text}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
