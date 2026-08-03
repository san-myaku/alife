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

## 2026-08-03 通常表示と顕微鏡表示の二段階ビジュアル統合

### 実装

- `organism_roster_art.js` を通常表示と顕微鏡表示で共有する描画器 `roster-art-v3-dual-mode` にした。
- 通常表示は `closeUp:false` の非ガラス・イラスト調。顕微鏡レンズ内だけ `closeUp:true` のガラス質・内部構造・DIC調を使う。
- 両表示は同じ個体、種の固定シルエット、色、表面、内部スロットを共有し、表示モードによって生物の正体が変わらないようにした。
- 通常表示は種ごとの静的スプライトをキャッシュし、描画時にごく小さい脈動と揺れだけを加える。生態モデル、保存形式、乱数列は変更していない。
- Claude側のスケッチが上向き `-y`、ゲームの進行方向が右向き `+x` なので、通常・顕微鏡の両方で `+π/2` 補正した。
- 診断用に `setNormalOrganismRenderer('roster'|'legacy')` と `normalOrganismRendererSummary()` を追加した。通常既定値は `roster`。

### 検証

- `scripts/normal_visual_integration_smoke.cjs`: 通常と顕微鏡で同一個体IDを描くこと、通常が `closeUp:false`、顕微鏡が `closeUp:true`、`Math.random()` 消費0、モデル状態・個体数不変、console/page error 0を確認。
- 通常表示の最終 draw ms（60 samples、中央値 / p95）: 64個体 `2.38 / 3.36`、200個体 `2.94 / 3.50`、1000個体 `10.46 / 11.17`。
- `scripts/microscope_visual_integration_smoke.cjs`: レンズOFF `2.53 / 3.58ms`、ON `5.59 / 6.77ms`、最大10個体制限内、乱数消費0、モデル非干渉、エラー0。
- `scripts/algae_population_controls_smoke.cjs` を再実行し、藻類スライダー、save/load、履歴、種・Packナビゲーション、reset、エラーなしを確認。
- 関連JSと3 HTMLの構文確認、`git diff --check` 合格。`alife_symbolic_shapes_v1.html` と `index.html` の SHA-256 は `7DE78272222E2989F815067E28A8835BB0051814FC51CF939FF4DF40B8CA5F89` で一致。凍結版は未変更。
- 目視資料: `artifacts/normal-visual-integration/normal-roster.png`、`artifacts/visual-integration/microscope-lens.png`。

## Current Public Page

- GitHub Pages: https://san-myaku.github.io/alife/
- Public artifact: `index.html`
- Local development server: `http://127.0.0.1:8765/alife_symbolic_shapes_v1.html`

## Change Log

### 2026-07-14 00:28 捕食後生理と採食・逃走の整合性改善

- Added satiety-aware predation intent: `dietIntent()` is still the base, but live-predation intent is multiplied by a smooth energy/storeN satiety factor that reaches 0.25 only for fully satiated carnivory-weighted organisms.
- Removed the diet-only baseline waste double penalty by changing respiration-derived `storeD` to `respO * 1.0` and neutralizing diet-only excretion to `min(storeD, 0.0045)`.
- Added live-predation digestive load only on successful predation: `storeD += clamp(0.035 * (gain / 40), 0, 0.08)`. Predation energy, predation success rate, prey-size rules, and predation `storeN` coefficient `0.050` were not changed.
- Added a short grazing state (`GRAZING_HOLD_STEPS = 8`) when background algae grazing actually succeeds; non-fleeing grazing applies a single `0.90` max-speed multiplier.
- Fleeing organisms (`fleeTimer > 0 || herdThreat > 0`) now skip passive background algae uptake and visible `grazeAlgaeAt()` background grazing, clear `grazingTimer`, and therefore do not receive the grazing speed penalty while fleeing.
- Added `window.__alifeDebug.feedingBehaviorSummary(windowFrames)` and benchmark fields for satiety, post-predation storeD, post-predation tracking, second predation, grazing/fleeing speed, interrupted algae, and invariant checks.
- Integrated 5-trial benchmark at 390x844, 1,800 steps, default popMax 120 and mutation 3%: fleeing background algae eaten stayed 0, grazing/fleeing overlap stayed 0, predation digestive load averaged 0.0671 storeD, and storeD fell back to 0 by 60/180 steps in measured survivors.
- Compared with the previous 5-trial baseline: carnivore net improved from -19.0 to -15.6 and carnivore deaths fell from 27.8 to 17.2, but carnivore births fell from 8.8 to 1.6, contact individuals fell from 9.0 to 3.2, predation-experienced carnivores fell from 3.6 to 0.8, and final carnivores stayed 0/5.
- Safety notes: no NaN, save/load breakage, herbivore extinction, or carnivore runaway occurred. Diversity worsened materially: extant species fell from 21.4 to 11.4 and max species share rose from 0.270 to 0.614 mean, with one trial reaching 0.9339.
- Judgment: state-transition consistency is improved and kept as a provisional implementation, but the combined balance is not accepted as final. Next work should isolate whether satiety suppression, grazing interruption, or the now-short storeD digestive pulse caused the contact/predation and diversity regression.

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

### 2026-07-13

- Added `window.__alifeDebug.chaseEfficiencySummary()` to measure carnivore chase episodes by distance reduction, speed ratio, angle error, near-contact bands, energy cost breakdown, end reasons, and possible contact skips.
- Connected the benchmark output to the new chase telemetry and kept the diagnostic history bounded through active chase state plus a capped episode buffer.
- Diagnosed the current chase bottleneck as insufficient effective predator/prey speed ratio rather than target loss, contact skip, or attack resolution.
- Increased only carnivore in-chase max speed by 8% when a valid prey target is held; chase force, sensing, target retention, contact distance, predation success, energy gain, reproduction, and population rules were not changed.
- In 5 post-change mobile trials, contact-reaching carnivores rose from the existing 3.0 baseline to 9.0 average and chase-to-contact rate rose from 15.5% to 31.5%, while end-of-run carnivores remained 0/5.

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

## 2026-07-14 08:41 肉食の捕食サイズ条件診断と飢餓時サイズ許容試験
### 背景
ユーザーの目視で、肉食個体の近くに生物がいるのに、大きい個体を無視して餓死しているように見える挙動があった。今回は捕食サイズ条件を先に緩和せず、食性上の候補、サイズ超過除外、有効獲物、ターゲット取得、接触、捕食成功を分けて計測した。
### ユーザーによる目視観察
近傍に草食・雑食らしき個体がいるが、周囲個体が肉食者より大きい場合に追跡せず、餌が近くにあるように見えるまま餓死する、という観察。
### 現行のサイズ判定式
実サイズは `baseSize = lerp(3.0, 11.0 * CONFIG.organism.maxSizeScale, sizeGene^0.85)`、`isMega` の場合のみ `* 1.65`。生体捕食の通常ターゲット上限は `prey.size < predator.size * 1.00`、群れ狩りはターゲット段階 `* 1.12`、攻撃段階 `* 1.13`。最小サイズ条件はなし。
### 捕食候補の除外順序
同一個体、死亡、保護、同種除外、サイズ下限、サイズ上限、有効候補の順で `predationCandidateClassification()` に共通化した。診断前の通常挙動と同じ硬い境界で、サイズ超過は候補化されない。
### 捕食可能最大・最小サイズ
最大は `predationMaxPreySize(predator, context)`、最小は `0`。攻撃成功率側には別に `sizeMul = 0.72 + clamp((predator.size - prey.size) / predator.size, 0, 0.55) * 0.95` があるが、サイズ上限を超えた獲物は成功率判定へ進まない。
### 追加したサイズ除外ファネル
`window.__alifeDebug.predationSizeFunnelSummary(options)` を追加。`batchId` 指定で投入系統を集計し、`observedOrganisms`, `dietCompatiblePrey`, `tooLargeRejected`, `tooSmallRejected`, `otherRejected`, `validPrey`, `targetAcquired`, `contactReached`, `attackAttempted`, `predationSucceeded` を返す。
### 餓死直前テレメトリ
肉食個体ごとに近傍サンプルを有限保持し、死亡時に直近60ステップの候補状況を要約する。直近サンプルが空の場合は死亡時に乱数を使わない近傍スキャンを1回補完する。
### 開発者候補オーバーレイ
`?dev=1` パネルに prey size overlay を追加。有効獲物は `V`、サイズ超過は `L`、その他無効は `X`、現在ターゲットは `T` で半透明表示する。通常モードでは表示しない。
### nearPrey
`spawnOrganisms()` の `positionMode=nearPrey` を追加。食性・同種除外などの通常仕様上、獲物になり得る個体の近くへ置くが、サイズ条件は問わない。
### nearValidPrey
`positionMode=nearValidPrey` を追加。現行の全捕食候補条件を満たす有効獲物の近くへ置く。有効獲物がない場合は失敗を返し、ランダムにはフォールバックしない。
### nearOversizedPrey
`positionMode=nearOversizedPrey` を追加。食性上は候補だがサイズ上限を超える個体の近くへ置く。1.00〜1.10倍、1.10〜1.25倍、それ以上の順で優先する。
### 診断試験条件
`scripts/alife_predation_size_benchmark.cjs` を追加。390x844、step 600でスナップショット取得、viable mature carnivore 5体、standard energy、同一テンプレート、投入後600ステップを S0 random / S1 nearPrey / S2 nearValidPrey / S3 nearOversizedPrey で比較した。サイズ修正は未実装のまま。
### S0 random
食性適合234、サイズ超過78、サイズ超過率0.3333、有効156、target38、contact2、attack2、捕食成功イベント1、投入個体の初回捕食1/5、繁殖1、G1出生1、初回捕食前死亡4。
### S1 nearPrey
食性適合588、サイズ超過122、サイズ超過率0.2075、有効466、target98、contact15、attack23、捕食成功イベント6、投入個体の初回捕食4/5、繁殖2、G1出生3、初回捕食前死亡1。
### S2 nearValidPrey
食性適合643、サイズ超過76、サイズ超過率0.1182、有効567、target60、contact10、attack16、捕食成功イベント4、投入個体の初回捕食2/5、二回目捕食1/5、繁殖1、G1出生1、初回捕食前死亡3。
### S3 nearOversizedPrey
食性適合356、サイズ超過79、サイズ超過率0.2219、有効277、target24、contact1、attack6、捕食成功0、投入個体の初回捕食0/5、繁殖0、G1出生0、初回捕食前死亡5。
### サイズ超過除外率
S0 33.3%、S1 20.8%、S2 11.8%、S3 22.2%。S3は意図的に大型獲物付近へ置いたが、有効獲物も277イベントあり、サイズ超過のみで有効獲物0になる構造ではなかった。
### 餓死直前の周辺獲物
最終診断では `zeroValidWithDietCompatibleStepRate` は S0 0.05、S1 0、S2 0、S3 0。サイズ超過だけで有効獲物0のまま餓死する個体が支配的、という証拠は出なかった。
### サイズ原因の判定
サイズ条件は観測されたが、主要因とは判定しない。S1 nearPrey が最も初回捕食に成功し、S2 nearValidPrey はサイズ超過率が最も低いのに S1 より初回捕食・接触・target が低かった。従って、サイズ上限の硬い除外だけで肉食失敗を説明できない。
### 実装した単独修正
なし。サイズ原因が明確ではないため、飢餓時サイズ許容は実装しなかった。
### 変更した式・数値
捕食可能サイズ比、捕食成功率、速度、感知距離、攻撃距離、繁殖、energy、storeN、storeDなどの生態パラメータは変更なし。既存サイズ判定を共通関数へ移しただけ。
### 変更しなかった項目
捕食可能サイズ比、捕食成功率、捕食energy、捕食時storeN、肉食追跡速度1.08倍、chaseForce、感知距離、接触距離、攻撃距離、攻撃クールダウン、繁殖閾値、繁殖確率、採食・逃走仕様、個体数上限、新生児保護、突然変異率、描画デザイン。
### 変更後の比較
サイズ修正を入れていないため、修正後再試験は実施していない。診断・可視化機能のみ採用。
### 初回捕食への影響
診断条件では S1 nearPrey が初回捕食4/5で最良。サイズを満たす獲物付近へ置いた S2 は2/5で、サイズだけを改善しても入口が必ず改善するとは言えない。
### 二回目捕食とG1への影響
二回目捕食はS2のみ1/5。G1出生はS1で3、S2で1、G1初回捕食は今回の600ステップ窓では未確認。次は二回目捕食とG1初回捕食のファネルが候補。
### 草食・藻場・多様性への影響
サイズ修正なしの診断なので通常生態パラメータへの追加影響はない。代表診断の平均藻量はS0 0.6813、S1 0.6695、S2 0.6800、S3 0.6726。現存種数はS0 26、S1 27、S2 26、S3 20。
### 性能
構文確認、`git diff --check`、ベンチスクリプト構文確認、390x844/1280x720性能スモークを実行。390x844は平均FPS20、update 4.93ms、draw 28.64ms。1280x720は平均FPS19.5、update 4.15ms、draw 34.48ms。診断ベンチ中はヘッドレス描画が重くFPS5相当だがエラーなし。
### 採用判断
診断・可視化機能は採用。サイズ修正は未採用。サイズ超過はボトルネックの一部だが、主要因としては不十分。
### 次のボトルネック
サイズではなく、同じ候補条件でも初回捕食が分かれる理由を追う。候補は、近傍配置後の追跡・接触精度、攻撃解決、二回目捕食までのenergy収支、G1幼体の初回捕食。

## 2026-07-14 01:03 満腹・storeD変更の部分撤回と採食逃走仕様の分離検証
### 背景
直前の統合変更では、満腹時捕食意図、storeD再設計、採食・逃走トレードオフを同時に入れたため、捕食ファネルと多様性が悪化した。

### 統合試験で発生した問題
統合変更後5試行では、接触到達個体3.2、捕食成功経験個体0.8、肉食出生1.6、現存種数11.4、最大種シェア0.614まで悪化した。満腹補正が捕食未経験個体にも広く掛かった可能性が高く、storeD変更も同時に入っていたため原因分離が必要だった。

### 撤回した満腹補正
energy/storeNから一般的な満腹度を作り、捕食意図を0.25倍方向へ下げる `predationSatietyState()` / `predationIntentFor()` と `smoothstepRange()` を削除した。`updatePredationIntent()` と `tryPredate()` は統合前の `dietIntent()` 直呼びへ戻した。試験後の `satietyAppliedSteps` は0。

### 復元したstoreD生成式
平常時storeD生成を `respO * 1.0` から、統合前の `respO * (0.9 + 0.5 * this.genes.diet)` へ戻した。

### 復元したstoreD排泄式
一律排泄 `Math.min(this.storeD, 0.0045)` を撤回し、統合前の `Math.min(this.storeD, 0.0038 + 0.0014 * herb)` へ戻した。

### 削除した捕食時storeD負荷
捕食成功時の `0.035 * (gain / 40)` storeD加算を削除した。捕食時energy、storeN加算 `0.050 * (gain / 40)`、デトリタス処理、捕食成功率は変更していない。

### 維持した採食状態
背景藻を実際に摂食できたときだけ `grazingTimer = 8` を設定する仕様は維持した。

### 維持した採食中速度低下
非逃走中の採食状態では最高速度へ0.90倍を掛ける仕様を維持した。検証用に同一サンプルの適用前/適用後maxSp比を `feedingBehaviorSummary()` へ追加した。

