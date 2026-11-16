import { useId, useRef, useState } from "react";
import type { IndexedClip } from "../core/types";
import { cameraTime, formatDuration, queuePosition } from "../core/indexer";
import { Thumbnail } from "./Thumbnail";
export function SeekBar({
  queue,
  value,
  total,
  onSeek,
  connection,
}: {
  queue: IndexedClip[];
  value: number;
  total: number;
  onSeek: (seconds: number) => void;
  connection: number;
}) {
  const id = useId();
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [preview, setPreview] = useState<{ seconds: number; x: number } | null>(
    null,
  );
  const show = (seconds: number, x?: number) => {
    const width = track.current?.clientWidth || 200;
    setPreview({
      seconds: Math.max(0, Math.min(total, seconds)),
      x: Math.max(
        Math.min(100, width / 2),
        Math.min(
          width - Math.min(100, width / 2),
          x ?? (total ? (seconds / total) * width : 0),
        ),
      ),
    });
  };
  const point = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    show(rect.width ? (x / rect.width) * total : 0, x);
  };
  const target = preview ? queuePosition(queue, preview.seconds) : null;
  const clip = target ? queue[target.index] : null;
  return (
    <div className="seek-row">
      <span>{formatDuration(value)}</span>
      <div
        className="seek-track"
        ref={track}
        onPointerMove={(e) => point(e.clientX)}
        onPointerDown={(e) => {
          dragging.current = true;
          point(e.clientX);
        }}
        onPointerUp={(e) => {
          dragging.current = false;
          if (e.pointerType !== "mouse") setPreview(null);
        }}
        onPointerCancel={() => {
          dragging.current = false;
          setPreview(null);
        }}
        onPointerLeave={() => {
          if (!dragging.current) setPreview(null);
        }}
      >
        <input
          aria-label="Recorded time"
          aria-valuetext={`${formatDuration(value)} of ${formatDuration(total)} recorded`}
          aria-describedby={preview ? id : undefined}
          type="range"
          min="0"
          max={total || 1}
          step="0.1"
          value={Math.min(value, total)}
          onFocus={() => show(value)}
          onBlur={() => {
            dragging.current = false;
            setPreview(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setPreview(null);
          }}
          onChange={(e) => {
            const seconds = +e.target.value;
            show(seconds);
            onSeek(seconds);
          }}
        />
        {preview && clip && target && (
          <div
            id={id}
            role="tooltip"
            className="seek-preview"
            style={{ left: preview.x }}
          >
            <div className="seek-preview-image">
              <Thumbnail clip={clip} connection={connection} />
            </div>
            <div className="seek-preview-time">
              <strong>{formatDuration(preview.seconds)}</strong>
              <span>{cameraTime(clip.effectiveStart + target.at * 1000)}</span>
            </div>
            <p>Recording thumbnail · +{formatDuration(target.at)}</p>
          </div>
        )}
      </div>
      <span>{formatDuration(total)}</span>
    </div>
  );
}
