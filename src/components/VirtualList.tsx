import { useState } from "react";
import type { ReactNode } from "react";
export function VirtualList<T>({
  items,
  rowHeight = 72,
  height = 330,
  render,
  label,
}: {
  items: T[];
  rowHeight?: number;
  height?: number;
  render: (item: T, i: number) => ReactNode;
  label: string;
}) {
  const [scroll, setScroll] = useState(0);
  const start = Math.max(0, Math.floor(scroll / rowHeight) - 2);
  const end = Math.min(
    items.length,
    Math.ceil((scroll + height) / rowHeight) + 2,
  );
  return (
    <div
      className="virtual-list"
      style={{ height: Math.min(height, items.length * rowHeight) }}
      onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
      role="list"
      aria-label={label}
    >
      <div style={{ height: items.length * rowHeight, position: "relative" }}>
        {items.slice(start, end).map((item, j) => (
          <div
            key={start + j}
            role="listitem"
            style={{
              position: "absolute",
              top: (start + j) * rowHeight,
              height: rowHeight,
              left: 0,
              right: 0,
            }}
          >
            {render(item, start + j)}
          </div>
        ))}
      </div>
    </div>
  );
}
