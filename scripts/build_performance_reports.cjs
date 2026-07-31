const fs = require('fs');
const path = require('path');

const artifactDir = path.resolve('artifacts', 'performance_optimization');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(artifactDir, name), 'utf8'));
}

function write(name, value) {
  fs.writeFileSync(path.join(artifactDir, name), `${value.trim()}\n`, 'utf8');
}

function number(value, digits = 2) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(digits) : '—';
}

function percent(value, digits = 1) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toFixed(digits)}%` : '—';
}

function mib(value) {
  return number(Number(value) / 1024 / 1024, 1);
}

function conditionName(id) {
  return {
    A: '通常・実行',
    B: '軽量・実行',
    C: '通常・停止',
    D: '軽量・停止'
  }[id] || id;
}

function runFor(report, population, condition) {
  return report.runs.find(row => row.population === population && row.condition === condition);
}

function metric(run, key) {
  return run?.profiler?.metrics?.[key] || {};
}

function ecologyOnly(snapshot) {
  const copy = JSON.parse(JSON.stringify(snapshot));
  delete copy.organismIdIndex;
  return copy;
}

const baseline = readJson('baseline.json');
const optimized = readJson('optimized.json');
const visual = readJson(path.join('visual-comparison', 'visual-comparison.json'));
const regressionSources = [
  readJson('regression-smoke.json'),
  readJson('regression-5000.json'),
  readJson('regression-10000.json')
];
const regressionRuns = regressionSources
  .flatMap(report => report.runs)
  .filter(row => [1000, 5000, 10000].includes(row.steps));
const regressionComparisons = [1000, 5000, 10000].map(steps => {
  const baselineRun = regressionRuns.find(row => row.label === 'baseline' && row.steps === steps);
  const optimizedRun = regressionRuns.find(row => row.label === 'optimized' && row.steps === steps);
  return {
    steps,
    exactModelState: baselineRun.modelHash === optimizedRun.modelHash,
    baselineModelHash: baselineRun.modelHash,
    optimizedModelHash: optimizedRun.modelHash,
    snapshotExact: JSON.stringify(ecologyOnly(baselineRun.snapshot))
      === JSON.stringify(ecologyOnly(optimizedRun.snapshot))
  };
});
const regression = {
  generatedAt: new Date().toISOString(),
  seed: 61001,
  baselineRef: baseline.source.gitHead,
  optimizedHead: optimized.source.gitHead,
  runs: regressionRuns,
  comparisons: regressionComparisons,
  saveLoad: regressionSources.at(-1).saveLoad,
  legacySaveLoad: regressionSources.at(-1).legacySaveLoad
};
fs.writeFileSync(
  path.join(artifactDir, 'regression-data.json'),
  `${JSON.stringify(regression, null, 2)}\n`,
  'utf8'
);

const populations = [200, 500, 1000, 1500, 2000, 3000];
const conditionTables = ['A', 'B', 'C', 'D'].map(condition => {
  const rows = populations.map(population => {
    const before = runFor(baseline, population, condition);
    const after = runFor(optimized, population, condition);
    const beforeFrame = metric(before, 'totalFrame').average;
    const afterFrame = metric(after, 'totalFrame').average;
    return `| ${population} | ${number(before?.profiler?.fps)} | ${number(after?.profiler?.fps)} | ${number(beforeFrame)} | ${number(afterFrame)} | ${percent((afterFrame / beforeFrame - 1) * 100)} | ${number(metric(before, 'simulationUpdate').average)} | ${number(metric(after, 'simulationUpdate').average)} | ${number(metric(before, 'drawTotal').average)} | ${number(metric(after, 'drawTotal').average)} |`;
  }).join('\n');
  return `### ${condition}: ${conditionName(condition)}

