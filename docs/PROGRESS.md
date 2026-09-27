# Progress

Source of truth: `docs/SPEC.md`. Read both files at the start of every session.

## Phases

- [x] 1. Refactor structure, types, fixed-timestep physics loop
- [x] 2. Level generator + reachability validator
- [x] 3. Enemies, projectiles, bosses
- [x] 4. UI, overlays, touch controls, persistence
- [x] 5. Audio
- [x] 6. Visual polish, final check against the acceptance criteria

All six phases are complete. The game is feature-complete against `docs/SPEC.md`.

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
      audio.ts               Web Audio sound engine: pure lookahead-scheduler math + per-section chiptune
                             note patterns (unit tested) plus the AudioContext-touching engine itself
                             (defensive try/catch throughout, never throws even with no `window`)
    hooks/
      useGameEngine.ts       RAF loop, refs, visibilitychange pause, imperative DOM updates (incl. the
                             fixed projectile pool + boss HP pips/charging), syncs {levelId, status} to React;
                             now also exposes goToLevel(id) for the level-select/dev-jump path
      useKeyboardInput.ts    arrow/space handling with preventDefault
      useTouchControls.ts    pointer-event hold/tap handlers wired onto the shared InputController
      useProgress.ts         loads Progress once, persists every change (mute toggle, level unlock)
      useAudio.ts            one AudioEngine per mount (lazy ref, no side effects until resume()),
                             disposed on unmount
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

- **Phase 5 — audio engine** (`game/audio.ts`): split cleanly into a pure half and an
  impure half so the interesting logic is unit testable without a browser.
  - Pure: `advanceSequencer(state, pattern, stepSeconds, until)` is the lookahead
    scheduler's timing math — given a sequencer position and a "how far ahead to
    look" horizon, it returns exactly which notes are due and the advanced state,
    with no AudioContext involved. The real scheduler (a `setInterval` every 30ms)
    just calls this with `until = ctx.currentTime + LOOKAHEAD_SECONDS` (150ms) and
    turns each returned note into a real oscillator at its *exact* scheduled time —
    this is what SPEC §15 means by "schedule ahead... do not rely on setInterval
    timing alone": the interval only decides *when to check*, never *when a note
    plays*. `noteFrequency(semitone, rootHz)` is the equal-tempered math.
    `SECTION_THEMES` is pure data: one root note + tempo + 16-step lead (square) +
    bass (triangle) pattern per `Section`, giving 5 audibly distinct loops (key
    *and* tempo both differ, not just one).
  - Impure (`createAudioEngine()`): `resume()` (called from `Home.tsx`'s `onStart`,
    the Start overlay click — the required user gesture) lazily creates the
    `AudioContext` + a `master -> (music, sfx)` gain graph and starts the scheduler;
    idempotent (a second call just resumes if suspended). `setMuted` ramps
    `masterGain` to/from 0 over 50ms (no click/pop) rather than stopping the
    scheduler — music keeps running silently while muted, so unmuting is instant and
    stays in sync. `setSection` fades `musicGain` out/in over 120ms each way and
    restarts the sequencers on the new theme mid-fade, so the old and new loop's
    notes never overlap; it's safe to call before `resume()` (records the section,
    applies it once a context exists). `playEvents` maps `GameEvent`s to short
    synthesized blips (see below); a boss stomp emits both `stomp` and `bossHit` in
    the same tick, so `playEvents` skips the generic stomp sound for any enemyId
    that also got a `bossHit` sound that tick. Every AudioContext-touching call is
    wrapped in try/catch with `console.warn` — verified by unit test that calling
    every method with no `window` at all (this Node test run) never throws, and by
    Playwright that a real browser session logs zero console errors/warnings
    through start, 2s of music+effects, mute, unmute, tab-hide/show, and six
    level/section changes.
  - Effect sounds (all short oscillator envelopes, no audio files): `jump` (square,
    rising sweep), `land` (quiet low sine, already rate-limited upstream by
    `LAND_EVENT_MIN_VY` — audio adds no extra throttling), `stomp` (square blip,
    extra chirp if `defeated`), `bossHit` (bigger sawtooth thud, extra chirp if
    `defeated`), `shoot` (varies by `projectileType`: fire = low square, lightning =
    very short high square "zap", toxic = low triangle "squelch" — audibly distinct,
    matching their visual shapes), `death` (descending sawtooth), `doorUnlock`
    (two-note rising chime), `complete` (three-note ascending arpeggio).
    `respawn`/`levelStart`/`victory` have no dedicated sound (not in SPEC §15's
    effect list; `complete` already covers level-finish feedback, including for
    level 200).
  - `useAudio.ts`: one `AudioEngine` per mount via a lazily-initialized ref (not
    `useState`, so no extra re-render); safe under StrictMode's double-render since
    `createAudioEngine()` itself has zero side effects (no listeners, no
    AudioContext) until `resume()` is actually called from the real click handler.
    `dispose()` runs in the unmount cleanup.
  - `Home.tsx` wiring: `onStart` calls `audio.resume()` then sets `started`; a
    `useEffect` mirrors `progress.muted` into `audio.setMuted`; another mirrors
    `engine.level.section` into `audio.setSection` (fires on every level change,
    no-ops when the section didn't actually change); `handleEvents` (already the
    `onEvents` callback wired into `useGameEngine` for progress-unlocking) also
    calls `audio.playEvents(events)` — one place, two consumers of the same tick's
    events.

