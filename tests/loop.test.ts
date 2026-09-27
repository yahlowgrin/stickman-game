import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_FRAME_MS, TICK_MS } from "../client/src/game/constants";
import { createGameState, stepGame } from "../client/src/game/engine";
import { createInputController } from "../client/src/game/input";
import { advanceAccumulator } from "../client/src/game/loop";
import type { GameState } from "../client/src/game/types";

/** Simulate one second of wall-clock time at the given display refresh rate. */
function simulateOneSecond(hz: number): { state: GameState; ticks: number } {
  const input = createInputController();
  input.setRight(true);
  input.pressJump();
  let state = createGameState(1);
  let acc = 0;
  let ticks = 0;
  for (let frame = 0; frame < hz; frame++) {
    const r = advanceAccumulator(acc, 1000 / hz);
    acc = r.accumulator;
    for (let i = 0; i < r.steps; i++) {
      state = stepGame(state, input.consume()).state;
      ticks++;
    }
  }
  return { state, ticks };
}

test("60, 120 and 144 Hz frame timing produce identical state after one second", () => {
  const at60 = simulateOneSecond(60);
  const at120 = simulateOneSecond(120);
  const at144 = simulateOneSecond(144);
  assert.equal(at60.ticks, 60);
  assert.equal(at120.ticks, 60);
  assert.equal(at144.ticks, 60);
  assert.deepEqual(at120.state, at60.state);
  assert.deepEqual(at144.state, at60.state);
  assert.ok(at60.state.player.x > 50, "player actually moved");
});

test("accumulator caps long frames to avoid a spiral of death", () => {
  const r = advanceAccumulator(0, 5000);
  assert.equal(r.steps, Math.floor(MAX_FRAME_MS / TICK_MS));
  assert.ok(r.accumulator < TICK_MS);
});

test("jump taps shorter than a tick are latched until consumed", () => {
  const input = createInputController();
  input.pressJump();
  assert.equal(input.consume().jumpPressed, true);
  assert.equal(input.consume().jumpPressed, false);
});
