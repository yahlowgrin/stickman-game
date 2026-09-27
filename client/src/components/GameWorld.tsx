import type { GameEngine } from "@/hooks/useGameEngine";
import { createEnemyState } from "@/game/engine";
import { Enemy } from "./Enemy";
import { Goal } from "./Goal";
import { Platform } from "./Platform";
import { Player } from "./Player";
import { Spike } from "./Spike";

/** The 400×500 logical world: static level geometry plus imperatively animated entities. */
export function GameWorld({ engine }: { engine: GameEngine }) {
  const { level } = engine;
  return (
    <div className="game-world" key={level.id}>
      <div className="game-sun" aria-hidden="true" />
      <div className="game-cloud" style={{ left: 40, top: 40, transform: "scale(1)" }} aria-hidden="true" />
      <div className="game-cloud" style={{ left: 250, top: 90, transform: "scale(0.75)" }} aria-hidden="true" />
      <div className="game-cloud" style={{ left: 150, top: 170, transform: "scale(0.55)" }} aria-hidden="true" />

      {level.platforms.map((p, i) => (
        <Platform key={`p${i}`} rect={p} />
      ))}
      {level.spikes.map((s, i) => (
        <Spike key={`s${i}`} rect={s} />
      ))}
      <Goal rect={level.goal} goalRef={engine.goalRef} />
      {level.enemies.map((def) => (
        <Enemy key={def.id} enemy={createEnemyState(def)} enemyRef={engine.registerEnemy(def.id)} />
      ))}
      <Player playerRef={engine.playerRef} />
    </div>
  );
}
