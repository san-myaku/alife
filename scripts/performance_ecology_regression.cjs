const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Module = require('module');
const childProcess = require('child_process');

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

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : fallback;
}

function fileUrl(file) {
  return `file:///${path.resolve(file).replace(/\\/g, '/')}`;
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function materialize(ref, label) {
  const source = ref === 'WORKTREE'
    ? fs.readFileSync('index.html', 'utf8')
    : childProcess.execFileSync('git', ['show', `${ref}:index.html`], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
      });
  const helper = `
  window.__performanceRegressionSnapshot = function(windowFrames=120000){
    const wf=Math.max(1,Number(windowFrames)||120000);
    const living=organisms.filter(o=>o && !o.dead);
    const population=populationTurnoverSummary(wf);
    const foodWeb=buildFoodWebSummary(wf);
    const deaths=telemetry.events.filter(e=>e && e.kind==='death');
    const deathAges=deaths.map(e=>Number(e.age)).filter(Number.isFinite);
    const eaten=foodWeb.totals?.eaten || {};
    const indexValidation=typeof validateOrganismIdIndex==='function'
      ? validateOrganismIdIndex()
      : null;
    return {
      frame,
      totalOrganisms:living.length,
      births:population.births,
      deaths:population.deaths,
      reproductions:population.reproductions,
      deathCauses:population.deathCauses,
      predationCount:Number(eaten.prey||0),
      foodIntakeCount:Object.values(eaten).reduce((sum,value)=>sum+Number(value||0),0),
      foodIntakeBySource:{...eaten},
      speciesCount:new Set(living.map(o=>o.speciesKey)).size,
      packCount:activePackSnapshots().length,
      huntPackOrganisms:living.filter(isPackHunter).length,
      averageEnergy:Number(averageLivingEnergy().toFixed(6)),
      averageLifespan:deathAges.length
        ? Number((deathAges.reduce((sum,value)=>sum+value,0)/deathAges.length).toFixed(6))
        : null,
      deathAgeSamples:deathAges.length,
      health:diagnosticNumberHealth(),
      organismIdIndex:indexValidation,
      counts:{
        food:food.length,
        carcasses:corpses.length,
        plankton:plankton.length,
        telemetrySamples:telemetry.samples.length
      }
    };
  };
`;
  const marker = '  window.__alifeDebug = {';
  if (!source.includes(marker)) throw new Error(`debug API marker not found in ${label}`);
  const instrumented = source.replace(marker, `${helper}\n${marker}`);
  const file = path.resolve(`.performance-regression-${label}.html`);
  fs.writeFileSync(file, instrumented, 'utf8');
  return file;
}

