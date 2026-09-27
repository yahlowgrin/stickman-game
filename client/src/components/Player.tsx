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
      data-frozen="false"
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
        {/* Ice block: shown only while frozen (data-frozen on the parent). */}
        <g className="ice-block" aria-hidden="true">
          <rect className="ice-block-fill" x="2" y="2" width="36" height="76" rx="10" />
          <path className="ice-block-facet" d="M6 8 L20 2 L34 10 L28 30 L12 28 Z" />
          <path className="ice-block-facet ice-block-facet-2" d="M4 50 L18 44 L36 58 L24 74 L6 68 Z" />
        </g>
      </svg>
    </div>
  );
}
