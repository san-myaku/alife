# Persistent Pack cooperative hunting audit

基準: `dcc22eaba9fb9116e793b89f88bb57ac4cd0108c`

## 旧経路と変更方針

| 処理 | 基準HEADの仲間判定 | 監査結果 | actual Pack接続 |
|---|---|---|---|
| 群れ狩り仲間の検索 | `socialMode === 'hunt-pack'` + `samePackBehaviorIdentity` + 近傍 | lineage-aware時はlineage、OFF時はspeciesKey。packId一致は不要だった | ON時はactive registry、同一packId、同一lineage、生存、hunt-packを全て要求 |
| 標的共有 | 社会行動距離内の同一behavior identity | packIdが違う同種・同lineage個体からも共有可能だった。targetless個体は有効targetを即採用 | actual Pack memberだけ。受信者の通常target保持上限内かつ有効な獲物だけ採用 |
| 標的選択 | 自個体の感知範囲内scan + target score | 通常scanは個体単独。共有targetだけ近隣仲間由来 | 通常scanは維持。共有targetはactual Pack情報として限定的に追加 |
| 標的維持・解除・切替 | 死亡・保護・同種除外、距離超過24 step、score/距離差による再評価。診断専用consensusは通常OFF | actual Pack supportを使う通常挙動はなかった | 共有targetだけ54 step以内の短期保持。近隣support終了、Pack過半数の追跡終了、48 step進展なし、無効化、距離超過で解除。明確に有利な候補には切替可能 |
| 追跡方向 | 自身の`preyTargetId`方向 + 80px内のbehavior identity人数で既存steering bonus | packId不一致個体も人数へ入った | ON時の人数をactual Pack memberだけへ限定。係数は変更しない |
| 攻撃成功率の仲間数 | 獲物76px内のbehavior identity人数。active Pack人数を別途加算 | species/lineage近傍とactual Packが混在 | ON時は両人数ともactual Pack member母集団に限定。既存係数は変更しない |
| 大きい獲物の条件 | 獲物76px内helperのsizeを既存係数0.53で合算 | packId不一致helperもeffective sizeへ入った | helper母集団をactual Pack memberだけへ限定。size係数は変更しない |
| Pack中心・仲間への移動 | 社会行動距離内のbehavior identity中心・速度へ既存cohesion/alignment | active Pack外の同種・同lineage個体も含んだ | ON時の既存social steer対象だけactual Pack memberに限定。新しい引力や速度補正は追加しない |
| 捕食イベントの協力者記録 | `eligiblePackHelpers`と近傍人数を記録 | 旧behavior identity母集団を記録 | ON時はactual Pack helper ID・人数を記録 |

## feature OFF

`packCooperativeTargeting`がOFF、またはlineage-aware Persistent Packの前提がOFFなら、従来の`samePackBehaviorIdentity` / `socialMode` / 近傍判定を使用する。OFF経路では新しいtarget状態を作らず、新telemetryはモデル乱数を消費しない。

## 不変条件

- cross-pack target sharing = 0
- mixed-lineage cooperation = 0
- invalid target sharing = 0

別Pack、Packなし、lineage不整合は「拒否」として別カウンタへ記録し、上記の誤協力カウンタには入れない。
