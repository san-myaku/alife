const fs = require('fs');
const path = require('path');
const Module = require('module');

function addNodeModuleDir(dir) {
  if (!dir || !fs.existsSync(dir)) return;
  const rows = process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : [];
  if (!rows.includes(dir)) {
    rows.push(dir);
    process.env.NODE_PATH = rows.join(path.delimiter);
    Module._initPaths();
  }
}

const userHome = process.env.USERPROFILE || process.env.HOME || '';
const nodeDependencies = path.join(
  userHome,
  '.cache',
  'codex-runtimes',
  'codex-primary-runtime',
  'dependencies',
  'node',
  'node_modules'
);
addNodeModuleDir(nodeDependencies);
addNodeModuleDir(path.join(nodeDependencies, '.pnpm', 'node_modules'));

const { chromium } = require('playwright');

const htmlFile = process.env.ALIFE_FILE || 'index.html';
const seeds = [41001, 43001, 45001];
const requestedSteps = 20000;
const safetyStopPopulation = 5000;
const populationSampleInterval = 200;
const artifactDir = path.join('artifacts', 'unlimited_population_cap');
const viewport = { width: 1280, height: 720 };

function fileUrl(file) {
  return 'file:///' + path.resolve(file).replace(/\\/g, '/');
}

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function linearTrendPer1000(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return 0;
  const xs = rows.map(row => finite(row.step));
  const ys = rows.map(row => finite(row.population));
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < rows.length; i++) {
    numerator += (xs[i] - meanX) * (ys[i] - meanY);
    denominator += (xs[i] - meanX) ** 2;
  }
  return denominator > 0 ? numerator / denominator * 1000 : 0;
}

function classifyDynamics(timeseries, safetyStopReached) {
  const rows = Array.isArray(timeseries) ? timeseries : [];
  const tail = rows.slice(Math.max(0, Math.floor(rows.length / 2)));
  const populations = tail.map(row => finite(row.population));
  const mean = populations.length
    ? populations.reduce((sum, value) => sum + value, 0) / populations.length
    : 0;
  const min = populations.length ? Math.min(...populations) : 0;
  const max = populations.length ? Math.max(...populations) : 0;
  const amplitudeRatio = mean > 0 ? (max - min) / mean : 0;
  const trendPer1000Steps = linearTrendPer1000(tail);
  let directionChanges = 0;
  let previousDirection = 0;
  for (let i = 1; i < populations.length; i++) {
    const delta = populations[i] - populations[i - 1];
    const direction = Math.abs(delta) < 1 ? 0 : Math.sign(delta);
    if (direction && previousDirection && direction !== previousDirection) directionChanges++;
    if (direction) previousDirection = direction;
  }
  const first = populations[0] || 0;
  const last = populations.at(-1) || 0;
  const continuedGrowth = Boolean(
    safetyStopReached
      || (trendPer1000Steps > Math.max(2, mean * 0.02) && last > first * 1.10)
  );
  const periodicVariation = Boolean(
    !continuedGrowth
      && directionChanges >= 3
      && amplitudeRatio >= 0.15
  );
  const naturalEquilibrium = Boolean(
    !continuedGrowth
      && Math.abs(trendPer1000Steps) <= Math.max(2, mean * 0.02)
      && amplitudeRatio <= 0.30
  );
  return {
    naturalEquilibrium,
    periodicVariation,
    continuedGrowth,
    tailMeanPopulation: Number(mean.toFixed(3)),
    tailMinPopulation: min,
    tailMaxPopulation: max,
    tailAmplitudeRatio: Number(amplitudeRatio.toFixed(6)),
    tailTrendPer1000Steps: Number(trendPer1000Steps.toFixed(6)),
    tailDirectionChanges: directionChanges
  };
}

