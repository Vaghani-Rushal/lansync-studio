import { create } from "zustand";
import type {
  DiscoveryWorkspace,
  FileTreeNode,
  HostedWorkspace,
  PendingJoin,
  Permission,
  UserIdentity
} from "@pcconnector/shared-types";

type Screen = "identity" | "home" | "share" | "join" | "viewer";
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
  // Identity
  identity: UserIdentity | null;
  isIdentityLoaded: boolean;

  // Navigation
  currentScreen: Screen;
  status: string;

  // Hosting (host role)
  hostedWorkspaces: HostedWorkspace[];
  activeHostWorkspaceId: string | null;
  pendingJoins: PendingJoin[];
  newWorkspaceName: string;
  newWorkspacePermission: Permission;
  isCreatingWorkspace: boolean;

  // Discovery + client role
  discovered: DiscoveryWorkspace[];
  isDiscovering: boolean;
  connectionState: "disconnected" | "connecting" | "awaiting_approval" | "connected" | "rejected";
  joinedWorkspaceId: string | null;
  joinedWorkspaceName: string;
  joinRejectReason: string | null;
  clientPermission: Permission;
  editorReadOnly: boolean;

  // Client file view
  clientFiles: FileTreeNode[];
  clientMessages: string[];
  errorBanner: string | null;
  selectedFile: string | null;
  selectedMimeType: string | null;
  previewText: string;
  editorText: string;
  isDirty: boolean;
  isSaving: boolean;
  previewUrl: string | null;
  previewBuffer: ArrayBuffer | null;
  docxPreview: null | { status: "loading" } | { status: "ready"; html: string } | { status: "error"; message: string };
  streamState: StreamState;
  streamMeta: StreamMeta | null;

  // Actions
  setIdentity: (identity: UserIdentity | null) => void;
  setIdentityLoaded: (value: boolean) => void;
  setScreen: (screen: Screen) => void;
  setStatus: (status: string) => void;
  setHostedWorkspaces: (workspaces: HostedWorkspace[]) => void;
  setActiveHostWorkspaceId: (id: string | null) => void;
  setPendingJoins: (joins: PendingJoin[]) => void;
  setNewWorkspaceName: (name: string) => void;
  setNewWorkspacePermission: (permission: Permission) => void;
  setIsCreatingWorkspace: (value: boolean) => void;
  setDiscovered: (workspaces: DiscoveryWorkspace[]) => void;
  setIsDiscovering: (value: boolean) => void;
  setConnectionState: (state: StoreState["connectionState"]) => void;
  setJoinedWorkspace: (id: string | null, name?: string) => void;
  setJoinRejectReason: (reason: string | null) => void;
  setClientPermission: (permission: Permission) => void;
  setEditorReadOnly: (value: boolean) => void;
  setClientFiles: (files: FileTreeNode[]) => void;
  pushClientMessage: (message: string) => void;
  setErrorBanner: (msg: string | null) => void;
  setSelectedFile: (path: string | null) => void;
  setSelectedMimeType: (mime: string | null) => void;
  setPreviewText: (text: string) => void;
  setEditorText: (text: string) => void;
  setIsDirty: (value: boolean) => void;
  setIsSaving: (value: boolean) => void;
  setPreviewUrl: (url: string | null) => void;
  setPreviewBuffer: (buffer: ArrayBuffer | null) => void;
  setDocxPreview: (value: StoreState["docxPreview"]) => void;
  setStreamState: (state: StreamState) => void;
  setStreamMeta: (meta: StreamMeta | null | ((prev: StreamMeta | null) => StreamMeta | null)) => void;
  resetPreviewState: () => void;
  resetClientSessionState: () => void;
};

