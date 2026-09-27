// Ice balls freeze (immobilize) the player instead of killing them -- the one
// hazard in the game that isn't lethal on contact.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FREEZE_DURATION_TICKS,
  ICE_GRAVITY,
  ICE_LAUNCH_VY,
  PLAYER_HEIGHT,
  SHOT_CHARGE_TICKS,
} from "../client/src/game/constants";
import { createLevelState, stepGame } from "../client/src/game/engine";
import { platform as platformBuilder, spikes } from "../client/src/game/levelBuilders";
import { projectileHitsPlatform } from "../client/src/game/physics";
import { bossHp } from "../client/src/game/sections";
import type { GameState, ProjectileType } from "../client/src/game/types";
import { enemy, makeLevel, NO_INPUT, providerOf } from "./helpers";

const AWAY_GOAL = { x: 0, y: 0, width: 1, height: 1 };
const SAFE_Y = 40;

function iceShooterLevel(cooldown: number) {
  return makeLevel({
    enemies: [enemy(1, 400, 300, 380, 1, { projectileType: "ice", shootCooldown: cooldown })],
    goal: AWAY_GOAL,
  });
}

function advancePinned(s: GameState, n: number, x: number, provider: ReturnType<typeof providerOf>) {
  const events = [];
  for (let i = 0; i < n; i++) {
    const pinned = { ...s, player: { ...s.player, x, y: SAFE_Y, vx: 0, vy: 0, onGround: false } };
    const r = stepGame(pinned, NO_INPUT, provider);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

function fireIceBall(): GameState {
  const level = iceShooterLevel(5);
  const provider = providerOf(level);
  let s = createLevelState(level);
  s = advancePinned(s, 5 + SHOT_CHARGE_TICKS + 1, 0, provider).state;
  assert.equal(s.projectiles.length, 1);
  assert.equal(s.projectiles[0].type, "ice");
  // Let the ball travel a bit further so its position no longer overlaps the
  // shooter's own body -- otherwise "catching" it there would also touch the
  // enemy and die from that instead, which isn't what these tests are after.
  s = advancePinned(s, 5, 0, provider).state;
  assert.equal(s.projectiles.length, 1, "ball is still airborne");
  return s;
}

test("an ice ball freezes the player instead of killing them", () => {
  const provider = providerOf(iceShooterLevel(5));
  const s = fireIceBall();
  const p = s.projectiles[0];
  const py = p.y + p.height - PLAYER_HEIGHT; // align feet with the ball, avoid sinking into the ground
  const hit: GameState = { ...s, player: { ...s.player, x: p.x, y: py, vy: 0, onGround: false } };
  const r = stepGame(hit, NO_INPUT, provider);
  assert.equal(r.state.status, "playing", "freezing does not end the tick or kill the player");
  assert.equal(r.state.player.frozenTicks, FREEZE_DURATION_TICKS);
  assert.ok(r.events.some((e) => e.type === "freeze"));
  assert.ok(r.events.every((e) => e.type !== "death"));
  // The ice ball is consumed on the hit.
  assert.ok(r.state.projectiles.every((proj) => proj.id !== p.id));
});

test("while frozen, movement and jump input are both ignored", () => {
  const level = makeLevel({ goal: AWAY_GOAL });
  const provider = providerOf(level);
  let s = createLevelState(level);
  s = { ...s, player: { ...s.player, x: 100, y: 320, onGround: true, frozenTicks: 30 } };
  const before = s.player.x;
  s = stepGame(s, { left: false, right: true, jumpPressed: true }, provider).state;
  assert.equal(s.player.x, before, "did not move right while frozen");
  assert.ok(s.player.vy >= 0, "did not jump while frozen");
  assert.equal(s.player.frozenTicks, 29, "freeze timer still counts down");
});

test("gravity still applies while frozen (falling is not paused)", () => {
  const level = makeLevel({ goal: AWAY_GOAL });
  const provider = providerOf(level);
  let s = createLevelState(level);
  s = { ...s, player: { ...s.player, x: 100, y: 100, vy: 0, onGround: false, frozenTicks: 30 } };
  const startY = s.player.y;
  s = stepGame(s, { left: true, right: false, jumpPressed: false }, provider).state;
  assert.ok(s.player.y > startY, "still fell under gravity");
  assert.equal(s.player.x, 100, "did not drift left while frozen");
});

test("the freeze wears off on its own after FREEZE_DURATION_TICKS", () => {
  const level = makeLevel({ goal: AWAY_GOAL });
  const provider = providerOf(level);
  let s = createLevelState(level);
  s = { ...s, player: { ...s.player, x: 100, y: 320, onGround: true, frozenTicks: 3 } };
  s = stepGame(s, { left: false, right: true, jumpPressed: false }, provider).state;
  s = stepGame(s, { left: false, right: true, jumpPressed: false }, provider).state;
  assert.equal(s.player.frozenTicks, 1);
  assert.equal(s.player.x, 100, "still frozen, still not moving");
  s = stepGame(s, { left: false, right: true, jumpPressed: false }, provider).state;
  assert.equal(s.player.frozenTicks, 0);
  s = stepGame(s, { left: false, right: true, jumpPressed: false }, provider).state;
  assert.equal(s.player.x, 105, "moves normally again once unfrozen");
});

test("a lethal hazard still kills the player even while frozen", () => {
  const level = makeLevel({ spikes: [spikes(90, 400, 220)], goal: AWAY_GOAL });
  const provider = providerOf(level);
  let s = createLevelState(level);
  s = { ...s, player: { ...s.player, x: 100, y: 320, onGround: true, frozenTicks: 30 } };
  const r = stepGame(s, NO_INPUT, provider);
  assert.equal(r.state.status, "dead");
  assert.equal(r.state.deathCause, "spike");
});

test("ice balls arc under gravity like toxic blobs", () => {
  const level = iceShooterLevel(5);
  const provider = providerOf(level);
  let s = createLevelState(level);
  s = advancePinned(s, 5 + SHOT_CHARGE_TICKS + 1, 0, provider).state;
  assert.equal(s.projectiles[0].vy, ICE_LAUNCH_VY);
  const startY = s.projectiles[0].y;
  let minY = startY;
  for (let i = 0; i < 60 && s.projectiles.length > 0; i++) {
    const prevVy: number = s.projectiles[0].vy;
    const pinned = { ...s, player: { ...s.player, x: 0, y: SAFE_Y, vx: 0, vy: 0, onGround: false } };
    s = stepGame(pinned, NO_INPUT, provider).state;
    if (s.projectiles.length === 0) break;
    const p = s.projectiles[0];
    minY = Math.min(minY, p.y);
    assert.ok(Math.abs(p.vy - (prevVy + ICE_GRAVITY)) < 1e-9, "gravity applied each tick");
  }
  assert.ok(minY < startY, "the ice ball rose above its launch height before falling");
});

test("ice balls, like toxic, are removed on hitting a platform", () => {
  const wall = platformBuilder(0, 0, 400);
  const at = (type: ProjectileType) =>
    ({ id: 1, type, x: 0, y: -8, width: 16, height: 16, vx: 3, vy: 1 }) as const;
  assert.equal(projectileHitsPlatform(at("ice"), [wall]), true);
});

test("levels 101-150 are the ice section, 151-200 remain toxic", async () => {
  const { sectionFor } = await import("../client/src/game/sections");
  assert.equal(sectionFor(100), "lightning");
  assert.equal(sectionFor(101), "ice");
  assert.equal(sectionFor(150), "ice");
  assert.equal(sectionFor(151), "toxic");
  assert.equal(sectionFor(200), "toxic");
});

test("ice section bosses (110-150) and toxic bosses (160-200) both ramp to sensible HP", () => {
  assert.deepEqual([110, 120, 130, 140, 150].map(bossHp), [6, 7, 7, 8, 9]);
  assert.deepEqual([160, 170, 180, 190, 200].map(bossHp), [6, 7, 8, 9, 10]);
});
