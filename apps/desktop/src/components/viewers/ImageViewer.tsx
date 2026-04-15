import { useMemo, useState } from "react";

type Props = {
  src: string | null;
  readOnly: boolean;
};

export const ImageViewer = ({ src, readOnly }: Props) => {
  const [drawMode, setDrawMode] = useState(false);
  const [paths, setPaths] = useState<Array<Array<{ x: number; y: number }>>>([]);
  const [activePath, setActivePath] = useState<Array<{ x: number; y: number }>>([]);
  const [zoom, setZoom] = useState(1);

  const svgPathData = useMemo(
    () =>
      [...paths, activePath]
        .filter((p) => p.length > 1)
        .map((path) => `M ${path.map((point) => `${point.x},${point.y}`).join(" L ")}`),
    [paths, activePath]
  );

  const clearAll = () => {
    setPaths([]);
    setActivePath([]);
  };

  return (
    <div className="image-annotator">
      <div className="image-toolbar">
        <div className="image-toolbar-group">
          <button
            className={drawMode ? "primary-btn" : "ghost-btn"}
            disabled={readOnly}
            onClick={() => setDrawMode((v) => !v)}
          >
            {drawMode ? "✏ Drawing" : "✏ Annotate"}
          </button>
          <button
            className="ghost-btn"
            disabled={readOnly || paths.length === 0}
            onClick={() => setPaths((prev) => prev.slice(0, -1))}
          >
            ↶ Undo
          </button>
          <button
            className="ghost-btn"
            disabled={readOnly || paths.length === 0}
            onClick={clearAll}
          >
            Clear
          </button>
        </div>
        <div className="image-toolbar-group">
          <button className="ghost-btn" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} disabled={zoom <= 0.25}>
            −
          </button>
          <span className="zoom-indicator">{Math.round(zoom * 100)}%</span>
          <button className="ghost-btn" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} disabled={zoom >= 4}>
            +
          </button>
          <button className="ghost-btn" onClick={() => setZoom(1)} disabled={zoom === 1}>
            Reset
          </button>
        </div>
      </div>
      {src ? (
        <div className="image-canvas">
          <div
            className="image-stage"
            style={{ transform: `scale(${zoom})` }}
            onMouseDown={(event) => {
              if (!drawMode || readOnly) return;
              const rect = event.currentTarget.getBoundingClientRect();
              setActivePath([{ x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom }]);
            }}
            onMouseMove={(event) => {
              if (!drawMode || readOnly || activePath.length === 0) return;
              const rect = event.currentTarget.getBoundingClientRect();
              setActivePath((prev) => [...prev, { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom }]);
            }}
            onMouseUp={() => {
              if (!drawMode || readOnly || activePath.length === 0) return;
              setPaths((prev) => [...prev, activePath]);
              setActivePath([]);
            }}
          >
            <img className="preview-image" src={src} alt="Preview" draggable={false} />
            <svg className="annotation-layer">
              {svgPathData.map((d, idx) => (
                <path key={`${idx}-${d.length}`} d={d} fill="none" stroke="#ff6363" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </svg>
          </div>
        </div>
      ) : null}
    </div>
  );
};
