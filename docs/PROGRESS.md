# Progress

Source of truth: `docs/SPEC.md`. Read both files at the start of every session.

## Phases

- [x] 1. Refactor structure, types, fixed-timestep physics loop
- [x] 2. Level generator + reachability validator
- [ ] 3. Enemies, projectiles, bosses  ← **next**
- [ ] 4. UI, overlays, touch controls, persistence
- [ ] 5. Audio
- [ ] 6. Visual polish, final check against the acceptance criteria

## File structure

```
client/
  index.html                 inline SVG favicon, mounts /src/main.tsx
  src/
    main.tsx
    index.css                Tailwind 4 + all game CSS (world, player poses, enemies, overlays, reduced motion)
    pages/Home.tsx           page composition only
    game/                    pure TS, no React/DOM imports
      types.ts               SPEC §7 types + runtime state (PlayerState, EnemyState, ProjectileState, GameState, GameEvent…)
      constants.ts           every tunable number
      physics.ts             pure movement/collision (stepPlayer, stepEnemyPatrol, classifyEnemyContact, spikes, goal)
      engine.ts              stepGame(state, input, provider) -> { state, events }; status timers, respawn, level advance, victory
      loop.ts                advanceAccumulator(): fixed 60 Hz accumulator with frame-delta cap
      input.ts               input controller (held directions + latched jump press)
      levelBuilders.ts       ground/platform/spikes/goal/enemy helpers + bossArena() (authored + generated)
      levels.ts              names and hand-authored levels 1–40; getLevel() (1–200), LEVEL_COUNT, levelProvider
      levelGenerator.ts      mulberry32 + Rng, 8 templates + boss arena, themed names, validate-and-retry generation
      sections.ts            section ranges/labels, boss levels, boss HP table, section projectile type
      validation.ts          validator: reach table, standable segments, BFS route search, all §5/§11 rules
    hooks/
      useGameEngine.ts       RAF loop, refs, visibilitychange pause, imperative DOM updates, syncs {levelId, status} to React
      useKeyboardInput.ts    arrow/space handling with preventDefault
    components/
      GameViewport.tsx       ResizeObserver + uniform CSS scale of the 400×500 world
      GameWorld.tsx          sky, sun, clouds + level geometry + entities
      Platform.tsx Spike.tsx Goal.tsx Player.tsx Enemy.tsx
      Hud.tsx                header (title, level, control hint)
      Overlays.tsx           basic SPLAT! / LEVEL COMPLETE! / victory overlays
scripts/validate-levels.ts   validates all 200 levels + template no-repeat rule, prints generator stats (part of `npm run check`)
tests/*.test.ts              node:test simulation tests (`npm test`)
vite.config.ts               root=client, base from BASE_PATH env, out=dist/
```

## Decisions and clarifications

- **Repo was empty** at session 1 (one-line README, no `Home.tsx`), so the project
  was scaffolded from scratch under `client/`. No shadcn/Radix or wouter installed;
  not needed so far.
- Tooling versions installed: React 19, Vite 8, TypeScript 7, Tailwind 4, tsx.
- **Coordinates**: all rects are top-left + size. Player `x,y` is the hitbox top-left
  (spawn 50,100). Enemy `startX`/`endX` bound the enemy's *body* (left ≥ startX,
  right ≤ endX); the validator requires that range to lie on the platform the enemy
  stands on (`enemy.y + height === platform.y`).
- **Ground vs platform**: any surface with `y >= GROUND_Y (400)` is solid ground
  (also blocks sideways, e.g. in a pit); anything higher is a one-way platform.
  Ground gaps are made with several `ground(x, w)` segments.
- **Integration**: semi-implicit Euler (`vy += g; y += vy`), max fall speed 15.
  Measured jump rise is 114 px (spec says ≈120).
- **Jump feel**: 5-tick coyote time and 6-tick jump buffer. Jump is edge-triggered
  (holding jump does not auto-repeat). No variable jump height. The reachability
  table's 70% margin easily covers the tiny extra reach from coyote time.
- **Stomp**: player falling and feet at or above enemy top + 4 px on the previous
  tick. Only one enemy can be stomped per tick. During boss invulnerability the
  boss neither takes damage nor kills on contact.
- **Spike hitbox** is inset 4 px (forgiving).
- **Spawn safety zone**: x ∈ [0, 150), from the top of the world down to the first
  surface under the spawn column. No spikes or enemy patrol range may intersect it.
  The goal must not intersect the spawn fall path.
- **Death**: also on falling below the world (y > 500). Death freezes the player for
  60 ticks (~1 s); completion freezes for 72 ticks (~1.2 s). Timers run inside the
  simulation, so they are frame-rate independent and pause with the tab.
- **Rendering**: static geometry is React-rendered per level; player/enemy
  positions, pose, facing, alive/invulnerable flags and the door lock are written
  imperatively to the DOM each frame (transform + data-attributes, CSS does the
  rest). React state holds only `{ levelId, status }`. No render interpolation
  between ticks (motion updates at 60 Hz on high-refresh displays).
- `GameEvent`s (jump, land, stomp, death, respawn, complete, levelStart, doorUnlock,
  victory) are returned from `stepGame` and forwarded through `useGameEngine`'s
  `onEvents` option — the hook point for audio (phase 5) and persistence (phase 4).
- Dev-only `?level=N` query param picks the starting level.

