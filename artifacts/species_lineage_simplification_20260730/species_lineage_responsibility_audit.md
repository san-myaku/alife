# species / lineage / Pack 責務監査

- 基準: `origin/main` / `105d534a4b1f8f64e360642d9ae2d7055fd273bf`
- branch: `codex/simplify-species-lineage-pack`
- 対象: `index.html`
- `alife_symbolic_shapes_v1.html` は最新mainにもGit履歴にも存在しないため、最新mainの公開正本 `index.html` を編集対象とした。

## 変更前

### 交配

- `lineageAwareMateSelection` 有効時は同一 `lineageId` を優先した。
- `lineageReproductiveIsolation` 有効時は異なるlineageを遮断した。
- 同一lineageなら `speciesKey` が異なっても有性生殖候補になった。
- isolation無効時だけ同一 `speciesKey` の「legacy fallback」を使った。

### Pack

- `identityMode: lineage` / `identityKey: lineageId` をPackの正準identityにできた。
- 形成、途中加入、出生継承、所属修復、協力狩りでlineage recordの存在・状態・一致を参照した。
- 有性生殖の成立を契機に、通常の形成距離更新とは別経路でPackを作成できた。
- 親子・配偶者周辺の同一lineage個体を一括加入させる経路があった。
- 新規provisional lineageは親Pack継承を拒否した。

### 協力狩り

- 同一active `packId` に加え、同一 `lineageId` と有効なlineage recordを要求した。
- actual Pack無効時は、永続Packに所属していない同種個体も旧来の協力対象になり得た。

## 変更後

### 共通identity

- `sameSpecies(a, b)` が既存 `speciesKey` の文字列完全一致だけを判定する。
- `canSexuallyMate`、Pack形成、Pack record照合、加入、出生継承、協力狩りはこの同じ種概念を使う。
- ecotype、canonical appearance、見た目、lineage relationは種判定に使わない。

### 交配

- 生存、繁殖可能、非self、探索範囲内、同一 `speciesKey` の候補から従来どおり最短候補を選ぶ。
- `lineageId` は候補の優先・遮断に使わない。
- 同種候補がいない場合は既存の無性生殖経路へ進む。率・コスト・閾値・出生数は未変更。

### Pack

- recordの正準identityは常に `pack.speciesKey`。
- 形成は生存、hunt-pack、未所属、形成距離、同一 `speciesKey` に限定。
- 途中加入は生存、hunt-pack、未所属、Pack member近傍、`pack.speciesKey` 一致に限定。
- 出生継承は子がhunt-pack、親がactive Pack所属、子とPackの `speciesKey` 一致に限定。
- 両親が適合Packを持つ場合はprimary parent、次にmateの順で選び、乱数を消費しない。
- 交配成立を契機とするPack自動形成と、lineage家族の一括加入はproduction経路から除外した。

### 協力狩り

- 生存、hunt-pack、同一active `packId`、Pack recordと双方の `speciesKey` 一致だけを仲間条件にした。
- Packなし・別Packの協力経路は使用しない。
- 追跡、成功率、helper size、target retention等の係数は未変更。

## lineageに残した責務

- lineage registryと親lineage
- 出生時継承とecotype分岐
- provisional作成、established昇格、failed/絶滅追跡
- lineage generationと系統樹
- canonical appearance継承
- lineage telemetryとsave/load

`sameLineageSexualBirths` は、同一lineageかつ同一 `speciesKey` で実際に有性生殖した場合だけ増える。

## 無効化した旧production flag

- `lineageAwareMateSelection`
- `lineageReproductiveIsolation`
- `lineageAwarePackIdentity`

旧save・旧debug callerの互換metadataとしてfield/API名は受理するが、enabled判定は常にfalseであり、通常ゲームの判定には使わない。
