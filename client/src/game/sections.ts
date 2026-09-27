// Level-id → section / boss metadata (SPEC §11, §12).

import { BOSS_LEVEL_INTERVAL, FIRST_BOSS_LEVEL, TOTAL_LEVELS } from "./constants";
import type { ProjectileType, Section } from "./types";

export function sectionFor(id: number): Section {
  if (id <= 20) return "core";
  if (id <= 30) return "fire";
  if (id <= 40) return "speed";
  if (id <= 100) return "lightning";
  return "toxic";
}

export const SECTION_RANGES: Record<Section, readonly [number, number]> = {
  core: [1, 20],
  fire: [21, 30],
  speed: [31, 40],
  lightning: [41, 100],
  toxic: [101, 200],
};

export const SECTION_LABELS: Record<Section, string> = {
  core: "Core",
  fire: "Fire",
  speed: "Speed",
  lightning: "Lightning",
  toxic: "Toxic",
};

/** Projectile type used by shooters in a section, if any. */
export function sectionProjectile(section: Section): ProjectileType | undefined {
  if (section === "fire") return "fire";
  if (section === "lightning") return "lightning";
  if (section === "toxic") return "toxic";
  return undefined;
}

/** 0 at the first level of the section, 1 at the last. */
export function sectionProgress(id: number): number {
  const [first, last] = SECTION_RANGES[sectionFor(id)];
  return last === first ? 0 : (id - first) / (last - first);
}

export function isBossLevel(id: number): boolean {
  return id >= FIRST_BOSS_LEVEL && id <= TOTAL_LEVELS && id % BOSS_LEVEL_INTERVAL === 0;
}

/** Required boss HP per the SPEC §11 table. */
export function bossHp(id: number): number {
  if (id === 20) return 3;
  if (id === 30 || id === 40) return 5;
  if (id <= 100) return 5 + Math.floor(((id - 50) / 50) * 3); // 50 → 5 … 100 → 8
  return 6 + Math.floor(((id - 110) / 90) * 4 + 1e-9); // 110 → 6 … 190 → 9, 200 → 10
}
