# Performance Profile 要約

## Profile条件

- 2000個体、通常描画、実行中、約4秒のCDP CPU/Allocation Profile。
- ベースライン 645e163ecd4cea97fd9e397ca5564de7413b29e6、最適化版 693c7e7053d75e3d92489d28248a64dc17c39200。
- 併せてPerformanceObserverのlongtask/GC、Chrome Performance.getMetrics、静的構文カウントを取得。

## 処理カテゴリ別

| カテゴリ | 前 avg ms | 前 median | 前 p95 | 前 max | 前 calls/frame | 後 avg ms | 後 p95 | 後 calls/frame |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| totalFrame | 2140.66 | 2416.50 | 2649.90 | 2649.90 | 0.89 | 716.64 | 966.60 | 0.92 |
| simulationUpdate | 200.43 | 197.90 | 245.90 | 245.90 | 1.00 | 169.58 | 200.50 | 1.00 |
| organismUpdate | 194.81 | 192.80 | 238.20 | 238.20 | 2000.00 | 163.44 | 194.10 | 2000.31 |
| spatialIndex | 0.66 | 0.60 | 1.00 | 1.00 | 1.00 | 0.90 | 1.40 | 1.00 |
| foodSearch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| carcassSearch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| planktonSearch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| targetLookup | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| reproduction | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| predation | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| deathRemoval | 0.13 | 0.10 | 0.60 | 0.60 | 1.00 | 0.13 | 0.60 | 1.00 |
| telemetryStatistics | 4.16 | 3.70 | 5.50 | 5.50 | 11.00 | 4.47 | 6.50 | 11.00 |
| trailHistory | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| environmentUpdate | 0.00 | 0.00 | 0.00 | 0.00 | 1.00 | 0.00 | 0.00 | 1.00 |
| drawTotal | 2099.71 | 2143.30 | 2379.30 | 2379.30 | 1.00 | 505.94 | 567.50 | 1.00 |
| environmentDraw | 64.40 | 66.50 | 87.60 | 87.60 | 2.00 | 64.08 | 87.20 | 2.00 |
| organismDraw | 2034.02 | 2090.50 | 2311.20 | 2311.20 | 2000.11 | 440.16 | 487.10 | 2000.38 |
| resourceDraw | 0.54 | 0.60 | 0.80 | 0.80 | 61.56 | 0.52 | 0.90 | 61.69 |
| effectsDraw | 0.04 | 0.00 | 0.30 | 0.30 | 1.11 | 0.06 | 0.40 | 1.38 |
| uiHudDraw | 1.48 | 1.40 | 2.40 | 2.40 | 3.00 | 1.79 | 7.80 | 3.00 |
| otherUpdate | 0.68 | 0.40 | 1.90 | 1.90 | 0.00 | 0.64 | 1.80 | 0.00 |
| otherDraw | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |

food/carcass/plankton searchなど0の項目は「常に無料」ではなく、この強制2000個体Profileで対象資源がほぼ無く、計測区間の呼び出しが0だったことを示す。別途、食物資源数と静的全件走査を確認し、現時点の主要ボトルネックではないと判断した。

## CPU self time 上位（変更前）

| 関数 | self ms | total ms | samples |
|---|---:|---:|---:|
| drawImage | 1442.18 | 1442.18 | 893 |
| restore | 637.93 | 637.93 | 397 |
| (program) | 378.79 | 378.79 | 118 |
| trimSymbolSpriteCache | 360.98 | 360.98 | 221 |
| drawOrganism | 333.86 | 1156.07 | 207 |
| clearRect | 276.25 | 276.25 | 172 |
| (garbage collector) | 222.13 | 222.13 | 139 |
| symbolShapePath | 186.41 | 238.94 | 116 |
| getContext | 134.07 | 134.07 | 83 |
| fill | 129.90 | 129.90 | 81 |
| stroke | 124.12 | 124.12 | 78 |
| addColorStop | 70.05 | 70.05 | 44 |

## CPU total time 上位（変更前）

| 関数 | self ms | total ms | samples |
|---|---:|---:|---:|
| (root) | 0.00 | 5300.55 | 0 |
| loop | 3.19 | 4689.72 | 2 |
| draw | 7.60 | 4342.64 | 5 |
| draw | 1.61 | 4182.76 | 1 |
| drawSymbolic | 9.99 | 4179.52 | 6 |
| getSymbolSprite | 54.58 | 2051.06 | 34 |
| drawImage | 1442.18 | 1442.18 | 893 |
| drawSymbolicLive | 34.37 | 1192.06 | 21 |
| drawOrganism | 333.86 | 1156.07 | 207 |
| restore | 637.93 | 637.93 | 397 |
| (program) | 378.79 | 378.79 | 118 |
| trimSymbolSpriteCache | 360.98 | 360.98 | 221 |

