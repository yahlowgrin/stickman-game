# Stickman Physics

A browser-based 2D platformer with 200 levels across six sections (Core, Fire,
Speed, Lightning, Ice, Toxic), shooters and escalating bosses, chiptune music
and effects, touch controls, and saved progress. Frontend only — no backend,
accounts, or payments. React 19 + TypeScript + Vite + Tailwind 4, rendered with
DOM/SVG and a fixed 60 Hz simulation; the Web Audio API for sound (no audio
files).

Ice enemies (levels 101-150) throw ice balls that briefly freeze you in place
(you can't move or jump for about 1.5s) instead of killing you outright — the
one non-lethal hazard in the game. Everything else, including getting hit by
something else while frozen, is still instant death as usual.

The full design spec is in [`docs/SPEC.md`](docs/SPEC.md); implementation status
and design decisions are in [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Run

```bash
npm install
npm run dev:client      # http://localhost:5173
```

In dev builds, `?level=N` starts at that level instead of resuming saved progress.

**Controls** — desktop: ← / → to move, Space or ↑ to jump. Touch devices get
on-screen Left/Right/Jump buttons automatically (no setting to toggle). The
header has a level-select grid and a mute toggle; progress and the mute
preference are saved to `localStorage`.

## Check and test

```bash
npm run check   # TypeScript type check + level validator
npm test        # headless physics / game-step simulation tests (node:test via tsx)
```

## Build

```bash
npm run build   # static site in dist/
```

## Deploy to GitHub Pages

The public base path comes from the `BASE_PATH` environment variable
(default `/`). For a project site at `https://<user>.github.io/<repo-name>/`:

```bash
BASE_PATH=/<repo-name>/ npm run build
```

Then publish the `dist/` folder, e.g. with a GitHub Actions workflow using
`actions/upload-pages-artifact` + `actions/deploy-pages` (set Settings → Pages →
Source to "GitHub Actions"), or by pushing `dist/` to a `gh-pages` branch.

## Manual playtest checklist

Automated checks (`npm run check`, `npm test`, `npm run build`) cover the game's
logic; this is what to click through by hand, ideally at a narrow phone width
(375×667 or similar, dev tools' device toolbar works fine) with the browser's
"emulate touch" on.

- **Start overlay** — loads dark and paused (nothing falls or moves yet); "Tap or
  click to start" both as a button press and as a tap anywhere on the backdrop
  begin the game and turn on sound.
- **Keyboard** — ← / → move, Space and ↑ both jump, arrow keys/Space never scroll
  the page.
- **Touch** — Left/Right/Jump buttons appear at the bottom (they're hidden on a
  mouse-driven desktop); holding a direction while tapping Jump works from a
  single hand; nothing text-selects or shows a callout menu on long-press.
- **Levels** — 1 (movement only, no hazards), 20, 30 (bosses have a locked/dimmed
  door, a gold crown, and a shrinking row of HP pips that only unlocks the door
  at 0), 21, 26, 28 (fire shooters — watch for the brief charge glow before each
  shot), 40 (speed boss), 41, 43 (lightning), 100 (Thunder God, the toughest
  lightning boss), 101, 150 (toxic, arcing blobs), 200 (The Final Poison King,
  then the victory screen and "Play Again").
- **Mute** — the header button shows both an icon and the word "Mute"/"Unmute"
  and switches instantly with no click/pop; reload the page and confirm it's
  still muted (or not).
- **Progress** — beat a level, reload the page, and confirm it resumes at the
  next level rather than restarting at 1; open the level-select grid and check
  the level you just unlocked is now selectable while later ones stay locked.
- **No console errors** — open the browser console and confirm it stays empty
  through all of the above.

## Known limitations

- **A very precisely-timed jump can occasionally skip straight from one
  platform into the door**, bypassing an intermediate platform. Every level's
  validator-guaranteed route still requires every step for an ordinarily-timed
  jump — this is normal platformer skill expression (a slightly generous jump
  arc), not a broken level, but it's called out here rather than left
  unmentioned.
- **Music is a short generated arpeggio per section**, not a hand-composed
  tune. It meets the spec (square lead + triangle bass, distinct key and tempo
  per section, properly lookahead-scheduled) but is intentionally simple.
- **Some generated level names don't describe their layout** (e.g. a level
  named after rain might not be a "pits" template) — names and layout
  templates are chosen independently for levels 41–200.
- **Level 38 ("Speed Demons 8") is still genuinely hard** even after fixing
  two real bugs found there (an enemy patrolling with zero safe margin, and
  a spike that clipped the natural landing spot with no warning). It's a
  top-tier level in the fast-enemy section by design; the fixes removed the
  unfair parts, not the intended challenge.
- **Every hand-authored level's enemy patrols now leave a genuine safe
  landing zone** (at least 10px of real clearance beyond the player's own
  40px width) — the "enemy patrols its entire platform" bug originally
  found on levels 8, 13, 28, 33, and 38 was swept across all 40
  hand-authored levels (bosses on 20/30/40 excepted, since patrolling
  their whole arena is the intended fight). See `docs/PROGRESS.md` for
  the full list of levels touched.
- **The same zero-margin pattern exists on many procedurally generated
  levels (41-200)**, discovered while auditing the hand-authored ones —
  it's a property of the level generator itself, not a per-level bug, and
  hasn't been fixed yet (a generator-level fix, not a level-by-level one).
- Touch and keyboard drive the identical input controller and both were
  scripted end-to-end through completing level 1 and unlocking level 2.
