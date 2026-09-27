import { useCallback } from "react";
import type { InputController } from "@/game/input";

/**
 * Pointer handlers for one on-screen button. Pointer events (not touch/mouse)
 * naturally support multi-touch: each simultaneously-pressed button gets its
 * own pointer id, so holding a direction and jumping at once just works
 * without any manual tracking (SPEC §6).
 */
export function useHoldButton(onDown: () => void, onUp: () => void) {
  const down = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      onDown();
    },
    [onDown],
  );
  const up = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      onUp();
    },
    [onUp],
  );
  return { onPointerDown: down, onPointerUp: up, onPointerLeave: up, onPointerCancel: up };
}

export function useTapButton(onTap: () => void) {
  const down = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      onTap();
    },
    [onTap],
  );
  return { onPointerDown: down };
}

export type TouchHandlers = {
  left: ReturnType<typeof useHoldButton>;
  right: ReturnType<typeof useHoldButton>;
  jump: ReturnType<typeof useTapButton>;
};

/** Wires the three on-screen buttons to the shared input controller. */
export function useTouchControls(input: InputController): TouchHandlers {
  const left = useHoldButton(
    useCallback(() => input.setLeft(true), [input]),
    useCallback(() => input.setLeft(false), [input]),
  );
  const right = useHoldButton(
    useCallback(() => input.setRight(true), [input]),
    useCallback(() => input.setRight(false), [input]),
  );
  const jump = useTapButton(useCallback(() => input.pressJump(), [input]));
  return { left, right, jump };
}