## CPU self time 上位（変更後）

| 関数 | self ms | total ms | samples |
|---|---:|---:|---:|
| restore | 1897.94 | 1897.94 | 1180 |
| (program) | 717.90 | 717.90 | 336 |
| transferToImageBitmap | 326.74 | 326.74 | 200 |
| paintCell | 173.97 | 347.55 | 108 |
| fillRect | 170.31 | 170.31 | 105 |
| step | 140.10 | 923.56 | 87 |
| drawOrganism | 110.19 | 325.12 | 68 |
| forEachOrgNeighbors | 108.94 | 112.18 | 69 |
| updateModel | 74.97 | 1038.33 | 47 |
| bestAlgaeNear | 60.04 | 60.04 | 37 |
| forEachOrgNeighbors | 57.47 | 106.90 | 35 |
| separateFromNeighbors | 52.90 | 165.08 | 33 |

旧版の `trimSymbolSpriteCache` はself 360.98 msかつ約443.2 MiBを割り当てていた。最適化後は上位から消え、`drawImage` selfも 1442.18 → 34.11 ms。代わって初回キャッシュ生成の `transferToImageBitmap` とCanvas `restore`、更新側の `step` / `forEachOrgNeighbors` が顕在化した。

## Allocation Profile

変更前 sampled 906.0 MiB（226.5 MiB/s）、変更後 447.7 MiB（111.9 MiB/s）。sampled bytesは -50.6%。

### 変更前 self allocation

| 関数 | self MiB | total MiB |
|---|---:|---:|
| trimSymbolSpriteCache | 443.2 | 443.2 |
| drawOrganism | 126.6 | 151.0 |
| paintCell | 37.6 | 38.1 |
| predationCandidateClassification | 35.8 | 71.3 |
| getEffectivePredationSizeRatio | 35.4 | 35.4 |
| forEachOrgNeighbors | 21.8 | 31.9 |
| bestAlgaeNear | 20.4 | 31.4 |
| step | 16.3 | 262.4 |
| predationCandidateClassification | 15.8 | 30.7 |
| getEffectivePredationSizeRatio | 14.9 | 14.9 |

### 変更後 self allocation

| 関数 | self MiB | total MiB |
|---|---:|---:|
| paintCell | 52.9 | 52.9 |
| step | 51.1 | 332.2 |
| bestAlgaeNear | 37.8 | 57.4 |
| predationCandidateClassification | 29.9 | 53.5 |
| forEachOrgNeighbors | 25.3 | 32.6 |
| forEachOrgNeighbors | 25.1 | 27.9 |
| forEachOrgNeighbors | 21.9 | 21.9 |
| hypot | 19.6 | 19.6 |
| drawOrganism | 19.5 | 25.0 |
| forEachOrgNeighbors | 16.5 | 16.5 |

CPU Profile上のGCは変更前 222.13 ms / 139 samples、変更後 32.38 ms / 20 samples。GC self timeは -85.4%。

## Long task / Layout / Style

| 指標 | 変更前 | 変更後 |
|---|---:|---:|
| long task数 | 10 | 13 |
| long task合計 ms | 22794.00 | 9838.00 |
| 最長task ms | 2637.00 | 849.00 |
| LayoutCount | 5 | 9 |
| LayoutDuration ms | 2.464 | 4.878 |
| RecalcStyleCount | 5 | 9 |
| RecalcStyleDuration ms | 0.901 | 0.630 |
| ScriptDuration ms | 11945.7 | 6355.3 |

Layout/styleはscript/canvas時間に比べて無視できる。DOM HUDではなくCanvasと個体updateが支配的。

## 静的監査

ベースライン 33879 行で、`find` 47、`filter` 393、`map` 416、`splice` 55、`{x,y}`相当 312 箇所。これは呼び出し回数ではなく候補箇所数。CPU/Allocation Profileと照合し、実測上位だけを変更した。

Canvas API候補は save 34、restore 34、translate 15、rotate 8、beginPath 87、arc 59、fillText 10 箇所。実際に `setTransform` 置換も試したが悪化したためrevertした。
