import type { InputState } from "./types";

/**
 * Collects input from keyboard and (phase 4) touch buttons between ticks.
 * Jump presses are latched so a tap shorter than one tick is never lost.
 */
export type InputController = {
  setLeft: (down: boolean) => void;
  setRight: (down: boolean) => void;
  pressJump: () => void;
  /** Sample input for one simulation tick (consumes the jump latch). */
  consume: () => InputState;
  reset: () => void;
};

export function createInputController(): InputController {
  let left = false;
  let right = false;
  let jumpQueued = false;
  return {
    setLeft: (down) => {
      left = down;
    },
    setRight: (down) => {
      right = down;
    },
    pressJump: () => {
      jumpQueued = true;
    },
    consume: () => {
      const input = { left, right, jumpPressed: jumpQueued };
      jumpQueued = false;
      return input;
    },
    reset: () => {
      left = false;
      right = false;
      jumpQueued = false;
    },
  };
}
