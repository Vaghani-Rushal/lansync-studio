// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import JSZip from "jszip";
import {
  patchDocxText,
  extractParagraphsFromHtml,
  distributeText,
  readDocxParagraphs,
  DocxStructuralEditError,
  DocxComplexityError
} from "../docxPatcher";

const WORD_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

const buildDocumentXml = (paragraphs: Array<{ runs: Array<{ text: string; preserve?: boolean }> }>): string => {
  const body = paragraphs
    .map((p) => {
      const runs = p.runs
        .map((r) => {
          const preserve = r.preserve ? ' xml:space="preserve"' : "";
          return `<w:r><w:t${preserve}>${r.text}</w:t></w:r>`;
        })
        .join("");
      return `<w:p>${runs}</w:p>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${WORD_NS}>
  <w:body>
    ${body}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>
  </w:body>
</w:document>`;
};

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${WORD_NS}><w:docDefaults><w:rPrDefault/></w:docDefaults></w:styles>`;
const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const buildDocx = async (paragraphs: Array<{ runs: Array<{ text: string; preserve?: boolean }> }>): Promise<ArrayBuffer> => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
  zip.file("_rels/.rels", RELS_XML);
  zip.file("word/document.xml", buildDocumentXml(paragraphs));
  zip.file("word/styles.xml", STYLES_XML);
  return (await zip.generateAsync({ type: "arraybuffer" })) as ArrayBuffer;
};

const readZipFile = async (buffer: ArrayBuffer, path: string): Promise<string> => {
  const zip = await JSZip.loadAsync(buffer);
  const f = zip.file(path);
  if (!f) throw new Error(`${path} not found`);
  return f.async("string");
};

const readZipBytes = async (buffer: ArrayBuffer, path: string): Promise<Uint8Array> => {
  const zip = await JSZip.loadAsync(buffer);
  const f = zip.file(path);
  if (!f) throw new Error(`${path} not found`);
  return f.async("uint8array");
};

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

describe("extractParagraphsFromHtml", () => {
  it("extracts paragraphs from simple html", () => {
    expect(extractParagraphsFromHtml("<p>a</p><p>b</p>")).toEqual(["a", "b"]);
  });

  it("treats list items as paragraphs", () => {
    expect(extractParagraphsFromHtml("<p>a</p><ul><li>x</li><li>y</li></ul>")).toEqual(["a", "x", "y"]);
  });

  it("normalizes whitespace", () => {
    expect(extractParagraphsFromHtml("<p>  hello   world  </p>")).toEqual(["hello world"]);
  });

  it("returns body text when no block children", () => {
    expect(extractParagraphsFromHtml("hello")).toEqual(["hello"]);
  });
});

describe("distributeText", () => {
  it("returns [edited] for single run", () => {
    expect(distributeText(["original"], "new")).toEqual(["new"]);
  });

  it("returns empty strings for empty edit", () => {
    expect(distributeText(["a", "b"], "")).toEqual(["", ""]);
  });

  it("proportionally splits text across multiple runs", () => {
    // original runs: "He" (2), "llo" (3) → total 5
    // edited "Howdy" (5) → first run gets round(2/5*5)=2, last gets the rest
    expect(distributeText(["He", "llo"], "Howdy")).toEqual(["Ho", "wdy"]);
  });

  it("puts everything in last run when all originals empty", () => {
    expect(distributeText(["", "", ""], "x")).toEqual(["", "", "x"]);
  });

  it("returns [] for empty originals", () => {
    expect(distributeText([], "x")).toEqual([]);
  });
});

describe("readDocxParagraphs", () => {
  it("returns paragraphs with text and run count", async () => {
    const buf = await buildDocx([
      { runs: [{ text: "Hello world" }] },
      { runs: [{ text: "Second paragraph" }] }
    ]);
    const paras = await readDocxParagraphs(buf);
    expect(paras).toEqual([
      { text: "Hello world", runCount: 1 },
      { text: "Second paragraph", runCount: 1 }
    ]);
  });

  it("skips paragraphs with no text runs (like sectPr-only)", async () => {
    const buf = await buildDocx([{ runs: [{ text: "Only one" }] }]);
    const paras = await readDocxParagraphs(buf);
    expect(paras).toHaveLength(1);
    expect(paras[0].text).toBe("Only one");
  });
});

describe("patchDocxText", () => {
  let originalBuffer: ArrayBuffer;
  const referenceHtml = "<p>Hello world</p><p>Second paragraph</p>";

  beforeAll(async () => {
    originalBuffer = await buildDocx([
      { runs: [{ text: "Hello world" }] },
      { runs: [{ text: "Second paragraph" }] }
    ]);
  });

  it("no-op round-trip preserves text and non-document files", async () => {
    const patched = await patchDocxText(originalBuffer, referenceHtml, referenceHtml);
    const paras = await readDocxParagraphs(patched);
    expect(paras.map((p) => p.text)).toEqual(["Hello world", "Second paragraph"]);

    const origStyles = await readZipBytes(originalBuffer, "word/styles.xml");
    const patchedStyles = await readZipBytes(patched, "word/styles.xml");
    expect(bytesEqual(origStyles, patchedStyles)).toBe(true);

    const origRels = await readZipBytes(originalBuffer, "_rels/.rels");
    const patchedRels = await readZipBytes(patched, "_rels/.rels");
    expect(bytesEqual(origRels, patchedRels)).toBe(true);
  });

  it("single-paragraph edit replaces only the first paragraph", async () => {
    const edited = "<p>Hello Venus</p><p>Second paragraph</p>";
    const patched = await patchDocxText(originalBuffer, referenceHtml, edited);
    const paras = await readDocxParagraphs(patched);
    expect(paras.map((p) => p.text)).toEqual(["Hello Venus", "Second paragraph"]);
  });

  it("throws DocxStructuralEditError when paragraph count shrinks", async () => {
    const edited = "<p>Hello world</p>";
    await expect(patchDocxText(originalBuffer, referenceHtml, edited)).rejects.toBeInstanceOf(
      DocxStructuralEditError
    );
  });

  it("throws DocxStructuralEditError when paragraph count grows", async () => {
    const edited = "<p>Hello world</p><p>Second paragraph</p><p>Extra</p>";
    try {
      await patchDocxText(originalBuffer, referenceHtml, edited);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(DocxStructuralEditError);
      expect((err as DocxStructuralEditError).originalParagraphs).toBe(2);
      expect((err as DocxStructuralEditError).editedParagraphs).toBe(3);
    }
  });

  it("throws DocxComplexityError when reference HTML does not match docx text", async () => {
    const wrongReference = "<p>Totally different</p><p>Second paragraph</p>";
    await expect(
      patchDocxText(originalBuffer, wrongReference, wrongReference)
    ).rejects.toBeInstanceOf(DocxComplexityError);
  });

  it("preserves whitespace by setting xml:space=preserve when new text has trailing space", async () => {
    const buf = await buildDocx([{ runs: [{ text: "plain" }] }]);
    const refHtml = "<p>plain</p>";
    const editedHtml = "<p>plain </p>"; // extra trailing space (but normalize trims it...)
    // normalize() trims, so we actually verify multi-run distribution preserves attribute.
    // Use internal space: "plain text" -> split across runs.
    const buf2 = await buildDocx([{ runs: [{ text: "foo" }, { text: "bar" }] }]);
    const patched = await patchDocxText(buf2, "<p>foobar</p>", "<p>foo bar</p>");
    const xml = await readZipFile(patched, "word/document.xml");
    // first run got "foo ", trailing space → should have preserve
    expect(xml).toContain('xml:space="preserve"');
    // Suppress unused warnings from intentional earlier setup
    void buf;
    void refHtml;
    void editedHtml;
  });

  it("distributes edits across multiple runs in one paragraph", async () => {
    const buf = await buildDocx([
      { runs: [{ text: "Hello " }, { text: "world" }] }
    ]);
    const patched = await patchDocxText(buf, "<p>Hello world</p>", "<p>Howdy earth</p>");
    const paras = await readDocxParagraphs(patched);
    expect(paras[0].text).toBe("Howdy earth");
    expect(paras[0].runCount).toBe(2);
  });
});
