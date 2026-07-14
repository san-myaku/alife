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
