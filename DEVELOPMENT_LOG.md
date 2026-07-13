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

### 2026-07-13

- Added `window.__alifeDebug.predationIndividualFunnelSummary()` to track unique carnivore progress through valid prey, target acquisition, chase, contact, attack, first predation, post-predation threshold reach, and post-predation reproduction.
- Extended the Playwright benchmark with flat per-trial individual predation funnel metrics, dominant pre-first-predation failure reasons, and first-predation energy checkpoints.
- Ran a 3-trial baseline at 390x844 for 1,800 fixed steps. Carnivores usually found valid prey and started chasing, but the dominant drop was chase-to-contact: 19.3 started chase versus 3.0 reached contact on average. The dominant pre-success failure was `chaseFailed`, and pre-first-predation starvation averaged 17.0 carnivores.
- Tested one scoped fix only: a 15% carnivore chase-force increase during active target pursuit. In 5 treatment trials it reduced contact and first-predation success, so the balance change was reverted.
- Kept the diagnostic telemetry and benchmark output changes; no predation success rate, prey size, sense range, energy gain, reproduction, storage, population-cap, rendering, or UI balance values remain changed by this pass.
- Added `window.__alifeDebug.reproductionEligibilitySummary()` to break reproduction into evaluated, energy-below-threshold, eligible, probability-failed, and reproduced gates by diet.
- Added carnivore diagnostics for lifetime max `energy / reproThreshold`, predation-after-threshold reach, death-state summaries, and carnivore-child parent origins without changing reproduction or predation balance values.
- Fixed reproduction resource summary retention by aggregating attempts/successes in bounded 10-frame buckets; the earlier zero carnivore-attempt reading could be caused by the small event ring losing older records.
- Ran 5 diagnostic trials at 390x844 for 1,800 fixed steps. Carnivores did reach eligibility in some trials, but most carnivore evaluations remained energy-below-threshold, reproduction success rate was very low, and final carnivore persistence stayed 0/5.
- Made the reproduction algae-location multiplier diet-aware: herbivores keep the current `En` multiplier, omnivores interpolate it, and carnivores move it toward neutral `1.0`.
- Added `window.__alifeDebug.reproductionResourceSummary()` to track reproduction attempts, successes, local `En`, original/applied resource multipliers, and body stores by diet.
- Ran A/B benchmarks at 390x844 for 1,800 fixed steps. The run expanded to 10 trials per side because carnivore births varied, but carnivore-parent reproduction attempts stayed 0 in both groups, so the En multiplier was not the observed direct bottleneck.
- Connected live predation gains to internal nutrient storage with `storeN += 0.050 * (gain / 40)` on successful predation only.
- Added bounded predation nutrition telemetry through `window.__alifeDebug.predationNutritionSummary()` and included diet-level average `storeN` in population turnover summaries.
- Ran a 5-trial telemetry-only control and a 5-trial treatment benchmark at 390x844 for 1,800 fixed steps; `storeN` increased after predation, but carnivore reproduction, births, net balance, and final persistence did not improve, so the test stopped at 5 treatment trials.

### 2026-07-11

- Added full selected-organism gene readout to the observation card, showing speed, size, metabolism, fecundity, sense, diet, and form seed as compact percentage-like values.
- Widened the selected-organism card slightly and fixed the dead-organism status replacement to target the status line instead of a fixed line index.
- Improved carnivore survival without directly raising predation success probability: carnivores now receive a modest sense-radius boost, with ambushers and pack hunters getting the strongest discovery help.
- Added ambusher resting metabolism reduction while waiting or holding a distant prey target, so low-speed ambushers can survive as a patient strategy instead of burning full basal cost while stationary.
- Strengthened pack-hunting cohesion by letting pack hunters keep group behavior even from low-sociality solitary mode, rally toward packmates' prey targets, and inherit a shared target before contact.
- Verified both HTML script bodies parse, loaded `index.html` through local Chrome/Playwright with no page errors, and kept the `tryPredate()` success-probability formula unchanged.

### 2026-07-10

- Turned the existing internal challenge rules into a visible game-goal panel with progress bars for diversity, carnivore dominance, and no-predation streaks.
- Added `window.__alifeDebug.challengeSummary()` so challenge state can be verified without touching organism rendering.
- Kept the organism renderer, generator, and roster art files unchanged; mobile FPS HUD positioning now avoids overlapping the scrolled control panel.
- Removed the water-reflection/caustics feature and the visible water-stroke tool path, then removed the remaining cyan background streaks and recolored organism motion/sense trails, temporary membranes, and generic rings so they no longer read as blue lines over grazing scars.
- Increased grazing-scar opacity and contrast so heavily eaten, low-algae patches draw closer to black instead of letting background blue/green layers show through.
- Replaced plankton's cyan cross sprite with soft green blobs, synced the shared organism-render trail/sense colors, recolored blue status-line effects that can sit over the pond, and cache-busted `organism_render.js` so old blue-line rendering does not persist in the browser.

### 2026-07-08

