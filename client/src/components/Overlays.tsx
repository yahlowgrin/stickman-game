import type { GameStatus } from "@/game/types";

type Props = {
  /** False before the player has dismissed the start overlay. */
  started: boolean;
  onStart: () => void;
  status: GameStatus;
  levelCount: number;
  onPlayAgain: () => void;
};

/** Status overlays (SPEC §14): start, death, level-complete, victory. */
export function Overlays({ started, onStart, status, levelCount, onPlayAgain }: Props) {
  if (!started) {
    return (
      <div
        className="overlay overlay-start"
        role="dialog"
        aria-modal="true"
        aria-label="Start Stickman Physics"
        onClick={onStart}
      >
        <p className="overlay-title text-white">Stickman Physics</p>
        <p className="overlay-note overlay-note-light">
          This game plays retro chiptune music and sound effects.
        </p>
        <button type="button" className="overlay-button" onClick={onStart} aria-label="Tap or click to start">
          Tap or click to start
        </button>
      </div>
    );
  }

  if (status === "dead") {
    return (
      <div className="overlay overlay-dead" role="status" aria-live="assertive">
        <p className="overlay-title text-red-600 overlay-splat">SPLAT!</p>
        <p className="overlay-note">Back to the start of the level…</p>
      </div>
    );
  }
  if (status === "complete") {
    return (
      <div className="overlay overlay-complete" role="status" aria-live="polite">
        <p className="overlay-title text-emerald-600">LEVEL COMPLETE!</p>
        <p className="overlay-note">Loading the next level…</p>
      </div>
    );
  }
  if (status === "victory") {
    return (
      <div className="overlay overlay-victory" role="dialog" aria-label="Victory">
        <p className="overlay-title text-emerald-700">YOU BEAT THE GAME!</p>
        <p className="overlay-note">All {levelCount} levels conquered.</p>
        <button type="button" className="overlay-button" onClick={onPlayAgain} aria-label="Play again from level 1">
          Play Again
        </button>
      </div>
    );
  }
  return null;
}
