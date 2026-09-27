import type { EnemyState } from "@/game/types";

type Props = { enemy: EnemyState; enemyRef: (el: HTMLDivElement | null) => void };

/**
 * Original geometric monster: a horned block with a single visor eye that
 * looks in the walking direction. Position and state are set imperatively.
 */
export function Enemy({ enemy, enemyRef }: Props) {
  const { width: w, height: h } = enemy;
  const kind = enemy.def.projectileType ?? "normal";
  return (
    <div
      ref={enemyRef}
      className="game-enemy"
      data-kind={kind}
      data-boss={String(enemy.def.isBoss === true)}
      data-dir="right"
      data-alive="true"
      style={{ width: w, height: h }}
    >
      <svg className="game-enemy-figure" width={w} height={h} viewBox="0 0 32 28" preserveAspectRatio="none" aria-hidden="true">
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
