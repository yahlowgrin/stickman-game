// Level validator (SPEC §5). Pure geometry checks, shared by
// scripts/validate-levels.ts and the test suite.
//
// Phase 1 implements the structural rules. The spawn-to-goal reachability
// search and boss-lock rule are added in phase 2.

import {
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  SPAWN_SAFE_WIDTH,
  SPAWN_X,
  SPAWN_Y,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./constants";
import { overlapsHorizontally, rectsOverlap } from "./physics";
import type { EnemyDef, Level, Rect } from "./types";

export type ValidationIssue = { levelId: number; message: string };

function inWorld(r: Rect): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.width <= WORLD_WIDTH && r.y + r.height <= WORLD_HEIGHT;
}

function describe(r: Rect): string {
  return `(${r.x}, ${r.y}, ${r.width}×${r.height})`;
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

function enemyBody(e: EnemyDef): Rect {
  return { x: e.x, y: e.y, width: e.width ?? 0, height: e.height ?? 0 };
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
      const patrol: Rect = { x: e.startX, y: e.y, width: e.endX - e.startX, height: e.height ?? 0 };
      if (rectsOverlap(patrol, zone)) fail(`enemy ${e.id} patrols the spawn area`);
    }
    const fallPath: Rect = { x: SPAWN_X, y: SPAWN_Y, width: PLAYER_WIDTH, height: landing.y - SPAWN_Y };
    if (rectsOverlap(fallPath, level.goal)) fail("goal overlaps the spawn fall path");
  }

  // Goal must stand on a surface, with no spikes on or under it.
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

  // Enemies: patrol range must fit the surface they stand on.
  for (const e of level.enemies) {
    const w = e.width ?? 0;
    const h = e.height ?? 0;
    if (w <= 0 || h <= 0) fail(`enemy ${e.id} has no size`);
    if (e.endX - e.startX < w) fail(`enemy ${e.id} patrol range narrower than its body`);
    if (e.x < e.startX || e.x + w > e.endX) fail(`enemy ${e.id} starts outside its patrol range`);
    if (e.speed <= 0) fail(`enemy ${e.id} has non-positive speed`);
    const surface = level.platforms.find(
      (p) => p.y === e.y + h && e.startX >= p.x && e.endX <= p.x + p.width,
    );
    if (!surface) fail(`enemy ${e.id} patrol range extends beyond its platform`);
  }

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
