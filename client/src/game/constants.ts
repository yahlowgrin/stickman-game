// All tunable numbers live here. Everything "per tick" refers to the fixed
// 60 Hz simulation step (SPEC §4).

// World -----------------------------------------------------------------------
export const WORLD_WIDTH = 400;
export const WORLD_HEIGHT = 500;
export const GROUND_Y = 400;

// Timing ----------------------------------------------------------------------
export const TICKS_PER_SECOND = 60;
export const TICK_MS = 1000 / TICKS_PER_SECOND;
/** Longest frame delta fed into the accumulator (avoids a spiral of death). */
export const MAX_FRAME_MS = 100;
/** Tolerance so 120/144 Hz frame sums don't lose a tick to float rounding. */
export const ACCUMULATOR_EPSILON_MS = 1e-6;

// Player physics --------------------------------------------------------------
export const GRAVITY = 0.6;
export const JUMP_VELOCITY = -12;
export const MOVE_SPEED = 5;
export const MAX_FALL_SPEED = 15;
export const PLAYER_WIDTH = 40;
export const PLAYER_HEIGHT = 80;
export const SPAWN_X = 50;
export const SPAWN_Y = 100;
/** Grace ticks to still jump after running off an edge. */
export const COYOTE_TICKS = 5;
/** Ticks a jump press is remembered before landing. */
export const JUMP_BUFFER_TICKS = 6;
/** Minimum downward speed at landing that counts as a "land" event (sound). */
export const LAND_EVENT_MIN_VY = 4;

// Hazards ---------------------------------------------------------------------
/** Spike hitboxes are shrunk by this much on each side to feel fair. */
export const SPIKE_HITBOX_INSET = 4;
/** Spawn safety zone: no spikes or enemies left of this x above the landing surface. */
export const SPAWN_SAFE_WIDTH = 150;

// Enemies ---------------------------------------------------------------------
export const ENEMY_WIDTH = 32;
export const ENEMY_HEIGHT = 28;
export const BOSS_WIDTH = 64;
export const BOSS_HEIGHT = 56;
/** Upward velocity given to the player after a stomp. */
export const STOMP_BOUNCE_VELOCITY = -8;
/** How far below an enemy's top the player's feet may be (previous tick) for a stomp. */
export const STOMP_TOLERANCE = 4;
/** Post-hit invulnerability for bosses (~0.5 s). */
export const BOSS_INVULN_TICKS = 30;

// Goal ------------------------------------------------------------------------
export const GOAL_WIDTH = 36;
export const GOAL_HEIGHT = 50;

// Status timers ---------------------------------------------------------------
/** Input disabled and "SPLAT!" shown for ~1 s after death. */
export const DEATH_TICKS = 60;
/** "LEVEL COMPLETE!" shown for ~1.2 s. */
export const COMPLETE_TICKS = 72;

// Level geometry defaults -----------------------------------------------------
export const PLATFORM_THICKNESS = 16;
export const SPIKE_HEIGHT = 20;

// Level count and sections ----------------------------------------------------
export const TOTAL_LEVELS = 200;
export const HAND_AUTHORED_COUNT = 40;
export const FIRST_BOSS_LEVEL = 20;
export const BOSS_LEVEL_INTERVAL = 10;

// Fairness (SPEC §5) ------------------------------------------------------------
/** Max edge-to-edge gap when the target is at the same height or lower. */
export const GAP_SAME_OR_LOWER = 140;
/** Max gap when the target is up to RISE_LOW px higher. */
export const GAP_RISE_LOW = 120;
export const RISE_LOW = 60;
/** Max gap when the target is up to MAX_RISE px higher. */
export const GAP_RISE_HIGH = 100;
export const MAX_RISE = 90;
/** From this level on, gaps may use 85% instead of 70% of theoretical reach. */
export const LATE_GAME_LEVEL = 150;
export const LATE_GAME_REACH_SCALE = 0.85 / 0.7;
/** Narrowest spike-free stretch of surface that counts as standable. */
export const MIN_STANDABLE_WIDTH = 36;
/** Enemies must stay slower than the player so it can always escape. */
export const MAX_ENEMY_SPEED = 4.5;
/** Minimum shooter cooldowns per projectile type (ticks). */
export const MIN_SHOOT_COOLDOWN = { fire: 60, lightning: 50, toxic: 45 } as const;
/** Boss arenas need one continuous spike-free ground stretch at least this wide. */
export const BOSS_ARENA_MIN_GROUND = 320;

// Shooters and projectiles (SPEC §11) -------------------------------------------
/** Visible charge-up before a shooter fires (~0.4 s). */
export const SHOT_CHARGE_TICKS = 24;
/** A shot is skipped if the player is this close to the muzzle horizontally. */
export const NO_SHOT_DISTANCE = 60;

export const PROJECTILE_SPEED = { fire: 3, lightning: 6, toxic: 3 } as const;
export const TOXIC_LAUNCH_VY = -6;
export const TOXIC_GRAVITY = 0.3;

export const PROJECTILE_SIZE = {
  fire: { width: 16, height: 16 },
  lightning: { width: 28, height: 9 },
  toxic: { width: 16, height: 16 },
} as const;

// Bosses: escalation on each non-defeating hit (SPEC §11) -----------------------
export const BOSS_SPEED_RAMP = 1.15;
export const BOSS_COOLDOWN_RAMP = 0.85;

// Fast enemies (SPEC §11) ---------------------------------------------------------
/** Enemies at or above this speed render as the "fast" visual variant. */
export const FAST_ENEMY_SPEED_THRESHOLD = 3.5;

// Rendering ---------------------------------------------------------------------
/** Fixed DOM pool size for projectiles; comfortably above any level's peak count. */
export const MAX_RENDERED_PROJECTILES = 32;
