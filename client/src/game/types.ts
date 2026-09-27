// Shared game types. Level definitions (static data) are kept separate from
// runtime state (mutable per play-through) — see SPEC §7.

export type Rect = { x: number; y: number; width: number; height: number };

export type ProjectileType = "fire" | "lightning" | "toxic";
export type Section = "core" | "fire" | "speed" | "lightning" | "toxic";

export type EnemyDef = {
  id: number;
  x: number;
  y: number;
  /** Left edge of the patrol range (enemy body never goes left of this). */
  startX: number;
  /** Right edge of the patrol range (enemy body never goes right of this). */
  endX: number;
  speed: number;
  width?: number;
  height?: number;
  projectileType?: ProjectileType; // present = this enemy shoots
  shootCooldown?: number; // ticks between shots
  isBoss?: boolean;
  hp?: number; // stomps required; default 1
};

export type Level = {
  id: number;
  name: string;
  section: Section;
  difficulty: number;
  goal: Rect;
  platforms: Rect[];
  spikes: Rect[];
  enemies: EnemyDef[];
};

// ---------------------------------------------------------------------------
// Runtime state
// ---------------------------------------------------------------------------

export type Facing = 1 | -1;

export type PlayerState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facing: Facing;
  /** Ticks left in which a jump is still allowed after walking off a ledge. */
  coyoteTicks: number;
  /** Ticks left in which an early jump press is remembered until landing. */
  jumpBufferTicks: number;
};

export type EnemyState = {
  id: number;
  def: EnemyDef;
  x: number;
  y: number;
  width: number;
  height: number;
  dir: Facing;
  speed: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** Ticks until the next shot may start charging (shooters only). */
  cooldown: number;
  /** Ticks left in the visible charge-up before a shot (0 = not charging). */
  chargeTicks: number;
  /** Ticks of post-hit invulnerability left (bosses). */
  invulnTicks: number;
};

export type ProjectileState = {
  id: number;
  type: ProjectileType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
};

export type GameStatus = "playing" | "dead" | "complete" | "victory";

export type DeathCause = "spike" | "enemy" | "projectile" | "fall";

export type PlayerPose = "idle" | "run" | "jump" | "fall" | "dead" | "victory";

/** Input sampled once per simulation tick. */
export type InputState = {
  left: boolean;
  right: boolean;
  /** True if jump was pressed (edge) since the previous tick. */
  jumpPressed: boolean;
};

export type GameEvent =
  | { type: "jump" }
  | { type: "land" }
  | { type: "stomp"; enemyId: number; defeated: boolean; boss: boolean }
  | { type: "death"; cause: DeathCause }
  | { type: "respawn" }
  | { type: "complete"; levelId: number }
  | { type: "levelStart"; levelId: number }
  | { type: "doorUnlock" }
  | { type: "victory" };

export type GameState = {
  levelId: number;
  level: Level;
  player: PlayerState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  nextProjectileId: number;
  status: GameStatus;
  /** Ticks remaining in the current timed status (dead / complete). */
  statusTicks: number;
  /** Death cause while status is "dead". */
  deathCause: DeathCause | null;
  /** Ticks since the level (or respawn) started. */
  tick: number;
};

/** Supplies level data to the engine; injectable for tests. */
export type LevelProvider = {
  getLevel: (id: number) => Level;
  levelCount: number;
};
