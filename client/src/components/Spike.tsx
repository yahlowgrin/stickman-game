import type { Rect } from "@/game/types";

/** A row of red triangular spikes filling the rect. */
export function Spike({ rect }: { rect: Rect }) {
  const count = Math.max(1, Math.round(rect.width / rect.height));
  const w = rect.width / count;
  const points = Array.from({ length: count }, (_, i) => {
    const x = i * w;
    return `${x},${rect.height} ${x + w / 2},1.5 ${x + w},${rect.height}`;
  });
  return (
    <svg
      className="game-spike"
      style={{ left: rect.x, top: rect.y }}
      width={rect.width}
      height={rect.height}
      viewBox={`0 0 ${rect.width} ${rect.height}`}
      aria-hidden="true"
    >
      {points.map((p) => (
        <polygon key={p} points={p} />
      ))}
    </svg>
  );
}
