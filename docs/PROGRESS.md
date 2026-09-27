# Progress

Source of truth: `docs/SPEC.md`. Read both files at the start of every session.

## Phases

- [x] 1. Refactor structure, types, fixed-timestep physics loop
- [x] 2. Level generator + reachability validator
- [x] 3. Enemies, projectiles, bosses
- [x] 4. UI, overlays, touch controls, persistence
- [ ] 5. Audio  ← **next**
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
      persistence.ts         localStorage load/save (unlockedLevel, muted), injectable storage for tests,
                             clamps/repairs corrupt or out-of-range saved data instead of trusting it
    hooks/
      useGameEngine.ts       RAF loop, refs, visibilitychange pause, imperative DOM updates (incl. the
                             fixed projectile pool + boss HP pips/charging), syncs {levelId, status} to React;
                             now also exposes goToLevel(id) for the level-select/dev-jump path
      useKeyboardInput.ts    arrow/space handling with preventDefault
      useTouchControls.ts    pointer-event hold/tap handlers wired onto the shared InputController
      useProgress.ts         loads Progress once, persists every change (mute toggle, level unlock)
    components/
      GameViewport.tsx       ResizeObserver + uniform CSS scale of the 400×500 world
      GameWorld.tsx          sky, sun, clouds + level geometry + entities + projectile pool
      Platform.tsx Spike.tsx Goal.tsx Player.tsx Enemy.tsx Projectile.tsx
      Hud.tsx                header: title, level, control hint, level-select button, mute toggle
      Overlays.tsx           start / SPLAT! / LEVEL COMPLETE! / victory overlays (SPEC §14)
      TouchControls.tsx      on-screen Left/Right/Jump buttons, (pointer: coarse)-only via CSS
      LevelSelect.tsx        full-screen level grid grouped by section; locked levels disabled
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

- **Phase 3 — shooter state machine** (`engine.ts`, `stepEnemyShooting`): per shooter,
  `cooldown` (ticks) counts down to 0 → if the player's center is ≥ `NO_SHOT_DISTANCE`
  (60px) from the muzzle, start a `chargeTicks = SHOT_CHARGE_TICKS` (24, ~0.4s) visible
  charge, else retry next tick → charge counts down to 0 → spawn a projectile at the
  facing edge and reset `cooldown = fireInterval`. `EnemyState.fireInterval` is the
  *current* full cooldown length (starts at `def.shootCooldown`); it only differs from
  the def value for bosses, which shrink it on each non-defeating hit.
