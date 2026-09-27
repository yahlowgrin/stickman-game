// Hand-authored levels 1–40 (SPEC §8, §12). Levels 41–200 come from the
// seeded generator in levelGenerator.ts.

import { HAND_AUTHORED_COUNT, TOTAL_LEVELS } from "./constants";
import { bossArena, enemy, goal, ground, platform, spikes } from "./levelBuilders";
import { generateLevel } from "./levelGenerator";
import { sectionFor } from "./sections";
import type { EnemyDef, Level, LevelProvider } from "./types";

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

export const SPEED_LEVEL_NAMES = [
  ...Array.from({ length: 9 }, (_, i) => `Speed Demons ${i + 1}`),
  "Speed Demon Boss",
] as const;

const HAND_AUTHORED_NAMES: readonly string[] = [
  ...CORE_LEVEL_NAMES,
  ...FIRE_LEVEL_NAMES,
  ...SPEED_LEVEL_NAMES,
];

type LevelLayout = Omit<Level, "id" | "name" | "section" | "difficulty">;

function level(id: number, layout: LevelLayout): Level {
  return {
    id,
    name: HAND_AUTHORED_NAMES[id - 1],
    section: sectionFor(id),
    difficulty: id,
    ...layout,
  };
}

const core = level;

/** Fire shooters fire less often as the section goes on (never below 60 ticks). */
function fireCooldown(id: number): number {
  return Math.max(60, 150 - (id - 21) * 10);
}

function fireShooter(id: number, levelId: number, surfaceTop: number, startX: number, endX: number, speed = 1): EnemyDef {
  return enemy(id, surfaceTop, startX, endX, speed, {
    projectileType: "fire",
    shootCooldown: fireCooldown(levelId),
  });
}

