You are working on a browser-based 2D platform game called "Stickman Physics."

## 0. How to work

- First inspect the existing repository. The game is currently concentrated in `client/src/pages/Home.tsx`. Understand it before changing anything; do not blindly overwrite the project.
- Preserve existing conventions where practical, but split the game into maintainable modules (see §17).
- If any of the expected npm scripts below are missing, add them. If the repository is empty, scaffold a Vite + React + TypeScript + Tailwind 4 project first.
- Before writing any code, save this entire prompt to `docs/SPEC.md` (excluding the operator-notes comment at the top) and create `docs/PROGRESS.md`. Commit both. `SPEC.md` is the source of truth for all later sessions.
- Work in phases and commit after each one with a clear message:
  1. Refactor structure, types, fixed-timestep physics loop
  2. Level generator + reachability validator
  3. Enemies, projectiles, bosses
  4. UI, overlays, touch controls, persistence
  5. Audio
  6. Visual polish, final check against the acceptance criteria
- Run `npm run check` and `npm run build` at the end of every phase. Do not move on while either fails.
- Do ONE phase per session. At the end of each phase:
  1. Update `docs/PROGRESS.md` with: phases completed, current file structure, decisions made that deviate from or clarify the spec, known issues, and the next phase to do.
  2. Commit and push.
  3. Stop and tell me the phase is done, which model the next phase should use (Opus for phases 1–2, Sonnet for 3–6), and that I should start a new session.
- When starting a session, read `docs/SPEC.md` and `docs/PROGRESS.md` first and continue from the next unfinished phase.

## 1. Product goal

Build a complete, playable, frontend-only platform game with 200 levels.

The player controls a stickman who jumps across platforms, avoids spikes, dodges enemies and projectiles, stomps enemies from above, and reaches a glowing door at the end of every level.

The game must be fun, responsive, visually clear, playable on both phone (touch) and desktop (keyboard), and progressively harder without ever creating an impossible level.

This is a prototype: no authentication, payments, database, multiplayer, or backend.

## 2. Tech stack

Use the existing stack:

- React 19, TypeScript, Vite
- Tailwind CSS 4 with `@tailwindcss/vite`
- Lucide React icons
- Existing shadcn/Radix UI components where useful
- `wouter` only if routing is needed
- Web Audio API for all sound (no audio files)
- DOM elements, SVG, CSS, and requestAnimationFrame for rendering. No canvas or game engine.
- No new runtime dependencies. The only permitted new devDependency is `tsx` (or equivalent) if needed to run the level validator.

Commands:

- Development: `npm run dev:client`
- Type check + level validation: `npm run check` (must run `tsc --noEmit` AND the level validator)
- Production build: `npm run build`

The output must be a static frontend. Make Vite's `base` configurable via an environment variable so the build can be hosted on GitHub Pages under `/<repo-name>/`.

## 3. World and layout

- Logical world: 400 wide × 500 high. All geometry, goals, and enemies stay inside these bounds.
- Ground top edge at y = 400.
- Player spawns at x = 50, y = 100 and falls to a safe surface. The spawn area must never contain spikes or enemies.
- Render the world at logical size and scale it uniformly with a CSS transform to fit BOTH the available width and the available height.
- The page must not scroll during play on any screen, including small phones with browser toolbars visible. On narrow/short screens, collapse the header to a single line and hide the control instructions.

## 4. Physics

- Fixed timestep: update the simulation at exactly 60 Hz using a delta-time accumulator inside requestAnimationFrame. All "per frame" values below mean per 60 Hz tick. The game must run at the same speed on 60 Hz, 120 Hz, and 144 Hz displays. Cap the accumulator to avoid a spiral of death after a tab switch.
- Gravity: 0.6
- Jump velocity: -12 (peak rise ≈ 120 px)
- Horizontal speed: 5
- Player hitbox: 40 × 80
- Platforms are one-way: the player collides only when landing from above and can jump up through them from below. The ground is solid.
- Clamp the player to the left and right world edges.
- Keep gameplay state in refs; only push to React state what the UI needs to re-render (level, overlays, mute).
- Pause the simulation when the tab is hidden (`visibilitychange`).

## 5. Level fairness rules (enforced by code)

Theoretical jump reach with the physics above: about 200 px horizontally at the same height. Use at most 70% of theoretical reach:

| Target platform relative to take-off | Max horizontal edge-to-edge gap |
|---|---|
| Same height or lower | 140 px |
| Up to 60 px higher | 120 px |
| Up to 90 px higher | 100 px |
| More than 90 px higher | Not allowed |

Late-game levels (150+) may use up to 85% of theoretical reach, never more.

