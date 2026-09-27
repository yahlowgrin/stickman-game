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
