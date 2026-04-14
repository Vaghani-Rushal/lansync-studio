import { create } from "zustand";
import type { ConnectedClient, DiscoveryWorkspace, FileTreeNode, PendingJoin } from "@pcconnector/shared-types";

type Screen = "home" | "share" | "join" | "viewer";
type StreamState = "idle" | "started" | "progress" | "completed" | "failed";

export type StreamMeta = {
  transferId: string;
  relativePath: string;
  expectedChunks: number;
  receivedChunks: number;
  fileSize: number;
  checksumSha256?: string;
  sequence: number;
};

type StoreState = {
  currentScreen: Screen;
  workspaceName: string;
  sessionCode: string;
  status: string;
  hostFiles: FileTreeNode[];
  clientFiles: FileTreeNode[];
  discovered: DiscoveryWorkspace[];
  pendingJoins: PendingJoin[];
  connectedClients: ConnectedClient[];
  connectionState: "disconnected" | "connecting" | "awaiting_approval" | "connected";
  clientMessages: string[];
  errorBanner: string | null;
  selectedFile: string | null;
  selectedMimeType: string | null;
  previewText: string;
  editorText: string;
  isDirty: boolean;
  isSaving: boolean;
  previewUrl: string | null;
  docxPreview: null | { status: "loading" } | { status: "ready"; html: string } | { status: "error"; message: string };
  isCreatingWorkspace: boolean;
  isDiscovering: boolean;
  streamState: StreamState;
  streamMeta: StreamMeta | null;
  setScreen: (screen: Screen) => void;
  setWorkspaceName: (name: string) => void;
  setSessionCode: (code: string) => void;
  setStatus: (status: string) => void;
  setHostFiles: (files: FileTreeNode[]) => void;
  setClientFiles: (files: FileTreeNode[]) => void;
  setDiscovered: (workspaces: DiscoveryWorkspace[]) => void;
  setPendingJoins: (joins: PendingJoin[]) => void;
  setConnectedClients: (clients: ConnectedClient[]) => void;
  setConnectionState: (state: StoreState["connectionState"]) => void;
  pushClientMessage: (message: string) => void;
  setErrorBanner: (msg: string | null) => void;
  setSelectedFile: (path: string | null) => void;
  setSelectedMimeType: (mime: string | null) => void;
  setPreviewText: (text: string) => void;
  setEditorText: (text: string) => void;
  setIsDirty: (value: boolean) => void;
  setIsSaving: (value: boolean) => void;
  setPreviewUrl: (url: string | null) => void;
  setDocxPreview: (value: StoreState["docxPreview"]) => void;
  setIsCreatingWorkspace: (value: boolean) => void;
  setIsDiscovering: (value: boolean) => void;
  setStreamState: (state: StreamState) => void;
  setStreamMeta: (meta: StreamMeta | null | ((prev: StreamMeta | null) => StreamMeta | null)) => void;
  resetPreviewState: () => void;
};

export const useLanShareStore = create<StoreState>((set) => ({
  currentScreen: "home",
  workspaceName: "MyWorkspace",
  sessionCode: "",
  status: "Idle",
  hostFiles: [],
  clientFiles: [],
  discovered: [],
  pendingJoins: [],
  connectedClients: [],
  connectionState: "disconnected",
  clientMessages: [],
  errorBanner: null,
  selectedFile: null,
  selectedMimeType: null,
  previewText: "",
  editorText: "",
  isDirty: false,
  isSaving: false,
  previewUrl: null,
  docxPreview: null,
  isCreatingWorkspace: false,
  isDiscovering: false,
  streamState: "idle",
  streamMeta: null,
  setScreen: (currentScreen) => set({ currentScreen }),
  setWorkspaceName: (workspaceName) => set({ workspaceName }),
  setSessionCode: (sessionCode) => set({ sessionCode }),
  setStatus: (status) => set({ status }),
  setHostFiles: (hostFiles) => set({ hostFiles }),
  setClientFiles: (clientFiles) => set({ clientFiles }),
  setDiscovered: (discovered) => set({ discovered }),
  setPendingJoins: (pendingJoins) => set({ pendingJoins }),
  setConnectedClients: (connectedClients) => set({ connectedClients }),
  setConnectionState: (connectionState) => set({ connectionState }),
  pushClientMessage: (message) => set((state) => ({ clientMessages: [message, ...state.clientMessages].slice(0, 12) })),
  setErrorBanner: (errorBanner) => set({ errorBanner }),
  setSelectedFile: (selectedFile) => set({ selectedFile }),
  setSelectedMimeType: (selectedMimeType) => set({ selectedMimeType }),
  setPreviewText: (previewText) => set({ previewText }),
  setEditorText: (editorText) => set({ editorText }),
  setIsDirty: (isDirty) => set({ isDirty }),
  setIsSaving: (isSaving) => set({ isSaving }),
  setPreviewUrl: (previewUrl) => set({ previewUrl }),
  setDocxPreview: (docxPreview) => set({ docxPreview }),
  setIsCreatingWorkspace: (isCreatingWorkspace) => set({ isCreatingWorkspace }),
  setIsDiscovering: (isDiscovering) => set({ isDiscovering }),
  setStreamState: (streamState) => set({ streamState }),
  setStreamMeta: (streamMeta) =>
    set((state) => ({
      streamMeta: typeof streamMeta === "function" ? streamMeta(state.streamMeta) : streamMeta
    })),
  resetPreviewState: () =>
    set({
      selectedFile: null,
      selectedMimeType: null,
      previewText: "",
      editorText: "",
      isDirty: false,
      previewUrl: null,
      docxPreview: null,
      streamState: "idle",
      streamMeta: null
    })
}));
