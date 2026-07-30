# species / lineage 最終設計

## speciesKey

- 種。
- 有性生殖の一致条件。
- Pack形成・途中加入・出生継承・所属修復の一致条件。
- actual Pack協力狩りの生物学的identity条件。
- 判定は既存 `speciesKey` の完全一致だけ。

## lineageId

- 血統。
- 進化枝と親子関係。
- provisional / established / failed / 絶滅の記録。
- generation、系統樹、canonical appearance、telemetry、save/loadに使用。
- 交配候補の優先・遮断には使わない。
- Pack形成・加入・継承・離脱・協力狩りには使わない。

## 通常ルール

- 同じ `speciesKey`・違うlineage: 有性生殖、Pack形成、途中加入、出生継承、同一Pack内協力が可能。
- 違う `speciesKey`・同じlineage: 上記は不可。
- 同種の有性生殖相手がいない場合は、既存条件のまま無性生殖を評価する。
- 子が両親のPackへ適合する場合はprimary parent Packを優先し、不適合ならmate Packを使う。乱数は消費しない。
- lineage recordの状態変化だけを理由にPackから離脱させない。

## 今回変更していないもの

`speciesKey` の生成、突然変異率、繁殖率・コスト・閾値・出生数、無性生殖率、Pack距離・更新間隔・協力係数、生態バランス、lineage分岐・昇格条件、世界形状、カメラ、出生エフェクト。

## 採用判断

責務・不変条件・save migrationは採用可能な状態だが、代表3seed×2,000stepでは自然Pack形成が0だったため、branch全体としては現時点で採用候補にしない。

同期間の終了個体群は42～58 species、うち27～32 speciesが単独個体だった。交配は維持された一方、同種hunt-pack個体が形成距離内に揃わず、既存 `speciesKey` がPackの種単位として細かすぎる兆候がある。今回のbranchでは定義・距離・率を緩めていない。