- **Projectile physics** (`physics.ts`, pure): `stepProjectile` moves fire/lightning
  straight (`vx = PROJECTILE_SPEED[type]*dir, vy=0`) and toxic on an arc (`vy=
  TOXIC_LAUNCH_VY` then `+= TOXIC_GRAVITY` each tick). `isProjectileInWorld` removes
  anything that leaves the 400×500 world. `projectileHitsPlatform` — **toxic only**
  (fire/lightning fly through platforms, per SPEC §11's parenthetical) — removes it on
  overlapping any platform/ground rect. `touchesProjectile` kills the player
  (`deathCause: "projectile"`), checked in `stepPlaying` right after the spike check.
- **Boss escalation** (`ramp()` in engine.ts): on a stomp that hits a boss without
  defeating it, `speed *= BOSS_SPEED_RAMP` (1.15, capped at `MAX_ENEMY_SPEED`) and, if
  it shoots, `fireInterval *= BOSS_COOLDOWN_RAMP` (0.85, floored at
  `MIN_SHOOT_COOLDOWN[type]`). Emits both `stomp` (existing) and a new `bossHit`
  event; `shoot` events fire when a projectile actually spawns. Both are for phase 5
  audio.
- **Visuals**: enemy color/kind comes from CSS custom properties set via `data-kind`
  (`--enemy-fill/--enemy-stroke/--enemy-glow`), darkened again by `data-boss="true"`;
  the SVG shape itself is unchanged across kinds (shape+behavior distinguish types
  per SPEC §16, color is an added cue, not the only one). Bosses get a gold
  `enemy-crown` polygon (needs a taller viewBox, `0 -9 32 37` vs `0 0 32 28`) and a
  `.boss-pips` row of `.hp-pip` spans (one per `maxHp`, toggled `.filled` each frame
  from `e.hp`). `data-charging="true"` pulses `.enemy-charge-glow` (tinted via the
  same `--enemy-glow` variable, so it matches the projectile the enemy is about to
  fire). `data-fast="true"` (speed ≥ `FAST_ENEMY_SPEED_THRESHOLD`, 3.5) adds a small
  motion-streak `::after` opposite the facing direction.
- **Projectiles render via a fixed DOM pool** (`MAX_RENDERED_PROJECTILES` = 32
  `<Projectile>` slots, always mounted). Each slot's markup has all three shapes
  (round fireball + trail, zig-zag bolt, arcing blob) inline; `data-type` shows only
  the active one via CSS, so switching a slot's type never touches the DOM tree.
  `useGameEngine.renderFrame` walks `state.projectiles` and writes position/size/
  type/dir/`data-active` onto the first N pool slots; unused slots get
  `data-active="false"` (`display:none`). If a level ever exceeds the pool (none do —
  checked by eye up to ~4 concurrent shots), a dev-only console.warn fires rather than
  silently dropping projectiles unnoticed.
- Fire/lightning enemies' own body color already encodes their projectile type
  (`data-kind`), so a shooter is identifiable before it ever fires.


- **Phase 4 — app-level flow** (`pages/Home.tsx`): a `started` boolean (not part of
  `GameStatus`) gates the Start overlay; `useGameEngine`'s `paused` prop is
  `!started || levelSelectOpen`, so the simulation genuinely doesn't run behind
  either overlay (no silent falling/enemy movement while the menu is up). The dev
  `?level=N` override still works but now only overrides the *initial* level;
  saved progress (`progress.unlockedLevel`) is the normal starting point.
- **`useGameEngine.goToLevel(id)`**: new — resets to any level (player/enemies/
  projectiles/timers), same machinery `playAgain()` already used (`playAgain` is now
  just `goToLevel(1)` in spirit, kept separate since it's a distinct spec-named
  action). Used by both the level-select grid and the dev override.
- **Persistence** (`game/persistence.ts` + `hooks/useProgress.ts`): `Progress =
  { unlockedLevel, muted }` saved as one JSON blob under
  `stickman-physics:progress:v1`. `loadProgress`/`saveProgress` take an injectable
  `StorageLike` (defaults to `localStorage`, checked safely — some browsers throw
  just *accessing* `localStorage` in locked-down private modes) so the module is
  unit-testable without jsdom (not an allowed new dependency). Loading clamps/repairs
  garbage input (non-numeric, out-of-range, corrupt JSON) back to safe defaults rather
  than trusting it. `unlockedAfterCompleting(current, completedId)` is the pure rule
  (`max(current, completedId+1)`, capped at `TOTAL_LEVELS`) — `useProgress` calls it
  from `Home.tsx`'s `onEvents` handler on every `"complete"` event, so replaying an
  earlier level never lowers progress and finishing 200 saturates at 200. `playAgain`
  deliberately does not touch progress (SPEC §14: victory keeps unlocked levels).
- **Level select** (`LevelSelect.tsx`): one grid per section (`sections.ts`'
  `SECTION_RANGES`/`SECTION_LABELS`), `disabled` tiles for `id > unlockedLevel` (shows
  a `Lock` icon instead of the number), the current level highlighted
  (`data-current`), boss levels get a gold ring (`data-boss`). Closes on backdrop
  click, the × button, or Escape. Opening it sets `levelSelectOpen`, which pauses the
  engine the same way the start overlay does.
- **Touch controls** (`TouchControls.tsx` + `useTouchControls.ts`): always mounted;
  shown only via the CSS `@media (pointer: coarse)` query (SPEC §6's own words) so
  there's no JS device-detection to get out of sync with reality. Left/Right use
  pointerdown/up/leave/cancel to hold (mirrors keydown/keyup); Jump is a single
  pointerdown (mirrors the keyboard's non-repeat press). Multi-touch (hold a
  direction *and* jump) needs no special handling — each button is a separate DOM
  element, so the browser hands each simultaneously-pressed button its own pointer
  event independent of the others. All three buttons are 56×56 (Jump 64×64),
  `touch-action: none`, no callouts/selection (verified in Chromium: 56×56, 56×56,
  64×64).
- **Header collapse** (SPEC §3): pure CSS, no JS breakpoint logic — `.control-hint`
  is hidden below `768px` width (existing, phase 1) *and now also* below `560px`
  height or `360px` width; header padding shrinks further below `420px` height (a
  phone with its browser toolbar visible). Verified at 375×480: hint hidden, no
  scroll.
- **Mute button** shows both the icon (`Volume2`/`VolumeX`) and a visible text label
  ("Mute"/"Unmute", hidden below 480px width to save header space) plus
  `aria-pressed`, per SPEC §16's "both icon and label" wording — not just an
  `aria-label`.
- A single well-timed jump can occasionally arc straight from one platform into the
  goal's hitbox without visiting every intermediate platform (proven in
  `tests/reach.test.ts`'s spirit, not a bug: the validator only guarantees *a* route
  exists via modest jumps, not that skilled play can't shortcut it — this is normal
  platformer skill expression, and every level's guaranteed safe route still requires
  every step for a less-precisely-timed jump).

## Known issues / not yet done

- Level names such as "Toxic Pits" are chosen independently of the template, so a
  name may not describe the layout.
- No audio yet (phase 5) — the Start overlay's "Tap or click to start" click is
  already the correct user gesture to create the AudioContext on; phase 5 just needs
  to hook into `onStart` (or `started` going true) in `Home.tsx`.
- `shoot` and `bossHit` events are still unconsumed (audio's job, phase 5).
- Touch input and level-select/overlay UI are verified with Chromium/Playwright
  screenshots and scripted interaction, not `npm test` — jsdom/testing-library would
  be a new dependency, which the spec disallows. `persistence.ts`'s logic (the part
  that isn't DOM) is fully unit tested.

## Test status (end of phase 4)

- `npm run check`: pass — tsc + "Level validation passed: 200 level(s) checked (40
  hand-authored)"; generator max 7 attempts.
- `npm test`: 57/57 pass (adds `tests/persistence.test.ts`: defaults, round-trip,
  corrupt-JSON recovery, out-of-range clamping, a storage that throws on every call,
  and the unlock-never-regresses/never-exceeds-200 rule).
- `npm run build`: pass (plain and with `BASE_PATH=/stickman-game/`).
- Chromium/Playwright, scripted end-to-end: start overlay shows and dismisses on
  click; holding →/jump completes level 1 (with a correctly-timed jump — the level's
  intended route is the multi-hop one; see the note above) and unlocks level 2;
  reloading resumes at level 2 and level-select correctly shows 1–2 unlocked, 3+
  locked; mute toggles, shows the right icon/label/aria-pressed, and survives a
  reload; touch controls render only under `(pointer: coarse)`, are hidden on a
  plain desktop viewport, are all ≥56px, and holding Right + tapping Jump together
  (simulated via a held pointer + the existing keyboard jump) moves the player; no
  horizontal or vertical scroll at 320×568, 375×480, or 375×667; zero console errors
  across every scenario above.

## Next

**Phase 5 — Audio** (use Sonnet):
1. `game/audio.ts`: a small Web Audio sound engine, no audio files. Create/resume the
   `AudioContext` from `Home.tsx`'s `onStart` handler (the Start overlay's click is
   already exactly the required user gesture — SPEC §14/§15). Suspend on
   `visibilitychange` hidden, resume when visible (mirrors the existing
   `useGameEngine` RAF pause, but audio needs its own listener since the RAF loop
   already stops advancing the sim — don't double-suspend).
2. Music: upbeat chiptune loop (square lead + triangle bass), a lookahead scheduler
   using `AudioContext.currentTime` (not `setInterval` alone), a distinct loop/key per
   `Section` (`sections.ts` already has the 5 sections) — swap loops on
   `levelStart`/on mount when `level.section` changes.
3. Effects, each tied to an existing `GameEvent` (all already emitted by `stepGame`,
   just unconsumed): `jump`, `land` (already rate-limited to real landings via
   `LAND_EVENT_MIN_VY`, don't re-throttle), `stomp` (defeated vs. not could differ),
   `bossHit`, `shoot` (vary by `projectileType`?), `death`, `doorUnlock`,
   `complete`. Wire via `useGameEngine`'s existing `onEvents` option in `Home.tsx`
   (already used there for progress unlocking — one handler, or split into two).
4. Mute: `progress.muted` (already persisted, `useProgress`) should silence
   everything immediately, including music already scheduled — don't just stop
   scheduling new notes. Cross-check: toggling mute mid-note must not click/pop.
5. Cleanup: clear all scheduled timers/oscillators on unmount (React StrictMode
   double-invokes effects in dev — verify no doubled schedulers/leaked nodes).
6. Tests: to the extent Web Audio logic is pure (the lookahead scheduler's timing
   math, note-sequence data, mute gating), unit test it in `tests/`. Actual
   AudioContext/oscillator behavior isn't unit-testable without a browser; verify
   manually (Playwright can at least assert no console errors/exceptions and that
   `AudioContext` was constructed after, not before, the start click).
