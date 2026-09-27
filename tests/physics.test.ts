import assert from "node:assert/strict";
import { test } from "node:test";
import { GROUND_Y, PLAYER_HEIGHT, SPAWN_X, WORLD_WIDTH, PLAYER_WIDTH } from "../client/src/game/constants";
import { createEnemyState, createLevelState, stepGame } from "../client/src/game/engine";
import { stepEnemyPatrol } from "../client/src/game/physics";
import { enemy, JUMP, LEFT, makeLevel, NO_INPUT, platform, providerOf, RIGHT, run, ground } from "./helpers";

const STAND_Y = GROUND_Y - PLAYER_HEIGHT;

function grounded(level = makeLevel()) {
  const provider = providerOf(level);
  const s = run(createLevelState(level), 60, NO_INPUT, provider);
  return { s, provider };
}

test("player falls from spawn and lands on the ground", () => {
  const { s } = grounded();
  assert.equal(s.player.y, STAND_Y);
  assert.equal(s.player.vy, 0);
  assert.equal(s.player.onGround, true);
  assert.equal(s.player.x, SPAWN_X);
});

test("holding right moves the player at 5 px per tick", () => {
  const { s, provider } = grounded(makeLevel({ goal: { x: 390, y: 0, width: 10, height: 10 } }));
  const moved = run(s, 10, RIGHT, provider);
  assert.equal(moved.player.x, SPAWN_X + 50);
  assert.equal(moved.player.facing, 1);
});

test("player is clamped to the world edges", () => {
  const { s, provider } = grounded(makeLevel({ goal: { x: 390, y: 0, width: 10, height: 10 } }));
  assert.equal(run(s, 40, LEFT, provider).player.x, 0);
  assert.equal(run(s, 200, RIGHT, provider).player.x, WORLD_WIDTH - PLAYER_WIDTH);
});

test("jump rises about 120 px and lands back on the surface", () => {
  const { s, provider } = grounded();
  let state = stepGame(s, JUMP, provider).state;
  let minY = state.player.y;
  for (let i = 0; i < 60; i++) {
    state = stepGame(state, NO_INPUT, provider).state;
    minY = Math.min(minY, state.player.y);
  }
  const rise = STAND_Y - minY;
  assert.ok(rise >= 110 && rise <= 130, `rise was ${rise}`);
  assert.equal(state.player.y, STAND_Y);
  assert.equal(state.player.onGround, true);
});

test("one-way platform: jump up through it from below and land on top", () => {
  // Platform top at 300 sits 100 px above the ground; the player starts under it.
  const level = makeLevel({ platforms: [ground(0, 400), platform(20, 300, 120)] });
  const provider = providerOf(level);
  let s = createLevelState(level);
  s = run(s, 1, NO_INPUT, provider);
  // Spawn is at y=100 (feet at 180), above the platform: it lands on the platform first.
  s = run(s, 40, NO_INPUT, provider);
  assert.equal(s.player.y, 300 - PLAYER_HEIGHT);

  // Now start on the ground below the platform instead.
  const below = { ...createLevelState(level), player: { ...s.player, y: STAND_Y, onGround: true } };
  let state = stepGame(below, JUMP, provider).state;
  assert.ok(state.player.vy < 0);
  state = run(state, 60, NO_INPUT, provider);
  assert.equal(state.player.y, 300 - PLAYER_HEIGHT, "landed on the platform after passing through it");
  assert.equal(state.player.onGround, true);
});

test("solid ground blocks from the side when fallen into a pit", () => {
  const level = makeLevel({ platforms: [ground(0, 150), ground(250, 150)] });
  const provider = providerOf(level);
  let s = run(createLevelState(level), 60, NO_INPUT, provider);
  s = run(s, 40, RIGHT, provider); // walk off the edge into the pit, then into the far wall
  assert.equal(s.status, "playing");
  assert.ok(s.player.y + PLAYER_HEIGHT > GROUND_Y, "player is below the ground line");
  assert.equal(s.player.x, 250 - PLAYER_WIDTH, "far wall blocks the player");
});

test("enemies patrol and turn at their boundaries", () => {
  let e = createEnemyState(enemy(1, 400, 100, 200, 2));
  let minX = e.x;
  let maxX = e.x;
  const dirs = new Set<number>();
  for (let i = 0; i < 300; i++) {
    e = stepEnemyPatrol(e);
    minX = Math.min(minX, e.x);
    maxX = Math.max(maxX, e.x + e.width);
    dirs.add(e.dir);
  }
  assert.equal(minX, 100);
  assert.equal(maxX, 200);
  assert.deepEqual([...dirs].sort(), [-1, 1]);
});
