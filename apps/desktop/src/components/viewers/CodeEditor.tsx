import Editor from "@monaco-editor/react";

type Props = {
  value: string;
  readOnly: boolean;
  onChange: (value: string) => void;
};

export const CodeEditor = ({ value, readOnly, onChange }: Props) => (
  <Editor
    height="380px"
    language="plaintext"
    value={value}
    options={{
      readOnly,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 13
    }}
    onChange={(next) => onChange(next ?? "")}
  />
);
