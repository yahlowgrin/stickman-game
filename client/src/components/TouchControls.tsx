import { ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import type { InputController } from "@/game/input";
import { useTouchControls } from "@/hooks/useTouchControls";

/**
 * On-screen Left/Right (bottom-left) and Jump (bottom-right) buttons, ≥56px
 * (SPEC §6). Shown only on touch-capable devices via the `(pointer: coarse)`
 * media query in CSS — always mounted, never JS-detected, so it can't get out
 * of sync with the actual input device.
 */
export function TouchControls({ input }: { input: InputController }) {
  const { left, right, jump } = useTouchControls(input);

  return (
    <div className="touch-controls" aria-hidden="false">
      <div className="touch-group touch-group-move">
        <button type="button" className="touch-btn" aria-label="Move left" {...left}>
          <ArrowLeft strokeWidth={2.5} />
        </button>
        <button type="button" className="touch-btn" aria-label="Move right" {...right}>
          <ArrowRight strokeWidth={2.5} />
        </button>
      </div>
      <button type="button" className="touch-btn touch-jump" aria-label="Jump" {...jump}>
        <ArrowUp strokeWidth={2.5} />
      </button>
    </div>
  );
}
