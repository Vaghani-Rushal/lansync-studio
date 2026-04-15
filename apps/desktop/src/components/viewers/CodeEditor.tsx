import Editor from "@monaco-editor/react";

type Props = {
  value: string;
  readOnly: boolean;
  onChange: (value: string) => void;
};

export const CodeEditor = ({ value, readOnly, onChange }: Props) => (
  <div className="github-editor-body">
    <Editor
      height="100%"
      theme="vs-dark"
      language="plaintext"
      value={value}
      options={{
        readOnly,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        lineNumbers: "on",
        lineNumbersMinChars: 4,
        glyphMargin: false,
        folding: true,
        renderLineHighlight: "line",
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
        renderWhitespace: "none",
        guides: { indentation: true },
        bracketPairColorization: { enabled: true },
        fontFamily: '"JetBrains Mono", "SF Mono", ui-monospace, "Cascadia Code", Menlo, Consolas, monospace',
        fontLigatures: true,
        tabSize: 2,
        wordWrap: "on",
        padding: { top: 12, bottom: 12 },
      }}
      onChange={(next) => onChange(next ?? "")}
    />
  </div>
);
