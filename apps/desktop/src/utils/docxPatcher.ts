import JSZip from "jszip";

const WORDML_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const BLOCK_SELECTORS = "p, li, h1, h2, h3, h4, h5, h6, blockquote, pre";

export class DocxStructuralEditError extends Error {
  readonly originalParagraphs: number;
  readonly editedParagraphs: number;
  constructor(originalParagraphs: number, editedParagraphs: number) {
    super(
      `Structural edits aren't supported: original has ${originalParagraphs} paragraph(s), edited has ${editedParagraphs}.`
    );
    this.name = "DocxStructuralEditError";
    this.originalParagraphs = originalParagraphs;
    this.editedParagraphs = editedParagraphs;
  }
}

export class DocxComplexityError extends Error {
  constructor(reason: string) {
    super(`This document is too complex for in-place editing (${reason}). Edits were not saved.`);
    this.name = "DocxComplexityError";
  }
}

const normalize = (s: string): string => s.normalize("NFC").replace(/\s+/g, " ").trim();

export const extractParagraphsFromHtml = (html: string): string[] => {
  const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html");
  const body = doc.body;
  if (!body) return [""];
  const nodes = Array.from(body.querySelectorAll(BLOCK_SELECTORS));
  if (nodes.length === 0) return [normalize(body.textContent ?? "")];

  const unique: Element[] = [];
  for (const node of nodes) {
    const nestedBlock = node.querySelector(BLOCK_SELECTORS);
    if (!nestedBlock) unique.push(node);
  }
  const source = unique.length > 0 ? unique : nodes;
  return source.map((el) => normalize(el.textContent ?? ""));
};

export const distributeText = (original: string[], edited: string): string[] => {
  if (original.length === 0) return [];
  if (original.length === 1) return [edited];
  if (edited.length === 0) return original.map(() => "");

  const totalOrig = original.reduce((sum, t) => sum + t.length, 0);
  if (totalOrig === 0) {
    return original.map((_, i) => (i === original.length - 1 ? edited : ""));
  }

  const out: string[] = [];
  let consumed = 0;
  for (let i = 0; i < original.length - 1; i++) {
    const share = Math.round((original[i].length / totalOrig) * edited.length);
    const end = Math.min(edited.length, consumed + share);
    out.push(edited.slice(consumed, end));
    consumed = end;
  }
  out.push(edited.slice(consumed));
  return out;
};

type DocxParagraphInfo = {
  element: Element;
  tNodes: Element[];
  text: string;
};

const collectTextParagraphs = (xmlDoc: Document): DocxParagraphInfo[] => {
  const paragraphs = Array.from(xmlDoc.getElementsByTagNameNS(WORDML_NS, "p"));
  const result: DocxParagraphInfo[] = [];
  for (const p of paragraphs) {
    const tNodes = Array.from(p.getElementsByTagNameNS(WORDML_NS, "t"));
    if (tNodes.length === 0) continue;
    const text = tNodes.map((t) => t.textContent ?? "").join("");
    result.push({ element: p, tNodes, text });
  }
  return result;
};

export type DocxParagraph = { text: string; runCount: number };

export const readDocxParagraphs = async (docxBuffer: ArrayBuffer): Promise<DocxParagraph[]> => {
  const zip = await JSZip.loadAsync(docxBuffer);
  const xmlFile = zip.file("word/document.xml");
  if (!xmlFile) throw new Error("word/document.xml not found in docx");
  const xmlString = await xmlFile.async("string");
  const xmlDoc = new DOMParser().parseFromString(xmlString, "application/xml");
  if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Failed to parse word/document.xml");
  }
  return collectTextParagraphs(xmlDoc).map((p) => ({ text: p.text, runCount: p.tNodes.length }));
};

export const patchDocxText = async (
  originalBuffer: ArrayBuffer,
  referenceHtml: string,
  editedHtml: string
): Promise<ArrayBuffer> => {
  const refParas = extractParagraphsFromHtml(referenceHtml);
  const editParas = extractParagraphsFromHtml(editedHtml);

  if (editParas.length !== refParas.length) {
    throw new DocxStructuralEditError(refParas.length, editParas.length);
  }

  const zip = await JSZip.loadAsync(originalBuffer);
  const xmlFile = zip.file("word/document.xml");
  if (!xmlFile) throw new DocxComplexityError("word/document.xml missing");
  const xmlString = await xmlFile.async("string");
  const xmlDoc = new DOMParser().parseFromString(xmlString, "application/xml");
  if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Failed to parse word/document.xml");
  }

  const textParas = collectTextParagraphs(xmlDoc);

  if (textParas.length !== refParas.length) {
    throw new DocxComplexityError(
      `paragraph count mismatch: docx has ${textParas.length}, mammoth reference has ${refParas.length}`
    );
  }

  for (let i = 0; i < textParas.length; i++) {
    const docxText = normalize(textParas[i].text);
    const refText = normalize(refParas[i]);
    if (docxText !== refText) {
      throw new DocxComplexityError(`paragraph ${i + 1} text mismatch between docx and mammoth reference`);
    }
  }

  for (let i = 0; i < textParas.length; i++) {
    const { tNodes } = textParas[i];
    const oldTexts = tNodes.map((t) => t.textContent ?? "");
    const pieces = distributeText(oldTexts, editParas[i]);
    for (let j = 0; j < tNodes.length; j++) {
      const piece = pieces[j] ?? "";
      tNodes[j].textContent = piece;
      if (/^\s|\s$/.test(piece)) {
        tNodes[j].setAttribute("xml:space", "preserve");
      }
    }
  }

  const serialized = new XMLSerializer().serializeToString(xmlDoc);
  const xmlWithDecl = serialized.startsWith("<?xml")
    ? serialized
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${serialized}`;

  zip.file("word/document.xml", xmlWithDecl);
  return (await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" })) as ArrayBuffer;
};
