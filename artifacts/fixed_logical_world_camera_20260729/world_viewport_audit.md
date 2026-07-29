# W/H依存監査

基準HEAD: `ee359044fa3024bc13075d6aa9a0ee274eb966a8`

対象の基準HEADには `alife_symbolic_shapes_v1.html` が存在せず、履歴にも同名ファイルがない。実行本体・正本は `index.html` だけだったため、今回の編集対象は `index.html` とした。凍結版は変更していない。

## 監査結果

| 分類 | 対象 | 基準HEADでのW/H利用 | 分離後 |
|---|---|---|---|
| MIXED | canvas resize | canvas CSS幅・高さを `W/H` へ代入し、環境 `ensure()` も呼んでいた | `VIEW_W/VIEW_H`、backing store、DPR、camera clampだけを更新 |
| MODEL | 環境グリッド | `ceil(W/cell) × ceil(H/cell)` | `ceil(WORLD_W/cell) × ceil(WORLD_H/cell)`。resizeから再生成されない |
| MODEL | 個体初期配置 | `rnd(20,W-20)` / `rnd(20,H-20)` | 固定世界座標 |
| MODEL | 個体移動境界 | 個体・餌・プランクトンを `W/H` でclamp/反射 | 固定世界境界 |
| MODEL | 出生位置 | 親位置±spreadを `W/H` でclamp | 固定世界境界 |
| MODEL | 餌・死骸・プランクトン | 初期配置、自然発生、死骸デトリタスを `W/H` 内へ生成 | 固定世界座標 |
| MODEL | パッチ | `W/H` 比率で中心・半径を決定 | 固定世界座標 |
| MODEL | 水流・膜・transient | world objectの位置・寿命・当たり判定 | 固定世界座標 |
| MODEL | 空間インデックス | grid幅・高さ、面積、cell indexが `W/H` 依存 | 固定世界面積・固定境界 |
| MODEL | 捕食・交配・Pack | object座標、距離、neighbor queryを利用 | すべて固定world座標。距離定数は未変更 |
| INPUT | 個体選択 | screen座標をそのままworld座標として探索 | `screenToWorld()` 後に探索。screen最小タップ半径をworld換算 |
| INPUT | 餌・煙・変異・膜 | screen座標をそのままmodelへ投入 | 全経路を `screenToWorld()` に統一 |
| MIXED | 選択表示 | world ringとカードを同じ座標系で描画 | ringはworld、カード・指示線はscreenへ分離 |
| MIXED | トースト指示線 | DOM上の始点とworld targetを同一座標扱い | targetを `worldToScreen()` で変換 |
| MIXED | 観察オーバーレイ | field格子とlabelが同じ描画transform | fieldはworld、labelはscreen |
| VIEW | HUD | `W/H` の右下へ配置 | `VIEW_W/VIEW_H` の右下へ配置 |
| VIEW | canvas backing store | `W/H × DPR` | `VIEW_W/VIEW_H × DPR` |
| MODEL | セーブ・ロード | env/個体/Pack/lineageを保存。世界寸法metadataなし | `worldVersion/worldWidth/worldHeight` を追加。旧形式は明示拒否 |
| MIXED | debug API | world操作とcanvas状態の区別が弱い | world geometry、camera、変換、interaction stateを明示 |
| MODEL | 診断runner | outer viewportにより実canvas/model寸法が変化 | viewportを変えても固定worldで同一hash |

## 直接監査した主要関数

- Canvas/View: `resize()`, `draw()`, `drawBackground()`, `drawHUD()`, `drawObservationLabel()`
- Environment: `ensure()`, `captureState()`, `restoreState()`, `drawPixels()`, `drawAlgaeMosaic()`
- Entity/model: `Food.step()`, `Plankton`, `Organism.step()`, reproduction child placement, `seedPatches()`, `seedPlankton()`, `addFood()`
- Spatial/ecology: `ensureGrid()`, `autoAdjustGrid()`, `buildSpatialIndex()`, `forEachOrgNeighbors()`
- World effects: world events, rings, membranes, currents, observation field
- Input/UI: pointer handlers, `nearestOrganismAt()`, selection card, toast pointers, manual tools
- Persistence/diagnostics: `capture()`, `restore()`, `runSeededWorldDiagnostic()`, `window.__alifeDebug`

## RNG監査

- resize、camera、world/screen変換、全景、選択へ、選択解除は `Math.random()` を呼ばない。
- 端末別だった個体最大サイズ係数を固定し、model phenotypeの端末差を除去した。
- mobile/desktopで個数が異なっていたparallax初期化と捕食visual particle生成数を統一し、visual生成によるmodel RNG消費差を除去した。
- adaptive renderingは描画品質だけを変え、model object、field、距離、個体サイズを変更しない。

## 境界の中央集約

- 長方形world寸法は `WORLD_W/WORLD_H` の一箇所。
- 既存コードとの安全な移行のため `W/H` は固定world専用aliasとして残した。resizeから代入されず、view配置には使用しない。
- 将来の円形池は `clampCamera()` ではなくmodel境界helperを追加する独立milestoneとする。
