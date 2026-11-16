import { useEffect, useRef, useState } from "react";
import type { IndexedClip } from "../core/types";
import { cameraTime } from "../core/indexer";
import { ChevronLeft, ChevronRight } from "./Icons";
import { Thumbnail } from "./Thumbnail";
const CELL = 164;
export function Filmstrip({
  clips,
  currentId,
  onSelect,
  connection,
}: {
  clips: IndexedClip[];
  currentId: string;
  onSelect: (c: IndexedClip) => void;
  connection: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(0);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = ref.current!;
    const i = clips.findIndex((c) => c.id === currentId);
    if (
      i >= 0 &&
      (i * CELL < el.scrollLeft ||
        (i + 1) * CELL > el.scrollLeft + el.clientWidth)
    )
      el.scrollTo({
        left: Math.max(0, i * CELL - el.clientWidth / 2 + CELL / 2),
        behavior: "instant",
      });
  }, [currentId, clips]);
  const first = Math.max(0, Math.floor(left / CELL) - 2),
    last = Math.min(clips.length, Math.ceil((left + width) / CELL) + 2);
  return (
    <section className="filmstrip" aria-label="Recordings">
      <div className="section-line">
        <h2>
          Recordings <span>{clips.length}</span>
        </h2>
        {clips.length * CELL - 12 > width && (
          <div>
            <button
              className="icon-button small"
              aria-label="Scroll recordings left"
              disabled={left <= 0}
              onClick={() => ref.current?.scrollBy({ left: -CELL * 3 })}
            >
              <ChevronLeft />
            </button>
            <button
              className="icon-button small"
              aria-label="Scroll recordings right"
              disabled={left + width >= clips.length * CELL - 1}
              onClick={() => ref.current?.scrollBy({ left: CELL * 3 })}
            >
              <ChevronRight />
            </button>
          </div>
        )}
      </div>
      <div
        ref={ref}
        className="filmstrip-scroll"
        onScroll={(e) => setLeft(e.currentTarget.scrollLeft)}
      >
        <div
          style={{
            width: clips.length * CELL,
            height: 124,
            position: "relative",
          }}
        >
          {clips.slice(first, last).map((c, j) => (
            <button
              key={c.id}
              className={`film-cell ${c.id === currentId ? "selected" : ""}`}
              style={{
                position: "absolute",
                left: (first + j) * CELL,
                width: CELL - 12,
              }}
              aria-label={`Play recording ${cameraTime(c.effectiveStart)}`}
              aria-current={c.id === currentId ? "true" : undefined}
              onClick={() => onSelect(c)}
            >
              <div className="thumb">
                <Thumbnail clip={c} connection={connection} />
                {c.id === currentId && (
                  <span className="playing-tag">Selected</span>
                )}
              </div>
              <span className="clip-time">
                {cameraTime(c.effectiveStart)}
                <span>{Math.round(c.duration)}s</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
