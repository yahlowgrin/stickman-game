import { FAST_ENEMY_SPEED_THRESHOLD } from "@/game/constants";
import type { EnemyState } from "@/game/types";

type Props = { enemy: EnemyState; enemyRef: (el: HTMLDivElement | null) => void };

/**
 * Original geometric monster: a horned block with a single visor eye that
 * looks in the walking direction. Color and trim vary by kind (data-kind) and
 * boss status (data-boss); position, facing, alive/charging/invulnerable
 * state are all set imperatively by the game loop via data-attributes.
 */
export function Enemy({ enemy, enemyRef }: Props) {
  const { width: w, height: h } = enemy;
  const kind = enemy.def.projectileType ?? "normal";
  const isBoss = enemy.def.isBoss === true;
  const isFast = enemy.speed >= FAST_ENEMY_SPEED_THRESHOLD;
  // Bosses get extra headroom above the body for a crown.
  const viewBox = isBoss ? "0 -9 32 37" : "0 0 32 28";

  return (
    <div
      ref={enemyRef}
      className="game-enemy"
      data-kind={kind}
      data-boss={String(isBoss)}
      data-fast={String(isFast)}
      data-dir="right"
      data-alive="true"
      data-charging="false"
      data-invulnerable="false"
      style={{ width: w, height: h }}
    >
      {isBoss && (
        <div className="boss-pips" aria-hidden="true">
          {Array.from({ length: enemy.maxHp }, (_, i) => (
            <span key={i} className="hp-pip filled" />
          ))}
        </div>
      )}
      <svg
        className="game-enemy-figure"
        width={w}
        height={h}
        viewBox={viewBox}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <circle className="enemy-charge-glow" cx="16" cy="14" r="15" />
        {isBoss && (
          <polygon className="enemy-crown" points="7,1 10,-6 14,0 16,-8 18,0 22,-6 25,1" />
        )}
        <polygon className="enemy-horn" points="5,8 8,0 12,7" />
        <polygon className="enemy-horn" points="20,7 24,0 27,8" />
        <rect className="enemy-body" x="2" y="6" width="28" height="18" rx="5" />
        <rect className="enemy-visor" x="14" y="10" width="13" height="7" rx="3.5" />
        <circle className="enemy-pupil" cx="23" cy="13.5" r="2.3" />
        <rect className="enemy-foot" x="5" y="23" width="7" height="5" rx="2" />
        <rect className="enemy-foot" x="20" y="23" width="7" height="5" rx="2" />
      </svg>
    </div>
  );
}
