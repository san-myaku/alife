const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const childProcess = require('child_process');

function addNodeModuleDir(dir) {
  if (!dir || !fs.existsSync(dir)) return;
  const current = process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : [];
  if (!current.includes(dir)) {
    current.push(dir);
    process.env.NODE_PATH = current.join(path.delimiter);
    Module._initPaths();
  }
}

const userHome = process.env.USERPROFILE || process.env.HOME || '';
addNodeModuleDir(path.join(userHome, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules'));
addNodeModuleDir(path.join(userHome, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', '.pnpm', 'node_modules'));

const { chromium } = require('playwright');

const BASE_COMMIT = 'e1c5de951700a49b40ff5177d61e4a53141d3f1e';
const HTML_FILE = process.env.ALIFE_FILE || 'index.html';
const OUTPUT_DIR = process.env.ALIFE_PATCHY_OUTPUT_DIR || path.join('artifacts', 'patchy_algae_initialization_20260728');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'initial_algae_statistics.json');
const OUTPUT_MARKDOWN = path.join(OUTPUT_DIR, 'summary.md');
const VIEWPORT = { width: 1280, height: 720 };
const SHORT_RUN_STEPS = Math.max(500, Math.min(1000, Number(process.env.ALIFE_PATCHY_STEPS || 750)));
const SHORT_RUN_SEEDS = String(process.env.ALIFE_PATCHY_SEEDS || '41001,43001')
  .split(',')
  .map(value => Number(value.trim()))
  .filter(Number.isFinite);

function decodeSave(data) {
  const encoded = String(data || '').split(':', 2)[1] || '';
  return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
}

function fieldHash(values) {
  let hash = 2166136261 >>> 0;
  const bytes = Buffer.allocUnsafe(4);
  for (const value of values || []) {
    bytes.writeFloatLE(Number(value) || 0, 0);
    for (let i = 0; i < 4; i++) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 16777619);
    }
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function finiteTree(value, pathParts = [], bad = []) {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    bad.push({ path: pathParts.join('.'), value: String(value) });
    return bad;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => finiteTree(item, pathParts.concat(index), bad));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => finiteTree(item, pathParts.concat(key), bad));
  }
  return bad;
}