- Added a Lifeform Roster mode to `generator.html`, using the real shared renderer to arrange generated organisms into a pale reference-sheet view with numbering, role-color dots, group legend, and modal drill-in.
- Kept the game files and shared renderer/model behavior unchanged for this pass; the roster is a generator-only visual exploration surface for refining organism appearance before gameplay integration.
- Added `organism_roster_art.js` as a generator-only concept renderer for a more radical organism style pass: cells, chains, rings, radial predators, branching filters, clusters, amoebas, mesh forms, jelly forms, cilia, spines, granules, and rare-trait accents can now be reviewed in the generator before touching the game renderer.
- Added an `Art Lab` / `Game Renderer` toggle to `generator.html` so the new concept look can be compared against the current shared renderer without changing gameplay files.
- Reworked the Art Lab style toward the supplied roster references: softened the palette and membrane strokes, enlarged roster organisms, replaced the poor branch form with translucent branching tubes and terminal vesicles, and changed radial forms from icon-like stars into soft bodies with fine spines or tip beads.
- Removed the generator-only `crown` and `colony` rare traits from the Art Lab controls, anchored flagella/tendrils into the membrane, rebuilt mesh organisms as organic lace-like membranes instead of geometric node diagrams, and added more per-topology variants for chains, clusters, jelly-like specials, and mesh forms.
- Simplified the generator to use the Art Lab renderer as the only visible organism art path, added a visual-form selector with 17 concrete forms plus "All forms", smoothed the membrane-cluster outline to remove sharp notches, and changed chain cilia to grow from the body edge instead of floating around long organisms.

### 2026-07-06

- Added species strategy profiles that classify organisms into readable survival styles, including algae grazing, mixed adaptation, colony breeding, pursuit predation, ambush hunting, corpse scavenging, and plankton filtering.
- Expanded new-species toasts, selected-organism cards, species cards, and extinction records with each species' strategy, main food source, preferred environment, strength, and risk.
- Added strategy distribution telemetry to the ecology dashboard and `window.__alifeDebug.strategySummary()` so population changes are easier to inspect while the simulation runs.
- Moved plankton production toward the new ecology ledger: plankton now emerges from oxygen-gated detritus pockets, consumes detritus/oxygen when seeded, and no longer samples algae as its source.
- Reduced natural wild-food spawning further so background algae, detritus, corpses, and predation carry more of the food web.
- Gave chloroplast organisms a local daytime oxygen-release effect so photosynthetic traits can improve nearby algae viability instead of only lowering metabolism.
- Adopted the Obsidian refactoring direction as the forward development guide: simplify by making ecological cause/effect visible before adding more features.
- Added a centralized `CONFIG` object for population, organism scale/speed, rendering caps, ecology tuning, and environment-grid settings.
- Added the first ecology design ledger (`roleFoodLedger`) for the planned "one primary food per role" cleanup, exposed through `window.__alifeDebug.designLedger()`.
- Connected `roleFoodLedger` to actual feeding gates: grazers/omnivores use algae, scavengers use corpse-detritus with algae as fallback, filters prioritize plankton, and carnivores stop treating plant particles as food.
- Added steering bias toward each role's main food source so scavengers favor corpses and filter feeders favor plankton when multiple food signals are nearby.
- Added a capped predation bloom effect on successful hunts and wired it into the debug predation preview so meat-eating events are easier to spot after carnivores stop chasing plant food.
- Added `window.__alifeDebug.foodWebSummary()` to track actual food use and supply by source before further reducing wild food or tuning predator balance.
- Shifted wild food closer to rescue/event-only by lowering ambient spawn scale and adding low-population/low-energy rescue food telemetry.
- Expanded predator burst behavior beyond ambushers so carnivorous roles can briefly accelerate near a target, with debug reporting for active bursts.
- Re-scoped predator burst back to ambusher-only behavior and added scavenger field-detritus feeding so corpse-detritus roles can use dirty background patches directly.
- Replaced the field-detritus feeding direction with visible corpse-fragment detritus: corpse decay and predation scraps now create small dark detritus particles, while ambient background detritus particles no longer spawn.
- Added an ecology dashboard to make progress visible in-game: algae use, oxygen, corpse fragments, decomposition/plankton, dominant food source, supply source, predation events, and average energy are shown in the control panel.
- Added semantic environment aliases (`oxygen`, `detritus`, `decomposition`, `nutrient`) on top of the legacy `turbid`/`foul`/`algae` fields and exposed them through debug snapshots for the next environment cleanup pass.
- Removed the disabled direct field-detritus grazing block so scavengers now rely on actual corpses and visible corpse-fragment particles rather than invisible background grazing.
- Kept behavior-preserving aliases out of the code path by replacing scattered tuning constants with `CONFIG.*` reads.

### 2026-06-30

- Added a water-reflection toggle and made caustics default OFF so the experimental surface effect can be disabled without paying its drawing cost.
- Added adaptive heavy-topology render detection: dense mesh/complex populations now enter a stable lightweight symbolic mode before mobile FPS collapses, while lightweight mode still uses each organism's representative symbolic shape instead of falling back to round-only nodes.
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
