import { describe, expect, it } from "vitest";
import { getViewerKind, isTextEditableFile } from "./viewerRouter";

describe("viewerRouter", () => {
  it("routes known mime types correctly", () => {
    expect(getViewerKind("text/plain", "a.txt")).toBe("code");
    expect(getViewerKind("application/pdf", "a.pdf")).toBe("pdf");
    expect(getViewerKind("image/png", "a.png")).toBe("image");
    expect(getViewerKind("video/mp4", "a.mp4")).toBe("video");
    expect(getViewerKind("audio/mpeg", "a.mp3")).toBe("audio");
    expect(
      getViewerKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "a.docx")
    ).toBe("docx");
  });

  it("treats common text extensions and mimes as code", () => {
    expect(isTextEditableFile("application/json", "a.bin")).toBe(true);
    expect(isTextEditableFile("application/octet-stream", "README.md")).toBe(true);
    expect(isTextEditableFile("application/octet-stream", "notes.txt")).toBe(true);
    expect(getViewerKind("application/octet-stream", "notes.md")).toBe("code");
  });
});
