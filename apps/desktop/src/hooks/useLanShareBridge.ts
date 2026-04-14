import { useEffect, useRef } from "react";
import mammoth from "mammoth";
import { useLanShareStore } from "../state/lanShareStore";
import type { StreamMeta } from "../state/lanShareStore";

const decodeBase64Bytes = (base64: string) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
const MAX_PREVIEW_BYTES = 1024 * 1024 * 50;

const buildTree = (entries: Array<{ path: string; name: string; isDirectory: boolean; size?: number; mimeType?: string }>) =>
  entries.map((entry) => ({
    id: entry.path,
    name: entry.name,
    relativePath: entry.path,
    isDirectory: entry.isDirectory,
    size: entry.size,
    mimeType: entry.mimeType
  }));

export const useLanShareBridge = () => {
  const api = window.pcConnectorApi;
  const bridgeReady = Boolean(api?.isBridgeReady?.());
  const chunksRef = useRef<Record<string, string[]>>({});
  const bytesRef = useRef<Record<string, number>>({});
  const previewUrlRef = useRef<string | null>(null);

  const setDiscovered = useLanShareStore((s) => s.setDiscovered);
  const setPendingJoins = useLanShareStore((s) => s.setPendingJoins);
  const setConnectedClients = useLanShareStore((s) => s.setConnectedClients);
  const setConnectionState = useLanShareStore((s) => s.setConnectionState);
  const setClientFiles = useLanShareStore((s) => s.setClientFiles);
  const setStatus = useLanShareStore((s) => s.setStatus);
  const setErrorBanner = useLanShareStore((s) => s.setErrorBanner);
  const setSelectedMimeType = useLanShareStore((s) => s.setSelectedMimeType);
  const setPreviewText = useLanShareStore((s) => s.setPreviewText);
  const setEditorText = useLanShareStore((s) => s.setEditorText);
  const setIsDirty = useLanShareStore((s) => s.setIsDirty);
  const setPreviewUrl = useLanShareStore((s) => s.setPreviewUrl);
  const setDocxPreview = useLanShareStore((s) => s.setDocxPreview);
  const setStreamMeta = useLanShareStore((s) => s.setStreamMeta);
  const setStreamState = useLanShareStore((s) => s.setStreamState);
  const pushClientMessage = useLanShareStore((s) => s.pushClientMessage);
  const setSessionCode = useLanShareStore((s) => s.setSessionCode);

  useEffect(() => {
    if (!api || !bridgeReady) return;

    const revokeBlob = () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreviewUrl(null);
    };

    const offWorkspaces = api.onWorkspaces(setDiscovered);
    const offPending = api.onPendingJoins(setPendingJoins);
    const offClients = api.onSessionClients(setConnectedClients);
    const offMessages = api.onClientMessage((message) => {
      pushClientMessage(`${message.type}: ${JSON.stringify(message.payload)}`);

      if (message.type === "JOIN_ACCEPT") {
        setConnectionState("connected");
      }
      if (message.type === "WORKSPACE_SNAPSHOT") {
        const entries =
          (message.payload.entries as Array<{ path: string; name: string; isDirectory: boolean; size?: number; mimeType?: string }>) ??
          [];
        setClientFiles(buildTree(entries));
      }
      if (message.type === "CLIENTS_UPDATE") {
        const clients = (message.payload.clients as Array<{ clientId: string; deviceName: string; connectedAt: number; capabilities: string[] }>) ?? [];
        setConnectedClients(clients);
      }
      if (message.type === "SESSION_STOP") {
        setConnectionState("disconnected");
        setErrorBanner("Session stopped by host.");
      }
      if (message.type === "RECONNECTING") {
        setConnectionState("connecting");
      }
      if (message.type === "ERROR") {
        const payload = message.payload as { message?: string };
        setErrorBanner(payload.message ?? "Unexpected network error");
        setStreamState("failed");
      }
      if (message.type === "FILE_START") {
        const payload = message.payload as StreamMeta;
        chunksRef.current[payload.relativePath] = [];
        bytesRef.current[payload.relativePath] = 0;
        setStreamMeta({ ...payload, receivedChunks: 0, sequence: -1 });
        setStreamState("started");
        setSelectedMimeType((message.payload as { mimeType?: string }).mimeType ?? null);
      }
      if (message.type === "FILE_PROGRESS") {
        const payload = message.payload as { sentChunks: number; totalChunks: number; transferId: string; relativePath: string };
        setStreamMeta((prev) =>
          prev
            ? {
                ...prev,
                transferId: payload.transferId,
                relativePath: payload.relativePath,
                receivedChunks: payload.sentChunks,
                expectedChunks: payload.totalChunks
              }
            : prev
        );
        setStreamState("progress");
      }
      if (message.type === "FILE_CHUNK") {
        const payload = message.payload as { relativePath: string; sequence: number; chunk: string };
        const totalBytes = (bytesRef.current[payload.relativePath] ?? 0) + Math.ceil((payload.chunk.length * 3) / 4);
        if (totalBytes > MAX_PREVIEW_BYTES) {
          setErrorBanner("File is too large for in-memory preview.");
          setStreamState("failed");
          chunksRef.current[payload.relativePath] = [];
          return;
        }
        bytesRef.current[payload.relativePath] = totalBytes;
        setStreamMeta((prev) => {
          if (!prev) return prev;
          if (payload.sequence !== prev.sequence + 1) {
            setErrorBanner("Corrupted stream sequence detected.");
            setStreamState("failed");
            return prev;
          }
          return { ...prev, sequence: payload.sequence };
        });
        const current = chunksRef.current[payload.relativePath] ?? [];
        chunksRef.current[payload.relativePath] = [...current, payload.chunk];
      }
      if (message.type === "FILE_END") {
        const payload = message.payload as {
          relativePath: string;
          expectedChunks: number;
          receivedChunks: number;
          fileSize: number;
          checksumSha256: string;
        };
        const chunks = chunksRef.current[payload.relativePath] ?? [];
        if (chunks.length !== payload.receivedChunks || payload.expectedChunks !== payload.receivedChunks) {
          setErrorBanner("Incomplete file transfer received.");
          setStreamState("failed");
          return;
        }
        const bytes = chunks.flatMap((chunk) => Array.from(decodeBase64Bytes(chunk)));
        const uint8 = new Uint8Array(bytes);
        const mimeType = useLanShareStore.getState().selectedMimeType ?? "application/octet-stream";
        const relLower = payload.relativePath.toLowerCase();
        const isDocx = Boolean(mimeType.includes("wordprocessingml")) || relLower.endsWith(".docx");

        if (mimeType.startsWith("image/") || mimeType === "application/pdf" || mimeType.startsWith("video/") || mimeType.startsWith("audio/")) {
          const blob = new Blob([uint8], { type: mimeType });
          revokeBlob();
          const url = URL.createObjectURL(blob);
          previewUrlRef.current = url;
          setPreviewUrl(url);
          setPreviewText("");
          setDocxPreview(null);
        } else if (isDocx) {
          revokeBlob();
          setPreviewText("");
          setEditorText("");
          setIsDirty(false);
          setDocxPreview({ status: "loading" });
          const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
          void mammoth
            .convertToHtml({ arrayBuffer })
            .then((result) => setDocxPreview({ status: "ready", html: result.value }))
            .catch((err) => setDocxPreview({ status: "error", message: err instanceof Error ? err.message : String(err) }));
        } else if (mimeType === "text/plain") {
          revokeBlob();
          setDocxPreview(null);
          const text = new TextDecoder().decode(uint8);
          setPreviewText(text);
          setEditorText(text);
          setIsDirty(false);
        } else {
          revokeBlob();
          setDocxPreview(null);
          setPreviewText("");
          setEditorText("");
          setIsDirty(false);
        }

        setStreamMeta((prev) =>
          prev
            ? {
                ...prev,
                fileSize: payload.fileSize,
                expectedChunks: payload.expectedChunks,
                receivedChunks: payload.receivedChunks,
                checksumSha256: payload.checksumSha256
              }
            : prev
        );
        setStreamState("completed");
        chunksRef.current[payload.relativePath] = [];
        bytesRef.current[payload.relativePath] = 0;
      }
      if (message.type === "SAVE_ACK") {
        setIsDirty(false);
        setStatus("Saved");
      }
    });

    const offHostStatus = api.onHostStatus((hostStatus) => {
      setStatus(hostStatus.message ?? hostStatus.state);
      if (hostStatus.sessionCode) {
        setSessionCode(hostStatus.sessionCode);
      }
    });

    return () => {
      revokeBlob();
      offWorkspaces();
      offPending();
      offClients();
      offMessages();
      offHostStatus();
    };
  }, [
    api,
    bridgeReady,
    pushClientMessage,
    setClientFiles,
    setConnectedClients,
    setConnectionState,
    setDiscovered,
    setDocxPreview,
    setEditorText,
    setErrorBanner,
    setIsDirty,
    setPendingJoins,
    setPreviewText,
    setPreviewUrl,
    setSelectedMimeType,
    setSessionCode,
    setStatus,
    setStreamMeta,
    setStreamState
  ]);

  return { bridgeReady, api };
};
