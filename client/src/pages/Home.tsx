import { useCallback, useEffect, useState } from "react";
import { GameViewport } from "@/components/GameViewport";
import { GameWorld } from "@/components/GameWorld";
import { Hud } from "@/components/Hud";
import { LevelSelect } from "@/components/LevelSelect";
import { Overlays } from "@/components/Overlays";
import { TouchControls } from "@/components/TouchControls";
import { LEVEL_COUNT } from "@/game/levels";
import type { GameEvent } from "@/game/types";
import { useAudio } from "@/hooks/useAudio";
import { useGameEngine } from "@/hooks/useGameEngine";
import { useKeyboardInput } from "@/hooks/useKeyboardInput";
import { useProgress } from "@/hooks/useProgress";

/** Dev builds accept `?level=N` to jump straight to a level for testing. */
function devStartLevel(): number | undefined {
  if (!import.meta.env.DEV) return undefined;
  const raw = new URLSearchParams(window.location.search).get("level");
  return raw ? Number(raw) || undefined : undefined;
}

export default function Home() {
  const { progress, setMuted, unlockThrough } = useProgress();
  const audio = useAudio();
  const [started, setStarted] = useState(false);
  const [levelSelectOpen, setLevelSelectOpen] = useState(false);

  const handleEvents = useCallback(
    (events: GameEvent[]) => {
      audio.playEvents(events);
      for (const event of events) {
        if (event.type === "complete") unlockThrough(event.levelId);
      }
    },
    [audio, unlockThrough],
  );

  const [initialLevelId] = useState(() => devStartLevel() ?? progress.unlockedLevel);
  const engine = useGameEngine({
    initialLevelId,
    paused: !started || levelSelectOpen,
    onEvents: handleEvents,
  });

  useKeyboardInput(engine.input, started && !levelSelectOpen);

  // Mute preference and the current level's music both drive the audio engine directly.
  useEffect(() => audio.setMuted(progress.muted), [audio, progress.muted]);
  useEffect(() => audio.setSection(engine.level.section), [audio, engine.level.section]);

  const openLevelSelect = useCallback(() => setLevelSelectOpen(true), []);
  const closeLevelSelect = useCallback(() => setLevelSelectOpen(false), []);
  const selectLevel = useCallback(
    (id: number) => {
      engine.goToLevel(id);
      setLevelSelectOpen(false);
    },
    [engine],
  );
  const toggleMute = useCallback(() => setMuted(!progress.muted), [progress.muted, setMuted]);
  const onStart = useCallback(() => {
    // The Start overlay's click/tap is the user gesture Web Audio requires (SPEC §15).
    audio.resume();
    setStarted(true);
  }, [audio]);

  return (
    <main className="relative mx-auto flex h-dvh w-full max-w-[640px] flex-col overflow-hidden px-2 pb-2 pt-1 sm:px-4 sm:pb-4">
      <Hud
        level={engine.level}
        muted={progress.muted}
        onToggleMute={toggleMute}
        onOpenLevelSelect={openLevelSelect}
      />
      <GameViewport>
        <GameWorld engine={engine} />
        <Overlays
          started={started}
          onStart={onStart}
          status={engine.ui.status}
          levelCount={LEVEL_COUNT}
          onPlayAgain={engine.playAgain}
        />
      </GameViewport>
      <TouchControls input={engine.input} />
      {levelSelectOpen && (
        <LevelSelect
          unlockedLevel={progress.unlockedLevel}
          currentLevelId={engine.ui.levelId}
          onSelect={selectLevel}
          onClose={closeLevelSelect}
        />
      )}
    </main>
  );
}
