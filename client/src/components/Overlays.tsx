import type { GameStatus } from "@/game/types";

type Props = {
  status: GameStatus;
  levelCount: number;
  onPlayAgain: () => void;
};

/** Status overlays. Full styling and the start overlay arrive in phase 4. */
export function Overlays({ status, levelCount, onPlayAgain }: Props) {
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
