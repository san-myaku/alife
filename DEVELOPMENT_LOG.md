# ALIFE Development Log

## Development Rules

- Keep the original environment game file unchanged:
  `alife_env_seaglass_v1_fixed_v5_eco5_PATCH_metabolism_v7.html`
- Develop the symbolic-shapes version in:
  `alife_symbolic_shapes_v1.html`
- Publish GitHub Pages from:
  `index.html`
- Because `alife_symbolic_shapes_v1.html` is ignored by git, sync it to `index.html` before committing.
- Stage only intended tracked files. Do not commit local server files, generated caches, or the untouched original HTML.
- Before publishing, run:
  - inline script syntax check for both HTML files
  - `git diff --check -- index.html`
  - local browser smoke test when the local server is running
  - hash check for the untouched original HTML

## Current Public Page

- GitHub Pages: https://san-myaku.github.io/alife/
- Public artifact: `index.html`
- Local development server: `http://127.0.0.1:8765/alife_symbolic_shapes_v1.html`

## Change Log

### 2026-06-30

- Added procedural water-surface caustics: soft white/cyan refractive line networks and drifting loop highlights drawn under organisms, with lower update density on mobile/low-FPS frames.
- Completed the remaining adopted ALIFE plan items except membrane variants: rare-trait carrier visibility, material/internal-structure descriptions, richer extinction records, stronger water-current visualization, wall-only membrane wording/loading, performance counters in the FPS HUD/debug API, and an optional WebGL water-quality background path with Canvas fallback.
- Stabilized mobile organism rendering: detailed symbolic bodies no longer switch to the simplified round-node renderer just because FPS briefly dips. Tiny rendering now uses population hysteresis so the display does not flip every FPS sample.
- Implemented the Notion update plan from the attached text: clickable organism float cards, rare-trait discovery display, water-quality status, predation v2 pursuit/flee behavior, topology-driven morphology, richer species cards, event result reports, corpse/decay nutrient-cycle cues, individual recent-action history, extinction records, water-surface strokes, temporary membranes, and carrying-capacity messaging.
- Kept the design symbolic/microbe-like: no insect legs, antennae, wings, jaws, cilia/flagella emphasis, diet-share era labels, or phylogeny explanation labels were added.
- Added bounded arrays and throttled updates for ripples, currents, membranes, particles, recent events, species cards, water-status logs, and extinction records to protect the 120-organism target.
- Extended save/load data with new optional fields while keeping the `ALIFE2:` save prefix and defaulting missing fields for old saves.

### 2026-06-29

- Created symbolic-shapes organism variant without touching the original environment file.
- Added chain, branch, ring, schooling, hunting-pack, and defensive-school behavior variations.
- Added predation scatter particles and new-species highlight effects.
- Removed the visible defensive ring from defensive schools.
- Limited group strategies to smaller organisms.
- Changed all group membership and group-based protection to same-species only.
- Added this development log so future changes keep a compact proof trail.
- Added sketch-inspired symbolic node shapes: leaf, diamond, four-point sparkle, six-point star, and five-lobed cloud.
- Expanded the mobile pond/canvas area so the simulation has more screen space before the control panel.
- Made organism colors species-stable: individuals with the same species key now share the same body, nucleus, avatar, and phylogeny colors.
- Improved daytime readability with stronger organism contrast, slowed and smoothed the day/night transition, added explanatory morning/night toasts, added a persistent FPS HUD, and throttled phylogeny redraws to reduce UI overhead.
- Reduced early new-species spam by starting with an established diverse population, changed default mutation to 3%, softened colored organism outlines, removed new-species burst rays, expanded event/season explanation toasts, and added broader render-performance cuts.

## Verification Notes

- The original environment file's known SHA256 is:
  `1DD2B28D6FC7D2471370CF2B88C00CD87319DD285F255C8123408F108463816B`
- Headless Chrome checks should use the installed Chrome executable if bundled Playwright lacks its downloaded Chromium browser:
  `C:/Program Files/Google/Chrome/Application/chrome.exe`
- For bundled Playwright resolution on this Windows setup, include both Node module roots in `NODE_PATH`:
  - `C:\Users\yuhim\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules`
  - `C:\Users\yuhim\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\.pnpm\node_modules`
