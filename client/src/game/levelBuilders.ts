// Small helpers for authoring level geometry. Shared by hand-authored levels
// and (phase 2) the procedural generator.

import {
  BOSS_HEIGHT,
  BOSS_WIDTH,
  ENEMY_HEIGHT,
  ENEMY_WIDTH,
  GOAL_HEIGHT,
  GOAL_WIDTH,
  GROUND_Y,
  PLATFORM_THICKNESS,
  SPIKE_HEIGHT,
  WORLD_HEIGHT,
} from "./constants";
import type { EnemyDef, Rect } from "./types";

/** Solid ground segment from x to x + width. */
export function ground(x: number, width: number): Rect {
  return { x, y: GROUND_Y, width, height: WORLD_HEIGHT - GROUND_Y };
}

/** One-way platform whose top edge is at `top`. */
export function platform(x: number, top: number, width: number): Rect {
  return { x, y: top, width, height: PLATFORM_THICKNESS };
}

/** A row of spikes standing on a surface whose top is at `surfaceTop`. */
export function spikes(x: number, surfaceTop: number, width: number): Rect {
  return { x, y: surfaceTop - SPIKE_HEIGHT, width, height: SPIKE_HEIGHT };
}

/** Door standing on a surface whose top is at `surfaceTop`. */
export function goal(x: number, surfaceTop: number): Rect {
  return { x, y: surfaceTop - GOAL_HEIGHT, width: GOAL_WIDTH, height: GOAL_HEIGHT };
}

type EnemyExtras = Omit<EnemyDef, "id" | "x" | "y" | "startX" | "endX" | "speed">;

/** Enemy patrolling [startX, endX] on a surface whose top is at `surfaceTop`. */
export function enemy(
  id: number,
  surfaceTop: number,
  startX: number,
  endX: number,
  speed: number,
  extras: EnemyExtras = {},
): EnemyDef {
  const height = extras.height ?? (extras.isBoss ? BOSS_HEIGHT : ENEMY_HEIGHT);
  const width = extras.width ?? (extras.isBoss ? BOSS_WIDTH : ENEMY_WIDTH);
  return {
    id,
    x: startX,
    y: surfaceTop - height,
    startX,
    endX,
    speed,
    ...extras,
    width,
    height,
  };
}

export type BossSpec = Pick<EnemyDef, "speed" | "hp" | "projectileType" | "shootCooldown">;

export type ArenaLayout = {
  platforms: Rect[];
  spikes: Rect[];
  enemies: EnemyDef[];
  goal: Rect;
};

/**
 * Boss arena (SPEC §11): wide spike-free ground, elevated platforms on both
 * sides (the left one catches the player at spawn), and the locked door on a
 * higher middle platform.
 */
export function bossArena(boss: BossSpec, sideTop = 300, topTop = 215, extra: Rect[] = []): ArenaLayout {
  return {
    platforms: [
      ground(0, 400),
      platform(10, sideTop, 120),
      platform(270, sideTop, 120),
      platform(140, topTop, 120),
      ...extra,
    ],
    spikes: [],
    enemies: [enemy(1, GROUND_Y, 0, 400, boss.speed, { ...boss, isBoss: true })],
    goal: goal(182, topTop),
  };
}
