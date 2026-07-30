# Pack save migration

## 新save

- `pack.speciesKey`: 正準identity
- `identityMode`: 常に `species`
- `identityKey`: `pack.speciesKey` と同値
- `lineageId`: founder lineageの履歴・旧save互換metadata。所属判定には不使用。

個体側では `packId` に加え、出生継承の確認用metadataとして次を保存する。

- `packInheritedFromId`
- `packInheritedFromRole` (`primary-parent` / `mate`)

## 旧save移行規則

1. 同じ `packId` を持つ生存個体を収集する。
2. 個体ID昇順に並べる。
3. 最小ID個体を正準memberとする。
4. その個体の既存 `speciesKey` を `pack.speciesKey` / `identityKey` に採用する。
5. `identityMode` を `species` に正規化する。
6. 異なる `speciesKey` のmemberは同種化せず、Packから離脱させる。
7. memberがいない場合だけ、既存 `speciesKey`、`founderSpeciesKey`、species modeの `identityKey` の順でfallbackする。

この処理は `identityMode: lineage`、`identityKey: lineageId`、`lineageId` だけを持つ旧recordにも適用する。

## 検証

- Micro N: 旧lineage Packに2 speciesが混在した状態を読み、最小ID memberの `species-a` を採用し、`species-b` memberを離脱。
- Micro O: 完全なALIFE saveを旧lineage Pack形式へ書き換えてloadし、再saveが `species` identityへ正規化されることを確認。
- 3seed×2,000step: 新save round-tripは全seed成功。
- load後のmixed-species Packは0。

