# 藻再生バランス診断

- 基準commit: `0c4d29b5ebb823adf83e4083fc2583a92c53ae8a`
- phase: final
- steps: 2000
- seeds: 41001, 43001, 51001

## legacy scale 1.0

- 最終平均藻量: 0.8850
- 最終藻量標準偏差: 0.0917
- cap到達: 3/3、中央値frame: 1400
- 草食/雑食/肉食の餓死: 40/45/73
- 草食/雑食の過密死: 285/31
- 再生/分解入力/採食除去: 5203.83 / 478.88 / 1823.34
- 終了時H/M/C合計: 333/32/0

## resource-limited scale 0.7

- 最終平均藻量: 0.7792
- 最終藻量標準偏差: 0.1060
- cap到達: 3/3、中央値frame: 1710
- 草食/雑食/肉食の餓死: 52/53/67
- 草食/雑食の過密死: 59/13
- 再生/分解入力/採食除去: 4188.50 / 415.43 / 1212.48
- 終了時H/M/C合計: 299/68/1

## flag OFF非干渉

- base hash: `bfd00b9bbdcd97d34dc0af4dcfcd9da819b7bef6463d742ac4b4025e78d9ee48`
- current OFF hash: `bfd00b9bbdcd97d34dc0af4dcfcd9da819b7bef6463d742ac4b4025e78d9ee48`
- 一致: true

## save/load・reset

- save version: 13
- feature保存/復元: true/true
- default/復元後scale: 0.7/0.7
- 保存field維持: true
- 同seed reset再現: true
- 旧save field維持/新feature既定ON: true/true

