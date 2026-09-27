// Deterministic procedural levels 41–200 (SPEC §8).
//
// Each level id picks a layout template (never the same as the previous
// level's) and builds a candidate layout from a mulberry32 PRNG seeded with
// the id. Candidates are checked with the level validator; the first passing
// attempt is used, so every generated level is valid by construction and the
// same id always yields the same level. Only the seeded PRNG below is used.

import {
  ENEMY_WIDTH,
  GOAL_WIDTH,
  GROUND_Y,
  HAND_AUTHORED_COUNT,
  MAX_ENEMY_SPEED,
  MIN_SHOOT_COOLDOWN,
  PLAYER_HEIGHT,
  SPAWN_SAFE_WIDTH,
  TOTAL_LEVELS,
  WORLD_WIDTH,
} from "./constants";
import { bossArena, enemy, goal, ground, platform, spikes } from "./levelBuilders";
import { isGround, overlapsHorizontally } from "./physics";
import { bossHp, isBossLevel, SECTION_RANGES, sectionFor, sectionProgress, sectionProjectile } from "./sections";
import type { EnemyDef, Level, ProjectileType, Rect, Section } from "./types";
import { findSpawnLanding, isGoalReachable, maxGap, validateLevel } from "./validation";

// ---------------------------------------------------------------------------
// PRNG
// ---------------------------------------------------------------------------

/** mulberry32: tiny, fast, good-enough 32-bit PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private readonly next: () => number;
  constructor(seed: number) {
    this.next = mulberry32(seed);
  }
  float(): number {
    return this.next();
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Templates and names
// ---------------------------------------------------------------------------

export const TEMPLATES = [
  "staircase",
  "zigzag",
  "climb",
  "gauntlet",
  "islands",
  "split",
  "pits",
  "descent",
] as const;

export type TemplateName = (typeof TEMPLATES)[number] | "bossArena";

function rawTemplateOrder(block: number): TemplateName[] {
  return new Rng(0x7e3a1 + block * 977).shuffle(TEMPLATES);
}

/** Template for a generated level; consecutive levels never share one. */
export function templateFor(id: number): TemplateName {
  if (isBossLevel(id)) return "bossArena";
  const n = TEMPLATES.length;
  const index = id - (HAND_AUTHORED_COUNT + 1);
  const block = Math.floor(index / n);
  const order = rawTemplateOrder(block);
  // Positions 0 and 1 are the only ones ever swapped, so the previous block's
  // last entry is always its raw last entry.
  if (block > 0 && order[0] === rawTemplateOrder(block - 1)[n - 1]) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  return order[index % n];
}

type GeneratedSection = "lightning" | "ice" | "toxic";

const SECTION_WORDS: Record<GeneratedSection, { first: string[]; second: string[] }> = {
  lightning: {
    first: ["Static", "Voltage", "Thunder", "Spark", "Surge", "Ion", "Arc", "Storm", "Charged", "Plasma", "Neon", "Tesla"],
    second: ["Climb", "Ladder", "Steps", "Run", "Alley", "Heights", "Gauntlet", "Bridge", "Maze", "Tower", "Leap", "Crossing"],
  },
  ice: {
    first: ["Frost", "Glacial", "Frozen", "Arctic", "Chill", "Rime", "Polar", "Icicle", "Blizzard", "Crystal", "Winter", "Sleet"],
    second: ["Slope", "Path", "Drift", "Cavern", "Ridge", "Spire", "Descent", "Bridge", "Passage", "Cliffs", "Traverse", "Crossing"],
  },
  toxic: {
    first: ["Sludge", "Acid", "Toxic", "Venom", "Slime", "Blight", "Miasma", "Ooze", "Corrosive", "Fungal", "Bile", "Murk"],
    second: ["Steps", "Rain", "Pits", "Marsh", "Ladder", "Hollow", "Falls", "Spire", "Sprint", "Swamp", "Descent", "Crossing"],
  },
};
const NAME_SEED: Record<GeneratedSection, number> = { lightning: 4242, ice: 7373, toxic: 5151 };
const BOSS_NAME: Record<GeneratedSection, string> = { lightning: "Thunder God", ice: "Frost King", toxic: "Poison King" };

const nameCache = new Map<Section, string[]>();

