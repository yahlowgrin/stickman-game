// localStorage progress (SPEC §12): highest unlocked level + mute preference.
// Pure and DOM-free where possible so it can be unit tested with a fake store;
// every real storage access is wrapped in try/catch (private browsing, full
// storage, or a disabled API must never crash the game — see SPEC §17).

import { TOTAL_LEVELS } from "./constants";

export type Progress = {
  /** Highest level the player may play (1-based, capped at TOTAL_LEVELS). */
  unlockedLevel: number;
  muted: boolean;
};

export const DEFAULT_PROGRESS: Progress = { unlockedLevel: 1, muted: false };

const STORAGE_KEY = "stickman-physics:progress:v1";

/** Minimal storage shape so tests can inject a fake without touching jsdom/localStorage. */
export type StorageLike = Pick<Storage, "getItem" | "setItem">;

function getDefaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch (err) {
    // Some browsers throw just accessing localStorage (e.g. fully-locked private mode).
    console.warn("localStorage is unavailable:", err);
    return null;
  }
}

function clampLevel(level: unknown): number {
  const n = typeof level === "number" && Number.isFinite(level) ? Math.floor(level) : 1;
  return Math.min(Math.max(n, 1), TOTAL_LEVELS);
}

export function loadProgress(storage: StorageLike | null = getDefaultStorage()): Progress {
  if (!storage) return { ...DEFAULT_PROGRESS };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      unlockedLevel: clampLevel(parsed.unlockedLevel),
      muted: parsed.muted === true,
    };
  } catch (err) {
    console.warn("Failed to load saved progress, starting fresh:", err);
    return { ...DEFAULT_PROGRESS };
  }
}

export function saveProgress(progress: Progress, storage: StorageLike | null = getDefaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (err) {
    console.warn("Failed to save progress:", err);
  }
}

/** The unlocked level after completing `completedLevelId`, capped at TOTAL_LEVELS. */
export function unlockedAfterCompleting(current: number, completedLevelId: number): number {
  return Math.min(Math.max(current, completedLevelId + 1), TOTAL_LEVELS);
}