### 維持した逃走中採食中断
逃走中は受動的な藻取り込みと背景藻 `grazeAlgaeAt()` を止め、`grazingTimer` を0へ戻す仕様を維持した。

### 変更していない項目
捕食成功率、捕食可能サイズ、捕食energy、捕食時storeN係数、肉食追跡速度1.08倍、chaseForce、追跡ベクトル、感知距離、接触距離、攻撃距離、繁殖閾値、繁殖確率、En補間、storeN/storeD繁殖倍率、storeO、mem、個体数上限、新生児保護、capacityScore、突然変異率、UI、描画は変更していない。

### 試験条件
`index.html`、390x844、1,800固定ステップ、5試行、デフォルト設定、popMax 120、突然変異率3%、Playwrightヘッドレス。固定シードはなし。

### 採食・逃走の動作確認
逃走中背景藻摂食量は平均0、採食・逃走同時ステップは平均0。採食中maxSp比は草食・雑食とも平均0.90。逃走で `grazingTimer` が解除された回数は草食平均54.2、雑食平均49.0。逃走により中断された藻摂食量は草食平均39.6914、雑食平均24.5162。

### 捕食ファネル
接触到達個体は平均6.0、chase->contact率は平均0.2387、捕食成功経験個体は平均3.0。統合変更後の3.2/0.203/0.8から回復したが、採食・逃走導入前基準Aの9.0/0.315/3.6には届かなかった。

### 肉食個体群
初回捕食前餓死は平均19.8、捕食後閾値到達は平均2.8、捕食後繁殖は平均2.2。肉食出生4.4、肉食死亡25.6、純収支-21.2、終了時肉食0、肉食残存0/5。

### 藻場
平均藻量0.572、平均酸素0.8939、平均デトリタス0.1855。草食全滅は0/5。

### 多様性
現存種数は平均13.0、最大種シェアは平均0.4135。統合変更後の11.4/0.614から改善したが、目標の現存種数18以上、最大種シェア0.40以下には届かなかった。

### storeD分布
現在生存個体のstoreDは草食・雑食・肉食とも平均/中央値/最大が0、storeD>=0.10および>=0.33個体数も0。旧式には戻したが、現行ステップ条件では排泄が生成を上回り、storeDが蓄積しにくい。今回この値は再調整していない。

### 性能
構文確認、`git diff --check`、モバイル/デスクトップ起動、reset、save/load round trip、既存API、`feedingBehaviorSummary()` は成功。FPSスモークは390x844で27fps、1280x800で21fps、エラーなし。

### 採用判断
採食・逃走仕様は暫定採用。状態遷移の不変条件は満たし、捕食ファネルと多様性は統合変更後より回復した。一方で多様性は基準Aまで戻らず、採食0.90倍または `grazingTimer=8` の強さは次回以降に単独で再検証する余地がある。

### 次の候補
次は新機能を足さず、採食・逃走仕様の数値だけを分離する候補。優先候補は、採食中速度倍率0.90を0.94〜0.96へ弱める、または `grazingTimer=8` を短縮する単独試験。storeDは旧式復元後も実測0なので、必要なら別タスクで生成・排泄の桁を診断する。

## 2026-07-14 07:52 開発者個体投入機能と肉食時期別定着試験
### 背景
自然進行では1,800ステップ終了時まで肉食が残らないため、自然発生入口の問題か、成熟した獲物環境へ入れても維持できない問題かを切り分けた。
### 検証する仮説
実測対象は、初期藻優位・草食優位による創始者効果、肉食成体の維持能力、子世代の継続能力、投入時期依存の4点。
### 開発者モードの有効化方法
`?dev=1` のときだけ小型の開発者投入パネルを表示する。通常 URL ではパネル非表示、ホットキーなし、自動投入なし。
### 個体投入API
`window.__alifeDebug.spawnOrganisms(options)` を追加した。`count` は1〜50に制限し、`dietType`、`preset`、`ageMode`、`positionMode`、`energyMode`、`lineageTracking` を受け取る。
### randomプリセット
通常の `geneSet()` に近いランダム遺伝子を使い、指定食性に入るよう `diet` だけを範囲内へ置く。突然変異率や通常初期個体構成は変更していない。
### viableプリセット
通常値域0〜1の中央寄り評価個体。専用の捕食成功、繁殖、死亡耐性ボーナスは付けていない。
### viable肉食の遺伝子値
`speed=0.62, size=0.58, metabolism=0.62, fecundity=0.45, sense=0.66, diet=0.82, formSeed=0.78`。肉食分類で、極端な高速・低代謝・高繁殖個体ではない。
### 年齢とenergy設定
本試験は `ageMode=mature`、`age=240`、`protect=0`。`standard energy` は `reproThreshold * 0.82` で、viable肉食は `reproThreshold=82.5`、energy比0.82。
### 投入位置
`random` はフィールド内のランダム分散、`center` は中央近傍分散、`cursor` はdev時の最後のクリック座標がある場合のみ使用し、なければ中央分散へフォールバックする。
### 投入バッチID
投入ごとに `batch-N` を付与し、最大32バッチを保持する。
### 系統ラベルの継承
投入個体に `devInjected`, `devInjectedLineage`, `injectionBatchId`, `injectionStep`, `injectionGeneration`, `injectionAncestorId` を付与し、子には親の投入バッチと世代+1を継承する。
### セーブ・ロード対応
個体ID、投入系統ラベル、投入バッチ、環境グリッド状態を `ALIFE2:` セーブに含めた。古いセーブでは存在しない項目を無視して復元する。
### 投入系統テレメトリ
`window.__alifeDebug.injectionLineageSummary(options)` を追加。投入個体、generation 1、generation 2、generation 3以上の生存、初回捕食、二回目捕食、繁殖、死因、存続時間を返す。
### スナップショット比較方法
`captureTestSnapshot(name)` / `restoreTestSnapshot(name)` を追加。devモード専用のメモリ内スナップショットで通常セーブスロットは使わない。乱数状態は保存していないため完全決定論ではない。
### 試験条件
`index.html?dev=1`、390x844、popMax 120、突然変異率3%、各条件1,800固定ステップ。step 300/600/900 の同一スナップショットから対照と viable mature carnivore 5体投入を実行した。
### step 300の環境と結果
投入時環境: 個体56、草食22、雑食16、自然肉食18、平均藻量0.374、現存種35、最大種シェア0.196、占有率0.467。対照終了: 肉食0、接触1、捕食成功1、肉食出生0、現存種12、最大種シェア0.437。投入終了: 定着レベル0、投入個体初回捕食0、繁殖0、全5体餓死、系統存続235ステップ、肉食0、現存種8。
### step 600の環境と結果
投入時環境: 個体87、草食43、雑食39、自然肉食5、平均藻量0.556、現存種18、最大種シェア0.414、占有率0.725。対照終了: 肉食0、接触3、捕食成功1、肉食出生2、現存種12。投入終了: 定着レベル1、投入個体初回捕食1、二回目捕食0、繁殖個体1、generation 1出生1、generation 1捕食0、generation 2出生0、全投入個体は餓死、系統存続270ステップ、終了時肉食0。
### step 900の環境と結果
投入時環境: 個体126、草食64、雑食60、自然肉食2、平均藻量0.628、現存種16、最大種シェア0.389、占有率1.05、直近過密死22。対照終了: 肉食0、捕食成功0。投入終了: 定着レベル0、投入個体初回捕食0、繁殖0、投入5体は過密死、系統存続126ステップ、終了時肉食0。
### 投入時期別比較
300は餓死、600は成体1体が捕食・繁殖したが子世代が途切れ、900は個体数上限圧で侵入不能だった。
### 初回捕食
投入個体の初回捕食成功は 300=0/5、600=1/5、900=0/5。
### 二回目捕食
全時点で二回目捕食成功は0。
### generation 1
generation 1は600投入だけ1体出生したが、初回捕食0、繁殖0。
### generation 2
全時点で generation 2 は0。
### 過密淘汰の影響
900投入では投入直前個体数が126で emergencyLimit 付近、投入5体すべてが過密死。後期環境では獲物以前に侵入余地がない。
### 草食・藻場・多様性への影響
投入条件でも草食全滅なし。平均藻量は各条件0.641/0.646/0.661。現存種は投入条件で8/11/10となり、対照12/12/12よりやや低かった。
### 定着レベル
step300=レベル0、step600=レベル1、step900=レベル0。重要目標のレベル2には未到達。
### 初期環境仮説の判定
成熟した生態系への投入でもレベル2に届かなかったため、初期藻優位だけでは説明できない。600では成体が一時的に捕食・繁殖できたので、完全に成体能力ゼロではない。
### 開発者機能の採用判断
採用。通常モード非表示、任意投入、系統追跡、save/load、スナップショット比較が動作し、通常生態パラメータは変更していない。
### 次の開発候補
次は「投入成体の二回目捕食前餓死」と「generation 1の初回捕食失敗」を分けて診断する。候補は、まず二回目捕食までのenergy時系列と肉食児の初回捕食ファネル。
## 2026-07-14 12:50 マイクロ生態実験基盤とenergy時間尺度の検証
### 背景
既存の `runPredationDuel()` と6面観察スタジアムでは、サイズ・速度・逃走行動による1対1捕食の可否は確認できる。一方、自然環境で肉食が二回目捕食やG1定着へ進めない原因が、捕獲能力なのか、無摂食寿命・追跡消耗・一食の価値なのかは分離できていなかった。
### 既存Predation Duelの構造
既存の duel は通常世界を `capture()` で退避し、実験用に個体・餌・死骸・プランクトンをクリアして、捕食者1体と獲物1体を実際の `Organism.step()` と `tryPredate()` で実行する構造だった。今回はこの退避・復元、制御個体生成、trace記録を再利用した。
### runMicroScenarioへの一般化
`window.__alifeDebug.runMicroScenario(options)` を追加した。世界退避、参加個体生成、実験環境設定、step実行、observer集計、stop condition、trace記録、世界復元を共通化し、単独個体・2個体シナリオを扱えるようにした。
### 既存API互換性
`runPredationDuel()`, `predationDuelSummary()`, `generatePredationStadium()`, `predationStadiumSummary()` は維持した。既存の速度・サイズ・行動・距離プリセットは従来通り duel を内部実行する。
### 参加個体テンプレート
`controlled-herbivore`, `controlled-omnivore`, `controlled-carnivore`, `viable-carnivore`, `controlled-prey` を追加した。controlled系は `speed=0.62, size=0.58, metabolism=0.62, fecundity=0.45, sense=0.66, formSeed=0.78` を共有し、dietだけを `0.22/0.50/0.82` に変えた。
### 実験環境
`foodMode=none/controlled-prey/scheduled-prey`, `algaeMode=none`, `reproductionEnabled=false`, `capacityEnabled=false`, `corpseEnabled=false` を扱う。絶食試験では food と藻を消し、繁殖と個体数上限影響を止める。
### 行動モード
`stationary`, `normal`, `wander`, `straightMove`, `flee`, `chase`, `straightEscape` を実験専用に扱う。`stationary` は実験中だけ速度と位置更新を止め、通常の基礎energy処理は維持する。`chase` は実際の有効獲物を配置し、通常のターゲット取得と追跡を使う。
### stop condition
`subjectDead` と `{type:'maxSteps', value:N}` を基本にした。今回の正式試験は最大3000step、死亡まで実行。
### observer構造
`energyBudget`, `movement`, `lifespan`, `predation` を返す。traceは一般形式の `participants/events/observerFrame` と、既存スタジアム互換の `predator/prey` 形式を併置した。
### energyBudgetの計測方法
実験対象個体だけ、実際のenergy変更位置で `microRecordEnergyFlow()` を呼ぶ。通常コストは `this.energy -= totalCost` の位置で `basalOrRespirationCost`, `movementCost`, `senseCost`, `densityCost` に分類し、捕食成功時は `attackCost` と、clamp後に実際に反映された `predationGain` を記録する。藻・餌粒・死骸・プランクトンの主要gain位置にもフックを追加した。
### energy会計の一致
正式20反復で平均 reconciliation error は最大でも約 `1.34e-12`。`startEnergy + totalGain - totalLoss ~= endEnergy` は成立した。
### 絶食寿命試験条件
`starvation-lifespan` を20反復、最大3000stepで実行。食物なし、藻なし、繁殖なし、個体数上限影響なし。代表traceのみ保存。
### 草食の静止・移動結果
草食静止は平均240.0step、energy消費28.222/100step、移動距離0。草食normalは平均244.7step、27.711/100step、移動距離61.3。
### 雑食の結果
雑食normalは平均243.7step、27.819/100step、移動距離58.2。
### 肉食の静止・移動・追跡結果
肉食静止は平均236.0step、28.731/100step、移動距離0。肉食normalは平均241.9step、28.011/100step、移動距離56.3。肉食chaseは平均241.0step、28.175/100step、移動距離105.6、target保持241step、捕食0。
### 食性間比較
同一controlled遺伝子では、食性差は数step程度。食物なし条件で肉食だけが極端に短寿命になる証拠は出なかった。
### 一食の価値試験
`single-meal-value` を20反復、最大3000stepで実行。M0は獲物なし、M1は小型静止獲物1体。実験用 `low` energy は繁殖閾値の0.62倍とした。これは通常ゲームのstandard energyではなく、初回捕食試験用の開始条件。
### 捕食1回の追加生存時間
M0は平均181.0step。M1全反復は平均467.1step、捕食成功12/20。捕食成功反復だけでは平均658.6step、中央値659.5、M0比で平均+477.6step。失敗反復は平均180.0step。
### 二回目獲物遅延試験
`second-meal-delay` を20反復、最大3000stepで実行。初回捕食成功後に二回目の静止小型獲物を感知範囲内・接触距離外へ配置した。
### 二回目捕食成功率
二回目なしは初回18/20、二回目0/20。+30は初回16/20、二回目15/20。+60は14/20、13/20。+120は16/20、14/20。+180は14/20、12/20。+240は14/20、14/20。攻撃乱数の影響で単調ではないが、静止小型獲物が出るなら+240でも二回目捕食は成立した。
### 6面観察ラボの追加プリセット
既存「捕食比較」に加え、`食べずにどれだけ生きる？` と `一度の食事でどれだけ延びる？` を追加した。後者は食事なし、1回捕食、二回目獲物+30/+60/+120/+240を6面で同期再生する。
### ゲーム全体の餓死時間評価
食物なし寿命はstandard energyで約236〜245step、low energyで約181step。自然投入肉食が200〜300step程度で消える実測と整合する。ゲーム全体のenergy時間尺度は短いが、今回のcontrolled比較では肉食固有の無摂食寿命ペナルティは小さい。
### 基礎代謝・移動・追跡の評価
代表traceでは肉食chaseのloss 67.90の内訳は base 52.04、move 1.54、sense 14.32、chaseタグ67.90。移動コスト単体は小さく、基礎・感知コストが大半。chaseは同じ総消費を追跡状態で使い切っている。
### 捕食利益の評価
M1代表成功traceでは start 51.15、predationGain 131.92、attackCost 6.02、totalGain 131.92、totalLoss 183.25。捕食1回に成功すれば生存時間は大きく伸びる。したがって一食の価値が極端に小さいとは判断しない。
### 今回変更しなかった生態パラメータ
基礎代謝、energy最大値、standard energy、捕食gain、捕食時storeN、storeD、移動コスト、追跡コスト、追跡速度1.08倍、chaseForce、ターゲット選択、捕食成功率、サイズ条件、感知距離、接触距離、攻撃距離、繁殖、藻量、藻成長、採食仕様、個体数上限、通常初期条件は変更していない。
### 次に変更すべき一項目
次はenergy量そのものではなく、自然環境で「二回目に捕食可能な獲物へ到達できるか」を切るべき。制御実験では静止小型の二回目獲物なら+240でも成立したため、自然環境側のターゲット選択、捕獲不能獲物の早期放棄、または二回目捕食までの獲物発見条件が候補。
### 性能
正式ベンチ `scripts/alife_micro_scenario_benchmark.cjs --pack all --repeats 20 --max-steps 3000` は完走。追加trace履歴は代表trace中心で有限化。通常ゲームの生態パラメータは変更なし。
### 採用判断
`runMicroScenario()`、実験パック、energy observer、観察ラボ生命維持プリセット、ベンチスクリプトは採用。今回の結果から、次タスクで数値を変えるなら「捕食gain」より先に、二回目捕食の探索・選択・追跡成立条件を一項目ずつ検証する。
## 2026-07-14 19:20 1対1追跡運動学と速度比境界の診断
### 背景
直前の1対1捕食実験では、獲物/捕食者の名目速度比0.623で target は100%取得する一方、contact 0%、energyDepleted となっていた。名目上は捕食者の追跡最高速度0.621、獲物速度0.387で差があるため、実速度、射影速度、energy低下、初期条件を分離して診断した。
### 直前の推論修正
実験APIの `initialDistance:45` は、実際には `contactDistance * 2.5` の下限で55.42へ引き上げられていた。これは今回の距離制御試験の意図と違うため、実験専用配置だけを「接触距離の外側」まで下げ、通常生態パラメータは変更せず再測定した。旧条件の明示再現として `initialDistance=55.42` では速度比0.623 current escape が contact 0/20、energyDepleted 20/20となった。
### 現行の捕食者移動処理
`Organism.step()` は各stepで場効果、近傍分離、社会steer、`updatePredationIntent()` を実行し、最後に速度上限でclampして `x += vx; y += vy` する。全体dampingは基本なく、休眠・待ち伏せ・群れなど状態別に限定的な速度乗算がある。
### 現行の獲物逃走処理
通常の獲物は捕食者追跡中に `prey.vx += (dx/d)*0.18*fleeMul; prey.vy += ...` を受け、`fleeTimer` が立つ。実験の current straightEscape はこの通常逃走impulseを受けた後に、獲物velocityを逃走方向の最高速度へ直接上書きする。
### straightEscapeの実装
`straightEscapeCurrent` は毎step、獲物 `vx/vy = 逃走方向 * preyMaxSpeed` として即時最高速度にする。`straightEscapeIntegrated` は比較用の実験専用方式で、通常の逃走forceとvelocity clampを通す。`constantVelocityEscape` は一定速度標的の対照であり、通常ゲームには使わない。
### 速度比の正確な定義
従来表示の速度比は `preyStartSpeed / predatorStartSpeed`。分子は獲物の逃走時effective max speed、分母は捕食者の追跡時effective max speedで、chase 1.08とflee 1.35は含むが、step中の低energy `desired *= 0.55` は初期表示値に含まれない。
### 追跡最高速度の適用位置
追跡速度1.08倍は `maxSpBeforeGrazing = maxSpeed * desired * fleeBoost * burstBoost * worldEvent.speedMul * spBias * localSpeedMul * carnivoreChaseSpeedMul` の `carnivoreChaseSpeedMul` として速度clamp直前に適用される。
### force・加速・damping
追跡forceは `chaseForce=(0.070 + 0.105*carn + 0.065*intent)*packBonus` をターゲット方向へ直接 `vx/vy` 加算する。速度は数stepで上限近くへ到達し、0.623代表では捕食者90%到達stepは3、獲物は1。dampingが主因という証拠はない。
### energyによる運動補正
獲物が十分遠く、`nearest` がない状態で `energy < reproThreshold*0.45` になると `desired *= 0.55`。0.623代表ではenergyが約33台に落ちたstep120で捕食者effective maxが0.318まで下がり、獲物0.387を下回った。
### pursuitKinematics observer
`pursuitKinematics` observerを追加し、捕食者・獲物の実速度、effective max speed、speed fraction、force、energy、射影速度、実測接近速度、理論接近速度、closing efficiency、距離微分誤差を記録する。`runPredationDuel()`, `runMicroScenario()` 互換で使える。
### 射影速度と実測接近速度
速度比0.623・実距離45の平均は捕食者実速度0.471、獲物0.388、捕食者射影0.470、獲物射影0.388、実測接近速度0.083。方向成分はほぼ接近に使われており、横滑り・旋回が第一原因ではない。
### 距離微分の整合性
0.623旧条件の closing reconciliation error は約 `1.4e-5`。radial relative velocity と実測distance deltaはほぼ一致し、ラップ境界や距離微分の不整合は主因ではない。
### 速度境界0.40〜0.70
実距離45、current escape、20反復。0.40: contact100%, success70%。0.45: contact100%, success90%。0.50: contact100%, success80%。0.55: contact100%, success75%。0.60: contact100%, success35%。0.623: contact100%, success15%。0.65: contact0%, success0%。0.70: contact0%, success0%。接触境界は0.623と0.65の間。
### 初速条件比較
速度比0.623では I1 zero/zero success20%、I2 predator zero/prey max success25%、I3 max/max success40%、I4 max/zero success15%、I5 normal-cruise success20%。初速だけで失敗は説明できず、捕食者をmax開始にすると改善するが完全解決ではない。
### current/integrated escape比較
速度比0.623では current success30%、integrated success30%、constant velocity success50%。currentだけが異常に有利という証拠は弱い。逃走統合方式より、必要距離とenergy時間の影響が大きい。
### 初期距離比較
実験配置を修正後、15は接触外の安全距離へclampされ、25/35/45/60は実距離として使用。速度比0.623 integratedでは、15: success95%、25: 90%、35: 80%、45: 25%、60: 0%。接触可否は初期距離に強く依存する。
### energy条件比較
速度比0.623 current、実距離45。low は contact0%、standard は contact100%/success40%、full は contact100%/success75%、2x standard は contact100%/success65%。energyを増やすと接触・成功が回復するが、これは通常パラメータ変更ではなく診断条件。
### constant-energy診断
速度比0.623、実距離45、constant-energyでは contact100%、success75%。通常energyでは低energy速度低下と寿命不足が絡む。energy固定でも平均closingが極端に大きいわけではなく、長く追えることで接触・攻撃まで届く。
### 加速試験
integrated escape、距離60。速度比0.40は contact100%、success85%。速度比0.623は contact0%、energyDepleted20/20。捕食者は3step前後で90%速度へ達するため、加速不足単独ではなく、距離60で必要な追跡時間がenergy予算を超えることが支配的。
### 方向効率
0.623の実距離45では捕食者実速度0.471に対し射影速度0.470、closing efficiencyは概ね高い。速度は獲物方向へ使われており、追跡ベクトル・旋回・慣性の非効率は第一原因ではない。
### 理論捕獲時間と実測
旧55.42条件では接触距離22.17、開始距離55.42、初期理論捕獲stepは約142。しかし実測予測捕獲stepは約316で、energy切れは約239step。実測接近速度が遅く、さらに後半は低energy速度低下で接近速度が負になる。
### 速度比0.623で接触できない主要因
旧来のcontact 0%は、実験距離が45ではなく55.42へclampされていたことが直接の再現条件。そこに `energy < reproThreshold*0.45` で捕食者effective maxが獲物速度を下回る低energy速度低下が重なり、接触前にenergyDepletedになる。実距離45ならcontactは100%まで回復する。
### 否定された仮説
速度上限へ到達していない仮説は弱い。捕食者は90%上限へ約3stepで到達し、speed fractionは概ね0.99。current escapeだけが非対称で主因という仮説も弱い。ラップ・距離計算不整合、方向効率不足も主因ではない。
### 次に変更すべき一項目
通常ゲーム修正はまだ行わない。次タスクで一項目だけ変えるなら、まず「追跡中にenergy低下でdesired 0.55が発動する条件」または「低energy時の追跡継続/放棄」を分離するのが妥当。速度上限やchaseForceを直接上げる前に、低energy速度低下が接触直前の追跡を壊すか検証する。
### 今回変更しなかった生態パラメータ
捕食者最高速度、追跡1.08、chaseForce、逃走force、damping、移動統合、追跡ベクトル、target選択/放棄、捕食サイズ、接触距離、攻撃距離、成功率、energy消費、基礎代謝、standard energy、捕食gain、感知距離、繁殖、個体数上限、藻場、通常行動は変更していない。
### 性能
`scripts/alife_pursuit_kinematics_benchmark.cjs --pack all --repeats 20 --max-steps 600` は完走。正式実行は約24秒。observer無効時の通常ゲームへ追加計算を入れず、traceは代表反復と有限履歴に限定した。
### 採用判断
運動学observer、初速指定、integrated/current/constant escape比較、constant-energy診断、pursuit-kinematics pack、観察ラボ「なぜ追いつけない？」プリセットを採用。通常生態パラメータの変更は保留。