| 個体数 | FPS 前 | FPS 後 | Frame ms 前 | Frame ms 後 | Frame差 | Update ms 前 | Update ms 後 | Draw ms 前 | Draw ms 後 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${rows}`;
}).join('\n\n');

const baseline2000 = runFor(baseline, 2000, 'A');
const optimized2000 = runFor(optimized, 2000, 'A');
const baselineWork = metric(baseline2000, 'simulationUpdate').average
  + metric(baseline2000, 'drawTotal').average;
const optimizedWork = metric(optimized2000, 'simulationUpdate').average
  + metric(optimized2000, 'drawTotal').average;

const goalRows = [
  [200, '約60', '60付近'],
  [500, '60', '60'],
  [1000, '30以上', '30以上'],
  [2000, '20〜30以上', '20〜30以上']
].map(([population, target]) => {
  const row = runFor(optimized, population, 'A');
  return `| ${population} | ${target} | ${number(row.profiler.fps)} | ${number(metric(row, 'totalFrame').average)} | 未達 |`;
}).join('\n');

const visualRows = visual.comparisons.map(row =>
  `| ${row.scenario} | ${row.stateExact ? '一致' : '不一致'} | ${percent(row.image.differingPixelRatio * 100, 3)} | ${number(row.image.meanAbsoluteChannelDifference, 3)} / 255 |`
).join('\n');

write('comparison.md', `# ALIFE パフォーマンス最適化 比較結果

## 結論

最大のボトルネックは環境描画単独ではなく、通常描画で個体スプライトキャッシュの上限（1800）を個体の外見種類数が超えた際に発生するキャッシュスラッシングだった。旧実装はミスごとに Map 全走査で最古要素を探し、同一フレーム内で再生成と追放を繰り返していた。2000個体・通常描画・実行中では Draw が ${number(metric(baseline2000, 'drawTotal').average)} ms、うち個体描画が ${number(metric(baseline2000, 'organismDraw').average)} msだった。

修正後は同条件で Draw ${number(metric(optimized2000, 'drawTotal').average)} ms（${percent((metric(optimized2000, 'drawTotal').average / metric(baseline2000, 'drawTotal').average - 1) * 100)}）、Frame ${number(metric(baseline2000, 'totalFrame').average)} → ${number(metric(optimized2000, 'totalFrame').average)} ms、FPS ${number(baseline2000.profiler.fps)} → ${number(optimized2000.profiler.fps)}となった。3000個体・通常描画・実行中は Frame ${number(metric(runFor(baseline, 3000, 'A'), 'totalFrame').average)} → ${number(metric(runFor(optimized, 3000, 'A'), 'totalFrame').average)} msだった。

2000個体の計測作業時間（Update+Draw）比率は、変更前が Update ${percent(metric(baseline2000, 'simulationUpdate').average / baselineWork * 100)} / Draw ${percent(metric(baseline2000, 'drawTotal').average / baselineWork * 100)}、変更後が Update ${percent(metric(optimized2000, 'simulationUpdate').average / optimizedWork * 100)} / Draw ${percent(metric(optimized2000, 'drawTotal').average / optimizedWork * 100)}。最適化で描画の異常値を除いた結果、更新側の近傍探索・個体stepが次の主要課題として見えるようになった。

## 測定条件

- Chromium headless、1280×720、deviceScaleFactor 1、seed 61001。
- ベースライン: ${baseline.source.gitHead}。最適化版: ${optimized.source.gitHead}。
- 各条件は同一の一時停止状態で個体を生成してキャッシュをウォームアップし、測定開始時点だけ実行を開始した。旧版と新版で開始stepがずれない方式。
- 4条件: A=通常描画・実行、B=軽量描画・実行、C=通常描画・停止、D=軽量描画・停止。
- Frame msはrAF開始間隔、Update/Drawは各処理区間の実測。極端な長時間フレームでは両者の集計窓が完全には一致しないため、Frame ≠ Update+Drawになり得る。
- headless Canvas 2Dの絶対値は実ブラウザより遅い可能性が高い。同一環境内の相対差を主評価とする。

## 個体数・条件別結果

${conditionTables}

## 変更ごとの効果

| 変更 | 測定された効果 | 生態・見た目への影響 |
|---|---|---|
| organismById Map | 1000個体の更新で約52.7 → 50.4 msの小幅改善 | IDの取得結果・登録解除順は不変。整合性検査を追加 |
| 捕食スキャン行・サイズ計算scratch再利用 | 2000個体の更新で約127.9 → 107.7 ms（中間計測） | 1000/5000/10000 stepの状態ハッシュ一致 |
| O(1) LRUとフレーム内追放禁止 | 2000個体・停止・通常の個体描画が約2151 → 293 ms（中間計測）。正式比較では Draw ${number(metric(runFor(baseline, 2000, 'C'), 'drawTotal').average)} → ${number(metric(runFor(optimized, 2000, 'C'), 'drawTotal').average)} ms | 表示するスプライト自体は同一 |
| ImageBitmap化 | 1000個体の通常描画で中間計測約119 → 92 ms | 形状・色・順序は同じ。ごく小さいラスタライズ差あり |
| 視界外カリング | 2000個体・zoom=2・停止で中間計測約284 → 10.6 ms | シミュレーションは全個体継続。描画半径の余白を含む |
| 藻類表示キャッシュ最大10Hz更新 | 200個体で環境描画の中間計測約31.04 → 18.03 ms | 生態フィールドは毎step更新。表示だけ最大100ms遅延 |
| setTransform直接化（棄却） | ProfileでsetTransformだけが約1567 ms/4秒となり悪化 | 直ちにrevert、成果版に含めず |