function namePool(section: GeneratedSection): string[] {
  let pool = nameCache.get(section);
  if (!pool) {
    const words = SECTION_WORDS[section];
    const combos = words.first.flatMap((a) => words.second.map((b) => `${a} ${b}`));
    pool = new Rng(NAME_SEED[section]).shuffle(combos);
    nameCache.set(section, pool);
  }
  return pool;
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

function isGeneratedSection(section: Section): section is GeneratedSection {
  return section === "lightning" || section === "ice" || section === "toxic";
}

/** Deterministic, unique themed name for a generated level. */
export function generatedLevelName(id: number): string {
  const section = sectionFor(id);
  if (!isGeneratedSection(section)) throw new Error(`Level ${id} is hand-authored`);
  const [first] = SECTION_RANGES[section];
  if (isBossLevel(id)) {
    if (id === TOTAL_LEVELS) return "The Final Poison King";
    const nth = (id - (first - 1)) / 10; // 1-based boss number within the section
    return `${BOSS_NAME[section]} ${ROMAN[nth - 1]}`;
  }
  // Index among the section's non-boss levels.
  const bossesBefore = Math.floor((id - (first - 1)) / 10);
  return namePool(section)[id - first - bossesBefore];
}

// ---------------------------------------------------------------------------
// Generation context
// ---------------------------------------------------------------------------

type Layout = { platforms: Rect[]; spikes: Rect[]; enemies: EnemyDef[]; goal: Rect };

export type Ctx = {
  id: number;
  rng: Rng;
  /** Overall difficulty 0 (level 41) … 1 (level 200). */
  t: number;
  /** Progress within the section 0 … 1. */
  u: number;
  section: Section;
  projectile: ProjectileType | undefined;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const snap = (v: number) => Math.round(v / 5) * 5;
const snapDown = (v: number) => Math.floor(v / 5) * 5;

/** Raised platforms stay well clear of the floor (and its spikes). */
const MAX_PLATFORM_TOP = GROUND_Y - 40;

/** The safe ground strip the player spawns on in spike-floor layouts. */
const SPAWN_GROUND: Rect = { x: 0, y: GROUND_Y, width: SPAWN_SAFE_WIDTH, height: 0 };

function spikeFloor(): Pick<Layout, "platforms" | "spikes"> {
  return {
    platforms: [ground(0, WORLD_WIDTH)],
    spikes: [spikes(SPAWN_SAFE_WIDTH, GROUND_Y, WORLD_WIDTH - SPAWN_SAFE_WIDTH)],
  };
}

type WalkOpts = {
  steps: number;
  dirMode: "wall" | "alternate";
  /** Rise per step (negative = step down). */
  rise: [number, number];
  /** Rise for the first step (e.g. off the floor), if different. */
  firstRise?: [number, number];
  /** Rise used when a "wall" walk has to turn around. */
  turnRise?: [number, number];
  /** Horizontal gap as a fraction of the maximum allowed gap (negative = overlap). */
  gapFrac: [number, number];
  width: [number, number];
  minTop?: number;
  maxTop?: number;
  xMin?: number;
  xMax?: number;
  startDir?: 1 | -1;
};

/** Lay out a chain of platforms, each a legal jump from the previous one. */
function walk(ctx: Ctx, start: Rect, o: WalkOpts): Rect[] {
  const { rng } = ctx;
  const xMin = o.xMin ?? 0;
  const xMax = o.xMax ?? WORLD_WIDTH;
  const out: Rect[] = [];
  let prev = start;
  let dir: 1 | -1 = o.startDir ?? 1;

  const place = (d: 1 | -1, rise: number, width: number): Rect | null => {
    const allowed = maxGap(rise, ctx.id);
    if (allowed === null) return null;
    const gap = snapDown(allowed * rng.range(o.gapFrac[0], o.gapFrac[1]));
    const x = d > 0 ? prev.x + prev.width + gap : prev.x - gap - width;
    const top = prev.y - rise;
    if (x < xMin || x + width > xMax) return null;
    if (o.minTop !== undefined && top < o.minTop) return null;
    if (top > (o.maxTop ?? MAX_PLATFORM_TOP)) return null;
    return platform(x, top, width);
  };

  for (let i = 0; i < o.steps; i++) {
    const width = snap(rng.range(o.width[0], o.width[1]));
    const riseRange = i === 0 && o.firstRise ? o.firstRise : o.rise;
    const rise = snap(rng.range(riseRange[0], riseRange[1]));
    let next = place(dir, rise, width);
    if (!next) {
      const turn = o.turnRise ? snap(rng.range(o.turnRise[0], o.turnRise[1])) : rise;
      next = place(dir === 1 ? -1 : 1, turn, width);
      if (next) dir = dir === 1 ? -1 : 1;
    }
    if (!next) break;
    out.push(next);
    prev = next;
    if (o.dirMode === "alternate") dir = dir === 1 ? -1 : 1;
  }
  return out;
}

function goalOn(surface: Rect, rng: Rng): Rect {
  const slack = surface.width - GOAL_WIDTH;
  return goal(surface.x + Math.round(slack * rng.range(0.3, 0.7)), surface.y);
}

/** Difficulty-scaled ranges shared by the templates. */
function params(ctx: Ctx) {
  const { t } = ctx;
  return {
    gapFrac: [lerp(0.25, 0.6, t), lerp(0.5, 0.95, t)] as [number, number],
    width: [lerp(70, 44, t), lerp(105, 64, t)] as [number, number],
    enemyCount: 1 + Math.round(t * 2.5),
  };
}

// ---------------------------------------------------------------------------
// Enemies and extra hazards
// ---------------------------------------------------------------------------

function shooterCooldown(ctx: Ctx): number {
  const type = ctx.projectile ?? "lightning";
  return Math.max(MIN_SHOOT_COOLDOWN[type], Math.round(lerp(170, MIN_SHOOT_COOLDOWN[type], ctx.u)));
}

/** True if a patrol on `surface` over [x0, x1] would hang less than a player-height above another surface. */
function hangsOverSurface(surface: Rect, x0: number, x1: number, platforms: readonly Rect[]): boolean {
  return platforms.some(
    (p) => p !== surface && p.y > surface.y && p.y - surface.y < PLAYER_HEIGHT && x0 < p.x + p.width && x1 > p.x,
  );
}

/**
 * Put enemies on some of the candidate surfaces. Shooters use the section's
 * projectile; wide surfaces may get fast runners.
 */
function addEnemies(ctx: Ctx, layout: Layout, candidates: Rect[], count: number): void {
  const { rng, t } = ctx;
  const landing = findSpawnLanding({ ...layout, id: ctx.id, name: "", section: ctx.section, difficulty: 0 });
  let shooters = ctx.projectile ? Math.max(1, Math.round(count * lerp(0.4, 0.6, t))) : 0;
  let placed = 0;
  for (const surface of rng.shuffle(candidates)) {
    if (placed >= count) break;
    let x0 = surface.x;
    const x1 = surface.x + surface.width;
    // Stay out of the spawn area (anything above the spawn landing, left of the safe width).
    if (landing && surface.y <= landing.y) x0 = Math.max(x0, SPAWN_SAFE_WIDTH);
    if (x1 - x0 < ENEMY_WIDTH + 16) continue;
    if (hangsOverSurface(surface, x0, x1, layout.platforms)) continue;
    const id = layout.enemies.length + 1;
    if (shooters > 0) {
      layout.enemies.push(
        enemy(id, surface.y, x0, x1, snap(rng.range(8, 15)) / 10, {
          projectileType: ctx.projectile,
          shootCooldown: shooterCooldown(ctx),
        }),
      );
      shooters--;
    } else if (x1 - x0 >= 120 && rng.chance(lerp(0.3, 0.6, t))) {
      const speed = Math.min(MAX_ENEMY_SPEED, Math.round(rng.range(3.5, 4.5) * 10) / 10);
      layout.enemies.push(enemy(id, surface.y, x0, x1, speed));
    } else {
      const speed = Math.round(rng.range(lerp(1.2, 1.8, t), lerp(1.8, 2.6, t)) * 10) / 10;
      layout.enemies.push(enemy(id, surface.y, x0, x1, speed));
    }
    placed++;
  }
}

/** Put a short spike strip in the middle of some wide platforms (both ends stay standable). */
function addPlatformSpikes(ctx: Ctx, layout: Layout, candidates: Rect[]): void {
  const { rng, t } = ctx;
  for (const p of candidates) {
    if (p.width < 110 || !rng.chance(lerp(0.2, 0.6, t))) continue;
    const width = snap(rng.range(20, 30));
    const x = snap(p.x + (p.width - width) / 2);
    if (x - p.x < 40 || p.x + p.width - (x + width) < 40) continue;
    layout.spikes.push(spikes(x, p.y, width));
  }
}

/** Raised platforms that are free for enemies (not the spawn landing or the goal's surface). */
function enemyCandidates(layout: Layout, path: Rect[]): Rect[] {
  const goalSurface = path[path.length - 1];
  return path.filter((p) => p !== goalSurface && !layout.enemies.some((e) => e.y + (e.height ?? 0) === p.y && e.startX >= p.x && e.endX <= p.x + p.width));
}

function finishPath(ctx: Ctx, base: Pick<Layout, "platforms" | "spikes">, path: Rect[], minSteps: number): Layout | null {
  if (path.length < minSteps) return null;
  const { rng } = ctx;
  const layout: Layout = {
    platforms: [...base.platforms, ...path],
    spikes: [...base.spikes],
    enemies: [],
    goal: goalOn(path[path.length - 1], rng),
  };
  const candidates = enemyCandidates(layout, path);
  addEnemies(ctx, layout, candidates, params(ctx).enemyCount);
  addPlatformSpikes(ctx, layout, enemyCandidates(layout, path));
  return layout;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

type TemplateFn = (ctx: Ctx) => Layout | null;

const staircase: TemplateFn = (ctx) => {
  const p = params(ctx);
  const path = walk(ctx, SPAWN_GROUND, {
    steps: ctx.rng.int(6, 9),
    dirMode: "wall",
    rise: [35, 60],
    gapFrac: p.gapFrac,
    width: p.width,
    minTop: 60,
  });
  return finishPath(ctx, spikeFloor(), path, 5);
};

const zigzag: TemplateFn = (ctx) => {
  const p = params(ctx);
  const path = walk(ctx, SPAWN_GROUND, {
    steps: ctx.rng.int(5, 7),
    dirMode: "alternate",
    rise: [45, 65],
    gapFrac: [p.gapFrac[0] + 0.1, Math.min(1, p.gapFrac[1] + 0.05)],
    width: p.width,
    minTop: 60,
  });
  return finishPath(ctx, spikeFloor(), path, 4);
};

const climb: TemplateFn = (ctx) => {
  const p = params(ctx);
  const path = walk(ctx, SPAWN_GROUND, {
    steps: 6,
    dirMode: "alternate",
    rise: [60, 85],
    gapFrac: [-0.5, lerp(0.1, 0.4, ctx.t)],
    width: [p.width[0] - 5, p.width[1] - 10],
    minTop: 60,
  });
  return finishPath(ctx, spikeFloor(), path, 4);
};

const gauntlet: TemplateFn = (ctx) => {
  const p = params(ctx);
  const path = walk(ctx, SPAWN_GROUND, {
    steps: ctx.rng.int(7, 9),
    dirMode: "wall",
    rise: [-10, 20],
    firstRise: [50, 75],
    turnRise: [60, 85],
    gapFrac: p.gapFrac,
    width: [75, 115],
    minTop: 60,
  });
  if (path.length < 5) return null;
  const layout: Layout = { ...spikeFloor(), enemies: [], goal: goalOn(path[path.length - 1], ctx.rng) };
  layout.platforms.push(...path);
  addEnemies(ctx, layout, enemyCandidates(layout, path), p.enemyCount + 1);
  return layout;
};

const islands: TemplateFn = (ctx) => {
  const p = params(ctx);
  const path = walk(ctx, SPAWN_GROUND, {
    steps: ctx.rng.int(6, 8),
    dirMode: "wall",
    rise: [-25, 35],
    firstRise: [45, 60],
    turnRise: [45, 70],
    gapFrac: [p.gapFrac[0] + 0.1, Math.min(1, p.gapFrac[1] + 0.05)],
    width: [40, 60],
    minTop: 120,
  });
  return finishPath(ctx, spikeFloor(), path, 5);
};

/**
 * A ladder of platforms alternating between two x positions, climbing from
 * `firstTop` until the next step would be within `maxRise` of `targetTop`.
 */
function ladder(
  ctx: Ctx,
  xs: [number, number],
  width: [number, number],
  rise: [number, number],
  firstTop: number,
  targetTop: number,
): Rect[] {
  const { rng } = ctx;
  const out: Rect[] = [];
  let top = firstTop;
  for (let i = 0; i < 10; i++) {
    const x = xs[i % 2];
    const w = Math.min(snap(rng.range(width[0], width[1])), WORLD_WIDTH - x);
    out.push(platform(x, top, w));
    if (top - targetTop <= 85) break;
    top -= Math.min(snap(rng.range(rise[0], rise[1])), top - targetTop - 10);
  }
  return out;
}

const split: TemplateFn = (ctx) => {
  const { rng } = ctx;
  const p = params(ctx);
  const doorWidth = snap(rng.range(70, 90));
  const door = platform(snap(200 - doorWidth / 2 + rng.range(-10, 10)), snap(rng.range(85, 115)), doorWidth);

  // Left: a quiet ladder of narrow platforms. Right: wider platforms with enemies.
  const leftX = snap(rng.range(95, 105));
  const left = ladder(ctx, [leftX, leftX + snap(rng.range(55, 70))], [45, 55], [55, 75], 400 - snap(rng.range(55, 75)), door.y);
  const rightX = snap(rng.range(250, 265));
  const right = ladder(ctx, [rightX, rightX + snap(rng.range(40, 55))], [70, 90], [55, 75], 400 - snap(rng.range(40, 60)), door.y);

  // Both routes must reach the door on their own.
  const base = spikeFloor();
  const doorGoal = goalOn(door, rng);
  for (const route of [left, right]) {
    const probe: Level = {
      id: ctx.id,
      name: "probe",
      section: ctx.section,
      difficulty: 0,
      platforms: [...base.platforms, ...route, door],
      spikes: base.spikes,
      enemies: [],
      goal: doorGoal,
    };
    if (!isGoalReachable(probe)) return null;
  }
  const layout: Layout = { ...base, enemies: [], goal: doorGoal };
  layout.platforms.push(...left, ...right, door);
  addEnemies(ctx, layout, right, p.enemyCount);
  return layout;
};

const pits: TemplateFn = (ctx) => {
  const { rng, t } = ctx;
  const segments: Rect[] = [];
  let x = snap(rng.range(SPAWN_SAFE_WIDTH, 175));
  segments.push(ground(0, x));
  const gapMax = maxGap(0, ctx.id)!;
  for (;;) {
    const pit = snapDown(gapMax * rng.range(lerp(0.3, 0.55, t), lerp(0.5, 0.85, t)));
    const start = x + pit;
    if (start > WORLD_WIDTH - 50) break;
    let width = snap(rng.range(50, 90));
    if (start + width > WORLD_WIDTH - 50) width = WORLD_WIDTH - start;
    segments.push(ground(start, width));
    x = start + width;
  }
  if (segments.length < 2) return null;
  // The last segment runs to the world edge so there is no dead pit at the end.
  const tail = segments[segments.length - 1];
  segments[segments.length - 1] = ground(tail.x, WORLD_WIDTH - tail.x);
  const last = segments[segments.length - 1];
  const layout: Layout = { platforms: [...segments], spikes: [], enemies: [], goal: goalOn(last, rng) };

  // Usually finish with a short climb above the last pits.
  if (rng.chance(0.7)) {
    const climbPath = walk(ctx, last, {
      steps: rng.int(2, 3),
      dirMode: "wall",
      rise: [55, 80],
      gapFrac: [-0.4, 0.3],
      width: [60, 90],
      minTop: 80,
      startDir: -1,
    });
    if (climbPath.length > 0) {
      layout.platforms.push(...climbPath);
      layout.goal = goalOn(climbPath[climbPath.length - 1], rng);
    }
  }
  const goalSurface = layout.platforms.find((pl) => pl.y === layout.goal.y + layout.goal.height && layout.goal.x >= pl.x && layout.goal.x + layout.goal.width <= pl.x + pl.width);
  const candidates = layout.platforms.filter((pl) => pl !== goalSurface && pl !== segments[0]);
  addEnemies(ctx, layout, candidates, params(ctx).enemyCount + 1);
  return layout;
};

const descent: TemplateFn = (ctx) => {
  const { rng } = ctx;
  const p = params(ctx);
  const start = platform(10, snap(rng.range(190, 230)), 120);
  const path = walk(ctx, start, {
    steps: 7,
    dirMode: "wall",
    rise: [-55, -30],
    gapFrac: [0.15, lerp(0.4, 0.65, ctx.t)],
    width: p.width,
    maxTop: 350,
    startDir: 1,
  });
  const base = { platforms: [ground(0, WORLD_WIDTH), start], spikes: [spikes(0, GROUND_Y, WORLD_WIDTH)] };
  return finishPath(ctx, base, path, 3);
};

const bossArenaTemplate: TemplateFn = (ctx) => {
  const { rng, u } = ctx;
  const sideTop = snap(rng.range(290, 310));
  const topTop = sideTop - snap(rng.range(75, 85));
  const extra = rng.chance(0.5) ? [platform(snap(rng.range(160, 170)), 335, 70)] : [];
  // Later sections' bosses start a little faster and ramp their fire rate a
  // little harder, since the player has more experience by then.
  const tuning = { lightning: [1.5, 2.5, 70], ice: [1.55, 2.65, 68], toxic: [1.6, 2.8, 65] }[
    ctx.section as "lightning" | "ice" | "toxic"
  ] ?? [1.5, 2.5, 70];
  const [speedStart, speedEnd, cooldownEnd] = tuning;
  return bossArena(
    {
      speed: Math.round(lerp(speedStart, speedEnd, u) * 10) / 10,
      hp: bossHp(ctx.id),
      projectileType: ctx.projectile,
      shootCooldown: Math.max(
        MIN_SHOOT_COOLDOWN[ctx.projectile ?? "lightning"],
        Math.round(lerp(130, cooldownEnd, u)),
      ),
    },
    sideTop,
    topTop,
    extra,
  );
};

export const TEMPLATE_FNS: Record<TemplateName, TemplateFn> = {
  staircase,
  zigzag,
  climb,
  gauntlet,
  islands,
  split,
  pits,
  descent,
  bossArena: bossArenaTemplate,
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = 200;

/** Keep raised platforms that share x-range visually apart. */
function wellSpaced(level: Level): boolean {
  const raised = level.platforms.filter((p) => !isGround(p));
  for (let i = 0; i < raised.length; i++) {
    for (let j = i + 1; j < raised.length; j++) {
      const a = raised[i];
      const b = raised[j];
      if (overlapsHorizontally(a, b) && Math.abs(a.y - b.y) < 45) return false;
    }
  }
  return true;
}

export type GeneratedInfo = { level: Level; template: TemplateName; attempts: number };

const cache = new Map<number, GeneratedInfo>();

export function generateLevelInfo(id: number): GeneratedInfo {
  const cached = cache.get(id);
  if (cached) return cached;
  if (id <= HAND_AUTHORED_COUNT || id > TOTAL_LEVELS) throw new Error(`Level ${id} is not generated`);

  const section = sectionFor(id);
  const template = templateFor(id);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = new Rng(id * 7919 + attempt * 104729);
    const ctx: Ctx = {
      id,
      rng,
      t: (id - (HAND_AUTHORED_COUNT + 1)) / (TOTAL_LEVELS - (HAND_AUTHORED_COUNT + 1)),
      u: sectionProgress(id),
      section,
      projectile: sectionProjectile(section),
    };
    const layout = TEMPLATE_FNS[template](ctx);
    if (!layout) continue;
    const level: Level = {
      id,
      name: generatedLevelName(id),
      section,
      difficulty: id,
      ...layout,
    };
    if (validateLevel(level).length === 0 && wellSpaced(level)) {
      const info = { level, template, attempts: attempt + 1 };
      cache.set(id, info);
      return info;
    }
  }
  throw new Error(`Level ${id}: template "${template}" produced no valid layout in ${MAX_ATTEMPTS} attempts`);
}

/** Forget generated levels (tests use this to prove regeneration is identical). */
export function clearGeneratorCache(): void {
  cache.clear();
}

export function generateLevel(id: number): Level {
  return generateLevelInfo(id).level;
}
