# Stickman Physics

A browser-based 2D platformer: guide a stickman across platforms, past spikes
and enemies, to the glowing door. Frontend only (React 19 + TypeScript + Vite +
Tailwind 4), rendered with DOM/SVG and a fixed 60 Hz simulation.

The full design spec is in [`docs/SPEC.md`](docs/SPEC.md); implementation status
is in [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Run

```bash
npm install
npm run dev:client      # http://localhost:5173
```

In dev builds, `?level=N` starts at level N.

Controls: ← / → to move, Space or ↑ to jump.

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