Implement a level validator (`scripts/validate-levels.ts` or similar) that runs as part of `npm run check` and fails if any of the 200 levels:

- Has no route from spawn to goal (build a graph of standable surfaces using the table above, or simulate jump arcs with the real physics code, then search it)
- Has geometry, goal, or enemy patrol range outside the 400 × 500 world
- Has a goal overlapping or directly above spikes with no safe landing
- Has spikes or an enemy in the spawn area
- Has an enemy whose patrol range extends beyond the platform it stands on
- Has a boss level whose goal is reachable while the boss is alive (see §9)

The validator checks geometry only; enemies and projectiles add difficulty on top of a route that is always possible.

## 6. Controls

Desktop:
- ArrowLeft / ArrowRight: move
- Space or ArrowUp: jump
- `preventDefault` on Space and arrow keys during play so the page never scrolls.

Touch (required, not optional):
- On-screen Left and Right buttons at bottom-left, Jump button at bottom-right, large enough for thumbs (at least 56 px).
- Support holding a direction and jumping at the same time (multi-touch).
- Show them only on touch-capable devices (`pointer: coarse`).
- Apply `touch-action: none` and disable text selection / long-press callouts on the game area and buttons.

## 7. Data types

Replace scattered booleans and magic values with typed data. Level definitions and runtime state are separate.

```ts
type Rect = { x: number; y: number; width: number; height: number };

type ProjectileType = "fire" | "lightning" | "toxic";
type Section = "core" | "fire" | "speed" | "lightning" | "toxic";

type EnemyDef = {
  id: number;
  x: number;
  y: number;
  startX: number;
  endX: number;
  speed: number;
  width?: number;
  height?: number;
  projectileType?: ProjectileType; // present = this enemy shoots
  shootCooldown?: number;          // ticks between shots
  isBoss?: boolean;
  hp?: number;                     // stomps required; default 1
};

type Level = {
  id: number;
  name: string;
  section: Section;
  difficulty: number;
  goal: Rect;
  platforms: Rect[];
  spikes: Rect[];
  enemies: EnemyDef[];
};
```

Do not use a separate `isShooter` flag; `projectileType` being set is what makes an enemy shoot.

Runtime enemy state (current x, facing direction, remaining hp, cooldown timer, alive/dead) lives in a separate runtime structure created from `EnemyDef` on level load and on respawn.

## 8. Level generation

- Levels 1–40 are hand-authored.
- Levels 41–200 use deterministic procedural generation from a set of layout templates (staircase, zig-zag, vertical climb, gauntlet, islands over spikes, split route, etc.) with parameter variation.
- Use a small inline seeded PRNG (e.g. mulberry32) seeded with the level id. No `Math.random()` in level generation. The same level must be identical on every load.
- Consecutive levels must not use the same template. Every generated level must pass the validator.

## 9. Goal and completion

The door:
- Gold with a strong glow, gentle pulse/bounce animation
- Lucide `DoorOpen` icon or an original door SVG
- Completion triggers when the player's hitbox overlaps it

On boss levels the door is shown locked/dimmed and cannot be entered until the boss is defeated; it then unlocks with a visible and audible cue.

On completion:
1. Stop player movement and show the success pose
2. Play the success sound
3. Show the "LEVEL COMPLETE!" overlay for about 1.2 s
4. Save progress (§12)
5. Load the next level, resetting player, enemies, projectiles, and timers

After level 200, show the victory screen (§14).

## 10. Death and respawn

The player dies on contact with spikes, with any enemy from the side or below, or with any projectile.

On death:
- Play the death sound; show the dead pose (slight rotation, X eyes)
- Show the death overlay with the text "SPLAT!"
- Disable input for about 1 s
- Respawn at the level start on the same level
- Reset all enemies, projectiles, and timers; bosses return to full HP

## 11. Enemies, projectiles, bosses

