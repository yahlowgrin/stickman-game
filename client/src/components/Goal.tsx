import type { Ref } from "react";
import { DoorOpen } from "lucide-react";
import type { Rect } from "@/game/types";

/** Glowing gold exit door. `data-locked` is set imperatively on boss levels. */
export function Goal({ rect, goalRef }: { rect: Rect; goalRef: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={goalRef}
      className="game-goal"
      data-locked="false"
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
      aria-label="Exit door"
      role="img"
    >
      <DoorOpen className="game-goal-icon" strokeWidth={2.5} aria-hidden="true" />
    </div>
  );
}