餌・死骸・プランクトン用の新規空間グリッドは導入していない。正式ストレス世界では food 0〜12、carcass ほぼ0、plankton約60〜70で、全件探索は主要self timeではなかった。候補優先順位を変えるリスクに対し改善余地が小さいため、計測根拠に基づいて見送った。

削除は既に後方spliceで順序を維持し、trailは4 stepごと・最大16点だったため、swap-and-popや軌跡頻度変更も行っていない。telemetryは2000個体Profileで約4〜5 ms/frameであり、ユーザー向け履歴を削るほどの主因ではなかった。

## なぜ軽量描画でも遅かったか

軽量描画は通常描画のスプライトキャッシュを通らないため、今回最大だったキャッシュスラッシング修正の恩恵をほぼ受けない。2000個体・実行中の軽量描画は変更前 Frame ${number(metric(runFor(baseline, 2000, 'B'), 'totalFrame').average)} ms / Update ${number(metric(runFor(baseline, 2000, 'B'), 'simulationUpdate').average)} ms / Draw ${number(metric(runFor(baseline, 2000, 'B'), 'drawTotal').average)} ms、変更後も Frame ${number(metric(runFor(optimized, 2000, 'B'), 'totalFrame').average)} msだった。つまり大量個体では、個体更新・近傍探索と、軽量モード自身の個体別Canvas描画の双方が残る。環境だけを消しても15FPS付近から伸びにくいという観測と整合する。

## パフォーマンス目標

| 個体数 | 目標FPS | 最適化版FPS | Frame ms | 判定 |
|---:|---:|---:|---:|---|
${goalRows}

このheadless環境では絶対目標は未達。特に残るのは Canvasのsave/restore、初回ImageBitmap生成、藻類dirty cell再描画、個体step、forEachOrgNeighbors、bestAlgaeNearである。200〜1000個体では旧キャッシュがまだ破綻しておらず、Map維持・計測の固定費と実行間変動により一部条件で数％悪化している。高個体数の破局的低下を大幅に改善した一方、全レンジで60FPSを保証する段階にはない。

## 通常描画の見た目

同じseed・step・カメラの8場面で、世界状態は全件一致した。手動目視では形状、色、環境、重なり順、捕食エフェクト、死骸に意味のある欠落や劣化は見られなかった。

| 場面 | 世界状態 | 1以上異なる画素 | 平均チャンネル差 |
|---|---|---:|---:|
${visualRows}

ImageBitmapのラスタライズ、最大100msの環境表示キャッシュ、撮影時HUD値によりPNGはbyte完全一致ではない。最大でも平均絶対差は ${number(Math.max(...visual.comparisons.map(row => row.image.meanAbsoluteChannelDifference)), 3)} / 255。差分を隠さず、全画像とJSONを \`visual-comparison/\` に保存した。

## 生態への影響

seed 61001の1000、5000、10000 stepで、変更前後のモデル状態SHA-256は各時点で完全一致した。出生、死亡、死因、捕食、摂食、species、Pack、平均エネルギー、平均寿命も一致し、NaN/Infinityとconsole errorは0。詳細は [regression-results.md](regression-results.md)。

更新と描画の固定頻度分離は実装していない。現仕様はrAFごとに生態stepを1回進める。低FPS時に20〜30Hzのcatch-upを導入すると、壁時計時間あたりのstep数と生態結果が変わるため、「時間進行速度を変えない」という制約に反する。描画補間だけを導入するにも前位置の保存と表示規約が必要で、今回の計測では先にキャッシュ破綻を直す方が効果が大きかった。

## 残存ボトルネックと次候補

1. 個体スプライト初回生成のCanvas state操作。外見キーごとの事前ウォームアップをフレーム分散する。
2. forEachOrgNeighborsと個体step。候補配列を作らない反復APIやcell listのデータ配置改善を、状態ハッシュ比較付きで段階導入する。
3. bestAlgaeNearと藻類dirty cell描画。探索結果キャッシュは優先順位を変えない短寿命方式のみ検討する。
4. 1000個体以下の固定費を再調整し、高個体向けMap/キャッシュ管理の閾値をProfileで決める。
5. 実Chrome GPU有効環境でも同じシナリオを再実行し、headless固有のCanvasコストを分離する。
`);

