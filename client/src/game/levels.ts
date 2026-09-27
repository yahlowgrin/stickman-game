// Hand-authored levels. Phase 1 ships levels 1–10; levels 11–40 and the
// seeded generator for 41–200 arrive in phase 2 (see docs/PROGRESS.md).

import { enemy, goal, ground, platform, spikes } from "./levelBuilders";
import type { Level, LevelProvider } from "./types";

export const CORE_LEVEL_NAMES = [
  "The Basics",
  "Watch Your Step",
  "Enemy Territory",
  "The Ascent",
  "Leap of Faith",
  "Dual Threat",
  "Precision Jumping",
  "The Gauntlet",
  "The Floor is Lava",
  "Halfway There",
  "Tight Squeeze",
  "Bouncing Heads",
  "Staircase of Doom",
  "Enemy Express",
  "The Zig Zag",
  "Pinpoint Precision",
  "Panic Room",
  "Maximum Overdrive",
  "The Pre-Boss Run",
  "Mini Boss",
] as const;

export const FIRE_LEVEL_NAMES = [
  "Introducing Fire",
  "Crossfire",
  "Fire and Spikes",
  "High Altitude",
  "Fire Maze",
  "Moving Targets",
  "Inferno",
  "Timing Is Everything",
  "Fire Boss Pre-Run",
  "Inferno King",
] as const;

type LevelLayout = Omit<Level, "id" | "name" | "section" | "difficulty">;

function core(id: number, layout: LevelLayout): Level {
  return {
    id,
    name: CORE_LEVEL_NAMES[id - 1],
    section: "core",
    difficulty: id,
    ...layout,
  };
}

export const HAND_AUTHORED_LEVELS: readonly Level[] = [
  // 1 — movement and jumping only.
  core(1, {
    platforms: [ground(0, 400), platform(170, 330, 80), platform(290, 270, 90)],
    spikes: [],
    enemies: [],
    goal: goal(322, 270),
  }),

  // 2 — first spikes and one enemy.
  core(2, {
    platforms: [ground(0, 400), platform(300, 320, 90)],
    spikes: [spikes(150, 400, 50)],
    enemies: [enemy(1, 400, 230, 400, 1)],
    goal: goal(327, 320),
  }),

  // 3 — multiple enemies.
  core(3, {
    platforms: [ground(0, 400), platform(130, 320, 100), platform(260, 250, 120)],
    spikes: [],
    enemies: [enemy(1, 400, 150, 300, 1.2), enemy(2, 400, 220, 400, 1.5)],
    goal: goal(322, 250),
  }),

  // 4 — vertical staircase over a spike floor.
  core(4, {
    platforms: [
      ground(0, 400),
      platform(110, 340, 70),
      platform(190, 280, 70),
      platform(270, 220, 70),
      platform(170, 160, 70),
    ],
    spikes: [spikes(200, 400, 200)],
    enemies: [],
    goal: goal(187, 160),
  }),

  // 5 — short leap over spikes.
  core(5, {
    platforms: [ground(0, 400)],
    spikes: [spikes(150, 400, 110)],
    enemies: [],
    goal: goal(340, 400),
  }),

  // 6 — two enemy platforms.
  core(6, {
    platforms: [
      ground(0, 400),
      platform(150, 320, 100),
      platform(270, 250, 110),
      platform(170, 180, 70),
    ],
    spikes: [spikes(150, 400, 250)],
    enemies: [enemy(1, 320, 150, 250, 1), enemy(2, 250, 270, 380, 1.2)],
    goal: goal(187, 180),
  }),

  // 7 — small precision platforms.
  core(7, {
    platforms: [
      ground(0, 400),
      platform(175, 340, 45),
      platform(240, 300, 45),
      platform(320, 250, 45),
      platform(230, 190, 45),
      platform(130, 140, 50),
    ],
    spikes: [spikes(150, 400, 250)],
    enemies: [],
    goal: goal(137, 140),
  }),

  // 8 — multi-level gauntlet.
  core(8, {
    platforms: [
      ground(0, 400),
      platform(160, 320, 120),
      platform(300, 250, 100),
      platform(140, 190, 120),
      platform(280, 130, 100),
    ],
    spikes: [spikes(170, 400, 230)],
    enemies: [enemy(1, 320, 170, 280, 1.2), enemy(2, 190, 155, 260, 1.4)],
    goal: goal(312, 130),
  }),

  // 9 — the floor is dangerous.
  core(9, {
    platforms: [
      ground(0, 400),
      platform(150, 350, 60),
      platform(260, 330, 50),
      platform(340, 280, 60),
      platform(240, 220, 60),
      platform(120, 170, 70),
    ],
    spikes: [spikes(150, 400, 250)],
    enemies: [enemy(1, 280, 340, 400, 1)],
    goal: goal(137, 170),
  }),

  // 10 — complex vertical route.
  core(10, {
    platforms: [
      ground(0, 400),
      platform(150, 340, 70),
      platform(260, 290, 70),
      platform(330, 230, 70),
      platform(220, 175, 60),
      platform(110, 125, 60),
      platform(210, 75, 80),
    ],
    spikes: [spikes(150, 400, 250)],
    enemies: [enemy(1, 290, 260, 330, 1)],
    goal: goal(232, 75),
  }),
];

export function getLevel(id: number): Level {
  const level = HAND_AUTHORED_LEVELS[id - 1];
  if (!level) throw new Error(`Level ${id} does not exist`);
  return level;
}

export const LEVEL_COUNT = HAND_AUTHORED_LEVELS.length;

export const levelProvider: LevelProvider = { getLevel, levelCount: LEVEL_COUNT };