## 2026-07-14 16:52 contact後失敗と低energy速度補正の確認
### 目的
contact率100%の条件で捕食成功率が低い理由が、接触後の低energy速度補正によるものかを確認した。
### 実装した診断
既存Duelに、contact時energy、attack試行回数、contact後の生存step、contact維持step、低energy速度補正発動step、低energy速度補正抑制step、contact後の距離再拡大を追加した。通常ゲーム値は変更せず、実験中だけ `disableLowEnergySpeedPenalty` で低energy速度補正を抑制できるようにした。
### 試験条件
速度比0.623、実距離45、`straightEscapeCurrent`、初速zero/zero、最大600step、20反復、seed 62345。現行条件と、実験中だけ低energy速度補正を無効化した条件を比較した。
### 現行条件
contact 20/20、success 2/20、success率0.10、平均contact時energy 38.25、平均attack試行1.00回、平均contact維持7.1step、平均contact後生存120.1step、低energy速度補正の初回発動は平均step108、発動step平均117.0、contact後の距離再拡大18/20、energyDepleted 18/20。
### 低energy速度補正無効条件
contact 20/20、success 14/20、success率0.70、平均contact時energy 38.28、平均attack試行2.85回、平均contact維持69.3step、平均contact後生存72.0step、低energy速度補正発動0、抑制step平均68.8、contact後の距離再拡大3/20、energyDepleted 6/20。
### 判定
contact時energyは両条件でほぼ同じだが、補正無効時はattack試行回数が約2.85倍、contact維持stepが約9.8倍、success率が0.10から0.70へ上昇し、energy切れが18/20から6/20へ減少した。contact後に低energy速度補正が発動し、獲物速度を下回って距離が再拡大し、追加attack機会を失うことが主要因と判定した。
### 今回変更しなかった項目
通常ゲームの低energy速度補正、追跡速度、chaseForce、逃走速度、接触距離、攻撃距離、捕食成功率、energy消費、捕食gain、target選択/放棄は変更していない。