- **Phase 2 — reachability**: each surface is split into *standable segments*
  (spike-free stretches ≥ 36 px, `MIN_STANDABLE_WIDTH`). A stretch is removed if
  any spike hitbox reaches into the 80 px band the standing player occupies, so
  spikes on the floor below a too-low platform count too. Segments are linked when
  the edge-to-edge gap fits the §5 table for the rise (×0.85/0.70 from level 150;
  rises > 90 px are never allowed, also late-game). BFS runs from the spawn landing
  segment to the goal's segment. `tests/reach.test.ts` proves every maximum
  (rise, gap) in both tables is jumpable with the real `stepGame` physics.
- **Extra validator rules** beyond §5 (all fairness/sanity): raised platforms must not
  overlap each other, the ground or spikes; spikes must stand on a surface; the goal
  must not overlap a platform; enemy speed ≤ 4.5; shooter cooldowns ≥ 60/50/45;
  an enemy may not patrol less than a player-height (80 px) above a lower standable
  surface (it would hit a player standing there); level ids sequential, names unique.
- **Boss rule**: the engine locks the door whenever an `isBoss` enemy is alive, so
  "goal not reachable while the boss lives" is enforced by requiring exactly one
  boss on every boss level (20, 30, …, 200), none elsewhere, HP per the table, and
  the arena rules (continuous spike-free ground ≥ 320 px, raised platforms on both
  sides). Boss HP: 20→3, 30/40→5, 50/60→5, 70/80→6, 90→7, 100→8, 110–130→6,
  140/150→7, 160/170→8, 180/190→9, 200→10.
- **Generator**: `templateFor(id)` walks per-8-level blocks of a seeded shuffle of the
  8 templates (staircase, zigzag, climb, gauntlet, islands, split, pits, descent),
  fixing the block seam, so consecutive levels never repeat; multiples of 10 use the
  boss arena. For each attempt `Rng(id*7919 + attempt*104729)` builds a candidate;
  the first one that passes `validateLevel` (plus a "platforms sharing x-range are
  ≥ 45 px apart vertically" spacing check) is used — at most 7 attempts today, capped
  at 200 (throws, failing `npm run check`, if ever exceeded). Difficulty scales gap
  fraction, platform width and enemy count with the level; shooters use the section's
  projectile; wide surfaces may get fast runners (3.5–4.5).
- **Names**: lightning/toxic names are a seeded shuffle of 12×12 word pairs (unique by
  construction). Bosses: "Thunder God I–VI", "Poison King I–IX", level 200 "The Final
  Poison King". Level 40 is "Speed Demon Boss" (spec gave no name).
- **Hand-authored notes**: fire cooldown = max(60, 150 − 10·(id−21)); level 28 uses 140
  ("slower fire timing"). Fire bosses/arenas: 30 Inferno King (fire, cd 100), 40 speed
  boss (speed 3.5, no projectile). Level 1 was re-laid out with three steps so the
  door can no longer be touched mid-jump from the ground.
- The template enum and `EnemyDef` data for shooters are in place; **their behaviour
  (charging, firing, projectiles, boss speed-up) is phase 3**.

## Known issues / not yet done

- Shooters, fast enemies and bosses all *patrol* correctly, but nothing shoots yet,
  bosses don't speed up after hits, and all enemies render as the red base design
  (phase 3 adds per-type visuals, HP pips, projectiles).
- Level names such as "Toxic Pits" are chosen independently of the template, so a
  name may not describe the layout.
- No start overlay, level select, touch controls, persistence, mute, or audio yet
  (phases 4–5). In dev, `?level=N` jumps to any level.
- Header does not yet collapse specially on short screens.

## Test status (end of phase 2)

- `npm run check`: pass — tsc + "Level validation passed: 200 level(s) checked (40
  hand-authored)"; generator max 7 attempts.
- `npm test`: 41/41 pass (physics, engine, loop, levels/validator/generator, reach).
- `npm run build`: pass.
- Chromium: contact sheets of levels 1, 11, 13, 17, 19–21, 23, 25, 26, 28–30, 32, 34,
  36, 37, 39–41, 43–47, 100, 101, 150–152, 200 render with no console errors.

## Next

**Phase 3 — Enemies, projectiles, bosses** (use Sonnet):
1. Shooter behaviour in `engine.ts`: cooldown → ~24-tick visible charge → fire in
   facing direction; skip the shot if the player is within 60 px horizontally of the
   muzzle. Projectile motion: fire horizontal 3, lightning horizontal 6, toxic arc
   (vx 3, vy −6, gravity 0.3, removed on hitting a platform); remove when leaving the
   world; projectile contact kills (`deathCause: "projectile"`). Constants go in
   `constants.ts`. `ProjectileState` + `nextProjectileId` already exist in GameState.
2. Bosses: speed up and shorten cooldown after each hit (respect the min cooldowns and
   MAX_ENEMY_SPEED 4.5), HP pips, flashing during invulnerability (CSS hook
   `data-invulnerable` already set), gold crown/markings, bigger/darker.
3. Enemy visuals per type (normal dark red, fire orange, lightning cyan, toxic lime,
   fast variant), charge glow (`data-charging`), Projectile component with distinct
   shapes (round fireball + trail, zig-zag bolt, arcing blob). Projectiles have a
   dynamic count: render via a fixed pool of DOM nodes updated imperatively in
   `useGameEngine.renderFrame`.
4. Emit `shoot` and `bossHit` events for phase 5 audio. Tests: projectile speeds,
   toxic arc rises then falls, 60 px no-shoot rule, boss speed/fire-rate increase.
