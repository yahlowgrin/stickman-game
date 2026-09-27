# Progress

Source of truth: `docs/SPEC.md`. Read both files at the start of every session.

## Phases

- [x] 1. Refactor structure, types, fixed-timestep physics loop
- [ ] 2. Level generator + reachability validator  ← **next**
- [ ] 3. Enemies, projectiles, bosses
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
      levelBuilders.ts       ground/platform/spikes/goal/enemy helpers (for authored + generated levels)
      levels.ts              level names (core + fire) and hand-authored levels 1–10; levelProvider
      validation.ts          structural level validator (pure)
    hooks/
      useGameEngine.ts       RAF loop, refs, visibilitychange pause, imperative DOM updates, syncs {levelId, status} to React
      useKeyboardInput.ts    arrow/space handling with preventDefault
    components/
      GameViewport.tsx       ResizeObserver + uniform CSS scale of the 400×500 world
      GameWorld.tsx          sky, sun, clouds + level geometry + entities
      Platform.tsx Spike.tsx Goal.tsx Player.tsx Enemy.tsx
      Hud.tsx                header (title, level, control hint)
      Overlays.tsx           basic SPLAT! / LEVEL COMPLETE! / victory overlays
scripts/validate-levels.ts   runs the validator (part of `npm run check`)
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

## Known issues / not yet done

- Only levels 1–10 exist; `LEVEL_COUNT` is 10, so finishing level 10 shows the
  victory screen. Phase 2 adds levels 11–40 (hand-authored) and 41–200 (generated).
- Validator checks structure only (bounds, spawn safety, goal support, enemy
  patrol on platform, unique names/ids). **Reachability search and the boss-lock
  rule are not implemented yet** (phase 2). Levels 1–10 were checked by hand against
  the §5 gap table.
- Projectiles, shooters, boss behaviour (speed-up, HP pips) are not implemented;
  the `ProjectileState` type and boss HP/invulnerability/door lock exist.
- No start overlay, level select, touch controls, persistence, mute, or audio yet.
- Header does not yet collapse specially on short screens (it is already a single
  line at 320–375 px wide).

## Test status (end of phase 1)

- `npm run check`: pass (tsc + validator, 10 levels)
- `npm test`: 22/22 pass
- `npm run build`: pass, also with `BASE_PATH=/stickman-game`
- Chromium smoke test at 375×667, 320×568 and 1280×800: no page scroll, keyboard
  movement/jump work, death → SPLAT! → respawn works, no console errors.

## Next

**Phase 2 — Level generator + reachability validator** (use Opus):
1. Add reachability search to `validation.ts`: build standable segments (platforms
   minus spike-covered x-intervals), connect them using the §5 gap table (85% reach
   for levels 150+), BFS from the spawn landing segment to the goal's segment.
2. Add the boss-lock check (goal on boss levels must be locked while boss alive —
   the engine already locks it whenever `isBoss` enemies are alive; the validator
   should assert boss levels contain a boss and the arena rules of §11).
3. Hand-author levels 11–40 (fire shooters and fast enemies as data; behaviour in
   phase 3), incl. boss arenas at 20, 30, 40.
4. `levelGenerator.ts`: mulberry32 seeded by level id, templates (staircase,
   zig-zag, vertical climb, gauntlet, islands over spikes, split route…), no
   consecutive repeats, themed names for 41–200, boss arenas every 10 levels.
5. Set `LEVEL_COUNT = 200`; tests for determinism and validator coverage.
