# 初期藻場 patchy-intermediate 検証

- 基準commit: `e1c5de951700a49b40ff5177d61e4a53141d3f1e`
- 検証step: 750
- seed: 41001, 43001
- page error: 0
- console error: 0
- NaN / Infinity: 0

## 初期統計

| mode | seed | hash | min | max | mean | median | stddev | low | medium | high | resource patches |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| patchy-intermediate | 41001 | `a0ae915b` | 0.0200 | 0.3400 | 0.1425 | 0.1300 | 0.0865 | 25.0% | 50.0% | 25.0% | 13 |
| legacy-uniform | 41001 | `9ecabae0` | 0.2500 | 1.0000 | 0.2542 | 0.2500 | 0.0382 | 0.0% | 0.0% | 100.0% | 1 |

patchy平均は旧全面値0.25の57.0%。目標範囲0.1125〜0.1500内: yes。

## 機能チェック

- 同seed・同mode hash一致: true
- 異seed hash差: true
- legacyが基準commitと一致: true
- patchy分散 > 0: true
- save/load後hash一致: true
- load後に再生成なし: true
- resetで同seed初期hashへ復帰: true
- metadata無し既存save互換: true
- envState無し旧save fallback: true
- roundTrip: true

## 750 step比較

- seed 41001 / legacy-uniform: pop 64→70 (peak 71, cap到達 なし), 繁殖 42, 120step草食high 100.0%→100.0%, 雑食high 100.0%→100.0%, 藻平均 0.2542→0.3206→0.7278, 750step草食/雑食high 100.0%/100.0%, 草食recent grazer 45, 雑食recent grazer 19, 肉食nearest prey平均 n/apx, 肉食 16→0
- seed 41001 / patchy-intermediate: pop 64→41 (peak 65, cap到達 なし), 繁殖 30, 120step草食high 9.5%→66.7%, 雑食high 22.2%→53.8%, 藻平均 0.1425→0.1962→0.6134, 750step草食/雑食high 100.0%/100.0%, 草食recent grazer 24, 雑食recent grazer 10, 肉食nearest prey平均 79.7px, 肉食 16→3
- seed 43001 / legacy-uniform: pop 64→69 (peak 70, cap到達 なし), 繁殖 51, 120step草食high 100.0%→100.0%, 雑食high 100.0%→100.0%, 藻平均 0.2542→0.3191→0.7220, 750step草食/雑食high 96.7%/100.0%, 草食recent grazer 58, 雑食recent grazer 5, 肉食nearest prey平均 74.8px, 肉食 16→3
- seed 43001 / patchy-intermediate: pop 64→44 (peak 67, cap到達 なし), 繁殖 26, 120step草食high 20.0%→51.7%, 雑食high 16.7%→60.9%, 藻平均 0.1425→0.1946→0.5999, 750step草食/雑食high 100.0%/100.0%, 草食recent grazer 33, 雑食recent grazer 10, 肉食nearest prey平均 n/apx, 肉食 16→0

## 判定

採用候補。初期藻場のみを変更し、決定性・legacy比較・save/load・reset・数値健全性を満たした。
