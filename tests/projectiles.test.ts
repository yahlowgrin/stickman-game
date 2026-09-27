import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BOSS_INVULN_TICKS,
  MAX_ENEMY_SPEED,
  MIN_SHOOT_COOLDOWN,
  PLAYER_HEIGHT,
  PROJECTILE_SPEED,
  SHOT_CHARGE_TICKS,
  TOXIC_GRAVITY,
  TOXIC_LAUNCH_VY,
} from "../client/src/game/constants";
import { createLevelState, stepGame } from "../client/src/game/engine";
import { platform as platformBuilder } from "../client/src/game/levelBuilders";
import { projectileHitsPlatform } from "../client/src/game/physics";
import type { GameState, ProjectileType } from "../client/src/game/types";
import { enemy, makeLevel, NO_INPUT, providerOf } from "./helpers";

// A goal tucked in the sky, out of the way of every position these tests use.
const AWAY_GOAL = { x: 0, y: 0, width: 1, height: 1 };
// Well above the enemy/ground/spikes (y 320-400), so pinning the player here
// never triggers a stomp, a side hit, or landing — only the shooting logic runs.
const SAFE_Y = 40;

function shooterLevel(type: ProjectileType, cooldown: number, extra: Partial<Parameters<typeof enemy>[5]> = {}) {
  return makeLevel({
    enemies: [enemy(1, 400, 300, 380, 1, { projectileType: type, shootCooldown: cooldown, ...extra })],
    goal: AWAY_GOAL,
  });
}

/** Run n ticks with the player teleported to (x, SAFE_Y) before each one, collecting events. */
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

test("a shooter charges for SHOT_CHARGE_TICKS then fires, resetting its cooldown", () => {
  const level = shooterLevel("fire", 90);
  const provider = providerOf(level);
  let s = createLevelState(level);

  // Player pinned far away (x=0): cooldown (90) then a visible charge (SHOT_CHARGE_TICKS)
  // must elapse before the first shot.
  let firedAt = -1;
  for (let i = 0; i < 90 + SHOT_CHARGE_TICKS + 5; i++) {
    const r = advancePinned(s, 1, 0, provider);
    s = r.state;
    if (r.events.some((e) => e.type === "shoot")) {
      firedAt = i;
      break;
    }
  }
  assert.equal(firedAt, 90 + SHOT_CHARGE_TICKS);
  assert.equal(s.projectiles.length, 1);
  assert.equal(s.projectiles[0].type, "fire");
  assert.equal(s.enemies[0].cooldown, 90, "cooldown resets to the full interval after firing");
});

test("shots are skipped while the player is within the no-shot distance of the muzzle", () => {
  const level = shooterLevel("fire", 10);
  const provider = providerOf(level);
  let s = createLevelState(level);

  // The enemy patrols x in [300, 348] (body width 32, range 300-380); wherever it faces,
  // its muzzle stays within [300, 380]. A player centered at 345 is always < 60px from it.
  const closeX = 345 - 20; // player center at 345
  const close = advancePinned(s, 150, closeX, provider);
  assert.equal(close.state.projectiles.length, 0, "no shot fired while the player stayed close");
  s = close.state;

  // Once the player is far away, the next cooldown expiry fires.
  const far = advancePinned(s, 150, 0, provider);
  assert.ok(far.events.some((e) => e.type === "shoot"), "shot fires once the player moves away");
});

test("fire and lightning projectiles move horizontally at their configured speed", () => {
  for (const type of ["fire", "lightning"] as const) {
    const level = shooterLevel(type, 5);
    const provider = providerOf(level);
    let s = createLevelState(level);
    s = advancePinned(s, 5 + SHOT_CHARGE_TICKS + 1, 0, provider).state;
    assert.equal(s.projectiles.length, 1, type);
    const before = s.projectiles[0];
    s = advancePinned(s, 1, 0, provider).state;
    const after = s.projectiles[0];
    assert.equal(Math.abs(after.x - before.x), PROJECTILE_SPEED[type]);
    assert.equal(after.vy, 0);
  }
});

