# Pack協力捕殺の利益分配 最終設計

## Packと種

- `speciesKey` は種であり、有性生殖とPack形成・加入・出生継承の完全一致条件。
- `lineageId` は血統・進化履歴専用で、交配・Pack・死骸claimの適合条件には使わない。

## 参加者

捕殺時点の最終攻撃個体に加え、同じactive Packで標的を追跡し、獲物から既存helper範囲内にいた個体、または直前18step以内にattack/helper判定へ実際に寄与した個体を記録する。単に同じPackにいるだけの遠方個体は含めない。

## 死骸claim

- `claimPackId`
- `claimParticipantIds`
- `claimUntilStep`
- 優先期間: 72step

期間中は生存中の参加者だけが摂食できる。参加者には、逃避・既存捕食判断を上書きしない軽い死骸steeringを与える。非参加者は接触しても拒否される。

Pack解散後も参加者本人の権利は期限まで残る。参加者が全員死亡・消失した場合は即時一般開放する。期限終了後は全個体が接触摂食でき、腐肉食個体は従来どおり死骸へsteeringする。

## Energy

捕食時の既存初期死骸energy式 `gainRaw * 0.32` は変更しない。その値を持つCorpseを1個だけ作る。摂食時は個体の実増加energyと同量をCorpseから減らし、人数による増量・コピー・固定配当をしない。

旧debug用shareFractionとactive Pack overflow/surplusの直接helper energy移送は通常判定で無効化した。協力利益は有限な死骸への優先アクセスだけである。

claim Pack、参加者ID、期限、解放状態はsave/loadする。選択debugにはclaim Pack、残りstep、参加者数、選択個体が参加者かを表示する。
