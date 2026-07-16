const fs = require('fs');
const path = require('path');
const Module = require('module');

function addNodeModuleDir(dir) {
  if (!dir || !fs.existsSync(dir)) return;
  const current = process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : [];
  if (!current.includes(dir)) {
    current.push(dir);
    process.env.NODE_PATH = current.join(path.delimiter);
    Module._initPaths();
  }
}

const home = process.env.USERPROFILE || process.env.HOME || '';
addNodeModuleDir(path.join(home, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules'));
addNodeModuleDir(path.join(home, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', '.pnpm', 'node_modules'));

const { chromium } = require('playwright');

const htmlFile = process.env.ALIFE_FILE || 'index.html';
const seeds = String(process.env.ALIFE_SEEDS || '41001,42001,43001')
  .split(',')
  .map(s => Number(s.trim()))
  .filter(Number.isFinite);
const steps = Math.max(1, Number(process.env.ALIFE_STEPS || 6000));
const artificialTrials = Math.max(1, Number(process.env.ALIFE_PACK_TRIALS || 30));
const artificialSteps = Math.max(20, Number(process.env.ALIFE_PACK_STEPS || 260));
const viewport = { width: 390, height: 844 };
const outputFile = process.env.ALIFE_DIAG_OUTPUT || path.join('artifacts', 'pack_formation_diagnostic.json');

function compactPackFormation(lineage) {
  const pf = lineage?.packFormation || {};
  return {
    records: pf.records,
    maxPackWorld: pf.maxPackWorld,
    maxSameSpeciesPackWorld: pf.maxSameSpeciesPackWorld,
    maxGenerationDepth: pf.maxGenerationDepth,
    funnel: pf.funnel,
    targetSharing: pf.targetSharing,
    attacks: pf.attacks,
    speciesKey: pf.speciesKey,
    deathClasses: pf.deathClasses,
    contextEventsStored: pf.contextEventsStored,
    attackAttemptsStored: pf.attackAttemptsStored,
    targetEventsStored: pf.targetEventsStored
  };
}

function compactRun(run) {
  const lineage = run.lineage || {};
  const packStrategy = lineage.strategies?.pack || {};
  return {
    variant: run.variant,
    shareFraction: run.shareFraction,
    seed: run.seed,
    steps: run.steps,
    elapsedMs: run.elapsedMs,
    maxCarnivores: run.maxCarnivores,
    endCarnivores: run.endCarnivores,
    carnivoreExtinctionFrame: run.carnivoreExtinctionFrame,
    worldReseedCount: run.worldReseedCount,
    population: {
      endPopulation: run.population?.endPopulation,
      endDiets: run.population?.endDiets,
      births: run.population?.births,
      deaths: run.population?.deaths,
      deathCauses: run.population?.deathCauses
    },
    packStrategy: {
      counts: packStrategy.counts,
      rates: packStrategy.rates,
      birthEnergy: packStrategy.birthEnergy,
      clutch: packStrategy.clutch,
      maxGenerationDepth: packStrategy.maxGenerationDepth,
      level1: packStrategy.level1,
      level2: packStrategy.level2,
      level3: packStrategy.level3
    },
    packFormation: compactPackFormation(lineage),
    packHunt: lineage.packHunt,
    memory: lineage.memory,
    health: run.health,
    performance: run.performance,
    telemetryCounts: run.telemetryCounts
  };
}

async function bootPage(browser, dev = false, initSeed = null) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  if (initSeed != null) {
    await page.addInitScript(seed => {
      let s = (Number(seed) || 1) >>> 0;
      if (s === 0) s = 1;
      Math.random = function seededDiagnosticRandom() {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }, initSeed);
  }
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror:${e.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console:${msg.text()}`);
  });
  const url = 'file:///' + path.resolve(htmlFile).replace(/\\/g, '/') + (dev ? '?dev=1' : '');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__alifeDebug?.runPackFormationMicroTests, null, { timeout: 15000 });
  return { page, errors, url };
}

async function runSeededDiagnostic(browser, seed) {
  const seeded = await bootPage(browser, false, seed);
  try {
    const run = await seeded.page.evaluate(
      ({ seed, steps }) => window.__alifeDebug.runSeededWorldDiagnostic({
        seed,
        steps,
        variant: 'baseline',
        shareFraction: 0,
        packHuntTelemetry: true
      }),
      { seed, steps }
    );
    return { run, errors: seeded.errors, url: seeded.url };
  } finally {
    await seeded.page.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const normal = await bootPage(browser, false, seeds[0] || 1);
  const micro = await normal.page.evaluate(() => window.__alifeDebug.runPackFormationMicroTests());
  const artificial = await normal.page.evaluate(
    ({ trials, maxSteps }) => window.__alifeDebug.runArtificialPackFormationExperiment({ trials, maxSteps, seed: 92001 }),
    { trials: artificialTrials, maxSteps: artificialSteps }
  );
  const roundTrip = await normal.page.evaluate(() => window.__alifeDebug.roundTripSave());
  const normalBoot = await normal.page.evaluate(() => ({
    counts: window.__alifeDebug.counts(),
    developerMode: window.__alifeDebug.developerMode(),
    health: window.__alifeDebug.diagnosticNumberHealth(),
    performance: window.__alifeDebug.performanceSummary()
  }));

  const runs = [];
  const runErrors = [];
  for (const seed of seeds) {
    const seededRun = await runSeededDiagnostic(browser, seed);
    runs.push(seededRun.run);
    runErrors.push({ seed, errors: seededRun.errors });
  }

  const dev = await bootPage(browser, true, seeds[0] || 1);
  const devBoot = await dev.page.evaluate(() => ({
    counts: window.__alifeDebug.counts(),
    developerMode: window.__alifeDebug.developerMode(),
    health: window.__alifeDebug.diagnosticNumberHealth(),
    performance: window.__alifeDebug.performanceSummary()
  }));

  await dev.page.close();
  await normal.page.close();
  await browser.close();

  const result = {
    htmlFile,
    seeds,
    steps,
    variant: 'baseline',
    shareFraction: 0,
    artificial: {
      trials: artificialTrials,
      maxSteps: artificialSteps,
      result: artificial
    },
    micro,
    runs: runs.map(compactRun),
    roundTrip,
    boot: {
      normal: normalBoot,
      developer: devBoot
    },
    errors: {
      normal: normal.errors,
      developer: dev.errors,
      runs: runErrors
    }
  };

  const outputDir = path.dirname(path.resolve(outputFile));
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({
    outputFile,
    seeds,
    steps,
    artificialTrials,
    artificialSteps,
    microOk: !!micro?.ok,
    normalErrors: normal.errors.length,
    developerErrors: dev.errors.length,
    runErrors: runErrors.reduce((sum, r) => sum + r.errors.length, 0)
  }, null, 2));
})().catch(err => {
  console.error(err);
  process.exit(1);
});
