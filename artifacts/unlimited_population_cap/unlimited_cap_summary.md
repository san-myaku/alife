# 無制限個体数上限 検証サマリー

## 実装契約

- 通常ゲームの既定値は有限120のまま。
- 無制限は `populationCapEnabled=false` と有限値の保持で表現し、`Infinity` やマジックナンバーを保存しない。
- 無制限では繁殖抑制とcapacity cullを無効化し、通常ゲームにhard capを追加しない。
- 診断runnerだけは環境保護用safety stop 5,000個体を持ち、到達時はcullせずrunaway終了する。

## Micro / UI

- UI: PASS
- A〜F: PASS
- console error: 0

## 3 seed × 20,000 step

### seed 41001

- 実行: 20,000 / 20,000 step
- 最大個体数 / 終了時個体数: 1108 / 114
- capacity死 / capacity cull死: 0 / 0
- safety stop: 未到達
- 自然平衡 / 周期的変動 / 増加継続: no / yes / no
- tail trend: 14.527149 個体 / 1,000 step
- Pack数 / 最大同時Pack / hunt-pack個体: 0 / 1 / 0
- species数 / established lineage数: 7 / 94
- 処理速度: 45.495 step/s（21.9788 ms/step）
- NaN / Infinity: 0
- console error: 0

### seed 43001

- 実行: 20,000 / 20,000 step
- 最大個体数 / 終了時個体数: 1962 / 1962
- capacity死 / capacity cull死: 0 / 0
- safety stop: 未到達
- 自然平衡 / 周期的変動 / 増加継続: no / no / yes
- tail trend: 61.408597 個体 / 1,000 step
- Pack数 / 最大同時Pack / hunt-pack個体: 0 / 3 / 0
- species数 / established lineage数: 7 / 93
- 処理速度: 73.137 step/s（13.665 ms/step）
- NaN / Infinity: 0
- console error: 0

### seed 45001

- 実行: 20,000 / 20,000 step
- 最大個体数 / 終了時個体数: 1016 / 29
- capacity死 / capacity cull死: 0 / 0
- safety stop: 未到達
- 自然平衡 / 周期的変動 / 増加継続: no / yes / no
- tail trend: 19.906335 個体 / 1,000 step
- Pack数 / 最大同時Pack / hunt-pack個体: 0 / 0 / 0
- species数 / established lineage数: 6 / 94
- 処理速度: 73.429 step/s（13.6175 ms/step）
- NaN / Infinity: 0
- console error: 0

## 集計

- 全seed最大個体数: 1962
- capacity死合計: 0
- safety stop seed: なし
- 自然平衡 seed: なし
- 周期的変動 seed: 41001, 45001
- 増加継続 seed: 43001
- NaN / Infinity合計: 0
- console error合計: 0