## 2026-07-14 低energy速度補正の連続化
### 変更前の問題
低energy時の速度補正が `energy < reproThreshold * 0.45` を少し下回った瞬間に `desired *= 0.55` へ落ちる不連続な式だった。直前診断では、contact後にこの補正が発動すると距離が再拡大し、attack機会とsuccess率が大きく落ちることを確認した。
### 新しい連続補正式
閾値 `reproThreshold * 0.45` と最低倍率 `0.55` は維持し、`ratio = clamp(energy / lowEnergyThreshold, 0, 1)`、`lowEnergySpeedMul = 0.55 + 0.45 * ratio`、`desired *= lowEnergySpeedMul` へ置換した。
### Duel20反復結果
速度比0.623、実距離45、standard energy、20反復。contact 20/20、success 18/20、平均attack 2.65回、contact維持57.75step、contact後距離再拡大1/20、energyDepleted 2/20、contact時energy 38.21。低energy倍率は平均0.851、最小0.551、最大0.998で、閾値直下から連続的に下がり、0.55付近まで滑らかに低下した。
### 旧現行・補正無効との比較
旧現行は success 2/20、平均attack 1.00回、contact維持7.1step、距離再拡大18/20、energyDepleted 18/20、contact時energy 38.25。補正無効は success 14/20、平均attack 2.85回、contact維持69.3step、距離再拡大3/20、energyDepleted 6/20、contact時energy 38.28。連続補正は旧現行から明確に改善し、補正無効よりsuccessとenergy切れは良いが、attack回数とcontact維持は補正無効より低く、低energy時の弱体化は残った。
### 通常世界3試行の結果
390x844で各600step。3試行とも起動・進行・save/load round trip成功、page errorなし。終了時個体数は各64、現存種数は60/60/57、FPS表示はいずれも60で、明確な性能悪化はなかった。
### 採用判断
採用。success率90%、平均attack 2.65回、contact維持57.75step、距離再拡大5%で採用目安を満たした。補正無効より良い指標も出たが、今回は追加調整せず、低energy速度急落の不連続除去だけを採用する。
## 2026-07-14 20:01 単独捕食サイズ上限1.8と大型獲物成功率ペナルティ
### 変更前の問題
単独捕食は `prey.size < predator.size` が実質的なhard gateで、自分と同サイズ以上の獲物を候補から完全除外していた。群れ狩りはtarget側1.12倍、attack側1.13倍で判定が分かれていた。
### 新しいサイズ判定
`rawSizeRatio = prey.size / predator.size`、`effectiveSizeRatio = prey.size / (predator.size * packSizeMultiplier)` を共通化し、target判定とattack判定を `effectiveSizeRatio <= 1.8` に揃えた。単独上限はraw 1.8、既存pack倍率1.12ではraw 2.016まで候補化できる。
### 大型獲物成功率ペナルティ
`challengeRatio = clamp((effectiveSizeRatio - 1.0) / 0.8, 0, 1)`、`smoothChallenge = challengeRatio^2 * (3 - 2 * challengeRatio)`、`largePreySuccessMul = 1.0 - 0.80 * smoothChallenge` を既存attack成功確率に追加した。effective 1.0で1.00、1.4で0.60、1.8で0.20。
### Duel単独サイズ系列
20反復、viable carnivore、stationary prey、速度比0、初期距離25、standard energy。サイズ0.70はtarget/contact/attack 20/20、success 17/20。1.00は20/20、10/20。1.20は20/20、11/20。1.40は20/20、5/20。1.60は20/20、4/20。1.80は20/20、7/20。1.81はtarget/contact/attack 0/20、sizeRejected 20/20。
### 群れ比較
packSizeMultiplierは1.12、raw上限は2.016。単独では1.90、2.00、2.10がsizeRejected 20/20。群れでは1.60、1.80、1.90、2.00がtarget/contact/attack 20/20、2.10がsizeRejected 20/20。群れsuccessは1.60が8/20、1.80が2/20、1.90が3/20、2.00が11/20で、20反復の乱数揺れはあるが1.8超の候補化とeffectiveSizeRatio低下は確認した。
### 通常世界3試行
390x844、各1,800step。page errorなし、NaNなし、save/load round trip成功。1.0超から1.8までの大型attemptは試行1/2/3で56/228/46、successは0/16/2。単独1.8超attemptとsuccessはいずれも0。pack 1.8超attemptは試行2で2件、success 0。終了時肉食は全試行0、草食118/42/122、雑食2/81/1、平均藻量0.656/0.584/0.691、capacity死213/67/233。明確な大量絶滅、NaN、ページエラーはなかった。
### 採用判断
採用。単独1.8までは挑戦可能、1.8超は単独拒否、群れでは既存pack倍率に応じて1.8超も対象化できる。サイズ差による成功倍率は連続低下し、target判定とattack判定の不一致も解消した。success率は20反復では揺れるため、今回追加調整は行わない。
## 2026-07-14 20:32 大型獲物の連続確率化と群れ体格合算
### 旧1.8 hard gate
単独捕食は effectiveSizeRatio <= 1.8、群れは固定 packSizeMultiplier 1.12 により raw 約2.016まで、というサイズ由来のhard gateだった。大型獲物成功率も1.0超から1.8までの専用 `largePreySuccessMul` に分かれていた。
### 新しいサイズ成功曲線
サイズだけではtarget/attackを拒否しないようにし、`getPredationSizeSuccessMul(effectiveSizeRatio)` へ統合した。effective 2.0以下は1.00、2.0から3.0はsmoothstepで1.00から0.50へ低下、3.0超は `0.50 * 0.63^(effectiveSizeRatio - 3.0)` で漸減する。
### helper寄与係数0.53
固定1.12のサイズ補正はサイズ判定から外し、既存hunt-packとして有効な仲間だけを `PACK_HELPER_SIZE_CONTRIBUTION = 0.53` で加算する。近くの全肉食者ではなく、同種かつhunt-pack/packロールで既存pack範囲内の生存個体だけをeligible helperにした。
### 群れの実効捕食サイズ
`effectivePredatorSize = predator.size + 0.53 * eligibleHelperSizeSum`、`rawSizeRatio = prey.size / predator.size`、`effectiveSizeRatio = prey.size / effectivePredatorSize`。target候補、attack、attack成功率内のサイズ倍率は同じeffectiveSizeRatioを使用する。
### 単独式確認
決定論的確認ではサイズ倍率は1.0=1.000、2.0=1.000、2.5=0.750、3.0=0.500、4.0=0.315、5.0=0.198、6.0=0.125。3.0超でもsizeRejectedは発生しなかった。
### 2体・3体・4体群れの式確認
rawサイズ比5.0で、単独はeffective 5.000・倍率0.198、主+仲間1体はeffective 3.268・倍率0.442、主+仲間2体はeffective 2.427・倍率0.804、主+仲間3体はeffective 1.931・倍率1.000。設計基準と一致した。
### Duel結果
単独Duel各10反復、stationary prey、速度比0、距離25、standard energy。raw 1.0/2.0/2.5/3.0/4.0/5.0/6.0はいずれもtarget/contact/attack 10/10、sizeRejected 0。successは4/10、7/10、5/10、6/10、4/10、2/10、0/10で、実測successは乱数で揺れたがsizeSuccessMulは単調に低下した。
### 群れDuel結果
rawサイズ比5.0、各10反復。単独はhelper 0、effective 5.000、倍率0.198、success 0/10。仲間1体はhelper 1、effective 3.268、倍率0.442、success 1/10。仲間2体はhelper 2、effective 2.427、倍率0.804、success 7/10。仲間3体はhelper 3、effective 1.931、倍率1.000、success 7/10。
### 通常世界3試行
index.htmlで390x844、各1,800step。page errorなし、NaNなし、save/load round trip成功。rawサイズ比別attemptは試行1が<=2:50、2-3:1、3-5:3、5超:0、試行2が<=2:312、2-3:64、3-5:7、5超:0、試行3が<=2:639、2-3:12、3-5:1、5超:0。successは<=2で6/23/76、2-3で0/3/1、3-5で0/1/0。5超attemptはなく、3試行では群れ大型attemptも観測されなかった。終了時肉食はいずれも0、草食120/84/91、雑食0/42/30、平均藻量0.523/0.537/0.585。明白な大量絶滅・NaN・ページエラーはなかった。
### 採用判断
採用。単独2.0までサイズ倍率1.0、3.0で0.5、3.0超の漸減、3体群れraw 5.0で約0.80、旧固定1.12サイズ補正の非重複、target/attackのサイズ基準一致を確認した。通常世界では極端な大型追跡の大量発生は見えなかったため、長期生態評価は次タスクで扱う。
## 2026-07-14 21:07 待ち伏せ捕食者の空腹時追跡開始距離
### 修正前診断
既存predation individual telemetryへ `role`, `ambushHoldSteps`, `ambushHoldWithValidTargetSteps`, `targetDistanceRatio`, 餓死前120stepのambush hold、餓死時の有効target有無を追加した。修正前3試行、390x844、各1,800stepでは、ambusher starvation deaths 15、うち有効target保持15、確認条件「有効targetあり、餓死前120step中ambushHoldWithValidTarget 60step以上」は8例。餓死前120stepの平均holdは約63.9stepで、仮説を確認済みと判断した。
### 変更した式
待ち伏せ分岐の固定 `this.senseR * 0.55` を、空腹度に応じた `ambushTriggerScale = 0.55 + 0.45 * clamp((reproThreshold * 0.75 - energy) / max(reproThreshold * 0.30, 0.001), 0, 1)` に置換した。energy >= 0.75閾値では従来どおり0.55、energy <= 0.45閾値では感知範囲内なら待たずに追う。
### 修正後3試行
同条件3試行では、ambusher starvation deaths 14、有効target保持14、確認条件該当は1例。餓死前120stepの平均holdは約14.1stepまで低下した。ambusher tracking started は21から16、contact は3から2、捕食成功は0から0。終了時肉食はいずれも0。
### 検証
inline script構文、`organism_render.js`構文、`git diff --check`、修正前3試行、修正後3試行、save/load round trip、page errorなし、NaNなしを確認した。
### 採用判断
採用。短時間試験ではambusherのcontact/捕食成功は増えなかったが、有効targetを保持したまま長時間待ち続けて餓死するケースが8例から1例へ減り、待ち伏せ戦略を維持しつつ空腹時に能動追跡へ移る目的を満たした。
## 2026-07-14 21:43 追跡中ambusherの移動先なし判定修正
### 原因
`preyTarget` を実際に追跡しているambusherでも、通常餌・死骸側の `nearest` は `null` のままだった。そのため有効獲物へchaseForceを加えた直後に、無目的個体向けの `vx/vy *= 0.92`、`desired *= 0.35`、rest、random wander が重ねて適用されていた。
### 状態分離
`updatePredationIntent()` の各step開始時に `_ambushHoldingThisStep` と `_predationChasingThisStep` をリセットするようにした。待ち伏せ分岐へ入ったstepだけ `_ambushHoldingThisStep=true`、実際に獲物方向へchaseForceを加える直前だけ `_predationChasingThisStep=true` を設定する。
### 外した誤適用
実追跡中のambusherから、無目的時の `vx/vy *= 0.92`、`desired *= 0.35`、rest開始・rest速度制限、random wander を外した。待ち伏せhold中と無目的時は従来の低速挙動を維持した。
### 維持した低energy補正
連続的な低energy速度補正は、実追跡中にも適用されるまま維持した。通常餌へ向かう `nearest` あり個体の既存挙動を変えないため、低energy補正の対象は従来の `!nearest` と実追跡中に限定した。
### Micro Scenario結果
`ambusher-pursuit-diagnostic` で、空腹ambusher、stationary草食、距離45、最大300stepを実行。active chase 91step、ambush hold 0step、0.92追加減衰0step、0.35適用0step、rest適用0step、random wander 0step、low-energy補正91step。step 91でcontactと捕食成功に到達した。
### 通常世界前後比較
390x844、同一3乱数列、各1,800step。旧挙動はtracking 15、contact 4、success 2、tracking→contact 26.7%、active chase平均速度0.113、平均effective max 0.114、追跡中0.35適用3,046step、rest 2,869step、random wander 21,843step、0.92減衰3,046step。修正版はtracking 18、contact 7、success 3、tracking→contact 38.9%、active chase平均速度0.459、平均effective max 0.477、追跡中0.35/rest/random/0.92はいずれも0step。low-energy補正は23,244stepで維持された。
### 待ち伏せ餓死への影響
短時間3試行ではambusher starvation deathsは旧12から修正後11へわずかに減少した。終了時肉食は旧3試行合計1、修正後0。今回の採否は、追跡状態の誤判定解消とtracking→contact改善を主指標にした。
### 採用判断
採用。待ち伏せ中の静止は維持し、実追跡中だけ無目的遊泳処理を外せた。Micro Scenarioでcontact/successに到達し、通常世界でもtracking→contactと実追跡速度が明確に改善した。page error、NaN、save/load異常はなし。

## 2026-07-14 22:49 感知範囲外target解除と近距離獲物再評価
### 原因
preyTargetId は死亡・保護・同種などの無効化では解除されていたが、距離がtarget有効性に含まれていなかった。そのため感知範囲を大きく外れた古い獲物を保持し、近くの獲物を再探索せず、さらに範囲外の獲物へ逃走刺激を与えていた。

### 変更
捕食探索距離を predationScanRadius() に共通化した。target が scanR * 1.25 を24連続step超えた場合に distanceExceeded として解除し、同じstepの既存scanで新targetを探せるようにした。target保持中も nextPreyScan 間隔で再評価し、bestDistance <= currentDistance * 0.65 または bestScore >= currentScore + 0.20 かつ bestDistance <= currentDistance * 0.90 の場合だけ targetChanged で切り替える。獲物への predatorThreatId / flee impulse は d <= scanR * 1.05 の場合だけ適用する。

### Micro Scenario
A release-switch: outOfRangeSteps 24, distanceExceeded 1, remoteFleeStimulusSteps 0, Aへの範囲外逃走刺激なし, Bへcontact/attack/success到達。
B temporary-return: 範囲外10stepでは解除なし, target維持, outOfRangeSteps final 0。
C ambush-hold: scanR * 1.10以内の通常待ち伏せは距離解除なし, ambushHoldSteps 70, 空腹による既存追跡移行は維持。

### 通常世界3 seed前後比較
旧挙動: tracking 419, contact 864, success 107, distanceExceeded 0, targetChanged 0, 範囲外target保持 988step, 範囲外逃走刺激 1067step, ambusher餓死14, 有効target保持餓死14, 終了時肉食 0/0/0。
修正版: tracking 1536, contact 906, success 144, distanceExceeded 1, targetChanged 156, 範囲外target保持 31step, 範囲外逃走刺激 0step, ambusher餓死16, 有効target保持餓死15, 終了時肉食 0/1/0。

### 採用判断
採用。永久target固定と遠隔逃走刺激は解消し、短期範囲外targetと通常ambush holdは維持された。tracking/contact/successに重大な悪化はなく、page error・NaN・save/load異常なし。ただし短時間試験ではambusher餓死そのものは改善していないため、次はtargetChanged後の実追跡距離やambusherの獲物選択を別タスクで見る。

## 2026-07-15 08:25 待ち伏せ捕食者の遠距離接近で獲物を逃がさない
### 変更前の問題
ambusher は空腹時に待ち伏せholdを抜けて active chase へ移行しても、従来の `scanR * 1.05` 条件により、バースト圏外から獲物へ `predatorThreatId`、逃走impulse、`fleeTimer`、`motionLevel` を与えていた。低速で接近中の段階から獲物を逃がすため、target保持・追跡中でもcontactへ進みにくい可能性があった。
### 変更した条件
逃走刺激距離だけを変更した。非ambusherは従来どおり `scanR * 1.05`、ambusherだけ `this.senseR * CONFIG.ecology.predatorBurst.triggerSenseScale` を `preyAlertRange` とし、`d <= preyAlertRange` の場合だけ獲物へ逃走刺激を与える。`ambushTriggerScale`、chaseForce、burst距離、burst倍率、低energy補正、獲物逃走impulse、attack、energy gainなどは変更していない。
### Micro確認
A: ambusherをバースト圏外かつactive chase範囲内に置くと、activeChase 12step、ambushHold 0step、alertOutsideBurst 0step、距離は89.02から82.29へ縮小した。B: バースト圏内ではactiveChase 12step、alertInsideBurst 12step、firstAlertStep 1、firstBurstStep 1。C: 非ambusherでは従来どおりscan範囲内でalertOutsideBurst 4step、firstAlertStep 1。
### 3 seed 前後比較
ローカルの ambusher energy budget telemetry を一時利用し、41001/42001/43001を各1,800stepで比較した。旧条件はambusher records 27、starvation deaths 27、success経験個体 12、success合計 32、contact合計 40、attack合計 88、バースト圏外逃走刺激 356step、終了時肉食 0/0/0。修正後はambusher records 21、starvation deaths 21、success経験個体 11、success合計 30、contact合計 31、attack合計 71、バースト圏外逃走刺激 0step、終了時肉食 0/0/0。
### energy収支
餓死ambusher平均では、旧条件のgain 60.18、loss 95.86、収支 -35.67に対し、修正後はgain 64.64、loss 88.95、収支 -24.31。死亡直前256stepは、target保持率 0.786から0.729、chase率 0.684から0.612、ambush hold率 0.081から0.096、contact/attack率 0.0098から0.0089。
### 検証
Micro A-C、同一seed前後3試行、save/load round tripでpage errorなし。最終差分からローカル診断コードと一時Micro確認関数は削除し、通常OFF時の追加recordsは残していない。
### 採用判断
採用。短時間3 seedでは終了時肉食は増えていないが、ambusherがバースト圏外から獲物を逃がす挙動は0stepへ解消され、非ambusherの逃走刺激条件は維持された。次は個体間反発または接触後attack機会の阻害を別タスクで検証する。