## Known issues / not yet done

- Level names such as "Toxic Pits" are chosen independently of the template, so a
  name may not describe the layout.
- A single well-timed jump can occasionally arc straight from one platform into the
  goal's hitbox without visiting every intermediate platform (see the phase 4 note
  above) — cosmetic/difficulty nit, not a correctness bug.
- Touch input, level-select/overlay UI, and now audio's AudioContext-touching half
  are verified with Chromium/Playwright screenshots and scripted interaction, not
  `npm test` — jsdom/testing-library would be a new dependency, which the spec
  disallows. Everything with pure logic underneath (`persistence.ts`, `audio.ts`'s
  scheduler/theme data) is fully unit tested instead.
- Music is a generated arpeggio, not a hand-composed tune — meets the letter of
  SPEC §15 (square lead + triangle bass, distinct per section, lookahead-scheduled)
  but a human composer would obviously do better. Flagging this as a deliberate
  scope/time tradeoff, not an oversight.

## Test status (end of phase 5)

- `npm run check`: pass — tsc + "Level validation passed: 200 level(s) checked (40
  hand-authored)"; generator max 7 attempts.
- `npm test`: 68/68 pass (adds `tests/audio.test.ts`: note-frequency math, the
  lookahead scheduler — no-note-too-early, exact note times, resuming from a
  returned state matches one big call, never schedules at/after the horizon, empty
  pattern/zero step safety — section-theme sanity (distinct key+tempo, matched
  lead/bass loop lengths), and the full engine API never throwing with no `window`).
- `npm run build`: pass (plain and with `BASE_PATH=/stickman-game/`).
- Chromium/Playwright, scripted: the AudioContext is created exactly once, only
  after the Start click (never before), and starts `running` (no autoplay
  suspension warning); tab hide/show suspends/resumes it; mute sets
  `aria-pressed`/toggles the button correctly; six level navigations across four
  different sections (core/fire/lightning/toxic) each mount→start→unmount the audio
  engine with no console errors; 2+ seconds of active music/effect playback (jump,
  land, death via walking into level 2's spikes) plus mute/unmute produced zero
  console errors or warnings.

## Next

**Phase 6 — Visual polish, final check against the acceptance criteria** (use
Sonnet for polish; escalate to Opus only if a specific bug resists 2–3 Sonnet
attempts):
1. Full pass over SPEC §13 (visual design) and §16 (accessibility) as a checklist —
   most of it is already in place from earlier phases (palette, fonts, sky/ground/
   platform/spike styling, player pose set, per-kind enemy colors, projectile
   shapes, `prefers-reduced-motion` handling in several places, ≥44px controls,
   aria-labels throughout) — this phase is about finding what's missing or rough,
   not building from scratch.
2. Manual/scripted playtest of the specific levels the spec's definition of done
   calls out: 1, 20, 21, 26, 28, 30, 40, 41, 43, 100, 101, 150, 200 — confirm each
   is visually correct and (for the boss levels) winnable, at 375×667 with both
   keyboard and touch.
3. Re-verify the full §18 checklist end to end: `npm run check`, `npm test`,
   `npm run build` (including `BASE_PATH`), `npm run dev:client`, no console errors
   during normal play, 375×667 fits with no scroll, README covers run/build/deploy
   (already written in phase 1 — re-check it's still accurate after 5 phases of
   changes).
4. Write the README's "manual playtest checklist" deliverable the spec's §18 asks
   for, covering: start overlay, keyboard + touch on a narrow phone viewport, the
   specific levels above, mute/unmute, and progress surviving a reload.
5. Any known issues from phases 1–5's notes above worth fixing now (the arc-skip
   jump, generated-name/template mismatch) vs. explicitly deciding to leave them and
   saying so plainly in the final report — this is the last phase, so anything not
   fixed here should be called out as a known limitation rather than silently
   dropped.

