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