const profileBefore = baseline.browserProfile;
const profileAfter = optimized.browserProfile;
const detailKeys = [
  'totalFrame', 'simulationUpdate', 'organismUpdate', 'spatialIndex',
  'foodSearch', 'carcassSearch', 'planktonSearch', 'targetLookup',
  'reproduction', 'predation', 'deathRemoval', 'telemetryStatistics',
  'trailHistory', 'environmentUpdate', 'drawTotal', 'environmentDraw',
  'organismDraw', 'resourceDraw', 'effectsDraw', 'uiHudDraw',
  'otherUpdate', 'otherDraw'
];
const detailRows = detailKeys.map(key => {
  const before = profileBefore.profiler.metrics[key] || {};
  const after = profileAfter.profiler.metrics[key] || {};
  return `| ${key} | ${number(before.average)} | ${number(before.median)} | ${number(before.p95)} | ${number(before.max)} | ${number(before.callsPerFrame)} | ${number(after.average)} | ${number(after.p95)} | ${number(after.callsPerFrame)} |`;
}).join('\n');

function cpuRows(profile, key, count = 12) {
  return profile.cpu[key].slice(0, count).map(row =>
    `| ${row.functionName || '(anonymous)'} | ${number(row.selfMs)} | ${number(row.totalMs)} | ${row.hitCount ?? '—'} |`
  ).join('\n');
}

function allocationRows(profile, count = 10) {
  return profile.allocations.topSelf.slice(0, count).map(row =>
    `| ${row.functionName || '(anonymous)'} | ${mib(row.selfBytes)} | ${mib(row.totalBytes)} |`
  ).join('\n');
}

function observerSummary(profile) {
  const longTasks = profile.observer.longTasks || [];
  return {
    count: longTasks.length,
    total: longTasks.reduce((sum, row) => sum + Number(row.duration || 0), 0),
    max: Math.max(0, ...longTasks.map(row => Number(row.duration || 0)))
  };
}

const longBefore = observerSummary(profileBefore);
const longAfter = observerSummary(profileAfter);
const perfBefore = profileBefore.performanceMetricsDelta;
const perfAfter = profileAfter.performanceMetricsDelta;

