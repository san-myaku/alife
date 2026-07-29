# 標準論理世界の選定

採用: `WORLD_W=872`, `WORLD_H=688`

## 根拠

直近の採用判断に使われたrunnerは、外側Playwright viewportとして `1280×720` を一貫して使用していた。

- `scripts/patchy_algae_diagnostic.cjs`
- `scripts/algae_regrowth_balance_diagnostic.cjs`
- `scripts/algae_regrowth_visual_check.cjs`
- `scripts/actual_pack_cooperative_targeting_diagnostic.cjs`
- `scripts/pack_family_growth_diagnostic.cjs`

基準HEADのdesktop CSSでは、外側 `1280×720` から左右padding 32、panel 360、gap 16、上下padding 32を除いた実canvas/model領域が `872×688` になる。

環境cell sizeは18なので、

`ceil(872/18) × ceil(688/18) = 49 × 39 = 1,911 cells`

となる。これはpatchy-intermediate採用artifactの1,911 cellsと完全一致する。

## 比較

| 既存診断系 | outer viewport | 旧model canvas概算 | world面積 | 縦横比 | 環境cell |
|---|---:|---:|---:|---:|---:|
| 直近patchy / algae / actual Pack | 1280×720 | 872×688 | 599,936 | 1.2674 | 1,911 |
| 以前のmobile campaign | 390×844 | 約374×641 | 約239,700 | 約0.583 | 約756 |

mobile寸法は肉食・初期診断で多用されたが、patchy-intermediate、Persistent Packの直近採用判断、藻再生0.70倍はすべて1280×720系で確定している。したがって、最新の採用条件と藻fieldを維持するには872×688が最小影響。

## 密度維持

- 初期個体数64: `64 / 599,936`
- 上限120: `120 / 599,936`
- 初期個体数、上限、capacity cull、餌、プランクトン、Pack、繁殖、捕食の数値は変更していない。
- 基準outer viewport `1280×720` で `ee35904` と新実装の固定seed model hashが完全一致した。

## 表示方針

- PC・横長: 全景fit。
- スマホ・縦長: 初期状態はA案の全景fit。世界全体とletterboxを明示し、ピンチですぐ拡大できる。
- cameraはuniform zoomのみ。縦横別の引き伸ばしはしない。
- 全景ボタンと選択個体へ戻るボタンをcanvas上に常設する。
