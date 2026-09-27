import { GameViewport } from "@/components/GameViewport";
import { GameWorld } from "@/components/GameWorld";
import { Hud } from "@/components/Hud";
import { Overlays } from "@/components/Overlays";
import { LEVEL_COUNT } from "@/game/levels";
import { useGameEngine } from "@/hooks/useGameEngine";
import { useKeyboardInput } from "@/hooks/useKeyboardInput";

/** Dev builds accept `?level=N` to jump straight to a level for testing. */
function devStartLevel(): number {
  if (!import.meta.env.DEV) return 1;
  return Number(new URLSearchParams(window.location.search).get("level")) || 1;
}

export default function Home() {
  const engine = useGameEngine({ initialLevelId: devStartLevel() });
  useKeyboardInput(engine.input, true);

  return (
    <main className="mx-auto flex h-dvh w-full max-w-[640px] flex-col overflow-hidden px-2 pb-2 pt-1 sm:px-4 sm:pb-4">
      <Hud level={engine.level} />
      <GameViewport>
        <GameWorld engine={engine} />
        <Overlays status={engine.ui.status} levelCount={LEVEL_COUNT} onPlayAgain={engine.playAgain} />
      </GameViewport>
    </main>
  );
}
