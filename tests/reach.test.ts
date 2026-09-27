// Proves the §5 reach table is physically achievable with the real game-step
// code: every maximum (rise, gap) pair can be jumped by running and jumping
// from the take-off edge.

import assert from "node:assert/strict";
import { test } from "node:test";
import { PLAYER_HEIGHT, PLAYER_WIDTH } from "../client/src/game/constants";
import { createLevelState, stepGame } from "../client/src/game/engine";
import { maxGap } from "../client/src/game/validation";
import type { GameState } from "../client/src/game/types";
import { makeLevel, platform, providerOf } from "./helpers";

function canMakeJump(rise: number, gap: number, levelId: number): boolean {
  const takeoffTop = 400;
  const a = platform(0, takeoffTop, 150);
  const b = platform(150 + gap, takeoffTop - rise, 60);
  // The goal is parked out of reach; we only care about landing on B.
  const level = makeLevel({ id: levelId, platforms: [a, b], goal: { x: 0, y: 0, width: 1, height: 1 } });
  const provider = providerOf(level);
  const base = createLevelState(level);
  // Stand as far right on A as possible: only 1 px of the hitbox still over it.
  let s: GameState = {
    ...base,
    player: { ...base.player, x: 150 - 1, y: takeoffTop - PLAYER_HEIGHT, vy: 0, onGround: true },
  };
  for (let i = 0; i < 120 && s.status === "playing"; i++) {
    // Run right until fully over B, then stop steering (as a player would).
    const overB = s.player.x >= b.x && s.player.x + PLAYER_WIDTH <= b.x + b.width;
    s = stepGame(s, { left: false, right: !overB, jumpPressed: i === 0 }, provider).state;
    if (s.player.onGround && s.player.y === b.y - PLAYER_HEIGHT) return true;
  }
  return false;
}

test("every maximum gap in the 70% table is jumpable", () => {
  for (const rise of [-60, 0, 30, 60, 75, 90]) {
    const gap = maxGap(rise, 1)!;
    assert.ok(canMakeJump(rise, gap, 1), `rise ${rise}, gap ${gap}`);
  }
});

test("every maximum gap in the 85% late-game table is jumpable", () => {
  for (const rise of [0, 60, 90]) {
    const gap = maxGap(rise, 150)!;
    assert.ok(canMakeJump(rise, gap, 150), `rise ${rise}, gap ${gap}`);
  }
});

test("a rise well beyond the jump height is not jumpable", () => {
  assert.equal(canMakeJump(120, 0, 1), false);
});
