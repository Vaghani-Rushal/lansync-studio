export type ViewerKind = "code" | "pdf" | "image" | "video" | "audio" | "docx" | "unsupported";

const textExtensions = new Set([
  ".env",
  ".gitignore",
  ".npmrc",
  ".editorconfig",
  ".txt",
  ".md",
  ".json",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".cjs",
  ".mjs",
  ".py",
  ".java",
  ".go",
  ".rs",
  ".sh",
  ".bash",
  ".zsh",
  ".ps1",
  ".css",
  ".html",
  ".xml",
  ".yaml",
  ".yml",
  ".csv",
  ".log"
]);

export const isTextEditableFile = (mimeType: string | null, relativePath: string | null) => {
  const mime = (mimeType ?? "application/octet-stream").toLowerCase();
  const rel = (relativePath ?? "").toLowerCase();
  const fileName = rel.split("/").pop() ?? rel;
  if (mime.startsWith("text/")) return true;
  if (
    mime.includes("json") ||
    mime.includes("javascript") ||
    mime.includes("typescript") ||
    mime.includes("xml") ||
    mime.includes("yaml")
  ) {
    return true;
  }
  for (const ext of textExtensions) {
    if (rel.endsWith(ext)) return true;
  }
  if (fileName === ".env" || fileName === ".gitignore" || fileName === ".dockerignore") return true;
  return false;
};

export const getViewerKind = (mimeType: string | null, relativePath: string | null): ViewerKind => {
  const mime = mimeType ?? "application/octet-stream";
  const rel = (relativePath ?? "").toLowerCase();
  if (mime.includes("wordprocessingml") || rel.endsWith(".docx")) return "docx";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (isTextEditableFile(mimeType, relativePath)) return "code";
  return "unsupported";
};
