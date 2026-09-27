import { isGround } from "@/game/physics";
import type { Rect } from "@/game/types";

export function Platform({ rect }: { rect: Rect }) {
  return (
    <div
      className={isGround(rect) ? "game-ground" : "game-platform"}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
    />
  );
}
