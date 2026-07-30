# Pack短期形成監査

## 結論

形成実装のregressionはなかった。前回3seedでPackが0だった直接原因は、比較runnerが通常production既定ではない `speciesIdentityV2=true` を強制していたことだった。この構成では5,000stepの毎step観測でも同一speciesKeyのhunt-packペアが0で、radius・更新頻度以前に形成機会がなかった。

通常productionの既存speciesKey経路（`speciesIdentityV2=false`）では、変更前の3seed×5,000stepで自然Packを2個形成した。形成試行2、成功2、即時解散0、最大規模3だった。したがって実装バグ修正や形成パラメータ調整は行っていない。

## 維持した値

- formationRadiusMultiplier: 0.85
- updateIntervalSteps: 12
- minimumFormationMembers: 2
- join / leave radius、leave grace、keepSingleMemberPack: 変更なし

## 最終run

- 自然Pack形成: 4
- 最大同時Pack: 3
- 最大Pack規模: 3
- 作成直後の解散: 0
- 同種hunt-pack pair sample: 2023
- 形成距離内pair sample: 1879

Microでは、同種・別lineageの通常更新形成、異種・同lineageの拒否、次回更新後の維持、途中加入、出生継承をすべて確認した。