async function openPage(browser, filePath, requiredMethod = 'environmentInitializationSummary') {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror:${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console:${message.text()}`);
  });
  const url = 'file:///' + path.resolve(filePath).replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'load' });
  try {
    await page.waitForFunction(
      method => typeof window.__alifeDebug?.[method] === 'function',
      requiredMethod,
      { timeout: 20000 }
    );
  } catch (error) {
    const debugText = await page.locator('#debug-console').textContent().catch(() => null);
    throw new Error(`debug API timeout for ${url}; errors=${JSON.stringify(errors)}; debug=${JSON.stringify(debugText)}; cause=${error.message}`);
  }
  return { page, errors, url };
}

function compactRun(run) {
  return {
    seed: run.seed,
    steps: run.steps,
    mode: run.environmentInitialization?.mode,
    environmentInitialization: run.environmentInitialization,
    environmentCurrent: run.environmentCurrent,
    resourceSpatial: run.resourceSpatial,
    population: run.population,
    feeding: run.feeding,
    predation: {
      maxCarnivores: run.maxCarnivores,
      endCarnivores: run.endCarnivores,
      carnivoreExtinctionFrame: run.carnivoreExtinctionFrame,
      bornCarnivores: run.bornCarnivores
    },
    conservation: run.conservation,
    health: run.health,
    roundTrip: null
  };
}

function ratio(value) {
  return value == null ? 'n/a' : `${(Number(value) * 100).toFixed(1)}%`;
}

function number(value, digits = 4) {
  return value == null ? 'n/a' : Number(value).toFixed(digits);
}

function markdown(data) {
  const patchy = data.initial.patchy;
  const legacy = data.initial.legacy;
  const checks = data.checks;
  const lines = [
    '# 初期藻場 patchy-intermediate 検証',
    '',
    `- 基準commit: \`${data.baseCommit}\``,
    `- 検証step: ${data.shortRunSteps}`,
    `- seed: ${data.shortRunSeeds.join(', ')}`,
    `- page error: ${data.errors.filter(value => value.startsWith('pageerror:')).length}`,
    `- console error: ${data.errors.filter(value => value.startsWith('console:')).length}`,
    `- NaN / Infinity: ${data.badNumbers.length}`,
    '',
    '## 初期統計',
    '',
    '| mode | seed | hash | min | max | mean | median | stddev | low | medium | high | resource patches |',
    '|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    `| patchy-intermediate | ${patchy.seed} | \`${patchy.fieldHash}\` | ${number(patchy.minimumAlgae)} | ${number(patchy.maximumAlgae)} | ${number(patchy.meanAlgae)} | ${number(patchy.medianAlgae)} | ${number(patchy.standardDeviation)} | ${ratio(patchy.ratios.low)} | ${ratio(patchy.ratios.medium)} | ${ratio(patchy.ratios.high)} | ${patchy.spatial.resourcePatchCount} |`,
    `| legacy-uniform | ${legacy.seed} | \`${legacy.fieldHash}\` | ${number(legacy.minimumAlgae)} | ${number(legacy.maximumAlgae)} | ${number(legacy.meanAlgae)} | ${number(legacy.medianAlgae)} | ${number(legacy.standardDeviation)} | ${ratio(legacy.ratios.low)} | ${ratio(legacy.ratios.medium)} | ${ratio(legacy.ratios.high)} | ${legacy.spatial.resourcePatchCount} |`,
    '',
    `patchy平均は旧全面値0.25の${ratio(patchy.meanAlgae / 0.25)}。目標範囲0.1125〜0.1500内: ${checks.patchyMeanInTargetRange ? 'yes' : 'no'}。`,
    '',
    '## 機能チェック',
    '',
    `- 同seed・同mode hash一致: ${checks.sameSeedSameHash}`,
    `- 異seed hash差: ${checks.differentSeedDifferentHash}`,
    `- legacyが基準commitと一致: ${checks.legacyMatchesBase}`,
    `- patchy分散 > 0: ${checks.patchyHasVariance}`,
    `- save/load後hash一致: ${checks.saveLoadPreservesField}`,
    `- load後に再生成なし: ${checks.loadDidNotRegenerate}`,
    `- resetで同seed初期hashへ復帰: ${checks.resetReturnsToSeededInitialField}`,
    `- metadata無し既存save互換: ${checks.metadataLessSavePreservesField}`,
    `- envState無し旧save fallback: ${checks.envStateLessSaveUsesLegacyFallback}`,
    `- roundTrip: ${checks.roundTrip}`,
    '',
    '## 750 step比較',
    ''
  ];
  for (const seed of data.shortRunSeeds) {
    const patchyRun = data.runs.find(run => run.seed === seed && run.mode === 'patchy-intermediate');
    const legacyRun = data.runs.find(run => run.seed === seed && run.mode === 'legacy-uniform');
    for (const run of [legacyRun, patchyRun]) {
      const h = run.resourceSpatial.current.byDiet.h;
      const m = run.resourceSpatial.current.byDiet.m;
      const c = run.resourceSpatial.current.carnivorePreyProximity;
      const mid = run.resourceSpatial.milestones.find(row => row.frame === 120) || run.resourceSpatial.current;
      const initialH = run.resourceSpatial.initial.byDiet.h;
      const initialM = run.resourceSpatial.initial.byDiet.m;
      lines.push(
        `- seed ${seed} / ${run.mode}: pop ${run.population.startPopulation}→${run.population.endPopulation} (peak ${run.population.peakPopulation}, cap到達 ${run.population.firstPopulationCapFrame ?? 'なし'}), ` +
        `繁殖 ${run.population.reproductions}, 120step草食high ${ratio(initialH.highRatio)}→${ratio(mid.byDiet.h.highRatio)}, ` +
        `雑食high ${ratio(initialM.highRatio)}→${ratio(mid.byDiet.m.highRatio)}, ` +
        `藻平均 ${number(run.environmentInitialization.meanAlgae)}→${number(mid.field.meanAlgae)}→${number(run.environmentCurrent.meanAlgae)}, ` +
        `750step草食/雑食high ${ratio(h.highRatio)}/${ratio(m.highRatio)}, ` +
        `草食recent grazer ${h.recentGrazers}, 雑食recent grazer ${m.recentGrazers}, ` +
        `肉食nearest prey平均 ${number(c.meanNearestPreyDistance, 1)}px, 肉食 ${run.predation.maxCarnivores}→${run.predation.endCarnivores}`
      );
    }
  }
  lines.push(
    '',
    '## 判定',
    '',
    data.accepted
      ? '採用候補。初期藻場のみを変更し、決定性・legacy比較・save/load・reset・数値健全性を満たした。'
      : '撤回候補。上記チェックのいずれかが不成立。',
    ''
  );
  return lines.join('\n');
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alife-patchy-base-'));
  const allErrors = [];
  let currentPage = null;
  let basePage = null;
  try {
    const current = await openPage(browser, HTML_FILE);
    currentPage = current.page;
    const patchyA = await currentPage.evaluate(() => {
      window.__alifeDebug.resetSimulation({ mode: 'patchy-intermediate', seed: 41001 });
      return window.__alifeDebug.environmentInitializationSummary();
    });
    const patchyARepeat = await currentPage.evaluate(() => {
      window.__alifeDebug.resetSimulation({ mode: 'patchy-intermediate', seed: 41001 });
      return window.__alifeDebug.environmentInitializationSummary();
    });
    const patchyB = await currentPage.evaluate(() => {
      window.__alifeDebug.resetSimulation({ mode: 'patchy-intermediate', seed: 43001 });
      return window.__alifeDebug.environmentInitializationSummary();
    });
    const legacy = await currentPage.evaluate(() => {
      window.__alifeDebug.resetSimulation({ mode: 'legacy-uniform', seed: 41001 });
      return window.__alifeDebug.environmentInitializationSummary();
    });

    const baseHtml = childProcess.execFileSync(
      'git',
      ['show', `${BASE_COMMIT}:index.html`],
      { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
    );
    fs.writeFileSync(path.join(tempDir, 'index.html'), baseHtml, 'utf8');
    fs.copyFileSync(path.resolve('organism_render.js'), path.join(tempDir, 'organism_render.js'));
    const base = await openPage(browser, path.join(tempDir, 'index.html'), 'captureSaveData');
    basePage = base.page;
    const baseSave = await basePage.evaluate(() => window.__alifeDebug.captureSaveData());
    const baseAlgae = decodeSave(baseSave).envState.fields.algae;
    const baseLegacyHash = fieldHash(baseAlgae);

    const saveLoad = await currentPage.evaluate(() => {
      const debug = window.__alifeDebug;
      debug.resetSimulation({ mode: 'patchy-intermediate', seed: 41001 });
      const initial = debug.currentAlgaeSummary();
      for (let i = 0; i < 25; i++) debug.modelStep(20);
      const beforeSave = debug.currentAlgaeSummary();
      const save = debug.captureSaveData();
      debug.resetSimulation({ mode: 'patchy-intermediate', seed: 43001 });
      const other = debug.currentAlgaeSummary();
      debug.restoreSaveData(save);
      const afterLoad = debug.currentAlgaeSummary();
      const loadedInitialization = debug.environmentInitializationSummary();
      debug.resetSimulation();
      const afterReset = debug.currentAlgaeSummary();

      const decode = data => JSON.parse(decodeURIComponent(escape(atob(data.split(':', 2)[1]))));
      const encode = state => 'ALIFE2:' + btoa(unescape(encodeURIComponent(JSON.stringify(state))));
      debug.restoreSaveData(save);
      const metadataLessState = decode(save);
      delete metadataLessState.environmentInitialization;
      if (metadataLessState.envState) delete metadataLessState.envState.initialization;
      const expectedMetadataLessHash = debug.currentAlgaeSummary().fieldHash;
      debug.resetSimulation({ mode: 'legacy-uniform', seed: 43001 });
      debug.restoreSaveData(encode(metadataLessState));
      const metadataLess = debug.currentAlgaeSummary();

      const envStateLessState = decode(save);
      delete envStateLessState.environmentInitialization;
      delete envStateLessState.envState;
      debug.restoreSaveData(encode(envStateLessState));
      const envStateLess = debug.currentAlgaeSummary();

      debug.resetSimulation({ mode: 'patchy-intermediate', seed: 41001 });
      const roundTrip = debug.roundTripSave();
      return {
        initial,
        beforeSave,
        other,
        afterLoad,
        loadedInitialization,
        afterReset,
        expectedMetadataLessHash,
        metadataLess,
        envStateLess,
        roundTrip
      };
    });

    const runs = [];
    for (const seed of SHORT_RUN_SEEDS) {
      for (const mode of ['legacy-uniform', 'patchy-intermediate']) {
        const compact = await currentPage.evaluate(
          ({ seed, mode, steps }) => {
            const run = window.__alifeDebug.runSeededWorldDiagnostic({
              seed,
              steps,
              environmentInitializationMode: mode,
              restoreAfterRun: false,
              variant: `initial-algae:${mode}:${seed}`
            });
            return run;
          },
          { seed, mode, steps: SHORT_RUN_STEPS }
        );
        runs.push(compactRun(compact));
      }
    }

    await currentPage.evaluate(() => window.__alifeDebug.resetSimulation({ mode: 'patchy-intermediate', seed: 41001 }));
    await currentPage.screenshot({ path: path.join(OUTPUT_DIR, 'patchy_initial.png'), fullPage: false });
    await currentPage.evaluate(() => {
      for (let i = 0; i < 6; i++) window.__alifeDebug.modelStep(20);
    });
    await currentPage.screenshot({ path: path.join(OUTPUT_DIR, 'patchy_120_steps.png'), fullPage: false });
    await currentPage.evaluate(() => window.__alifeDebug.resetSimulation({ mode: 'legacy-uniform', seed: 41001 }));
    await currentPage.screenshot({ path: path.join(OUTPUT_DIR, 'legacy_initial.png'), fullPage: false });

    allErrors.push(...current.errors, ...base.errors);
    const badNumbers = finiteTree({ patchyA, patchyARepeat, patchyB, legacy, saveLoad, runs });
    const checks = {
      sameSeedSameHash: patchyA.fieldHash === patchyARepeat.fieldHash,
      differentSeedDifferentHash: patchyA.fieldHash !== patchyB.fieldHash,
      legacyMatchesBase: legacy.fieldHash === baseLegacyHash,
      patchyHasVariance: Number(patchyA.standardDeviation) > 0,
      patchyMeanInTargetRange: Number(patchyA.meanAlgae) >= 0.25 * 0.45 && Number(patchyA.meanAlgae) <= 0.25 * 0.60,
      saveLoadPreservesField: saveLoad.beforeSave.fieldHash === saveLoad.afterLoad.fieldHash,
      loadDidNotRegenerate: saveLoad.afterLoad.fieldHash !== saveLoad.initial.fieldHash,
      resetReturnsToSeededInitialField: saveLoad.afterReset.fieldHash === saveLoad.initial.fieldHash,
      metadataLessSavePreservesField: saveLoad.metadataLess.fieldHash === saveLoad.expectedMetadataLessHash,
      envStateLessSaveUsesLegacyFallback: saveLoad.envStateLess.fieldHash === baseLegacyHash,
      roundTrip: saveLoad.roundTrip.ok === true,
      noPageOrConsoleErrors: allErrors.length === 0,
      noBadNumbers: badNumbers.length === 0,
      conservation: runs.every(run =>
        Number(run.conservation?.energyCreationEvents || 0) === 0 &&
        Number(run.conservation?.nutrientCreationEvents || 0) === 0
      )
    };
    const accepted = Object.values(checks).every(Boolean);
    const data = {
      generatedAt: new Date().toISOString(),
      baseCommit: BASE_COMMIT,
      htmlFile: path.resolve(HTML_FILE),
      viewport: VIEWPORT,
      shortRunSteps: SHORT_RUN_STEPS,
      shortRunSeeds: SHORT_RUN_SEEDS,
      initial: {
        patchy: patchyA,
        patchyRepeat: patchyARepeat,
        differentSeedPatchy: patchyB,
        legacy,
        baseLegacyHash
      },
      saveLoad,
      checks,
      runs,
      errors: allErrors,
      badNumbers,
      accepted
    };
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(data, null, 2) + '\n', 'utf8');
    fs.writeFileSync(OUTPUT_MARKDOWN, markdown(data), 'utf8');
    process.stdout.write(JSON.stringify({
      outputJson: OUTPUT_JSON,
      outputMarkdown: OUTPUT_MARKDOWN,
      checks,
      accepted,
      patchy: patchyA,
      legacy,
      errors: allErrors,
      badNumbers
    }, null, 2) + '\n');
    if (!accepted) process.exitCode = 1;
  } finally {
    if (basePage) await basePage.close();
    if (currentPage) await currentPage.close();
    await browser.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  process.stderr.write((error && error.stack) ? error.stack + '\n' : String(error) + '\n');
  process.exitCode = 1;
});
