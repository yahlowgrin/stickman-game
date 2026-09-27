// Pure movement and collision functions: state in, state out.
// No React or DOM imports — shared by the game loop, tests, and the validator.

import {
  COYOTE_TICKS,
  GRAVITY,
  GROUND_Y,
  ICE_GRAVITY,
  JUMP_BUFFER_TICKS,
  JUMP_VELOCITY,
  LAND_EVENT_MIN_VY,
  MAX_FALL_SPEED,
  MOVE_SPEED,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  SPAWN_X,
  SPAWN_Y,
  SPIKE_HITBOX_INSET,
  STOMP_TOLERANCE,
  TOXIC_GRAVITY,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./constants";
import type { EnemyState, InputState, Level, PlayerState, ProjectileState, Rect } from "./types";

// Geometry --------------------------------------------------------------------

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function overlapsHorizontally(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x;
}

export function playerRect(p: PlayerState): Rect {
  return { x: p.x, y: p.y, width: PLAYER_WIDTH, height: PLAYER_HEIGHT };
}

export function enemyRect(e: EnemyState): Rect {
  return { x: e.x, y: e.y, width: e.width, height: e.height };
}

/** Surfaces whose top is at or below the ground line are solid ground; the rest are one-way platforms. */
export function isGround(surface: Rect): boolean {
  return surface.y >= GROUND_Y;
}

export function spikeHitbox(spike: Rect): Rect {
  const inset = Math.min(SPIKE_HITBOX_INSET, spike.width / 4, spike.height / 4);
  return {
    x: spike.x + inset,
    y: spike.y + inset,
    width: spike.width - inset * 2,
    height: spike.height - inset,
  };
}

// Player ----------------------------------------------------------------------

export function createPlayer(): PlayerState {
  return {
    x: SPAWN_X,
    y: SPAWN_Y,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    coyoteTicks: 0,
    jumpBufferTicks: 0,
    frozenTicks: 0,
  };
}

export type PlayerStepResult = {
  player: PlayerState;
  jumped: boolean;
  landed: boolean;
};

/**
 * Advance the player one tick: input, jump, gravity, one-way platform landing,
 * solid ground side collisions and world-edge clamping.
 */
export function stepPlayer(
  prev: PlayerState,
  input: InputState,
  platforms: readonly Rect[],
): PlayerStepResult {
  const p: PlayerState = { ...prev };
  let jumped = false;

  // Frozen (hit by an ice ball): ignore movement and jump input entirely,
  // but gravity and falling still apply below as normal.
  const frozen = p.frozenTicks > 0;
  if (frozen) p.frozenTicks -= 1;

  // Horizontal intent.
  const dir = frozen ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
  p.vx = dir * MOVE_SPEED;
  if (dir !== 0) p.facing = dir > 0 ? 1 : -1;

  // Jump with buffering and coyote time.
  p.jumpBufferTicks =
    !frozen && input.jumpPressed ? JUMP_BUFFER_TICKS : Math.max(0, p.jumpBufferTicks - 1);
  p.coyoteTicks = p.onGround ? COYOTE_TICKS : Math.max(0, p.coyoteTicks - 1);
  if (p.jumpBufferTicks > 0 && p.coyoteTicks > 0) {
    p.vy = JUMP_VELOCITY;
    p.jumpBufferTicks = 0;
    p.coyoteTicks = 0;
    p.onGround = false;
    jumped = true;
  }

  // Horizontal move, then clamp and resolve against solid ground blocks.
  p.x += p.vx;
  p.x = clamp(p.x, 0, WORLD_WIDTH - PLAYER_WIDTH);
  for (const s of platforms) {
    if (!isGround(s)) continue;
    const r = playerRect(p);
    // Standing on (or above) the block's top is not a side hit.
    if (!rectsOverlap(r, s) || r.y + r.height <= s.y + 1) continue;
    const pushLeft = s.x - PLAYER_WIDTH;
    const pushRight = s.x + s.width;
    if (p.vx > 0) p.x = pushLeft;
    else if (p.vx < 0) p.x = pushRight;
    else p.x = Math.abs(p.x - pushLeft) < Math.abs(p.x - pushRight) ? pushLeft : pushRight;
  }

  // Vertical: semi-implicit Euler.
  const prevBottom = p.y + PLAYER_HEIGHT;
  const wasOnGround = p.onGround;
  p.vy = Math.min(p.vy + GRAVITY, MAX_FALL_SPEED);
  p.y += p.vy;
  p.onGround = false;

  let landed = false;
  if (p.vy >= 0) {
    const landing = findLandingSurface(p.x, prevBottom, p.y + PLAYER_HEIGHT, platforms);
    if (landing) {
      landed = !wasOnGround && p.vy >= LAND_EVENT_MIN_VY;
      p.y = landing.y - PLAYER_HEIGHT;
      p.vy = 0;
      p.onGround = true;
    }
  }

  return { player: p, jumped, landed };
}

/**
 * One-way landing: the highest surface whose top the player's feet crossed
 * this tick (moving down) while overlapping it horizontally.
 */
export function findLandingSurface(
  x: number,
  prevBottom: number,
  newBottom: number,
  platforms: readonly Rect[],
): Rect | null {
  let best: Rect | null = null;
  const r = { x, y: 0, width: PLAYER_WIDTH, height: 1 };
  for (const s of platforms) {
    if (!overlapsHorizontally(r, s)) continue;
    if (prevBottom <= s.y && newBottom >= s.y) {
      if (!best || s.y < best.y) best = s;
    }
  }
  return best;
}

// Enemies ---------------------------------------------------------------------

/** Patrol between startX and endX (body edges), turning at the boundaries. */
export function stepEnemyPatrol(prev: EnemyState): EnemyState {
  if (!prev.alive) return prev;
  const e: EnemyState = { ...prev };
  e.x += e.speed * e.dir;
  const minX = e.def.startX;
  const maxX = e.def.endX - e.width;
  if (e.x <= minX) {
    e.x = minX;
    e.dir = 1;
  } else if (e.x >= maxX) {
    e.x = maxX;
    e.dir = -1;
  }
  if (e.invulnTicks > 0) e.invulnTicks -= 1;
  return e;
}

export type EnemyContact = "none" | "stomp" | "hit";

/**
 * Classify player/enemy contact. A stomp requires the player to be falling
 * and their feet to have been at or above the enemy's top on the previous tick.
 */
export function classifyEnemyContact(
  player: PlayerState,
  prevPlayerBottom: number,
  enemy: EnemyState,
): EnemyContact {
  if (!enemy.alive) return "none";
  if (!rectsOverlap(playerRect(player), enemyRect(enemy))) return "none";
  if (player.vy > 0 && prevPlayerBottom <= enemy.y + STOMP_TOLERANCE) return "stomp";
  return "hit";
}

// Projectiles -------------------------------------------------------------------

export function projectileRect(p: ProjectileState): Rect {
  return { x: p.x, y: p.y, width: p.width, height: p.height };
}

const ARC_GRAVITY: Partial<Record<ProjectileState["type"], number>> = { toxic: TOXIC_GRAVITY, ice: ICE_GRAVITY };

/** Move a projectile one tick; toxic and ice arc under gravity, others fly straight. */
export function stepProjectile(p: ProjectileState): ProjectileState {
  const gravity = ARC_GRAVITY[p.type];
  const vy = gravity !== undefined ? p.vy + gravity : p.vy;
  return { ...p, x: p.x + p.vx, y: p.y + vy, vy };
}

export function isProjectileInWorld(p: ProjectileState): boolean {
  return p.x + p.width > 0 && p.x < WORLD_WIDTH && p.y + p.height > 0 && p.y < WORLD_HEIGHT;
}

/** Only arcing projectiles (toxic, ice) are removed on hitting a platform (SPEC §11); others fly through. */
export function projectileHitsPlatform(p: ProjectileState, platforms: readonly Rect[]): boolean {
  return p.type in ARC_GRAVITY && platforms.some((s) => rectsOverlap(projectileRect(p), s));
}

/** All projectiles currently overlapping the player. */
export function hittingProjectiles(
  player: PlayerState,
  projectiles: readonly ProjectileState[],
): ProjectileState[] {
  const r = playerRect(player);
  return projectiles.filter((p) => rectsOverlap(r, projectileRect(p)));
}

export function touchesProjectile(player: PlayerState, projectiles: readonly ProjectileState[]): boolean {
  return hittingProjectiles(player, projectiles).length > 0;
}

// Hazards and goal --------------------------------------------------------------

export function touchesSpike(player: PlayerState, level: Level): boolean {
  const r = playerRect(player);
  return level.spikes.some((s) => rectsOverlap(r, spikeHitbox(s)));
}

export function touchesGoal(player: PlayerState, level: Level): boolean {
  return rectsOverlap(playerRect(player), level.goal);
}

// Utils -----------------------------------------------------------------------

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
