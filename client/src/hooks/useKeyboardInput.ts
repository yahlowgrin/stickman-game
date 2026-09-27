import { useEffect } from "react";
import type { InputController } from "@/game/input";

const LEFT_KEYS = new Set(["ArrowLeft"]);
const RIGHT_KEYS = new Set(["ArrowRight"]);
const JUMP_KEYS = new Set([" ", "Spacebar", "ArrowUp"]);
const BLOCKED_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Spacebar"]);

/** Maps the keyboard onto the shared input controller while `enabled`. */
export function useKeyboardInput(controller: InputController, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      if (BLOCKED_KEYS.has(e.key)) e.preventDefault();
      if (LEFT_KEYS.has(e.key)) controller.setLeft(true);
      else if (RIGHT_KEYS.has(e.key)) controller.setRight(true);
      else if (JUMP_KEYS.has(e.key) && !e.repeat) controller.pressJump();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (BLOCKED_KEYS.has(e.key)) e.preventDefault();
      if (LEFT_KEYS.has(e.key)) controller.setLeft(false);
      else if (RIGHT_KEYS.has(e.key)) controller.setRight(false);
    };
    const onBlur = () => controller.reset();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      controller.reset();
    };
  }, [controller, enabled]);
}
