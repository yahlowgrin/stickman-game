import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BOSS_INVULN_TICKS,
  COMPLETE_TICKS,
  DEATH_TICKS,
  GROUND_Y,
  PLAYER_HEIGHT,
  SPAWN_X,
  SPAWN_Y,
  STOMP_BOUNCE_VELOCITY,
} from "../client/src/game/constants";
import { createLevelState, isGoalLocked, playAgain, stepGame } from "../client/src/game/engine";
import { spikes } from "../client/src/game/levelBuilders";
import type { GameState } from "../client/src/game/types";
import { enemy, goal, makeLevel, NO_INPUT, providerOf, RIGHT, run } from "./helpers";

const STAND_Y = GROUND_Y - PLAYER_HEIGHT;

test("touching spikes kills the player, then respawns at spawn with enemies reset", () => {
  const level = makeLevel({
    spikes: [spikes(200, 400, 40)],
    enemies: [enemy(1, 400, 300, 360, 1)],
  });
  const provider = providerOf(level);
  let s = run(createLevelState(level), 60, NO_INPUT, provider);
  let deathSeen = false;
  for (let i = 0; i < 60 && s.status === "playing"; i++) {
    const r = stepGame(s, RIGHT, provider);
    if (r.events.some((e) => e.type === "death" && e.cause === "spike")) deathSeen = true;
    s = r.state;
  }
  assert.equal(s.status, "dead");
  assert.ok(deathSeen);
  assert.notEqual(s.enemies[0].x, level.enemies[0].x, "enemy moved before death");

  // Input is ignored while dead.
  const frozen = run(s, 10, RIGHT, provider);
  assert.equal(frozen.player.x, s.player.x);

  s = run(s, DEATH_TICKS, RIGHT, provider);
  assert.equal(s.status, "playing");
  assert.equal(s.player.x, SPAWN_X);
  assert.equal(s.player.y, SPAWN_Y);
  assert.equal(s.enemies[0].x, level.enemies[0].x);
  assert.equal(s.enemies[0].alive, true);
});

test("falling out of the world kills the player", () => {
  const level = makeLevel({ platforms: [], goal: goal(360, 400) });
  const provider = providerOf(level);
  let s = createLevelState(level);
  for (let i = 0; i < 120 && s.status === "playing"; i++) s = stepGame(s, NO_INPUT, provider).state;
  assert.equal(s.status, "dead");
  assert.equal(s.deathCause, "fall");
});

function playerAt(state: GameState, x: number, y: number, vy: number): GameState {
  return { ...state, player: { ...state.player, x, y, vy, onGround: false } };
}

test("landing on an enemy from above defeats it and bounces the player", () => {
  const level = makeLevel({ enemies: [enemy(1, 400, 200, 300, 1)] });
  const provider = providerOf(level);
  const base = createLevelState(level);
  const e = base.enemies[0];
  // Feet 6 px above the enemy's top, falling.
  const s = playerAt(base, e.x, e.y - PLAYER_HEIGHT - 6, 8);
  const r = stepGame(s, NO_INPUT, provider);
  assert.equal(r.state.status, "playing");
  assert.equal(r.state.enemies[0].alive, false);
  assert.equal(r.state.player.vy, STOMP_BOUNCE_VELOCITY);
  assert.ok(r.events.some((ev) => ev.type === "stomp" && ev.defeated));
});

test("side contact with an enemy kills the player", () => {
  const level = makeLevel({ enemies: [enemy(1, 400, 150, 300, 1)] });
  const provider = providerOf(level);
  const base = createLevelState(level);
  const s = { ...base, player: { ...base.player, x: base.enemies[0].x + 40, y: STAND_Y, onGround: true } };
  const after = run(s, 20, { left: true, right: false, jumpPressed: false }, provider);
  assert.equal(after.status, "dead");
  assert.equal(after.deathCause, "enemy");
});

test("boss HP drops by exactly one per stomp and the door unlocks only at 0 HP", () => {
  const level = makeLevel({ enemies: [enemy(1, 400, 150, 350, 1, { isBoss: true, hp: 3 })] });
  const provider = providerOf(level);
  let s = createLevelState(level);
  assert.equal(isGoalLocked(s), true);

  const stompOnce = (state: GameState) => {
    const b = state.enemies[0];
    return stepGame(playerAt(state, b.x + 10, b.y - PLAYER_HEIGHT - 4, 6), NO_INPUT, provider);
  };

  let r = stompOnce(s);
  assert.equal(r.state.enemies[0].hp, 2);
  assert.ok(r.state.enemies[0].invulnTicks > 0);
  // A second stomp during invulnerability does not count.
  r = stompOnce(r.state);
  assert.equal(r.state.enemies[0].hp, 2);
  assert.equal(isGoalLocked(r.state), true);

  s = run(r.state, BOSS_INVULN_TICKS, NO_INPUT, provider);
  s = stompOnce(s).state;
  assert.equal(s.enemies[0].hp, 1);
  s = run(s, BOSS_INVULN_TICKS, NO_INPUT, provider);
  r = stompOnce(s);
  assert.equal(r.state.enemies[0].hp, 0);
  assert.equal(r.state.enemies[0].alive, false);
  assert.equal(isGoalLocked(r.state), false);
  assert.ok(r.events.some((e) => e.type === "doorUnlock"));
});

test("locked door cannot be entered while the boss is alive", () => {
  const level = makeLevel({
    enemies: [enemy(1, 400, 250, 350, 1, { isBoss: true, hp: 3 })],
    goal: goal(60, 400),
  });
  const s = run(createLevelState(level), 60, NO_INPUT, providerOf(level));
  assert.equal(s.status, "playing");
});

test("reaching the door advances the level; finishing the last level wins; play again restarts", () => {
  const l1 = makeLevel({ id: 1, goal: goal(150, 400) });
  const l2 = makeLevel({ id: 2, name: "Two", goal: goal(150, 400) });
  const provider = providerOf(l1, l2);
  let s = createLevelState(l1);
  s = run(s, 60, NO_INPUT, provider);
  let completed = false;
  for (let i = 0; i < 60 && s.status === "playing"; i++) {
    const r = stepGame(s, RIGHT, provider);
    completed ||= r.events.some((e) => e.type === "complete");
    s = r.state;
  }
  assert.ok(completed);
  assert.equal(s.status, "complete");
  assert.equal(s.player.vx, 0);

  s = run(s, COMPLETE_TICKS, NO_INPUT, provider);
  assert.equal(s.levelId, 2);
  assert.equal(s.status, "playing");
  assert.equal(s.player.x, SPAWN_X);

  s = run(s, 60, NO_INPUT, provider);
  s = run(s, 60, RIGHT, provider);
  s = run(s, COMPLETE_TICKS, NO_INPUT, provider);
  assert.equal(s.status, "victory");

  const again = playAgain(provider);
  assert.equal(again.levelId, 1);
  assert.equal(again.status, "playing");
});