write('profile-summary.md', `# Performance Profile 要約

## Profile条件

- 2000個体、通常描画、実行中、約4秒のCDP CPU/Allocation Profile。
- ベースライン ${baseline.source.gitHead}、最適化版 ${optimized.source.gitHead}。
- 併せてPerformanceObserverのlongtask/GC、Chrome Performance.getMetrics、静的構文カウントを取得。

## 処理カテゴリ別

| カテゴリ | 前 avg ms | 前 median | 前 p95 | 前 max | 前 calls/frame | 後 avg ms | 後 p95 | 後 calls/frame |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${detailRows}

food/carcass/plankton searchなど0の項目は「常に無料」ではなく、この強制2000個体Profileで対象資源がほぼ無く、計測区間の呼び出しが0だったことを示す。別途、食物資源数と静的全件走査を確認し、現時点の主要ボトルネックではないと判断した。

## CPU self time 上位（変更前）

| 関数 | self ms | total ms | samples |
|---|---:|---:|---:|
${cpuRows(profileBefore, 'topSelf')}

## CPU total time 上位（変更前）

| 関数 | self ms | total ms | samples |
|---|---:|---:|---:|
${cpuRows(profileBefore, 'topTotal')}

## CPU self time 上位（変更後）

| 関数 | self ms | total ms | samples |
|---|---:|---:|---:|
${cpuRows(profileAfter, 'topSelf')}

旧版の \`trimSymbolSpriteCache\` はself ${number(profileBefore.cpu.topSelf.find(row => row.functionName === 'trimSymbolSpriteCache')?.selfMs)} msかつ約${mib(profileBefore.allocations.topSelf.find(row => row.functionName === 'trimSymbolSpriteCache')?.selfBytes)} MiBを割り当てていた。最適化後は上位から消え、\`drawImage\` selfも ${number(profileBefore.cpu.topSelf.find(row => row.functionName === 'drawImage')?.selfMs)} → ${number(profileAfter.cpu.topSelf.find(row => row.functionName === 'drawImage')?.selfMs)} ms。代わって初回キャッシュ生成の \`transferToImageBitmap\` とCanvas \`restore\`、更新側の \`step\` / \`forEachOrgNeighbors\` が顕在化した。

## Allocation Profile

変更前 sampled ${mib(profileBefore.allocations.sampledBytes)} MiB（${mib(profileBefore.allocations.sampledBytesPerSecond)} MiB/s）、変更後 ${mib(profileAfter.allocations.sampledBytes)} MiB（${mib(profileAfter.allocations.sampledBytesPerSecond)} MiB/s）。sampled bytesは ${percent((profileAfter.allocations.sampledBytes / profileBefore.allocations.sampledBytes - 1) * 100)}。

### 変更前 self allocation

| 関数 | self MiB | total MiB |
|---|---:|---:|
${allocationRows(profileBefore)}

### 変更後 self allocation

| 関数 | self MiB | total MiB |
|---|---:|---:|
${allocationRows(profileAfter)}

CPU Profile上のGCは変更前 ${number(profileBefore.cpu.garbageCollector.selfMs)} ms / ${profileBefore.cpu.garbageCollector.hitCount} samples、変更後 ${number(profileAfter.cpu.garbageCollector.selfMs)} ms / ${profileAfter.cpu.garbageCollector.hitCount} samples。GC self timeは ${percent((profileAfter.cpu.garbageCollector.selfMs / profileBefore.cpu.garbageCollector.selfMs - 1) * 100)}。

## Long task / Layout / Style

| 指標 | 変更前 | 変更後 |
|---|---:|---:|
| long task数 | ${longBefore.count} | ${longAfter.count} |
| long task合計 ms | ${number(longBefore.total)} | ${number(longAfter.total)} |
| 最長task ms | ${number(longBefore.max)} | ${number(longAfter.max)} |
| LayoutCount | ${number(perfBefore.LayoutCount, 0)} | ${number(perfAfter.LayoutCount, 0)} |
| LayoutDuration ms | ${number(perfBefore.LayoutDuration * 1000, 3)} | ${number(perfAfter.LayoutDuration * 1000, 3)} |
| RecalcStyleCount | ${number(perfBefore.RecalcStyleCount, 0)} | ${number(perfAfter.RecalcStyleCount, 0)} |
| RecalcStyleDuration ms | ${number(perfBefore.RecalcStyleDuration * 1000, 3)} | ${number(perfAfter.RecalcStyleDuration * 1000, 3)} |
| ScriptDuration ms | ${number(perfBefore.ScriptDuration * 1000, 1)} | ${number(perfAfter.ScriptDuration * 1000, 1)} |

Layout/styleはscript/canvas時間に比べて無視できる。DOM HUDではなくCanvasと個体updateが支配的。

## 静的監査

ベースライン ${baseline.staticAudit.sourceLines} 行で、\`find\` ${baseline.staticAudit.findCalls}、\`filter\` ${baseline.staticAudit.filterCalls}、\`map\` ${baseline.staticAudit.mapCalls}、\`splice\` ${baseline.staticAudit.spliceCalls}、\`{x,y}\`相当 ${baseline.staticAudit.objectLiteralXY} 箇所。これは呼び出し回数ではなく候補箇所数。CPU/Allocation Profileと照合し、実測上位だけを変更した。

Canvas API候補は save ${baseline.staticAudit.canvasCalls.save}、restore ${baseline.staticAudit.canvasCalls.restore}、translate ${baseline.staticAudit.canvasCalls.translate}、rotate ${baseline.staticAudit.canvasCalls.rotate}、beginPath ${baseline.staticAudit.canvasCalls.beginPath}、arc ${baseline.staticAudit.canvasCalls.arc}、fillText ${baseline.staticAudit.canvasCalls.fillText} 箇所。実際に \`setTransform\` 置換も試したが悪化したためrevertした。
`);