test("toxic projectiles launch upward then fall under gravity", () => {
  const level = shooterLevel("toxic", 5);
  const provider = providerOf(level);
  let s = createLevelState(level);
  s = advancePinned(s, 5 + SHOT_CHARGE_TICKS + 1, 0, provider).state;
  assert.equal(s.projectiles.length, 1);
  assert.equal(s.projectiles[0].vy, TOXIC_LAUNCH_VY);
  const startY = s.projectiles[0].y;

  let minY = startY;
  for (let i = 0; i < 60 && s.projectiles.length > 0; i++) {
    const prevVy: number = s.projectiles[0].vy;
    s = advancePinned(s, 1, 0, provider).state;
    if (s.projectiles.length === 0) break;
    const p = s.projectiles[0];
    minY = Math.min(minY, p.y);
    assert.ok(Math.abs(p.vy - (prevVy + TOXIC_GRAVITY)) < 1e-9, "gravity applied each tick");
  }
  assert.ok(minY < startY, "the blob rose above its launch height before falling");
});

test("toxic projectiles are removed on hitting a platform; fire and lightning fly through", () => {
  const wall = platformBuilder(0, 0, 400);
  const at = (type: ProjectileType) =>
    ({ id: 1, type, x: 0, y: -8, width: 16, height: 16, vx: 3, vy: 1 }) as const;
  assert.equal(projectileHitsPlatform(at("toxic"), [wall]), true);
  assert.equal(projectileHitsPlatform(at("fire"), [wall]), false);
  assert.equal(projectileHitsPlatform(at("lightning"), [wall]), false);
});

test("projectile leaving the world is removed", () => {
  // A long cooldown so only one shot fires within the test window.
  const level = shooterLevel("lightning", 100);
  const provider = providerOf(level);
  let s = createLevelState(level);
  s = advancePinned(s, 100 + SHOT_CHARGE_TICKS + 1, 0, provider).state;
  assert.equal(s.projectiles.length, 1);
  const firedId = s.projectiles[0].id;
  s = advancePinned(s, 50, 0, provider).state;
  assert.ok(s.projectiles.every((p) => p.id !== firedId), "the fired projectile left the world");
});

test("touching a projectile kills the player with cause 'projectile'", () => {
  const level = shooterLevel("fire", 5);
  const provider = providerOf(level);
  let s = createLevelState(level);
  s = advancePinned(s, 5 + SHOT_CHARGE_TICKS + 1, 0, provider).state;
  assert.equal(s.projectiles.length, 1);

  // Teleport the player exactly onto the projectile (feet aligned with its bottom,
  // so the player's own body doesn't sink into the solid ground) and step once.
  const p = s.projectiles[0];
  const py = p.y + p.height - PLAYER_HEIGHT;
  const hit: GameState = { ...s, player: { ...s.player, x: p.x, y: py, vy: 0, onGround: false } };
  const r = stepGame(hit, NO_INPUT, provider);
  assert.ok(r.events.some((e) => e.type === "death" && e.cause === "projectile"));
  assert.equal(r.state.status, "dead");
  assert.equal(r.state.deathCause, "projectile");
});

test("boss speed and fire rate increase after each non-defeating hit, capped at the minimums/maximum", () => {
  const boss = enemy(1, 400, 150, 350, 1, {
    isBoss: true,
    hp: 6,
    projectileType: "lightning",
    shootCooldown: 100,
  });
  const level = makeLevel({ enemies: [boss], goal: AWAY_GOAL });
  const provider = providerOf(level);
  let s = createLevelState(level);

  const stomp = (state: GameState) => {
    const b = state.enemies[0];
    const withPlayer = {
      ...state,
      player: { ...state.player, x: b.x + 10, y: b.y - PLAYER_HEIGHT - 4, vy: 6, onGround: false },
    };
    return stepGame(withPlayer, NO_INPUT, provider);
  };

  let prevSpeed = s.enemies[0].speed;
  let prevInterval = s.enemies[0].fireInterval;
  for (let hit = 0; hit < 5; hit++) {
    const r = stomp(s);
    s = r.state;
    assert.ok(r.events.some((e) => e.type === "bossHit"));
    assert.ok(s.enemies[0].speed >= prevSpeed);
    assert.ok(s.enemies[0].fireInterval <= prevInterval);
    assert.ok(s.enemies[0].speed <= MAX_ENEMY_SPEED);
    assert.ok(s.enemies[0].fireInterval >= MIN_SHOOT_COOLDOWN.lightning);
    prevSpeed = s.enemies[0].speed;
    prevInterval = s.enemies[0].fireInterval;
    s = advancePinned(s, BOSS_INVULN_TICKS, 0, provider).state;
  }
  assert.ok(prevSpeed > 1, "speed actually increased");
  assert.ok(prevInterval < 100, "fire interval actually decreased");
});
