import { useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

type Props = {
  data: ArrayBuffer | null;
};

export const PDFViewer = ({ data }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!data || !canvasRef.current) return;
    let cancelled = false;
    const render = async () => {
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.25 });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [data]);

  return <canvas className="preview-canvas" ref={canvasRef} />;
};