General:
- Enemies patrol between `startX` and `endX` and turn at the boundaries, with a visible facing direction
- Every enemy, including bosses, can be damaged only by a stomp from above (player falling, feet above enemy's top edge). Stomping bounces the player upward (about -8).
- Side or bottom contact kills the player.
- Use original geometric monster designs. Do not imitate characters from existing games.

Normal enemies (levels 2–20): dark red, speed 1–2, no projectiles.

Fast enemies (levels 31–40, also used later): speed 3.5–4.5, always below the player's 5 so the player can escape. Long patrol ranges.

Shooters:

| Type | Section | Colour | Motion |
|---|---|---|---|
| Fire | 21–30 | Orange/red, yellow core, glowing trail | Horizontal, speed 3 |
| Lightning | 41–100 | Cyan/blue elongated bolt, bright core | Horizontal, speed 6 |
| Toxic | 101–200 | Lime green blob with glow | Arc: vx 3, vy -6, gravity 0.3 |

- Projectiles fire in the enemy's facing direction and are removed when leaving the world or hitting a platform (toxic).
- The enemy visibly charges (glow) for about 0.4 s before each shot, and a shoot sound plays.
- Projectiles must never spawn close enough to the player to be unavoidable: skip a shot if the player is within 60 px horizontally of the muzzle.
- Cooldowns decrease gradually through each section, never below 60 ticks for fire, 50 for lightning, 45 for toxic.

Bosses:
- Much larger than normal enemies, darker colour, gold crown/armor/markings, visible HP pips
- Speed up and shoot more often after each hit
- Brief invulnerability (about 0.5 s, flashing) after each hit so one stomp cannot count twice

| Level(s) | Boss | HP |
|---|---|---|
| 20 | Mini Boss (red) | 3 |
| 30 | Inferno King (fire) | 5 |
| 40 | Speed boss | 5 |
| 50, 60, …, 100 | Thunder God (lightning) | 5 → 8, strongest at 100 |
| 110, 120, …, 200 | Poison King (toxic) | 6 → 10, final boss at 200 |

Boss arenas: wide ground, at least two elevated side platforms for escape and stomp approaches, no spikes in the arena floor.

## 12. Progression and persistence

Save to `localStorage`. Wrap access in try/catch so private browsing or full storage doesn't break the game, but log the error with `console.warn` (see §17). Save:
- Highest level unlocked
- Mute preference

Add a level-select screen showing levels in a grid grouped by section; only unlocked levels are selectable. On load, resume at the highest unlocked level.

Level names:

Core 1–20: The Basics, Watch Your Step, Enemy Territory, The Ascent, Leap of Faith, Dual Threat, Precision Jumping, The Gauntlet, The Floor is Lava, Halfway There, Tight Squeeze, Bouncing Heads, Staircase of Doom, Enemy Express, The Zig Zag, Pinpoint Precision, Panic Room, Maximum Overdrive, The Pre-Boss Run, Mini Boss.

Level design notes for 1–20:
- 1: movement and jumping only, no enemies or spikes
- 2: first spikes and one enemy
- 3: multiple enemies
- 4: vertical staircase
- 5: short leap over spikes
- 6: two enemy platforms
- 7: small precision platforms
- 8: multi-level gauntlet
- 9: dangerous floor
- 10: complex vertical route
- 11–19: combine narrow platforms, enemies, spikes, zig-zags, pre-boss challenge
- 20: boss arena

Fire 21–30: Introducing Fire, Crossfire, Fire and Spikes, High Altitude, Fire Maze, Moving Targets, Inferno, Timing Is Everything, Fire Boss Pre-Run, Inferno King.
- 21 has plenty of stepping stones
- 26 has a clear staircase of intermediate platforms
- 28 has extra platforms and slower fire timing

Speed 31–40: "Speed Demons 1–9", then the speed boss at 40.

Lightning 41–100 and Toxic 101–200: generate varied names from a themed word list (e.g. "Static Climb", "Voltage Ladder"; "Sludge Steps", "Acid Rain"), deterministic per level, no duplicates.

## 13. Visual design

Style: clean, friendly, colourful arcade platformer; minimal vector/SVG; light background with strong object contrast; retro energy without copying any existing game.

Page:
- Light slate/off-white background, game centred, max-width around the game viewport
- Space Mono for game text, Inter for UI. Self-host fonts or use a system fallback stack so the game works offline.
- Rounded card, subtle border, strong shadow around the game
- Palette: slate, white, emerald, red, orange, cyan, lime, gold

Game viewport:
- Sky gradient from pale blue to a lighter pale blue (not pure white, so the stickman's white head keeps contrast)
- Soft sun glow, a few simple clouds
- Dark slate platforms with a bright emerald top strip
- Dark slate ground with emerald top edge and a subtle dotted pattern
- Red triangular spikes with darker red outline
- Effects readable, not excessive

Player: stick figure SVG, white head, dark slate outline at least 2.5 px, subtle shadow, animated limbs, faces movement direction, distinct dead and victory poses.

Enemy colours: normal dark red, fire orange, lightning cyan/blue, toxic lime. Bosses darker and larger with gold markings. Projectile glows match their enemy.

## 14. UI and overlays

Header: title "Stickman Physics", current level number and name, short control hint (hidden on small screens), level-select button, mute toggle (Lucide `Volume2` / `VolumeX`).

Overlays:
- Start: dark translucent backdrop, short note that the game plays retro chiptune music and effects, button "Tap or click to start". This click/tap is the user gesture that creates the AudioContext.
- Level complete: white translucent, large green "LEVEL COMPLETE!"
- Death: subtle red translucent, large animated "SPLAT!"
- Victory: green-tinted, "YOU BEAT THE GAME!", message that all 200 levels are conquered, "Play Again" button returning to level 1 (keep unlocked progress)

## 15. Sound and music

Implement a small sound engine with the Web Audio API, no audio files.

Music:
- Upbeat chiptune loop: square-wave lead, triangle-wave bass, short repeating notes
- A different short loop (or key/tempo variation) per section
- Schedule notes ahead using `AudioContext.currentTime` with a lookahead scheduler; do not rely on `setInterval` timing alone

Effects: jump, land (quiet, and not replayed on every tiny step), stomp/enemy hit, boss hit, shoot, death, door unlock, level complete.

Rules:
- Create/resume the AudioContext only after a user gesture
- Mute stops music and silences effects; the preference persists
- Suspend audio when the tab is hidden, resume when visible
- Clean up scheduled timers and oscillators on unmount
- No autoplay errors in the console
- Master volume moderate; effects not louder than music

## 16. Accessibility and usability

- Every button (including touch controls and the mute toggle) has an `aria-label`
- The mute button shows its current state with both icon and label ("Mute" / "Unmute") and uses `aria-pressed`
- Projectile types differ by shape and motion, not colour alone: round fireball with trail, elongated zig-zag bolt, blob that arcs
- Text and key objects meet readable contrast against the sky and overlays
- Important controls are at least 44 px (touch controls 56 px, see §6)
- No horizontal scrolling at any width down to 320 px
- The goal is always visible on screen
- Overlays and transitions show clear text (what happened, what happens next), never an unexplained pause
- Respect `prefers-reduced-motion`: tone down door pulse, screen shake, and overlay animation

## 17. Code quality

Target structure (adapt if the repo is small, but always keep types, constants, and level data out of the rendering code):

- `pages/Home.tsx`: page composition only
- `game/types.ts`: shared types (§7)
- `game/constants.ts`: physics, speeds, cooldowns, sizes; no magic numbers elsewhere
- `game/levels.ts` and `game/levelGenerator.ts`: hand-authored levels 1–40 and the seeded generator
- `game/physics.ts`: movement and collision as pure functions (state in, state out), with no React or DOM imports, so they can be tested and reused by the validator
- `game/audio.ts`: Web Audio sound engine
- `components/`: small components for Player, Enemy, Projectile, Goal, Platform, Spike, Overlays, HUD, TouchControls, LevelSelect

Errors:
- Do not silently swallow errors. Where an optional feature can fail (audio, localStorage), catch it so the game keeps running, and log it with `console.warn` or `console.error`.
- No empty `catch {}` blocks.

## 18. Validation and definition of done

Automated (must pass before declaring any phase done):
- `npm run check`: type check plus the level validator for all 200 levels
- `npm run build`: production build succeeds, including with a subpath `base`
- `npm run dev:client` starts and the home route returns the app

Simulation tests: because you cannot play the game by hand, write headless tests that drive the pure physics/game-step functions and assert:
- Holding right moves the player; jump rises about 120 px and lands back on a platform
- Falling onto a platform stops the fall; one-way platforms can be jumped through from below
- Touching spikes triggers death and respawn at the spawn point with enemies reset
- Enemies patrol and turn at their boundaries
- Landing on an enemy from above defeats it and bounces the player; side contact kills the player
- Fire and lightning projectiles move horizontally at their configured speeds; toxic projectiles rise then fall under gravity
- Boss HP decreases by exactly one per stomp (invulnerability window works), speed or fire rate increases after each hit, and the door unlocks only at 0 HP
- Reaching the door advances the level; completing level 200 sets the victory state; Play Again returns to level 1
- Mute state toggles and persists
- The same level id always generates identical geometry
- Running the loop with 120 Hz frame timing produces the same positions after one second as 60 Hz

Also required:
- Layout fits a 375 × 667 viewport with touch controls and no page scrolling
- No console errors during normal play
- A short README explains how to run, build, and deploy to GitHub Pages

Use the test runner already in the repo if there is one. Otherwise use Node's built-in `node:test` run through `tsx`, not a new framework.

Report back with:
- Summary of what changed and the final file structure
- Output of `npm run check` and `npm run build`
- A manual playtest checklist for me covering: the start overlay, keyboard and touch controls on a narrow phone viewport, levels 1, 20, 21, 26, 28, 30, 40, 41, 43, 100, 101, 150, and 200, mute/unmute, and progress surviving a reload
- Any known issues or compromises, stated plainly

Do not claim the work is finished until the type check, validator, simulation tests, and production build all pass.
