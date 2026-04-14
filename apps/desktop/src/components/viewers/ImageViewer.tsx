import { useMemo, useState } from "react";

type Props = {
  src: string | null;
  readOnly: boolean;
};

export const ImageViewer = ({ src, readOnly }: Props) => {
  const [drawMode, setDrawMode] = useState(false);
  const [paths, setPaths] = useState<Array<Array<{ x: number; y: number }>>>([]);
  const [activePath, setActivePath] = useState<Array<{ x: number; y: number }>>([]);

  const svgPathData = useMemo(
    () =>
      [...paths, activePath]
        .filter((p) => p.length > 1)
        .map((path) => `M ${path.map((point) => `${point.x},${point.y}`).join(" L ")}`),
    [paths, activePath]
  );

  return (
    <div className="image-annotator">
      <div className="row-wrap">
        <button disabled={readOnly} onClick={() => setDrawMode((v) => !v)}>
          {drawMode ? "Stop Annotate" : "Annotate"}
        </button>
        <button
          disabled={readOnly || paths.length === 0}
          onClick={() => {
            setPaths((prev) => prev.slice(0, -1));
          }}
        >
          Undo
        </button>
      </div>
      {src ? (
        <div
          className="image-stage"
          onMouseDown={(event) => {
            if (!drawMode || readOnly) return;
            const rect = event.currentTarget.getBoundingClientRect();
            setActivePath([{ x: event.clientX - rect.left, y: event.clientY - rect.top }]);
          }}
          onMouseMove={(event) => {
            if (!drawMode || readOnly || activePath.length === 0) return;
            const rect = event.currentTarget.getBoundingClientRect();
            setActivePath((prev) => [...prev, { x: event.clientX - rect.left, y: event.clientY - rect.top }]);
          }}
          onMouseUp={() => {
            if (!drawMode || readOnly || activePath.length === 0) return;
            setPaths((prev) => [...prev, activePath]);
            setActivePath([]);
          }}
        >
          <img className="preview-image" src={src} alt="Preview" />
          <svg className="annotation-layer">
            {svgPathData.map((d, idx) => (
              <path key={`${idx}-${d.length}`} d={d} fill="none" stroke="#ff496d" strokeWidth="2" />
            ))}
          </svg>
        </div>
      ) : null}
    </div>
  );
};
