import type { Ref } from "react";
import { PLAYER_HEIGHT, PLAYER_WIDTH } from "@/game/constants";

/**
 * Stick figure. Position, pose and facing are written imperatively each frame
 * (transform, data-pose, data-facing); CSS animates the limbs per pose.
 */
export function Player({ playerRef }: { playerRef: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={playerRef}
      className="game-player"
      data-pose="fall"
      data-facing="right"
      style={{ width: PLAYER_WIDTH, height: PLAYER_HEIGHT }}
    >
      <svg
        className="game-player-figure"
        width={PLAYER_WIDTH}
        height={PLAYER_HEIGHT}
        viewBox={`0 0 ${PLAYER_WIDTH} ${PLAYER_HEIGHT}`}
        aria-hidden="true"
      >
        <g className="stick">
          <line className="limb leg leg-back" x1="20" y1="50" x2="12" y2="78" />
          <line className="limb arm arm-back" x1="20" y1="30" x2="9" y2="45" />
          <line className="limb torso" x1="20" y1="25" x2="20" y2="51" />
          <line className="limb leg leg-front" x1="20" y1="50" x2="28" y2="78" />
          <line className="limb arm arm-front" x1="20" y1="30" x2="31" y2="45" />
          <circle className="head" cx="20" cy="14" r="10.5" />
          <g className="eyes-alive">
            <circle cx="23" cy="12.5" r="1.7" />
            <circle cx="28" cy="12.5" r="1.7" />
          </g>
          <g className="eyes-dead">
            <path d="M20.5 10.5l4 4M24.5 10.5l-4 4M26 10.5l4 4M30 10.5l-4 4" />
          </g>
        </g>
      </svg>
    </div>
  );
}