export const useLanShareStore = create<StoreState>((set) => ({
  identity: null,
  isIdentityLoaded: false,

  currentScreen: "identity",
  status: "Idle",

  hostedWorkspaces: [],
  activeHostWorkspaceId: null,
  pendingJoins: [],
  newWorkspaceName: "MyWorkspace",
  newWorkspacePermission: "VIEW_EDIT",
  isCreatingWorkspace: false,

  discovered: [],
  isDiscovering: false,
  connectionState: "disconnected",
  joinedWorkspaceId: null,
  joinedWorkspaceName: "",
  joinRejectReason: null,
  clientPermission: "VIEW_ONLY",
  editorReadOnly: true,

  clientFiles: [],
  clientMessages: [],
  errorBanner: null,
  selectedFile: null,
  selectedMimeType: null,
  previewText: "",
  editorText: "",
  isDirty: false,
  isSaving: false,
  previewUrl: null,
  previewBuffer: null,
  docxPreview: null,
  streamState: "idle",
  streamMeta: null,

  setIdentity: (identity) => set({ identity }),
  setIdentityLoaded: (isIdentityLoaded) => set({ isIdentityLoaded }),
  setScreen: (currentScreen) => set({ currentScreen }),
  setStatus: (status) => set({ status }),
  setHostedWorkspaces: (hostedWorkspaces) =>
    set((state) => ({
      hostedWorkspaces,
      activeHostWorkspaceId:
        state.activeHostWorkspaceId && hostedWorkspaces.some((w) => w.workspaceId === state.activeHostWorkspaceId)
          ? state.activeHostWorkspaceId
          : hostedWorkspaces[0]?.workspaceId ?? null
    })),
  setActiveHostWorkspaceId: (activeHostWorkspaceId) => set({ activeHostWorkspaceId }),
  setPendingJoins: (pendingJoins) => set({ pendingJoins }),
  setNewWorkspaceName: (newWorkspaceName) => set({ newWorkspaceName }),
  setNewWorkspacePermission: (newWorkspacePermission) => set({ newWorkspacePermission }),
  setIsCreatingWorkspace: (isCreatingWorkspace) => set({ isCreatingWorkspace }),
  setDiscovered: (discovered) => set({ discovered }),
  setIsDiscovering: (isDiscovering) => set({ isDiscovering }),
  setConnectionState: (connectionState) => set({ connectionState }),
  setJoinedWorkspace: (joinedWorkspaceId, joinedWorkspaceName) =>
    set({
      joinedWorkspaceId,
      joinedWorkspaceName: joinedWorkspaceName ?? ""
    }),
  setJoinRejectReason: (joinRejectReason) => set({ joinRejectReason }),
  setClientPermission: (clientPermission) =>
    set({ clientPermission, editorReadOnly: clientPermission === "VIEW_ONLY" }),
  setEditorReadOnly: (editorReadOnly) => set({ editorReadOnly }),
  setClientFiles: (clientFiles) => set({ clientFiles }),
  pushClientMessage: (message) =>
    set((state) => ({ clientMessages: [message, ...state.clientMessages].slice(0, 12) })),
  setErrorBanner: (errorBanner) => set({ errorBanner }),
  setSelectedFile: (selectedFile) => set({ selectedFile }),
  setSelectedMimeType: (selectedMimeType) => set({ selectedMimeType }),
  setPreviewText: (previewText) => set({ previewText }),
  setEditorText: (editorText) => set({ editorText }),
  setIsDirty: (isDirty) => set({ isDirty }),
  setIsSaving: (isSaving) => set({ isSaving }),
  setPreviewUrl: (previewUrl) => set({ previewUrl }),
  setPreviewBuffer: (previewBuffer) => set({ previewBuffer }),
  setDocxPreview: (docxPreview) => set({ docxPreview }),
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
      previewBuffer: null,
      docxPreview: null,
      streamState: "idle",
      streamMeta: null
    }),
  resetClientSessionState: () =>
    set({
      connectionState: "disconnected",
      joinedWorkspaceId: null,
      joinedWorkspaceName: "",
      joinRejectReason: null,
      clientFiles: [],
      clientPermission: "VIEW_ONLY",
      editorReadOnly: true,
      selectedFile: null,
      selectedMimeType: null,
      previewText: "",
      editorText: "",
      isDirty: false,
      previewUrl: null,
      previewBuffer: null,
      docxPreview: null,
      streamState: "idle",
      streamMeta: null
    })
}));
