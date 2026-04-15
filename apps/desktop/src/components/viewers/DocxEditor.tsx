import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";

type Props = {
  initialHtml: string;
  readOnly: boolean;
  onChange: (html: string) => void;
};

export type DocxEditorHandle = {
  reset: () => void;
};

export const DocxEditor = forwardRef<DocxEditorHandle, Props>(({ initialHtml, readOnly, onChange }, ref) => {
  const divRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (divRef.current && divRef.current.innerHTML !== initialHtml) {
      divRef.current.innerHTML = initialHtml;
    }
  }, [initialHtml]);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (divRef.current) divRef.current.innerHTML = initialHtml;
    }
  }), [initialHtml]);

  return (
    <div
      ref={divRef}
      className="docx-preview"
      contentEditable={!readOnly}
      suppressContentEditableWarning
      spellCheck
      onInput={(e) => onChange((e.currentTarget as HTMLDivElement).innerHTML)}
    />
  );
});

DocxEditor.displayName = "DocxEditor";
