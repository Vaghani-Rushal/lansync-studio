import { useEffect, useState } from "react";

type ClipboardItem = {
  historyId: string;
  text?: string;
  image?: string;
  timestamp: number;
  sourceDisplayName?: string;
};

type Toast = { id: string; message: string; type: "copied" | "pasted" | "warning" };

const platformStr = (
  (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData?.platform ?? navigator.platform
).toLowerCase();
const isMac = platformStr.includes("mac") || platformStr.includes("macos");

const COPY_SHORTCUT   = isMac ? "⌥⌘C" : "Ctrl+Shift+D";
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
  const [toasts, setToasts]   = useState<Toast[]>([]);

  const pushToast = (message: string, type: Toast["type"]) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    const duration = type === "warning" ? 8000 : 2500;
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  };

  useEffect(() => {
    if (!bridgeReady || !window.pcConnectorApi) return;

    window.pcConnectorApi.getClipboardHistory().then(setHistory);

    const cleanHistory  = window.pcConnectorApi.onClipboardUpdate(setHistory);
    const cleanCaptured = window.pcConnectorApi.onClipboardCaptured?.((item: ClipboardItem | null) => {
      pushToast(item ? "Copied & shared with network ✓" : "Nothing selected to share", item ? "copied" : "pasted");
    });
    const cleanPasted  = window.pcConnectorApi.onClipboardPasted?.(() =>
      pushToast("Pasted to your clipboard ✓", "pasted")
    );
    const cleanPermErr = window.pcConnectorApi.onClipboardPermissionError?.((msg: string) =>
      pushToast(`⚠ ${msg}`, "warning")
    );

    return () => {
      cleanHistory?.();
      cleanCaptured?.();
      cleanPasted?.();
      cleanPermErr?.();
    };
  }, [bridgeReady]);

  const handleCopy = (historyId: string) => {
    window.pcConnectorApi?.writeClipboardItem({ historyId });
    pushToast("Pasted to your clipboard ✓", "pasted");
  };

  const handleClose = () => window.pcConnectorApi?.hideClipboardWindow?.();
  const handleQuit  = async () => window.pcConnectorApi?.quitApp?.();

  // ── History list ───────────────────────────────────────────────────────────
  const historyList =
    history.length === 0 ? (
      <div className="clipboard-empty">
        <div className="clipboard-empty-icon">📋</div>
        <p>Clipboard is empty.</p>
        <p>
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
            <span className="clipboard-item-meta-source">
              {item.sourceDisplayName ? `By ${item.sourceDisplayName}` : "By You"}
            </span>
            <span className="clipboard-item-paste-icon" title="Click to paste">⎘</span>
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

  // ── Toast list ─────────────────────────────────────────────────────────────
  const toastColorMap: Record<Toast["type"], { bg: string; border: string; color: string }> = {
    copied:  { bg: "hsla(151, 59%, 20%, 0.9)", border: "hsla(151, 59%, 40%, 0.5)", color: "hsl(151, 59%, 75%)" },
    pasted:  { bg: "hsla(202, 100%, 20%, 0.9)", border: "hsla(202, 100%, 50%, 0.3)", color: "var(--color-accent-blue)" },
    warning: { bg: "hsla(43, 100%, 20%, 0.9)",  border: "hsla(43, 100%, 50%, 0.4)", color: "var(--color-accent-yellow)" },
  };

  const toastList = toasts.map((t) => {
    const s = toastColorMap[t.type];
    return (
      <div
        key={t.id}
        style={{
          background: s.bg,
          border: `1px solid ${s.border}`,
          color: s.color,
          borderRadius: "var(--radius-md)",
          padding: "10px 14px",
          fontSize: "12px",
          fontWeight: 500,
          maxWidth: "280px",
          wordBreak: "break-word",
          boxShadow: "var(--shadow-md)",
          backdropFilter: "blur(8px)",
        }}
      >
        {t.message}
      </div>
    );
  });

  // ── Standalone window ──────────────────────────────────────────────────────
  if (standalone) {
    return (
      <div className="clipboard-window-root">
        <div className="clipboard-window-titlebar">
          <span className="clipboard-window-title">
            📋 Shared Clipboard
          </span>
          <div className="clipboard-window-actions">
            <button className="clipboard-quit-btn" onClick={handleQuit} title="Quit app">
              Quit
            </button>
            <button className="clipboard-close-btn" onClick={handleClose} title="Hide window">
              ✕
            </button>
          </div>
        </div>

        <div className="clipboard-shortcuts-bar">
          <span className="clipboard-shortcut-badge">
            <span className="clipboard-shortcut-key">{COPY_SHORTCUT}</span>
            <span className="clipboard-shortcut-label">Copy</span>
          </span>
          <span className="clipboard-shortcut-badge">
            <span className="clipboard-shortcut-key">{PASTE_SHORTCUT}</span>
            <span className="clipboard-shortcut-label">Paste</span>
          </span>
          <span className="clipboard-shortcut-badge">
            <span className="clipboard-shortcut-key">{TOGGLE_SHORTCUT}</span>
            <span className="clipboard-shortcut-label">Toggle</span>
          </span>
        </div>

        <div className="clipboard-toasts">{toastList}</div>

        <div className="clipboard-content">{historyList}</div>
      </div>
    );
  }

  // ── Embedded sidebar (unused in current layout but kept for future use) ────
  return null;
}
