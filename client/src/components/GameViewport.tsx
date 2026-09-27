import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { WORLD_HEIGHT, WORLD_WIDTH } from "@/game/constants";

/**
 * Fills the available space and uniformly scales the fixed 400×500 logical
 * world to fit both width and height (SPEC §3).
 */
export function GameViewport({ children }: { children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const { width, height } = box.getBoundingClientRect();
      setScale(Math.max(0, Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="flex min-h-0 w-full flex-1 items-center justify-center">
      <div
        className="game-card relative overflow-hidden rounded-2xl border border-slate-300 bg-sky-100 shadow-2xl shadow-slate-400/50"
        style={{ width: WORLD_WIDTH * scale, height: WORLD_HEIGHT * scale }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: WORLD_WIDTH, height: WORLD_HEIGHT, transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
