import { useState, useEffect } from "react";
import { ClipboardHistory } from "./ClipboardHistory";

/**
 * Root component rendered inside the dedicated floating clipboard BrowserWindow.
 * Detected in main.tsx via `?window=clipboard` query param.
 */
export function ClipboardWindowApp() {
  const [bridgeReady, setBridgeReady] = useState(false);

  useEffect(() => {
    if (window.pcConnectorApi?.isBridgeReady?.()) {
      setBridgeReady(true);
    }
  }, []);

  return <ClipboardHistory bridgeReady={bridgeReady} standalone />;
}
