import { useCallback, useState } from "react";
import { loadProgress, type Progress, saveProgress, unlockedAfterCompleting } from "@/game/persistence";

export type ProgressApi = {
  progress: Progress;
  setMuted: (muted: boolean) => void;
  /** Call when `completedLevelId` is finished; unlocks the next level if needed. */
  unlockThrough: (completedLevelId: number) => void;
};

/** Loads saved progress once, and persists every change back to storage. */
export function useProgress(): ProgressApi {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());

  const setMuted = useCallback((muted: boolean) => {
    setProgress((prev) => {
      if (prev.muted === muted) return prev;
      const next = { ...prev, muted };
      saveProgress(next);
      return next;
    });
  }, []);

  const unlockThrough = useCallback((completedLevelId: number) => {
    setProgress((prev) => {
      const unlockedLevel = unlockedAfterCompleting(prev.unlockedLevel, completedLevelId);
      if (unlockedLevel === prev.unlockedLevel) return prev;
      const next = { ...prev, unlockedLevel };
      saveProgress(next);
      return next;
    });
  }, []);

  return { progress, setMuted, unlockThrough };
}