function csvCell(value) {
  if (value == null) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function openPage(browser) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const consoleErrors = [];
  page.on('pageerror', error => consoleErrors.push(`pageerror:${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(`console:${message.text()}`);
  });
  await page.goto(fileUrl(htmlFile), { waitUntil: 'load' });
  await page.waitForFunction(() =>
    typeof window.__alifeDebug?.runUnlimitedPopulationCapMicroTests === 'function'
  );
  return { page, consoleErrors };
}

async function runMicro(browser) {
  const { page, consoleErrors } = await openPage(browser);
  try {
    const initialUi = await page.evaluate(() => ({
      label: document.getElementById('popmax-value')?.textContent || null,
      checkboxChecked: Boolean(document.getElementById('population-cap-unlimited')?.checked),
      sliderDisabled: Boolean(document.getElementById('popmax-slider')?.disabled),
      warningVisible: document.getElementById('population-cap-warning')?.classList.contains('visible') || false,
      warningText: document.getElementById('population-cap-warning')?.textContent || null,
      settings: window.__alifeDebug.populationCapSettings()
    }));
    await page.check('#population-cap-unlimited');
    const unlimitedUi = await page.evaluate(() => ({
      label: document.getElementById('popmax-value')?.textContent || null,
      checkboxChecked: Boolean(document.getElementById('population-cap-unlimited')?.checked),
      sliderDisabled: Boolean(document.getElementById('popmax-slider')?.disabled),
      warningVisible: document.getElementById('population-cap-warning')?.classList.contains('visible') || false,
      warningText: document.getElementById('population-cap-warning')?.textContent || null,
      settings: window.__alifeDebug.populationCapSettings()
    }));
    await page.uncheck('#population-cap-unlimited');
    await page.locator('#popmax-slider').fill('200');
    const finiteUi = await page.evaluate(() => ({
      label: document.getElementById('popmax-value')?.textContent || null,
      checkboxChecked: Boolean(document.getElementById('population-cap-unlimited')?.checked),
      sliderDisabled: Boolean(document.getElementById('popmax-slider')?.disabled),
      settings: window.__alifeDebug.populationCapSettings()
    }));
    const micro = await page.evaluate(() =>
      window.__alifeDebug.runUnlimitedPopulationCapMicroTests()
    );
    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      defaultPopulationCap: initialUi.settings.value,
      ui: {
        initial: initialUi,
        unlimited: unlimitedUi,
        finiteAfterToggle: finiteUi,
        ok: initialUi.label === '120'
          && initialUi.checkboxChecked === false
          && initialUi.sliderDisabled === false
          && unlimitedUi.label === '無制限'
          && unlimitedUi.checkboxChecked === true
          && unlimitedUi.sliderDisabled === true
          && unlimitedUi.warningVisible === true
          && unlimitedUi.warningText.includes('処理速度が低下')
          && finiteUi.label === '200'
          && finiteUi.checkboxChecked === false
          && finiteUi.sliderDisabled === false
      },
      micro,
      consoleErrors
    };
  } finally {
    await page.close();
  }
}

async function runLongSeed(browser, seed) {
  const { page, consoleErrors } = await openPage(browser);
  try {
    const payload = await page.evaluate(options => {
      const debug = window.__alifeDebug;
      const run = debug.runSeededWorldDiagnostic({
        seed: options.seed,
        steps: options.steps,
        safetyStopPopulation: options.safetyStopPopulation,
        populationSampleInterval: options.populationSampleInterval,
        populationCapEnabled: false,
        restoreAfterRun: false,
        variant: 'unlimited-population-cap',
        shareFraction: 0,
        targetConsensus: false,
        packAttackBase: 0.78,
        packHuntTelemetry: true,
        includeLineageRegistryState: true,
        evolvableLifeHistory: true,
        juvenileDevelopment: true,
        predictiveHuntingReserve: true,
        persistentPackIdentity: true,
        speciesIdentityV2: false,
        canonicalSpeciesAppearance: true,
        eventKeyedVisualRng: true,
        persistentLineageRegistry: true,
        provisionalLineageClassification: true,
        provisionalLineagePromotion: true,
        lineageAwareMateSelection: false,
        lineageReproductiveIsolation: false,
        lineageAwarePackIdentity: false,
        packCooperativeTargeting: true,
        resourceLimitedAlgaeRegrowth: true,
        environmentInitializationMode: 'patchy-intermediate',
        worldShape: 'circle'
      });
      return {
        run,
        cap: debug.capacitySummary(),
        pack: debug.packIdentitySummary(),
        lineage: debug.lineageRegistrySummary(),
        lineageValidation: debug.validateLineageRegistry(),
        numberHealth: debug.diagnosticNumberHealth()
      };
    }, {
      seed,
      steps: requestedSteps,
      safetyStopPopulation,
      populationSampleInterval
    });
    const run = payload.run;
    const last = run.populationTimeseries.at(-1) || {};
    const dynamics = classifyDynamics(run.populationTimeseries, run.safetyStopReached);
    const elapsedSeconds = finite(run.elapsedMs) / 1000;
    return {
      seed,
      requestedSteps,
      completedSteps: run.completedSteps,
      terminationReason: run.terminationReason,
      populationCap: run.populationCap,
      safetyStopPopulation,
      safetyStopReached: Boolean(run.safetyStopReached),
      populationRunaway: Boolean(run.populationRunaway),
      maximumPopulation: finite(run.maximumPopulation),
      endingPopulation: finite(run.population?.endPopulation, finite(last.population)),
      populationTimeseries: run.populationTimeseries,
      dynamics,
      capacityDeaths: finite(run.population?.deathCauses?.overcrowding),
      capacityCullDeaths: finite(run.capacityCull?.selected),
      packs: finite(last.packs),
      maximumActivePacks: finite(payload.pack?.formation?.maximumActivePackCount),
      maximumPackSize: Math.max(
        0,
        ...Object.values(debugPackRows(payload.pack)).map(row => finite(row.maximumLivingMembers))
      ),
      huntPackOrganisms: finite(last.huntPackOrganisms),
      species: finite(last.species),
      establishedLineages: finite(last.establishedLineages),
      processing: {
        elapsedMs: finite(run.elapsedMs),
        measuredUpdateMsPerStep: finite(run.performance?.measuredUpdateMsPerStep),
        stepsPerSecond: elapsedSeconds > 0
          ? Number((run.completedSteps / elapsedSeconds).toFixed(3))
          : null,
        fps: finite(run.performance?.fps),
        updateMs: finite(run.performance?.updateMs),
        drawMs: finite(run.performance?.drawMs)
      },
      nanOrInfinity: finite(run.health?.badCount) + finite(payload.numberHealth?.badCount),
      numberHealth: run.health,
      lineageValidation: payload.lineageValidation,
      consoleErrors
    };
  } finally {
    await page.close();
  }
}

function debugPackRows(packSummary) {
  if (!packSummary || typeof packSummary !== 'object') return [];
  if (Array.isArray(packSummary.packs)) return packSummary.packs;
  if (packSummary.records && typeof packSummary.records === 'object') {
    return Object.values(packSummary.records);
  }
  return [];
}

function writeArtifacts(micro, runs) {
  fs.mkdirSync(artifactDir, { recursive: true });
  const longResults = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    seeds,
    requestedSteps,
    safetyStopPopulation,
    populationCapMode: 'unlimited',
    productionConfiguration: {
      speciesIdentityV2: false,
      persistentPackIdentity: true,
      packCooperativeTargeting: true,
      resourceLimitedAlgaeRegrowth: true,
      environmentInitializationMode: 'patchy-intermediate',
      worldShape: 'circle'
    },
    runs,
    aggregate: {
      maximumPopulation: Math.max(...runs.map(run => run.maximumPopulation)),
      endingPopulation: runs.map(run => ({ seed: run.seed, value: run.endingPopulation })),
      capacityDeaths: runs.reduce((sum, run) => sum + run.capacityDeaths, 0),
      capacityCullDeaths: runs.reduce((sum, run) => sum + run.capacityCullDeaths, 0),
      safetyStops: runs.filter(run => run.safetyStopReached).map(run => run.seed),
      naturalEquilibriumSeeds: runs.filter(run => run.dynamics.naturalEquilibrium).map(run => run.seed),
      periodicVariationSeeds: runs.filter(run => run.dynamics.periodicVariation).map(run => run.seed),
      continuedGrowthSeeds: runs.filter(run => run.dynamics.continuedGrowth).map(run => run.seed),
      nanOrInfinity: runs.reduce((sum, run) => sum + run.nanOrInfinity, 0),
      consoleErrors: runs.flatMap(run => run.consoleErrors)
    }
  };
  const csvHeader = [
    'seed', 'step', 'frame', 'population', 'packs', 'hunt_pack_organisms',
    'species', 'established_lineages'
  ];
  const csvRows = [csvHeader.join(',')];
  for (const run of runs) {
    for (const row of run.populationTimeseries) {
      csvRows.push([
        run.seed,
        row.step,
        row.frame,
        row.population,
        row.packs,
        row.huntPackOrganisms,
        row.species,
        row.establishedLineages
      ].map(csvCell).join(','));
    }
  }
  const runLines = runs.map(run => [
    `### seed ${run.seed}`,
    '',
    `- 実行: ${run.completedSteps.toLocaleString()} / ${run.requestedSteps.toLocaleString()} step`,
    `- 最大個体数 / 終了時個体数: ${run.maximumPopulation} / ${run.endingPopulation}`,
    `- capacity死 / capacity cull死: ${run.capacityDeaths} / ${run.capacityCullDeaths}`,
    `- safety stop: ${run.safetyStopReached ? `到達（${run.terminationReason}）` : '未到達'}`,
    `- 自然平衡 / 周期的変動 / 増加継続: ${run.dynamics.naturalEquilibrium ? 'yes' : 'no'} / ${run.dynamics.periodicVariation ? 'yes' : 'no'} / ${run.dynamics.continuedGrowth ? 'yes' : 'no'}`,
    `- tail trend: ${run.dynamics.tailTrendPer1000Steps} 個体 / 1,000 step`,
    `- Pack数 / 最大同時Pack / hunt-pack個体: ${run.packs} / ${run.maximumActivePacks} / ${run.huntPackOrganisms}`,
    `- species数 / established lineage数: ${run.species} / ${run.establishedLineages}`,
    `- 処理速度: ${run.processing.stepsPerSecond} step/s（${run.processing.measuredUpdateMsPerStep} ms/step）`,
    `- NaN / Infinity: ${run.nanOrInfinity}`,
    `- console error: ${run.consoleErrors.length}`
  ].join('\n')).join('\n\n');
  const summary = [
    '# 無制限個体数上限 検証サマリー',
    '',
    '## 実装契約',
    '',
    '- 通常ゲームの既定値は有限120のまま。',
    '- 無制限は `populationCapEnabled=false` と有限値の保持で表現し、`Infinity` やマジックナンバーを保存しない。',
    '- 無制限では繁殖抑制とcapacity cullを無効化し、通常ゲームにhard capを追加しない。',
    '- 診断runnerだけは環境保護用safety stop 5,000個体を持ち、到達時はcullせずrunaway終了する。',
    '',
    '## Micro / UI',
    '',
    `- UI: ${micro.ui.ok ? 'PASS' : 'FAIL'}`,
    `- A〜F: ${micro.micro.ok ? 'PASS' : 'FAIL'}`,
    `- console error: ${micro.consoleErrors.length}`,
    '',
    '## 3 seed × 20,000 step',
    '',
    runLines,
    '',
    '## 集計',
    '',
    `- 全seed最大個体数: ${longResults.aggregate.maximumPopulation}`,
    `- capacity死合計: ${longResults.aggregate.capacityDeaths}`,
    `- safety stop seed: ${longResults.aggregate.safetyStops.length ? longResults.aggregate.safetyStops.join(', ') : 'なし'}`,
    `- 自然平衡 seed: ${longResults.aggregate.naturalEquilibriumSeeds.length ? longResults.aggregate.naturalEquilibriumSeeds.join(', ') : 'なし'}`,
    `- 周期的変動 seed: ${longResults.aggregate.periodicVariationSeeds.length ? longResults.aggregate.periodicVariationSeeds.join(', ') : 'なし'}`,
    `- 増加継続 seed: ${longResults.aggregate.continuedGrowthSeeds.length ? longResults.aggregate.continuedGrowthSeeds.join(', ') : 'なし'}`,
    `- NaN / Infinity合計: ${longResults.aggregate.nanOrInfinity}`,
    `- console error合計: ${longResults.aggregate.consoleErrors.length}`,
    ''
  ].join('\n');
  fs.writeFileSync(
    path.join(artifactDir, 'unlimited_cap_micro_tests.json'),
    JSON.stringify(micro, null, 2) + '\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(artifactDir, 'unlimited_cap_long_run_results.json'),
    JSON.stringify(longResults, null, 2) + '\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(artifactDir, 'unlimited_cap_population_timeseries.csv'),
    csvRows.join('\n') + '\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(artifactDir, 'unlimited_cap_summary.md'),
    summary,
    'utf8'
  );
  return longResults;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    if (process.env.ALIFE_VISUAL_ONLY === '1') {
      const { page } = await openPage(browser);
      try {
        await page.check('#population-cap-unlimited');
        const output = process.env.ALIFE_VISUAL_OUTPUT
          || path.join(artifactDir, 'unlimited_cap_ui.png');
        fs.mkdirSync(path.dirname(output), { recursive: true });
        await page.screenshot({ path: output, fullPage: false });
        process.stdout.write(JSON.stringify({ visual: output }) + '\n');
      } finally {
        await page.close();
      }
      return;
    }
    const micro = await runMicro(browser);
    if (!micro.ui.ok || !micro.micro.ok || micro.consoleErrors.length) {
      fs.mkdirSync(artifactDir, { recursive: true });
      fs.writeFileSync(
        path.join(artifactDir, 'unlimited_cap_micro_tests.json'),
        JSON.stringify(micro, null, 2) + '\n',
        'utf8'
      );
      throw new Error('Unlimited population cap micro/UI verification failed');
    }
    const runs = [];
    for (const seed of seeds) {
      const run = await runLongSeed(browser, seed);
      runs.push(run);
      process.stdout.write(JSON.stringify({
        seed,
        completedSteps: run.completedSteps,
        maximumPopulation: run.maximumPopulation,
        endingPopulation: run.endingPopulation,
        safetyStopReached: run.safetyStopReached,
        capacityDeaths: run.capacityDeaths,
        stepsPerSecond: run.processing.stepsPerSecond
      }) + '\n');
    }
    const results = writeArtifacts(micro, runs);
    const invalid = results.aggregate.capacityDeaths !== 0
      || results.aggregate.capacityCullDeaths !== 0
      || results.aggregate.nanOrInfinity !== 0
      || results.aggregate.consoleErrors.length !== 0;
    if (invalid) throw new Error('Long-run invariant verification failed');
    process.stdout.write(JSON.stringify({
      artifactDir,
      maximumPopulation: results.aggregate.maximumPopulation,
      safetyStops: results.aggregate.safetyStops,
      naturalEquilibriumSeeds: results.aggregate.naturalEquilibriumSeeds,
      periodicVariationSeeds: results.aggregate.periodicVariationSeeds,
      continuedGrowthSeeds: results.aggregate.continuedGrowthSeeds
    }, null, 2) + '\n');
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
