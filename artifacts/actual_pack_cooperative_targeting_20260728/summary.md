# actual Pack cooperative targeting 検証

- 基準HEAD: `dcc22eaba9fb9116e793b89f88bb57ac4cd0108c`
- seed: 41001, 43001, 45001
- step: 2000
- Micro: PASS
- flag OFF model state一致: true
- flag OFF base/current hash: `0bd0002a8ac8414a79449b4a64675efc391c0d8daea89a18554417f0c953edc0` / `0bd0002a8ac8414a79449b4a64675efc391c0d8daea89a18554417f0c953edc0`
- page/console error: 0
- NaN / Infinity: 0

## 3 seed集計

- Pack作成: 2
- 最大Pack規模: 2
- 最大Pack世代深度: 3
- omnivore Pack: 0
- target共有観測 / 採用 / 拒否: 401 / 3 / 622
- 最大同時追跡actual Pack人数: 2
- actual Pack全target切替 / 共有target切替: 0 / 0
- seed 41001 actual Pack全target切替 ON / OFF: 0 / 0
- shared target→contact / kill: 2 / 0
- 同lineage・別speciesKey協力: 0
- cross-pack / mixed-lineage / invalid sharing: 0 / 0 / 0
- 肉食出生 / 成熟 / 死亡: 22 / 17 / 93
- energy / nutrient creation: 0 / 0
- roundTrip: true

## seed別

| seed | packs | max size | max gen | shares adopted | max trackers | contact | kill | target switches | end H/M/C | cap frame | carn extinction |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| 41001 | 1 | 2 | 3 | 0 | 1 | 0 | 0 | 0 | 108/14/0 | 1330 | 1187 |
| 43001 | 1 | 2 | 1 | 3 | 2 | 2 | 0 | 0 | 119/1/0 | 1410 | 839 |
| 45001 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 120/1/0 | 1050 | 749 |

## 判定

採用候補。actual Pack内の自然共有、contact/killへの進行、OFF非干渉、保存則、不変条件を満たした。

固定seedで観測された最大Pack規模は2だった。最終HEADでは、4体以上のPackについても同target追跡者がPack過半数を失った場合、18 stepのgrace後に共有targetを解除するMicroを追加している。この局所修正は上記3 seedの観測経路には影響しない。
