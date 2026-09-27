// Game-step logic built on the pure physics functions. Pure: every call
// returns a new GameState plus the events that happened during the tick.

import {
  BOSS_COOLDOWN_RAMP,
  BOSS_HEIGHT,
  BOSS_INVULN_TICKS,
  BOSS_SPEED_RAMP,
  BOSS_WIDTH,
  COMPLETE_TICKS,
  DEATH_TICKS,
  ENEMY_HEIGHT,
  ENEMY_WIDTH,
  FREEZE_DURATION_TICKS,
  ICE_LAUNCH_VY,
  MAX_ENEMY_SPEED,
  MIN_SHOOT_COOLDOWN,
  NO_SHOT_DISTANCE,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  PROJECTILE_SIZE,
  PROJECTILE_SPEED,
  SHOT_CHARGE_TICKS,
  STOMP_BOUNCE_VELOCITY,
  TOXIC_LAUNCH_VY,
  WORLD_HEIGHT,
} from "./constants";
import { levelProvider } from "./levels";
import {
  classifyEnemyContact,
  createPlayer,
  hittingProjectiles,
  isProjectileInWorld,
  projectileHitsPlatform,
  stepEnemyPatrol,
  stepPlayer,
  stepProjectile,
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
  PlayerState,
  ProjectileState,
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
    fireInterval: def.shootCooldown ?? 0,
  };
}

/**
 * Advance a shooter's charge/cooldown state machine by one tick. Returns the
 * updated enemy and a freshly spawned projectile, if this was the tick it fired.
 *
 * Cycle: cooldown counts down to 0 -> if the player isn't within the no-shot
 * distance, start a visible charge -> charge counts down to 0 -> fire and
 * reset the cooldown. Skipped shots (player too close) simply retry next tick.
 */
function stepEnemyShooting(
  e: EnemyState,
  player: PlayerState,
  projectileId: number,
): { enemy: EnemyState; projectile: ProjectileState | null } {
  const type = e.def.projectileType;
  if (!e.alive || !type) return { enemy: e, projectile: null };

  if (e.chargeTicks > 0) {
    const chargeTicks = e.chargeTicks - 1;
    if (chargeTicks > 0) return { enemy: { ...e, chargeTicks }, projectile: null };
    const size = PROJECTILE_SIZE[type];
    const muzzleX = e.dir > 0 ? e.x + e.width : e.x - size.width;
    const projectile: ProjectileState = {
      id: projectileId,
      type,
      x: muzzleX,
      y: e.y + e.height / 2 - size.height / 2,
      vx: PROJECTILE_SPEED[type] * e.dir,
      vy: type === "toxic" ? TOXIC_LAUNCH_VY : type === "ice" ? ICE_LAUNCH_VY : 0,
      width: size.width,
      height: size.height,
    };
    return { enemy: { ...e, chargeTicks: 0, cooldown: e.fireInterval }, projectile };
  }

  if (e.cooldown > 0) return { enemy: { ...e, cooldown: e.cooldown - 1 }, projectile: null };

  const muzzleX = e.dir > 0 ? e.x + e.width : e.x;
  const playerCenterX = player.x + PLAYER_WIDTH / 2;
  if (Math.abs(playerCenterX - muzzleX) < NO_SHOT_DISTANCE) return { enemy: e, projectile: null };
  return { enemy: { ...e, chargeTicks: SHOT_CHARGE_TICKS }, projectile: null };
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

/** Boss escalation on a hit that doesn't defeat it: faster and quicker to fire. */
function ramp(e: EnemyState): Pick<EnemyState, "speed" | "fireInterval"> {
  const type = e.def.projectileType;
  return {
    speed: Math.min(MAX_ENEMY_SPEED, Math.round(e.speed * BOSS_SPEED_RAMP * 100) / 100),
    fireInterval: type
      ? Math.max(MIN_SHOOT_COOLDOWN[type], Math.round(e.fireInterval * BOSS_COOLDOWN_RAMP))
      : e.fireInterval,
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

  // Shooters: advance charge/cooldown and collect any newly fired projectiles.
  let nextProjectileId = state.nextProjectileId;
  const fired: ProjectileState[] = [];
  enemies = enemies.map((e) => {
    const result = stepEnemyShooting(e, player, nextProjectileId);
    if (result.projectile) {
      fired.push(result.projectile);
      events.push({ type: "shoot", enemyId: e.id, projectileType: result.projectile.type });
      nextProjectileId++;
    }
    return result.enemy;
  });

  // Projectiles: move, then drop any that left the world or (toxic/ice, both
  // thrown in an arc) hit a platform.
  let projectiles = [...state.projectiles.map(stepProjectile), ...fired].filter(
    (p) => isProjectileInWorld(p) && !projectileHitsPlatform(p, level.platforms),
  );

  let next: GameState = { ...state, player, enemies, projectiles, nextProjectileId, tick: state.tick + 1 };

  if (player.y > WORLD_HEIGHT) return die(next, "fall", events);
  if (touchesSpike(player, level)) return die(next, "spike", events);

  // Ice balls freeze (immobilize) rather than kill; everything else is lethal.
  // A freeze doesn't end the tick, so a lethal hit in the same tick still wins.
  const hits = hittingProjectiles(player, projectiles);
  const lethalHit = hits.some((p) => p.type !== "ice");
  if (lethalHit) return die(next, "projectile", events);
  const iceHit = hits.find((p) => p.type === "ice");
  if (iceHit) {
    player = { ...player, frozenTicks: FREEZE_DURATION_TICKS };
    projectiles = projectiles.filter((p) => p !== iceHit);
    events.push({ type: "freeze" });
    next = { ...next, player, projectiles };
  }

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
    const defeated = hp <= 0;
    events.push({ type: "stomp", enemyId: e.id, defeated, boss });
    if (boss) events.push({ type: "bossHit", enemyId: e.id, hp, defeated });
    return {
      ...e,
      hp,
      alive: hp > 0,
      invulnTicks: boss && hp > 0 ? BOSS_INVULN_TICKS : 0,
      ...(boss && hp > 0 ? ramp(e) : null),
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
