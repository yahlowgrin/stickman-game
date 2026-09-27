// Game-step logic built on the pure physics functions. Pure: every call
// returns a new GameState plus the events that happened during the tick.

import {
  BOSS_HEIGHT,
  BOSS_INVULN_TICKS,
  BOSS_WIDTH,
  COMPLETE_TICKS,
  DEATH_TICKS,
  ENEMY_HEIGHT,
  ENEMY_WIDTH,
  PLAYER_HEIGHT,
  STOMP_BOUNCE_VELOCITY,
  WORLD_HEIGHT,
} from "./constants";
import { levelProvider } from "./levels";
import {
  classifyEnemyContact,
  createPlayer,
  stepEnemyPatrol,
  stepPlayer,
  touchesGoal,
  touchesSpike,
} from "./physics";
import type {
  DeathCause,
  EnemyDef,
  EnemyState,
  GameEvent,
  GameState,
  InputState,
  Level,
  LevelProvider,
  PlayerPose,
} from "./types";

export const NO_INPUT: InputState = { left: false, right: false, jumpPressed: false };

export function createEnemyState(def: EnemyDef): EnemyState {
  const hp = def.hp ?? 1;
  return {
    id: def.id,
    def,
    x: def.x,
    y: def.y,
    width: def.width ?? (def.isBoss ? BOSS_WIDTH : ENEMY_WIDTH),
    height: def.height ?? (def.isBoss ? BOSS_HEIGHT : ENEMY_HEIGHT),
    dir: 1,
    speed: def.speed,
    hp,
    maxHp: hp,
    alive: true,
    cooldown: def.shootCooldown ?? 0,
    chargeTicks: 0,
    invulnTicks: 0,
  };
}

/** Fresh state for a level: player at spawn, enemies/projectiles/timers reset. */
export function createLevelState(level: Level): GameState {
  return {
    levelId: level.id,
    level,
    player: createPlayer(),
    enemies: level.enemies.map(createEnemyState),
    projectiles: [],
    nextProjectileId: 1,
    status: "playing",
    statusTicks: 0,
    deathCause: null,
    tick: 0,
  };
}

export function createGameState(
  levelId: number,
  provider: LevelProvider = levelProvider,
): GameState {
  const id = Math.min(Math.max(1, Math.floor(levelId)), provider.levelCount);
  return createLevelState(provider.getLevel(id));
}

/** Boss levels keep the door locked while any boss is alive. */
export function isGoalLocked(state: GameState): boolean {
  return state.enemies.some((e) => e.def.isBoss && e.alive);
}

export type StepResult = { state: GameState; events: GameEvent[] };

/** Advance the whole game by one fixed 60 Hz tick. */
export function stepGame(
  state: GameState,
  input: InputState,
  provider: LevelProvider = levelProvider,
): StepResult {
  switch (state.status) {
    case "victory":
      return { state, events: [] };
    case "dead":
      return stepTimer(state, () => respawn(state));
    case "complete":
      return stepTimer(state, () => advanceLevel(state, provider));
    case "playing":
      return stepPlaying(state, input);
  }
}

function stepTimer(state: GameState, onExpire: () => StepResult): StepResult {
  if (state.statusTicks > 1) {
    return { state: { ...state, statusTicks: state.statusTicks - 1 }, events: [] };
  }
  return onExpire();
}

function respawn(state: GameState): StepResult {
  return { state: createLevelState(state.level), events: [{ type: "respawn" }] };
}

function advanceLevel(state: GameState, provider: LevelProvider): StepResult {
  if (state.levelId >= provider.levelCount) {
    return {
      state: { ...state, status: "victory", statusTicks: 0 },
      events: [{ type: "victory" }],
    };
  }
  const next = createGameState(state.levelId + 1, provider);
  return { state: next, events: [{ type: "levelStart", levelId: next.levelId }] };
}

function die(state: GameState, cause: DeathCause, events: GameEvent[]): StepResult {
  events.push({ type: "death", cause });
  return {
    state: {
      ...state,
      player: { ...state.player, vx: 0, vy: 0 },
      status: "dead",
      statusTicks: DEATH_TICKS,
      deathCause: cause,
    },
    events,
  };
}

function stepPlaying(state: GameState, input: InputState): StepResult {
  const events: GameEvent[] = [];
  const { level } = state;
  const prevBottom = state.player.y + PLAYER_HEIGHT;
  const wasLocked = isGoalLocked(state);

  const moved = stepPlayer(state.player, input, level.platforms);
  let player = moved.player;
  if (moved.jumped) events.push({ type: "jump" });
  if (moved.landed) events.push({ type: "land" });

  let enemies = state.enemies.map(stepEnemyPatrol);
  let next: GameState = { ...state, player, enemies, tick: state.tick + 1 };

  if (player.y > WORLD_HEIGHT) return die(next, "fall", events);
  if (touchesSpike(player, level)) return die(next, "spike", events);

  // Enemy contact: stomp from above damages, anything else kills.
  let stomped = false;
  enemies = enemies.map((e) => {
    if (stomped) return e;
    const contact = classifyEnemyContact(player, prevBottom, e);
    if (contact !== "stomp") return e;
    stomped = true;
    player = { ...player, y: e.y - PLAYER_HEIGHT, vy: STOMP_BOUNCE_VELOCITY, onGround: false };
    if (e.invulnTicks > 0) return e;
    const hp = e.hp - 1;
    const boss = e.def.isBoss === true;
    events.push({ type: "stomp", enemyId: e.id, defeated: hp <= 0, boss });
    return {
      ...e,
      hp,
      alive: hp > 0,
      invulnTicks: boss && hp > 0 ? BOSS_INVULN_TICKS : 0,
    };
  });
  next = { ...next, player, enemies };

  if (!stomped) {
    const hit = enemies.some(
      (e) => e.invulnTicks === 0 && classifyEnemyContact(player, prevBottom, e) === "hit",
    );
    if (hit) return die(next, "enemy", events);
  }

  const locked = isGoalLocked(next);
  if (wasLocked && !locked) events.push({ type: "doorUnlock" });

  if (!locked && touchesGoal(player, level)) {
    events.push({ type: "complete", levelId: state.levelId });
    return {
      state: {
        ...next,
        player: { ...player, vx: 0, vy: 0 },
        status: "complete",
        statusTicks: COMPLETE_TICKS,
      },
      events,
    };
  }

  return { state: next, events };
}

/** Restart from level 1 after the victory screen. */
export function playAgain(provider: LevelProvider = levelProvider): GameState {
  return createGameState(1, provider);
}

export function getPlayerPose(state: GameState): PlayerPose {
  if (state.status === "dead") return "dead";
  if (state.status === "complete" || state.status === "victory") return "victory";
  const p = state.player;
  if (!p.onGround) return p.vy < 0 ? "jump" : "fall";
  return p.vx !== 0 ? "run" : "idle";
}
