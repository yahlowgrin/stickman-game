// Level validator (SPEC §5). Pure geometry checks, shared by
// scripts/validate-levels.ts, the procedural generator and the tests.
//
// The validator checks geometry only: enemies and projectiles add difficulty
// on top of a route that must always exist.

import {
  BOSS_ARENA_MIN_GROUND,
  GAP_RISE_HIGH,
  GAP_RISE_LOW,
  GAP_SAME_OR_LOWER,
  LATE_GAME_LEVEL,
  LATE_GAME_REACH_SCALE,
  MAX_ENEMY_SPEED,
  MAX_RISE,
  MIN_SHOOT_COOLDOWN,
  MIN_STANDABLE_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  RISE_LOW,
  SPAWN_SAFE_WIDTH,
  SPAWN_X,
  SPAWN_Y,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./constants";
import { isGround, overlapsHorizontally, rectsOverlap, spikeHitbox } from "./physics";
import { bossHp, isBossLevel } from "./sections";
import type { EnemyDef, Level, Rect } from "./types";

export type ValidationIssue = { levelId: number; message: string };

// ---------------------------------------------------------------------------
// Reach rules
// ---------------------------------------------------------------------------

/**
 * Largest allowed edge-to-edge horizontal gap for a jump whose target is
 * `rise` px higher than the take-off surface (negative = lower), or null if
 * the target is too high to be allowed at all.
 */
export function maxGap(rise: number, levelId: number): number | null {
  let gap: number;
  if (rise <= 0) gap = GAP_SAME_OR_LOWER;
  else if (rise <= RISE_LOW) gap = GAP_RISE_LOW;
  else if (rise <= MAX_RISE) gap = GAP_RISE_HIGH;
  else return null;
  return levelId >= LATE_GAME_LEVEL ? Math.floor(gap * LATE_GAME_REACH_SCALE) : gap;
}

/** A spike-free stretch of a surface the player can stand on. */
export type Segment = { x0: number; x1: number; top: number; surface: Rect };

/**
 * Spikes that would touch a player standing on `surface`: any spike whose
 * hitbox reaches into the band the player's body occupies above it. Covers
 * spikes on the surface itself and spikes on a floor just below a low platform.
 */
function spikesAffecting(surface: Rect, spikes: readonly Rect[]): Rect[] {
  const bandTop = surface.y - PLAYER_HEIGHT;
  return spikes.filter((s) => {
    const hb = spikeHitbox(s);
    return overlapsHorizontally(s, surface) && hb.y < surface.y && hb.y + hb.height > bandTop;
  });
}

export function standableSegments(level: Level): Segment[] {
  const segments: Segment[] = [];
  for (const p of level.platforms) {
    let intervals: Array<[number, number]> = [[p.x, p.x + p.width]];
    for (const s of spikesAffecting(p, level.spikes)) {
      const next: Array<[number, number]> = [];
      for (const [a, b] of intervals) {
        if (s.x + s.width <= a || s.x >= b) {
          next.push([a, b]);
          continue;
        }
        if (s.x > a) next.push([a, s.x]);
        if (s.x + s.width < b) next.push([s.x + s.width, b]);
      }
      intervals = next;
    }
    for (const [x0, x1] of intervals) {
      if (x1 - x0 >= MIN_STANDABLE_WIDTH) segments.push({ x0, x1, top: p.y, surface: p });
    }
  }
  return segments;
}

export function segmentGap(a: Segment, b: Segment): number {
  return Math.max(0, b.x0 - a.x1, a.x0 - b.x1);
}

export function canJump(from: Segment, to: Segment, levelId: number): boolean {
  const allowed = maxGap(from.top - to.top, levelId);
  return allowed !== null && segmentGap(from, to) <= allowed;
}

/** The first surface the player lands on when falling from spawn, if any. */
export function findSpawnLanding(level: Level): Rect | null {
  const column: Rect = { x: SPAWN_X, y: 0, width: PLAYER_WIDTH, height: 1 };
  const spawnBottom = SPAWN_Y + PLAYER_HEIGHT;
  let best: Rect | null = null;
  for (const p of level.platforms) {
    if (!overlapsHorizontally(column, p) || p.y < spawnBottom) continue;
    if (!best || p.y < best.y) best = p;
  }
  return best;
}

function spawnSegment(level: Level, segments: Segment[]): Segment | null {
  const landing = findSpawnLanding(level);
  if (!landing) return null;
  return (
    segments.find(
      (s) => s.surface === landing && s.x0 < SPAWN_X + PLAYER_WIDTH && s.x1 > SPAWN_X,
    ) ?? null
  );
}

function goalSegment(level: Level, segments: Segment[]): Segment | null {
  const g = level.goal;
  return (
    segments.find((s) => s.top === g.y + g.height && s.x0 <= g.x && s.x1 >= g.x + g.width) ?? null
  );
}

/** Segments reachable from the spawn landing using the reach table. */
export function reachableSegments(level: Level, segments = standableSegments(level)): Set<Segment> {
  const start = spawnSegment(level, segments);
  const seen = new Set<Segment>();
  if (!start) return seen;
  const queue = [start];
  seen.add(start);
  while (queue.length > 0) {
    const from = queue.shift()!;
    for (const to of segments) {
      if (!seen.has(to) && canJump(from, to, level.id)) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  return seen;
}

/** True if a route of allowed jumps leads from spawn to the goal's surface. */
export function isGoalReachable(level: Level): boolean {
  const segments = standableSegments(level);
  const goal = goalSegment(level, segments);
  return goal !== null && reachableSegments(level, segments).has(goal);
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

function inWorld(r: Rect): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.width <= WORLD_WIDTH && r.y + r.height <= WORLD_HEIGHT;
}

function describe(r: Rect): string {
  return `(${r.x}, ${r.y}, ${r.width}×${r.height})`;
}

function enemyBody(e: EnemyDef): Rect {
  return { x: e.x, y: e.y, width: e.width ?? 0, height: e.height ?? 0 };
}

function patrolRect(e: EnemyDef): Rect {
  return { x: e.startX, y: e.y, width: e.endX - e.startX, height: e.height ?? 0 };
}

export function validateLevel(level: Level): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const fail = (message: string) => issues.push({ levelId: level.id, message });

  if (!level.name.trim()) fail("level has no name");

  // Bounds.
  for (const p of level.platforms) if (!inWorld(p)) fail(`platform ${describe(p)} outside world`);
  for (const s of level.spikes) if (!inWorld(s)) fail(`spikes ${describe(s)} outside world`);
  if (!inWorld(level.goal)) fail(`goal ${describe(level.goal)} outside world`);
  for (const e of level.enemies) {
    if (!inWorld(enemyBody(e))) fail(`enemy ${e.id} body outside world`);
    if (e.startX < 0 || e.endX > WORLD_WIDTH) fail(`enemy ${e.id} patrol outside world`);
  }

  // Geometry sanity.
  const raised = level.platforms.filter((p) => !isGround(p));
  raised.forEach((a, i) => {
    for (const b of raised.slice(i + 1)) {
      if (rectsOverlap(a, b)) fail(`platforms ${describe(a)} and ${describe(b)} overlap`);
    }
  });
  const floor = level.platforms.filter(isGround);
  for (const p of raised) {
    if (floor.some((f) => rectsOverlap(p, f))) fail(`platform ${describe(p)} overlaps the ground`);
    for (const s of level.spikes) {
      if (rectsOverlap(p, s)) fail(`platform ${describe(p)} overlaps spikes ${describe(s)}`);
    }
  }
  for (const s of level.spikes) {
    const onSurface = level.platforms.some(
      (p) => s.y + s.height === p.y && s.x >= p.x && s.x + s.width <= p.x + p.width,
    );
    if (!onSurface) fail(`spikes ${describe(s)} do not stand on a surface`);
  }

  // Spawn safety.
  const landing = findSpawnLanding(level);
  if (!landing) {
    fail("no surface under the spawn point");
  } else {
    const zone: Rect = { x: 0, y: 0, width: SPAWN_SAFE_WIDTH, height: landing.y };
    for (const s of level.spikes) {
      if (rectsOverlap(s, zone)) fail(`spikes ${describe(s)} in spawn area`);
    }
    for (const e of level.enemies) {
      if (rectsOverlap(patrolRect(e), zone)) fail(`enemy ${e.id} patrols the spawn area`);
    }
    const fallPath: Rect = { x: SPAWN_X, y: SPAWN_Y, width: PLAYER_WIDTH, height: landing.y - SPAWN_Y };
    if (rectsOverlap(fallPath, level.goal)) fail("goal overlaps the spawn fall path");
  }

  // Goal must stand on a surface, clear of spikes and other platforms.
  const g = level.goal;
  const support = level.platforms.find(
    (p) => p.y === g.y + g.height && g.x >= p.x && g.x + g.width <= p.x + p.width,
  );
  if (!support) fail("goal does not stand fully on a surface");
  for (const s of level.spikes) {
    if (rectsOverlap(s, g)) fail(`goal overlaps spikes ${describe(s)}`);
    if (support && s.y + s.height === support.y && overlapsHorizontally(s, g)) {
      fail(`goal stands on spikes ${describe(s)}`);
    }
  }
  for (const p of level.platforms) {
    if (rectsOverlap(p, g)) fail(`goal overlaps platform ${describe(p)}`);
  }

  // Enemies.
  const segments = standableSegments(level);
  for (const e of level.enemies) {
    const w = e.width ?? 0;
    const h = e.height ?? 0;
    if (w <= 0 || h <= 0) fail(`enemy ${e.id} has no size`);
    if (e.endX - e.startX < w) fail(`enemy ${e.id} patrol range narrower than its body`);
    if (e.x < e.startX || e.x + w > e.endX) fail(`enemy ${e.id} starts outside its patrol range`);
    if (e.speed <= 0 || e.speed > MAX_ENEMY_SPEED) fail(`enemy ${e.id} speed ${e.speed} out of range`);
    if (e.projectileType) {
      const min = MIN_SHOOT_COOLDOWN[e.projectileType];
      if (e.shootCooldown === undefined || e.shootCooldown < min) {
        fail(`enemy ${e.id} ${e.projectileType} cooldown below ${min}`);
      }
    }
    const surface = level.platforms.find(
      (p) => p.y === e.y + h && e.startX >= p.x && e.endX <= p.x + p.width,
    );
    if (!surface) {
      fail(`enemy ${e.id} patrol range extends beyond its platform`);
      continue;
    }
    // A patrol less than a player-height above a lower standable surface would
    // hit a player standing there who has no way to see it coming.
    for (const s of segments) {
      if (s.top <= surface.y || s.top - surface.y >= PLAYER_HEIGHT) continue;
      if (e.startX < s.x1 && e.endX > s.x0) {
        fail(`enemy ${e.id} patrols less than a player-height above the surface at y=${s.top}`);
      }
    }
  }

  // Bosses (SPEC §9, §11). The engine keeps the door locked while any boss is
  // alive, so a boss level is safe exactly when it contains a boss.
  const bosses = level.enemies.filter((e) => e.isBoss);
  if (isBossLevel(level.id)) {
    if (bosses.length !== 1) fail(`boss level must have exactly one boss (has ${bosses.length})`);
    for (const b of bosses) {
      if (b.hp !== bossHp(level.id)) fail(`boss hp ${b.hp} should be ${bossHp(level.id)}`);
    }
    const widestFloor = Math.max(0, ...floor.map((p) => p.width));
    if (widestFloor < BOSS_ARENA_MIN_GROUND) fail("boss arena ground is too narrow");
    if (level.spikes.some((s) => floor.some((p) => s.y + s.height === p.y))) {
      fail("boss arena floor has spikes");
    }
    const sidePlatforms = level.platforms.filter((p) => !isGround(p));
    const hasLeft = sidePlatforms.some((p) => p.x + p.width / 2 < WORLD_WIDTH / 2);
    const hasRight = sidePlatforms.some((p) => p.x + p.width / 2 > WORLD_WIDTH / 2);
    if (!hasLeft || !hasRight) fail("boss arena needs elevated platforms on both sides");
  } else if (bosses.length > 0) {
    fail("non-boss level contains a boss");
  }

  // Route from spawn to goal.
  if (landing && support && !isGoalReachable(level)) fail("no route from spawn to goal");

  return issues;
}

export function validateLevels(levels: readonly Level[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  levels.forEach((level, index) => {
    if (level.id !== index + 1) {
      issues.push({ levelId: level.id, message: `expected id ${index + 1}` });
    }
    issues.push(...validateLevel(level));
  });
  const names = new Map<string, number>();
  for (const level of levels) {
    const other = names.get(level.name);
    if (other !== undefined) {
      issues.push({ levelId: level.id, message: `duplicate name "${level.name}" (also level ${other})` });
    }
    names.set(level.name, level.id);
  }
  return issues;
}