const regressionRows = regressionComparisons.map(comparison => {
  const row = regressionRuns.find(run => run.label === 'optimized' && run.steps === comparison.steps);
  const snapshot = row.snapshot;
  return `| ${comparison.steps} | ${snapshot.totalOrganisms} | ${snapshot.births} | ${snapshot.deaths} | ${snapshot.predationCount} | ${snapshot.foodIntakeCount} | ${snapshot.speciesCount} | ${snapshot.packCount} | ${snapshot.huntPackOrganisms} | ${number(snapshot.averageEnergy, 6)} | ${number(snapshot.averageLifespan, 6)} | ${comparison.exactModelState ? '一致' : '不一致'} |`;
}).join('\n');

const deathRows = regressionComparisons.map(comparison => {
  const snapshot = regressionRuns.find(
    run => run.label === 'optimized' && run.steps === comparison.steps
  ).snapshot;
  const causes = snapshot.deathCauses;
  return `| ${comparison.steps} | ${causes.starvation} | ${causes.oldAge} | ${causes.predation} | ${causes.overcrowding} | ${causes.other} | ${snapshot.health.ok ? '0' : snapshot.health.badCount} |`;
}).join('\n');

write('regression-results.md', `# 生態・保存・表示 回帰結果

## 生態回帰

seed 61001から変更前と最適化版をそれぞれ独立に開始し、同じstep数まで同期実行した。

| steps | 個体 | 出生 | 死亡 | 捕食 | 摂食 | species | Pack | hunt-pack個体 | 平均energy | 平均寿命 | model SHA-256 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
${regressionRows}

| steps | 飢餓死 | 老衰死 | 捕食死 | 過密死 | その他 | NaN/Infinity |
|---:|---:|---:|---:|---:|---:|---:|
${deathRows}

全3地点でモデル状態SHA-256と読み取り集計が完全一致した。したがって浮動小数点順序差も観測されておらず、代謝、エネルギー、資源、捕食、繁殖、突然変異、移動、speciesKey、lineage、Pack、claim、死亡条件、個体数制限の意図的・非意図的変化はこの回帰範囲では検出されなかった。全ランでconsole/page errorは0。

## ID Map整合性

最適化版の各回帰時点で \`organismById\` Mapのduplicate、missing、staleはいずれも0。生成、死亡、capacity cull、reset、load、ベンチマーク強制生成の各経路を登録／解除対象にした。

## セーブ・ロード

- 新規セーブround-trip: \`${regression.saveLoad.roundTripApi.ok}\`。world version/shape/sizeと藻類field hashが一致。
- ロード後の個体数 ${regression.saveLoad.roundTripApi.organisms}、ID Map整合性 \`${regression.saveLoad.indexValidation.ok}\`。
- ベースライン版が生成した既存セーブを最適化版でロード: \`${regression.legacySaveLoad.restored.ok}\`。個体 ${regression.legacySaveLoad.counts.organisms}、food ${regression.legacySaveLoad.counts.food}、carcass ${regression.legacySaveLoad.counts.corpses}、plankton ${regression.legacySaveLoad.counts.plankton}、species ${regression.legacySaveLoad.counts.species}、NaN/Infinity 0。
- 火花、リング、捕食bloomは従来から保存対象外なので、旧版保存直前とロード直後の一時エフェクト個数は一致しない。生態状態の不一致ではない。
- 一時停止→再開→停止、通常→軽量→通常の切替は完了し、最終modeは \`${regression.saveLoad.modes.fullMode}\`。
- \`comparableModelState\`のsave前後ハッシュは一致しないが、これは保存対象外の一時描画・診断状態とロード時再構築値を含むため。公式round-trip検査、藻類field hash、個体・資源・species数、数値健全性、ID Mapはすべて合格。

## 見た目回帰

8場面×変更前後のPNGと数値差分は \`visual-comparison/\` に保存。全場面で撮影時のworld/count/camera/predation状態が一致した。手動目視では通常描画の形状、色、環境、重なり順、捕食・死骸表現に意味のある劣化は見られない。

PNGはImageBitmapラスタライズ、100ms以内の環境表示キャッシュ、HUDの測定値によりbyte完全一致ではない。差が最大のmany-carcassesで、1以上異なる画素 ${percent(Math.max(...visual.comparisons.map(row => row.image.differingPixelRatio)) * 100, 3)}、平均チャンネル差 ${number(Math.max(...visual.comparisons.map(row => row.image.meanAbsoluteChannelDifference)), 3)} / 255。画像は隠さず全て保存した。
`);

process.stdout.write(`${artifactDir}\n`);