export const HAND_AUTHORED_LEVELS: readonly Level[] = [
  // 1 — movement and jumping only.
  core(1, {
    platforms: [ground(0, 400), platform(140, 335, 80), platform(250, 270, 80), platform(170, 205, 80)],
    spikes: [],
    enemies: [],
    goal: goal(192, 205),
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
    // Patrols confined to the far side of each platform (40px wide, slower),
    // leaving a genuinely safe ~40px landing zone on the side the player
    // arrives from -- accounting for the player's own 40px width, not just
    // its x position. The original ranges covered nearly the whole platform
    // (110/120 and 105/120), so landing from below was a near-unavoidable
    // side-on death with zero reaction time (reported as "too hard").
    enemies: [enemy(1, 320, 240, 280, 1), enemy(2, 190, 220, 260, 1)],
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

  // 11 — narrow platforms, an enemy guarding the door.
  core(11, {
    platforms: [
      ground(0, 400),
      platform(160, 345, 50),
      platform(250, 310, 45),
      platform(330, 260, 50),
      platform(230, 205, 45),
      platform(130, 160, 45),
      platform(230, 110, 90),
    ],
    spikes: [spikes(150, 400, 250)],
    enemies: [enemy(1, 110, 230, 320, 1.2)],
    goal: goal(276, 110),
  }),

  // 12 — enemies patrol the floor under a climb.
  core(12, {
    platforms: [
      ground(0, 400),
      platform(170, 320, 70),
      platform(300, 260, 80),
      platform(180, 195, 70),
      platform(290, 135, 80),
    ],
    spikes: [],
    enemies: [enemy(1, 400, 160, 260, 1.5), enemy(2, 400, 220, 330, 1.2), enemy(3, 400, 280, 400, 1.8)],
    goal: goal(312, 135),
  }),

  // 13 — staircase with an enemy on most steps.
  core(13, {
    platforms: [
      ground(0, 400),
      // The three enemy platforms were widened 80->110: each enemy originally
      // patrolled its entire platform (0px safe margin), and 80px isn't wide
      // enough to fit both a full-size player and a comfortable gap even at
      // the enemy's minimum patrol width. Widening (verified with the real
      // physics: gaps to neighboring platforms only shrink, never grow, so
      // reachability only gets easier) makes a genuine ~20px safe landing
      // zone possible on top of the enemy's own patrol width (reported as
      // "too hard").
      platform(150, 345, 110),
      platform(250, 290, 110),
      platform(320, 235, 80),
      platform(170, 180, 110),
      platform(90, 125, 80),
    ],
    spikes: [spikes(150, 400, 250)],
    // Confined to the far side from the direction the player lands from.
    enemies: [enemy(1, 345, 210, 260, 1), enemy(2, 290, 310, 360, 1), enemy(3, 180, 170, 220, 1)],
    goal: goal(120, 125),
  }),

  // 14 — lots of enemies, ground and platforms.
  core(14, {
    platforms: [
      ground(0, 400),
      platform(160, 330, 90),
      platform(290, 270, 90),
      platform(160, 205, 90),
      platform(300, 145, 90),
    ],
    spikes: [],
    enemies: [
      enemy(1, 400, 150, 400, 2),
      enemy(2, 400, 180, 400, 1.5),
      enemy(3, 400, 220, 400, 1.8),
      enemy(4, 270, 290, 380, 1.4),
      enemy(5, 205, 160, 250, 1.5),
    ],
    goal: goal(327, 145),
  }),

  // 15 — zig-zag climb.
  core(15, {
    platforms: [
      ground(0, 400),
      platform(160, 340, 60),
      platform(280, 290, 60),
      platform(170, 240, 60),
      platform(290, 190, 60),
      platform(170, 140, 60),
      platform(290, 90, 70),
    ],
    spikes: [spikes(150, 400, 250)],
    enemies: [enemy(1, 190, 290, 350, 1)],
    goal: goal(307, 90),
  }),

  // 16 — tiny platforms.
  core(16, {
    platforms: [
      ground(0, 400),
      platform(170, 350, 40),
      platform(270, 320, 40),
      platform(350, 270, 40),
      platform(250, 220, 40),
      platform(150, 175, 40),
      platform(240, 125, 40),
      platform(330, 80, 50),
    ],
    spikes: [spikes(150, 400, 250)],
    enemies: [],
    goal: goal(337, 80),
  }),

  // 17 — crowded room with escape platforms.
  core(17, {
    platforms: [
      ground(0, 400),
      platform(160, 320, 70),
      platform(300, 320, 80),
      platform(200, 235, 100),
      platform(300, 160, 80),
    ],
    spikes: [],
    enemies: [enemy(1, 400, 150, 400, 2), enemy(2, 400, 200, 400, 1.5), enemy(3, 235, 200, 300, 1.5)],
    goal: goal(322, 160),
  }),

  // 18 — faster enemies over spikes.
  core(18, {
    platforms: [
      ground(0, 400),
      platform(160, 340, 90),
      platform(290, 285, 90),
      platform(170, 225, 70),
      platform(290, 170, 70),
      platform(160, 115, 80),
    ],
    spikes: [spikes(150, 400, 250)],
    enemies: [enemy(1, 340, 160, 250, 2), enemy(2, 285, 290, 380, 2)],
    goal: goal(182, 115),
  }),

  // 19 — pre-boss run: a pit, then a guarded climb.
  core(19, {
    platforms: [
      ground(0, 150),
      ground(260, 140),
      platform(170, 340, 60),
      platform(300, 320, 80),
      platform(180, 260, 70),
      platform(290, 195, 70),
      platform(160, 135, 80),
      platform(300, 80, 70),
    ],
    spikes: [],
    enemies: [enemy(1, 400, 260, 400, 2), enemy(2, 320, 300, 380, 1.6), enemy(3, 135, 160, 240, 1.8)],
    goal: goal(317, 80),
  }),

  // 20 — Mini Boss.
  core(20, bossArena({ speed: 1.2, hp: 3 })),

  // 21 — Introducing Fire: plenty of stepping stones.
  level(21, {
    platforms: [
      ground(0, 400),
      platform(160, 340, 60),
      platform(240, 300, 60),
      platform(320, 250, 60),
      platform(230, 200, 60),
      platform(140, 160, 60),
      platform(250, 110, 70),
    ],
    spikes: [],
    enemies: [fireShooter(1, 21, 400, 300, 400)],
    goal: goal(267, 110),
  }),

  // 22 — Crossfire.
  level(22, {
    platforms: [
      ground(0, 400),
      platform(170, 330, 80),
      platform(290, 270, 90),
      platform(160, 205, 80),
      platform(280, 150, 100),
    ],
    spikes: [],
    enemies: [fireShooter(1, 22, 400, 200, 320), fireShooter(2, 22, 270, 290, 380)],
    goal: goal(320, 150),
  }),

  // 23 — Fire and Spikes.
  level(23, {
    platforms: [
      ground(0, 400),
      platform(160, 345, 60),
      platform(260, 300, 90),
      platform(150, 240, 70),
      platform(240, 185, 130),
      platform(140, 130, 70),
    ],
    spikes: [spikes(150, 400, 250), spikes(290, 185, 30)],
    enemies: [fireShooter(1, 23, 300, 260, 350)],
    goal: goal(157, 130),
  }),

  // 24 — High Altitude.
  level(24, {
    platforms: [
      ground(0, 400),
      platform(160, 340, 70),
      platform(270, 280, 60),
      platform(340, 215, 60),
      platform(230, 155, 60),
      platform(120, 100, 60),
      platform(230, 55, 70),
    ],
    spikes: [spikes(150, 400, 250)],
    enemies: [fireShooter(1, 24, 340, 160, 230), fireShooter(2, 24, 215, 340, 400)],
    goal: goal(247, 55),
  }),

  // 25 — Fire Maze.
  level(25, {
    platforms: [
      ground(0, 400),
      platform(150, 330, 90),
      platform(290, 310, 110),
      platform(200, 260, 100),
      platform(95, 195, 90),
      platform(230, 135, 90),
      platform(330, 80, 70),
    ],
    spikes: [],
    enemies: [
      fireShooter(1, 25, 400, 180, 400),
      fireShooter(2, 25, 310, 300, 400),
      fireShooter(3, 25, 135, 230, 320),
    ],
    goal: goal(347, 80),
  }),

  // 26 — Moving Targets: a clear staircase of intermediate platforms.
  level(26, {
    platforms: [
      ground(0, 400),
      platform(160, 350, 70),
      platform(250, 305, 70),
      platform(330, 260, 70),
      platform(240, 215, 70),
      platform(150, 170, 70),
      platform(240, 125, 70),
      platform(330, 80, 70),
    ],
    spikes: [spikes(150, 400, 250)],
    enemies: [
      fireShooter(1, 26, 260, 330, 400),
      fireShooter(2, 26, 170, 150, 220),
      enemy(3, 305, 250, 320, 1.2),
    ],
    goal: goal(347, 80),
  }),

  // 27 — Inferno.
  level(27, {
    platforms: [
      ground(0, 400),
      platform(160, 340, 80),
      platform(280, 290, 100),
      platform(170, 230, 80),
      platform(290, 175, 100),
      platform(160, 120, 90),
    ],
    spikes: [spikes(150, 400, 250)],
    enemies: [
      fireShooter(1, 27, 340, 160, 240),
      fireShooter(2, 27, 290, 280, 380),
      fireShooter(3, 27, 175, 290, 390),
    ],
    goal: goal(190, 120),
  }),

  // 28 — Timing Is Everything: extra platforms and slower fire.
  level(28, {
    platforms: [
      ground(0, 400),
      platform(160, 345, 60),
      platform(240, 310, 60),
      // Widened from 60 to 90: at 60px, the enemy's patrol (originally the
      // full platform, 0px safe margin) left no x position where the 40px
      // player could stand clear of it even at minimum patrol width -- the
      // platform was too narrow to fit both. Widening makes a real safe zone
      // possible (reported as "too hard").
      platform(300, 270, 90),
      platform(240, 230, 60),
      platform(160, 190, 90),
      platform(240, 150, 60),
      platform(320, 110, 70),
      platform(340, 190, 60),
    ],
    spikes: [spikes(150, 400, 250)],
    // Confined to the far side from the direction the player lands from, at
    // the enemy's minimum patrol width (32px) to maximize the safe gap --
    // 90px is still tight (58px gap, ~18px of real slack once the player's
    // own 40px width is subtracted), but the platform can't spare more
    // without further widening. Was the entire platform, 0px margin.
    enemies: [
      enemy(1, 270, 358, 390, 1, { projectileType: "fire", shootCooldown: 140 }),
      enemy(2, 190, 160, 192, 1, { projectileType: "fire", shootCooldown: 140 }),
    ],
    goal: goal(337, 110),
  }),

  // 29 — Fire Boss Pre-Run.
  level(29, {
    platforms: [
      ground(0, 150),
      ground(300, 100),
      platform(170, 340, 60),
      platform(310, 320, 90),
      platform(190, 260, 70),
      platform(300, 200, 80),
      platform(180, 140, 70),
      platform(290, 85, 80),
    ],
    spikes: [],
    enemies: [fireShooter(1, 29, 400, 300, 400), fireShooter(2, 29, 200, 300, 380)],
    goal: goal(312, 85),
  }),

  // 30 — Inferno King.
  level(30, bossArena({ speed: 1.4, hp: 5, projectileType: "fire", shootCooldown: 100 })),

  // 31 — Speed Demons 1: one fast runner on the floor.
  level(31, {
    platforms: [
      ground(0, 400),
      platform(170, 330, 80),
      platform(290, 270, 90),
      platform(170, 205, 80),
      platform(290, 145, 90),
    ],
    spikes: [],
    enemies: [enemy(1, 400, 150, 400, 3.5)],
    goal: goal(322, 145),
  }),

  // 32 — Speed Demons 2: a long platform with a fast patroller.
  level(32, {
    platforms: [ground(0, 400), platform(150, 330, 250), platform(180, 250, 90), platform(300, 190, 100)],
    spikes: [spikes(150, 400, 250)],
    enemies: [enemy(1, 330, 150, 400, 3.6)],
    goal: goal(330, 190),
  }),

  // 33 — Speed Demons 3.
  level(33, {
    platforms: [
      ground(0, 150),
      ground(250, 150),
      platform(160, 340, 70),
      platform(270, 320, 110),
      // Widened 90->120: both enemies originally patrolled their entire
      // surface (0px safe margin, and fast at that -- 3.5-3.8 speed leaves
      // almost no downtime). Confined to the far side from the landing
      // direction, giving real slack (reported as "too hard").
      platform(150, 255, 120),
      platform(280, 195, 100),
      platform(150, 135, 90),
    ],
    spikes: [],
    enemies: [enemy(1, 400, 320, 400, 3.5), enemy(2, 255, 150, 190, 3.2)],
    goal: goal(185, 135),
  }),

  // 34 — Speed Demons 4: stacked runways.
  level(34, {
    platforms: [
      ground(0, 400),
      platform(150, 340, 250),
      platform(100, 255, 200),
      platform(150, 170, 250),
      platform(100, 90, 120),
    ],
    spikes: [spikes(150, 400, 250)],
    enemies: [enemy(1, 340, 150, 400, 3.8), enemy(2, 255, 150, 300, 4), enemy(3, 170, 150, 400, 4.2)],
    goal: goal(160, 90),
  }),

  // 35 — Speed Demons 5.
  level(35, {
    platforms: [
      ground(0, 400),
      platform(170, 320, 110),
      platform(300, 250, 100),
      platform(140, 180, 120),
      platform(290, 110, 100),
    ],
    spikes: [],
    enemies: [enemy(1, 400, 150, 400, 4), enemy(2, 250, 300, 400, 3.6), enemy(3, 180, 150, 260, 3.8)],
    goal: goal(322, 110),
  }),

  // 36 — Speed Demons 6: pits and runners.
  level(36, {
    platforms: [
      ground(0, 150),
      ground(230, 70),
      ground(350, 50),
      platform(170, 320, 110),
      platform(300, 320, 100),
    ],
    spikes: [],
    enemies: [enemy(1, 400, 230, 300, 3.5), enemy(2, 320, 170, 280, 4), enemy(3, 400, 350, 400, 3.5)],
    goal: goal(340, 320),
  }),

  // 37 — Speed Demons 7.
  level(37, {
    platforms: [
      ground(0, 400),
      platform(150, 335, 160),
      platform(240, 250, 160),
      platform(100, 165, 170),
      platform(260, 80, 110),
    ],
    spikes: [spikes(150, 400, 250)],
    enemies: [enemy(1, 335, 150, 310, 3.8), enemy(2, 250, 240, 400, 4), enemy(3, 165, 150, 270, 4.2)],
    goal: goal(297, 80),
  }),

  // 38 — Speed Demons 8: spikes on the platforms too.
  level(38, {
    platforms: [
      ground(0, 400),
      platform(160, 340, 120),
      // Widened 100->130 (extended toward p1, gap only shrinks): the enemy
      // originally patrolled its entire surface at close to max speed
      // (4.2), leaving no safe landing zone at all (reported as "too hard").
      platform(270, 280, 130),
      platform(150, 210, 120),
      platform(300, 140, 100),
    ],
    // The platform-top spike was shifted right (200->225): a natural,
    // un-jumped fall from spawn lands right around x=160-205 on this
    // platform, clipping the spike's old position with zero warning.
    spikes: [spikes(150, 400, 250), spikes(225, 340, 30)],
    // Confined to the far side from the landing direction, speed eased
    // slightly (still clearly "fast" for this section).
    enemies: [enemy(1, 280, 340, 400, 3.8), enemy(2, 210, 230, 270, 3.6)],
    goal: goal(340, 140),
  }),

  // 39 — Speed Demons 9: pre-boss.
  level(39, {
    platforms: [
      ground(0, 150),
      ground(270, 130),
      platform(170, 340, 70),
      platform(280, 320, 120),
      platform(160, 240, 90),
      platform(290, 165, 100),
      platform(150, 90, 90),
    ],
    spikes: [],
    enemies: [enemy(1, 400, 270, 400, 4.4), enemy(2, 320, 280, 400, 3.8), enemy(3, 165, 290, 390, 4.5)],
    goal: goal(185, 90),
  }),

  // 40 — Speed boss.
  level(40, bossArena({ speed: 3.5, hp: 5 })),
];

export function getLevel(id: number): Level {
  if (id >= 1 && id <= HAND_AUTHORED_COUNT) return HAND_AUTHORED_LEVELS[id - 1];
  if (id > HAND_AUTHORED_COUNT && id <= TOTAL_LEVELS) return generateLevel(id);
  throw new Error(`Level ${id} does not exist`);
}

export const LEVEL_COUNT = TOTAL_LEVELS;

export const levelProvider: LevelProvider = { getLevel, levelCount: LEVEL_COUNT };