async function openPage(browser, htmlFile, seed) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror:${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console:${message.text()}`);
  });
  await page.addInitScript(value => {
    let state = Number(value) >>> 0;
    if (!state) state = 1;
    Math.random = () => {
      state = (state + 0x6D2B79F5) >>> 0;
      let next = state;
      next = Math.imul(next ^ (next >>> 15), next | 1);
      next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
      return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);
  await page.goto(`${fileUrl(htmlFile)}?dev=1&performance-regression=1`, { waitUntil: 'load' });
  await page.waitForFunction(
    () => typeof window.__alifeDebug?.runSeededWorldDiagnostic === 'function'
      && typeof window.__performanceRegressionSnapshot === 'function',
    null,
    { timeout: 15000 }
  );
  return { page, errors };
}

async function runStep(browser, htmlFile, label, seed, steps) {
  const { page, errors } = await openPage(browser, htmlFile, seed);
  try {
    const result = await page.evaluate(({ seed, steps, label }) => {
      window.__alifeDebug.setSimulationRunning(false);
      const run = window.__alifeDebug.runSeededWorldDiagnostic({
        seed,
        steps,
        restoreAfterRun: false,
        populationSampleInterval: Math.max(100, Math.floor(steps / 10)),
        includeModelState: true,
        variant: `performance-regression-${label}-${steps}`
      });
      return {
        completedSteps: run.completedSteps,
        elapsedMs: run.elapsedMs,
        snapshot: window.__performanceRegressionSnapshot(steps + 60),
        modelState: run.modelState,
        populationTimeseries: run.populationTimeseries,
        conservation: run.conservation,
        terminationReason: run.terminationReason
      };
    }, { seed, steps, label });
    const modelHash = hash(result.modelState);
    delete result.modelState;
    return { label, steps, ...result, modelHash, errors };
  } finally {
    await page.close();
  }
}

async function saveLoadCheck(browser, htmlFile, seed) {
  const { page, errors } = await openPage(browser, htmlFile, seed);
  try {
    return await page.evaluate(seed => {
      window.__alifeDebug.setSimulationRunning(false);
      window.__alifeDebug.runSeededWorldDiagnostic({
        seed,
        steps: 1000,
        restoreAfterRun: false,
        includeModelState: false,
        variant: 'performance-save-load'
      });
      const before = window.__alifeDebug.comparableModelState();
      const encoded = window.__alifeDebug.captureSaveData();
      const restored = window.__alifeDebug.restoreSaveData(encoded);
      const after = window.__alifeDebug.comparableModelState();
      const indexValidation = window.__alifeDebug.validateOrganismIdIndex();
      const roundTripApi = window.__alifeDebug.roundTripSave();
      const tinyMode = window.__alifeDebug.setBenchmarkRenderMode('tiny');
      const fullMode = window.__alifeDebug.setBenchmarkRenderMode('full');
      window.__alifeDebug.setSimulationRunning(true);
      window.__alifeDebug.setSimulationRunning(false);
      return {
        restored,
        before,
        after,
        indexValidation,
        roundTripApi,
        modes: { tinyMode, fullMode },
        pauseResumeCompleted: true
      };
    }, seed).then(result => ({
      restored: result.restored,
      beforeHash: hash(result.before),
      afterHash: hash(result.after),
      exactModelState: hash(result.before) === hash(result.after),
      indexValidation: result.indexValidation,
      roundTripApi: result.roundTripApi,
      modes: result.modes,
      pauseResumeCompleted: result.pauseResumeCompleted,
      errors
    }));
  } finally {
    await page.close();
  }
}

async function legacySaveLoadCheck(browser, baselineFile, optimizedFile, seed) {
  const baseline = await openPage(browser, baselineFile, seed);
  let encoded;
  let baselineCounts;
  try {
    const result = await baseline.page.evaluate(seed => {
      window.__alifeDebug.setSimulationRunning(false);
      window.__alifeDebug.runSeededWorldDiagnostic({
        seed,
        steps: 1000,
        restoreAfterRun: false,
        includeModelState: false,
        variant: 'performance-legacy-save'
      });
      return {
        encoded: window.__alifeDebug.captureSaveData(),
        counts: window.__alifeDebug.counts()
      };
    }, seed);
    encoded = result.encoded;
    baselineCounts = result.counts;
  } finally {
    await baseline.page.close();
  }
  const optimized = await openPage(browser, optimizedFile, seed);
  try {
    const result = await optimized.page.evaluate(encoded => {
      window.__alifeDebug.setSimulationRunning(false);
      const restored = window.__alifeDebug.restoreSaveData(encoded);
      return {
        restored,
        counts: window.__alifeDebug.counts(),
        indexValidation: window.__alifeDebug.validateOrganismIdIndex(),
        health: window.__alifeDebug.diagnosticNumberHealth()
      };
    }, encoded);
    return {
      baselineCounts,
      ...result,
      countsExact: JSON.stringify(baselineCounts) === JSON.stringify(result.counts),
      errors: [...baseline.errors, ...optimized.errors]
    };
  } finally {
    await optimized.page.close();
  }
}

function ecologySnapshot(value) {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy.organismIdIndex;
  return copy;
}

async function main() {
  const output = path.resolve(arg(
    'output',
    path.join('artifacts', 'performance_optimization', 'regression-data.json')
  ));
  const baselineRef = arg('baseline-ref', '645e163');
  const seed = Math.round(Number(arg('seed', '61001'))) || 61001;
  const steps = String(arg('steps', '1000,5000,10000'))
    .split(',')
    .map(Number)
    .filter(value => Number.isFinite(value) && value > 0)
    .map(value => Math.round(value));
  const files = {
    baseline: materialize(baselineRef, 'baseline'),
    optimized: materialize('WORKTREE', 'optimized')
  };
  const browser = await chromium.launch({ headless: true });
  try {
    const runs = [];
    for (const step of steps) {
      process.stdout.write(`baseline ${step} steps\n`);
      runs.push(await runStep(browser, files.baseline, 'baseline', seed, step));
      process.stdout.write(`optimized ${step} steps\n`);
      runs.push(await runStep(browser, files.optimized, 'optimized', seed, step));
    }
    const comparisons = steps.map(step => {
      const baseline = runs.find(row => row.label === 'baseline' && row.steps === step);
      const optimized = runs.find(row => row.label === 'optimized' && row.steps === step);
      return {
        steps: step,
        exactModelState: baseline.modelHash === optimized.modelHash,
        baselineModelHash: baseline.modelHash,
        optimizedModelHash: optimized.modelHash,
        snapshotExact: JSON.stringify(ecologySnapshot(baseline.snapshot))
          === JSON.stringify(ecologySnapshot(optimized.snapshot))
      };
    });
    const saveLoad = await saveLoadCheck(browser, files.optimized, seed);
    const legacySaveLoad = await legacySaveLoadCheck(
      browser,
      files.baseline,
      files.optimized,
      seed
    );
    const report = {
      generatedAt: new Date().toISOString(),
      seed,
      baselineRef,
      optimizedHead: childProcess.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      steps,
      runs,
      comparisons,
      saveLoad,
      legacySaveLoad
    };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    process.stdout.write(`${output}\n`);
    process.stdout.write(`${JSON.stringify(comparisons, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(saveLoad, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(legacySaveLoad, null, 2)}\n`);
  } finally {
    await browser.close();
    for (const file of Object.values(files)) {
      try { fs.unlinkSync(file); } catch (_) {}
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
