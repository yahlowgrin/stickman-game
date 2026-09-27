// Fixed-timestep accumulator (SPEC §4). Pure so it can be tested with
// synthetic 60/120/144 Hz frame timings.

import { ACCUMULATOR_EPSILON_MS, MAX_FRAME_MS, TICK_MS } from "./constants";

export type AccumulatorResult = {
  /** Number of fixed ticks to simulate this frame. */
  steps: number;
  /** Leftover time carried into the next frame. */
  accumulator: number;
};

export function advanceAccumulator(accumulator: number, frameMs: number): AccumulatorResult {
  const delta = Math.min(Math.max(frameMs, 0), MAX_FRAME_MS);
  const total = accumulator + delta;
  const steps = Math.floor((total + ACCUMULATOR_EPSILON_MS) / TICK_MS);
  return { steps, accumulator: Math.max(0, total - steps * TICK_MS) };
}
