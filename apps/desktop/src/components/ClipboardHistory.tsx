import { useEffect, useState } from "react";

type ClipboardItem = {
  historyId: string;
  text?: string;
  image?: string;
  timestamp: number;
  sourceDisplayName?: string;
};

type Toast = { id: string; message: string; type: "copied" | "pasted" | "warning" };

// Detect Mac — prefer the modern userAgentData API (Chrome 90+/Electron 12+),
// fall back to the deprecated navigator.platform for older environments.
const platformStr = (
  (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData?.platform ?? navigator.platform
).toLowerCase();
const isMac = platformStr.includes("mac") || platformStr.includes("macos");

const COPY_SHORTCUT  = isMac ? "⌥⌘C" : "Ctrl+Shift+D";
const PASTE_SHORTCUT  = isMac ? "⌘⇧F" : "Ctrl+Shift+F";
const TOGGLE_SHORTCUT = isMac ? "⌘⇧H" : "Ctrl+Shift+H";

export function ClipboardHistory({
  bridgeReady,
  standalone = false,
}: {
  bridgeReady: boolean;
  standalone?: boolean;
}) {
  const [history, setHistory] = useState<ClipboardItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  const pushToast = (message: string, type: Toast["type"]) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    // Warning toasts stay visible longer so the user can read the action needed
    const duration = type === "warning" ? 8000 : 2500;
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  };

  // -------------------------------------------------------------------------
  // IPC listeners
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!bridgeReady || !window.pcConnectorApi) return;

    window.pcConnectorApi.getClipboardHistory().then(setHistory);

    const cleanHistory  = window.pcConnectorApi.onClipboardUpdate(setHistory);
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
    const cleanPermErr = window.pcConnectorApi.onClipboardPermissionError?.((msg: string) => {
      pushToast(`⚠ ${msg}`, "warning");
    });

    return () => {
      cleanHistory?.();
      cleanCaptured?.();
      cleanPasted?.();
      cleanPermErr?.();
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
  // Close button (standalone window only)
  // -------------------------------------------------------------------------
  const handleClose = () => {
    window.pcConnectorApi?.hideClipboardWindow?.();
  };

  const handleQuit = async () => {
    await window.pcConnectorApi?.quitApp?.();
  };

  // -------------------------------------------------------------------------
  // History list — shared between both render paths
  // -------------------------------------------------------------------------
  const historyList =
    history.length === 0 ? (
      <div className="clipboard-empty">
        <p style={{ fontSize: "24px", margin: "0 0 10px 0" }}>📋</p>
        <p style={{ margin: "0 0 10px 0" }}>Clipboard is empty.</p>
        <p style={{ opacity: 0.7 }}>
          Press <strong>{COPY_SHORTCUT}</strong> to share copied text or image.
        </p>
      </div>
    ) : (
      history.map((item) => (
        <div
          key={item.historyId}
          onClick={() => handleCopy(item.historyId)}
          className="clipboard-item"
          title="Click to move to your clipboard"
        >
          <div className="clipboard-item-meta">
            <span>
              {new Date(item.timestamp).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            <span>{item.sourceDisplayName ? `By ${item.sourceDisplayName}` : "By You"}</span>
            <span title="Click to paste">⎘</span>
          </div>
          {item.image && (
            <div className="clipboard-img-wrap">
              <img src={item.image} alt="Clipboard item" className="clipboard-img" />
            </div>
          )}
          {item.text && <p className="clipboard-text">{item.text}</p>}
        </div>
      ))
    );

  // -------------------------------------------------------------------------
  // Toasts — shared element, positioned differently per mode
  // -------------------------------------------------------------------------
  const toastStyles: Record<Toast["type"], { bg: string; border: string; color: string }> = {
    copied:  { bg: "#1a3a2e", border: "#3a8b57", color: "#aaf4c6" },
    pasted:  { bg: "#1a2a3a", border: "#3a5b95", color: "#7fb0ff" },
    warning: { bg: "#2e2200", border: "#a07800", color: "#ffd966" },
  };

  const toastList = toasts.map((t) => {
    const s = toastStyles[t.type];
    return (
      <div
        key={t.id}
        style={{
          background: s.bg,
          border: `1px solid ${s.border}`,
          color: s.color,
          borderRadius: "8px",
          padding: "10px 16px",
          fontSize: "12px",
          maxWidth: "300px",
          wordBreak: "break-word",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          animation: "fadeInDown 0.25s ease",
        }}
      >
        {t.message}
      </div>
    );
  });

  // =========================================================================
  // STANDALONE — floating window layout (full-screen, frameless)
  // =========================================================================
  if (standalone) {
    return (
      <div className="clipboard-window-root">
        {/* Draggable title bar */}
        <div className="clipboard-window-titlebar">
          <span className="clipboard-window-drag">📋 Shared Clipboard</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="clipboard-window-close"
              onClick={handleQuit}
              title="Quit app and clear runtime memory"
              style={{ color: "#ffb36b" }}
            >
              Quit
            </button>
            <button className="clipboard-window-close" onClick={handleClose} title="Hide window">
              ✕
            </button>
          </div>
        </div>

        {/* Shortcut hints */}
        <div className="clipboard-shortcuts-bar">
          <span className="clipboard-shortcut-badge">
            <strong>{COPY_SHORTCUT}</strong> Copy Text/Image
          </span>
          <span className="clipboard-shortcut-badge">
            <strong>{PASTE_SHORTCUT}</strong> Paste
          </span>
          <span className="clipboard-shortcut-badge">
            <strong>{TOGGLE_SHORTCUT}</strong> Toggle
          </span>
        </div>

        {/* Toast notifications inside window */}
        <div className="clipboard-toasts">{toastList}</div>

        {/* History */}
        <div className="clipboard-content">{historyList}</div>
      </div>
    );
  }

  // =========================================================================
  // EMBEDDED — original fixed sidebar inside the main app window
  // =========================================================================
  return (
    <>
      {/* Toast notifications offset left of sidebar */}
      <div
        style={{
          position: "fixed",
          top: 16,
          right: 340,
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {toastList}
      </div>

      {/* Sidebar */}
      <div className="clipboard-sidebar">
        <div className="clipboard-header">
          <span>📋 Shared Clipboard</span>
        </div>

        {/* Shortcut hints */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid #1e2d42",
            display: "flex",
            gap: 8,
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              background: "#0f1a2b",
              border: "1px solid #2a3d58",
              borderRadius: "6px",
              padding: "4px 10px",
              color: "#7fb0ff",
            }}
          >
            <strong>{COPY_SHORTCUT}</strong> Copy Text/Image
          </span>
          <span
            style={{
              fontSize: "11px",
              background: "#0f1a2b",
              border: "1px solid #2a3d58",
              borderRadius: "6px",
              padding: "4px 10px",
              color: "#7fb0ff",
            }}
          >
            <strong>{PASTE_SHORTCUT}</strong> Paste
          </span>
        </div>

        <div className="clipboard-content">{historyList}</div>
      </div>
    </>
  );
}
