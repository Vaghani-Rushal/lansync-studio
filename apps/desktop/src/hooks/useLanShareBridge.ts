import { useEffect, useRef } from "react";
import mammoth from "mammoth";
import * as Y from "yjs";
import { useLanShareStore } from "../state/lanShareStore";
import type { StreamMeta } from "../state/lanShareStore";
import { isTextEditableFile } from "../utils/viewerRouter";

const decodeBase64Bytes = (base64: string) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
const encodeBase64Bytes = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const MAX_PREVIEW_BYTES = 1024 * 1024 * 50;
const hashBytesSha256 = async (bytes: Uint8Array) => {
  const normalized = new Uint8Array(bytes.byteLength);
  normalized.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", normalized);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

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
  const failedTransfersRef = useRef<Set<string>>(new Set());
  const crdtDocsRef = useRef<
    Map<
      string,
      {
        doc: Y.Doc;
        text: Y.Text;
        applyingRemote: boolean;
      }
    >
  >(new Map());

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
  const setPreviewBuffer = useLanShareStore((s) => s.setPreviewBuffer);
  const setDocxPreview = useLanShareStore((s) => s.setDocxPreview);
  const setStreamMeta = useLanShareStore((s) => s.setStreamMeta);
  const setStreamState = useLanShareStore((s) => s.setStreamState);
  const pushClientMessage = useLanShareStore((s) => s.pushClientMessage);
  const setSessionCode = useLanShareStore((s) => s.setSessionCode);
  const setEditorReadOnly = useLanShareStore((s) => s.setEditorReadOnly);

  const ensureCrdtDoc = (relativePath: string, initialText = "") => {
    const existing = crdtDocsRef.current.get(relativePath);
    if (existing) return existing;
    const doc = new Y.Doc();
    const text = doc.getText("content");
    if (initialText) {
      text.insert(0, initialText);
    }
    const entry = { doc, text, applyingRemote: false };
    doc.on("update", (update) => {
      if (entry.applyingRemote) return;
      void api?.crdtUpdate({
        relativePath,
        update: encodeBase64Bytes(update)
      });
    });
    crdtDocsRef.current.set(relativePath, entry);
    return entry;
  };

  const applyEditorChange = (value: string) => {
    const selected = useLanShareStore.getState().selectedFile;
    if (!selected) {
      setEditorText(value);
      return;
    }
    const entry = ensureCrdtDoc(selected, useLanShareStore.getState().previewText);
    entry.applyingRemote = true;
    entry.text.delete(0, entry.text.length);
    entry.text.insert(0, value);
    entry.applyingRemote = false;
    setEditorText(entry.text.toString());
    setIsDirty(entry.text.toString() !== useLanShareStore.getState().previewText);
  };

  useEffect(() => {
    if (!api || !bridgeReady) return;

    const revokeBlob = () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreviewUrl(null);
      setPreviewBuffer(null);
    };

    const offWorkspaces = api.onWorkspaces(setDiscovered);
    const offPending = api.onPendingJoins(setPendingJoins);
    const offClients = api.onSessionClients(setConnectedClients);
    const offMessages = api.onClientMessage((message) => {
      pushClientMessage(`${message.type}: ${JSON.stringify(message.payload)}`);

      if (message.type === "JOIN_ACCEPT") {
        setConnectionState("connected");
        const capabilities = (message.payload.capabilities as string[]) ?? ["read"];
        setEditorReadOnly(!capabilities.includes("write"));
      }
      if (message.type === "WORKSPACE_SNAPSHOT") {
        const entries =
          (message.payload.entries as Array<{ path: string; name: string; isDirectory: boolean; size?: number; mimeType?: string }>) ??
          [];
        setClientFiles(buildTree(entries));
      }
      if (message.type === "CRDT_SYNC_RESPONSE") {
        const payload = message.payload as { relativePath: string; stateUpdate: string };
        const entry = ensureCrdtDoc(payload.relativePath);
        entry.applyingRemote = true;
        Y.applyUpdate(entry.doc, decodeBase64Bytes(payload.stateUpdate));
        entry.applyingRemote = false;
        if (useLanShareStore.getState().selectedFile === payload.relativePath) {
          const nextText = entry.text.toString();
          setEditorText(nextText);
          setPreviewText(nextText);
          setIsDirty(false);
        }
      }
      if (message.type === "CRDT_UPDATE") {
        const payload = message.payload as { relativePath: string; update: string };
        const entry = ensureCrdtDoc(payload.relativePath);
        entry.applyingRemote = true;
        Y.applyUpdate(entry.doc, decodeBase64Bytes(payload.update));
        entry.applyingRemote = false;
        if (useLanShareStore.getState().selectedFile === payload.relativePath) {
          const nextText = entry.text.toString();
          setEditorText(nextText);
          setPreviewText(nextText);
          setIsDirty(false);
        }
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
        failedTransfersRef.current.delete(payload.relativePath);
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
        if (failedTransfersRef.current.has(payload.relativePath)) {
          return;
        }
        const totalBytes = (bytesRef.current[payload.relativePath] ?? 0) + Math.ceil((payload.chunk.length * 3) / 4);
        if (totalBytes > MAX_PREVIEW_BYTES) {
          setErrorBanner("File is too large for in-memory preview.");
          setStreamState("failed");
          chunksRef.current[payload.relativePath] = [];
          failedTransfersRef.current.add(payload.relativePath);
          return;
        }
        bytesRef.current[payload.relativePath] = totalBytes;
        setStreamMeta((prev) => {
          if (!prev) return prev;
          if (payload.sequence !== prev.sequence + 1) {
            setErrorBanner("Corrupted stream sequence detected.");
            setStreamState("failed");
            failedTransfersRef.current.add(payload.relativePath);
            chunksRef.current[payload.relativePath] = [];
            bytesRef.current[payload.relativePath] = 0;
            return prev;
          }
          return { ...prev, sequence: payload.sequence };
        });
        const current = chunksRef.current[payload.relativePath] ?? [];
        chunksRef.current[payload.relativePath] = [...current, payload.chunk];
      }
      if (message.type === "FILE_END") {
        void (async () => {
          const payload = message.payload as {
            transferId: string;
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
            failedTransfersRef.current.add(payload.relativePath);
            void api?.rejectFileTransfer({
              transferId: payload.transferId,
              relativePath: payload.relativePath,
              reason: "Chunk count mismatch"
            });
            return;
          }
          const bytes = chunks.flatMap((chunk) => Array.from(decodeBase64Bytes(chunk)));
          const uint8 = new Uint8Array(bytes);
          const actualChecksum = await hashBytesSha256(uint8);
          if (actualChecksum !== payload.checksumSha256) {
            setErrorBanner("Checksum validation failed for streamed file.");
            setStreamState("failed");
            failedTransfersRef.current.add(payload.relativePath);
            chunksRef.current[payload.relativePath] = [];
            bytesRef.current[payload.relativePath] = 0;
            void api?.rejectFileTransfer({
              transferId: payload.transferId,
              relativePath: payload.relativePath,
              reason: "Checksum mismatch"
            });
            return;
          }
          void api?.acknowledgeFileTransfer({
            transferId: payload.transferId,
            relativePath: payload.relativePath
          });
          const mimeType = useLanShareStore.getState().selectedMimeType ?? "application/octet-stream";
          const relLower = payload.relativePath.toLowerCase();
          const isDocx = Boolean(mimeType.includes("wordprocessingml")) || relLower.endsWith(".docx");

          if (mimeType.startsWith("image/") || mimeType === "application/pdf" || mimeType.startsWith("video/") || mimeType.startsWith("audio/")) {
            const blob = new Blob([uint8], { type: mimeType });
            revokeBlob();
            const url = URL.createObjectURL(blob);
            previewUrlRef.current = url;
            setPreviewUrl(url);
          setPreviewBuffer(
            uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength)
          );
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
          } else if (isTextEditableFile(mimeType, payload.relativePath)) {
            revokeBlob();
            setDocxPreview(null);
            const text = new TextDecoder().decode(uint8);
            setPreviewText(text);
            setEditorText(text);
            setIsDirty(false);
            setPreviewBuffer(null);
            const crdt = ensureCrdtDoc(payload.relativePath, text);
            crdt.applyingRemote = true;
            crdt.text.delete(0, crdt.text.length);
            crdt.text.insert(0, text);
            crdt.applyingRemote = false;
            void api?.crdtInit({ relativePath: payload.relativePath });
          } else {
            revokeBlob();
            setDocxPreview(null);
            setPreviewText("");
            setEditorText("");
            setIsDirty(false);
            setPreviewBuffer(null);
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
          failedTransfersRef.current.delete(payload.relativePath);
        })();
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
      for (const entry of crdtDocsRef.current.values()) {
        entry.doc.destroy();
      }
      crdtDocsRef.current.clear();
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
    setEditorReadOnly,
    setStatus,
    setStreamMeta,
    setStreamState,
    setPreviewBuffer
  ]);

  return { bridgeReady, api, applyEditorChange };
};