## Phase 6 — final pass

- **Accessibility audit**: every interactive `<button>` in the codebase was
  grepped for `aria-label`; the Start overlay's button was the one gap (it had
  visible text but no explicit `aria-label`) — added
  `aria-label="Tap or click to start"`. Everything else (Hud's level-select and
  mute buttons, LevelSelect's close button and 200 level tiles, TouchControls'
  three buttons, the victory overlay's Play Again button) already had one.
- **`prefers-reduced-motion` audit**: grepped every `@keyframes`/`animation:` in
  `index.css` against the reduced-motion block — door pulse, the SPLAT!
  animation, the charge glow, and the invulnerability flash are all disabled
  (replaced with a static, still-legible state); the run-cycle limb swing is
  slowed rather than removed (keeps some visual feedback). No screen-shake
  effect exists in this game, so there was nothing to tone down there.
- **Required-level playtest**: screenshotted 1, 20, 21, 26, 28, 30, 40, 41, 43,
  100, 101, 150, 200 at 375×667 — all render correctly (right enemy colors per
  section, boss crowns/pips/locked-door state, no page scroll), zero console
  errors across all thirteen.
- **Touch-vs-keyboard parity, re-verified**: a sweep of jump timing (250–500ms
  after starting to hold Right) found completion via simulated touch works
  reliably across a 300–450ms window — the same window that works for
  keyboard — confirming touch and keyboard are mechanically equivalent through
  the shared `InputController`, not just equivalent by code inspection. (An
  earlier single-attempt touch test in this same session happened to land
  outside that window and looked like a possible touch-specific issue; it
  wasn't — it was a mistimed single sample, resolved by testing the actual
  window rather than one point in it.)
- **Full-flow re-verification**: one script covering the whole README playtest
  checklist in sequence (start → complete level 1 → mute → reload → confirm
  level 2 resumed *and* mute persisted → no scroll → no console errors) all in
  one page session, to catch any interaction between features that per-feature
  testing in earlier phases might have missed. Nothing did.
- **README** rewritten: mentions all 200 levels, sections, audio, and touch
  controls (was accurate but thin from phase 1); adds the SPEC §18-required
  manual playtest checklist and an explicit "Known limitations" section.
- Decided **not** to fix, and documented as known limitations instead (true to
  the phase 5/6 plan's instruction to explicitly call out rather than silently
  drop): the arc-skip jump (§ phase 4 notes — not a bug, a skill-expression
  side effect of fair jump physics) and generated-name/template independence
  (§ phase 2 notes — cosmetic). Neither affects correctness, fairness, or the
  validator's guarantees.

## Known issues / not yet done

- **A very precisely-timed jump can occasionally skip an intermediate platform**
  by arcing straight into the door (see phase 4's note) — not a bug, normal
  platformer skill expression; every level's guaranteed route still needs every
  step for an ordinarily-timed jump.
- **Generated level names (41–200) are chosen independently of the layout
  template**, so a level's name doesn't always describe its shape.
- **Music is a short generated arpeggio per section**, not a hand-composed
  tune — meets SPEC §15's letter, not necessarily what a human composer would
  produce.
- Touch and keyboard input, all overlays/menus, and the audio engine's
  AudioContext-touching half are verified with Chromium/Playwright scripted
  interaction rather than `npm test`, since jsdom/testing-library would be a
  new dependency the spec disallows. Everything with pure logic underneath
  (physics, engine, validator, generator, persistence, audio's scheduler/theme
  data) is unit tested.

## Test status (end of phase 6 — final)

- `npm run check`: pass — tsc + "Level validation passed: 200 level(s) checked
  (40 hand-authored)"; generator max 7 attempts.
- `npm test`: 68/68 pass.
- `npm run build`: pass, plain and with `BASE_PATH=/stickman-game/`.
- `npm run dev:client`: starts; the home route serves `<title>Stickman
  Physics</title>` and the app mounts.
- Chromium/Playwright, scripted: all 13 SPEC §18 required levels (1, 20, 21,
  26, 28, 30, 40, 41, 43, 100, 101, 150, 200) render correctly at 375×667 with
  no scroll and no console errors; the full playtest checklist (start → play →
  mute → reload → resume) passes in one continuous session; touch and
  keyboard both reliably complete level 1 and unlock level 2 across a shared
  timing window; zero console errors or warnings anywhere in any of the above.

## Handoff

The game is feature-complete against `docs/SPEC.md`. If a future session picks
this up, `docs/SPEC.md` is still the source of truth and this file's "Decisions
and clarifications" and "Known issues" sections above cover every deliberate
choice and open item across all six phases — read them before assuming
something is a bug rather than a documented tradeoff.

## Post-launch fix: level 8 was too hard

User feedback: level 8 ("The Gauntlet") felt too hard. Investigation with the
real physics (not guesswork) found a genuine bug, not just subjective
difficulty: `enemy(1, 320, 170, 280, 1.2)` patrolled 110 of platform1's 120px,
and `enemy(2, 190, 155, 260, 1.4)` patrolled 105 of platform3's 120px. Combined
with the player's own 40px width, the *only* landing spots that didn't already
overlap the enemy's reachable area were 0-10px wide — simulating the natural
"jump from the ground onto platform1" arc with the real engine reproduced an
unavoidable death exactly on the landing tick, before the player could react
at all. That's not a difficulty curve, it's a coin flip.

Fix: `enemies: [enemy(1, 320, 240, 280, 1), enemy(2, 190, 220, 260, 1)]` —
patrol width shrunk to 40px (still ≥ the enemy's own 32px body) and confined
to the far side of each platform, and speed eased from 1.2/1.4 to 1. This
leaves a genuinely safe ~40-80px zone on the side the player actually lands
on, accounting for the player's own width (not just its x position, which was
the arithmetic error in reasoning about the original "safe zone" size).
Verified with the real engine: landing is safe, and standing still on the safe
side is safe indefinitely (300+ ticks / 5s simulated) — the level still
requires timing a crossing or a stomp past the enemy, which is the intended
"gauntlet" challenge, just no longer an unavoidable first-contact death.
Re-ran `npm run check`, `npm test` (68/68), and `npm run build` — all pass.

## Post-launch fix: levels 13 and 28 were also too hard (same root cause as 8)

Same bug class as the level 8 fix, found across most hand-authored levels via
an audit (see below): `enemy(id, top, startX, endX, speed)` calls where
`endX - startX` equals the platform's full width, leaving 0px safe margin
once the player's own 40px width is accounted for.

- **Level 13** ("Staircase of Doom"): all three enemies patrolled their
  entire 80px platform. 80px can't fit a comfortable margin even at the
  enemy's minimum width (32px leaves only 48px gap, 8px of real player
  slack) — widened the three platforms 80→110px and confined each enemy to
  a 50px patrol on the far side from its landing direction, giving ~20px of
  genuine standing slack (verified: safe for 5s standing still; not safe
  before — every position would eventually be swept).
- **Level 28** ("Timing Is Everything", fire section): both fire-shooter
  enemies patrolled their entire 60px platform (even tighter than level
  13's 80px). Widened those two platforms 60→90px and confined each enemy
  to its minimum 32px patrol width, giving ~18px of real slack — the best
  achievable on a 90px platform with a 32px enemy and 40px player.

**Audit finding**: the same `patrol width == platform width` pattern exists
on ~30 more enemy placements across levels 6, 9, 10, 11, 14, 15, 17, 18, 19,
22-27, 29, and 32-39 (checked with a script comparing each enemy's patrol
width against its platform's width minus `PLAYER_WIDTH`). Not fixed yet —
flagged to the user rather than unilaterally rewriting ~30 levels' hand-tuned
geometry without confirmation; only 8, 13, and 28 were reported so far.

**Verification note**: naive "hold right, spam jump" scripted bots are not a
reliable pass/fail signal for these fixes — they can't react to an enemy's
actual position the way a human watching the screen can, and get unlucky or
lucky depending on exact timing offsets that don't matter for a real player.
The signal that matters is "does a genuinely safe standing zone exist" (does
NOT depend on timing) — verified directly for each fix by placing the player
in the intended safe zone and confirming no death occurs standing still for
5 simulated seconds, which was *impossible* before any of these fixes (every
position would eventually be swept). Level 28's remaining occasional deaths
under a naive bot are from dodging the fire shooters' projectiles — a
separate, intentional mechanic (charge-glow telegraph, timed dodge), not the
body-collision bug being fixed here.

## Post-launch feature: ice section (levels 101-150) replaces toxic there

User request: instead of another poison-themed stretch, levels 101-150 became
an **ice** section — enemies throw ice balls that briefly **freeze** the
player (immobilize, don't kill) instead of another lethal projectile. Toxic
now covers only 151-200 (still ending in the same final boss).

- **New mechanic, not just a reskin**: `PlayerState.frozenTicks` (set to
  `FREEZE_DURATION_TICKS` = 90 ticks / 1.5s on an ice-ball hit). While > 0,
  `stepPlayer` (physics.ts) zeroes horizontal input and blocks the jump
  buffer entirely, but gravity and falling are untouched — you're a statue,
  not paused. Being hit by anything else (spike, enemy, fire/lightning/toxic
  projectile) while frozen still kills you normally; the ice ball itself is
  the only non-lethal hazard in the game.
- **Engine**: `stepPlaying` now separates projectile hits into lethal
  (any non-ice type → `die()`, unchanged) and ice (→ set `frozenTicks`,
  consume that one projectile, emit a new `freeze` event, tick continues
  normally — doesn't end the tick like death does).
- **Physics**: ice balls arc under gravity exactly like toxic blobs
  (`ICE_LAUNCH_VY`/`ICE_GRAVITY`, same values as toxic's, separate named
  constants for independent tuning) and are removed on hitting a platform,
  same as toxic. `ARC_GRAVITY` in physics.ts now generalizes what used to be
  a `type === "toxic"` special case to any arcing type.
- **Types/sections**: `ProjectileType`/`Section` both gained `"ice"`.
  `sectionFor`: lightning ≤100, ice ≤150, toxic ≤200 (was ≤100/≤200).
  `SECTION_RANGES.ice = [101, 150]`, `toxic` shrunk to `[151, 200]`.
  Boss HP is now two independent small lookup tables instead of one formula
  (`ICE_BOSS_HP` for 110-150, `TOXIC_BOSS_HP` for 160-200, both hand-picked
  to ramp 6→9 and 6→10 respectively — the toxic table's values at each id
  are unchanged from before, just re-scoped to the shorter range).
- **Generator**: `generatedLevelName` and `namePool` generalized from a
  lightning/toxic union to `GeneratedSection = "lightning" | "ice" | "toxic"`
  with per-section word lists/seeds/boss-name lookup tables instead of
  ternaries. Ice boss name: "Frost King I-V" (110/120/130/140/150); level 200
  is still "The Final Poison King" (unchanged — toxic still ends the game).
  Ice word list: Frost/Glacial/Frozen/Arctic/... + Slope/Path/Drift/Cavern/...
  (e.g. "Arctic Slope", level 101). Boss-arena speed/cooldown tuning
  generalized from a `toxic` boolean to a per-section lookup
  (lightning/ice/toxic), ice sitting between the two as intended.
- **Audio**: a fifth `SECTION_THEMES` entry (D5 root, 135bpm, brighter/major
  pattern than lightning's or toxic's — `Record<Section, SectionTheme>`
  forced this via a compile error the moment `Section` grew a member, which
  is exactly the point of modeling it that way). New effects: `playShoot`
  gets an "ice" case (bright glassy triangle chime, distinct from fire's low
  square, lightning's zap, and toxic's squelch) and a dedicated `playFreeze`
  (descending icy chime + shimmer) for the new `freeze` event.
- **Visuals**: `data-kind="ice"` enemy palette (light frost blue,
  `#7dd3fc`/`#0c4a6e`), matching darker boss variant. New `Projectile.tsx`
  shape: an angular crystal shard (not round like fire/toxic, not a zigzag
  like lightning — satisfies SPEC §16's "shape and motion, not color alone").
  Frozen player: an ice-block SVG overlay (`.ice-block`, toggled by
  `data-frozen` set imperatively in `useGameEngine.renderFrame` from
  `player.frozenTicks > 0`) with a subtle shimmer, `prefers-reduced-motion`
  covered (static opacity instead of the shimmer keyframe), and limb-swing
  animation forced off while frozen so the figure genuinely looks stuck.
- **Tests**: new `tests/freeze.test.ts` (9 tests) — freezing doesn't kill or
  end the tick, movement/jump ignored while frozen, gravity still applies,
  the freeze wears off on its own, a lethal hazard still kills a frozen
  player, ice arcs like toxic, ice is removed on platform hit, section
  boundaries (101-150 ice / 151-200 toxic), and both new boss-HP tables.
  Updated two existing tests that hardcoded the old lightning/toxic-only
  section list.

## Post-launch fixes: levels 33 and 38 (same bug as 8/13/28) + a hidden spike bug

Same root cause as the earlier level 8/13/28 fixes, found via the same
"does a genuinely safe standing zone exist" method — both are "Speed Demons"
levels, and both had enemies patrolling their **entire** platform at
close-to-maximum speed (3.5-4.2, vs. the 4.5 ceiling), which is an even more
punishing combination than levels 8/13/28's slower enemies.

- **Level 33**: widened its 90px enemy platform to 120px; confined both
  enemies (one on open ground, one on a raised platform) to the far side
  from their landing direction, eased speed slightly (3.8/3.5 → 3.5/3.2).
  Playtested: 3/3 scripted attempts now complete (was failing before).
- **Level 38**: widened its 100px enemy platform to 130px (extended toward
  its neighbor, gap only shrinks); confined the enemy there and eased speed
  (4.2 → 3.8). The *second* enemy's platform was already 120px, wide enough
  once re-confined (4.0 → 3.6, patrol shrunk to the platform's minimum).
- **Real bug found while verifying level 38, not present in 33**: the
  player's *natural, un-jumped fall from spawn* lands right around x=160-205
  on the level's first platform — and a pre-existing spike on that same
  platform sat at x=200-230, clipping that exact landing zone by a few
  pixels with zero warning or reaction time. Moved the spike to x=225-255,
  clear of the natural landing path. This wasn't something my patrol-margin
  fix touched or caused — it was there in the original level, just never
  surfaced in earlier testing because the (also broken) enemies killed test
  runs before ever reaching that point.
- **A dead end worth recording**: my first attempt at level 38's second
  enemy confined it to x=150-190 (mirroring the "confine to the far side"
  pattern used everywhere else). That accidentally placed it squarely in the
  path of the player's spawn-fall arc (which passes near x=110-155 at that
  enemy's height on its way down), and because the range was so narrow
  (40px) the enemy's fast back-and-forth patrol was *almost always*
  somewhere in that exact band — worse than the original wide, slow-moving
  range in one specific way, despite being strictly safer everywhere else.
  Re-confined it to x=230-270 instead (clear of both the spawn-fall path and
  the platform-2 landing zone). Lesson for any future "confine to the far
  side" fix: also check the fix doesn't newly overlap the spawn-fall
  corridor, not just the immediate landing zone it was aimed at.
- Verified all four safe zones directly (stand still 5 simulated seconds,
  no death) rather than relying on scripted-bot completions, which continue
  to be an unreliable signal for anything requiring a leftward jump or
  precise spike-timing — documented in the level 13/28 section above, and
  re-confirmed here (a right-only bot can never complete a level requiring a
  leftward jump partway through, which is a test-harness limitation, not a
  level bug).
- **Not further eased**: level 38 remains genuinely difficult after both
  fixes — it's a top-tier "Speed Demons" level by design, with fast enemies,
  a spike, and required direction changes. The two bugs found (zero-margin
  patrol, spike-clipped landing) are fixed and verified; remaining
  difficulty is intended for this level's place in the section, not
  something addressed here without more specific feedback on what part
  still feels unfair.
- Same ~30-enemy-placement systemic audit from before still applies to the
  levels not yet touched (6, 9, 10, 11, 14, 15, 17-19, 22-27, 29, 32, 34-37,
  39) — none of those were reported this round, so none were changed.

## Test status (after this round of fixes/features)

- `npm run check`: pass — "Level validation passed: 200 level(s) checked
  (40 hand-authored)".
- `npm test`: 77/77 pass (68 previous + 9 new freeze tests).
- `npm run build`: pass (plain and with `BASE_PATH=/stickman-game/`).
- Chromium: levels 101, 110, 150 (ice enemy, Frost King boss with crown +
  correct pip count, themed level name) and the freeze visual (ice-block
  overlay, confirmed via `data-frozen`) all screenshotted correctly with no
  console errors; levels 8, 13, 28, 33, 38 re-verified with the direct
  "stand still 5 simulated seconds in the fixed safe zone" method (the
  reliable signal established in the level 8 fix) plus scripted browser
  playtests where a right-only bot's strategy actually matches the level's
  geometry (33 now completes reliably; 38's remaining scripted-bot failures
  are explained above as a test-harness limitation, not a level bug).

## Post-launch fixes: level 38 eased to "The Slow Lane" + the full zero-margin sweep

- **Level 38** ("Speed Demons 8"), even after the earlier bug fix (widened
  platform + moved spike), was still reported as too hard multiple times.
  Per explicit user request, this one level (only) was turned into a
  deliberate easy breather: both enemies' speed dropped from 3.8/3.6 to
  1.2 (well under the Speed section's normal 3.5-4.5 range), and the level
  was renamed from "Speed Demons 8" to "The Slow Lane" (via a one-off
  special case in `SPEED_LEVEL_NAMES` rather than a per-level name field,
  since names are derived from `HAND_AUTHORED_NAMES[id-1]`). Geometry
  (platform widths, spike position, patrol confinement) is unchanged from
  the earlier fix — only speed and name changed.
- **The full "enemy patrols its entire platform with zero safe margin"
  sweep**, previously flagged but not actioned pending confirmation, was
  completed across all 22 remaining affected hand-authored levels (6, 9,
  10, 11, 14, 15, 17, 18, 19, 22-27, 29, 32, 34-37, 39 — 55 individual
  enemy/platform edits in total). Boss arenas (20, 30, 40) were
  deliberately excluded: a boss patrolling its whole arena is the intended
  fight, not the same "unfair, no-escape" bug.
  - **Method**: a script matched every enemy to its platform and flagged
    any whose best-side margin (patrol edge to platform edge) minus the
    player's 40px width was under 10px of real slack — the same
    computation used for levels 8/13/28/33/38.
  - **Policy**: confine each flagged enemy to a minimal 32px patrol
    hugging one edge of its platform, picking the edge that (a) protects
    the spawn-adjacent landing zone on early platforms and (b) doesn't
    force widening into a neighboring pit's space. Where the platform was
    under 90px wide, it was widened to 90px (matching the ~18px-slack
    precedent from the level 28/38 fixes) by extending on the side that
    doesn't border a tight neighbor.
  - **One collision found and fixed during this pass**: level 36 has two
    narrow floating ground islands (`ground(230,70)` and `ground(350,50)`)
    separated by only a 50px pit. Widening both to 90px using the generic
    rule would have made them overlap by 10px. Fixed by having each
    platform's *margin* grow into whichever neighboring pit had more
    spare room (its own patrol hugging the shared, tighter boundary) —
    `ground(230,70)` -> `ground(210,90)` (patrol hugs the shared-pit side,
    margin grows into the *other*, roomier pit) and `ground(350,50)` ->
    `ground(310,90)` (patrol hugs the world edge, margin grows into the
    now-vacated shared pit). Final shared pit: 10px, thin but no overlap.
  - **One spawn-zone regression found and fixed by the validator itself**:
    level 35's enemy 3 was first confined to `(140, 172)` on
    `platform(140, 180, 120)`, but 140 falls inside the mandatory
    spawn-safety zone, and `npx tsx scripts/validate-levels.ts` correctly
    rejected it ("Level 35: enemy 3 patrols the spawn area"). Re-confined
    to the platform's other edge, `(228, 260)`, instead — the validator
    catching this is a good sign the existing safety checks compose well
    with this kind of scripted, large-scale edit.
  - **Verified**: a fresh audit run over all 40 hand-authored levels
    confirms zero remaining flagged enemies (excluding the 3 boss arenas).
    `npx tsc --noEmit`, `npx tsx scripts/validate-levels.ts`, `npm test`
    (77/77), and `npm run build` all pass.
- **New finding, not yet fixed**: running the same audit script across all
  200 levels (not just the 40 hand-authored ones) shows the identical
  zero-margin pattern on effectively every procedurally generated level,
  41-200. This is a property of `levelGenerator.ts` itself (it doesn't
  apply this same margin check when placing enemies), not a per-level
  authoring mistake, so it needs a generator-level fix rather than
  another round of individual level edits. Flagged in the README's known
  limitations; not actioned in this round since it wasn't part of what was
  reported.