## 2026-07-15 09:18 捕食者と現在の獲物の間だけ個体間反発を弱める
### 背景
個体間反発は `personalSpaceR` を基準に `contact=(selfR+otherR)*0.82`、`soft=(selfR+otherR)*1.06` を使う一方、捕食接触は `this.size + prey.size + 3.8` を使う。形態によって `personalSpaceR` が大きくなるため、現在targetとの間でもattack距離外へ押し戻される可能性があった。
### 変更
`DIRECT_PREDATION_SEPARATION_MUL = 0.15` を追加し、`this.preyTargetId === o.id || o.preyTargetId === this.id` の直接捕食ペアだけ反発係数 `k` を15%へ縮小した。`contact`、`soft`、`deep`、`hits`、最終scale、探索半径、通常個体間反発、逃走、chaseForce、burst、低energy補正、attack成功率は変更していない。
### Micro A-D
A current target: 捕食者側・獲物側とも directPredationPair=true、反発倍率0.15、firstContact=4、firstAttack=4、非有限値なし。B target外個体: directPredationPair=false、倍率1.0。C target切替: A target時はAのみ0.15/Bは1.0、Bへ切替後はAが1.0/Bが0.15へ戻った。D バースト圏内逃走: predatorThreatId設定、fleeTimer=28、prey速度0.18、motionLevel=0.55で逃走処理は維持。
### 通常世界3 seed
41001/42001/43001を各1,800step。既存telemetryで tracking 107、contact 79、attack 79、success 31。tracking→contact 73.8%、contact→attack 100%、contact→success 39.2%。ambusherはtracking 9、contact 6、success 1、starvation deaths 8。全肉食starvation deaths 71、終了時肉食 0/0/0、総個体数 119/125/122。
### 検証
inline script構文、`organism_render.js`構文、`scripts/*.cjs`構文、`git diff --check`、Micro A-D、同一3 seed、save/load round trip、HTML SHA一致、凍結版差分なしを確認。page error、NaN、Infinityなし。FPSスモークは390x844で平均33.67、最終35FPS。
### 採用判断
採用。現在targetとの反発だけが両方向で15%になり、target外・target解除後の通常反発と獲物の逃走は維持された。短時間3 seedでは終了時肉食は増えないが、Microでcontact/attack到達を確認し、通常世界で重大な重複・振動・逃走不能・エラーは見られなかった。
## 2026-07-15 15:03 遺伝子依存の繁殖成熟年齢を導入
### 背景
新生児は energy=100 / age=0 で誕生する一方、繁殖閾値は `60 + 50 * fecundity` だったため、fecundity < 0.8 の個体は出生直後から energy 条件を満たし得た。繁殖処理には年齢ゲートがなく、出生直後の繁殖抽選が生活史と世代交代を歪める可能性があった。
### 変更
`reproductiveMaturityAgeFromGenes()` を追加し、fecundity 0.0/0.5/1.0 をそれぞれ 420/300/180step の成熟年齢へ写像した。`recalcPhenotype()` で `maturityAge` を再計算し、通常の繁殖ゲートで `age < maturityAge` の個体を `immature` として止める。未成熟時は繁殖確率計算、mating call、mateSeekT進行、tryReproduce() を行わず、`mateSeekT=0` / `callCD=0` に戻す。
### 配偶者条件
`tryReproduce()` の配偶者探索にも `o.age < o.maturityAge` を追加した。成熟済み親が未成熟個体を配偶者として選べない一方、相手がいない場合の既存の無性生殖経路は維持した。
### Micro A-F
A: age 299 / maturity 300 / energy十分で immature 1、eligible 0、newborn 0、mateSeekT 0、call 0。B: age 300 / maturity 300 で eligible 1、probabilityFailed 1、既存抽選へ進行。C: age 400 / energy不足で energyBelowThreshold 1。D: 未成熟候補 age 299 は eligibleMates 0、無性経路を維持。E: 成熟候補 age 320 は eligibleMates 1、有性候補として選択可能。F: fecundity 0.0=420、0.5=300、1.0=180。
### 通常世界3 seed比較
41001/42001/43001、各1,800step。旧: 総出生1063、総繁殖791、180step未満繁殖449、成熟前繁殖547、carnivore born 134、carnivore reproduced 95、餓死308、過密死444。修正後: 総出生648、総繁殖490、180step未満繁殖0、成熟前繁殖0、carnivore born 52、carnivore reproduced 38、餓死197、過密死176。終了時個体数は最終確認で124、終了時肉食は各seed合計の通常試験内で残存あり。
### 検証
inline script構文、organism_render.js構文、scripts/*.cjs構文、git diff --check、Micro A-F、同一3 seed、save/load round trip、通常/dev短時間起動を確認。index.html と alife_symbolic_shapes_v1.html の SHA は一致。page error、NaN、Infinityなし。凍結版は変更なし。
### 採用判断
採用。出生直後繁殖は0になり、最短成熟年齢180stepを確保した。出生数と繁殖数は減ったが、全食性で繁殖は残っており、今回の目的である「出生→成長→成熟→繁殖」の生活史ゲートを満たした。
### 再集計訂正
最終確認として、基準コミットHTMLと修正版HTMLへ同じ一時プローブを注入し直し、相対読み込みを壊さないルート直下の一時HTMLで再集計した。旧: 総出生1277、総繁殖984、食性別繁殖 h/m/c=629/233/122、食性別出生 h/m/c=827/296/154、180step未満繁殖512、成熟前繁殖660、carnivore born 154、carnivore reproduced 122、餓死346、過密死621、終了時個体数123/121/120、終了時肉食0/3/0。修正後: 総出生586、総繁殖465、食性別繁殖 h/m/c=301/136/28、食性別出生 h/m/c=382/170/34、180step未満繁殖0、成熟前繁殖0、carnivore born 34、carnivore reproduced 28、餓死158、過密死159、終了時個体数124/124/125、終了時肉食4/0/0。page error、非有限値、save/load異常はいずれもなし。

## 2026-07-15 生活史状態の一貫化
### 変更前の問題
死亡済み個体は捕食された同一step内でも後続順なら `step()` され得た。成熟判定は本体、UI、肉食テレメトリ、dev spawn、過密淘汰で固定180/240や `o.maturityAge` 直接比較が混在していた。未成熟個体も energy 条件だけで mating call を追跡でき、mating call の寿命は `draw()` 回数に依存していた。`restore()` の配列初期化では calls が消されず、旧世界の call が残り得た。
### 変更
`reproductiveMaturityAgeFor(o)` と `isReproductivelyMature(o)` を追加し、通常繁殖、配偶者候補、UIの「繁殖可能」、肉食成熟テレメトリ、過密淘汰、dev spawn を共通判定へ統一した。`Organism.step()` 冒頭とモデル更新ループの両方で死亡個体をskipし、`tryReproduce()` も死亡時は `[]` を返す。mating call 追跡条件へ成熟判定を追加し、call寿命更新を `updateModel()` のモデルstep単位へ移した。`restore()` では `calls.length=0` を明示した。
### 境界修正
`age = maturityAge - 1` の個体が同じstep内の `age++` 後に成熟扱いで繁殖へ進む問題が検証で見つかったため、age加算を繁殖判定の後へ移した。step開始時の未成熟状態では、そのstep中に call追跡・call発信・mateSeekT進行・繁殖抽選へ進まない。
### 付随修正
`personalSpaceR` に NaN が残る個体があり、利用側では `|| o.size` で実質フォールバックされていた。非有限値検証を満たすため、`prepareSymbolDetails()` で同じ実効値に相当する `this.size * 1.12` へ正規化した。
### Micro A-I
A 死亡個体の直接step: age/energy/位置/速度/mateSeekT/callCD変化なし、newborn/calls/telemetry増加なし。
B 同一step内死亡: 先行個体stepで後続個体をdead化、後続step実行0、age増加なし、繁殖なし、step末尾で削除、死亡記録1回。
C 成熟境界: fecundity 0.0/0.5/1.0 で maturityAge 420/300/180。age=maturityAge-1 は未成熟、age=maturityAge は成熟。
D 未成熟交配行動: step開始 age=299/maturity=300、energy十分、同種callありでも call方向の追加加速なし、mateSeekT 0、call増加なし、newborn 0、immature gate 1。
E 成熟済み交配行動: age=300/maturity=300、同種callへ x方向追加加速、mateSeekT 121→122、call 1件発信、eligible gate 1。
F dev spawn: herbivore/omnivore/carnivore の newborn と juvenile は未成熟、mature は成熟済み。成熟個体のみ「繁殖可能」表示。
G 過密淘汰: age 200 でも fecundity 0.0 個体は young、fecundity 1.0 個体は mature。capacityScore の成熟度差は個体固有maturityAge基準の期待差 0.05238095238095239 と一致。緊急上限超過時は mature 側が淘汰対象になり young は残存。
H mating call寿命: t=180 は10モデルstep後170、停止中draw 100回後も170、4倍速1更新でframe +4かつ t=166。
I restore時call消去: call 1件ありの状態から別saveをrestoreし、calls.length 0。
### 3 seed結果
41001: 出生236、繁殖170、食性別繁殖 h/m/c=125/44/1、成熟前繁殖0、180step未満繁殖0、死亡後行動0、死亡後繁殖0、捕食29、餓死48、捕食死29、過密死98、終了時個体数125、終了時肉食0、肉食成熟0、肉食成熟前捕食0、成熟後捕食2、call発生196、call残存55。
42001: 出生193、繁殖147、食性別繁殖 h/m/c=37/98/12、成熟前繁殖0、180step未満繁殖0、死亡後行動0、死亡後繁殖0、捕食41、餓死62、捕食死41、過密死32、終了時個体数122、終了時肉食2、肉食成熟2、肉食成熟前捕食4、成熟後捕食10、call発生105、call残存40。
43001: 出生251、繁殖190、食性別繁殖 h/m/c=162/23/5、成熟前繁殖0、180step未満繁殖0、死亡後行動0、死亡後繁殖0、捕食17、餓死55、捕食死17、過密死118、終了時個体数125、終了時肉食0、肉食成熟0、肉食成熟前捕食2、成熟後捕食3、call発生200、call残存51。
### 検証
inline script構文、`organism_render.js`構文、`scripts/*.cjs`構文、`git diff --check` はOK。Micro A-I OK。同一seed 41001/42001/43001 各1,800step OK。3 seedでpage errorなし、NaN/Infinityなし、save/load round trip OK。通常版・開発者版起動OK。`index.html` と `alife_symbolic_shapes_v1.html` の SHA256 一致。凍結版 SHA256 は `1DD2B28D6FC7D2471370CF2B88C00CD87319DD285F255C8123408F108463816B` のまま。FPSスモークは390x844/120個体で平均41.8、最終44FPS。
### 採用判断
採用。死亡・未成熟・成熟の状態判定が、行動、繁殖、UI、診断、dev機能、過密淘汰、時間進行で同じ基準になった。繁殖成熟年齢式、繁殖コスト、clutch、捕食、速度、個体数上限、speciesKey、traits/flags、topology、セーブバージョン、Wikiは変更していない。
## 2026-07-15 繁殖 energy 保存
### 変更前の問題
繁殖で生まれた子は `Organism` コンストラクタ既定の `energy=100` のまま誕生していた。一方で親は clutch 別倍率、配偶者は軽い倍率コストだけを支払うため、親・配偶者が失った energy を超える子 energy が新規生成されていた。基準コミット `0a180210f89f8b0bd10e96f87233377ba57f316f` の一時監査では 3 seed 合計 681 繁殖イベントすべてが energy 生成イベントで、最大 conservation residual は +306.7295957342592 だった。

### 実装
成熟判定を履歴用の `hasReachedReproductiveMaturity(o)`、現在繁殖参加可能判定の `canParticipateInReproduction(o)`、energy 閾値も含む `canReproduceNow(o)` に分離した。肉食成熟履歴・成熟前後捕食分類は履歴判定を使い、行動・配偶者候補・mating call・UI は現在繁殖可能判定を使うようにした。`isReproductivelyMature(o)` は互換 alias として残し、現在の生存個体の参加可能判定を表すことをコメントした。

`REPRODUCTION_ENERGY_TRANSFER_EFFICIENCY=0.90`、`REPRODUCTION_CHILD_ENERGY_MAX=100` を追加した。親 energy 倍率 1仔=0.55、2仔=0.40、3仔=0.30、4仔以上 `0.30 * (3 / clutch)^0.9` は維持した。配偶者倍率 2仔以下=0.92、4仔以下=0.88、それ以上=0.84 も維持した。`reproductionEnergyPlan(parent,mate,clutch)` で親・配偶者の損失を繁殖投資として計算し、その 90% を clutch で割って子 energy とした。子 energy は 100 を上限に clamp する。

`tryReproduce()` は冒頭で `!canReproduceNow(this)` なら `[]` を返すようにし、死亡・未成熟・energy 不足・energy 閾値同値では直接呼び出しでも繁殖しない。配偶者候補も `canReproduceNow(o)` と同一 `speciesKey` を要求し、配偶者側も `energy > reproThreshold` を満たす必要がある。子は生成直後、出生テレメトリ前に `c.energy = energyPlan.childEnergy` を受け取り、出生テレメトリの `birthEnergy` に実際の初期 energy を記録する。すべての子生成後、親と配偶者へ計画済み `parentAfter` / `mateAfter` を適用し、個別の `this.energy *= mult` / `mate.energy *= mm` は削除した。

### Micro A-I
A 無性1仔: parentAfter 55、parentInvestment 45、childEnergy 40.5、totalChildEnergy 40.5、energy creation 0。B 無性2仔: parentAfter 40、parentInvestment 60、childEnergy 27、totalChildEnergy 54、transferLoss 6。C 無性3仔: parentAfter 30、parentInvestment 70、childEnergy 21、totalChildEnergy 63、transferLoss 7。D 有性2仔: parentAfter 40、mateAfter 92、totalInvestment 68、offspringEnergyPool 61.2、childEnergy 30.6、totalChildEnergy 61.2。E parent/mate energy 160 の有性1仔: childEnergy 76.32 で 100 以下、energy 生成なし、transferLoss 8.48。F 未成熟本人の直接 `tryReproduce()` は kids 0。G `energy === reproThreshold` は本人・配偶者とも繁殖不可、kids 0。H 死亡済み成熟到達個体は `hasReachedReproductiveMaturity=true`、`canParticipateInReproduction=false`、`canReproduceNow=false`、肉食テレメトリ成熟履歴 true。I 出生テレメトリ `birthEnergy` は 40.5 で子の実 `energy` と一致し、固定 100 ではない。

### 3 seed 1,800step 比較
基準コミット合計: 出生 873、繁殖 681、食性別出生 h/m/c=732/93/48、食性別繁殖 h/m/c=576/74/31、平均新生児 energy 100、energy 生成イベント 681、最大 conservation residual +306.7295957342592、新生児餓死 26、餓死 137、捕食死 68、過密死 490、最大個体数 126、終了個体数 123/123/124、終了肉食数 2/0/0、肉食出生 48、肉食成熟 34、肉食繁殖 31、再播種 0。

修正版合計: 出生 761、繁殖 593、食性別出生 h/m/c=628/110/23、食性別繁殖 h/m/c=484/90/19、平均新生児 energy 44.294991227019686、energy 生成イベント 0、最大 conservation residual -3.106539209902916（正の residual 最大 0）、新生児餓死 44、餓死 157、捕食死 65、過密死 362、最大個体数 126、終了個体数 122/124/123、終了肉食数 0/0/0、肉食出生 23、肉食成熟 9、肉食繁殖 19、再播種 0。

修正版 seed 別平均新生児 energy: 41001=40.103、42001=48.055、43001=44.727。clutch 別平均新生児 energy は 41001: 1仔46.705/2仔31.177/3仔26.670/4仔19.382、42001: 1仔57.061/2仔36.977/3仔26.773/4仔17.834、43001: 1仔53.826/2仔35.967/3仔22.035/4仔19.223。有性/無性別平均は 41001: sexual 50.407 / asexual 40.230、42001: sexual 61.739 / asexual 46.807、43001: sexual 59.524 / asexual 41.797。

成熟到達率は修正版で 41001=0.7465、42001=0.7753、43001=0.7726。食性別成熟到達率は 41001 h/m/c=0.7365/0.7910/0、42001 h/m/c=0.7922/0.8571/0.4、43001 h/m/c=0.7912/0.6364/0.5。fecundity 別の過密死確認では、各 seed とも young/mature 分類は個体固有 maturityAge 基準で、過密死は今回の範囲では成熟後のみだった。

### seed42001 6,000step
修正版は population 継続。出生 1240、繁殖 947、食性別出生 h/m/c=1181/46/13、食性別繁殖 h/m/c=903/36/8、平均新生児 energy 53.87762047288545、energy 生成イベント 0、最大 conservation residual -3.473919423958659（正の residual 最大 0）、新生児餓死 14、餓死 56、捕食死 16、過密死 1108、最大個体数 126、終了個体数 124、最大肉食数 28、終了肉食数 0、肉食出生 13、肉食成熟 6、肉食繁殖 8、再播種 0。爆発的な出生・大量死・絶滅再播種はなかったが、肉食系統は終了時 0 だった。これは補償調整せず、今回の検証結果として扱う。

### 検証
inline script 構文 OK、`organism_render.js` 構文 OK、`scripts/*.cjs` 構文 OK、`git diff --check` OK。Micro A-I OK。3 seed 各1,800step OK。seed42001 6,000step OK。save/load round trip OK。通常版・開発者版・同期済みコピー版起動 OK。`index.html` と `alife_symbolic_shapes_v1.html` の SHA256 は一致。凍結版 `alife_env_seaglass_v1_fixed_v5_eco5_PATCH_metabolism_v7.html` は未変更。page error なし、NaN/Infinity なし。FPS smoke は 390x844 / 120個体で平均 41.6 FPS。

### 採用判断
採用。繁殖した子の energy は固定 100 ではなく、親・配偶者の energy 損失から 90% 効率で配分される。子の合計 energy は繁殖投資を超えず、energy 生成イベントは 0、正の conservation residual 最大 0。既存の clutch 分布・親倍率・配偶者倍率・成熟年齢式・有性/無性経路は維持した。未成熟・死亡・energy 不足・閾値同値個体は直接呼び出しでも繁殖しない。出生テレメトリは実際の初期 energy と一致する。

## 2026-07-16 肉食系統消滅の生活史診断
### 目的と基準
基準コミット: `04e1a9c2cb96c27740c41de57b11261b93f8bb7e`。繁殖 energy 保存後、通常個体群は維持される一方で肉食系統が世代継続できず消滅するため、能力値・energy・捕食・繁殖・餌・UI・save 形式・Wiki を変更せず、出生、成長、成熟、獲物認識、追跡、接触、捕食、繁殖、次世代成熟のどこで途切れるかを診断した。

### 実装
`telemetryDiet(o) === 'c'` を肉食判定として使用し、新しい食性閾値は作っていない。個体には `birthDietClass` / `birthExactDiet` / `currentDietClass` / `currentExactDiet` を記録し、主分析は出生時肉食、現在肉食へ変異した個体は別集計にした。初期個体は `initial` / `generationDepth=0`、繁殖出生個体は `born` とし、`parentId` / `mateParentId` / `parentBirthDiet` / `generationDepth` / `clutch` / `clutchIndex` / `reproductionMode` を `telemetryRecordBirth()` 経由で保存する。世代深度は無性なら親 + 1、有性なら `Math.max(parentGenerationDepth, mateGenerationDepth) + 1`。

`telemetry.carnivoreLife` と `telemetry.predationIndividuals` を拡張し、重複システムは作らなかった。出生時肉食個体について、60/120/180step 生存、成熟、valid prey、target、chase、2x/1.5x/1.25x/1.1x/contact、attack、first predation、repro threshold、eligible、reproduced、carnivore child、carnivore child matured を個体単位で追跡する。初回イベントは validPrey/target/chase/contact/attack/predation/eligibility/reproduction の frame/age/energy を初回値として保持し、成熟前後は `hasReachedReproductiveMaturity(o)` で pre/post に分けた。

死亡時は `deathCause` / `deathAge` / `deathEnergy` / `deathMaturityRatio` / `deathEnergyRatio` / `deathStoreN` / `deathStoreO` / `deathStoreD` / `deathMem` と、`dominantLifeStageFailure` を記録する。親子連鎖は Level 1 = 肉食親が出生時肉食子を生む、Level 2 = その肉食子が成熟、Level 3 = その肉食子が繁殖して出生時肉食孫を生む。メモリ上限は `TELEMETRY_CARNIVORE_LINEAGE_LIMIT=6000` とし、個体詳細は肉食系統に限定する。

開発者 API として `__alifeDebug.carnivoreLineageSummary()`、`runCarnivoreLineageMicroTests()`、`runSeededWorldDiagnostic()`、`diagnosticNumberHealth()` を追加した。通常 UI に大型診断パネルは追加していない。検証ランナー `scripts/carnivore_lineage_diagnostic.cjs` は seed ごとにページ初期化前から `Math.random` を固定し、通常世界 6,000step と長期 12,000step を JSON 出力する。

### Micro A-I
A 初期個体と出生個体: OK。親 initial=true/depth0、子 initial=false/depth1、parentId 一致。
B 有性生殖の世代深度: OK。depth 2 と 4 の親から child depth 5。
C 生存マイルストーン: OK。60/120/180/maturity は一度だけ記録。
D 初回イベント: OK。初回 frame/age/energy は保持、回数は増加。
E 成熟前後: OK。maturityAge-1 は pre、maturityAge は post。
F 死亡段階: OK。初回捕食前餓死は `deathCause=starvation` / `diedBeforeFirstPredation`。
G Level 1-3: OK。G0 -> G1 -> G2 の人工連鎖で Level 1/2/3 true。
H 肉食以外へ変異した子: OK。総出生子には含め、出生時肉食子と Level 判定から除外。
I 絶滅エピソード: OK。2,1,0,0,1,0 で extinctionEpisodeCount=2 / reappearanceCount=1。

### 6,000step 通常世界診断
正式結果: `carnivore_lineage_diagnostic_full.json`。全 seed で page error なし、NaN/Infinity なし、通常個体群維持、再播種 0。

| seed | 最大肉食 | 終了肉食 | 絶滅frame | 絶滅episode | 再出現 | 初期肉食 | 出生肉食 | 最大世代 | Level3 born |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 41001 | 17 | 0 | 1122 | 2 | 1 | 16 | 6 | 2 | 0/6 |
| 42001 | 29 | 0 | 1115 | 1 | 0 | 27 | 13 | 2 | 0/13 |
| 43001 | 16 | 0 | 598 | 1 | 0 | 15 | 8 | 1 | 0/8 |

出生時肉食 born ファネル: 41001 は 60/120/180 生存 6/6, 6/6, 4/6、成熟 2/6、valid/target/chase 6/6、contact 3/6、attack 3/3、first predation 2/3、threshold 2/2、eligible 1/2、reproduction 1/1、carnivore child 1/1、child matured 0/1。42001 は 13/13, 12/13, 6/13、成熟 2/13、valid/target/chase 13/13、contact 5/13、attack 5/5、first predation 2/5、threshold 2/2、eligible 2/2、reproduction 1/2、carnivore child 1/1、child matured 0/1。43001 は 8/8, 5/8, 3/8、成熟 0/8、valid/target/chase 8/8、contact 5/8、attack 5/5、first predation 1/5、threshold 1/1、eligible 0/1、reproduction 0、child matured 0。

世代別では、41001 は G0:16/成熟15/捕食4/繁殖2/肉食子2、G1:3/成熟2/捕食2/繁殖1/肉食子1、G2:3/成熟0。42001 は G0:27/成熟26/捕食7/繁殖7/肉食子7、G1:12/成熟2/捕食2/繁殖1/肉食子1、G2:1/成熟0。43001 は G0:15/成熟15/捕食5/繁殖5/肉食子5、G1:8/成熟0。初期個体は繁殖できるが、born 個体の子または孫が成熟せず、born 親の Level 3 は全 seed で 0。

死因は starvation が支配的。41001: starvation 18 / predation 4、死亡段階 diedBeforeFirstPredation 16。42001: starvation 34 / predation 6、diedBeforeFirstPredation 29。43001: starvation 18 / predation 5、diedBeforeFirstPredation 14。餓死の内訳は、出生後 60 未満 0、60-120 は 0/1/3、120-180 は 2/6/2、180 以降成熟前は 3/5/2、成熟後初回捕食前は 9/16/6、初回捕食後繁殖前は 3/1/0、繁殖後は 1/5/5。

捕食失敗は valid prey / target / chase では詰まっていない。全 seed で born の valid prey, target, chase は 100%。一方で contact は 50.0%, 38.5%, 62.5%、attack 後 first predation は 66.7%, 40.0%, 20.0%。主要失敗理由は 41001 chaseFailed 8 / attackResolutionFailed 8、42001 chaseFailed 18 / attackResolutionFailed 13、43001 chaseFailed 9 / attackResolutionFailed 8。event counts では attackCooldownBlocked が多いが、主要分類では chase/contact と attack resolution がボトルネック。

birthEnergy と clutch はサンプル少数だが傾向あり。成熟到達の平均 birthEnergy は 62.82 / 63.20 / 66.06、成熟前死亡は 42.05 / 40.17 / 40.81。繁殖成功群の平均 birthEnergy は 69.18 / 60.02 / 70.86、繁殖前死亡は 56.35 / 55.36 / 53.51。成熟前死亡群は clutch 平均 1.40 / 1.42 / 1.50 で、成熟群 0.18 / 0.14 / 0.00 より高い。因果断定はしないが、低 birthEnergy かつ born clutch 群で成熟率が低い傾向。

肉食親の子の食性流出は、この正式実行では観測されなかった。肉食親の子は 41001 が c/m/h=5/0/0、42001 が 13/0/0、43001 が 8/0/0。現在肉食へ変異した非出生時肉食も全 seed で 0。過密死も 0。

### 12,000step 長期確認
6,000step で最も長く肉食が存続した seed は 41001（persistence frame 1122）なので 12,000step に採用。結果は 6,000step と同じく最大肉食17、終了肉食0、最終絶滅frame1122、絶滅episode2、再出現1、最大世代深度2、born Level3 0/6、通常個体群維持 true、再播種0、page error なし、NaN/Infinity なし。絶滅後の一時復活は 6,000step 内で 1 回あり、それ以降 12,000step までは肉食再出現なし。

最後の肉食個体は id=122、born、generationDepth=2、age=228、maturityAge=254、energy=0.1849、reproThreshold=94.5466、捕食成功0、最後の捕食なし、繁殖0、子0、死因 starvation。

### 診断結論
支配的原因は G「次世代生存不足」。G0 は各 seed で繁殖し出生時肉食子を出すが、born 親の Level 3 は 0/6, 0/13, 0/8。G2 は 41001 と 42001 で存在するが成熟 0、43001 は G1 成熟 0。次点は A「幼体生存不足」。born 成熟率は 33.3%, 15.4%, 0.0% で、成熟前死亡群の birthEnergy は成熟群より低い。次点は D「攻撃解決不足」。contact/attack まで到達しても first predation は 2/3, 2/5, 1/5 で、主要失敗理由に attackResolutionFailed が残る。B 獲物認識不足、F 繁殖抽選不足、H 食性流出、I 過密淘汰は今回の主要原因ではない。E 捕食後 energy 不足も、捕食成功後の threshold 到達が 100%, 100%, 100% のため主因ではない。

### 検証
inline script 構文 OK。`organism_render.js` 構文 OK。`scripts/*.cjs` 構文 OK。`git diff --check` OK。Micro A-I OK。41001/42001/43001 各 6,000step OK。41001 12,000step OK。save/load round trip OK。通常版・開発者版起動 OK。`index.html` と `alife_symbolic_shapes_v1.html` の SHA256 は `CE1FD87CBB00090D2B60730548B7E38B3943C63E9E1D31824ABD75433CFB67AF` で一致。凍結版 `alife_env_seaglass_v1_fixed_v5_eco5_PATCH_metabolism_v7.html` は未変更。page error なし。NaN/Infinity なし。FPS smoke は 1280x720 / 180 個体 / average FPS 12、avg update 5.31ms、avg draw 51.23ms、errors なし。診断 telemetry は肉食系統限定かつ上限 6000 件で、無制限増加しない。

### 採用判断
採用。通常ゲーム挙動・主要パラメータ・UI・save 形式・Wiki は変更していない。今回の変更は、肉食系統の途切れ位置を個体、世代、親子関係、死因で特定する診断機能に限定した。

## 2026-07-16 Pack strategy lineage diagnosis and conserved prey sharing A/B

### Purpose and baseline
Baseline commit: `dde82a7bddd21ba9a2919df262576ba737e1b8c6`.
The goal was diagnostic only for default play: compare pack / ambusher / other carnivore life-history failure points, then test diagnostic-only conserved prey energy and nutrient sharing for pack/hunt-pack group hunts. No default gameplay parameter was changed.

### Implementation
Added `carnivoreStrategyClass(o)` with fixed priority: `pack` when `role === 'pack'` or `socialMode === 'hunt-pack'`, then `ambusher` when `role === 'ambusher'`, otherwise `other`. Stored `birthStrategyClass` and `currentStrategyClass` on carnivore lineage records, birth records, population snapshots, and individual diagnostics.

Reused the existing pack helper conditions by exposing `eligiblePackHelpersFor(predator, prey)` as a thin wrapper over the same helper collection used by `getEffectivePredationSizeRatio()`: non-dead, not predator/prey, same `speciesKey`, pack or hunt-pack, and inside the existing `PACK_HELPER_RADIUS`. Pack helper distance, size contribution, success probability, defense, chase force, cooldowns, prey flee, metabolism, birth energy, clutch, maturity, and reproduction parameters were not changed.

Added diagnostic-only pack prey sharing controlled by `diagnosticPackSharing`. Defaults remain `shareFraction=0` and `detailedTelemetry=false`. `runSeededWorldDiagnostic()` can run `baseline`, `share30`, and `share40`; only normal predation successes by pack/hunt-pack killers with at least one eligible helper activate sharing. Gross energy is conserved: `sharePool = grossGain * shareFraction`, killer gets `grossGain - sharePool`, helpers split the pool equally, cap overflow is lost and not redistributed. `storeN` nutrient gain is split with the same ratio. Attack cost and prey defense remain killer-only.

Added per-event conservation telemetry: original gross/nutrient gains, planned and actual killer/helper gains, overflow loss, residuals, helper IDs/strategies, helper chase costs, killer chase cost, effective size ratio, helper contribution, group/solo flags, and helper post-event survival classification. Detailed event storage is capped and enabled only for diagnostic runner runs.

### Phase 0 clutch correction
Cause: the previous clutch statistic used `stat(rows.map(r => r.clutch))`, and `stat()` maps values through `Number()`, so `null` clutch values from initial records became `0`. That mixed initial individuals into born clutch statistics and produced impossible averages below 1. The fix restricts clutch stats to born records with `Number.isFinite(clutch) && clutch >= 1`; `clutchIndex` is reported separately; empty samples report `null`.

Corrected baseline mature-group clutch: seed41001 `n=2 avg=1.5 median=1.5 min=1 max=2`; seed42001 `n=2 avg=2 median=2 min=2 max=2`; seed43001 `n=0 avg=null median=null min=null max=null`.
Corrected baseline premature-death clutch: seed41001 `n=4 avg=1.75`; seed42001 `n=11 avg=1.5455`; seed43001 `n=8 avg=1.5`.

### Micro tests
Existing lineage Micro A-I: all OK. Added pack sharing Micro A-I: strategy classification OK; clutch statistics exclude initial and separate clutchIndex; baseline helper gain 0; share30 plans 70/15/15 for gross 100 and two helpers; share40 plans 60/20/20; cap overflow is lost; nutrient conservation follows the same split; solo pack and non-pack predation remain baseline-equivalent.

### 6,000-step A/B results
All 9 runs completed with page error 0 and NaN/Infinity 0.

Pack born results were identical across `baseline`, `share30`, and `share40` because no eligible group hunt event occurred in these seeds.

| variant | seed | max carnivores | end carnivores | extinction frame | pack born maturity | pack born Level 3 | pack max depth | group hunts | helper energy |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | 41001 | 17 | 0 | 1122 | 0/1 | 0 | 2 | 0 | 0 |
| baseline | 42001 | 29 | 0 | 1115 | 0/2 | 0 | 1 | 0 | 0 |
| baseline | 43001 | 16 | 0 | 598 | 0/2 | 0 | 1 | 0 | 0 |
| share30 | 41001 | 17 | 0 | 1122 | 0/1 | 0 | 2 | 0 | 0 |
| share30 | 42001 | 29 | 0 | 1115 | 0/2 | 0 | 1 | 0 | 0 |
| share30 | 43001 | 16 | 0 | 598 | 0/2 | 0 | 1 | 0 | 0 |
| share40 | 41001 | 17 | 0 | 1122 | 0/1 | 0 | 2 | 0 | 0 |
| share40 | 42001 | 29 | 0 | 1115 | 0/2 | 0 | 1 | 0 | 0 |
| share40 | 43001 | 16 | 0 | 598 | 0/2 | 0 | 1 | 0 | 0 |

Baseline strategy totals across 3 seeds: pack born `5`, maturity `0/5`, valid/target/chase `5/5`, contact `3/5`, attack `3/3`, first predation `0/3`, starvation before first predation `5`, Level 3 `0`. Ambusher born `19`, maturity `3/19`, contact `9/19`, first predation `4/9`, reproduced `2/3 eligible`, Level 3 `0`. Other born `3`, maturity `1/3`, contact `1/3`, first predation `1/1`, Level 3 `0`.

World maintenance remained normal in all A/B runs: reseed `0`, end populations `69/120/113`, end carnivores `0/0/0`, end herbivore/omnivore/carnivore counts `34/35/0`, `120/0/0`, `112/1/0`.

Conservation across 9 runs plus long run: max positive energy residual `1.4210854715202004e-14`, max positive nutrient residual `0`, energy generation events `0`, nutrient generation events `0`. Positive residuals above `1e-9` were not observed.

### 12,000-step long run
Selection rule chose `baseline seed41001`: highest pack born Level 3 tied at 0, then highest pack max generation depth 2 and persistence frame 1122. Result: max carnivores `17`, end carnivores `0`, final extinction frame `1122`, extinction episodes `2`, reappearance `1`, max generation depth `2`, pack born Level 3 `0/1`, group hunts `0`, helper energy `0`, reseed `0`, end population `122`, end diets `h=122/m=0/c=0`, page error `0`, NaN/Infinity `0`, energy/nutrient generation `0`.

### Adoption judgment
Do not adopt pack prey sharing as a production default from this run. `share30` and `share40` are conservation-safe and micro-verified, but they produced no behavioral difference because pack group hunts did not occur in the tested seeds. The dominant observed pack failure is before sharing can matter: pack born individuals failed to mature or failed at attack resolution before first predation. This supports diagnosing pack lineage loss as next-generation survival / juvenile survival plus attack-resolution failure, not lack of post-success group energy distribution in these runs.

### Validation
`node --check organism_render.js`: OK. `scripts/*.cjs`: OK. Inline script syntax: OK, 1 inline block. `git diff --check`: OK. `runCarnivoreLineageMicroTests()`: OK. `runPackSharingMicroTests()`: OK. `baseline/share30/share40` for seeds `41001/42001/43001` at 6,000 steps: OK. Selected 12,000-step run: OK. Save/load round trip: OK. Normal and developer boot: OK. `index.html` and `alife_symbolic_shapes_v1.html` SHA256 matched. Frozen HTML diff: none. FPS smoke at 1280x720/180 organisms: avg FPS `11.9`, avg update `8.57ms`, avg draw `49.09ms`, errors `0`; no major degradation from the known ~12 FPS baseline.

## 2026-07-16 Pack hunt formation, target agreement, and helper-count diagnostics

### Purpose and baseline
Baseline commit: `16da08d67c7a6665eae434eb1d461075662fd001`.
The goal was diagnostic only: identify whether pack hunting breaks at same-species packmate presence, spatial proximity, target sharing, same-target chase, eligible helper formation, or attack resolution. No pack probability, chase force, pack bonus, target-sharing condition, helper radius, speciesKey condition, predation energy, birth energy, clutch, maturity, metabolism, reproduction, food supply, population cap, UI, save format, or Wiki behavior was changed. Defaults remain `shareFraction=0` and detailed pack telemetry OFF.

### Implementation
Added diagnostic-only `packHuntContextSnapshot(predator, prey)` and `__alifeDebug.packFormationSummary()`. The snapshot records the four existing pack-count definitions without normalizing them: social-range same-species packmates, chase bonus mates within predator 80, attack probability mates within prey 76, and existing eligible helpers from `eligiblePackHelpersFor()`.

Detailed pack telemetry is gated by `diagnosticPackSharing.detailedTelemetry`, so normal play does not store per-step diagnostic arrays. When enabled, it records capped context events, target events, and every pack attack attempt including failures. Attack attempt records include helper counts, same-target/different-target/targetless helper classes, raw/final probability, roll, success, pack multiplier components, size/defense/group multipliers, and whether the existing chase/attack/helper counts agree.

Added per-pack formation funnel fields: living same-species packmate, social-range mate, predator-80 mate, target, mate target, shared target, target switch, same/different target mate, same-target chase overlap, helper near prey, contact, attack with/without helper, success with/without helper, reproduction, pack child, and pack child matured. Death records classify born pack individuals as `diedWithoutAnyLivingPackMate`, `diedWithMateButNeverInRange`, `diedInRangeButNeverSharedTarget`, `diedAfterTargetSplit`, `diedAfterSoloAttackAttempts`, or `diedAfterHelperAttackAttempts`.

Added `scripts/pack_hunt_formation_diagnostic.cjs` for baseline-only runs: Micro A-L, seeds `41001/42001/43001` at 6,000 steps with detailed pack telemetry enabled, artificial pack groups, save/load round trip, normal boot, and developer boot. Results are written to `artifacts/pack_formation_diagnostic.json`.

### Micro A-L
All OK.
A solo pack: living/attack/eligible mates all 0. B same-species nearby pack: attack mate 1 and eligible helper 1. C different species: chase/attack/eligible all 0. D same-species ambusher: chase/attack/eligible all 0 under existing pack helper conditions. E dead pack: current chase and attack mate counts include it, eligible helper excludes it. F targetless sharing applies. G different target conflict is not converged. H same-target overlap is recorded. I count mismatch is recorded. J helper classification same/different/targetless = 1/1/1. K sibling speciesKey split is recorded and excluded from helper grouping. L failed helper attack increments attempt diagnostics but not success `packHuntEvents`.

### 6,000-step baseline results
All three runs completed with page error 0 and NaN/Infinity 0.

| seed | max pack | formation born pack | mature formation born | end pack | max pack depth | max same-species pack alive | pack attacks | helper attacks | same-target helper attacks | helper success |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 41001 | 9 | 3 | 2 | 0 | 2 | 2 | 41 | 14 | 6 | 0 |
| 42001 | 11 | 2 | 0 | 0 | 1 | 3 | 16 | 1 | 1 | 0 |
| 43001 | 7 | 2 | 0 | 0 | 1 | 3 | 8 | 1 | 0 | 0 |

Target diagnostics:
seed41001 targetless share opportunities/applied `5/5`, already-same-target `894`, different-target opportunities `785`, same-target pursuit steps `495`, split/convergence `6/6`.
seed42001 targetless share opportunities/applied `5/3`, already-same-target `613`, different-target opportunities `4`, same-target pursuit steps `125`, split/convergence `1/1`.
seed43001 targetless share opportunities/applied `11/7`, already-same-target `716`, different-target opportunities `149`, same-target pursuit steps `148`, split/convergence `3/3`.

Helper-count agreement across attack attempts was 100% in the three natural seed runs: `41/41`, `16/16`, `8/8`. Micro I still confirms the diagnostic can detect disagreement when the placement makes predator-80, prey-76, and eligible-helper counts differ.

Helper-count attack buckets:
seed41001 helper0 `27 attacks / 3 successes / 11.1%`, helper1 `14 / 0 / 0%`.
seed42001 helper0 `15 / 1 / 6.7%`, helper2 `1 / 0 / 0%`.
seed43001 helper0 `7 / 1 / 14.3%`, helper1 `1 / 0 / 0%`.

SpeciesKey diagnostics:
seed41001 sibling split pairs `0`, same-species role-mixed keys `1` (`pack` mixed with `other`). seed42001 sibling pairs `1`, species split `0`, role-mixed `0`. seed43001 sibling pairs `1`, species split `0`, role-mixed `0`.

Born pack death classes:
seed41001 `diedWithoutAnyLivingPackMate=2`, `diedAfterTargetSplit=1`. seed42001 `diedAfterTargetSplit=1`, `diedWithoutAnyLivingPackMate=1`. seed43001 `diedAfterTargetSplit=2`.

### Artificial pack groups
Each group size and scenario ran 30 trials for up to 260 steps.

Group size 1: target convergence is trivially 100%; success ranged from 0% to 36.7%; helper attacks were only post-reproduction/secondary-world effects, not initial pack formation.
Group size 2: all-targetless success 46.7%, helper attack 20.0%; one-target success 3.3%; all-different-target split 100% and success 13.3%; all-same-target success 0%.
Group size 3: all-targetless success 23.3%, helper attack 30.0%; one-target success 6.7%; all-different-target split 100% and success 13.3%; all-same-target helper attack 46.7% and success 36.7%.
Group size 4: all-targetless helper attack 96.7% and success 73.3%; one-target helper attack 93.3% and success 76.7%; all-different-target split 100% and success 0%; all-same-target helper attack 100% and success 63.3%.

The control experiment indicates the mechanics can form same-target helper attacks when enough same-species pack individuals remain close, but all-different-target initialization strongly resists convergence, especially at group size 4.

### Diagnosis
Dominant cause: E, target conflict / target fragmentation. Natural runs show many same-target moments, but also substantial different-target opportunities and death classes dominated by `diedAfterTargetSplit` or no living mate. In artificial packs, all-different-target groups split 100% for sizes 2-4 and group size 4 produced 0% predation success despite four available pack individuals.

Secondary cause 1: H, helper-attached attack resolution is insufficient. Natural seed helper attacks existed (`16` total with eligible helper across 3 seeds), including same-target helper attacks (`7` total), but helper success was 0.

Secondary cause 2: I, juvenile/early energy pressure remains ahead of robust pack formation. Birth-strategy pack born maturity was `0/1`, `0/2`, and `0/2`; formation-born pack records reached maturity only in seed41001. Many born pack individuals die before sustained multi-generation pack structure.

Not primary in these runs: A pure mate absence is not sufficient, because seed42001 and seed43001 born pack individuals did have living, social-range, and predator-80 mates. B speciesKey sibling split was not observed in natural runs. F helper-condition mismatch was not observed in natural attack attempts, though Micro I confirms it can occur by geometry. G small-pack attack penalty is present in formulas but not enough alone to explain target splitting and helper success 0.

### Validation
Inline script syntax OK. `node --check organism_render.js` OK. `scripts/*.cjs` syntax OK. `git diff --check` OK. Micro A-L OK. Seeds `41001/42001/43001` x 6,000 baseline OK. Artificial pack groups 1-4 x 4 scenarios x 30 trials OK. Save/load round trip OK. Normal and developer boot OK. `index.html` and ignored `alife_symbolic_shapes_v1.html` SHA256 matched: `7825580EC245BF44A67B3BCF568DAEA7EBB0AC22F72FC3561A1CDA3C7BC4010A`. Page error 0. NaN/Infinity 0. Normal-mode 180-organism FPS smoke: average FPS `10.83`, average update `8.06ms`, errors `0`; no major degradation from the known ~12 FPS smoke baseline. Detailed pack telemetry is capped (`context=3600`, `attackAttempts=3200`, `targetEvents=3200`) and disabled by default.

### Adoption judgment
Adopt as a diagnostic commit. It changes telemetry and developer runner only, keeps normal behavior and parameters unchanged, records all pack attack attempts including failures, compares the four existing pack-count definitions, separates target sharing from target conflict, separates same/different/targetless helpers, exposes speciesKey sibling split diagnostics, and completes the requested normal and artificial runs.

## 2026-07-16 Pack target consensus A/B

### Purpose and baseline
Baseline commit: `693e95f8afb4c09b16cecfc1cbb94344d6db43cc`.
The goal was to implement only a pack target-consensus mechanism and test whether aligning nearby same-species pack targets reduces target fragmentation and improves predation or lineage continuity. Birth energy, clutch, maturity, metabolism, predation probability, `0.78 + 0.095 * mates`, chase force, pack bonus, helper conditions/radius, speciesKey, predation energy, energy sharing, reproduction, food, population cap, UI, save format, and Wiki were not changed. `shareFraction` remains `0`.

### Implementation
Added feature flag `diagnosticPackSharing.targetConsensus`, default `false`. Normal baseline behavior is unchanged unless the flag is enabled through diagnostic runs.

In `socialSteer()`, pack/hunt-pack individuals now optionally tally valid `preyTargetId`s held by living same-species pack/hunt-pack mates inside the existing social range. For targetless individuals, existing target sharing remains in place. For individuals already holding a different target, consensus switching is allowed only when the consensus target is valid, support is at least 1, the current target has 0 mate support, there is no tie/current support, the switch cooldown is clear, and the consensus target is not too far: `<= currentDistance * 1.25`, or `<= currentDistance * 1.50` with support >= 2. The logic consumes no random numbers.

Added transient per-organism state: `packConsensusTargetId`, `packConsensusHoldT`, and `packConsensusSwitchCD`. Hold defaults to 50 steps and switch cooldown to 40 steps. Held targets are cleared when dead/invalid/far. Target oscillation is counted when the same individual returns to a prior target within 60 steps.

Added telemetry counters: `consensusOpportunities`, `consensusApplied`, `consensusSwitches`, `consensusKeptCurrent`, `consensusBlockedByDistance`, `consensusBlockedByCooldown`, `consensusTargetInvalid`, and `targetOscillations`.

### Micro A-F
All OK and all consensus operations consumed 0 random calls.
A targetless pack joined mate target. B unsupported current target switched to supported consensus. C current target with support was kept. D distant consensus target was blocked. E cooldown blocked switching. F dead held target cleared and allowed reselection.

### Artificial A/B
Each group size/scenario ran 30 trials for 260 steps. Key case, 4 pack all-different-targets: baseline convergence `46.7%`, split `100%`, same-target duration `0.73`, helper attack `3.3%`, predation success `3.3%`; consensus convergence `76.7%`, split `100%`, same-target duration `20.03`, helper attack `10.0%`, predation success `10.0%`. Consensus improved convergence and success in this hardest case, but did not reduce the split rate.

4 pack one-target: baseline success `86.7%`, consensus `56.7%`. 4 pack all-same-target: baseline success `56.7%`, consensus `53.3%`. 2 and 3 pack scenarios were mixed; consensus improved some target durations but was not uniformly better.

### 6,000-step world A/B
All six runs completed with page error 0 and NaN/Infinity 0.

| variant | seed | formation born pack | mature | max pack depth | same-target pursuit | helper attacks | same-target helper attacks | helper successes | pack Level 3 | end pack |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | 41001 | 3 | 2 | 2 | 495 | 14 | 6 | 0 | 0 | 0 |
| consensus | 41001 | 15 | 11 | 5 | 2857 | 41 | 28 | 2 | 0 | 0 |
| baseline | 42001 | 2 | 0 | 1 | 125 | 1 | 1 | 0 | 0 | 0 |
| consensus | 42001 | 2 | 0 | 1 | 126 | 1 | 1 | 0 | 0 | 0 |
| baseline | 43001 | 2 | 0 | 1 | 148 | 1 | 0 | 0 | 0 | 0 |
| consensus | 43001 | 2 | 0 | 1 | 147 | 1 | 0 | 0 | 0 | 0 |

Consensus target switches/oscillations: seed41001 `12 switches / 1 oscillation`, seed42001 `0 / 0`, seed43001 `1 / 2`. Natural split event counts did not decrease: `6/1/3` remained `6/1/3`. Different-target opportunities decreased in capped event view and consensus counters show most cases were kept current due current support/tie/hold, with low oscillation.

Population remained viable: consensus end populations were `50`, `92`, `120`; end carnivores remained `0` in all seeds. Energy/nutrient generation events remained `0`; max positive energy residuals were only floating-point noise (`<= 2.84e-14`).

### Adoption judgment
Do not enable consensus by default yet. The mechanism clearly improves the targeted artificial 4-pack all-different case and seed41001 same-target pursuit/helper attacks, with low oscillation and no conservation/page/NaN issues. However, it did not reduce split event counts in natural runs or the hard artificial split-rate metric, did not produce pack Level 3, and was mixed or worse in several artificial scenarios. Keep it as a feature-flagged diagnostic/candidate implementation for the next tuning decision; do not add attack-probability or energy compensation in this task.

### Validation
Inline script syntax OK. `organism_render.js` syntax OK. `scripts/*.cjs` syntax OK. `git diff --check` OK. Micro A-F OK. Artificial A/B OK. Seeds `41001/42001/43001` x baseline/consensus x 6,000 steps OK. Save/load round trip OK. Normal and developer boot OK. `index.html` and ignored `alife_symbolic_shapes_v1.html` SHA256 matched: `FC0B11CAFDD1B140BAB0CA6B6E7533E13DFA97FA33F14859A0EA23079B547C69`. FPS smoke in normal default mode: average FPS `17.17`, average update `7.67ms`, errors `0`. Frozen version was not modified.

## 2026-07-16 段階式 A/B 実験基盤と pack attack base スクリーニング

### 実験基盤
`EXPERIMENT_PROTOCOL.md` と `scripts/experiment_harness.cjs` を追加し、baseline / candidate の paired run、軽量スクリーニングから本試験への自動昇格判定、主要指標差分、安全判定、JSON artifact、短い decision summary を共通化した。既存の `runSeededWorldDiagnostic()`、`runArtificialPackFormationExperiment()`、carnivore lineage / pack formation telemetry を再利用し、新しい大規模 telemetry は追加していない。

### 実験条件
実験名: `pack_attack_base`。baseline は `(0.78 + 0.095 * mates) * rareFactor('pack')`、candidate は `(1.00 + 0.095 * mates) * rareFactor('pack')`。変更因子は `packAttackBase` の診断 override のみで、通常デフォルトは `0.78` を維持。`targetConsensus=false`、`shareFraction=0`、target 共有・chaseForce・packBonus・helper 条件/半径・speciesKey・捕食 energy・birthEnergy・clutch・成熟年齢・代謝・移動速度・繁殖・餌供給・個体数上限・UI・save 形式は変更していない。

### Stage 1 結果
自然世界は seeds `41001/42001/43001`、`2,000` steps。人工 pack は group size `1/2/3/4`、`allSameTarget`、各 10 trials、最大 `260` steps。pooled pack 初回捕食率は `+0.25`、pack 成熟率は `+0.00`、pack attack 成功率は `+0.050446`。総終了個体数は `+0.013587`。page error、NaN/Infinity、energy 生成、nutrient 生成はいずれも `0`。Micro は既存 carnivore lineage / pack formation / pack sharing / pack consensus が OK。

### 昇格判断
Stage 1 は不合格。主要改善・3 seed 中 3 seed 非悪化・総終了個体数・安全条件は満たしたが、人工 2 体 pack all-same-target の成功率が baseline `0.90` から candidate `0.80` へ悪化し、非悪化条件を満たさなかった。本試験と完全検証は未実施。

### 最終判断
通常デフォルトは `0.78` のまま維持。candidate override は今後の診断用に残す。詳細結果は `artifacts/experiments/pack_attack_base.json`、判断 summary は `artifacts/experiments/pack_attack_base_decision.json`。
## 2026-07-16 Pack role/socialMode 正規化

### 目的
`role === "pack"` が高速追跡型、`socialMode === "hunt-pack"` が実際の群れ狩りを表していた混線を整理した。生態パラメータの再調整や A/B は行わず、概念とコードの正規化だけを実施した。

### 実装
`role` は捕食スタイル、`socialMode` は社会行動として扱う。旧 `role: "pack"` は `normalizeRole()` で `pursuit` として互換復元する。実際の群れ狩り判定は `isPackHunter(o) => socialMode === "hunt-pack"` に一本化し、高速追跡型は `isPursuitPredator(o)`、待ち伏せ型は `isAmbusherPredator(o)` に分けた。

helper 判定、群れ補正、target consensus、pack formation / lineage telemetry、pack attack 記録、debug summary、role visualization、save/load 復元、micro/artificial pack 生成を新定義へ合わせた。`carnivoreStrategyClass()` は `pack` / `pursuit` / `ambusher` / `other` を返す。追加診断として `window.__alifeDebug.packRoleSocialGroupSummary()` を追加し、A: `pursuit && hunt-pack`、B: `pursuit && !hunt-pack`、C: `!pursuit && hunt-pack`、D: neither の現存数、出生数、成熟数、初回捕食数、繁殖数、終了時個体数を返す。

### 4群 smoke
通常版 seed `41001` / `500` step:

| group | living | births | matured | firstPredation | reproduced | endPopulation |
|---|---:|---:|---:|---:|---:|---:|
| A pursuit + hunt-pack | 0 | 0 | 0 | 0 | 0 | 0 |
| B pursuit only | 2 | 1 | 0 | 1 | 0 | 2 |
| C hunt-pack only | 2 | 0 | 0 | 0 | 0 | 2 |
| D neither | 28 | 13 | 3 | 0 | 0 | 28 |

dev 起動後 20 frame smoke:

| group | living | births | matured | firstPredation | reproduced | endPopulation |
|---|---:|---:|---:|---:|---:|---:|
| A pursuit + hunt-pack | 2 | 0 | 0 | 0 | 0 | 2 |
| B pursuit only | 2 | 0 | 0 | 0 | 0 | 2 |
| C hunt-pack only | 2 | 0 | 0 | 0 | 0 | 2 |
| D neither | 58 | 0 | 0 | 0 | 0 | 58 |

### 検証
inline script 構文 OK（`index.html` / ignored `alife_symbolic_shapes_v1.html` とも 2 blocks）。`node --check organism_render.js` OK。`scripts/*.cjs` 構文 OK。`git diff --check` OK。通常版起動 OK。開発者版起動 OK。save/load round trip OK。Pack sharing / formation / consensus Micro OK。通常版 seed `41001` / `500` step は page error 0、NaN/Infinity 0、diagnostic number health OK。dev 起動 smoke も page error 0、NaN/Infinity 0。`index.html` と ignored `alife_symbolic_shapes_v1.html` の SHA256 は `921EC6AC4A167B670BD53B19BECA0366506F01EF55D692DEB8AF1AB2E145B81D` で一致。凍結版は未変更。

### 採用判断
採用。通常デフォルトの概念を `role=pursuit` と `socialMode=hunt-pack` に分離し、旧 `role=pack` は互換入力としてのみ扱う。生態挙動は変わり得るが、通常版 / dev 版 / save-load / 既存 pack 診断の基本動作は維持できている。

## 2026-07-16 Role x SocialMode 生態マップ診断

### 条件
`EXPERIMENT_PROTOCOL.md` に沿って診断のみ実施。挙動・閾値・捕食倍率・energy は変更していない。静的診断は seed `61001`、50,000 gene samples。実世界診断は seeds `41001/42001/43001/44001/45001`、各 `2,000` steps、`targetConsensus=false`、`shareFraction=0`、`packAttackBase=0.78`。

### 実装
`window.__alifeDebug.roleSocialEcologySummary()`、`roleSocialStaticGeneSpaceSummary()`、`roleSocialReachabilitySummary()` と `scripts/role_social_ecology_diagnostic.cjs` を追加。既存 `computeRole()`、`socialStrategyFromGenes()`、`formFromGenes()`、`telemetry.births`、carnivore lineage / pack formation telemetry を再利用し、初期 census と親の role/socialMode 分類だけを birth record に最小追加した。`packRoleSocialGroupSummary()` は互換 API として維持。

### 結果
静的 A/B/C/D 比率は `4.646% / 4.078% / 1.416% / 89.860%`。A は遺伝的には極端に希少ではない。実世界 pooled では A は initial `19`、births `4`、matured `0`、first predation `0`、reproduced `0`、livingEnd `0`。C は births `3`、matured `2`、reproduced `1`、livingEnd `1` だが first predation は `0`。D-carnivore は births `33`、matured `11`、first predation `8`、reproduced `4`。C の内訳は scav births `2`、other births `1`。B は出生なしで、初期個体は solitary `12`、school `1`。

### 判断
支配的分類は「B. 出生はするが早期淘汰」。A は静的 gene 空間では十分発生可能だが、実世界では少数出生しても `survived180=0`、成熟・初回捕食・繁殖が 0。次に変更すべき一点は、pack attack 倍率ではなく `pursuit + hunt-pack` の初回捕食前生存、特に出生 energy / 単独時生存 / 初回捕食までの到達条件のどれが詰まっているかの切り分け。

### 検証
inline script 構文 OK（`index.html` / ignored `alife_symbolic_shapes_v1.html`）。`organism_render.js` 構文 OK。`scripts/*.cjs` 構文 OK。`git diff --check` OK。5 seeds x 2,000 steps 完走。page error `0`、NaN/Infinity `0`、energy creation `0`、nutrient creation `0`。通常版起動 OK、開発者版起動 OK、save/load round trip OK。詳細は `artifacts/experiments/role_social_ecology.json`、判断 summary は `artifacts/experiments/role_social_ecology_decision.json`。

## 2026-07-16 16:10 Evolvable life history strategies

### 実装
`evolvableLifeHistory: false` を追加し、通常デフォルトは旧挙動維持。ON 時だけ `energyCapacity`、`fecundity`、`parentalInvestment` を独立した生活史軸として使うようにした。新しい `energyCapacity` と `parentalInvestment` は欠損時に旧7遺伝子から決定論的 hash で補完し、初期個体で追加の `Math.random()` を消費しない。`energyCapacity` は `Math.pow(hashValue, 3.5)`、`maxEnergy = 160 * Math.pow(1000 / 160, energyCapacity)`。`parentalInvestment` は `0.25..0.75` の投資率へ写像する。

feature ON の繁殖では、親の総投資 energy をクラッチで分け、子数増加で総 child energy が増えない構造にした。無性繁殖は `parent.energy * investmentRate * 0.90 / clutch`、有性繁殖は両親の `parentalInvestment` に基づく投資合算を使う。`MIN_VIABLE_BIRTH_ENERGY = 20` と容量連動の `effectiveReproThreshold = base + 0.14 * max(0, maxEnergy - 160)` を追加。role、diet、socialMode による子数・投資率・出生 energy 補正は追加していない。

`__alifeDebug.setEvolvableLifeHistory()`, `lifeHistorySummary()`, `runLifeHistoryMicroTests()`, `runLifeHistoryReproducibilityMicroTest()` を追加。birth record へ `parentRole`, `parentSocialMode`, `parentEnergyCapacity`, `parentParentalInvestment`, `parentFecundity`, `clutch`, `totalInvestment`, `childEnergyEach`, `parentEnergyAfter` を保存する。reset 時に `roleShare` / `dietShare` を初期値へ戻し、環境 dots を完全初期化。dots 表示用乱数は専用 RNG に分離した。

### 検証
inline script 構文 OK、`organism_model.js` 構文 OK、`organism_render.js` 構文 OK、`scripts/*.cjs` 構文 OK、`git diff --check` OK。通常版起動 OK、開発者版起動 OK、save/load round trip OK。`runLifeHistoryMicroTests()` OK。短い seeded smoke（seed `41001`, `120` steps）で page error `0`、NaN/Infinity `0`、energy creation `0`、nutrient creation `0`。feature OFF の `averageMaxEnergy` は `160`、ON の初期平均 `maxEnergy` は約 `257.26`。

## 2026-08-03 B最新版整理とClaude顕微鏡表現の統合

### ベース整理
`origin/main` 以後の B 系列を分類し、Canvas 最適化までの `f48bd4b` と、藻類再生スライダー・個体数グラフ／ナビゲーターの3コミットを採用した。WebGL／プロシージャル描画／近接LOD／高個体数クリフ調査は診断・実験成果として元ブランチに残し、通常版のベースからは除外した。

### 顕微鏡レンズ
Claude と調整した `organism_roster_art.js` の高精細・半透明・DIC風表現を通常描画へ常時置換せず、明示的にONにする円形の「顕微鏡レンズ」として統合した。レンズ外は既存 Canvas 描画を維持し、レンズ内だけ最大10体を 3.2x で再描画する。`Math.random()` は消費せず、保存対象のモデル状態・個体数へ影響しない。独立確認用 `lens_prototype.html` も残した。

### 検証と性能
`scripts/microscope_visual_integration_smoke.cjs` で UI ON/OFF、renderer 読込、描画上限、モデル／個体数非干渉、visual RNG 非干渉、console/page error なしを確認。固定した生物位置で3体を描画し、最終 headless Chromium 60 samples では draw ms 中央値／p95 が OFF `1.66/1.98`、ON `2.71/3.05`。スクリーンショット `artifacts/visual-integration/microscope-lens.png` を目視し、円形池・通常描画・レンズ境界・UIに崩れなし。

既存 `scripts/algae_population_controls_smoke.cjs` は Pack の自然成立を20 step待つランダム依存があったため、指定個体から診断用 Pack を明示生成する `createPackForDiagnostic()` を追加して再現可能にした。UI smoke は藻類スライダー、save/load、履歴、種／Pack ナビゲーション、reset、エラーなしを再確認した。

### ファイルと判定
`alife_symbolic_shapes_v1.html` を正本として `index.html` に同期し、SHA-256 一致。`node scripts/check_inline_script.cjs index.html`、関連JSとsmoke scriptの `node --check`、`git diff --check` は合格。凍結版 HTML は未変更。統合候補として採用し、公開は別判断とする。
