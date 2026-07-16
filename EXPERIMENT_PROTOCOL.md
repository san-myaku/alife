# ALIFE Experiment Protocol

今後の A/B 実験は、毎回この最小手順を基準にする。

- 一度に変更する主要因は 1 つだけにする。
- baseline / candidate は同じ seed・初期条件で paired run する。
- 既存 telemetry と runner を優先して再利用する。
- 同等の diagnostic を重複実装しない。
- まず軽量スクリーニングを行う。
- 合格候補だけ本試験へ進める。
- 通常 ON 候補だけ完全検証する。
- 不合格なら本試験を実行せず終了する。
- 生ログと詳細結果は artifact へ保存する。
- チャット報告は主要差分と判断だけに絞る。
- energy / nutrient 生成、NaN、Infinity、page error は必ず確認する。
- candidate は feature flag または診断 override で隔離する。
- 採用判断前に通常デフォルトを変更しない。
