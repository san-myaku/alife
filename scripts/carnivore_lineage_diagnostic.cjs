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
const longSteps = Math.max(steps, Number(process.env.ALIFE_LONG_STEPS || 12000));
const viewport = { width: 390, height: 844 };
const compactOutput = String(process.env.ALIFE_DIAG_COMPACT || '0') === '1';
const outputFile = process.env.ALIFE_DIAG_OUTPUT || '';
const variants = String(process.env.ALIFE_VARIANTS || 'baseline:0,share30:0.30,share40:0.40')
  .split(',')
  .map(part => {
    const [name, value] = part.split(':');
    const shareFraction = Number(value || 0);
    return { name: String(name || '').trim(), shareFraction: Number.isFinite(shareFraction) ? shareFraction : 0 };
  })
  .filter(v => v.name);

function persistenceFrames(result) {
  if (!result) return 0;
  if (result.endCarnivores > 0) return result.steps;
  return result.carnivoreExtinctionFrame == null ? result.steps : result.carnivoreExtinctionFrame;
}

function packBornLevel3(result) {
  return Number(result?.lineage?.strategies?.pack?.counts?.level3 || 0);
}

function packMaxGenerationDepth(result) {
  return Number(result?.lineage?.strategies?.pack?.maxGenerationDepth || 0);
}

function chooseLongRun(runs) {
  return runs.slice().sort((a, b) => {
    const byLevel3 = packBornLevel3(b) - packBornLevel3(a);
    if (byLevel3) return byLevel3;
    const byDepth = packMaxGenerationDepth(b) - packMaxGenerationDepth(a);
    if (byDepth) return byDepth;
    const byPersistence = persistenceFrames(b) - persistenceFrames(a);
    if (byPersistence) return byPersistence;
    return Number(b.endCarnivores || 0) - Number(a.endCarnivores || 0);
  })[0];
}

function compactStrategy(strategy) {
  if (!strategy) return null;
  return {
    counts: strategy.counts,
    rates: strategy.rates,
    birthEnergy: strategy.birthEnergy,
    clutch: strategy.clutch,
    clutchIndex: strategy.clutchIndex,
    reproductionModeCounts: strategy.reproductionModeCounts,
    generationDepth: strategy.generationDepth,
    maxGenerationDepth: strategy.maxGenerationDepth,
    level1: strategy.level1,
    level2: strategy.level2,
    level3: strategy.level3
  };
}

function compactRun(run) {
  const lineage = run.lineage || {};
  const funnel = lineage.funnel || {};
  const rates = funnel.rates || {};
  const deaths = lineage.deaths || {};
  const parent = lineage.parentLineage || {};
  const population = run.population || {};
  return {
    variant: run.variant,
    shareFraction: run.shareFraction,
    seed: run.seed,
    steps: run.steps,
    elapsedMs: run.elapsedMs,
    maxCarnivores: run.maxCarnivores,
    endCarnivores: run.endCarnivores,
    carnivoreExtinctionFrame: run.carnivoreExtinctionFrame,
    extinctionEpisodeCount: run.extinctionEpisodeCount,
    reappearanceCount: run.reappearanceCount,
    initialCarnivores: run.initialCarnivores,
    bornCarnivores: run.bornCarnivores,
    maxGenerationDepth: run.maxGenerationDepth,
    worldReseedCount: run.worldReseedCount,
    normalPopulationMaintained: run.normalPopulationMaintained,
    world: {
      startPopulation: population.startPopulation,
      endPopulation: population.endPopulation,
      endDiets: population.endDiets,
      births: population.births,
      deaths: population.deaths,
      reproductions: population.reproductions,
      deathCauses: population.deathCauses
    },
    currentCarnivoreMutations: lineage.currentCarnivoreMutations,
    initialSummary: lineage.initialCarnivores,
    bornSummary: lineage.bornCarnivores,
    funnel: {
      counts: funnel.counts,
      rates: {
        survived60: rates.survived60,
        survived120: rates.survived120,
        survived180: rates.survived180,
        maturity: rates.maturity,
        validPrey: rates.validPrey,
        targetFromValidPrey: rates.targetFromValidPrey,
        chaseFromTarget: rates.chaseFromTarget,
        contactFromChase: rates.contactFromChase,
        attackFromContact: rates.attackFromContact,
        predationFromAttack: rates.predationFromAttack,
        thresholdFromPredation: rates.thresholdFromPredation,
        eligibleFromThreshold: rates.eligibleFromThreshold,
        reproductionFromEligible: rates.reproductionFromEligible,
        carnivoreChildFromReproduced: rates.carnivoreChildFromReproduced,
        maturedCarnivoreChildFromCarnivoreChildParent: rates.maturedCarnivoreChildFromCarnivoreChildParent,
        level3FromBornCarnivore: rates.level3FromBornCarnivore
      }
    },
    strategies: {
      pack: compactStrategy(lineage.strategies?.pack),
      ambusher: compactStrategy(lineage.strategies?.ambusher),
      other: compactStrategy(lineage.strategies?.other)
    },
    packHunt: lineage.packHunt,
    levelRates: {
      level1: parent.level1,
      level2: parent.level2,
      level3: parent.level3
    },
    generations: lineage.generations,
    birthEnergyAndClutch: lineage.birthEnergyAndClutch,
    deaths,
    predationFailures: lineage.predationFailures,
    extinction: lineage.extinction,
    memory: lineage.memory,
    health: run.health,
    performance: run.performance,
    telemetryCounts: run.telemetryCounts
  };
}

function compactResult(result) {
  return {
    htmlFile: result.htmlFile,
    seeds: result.seeds,
    steps: result.steps,
    longSteps: result.longSteps,
    variants: result.variants,
    micro: result.micro,
    runs: result.runs.map(compactRun),
    selectedLongRun: result.selectedLongRun,
    longRun: compactRun(result.longRun),
    roundTrip: result.roundTrip,
    boot: result.boot,
    errors: result.errors
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
  await page.waitForFunction(() => !!window.__alifeDebug?.carnivoreLineageSummary, null, { timeout: 15000 });
  return { page, errors, url };
}

async function runSeededDiagnostic(browser, variant, seed, runSteps) {
  const seeded = await bootPage(browser, false, seed);
  try {
    const run = await seeded.page.evaluate(
      ({ seed, runSteps, variant }) => window.__alifeDebug.runSeededWorldDiagnostic({
        seed,
        steps: runSteps,
        variant: variant.name,
        shareFraction: variant.shareFraction,
        packHuntTelemetry: true
      }),
      { seed, runSteps, variant }
    );
    return { run, errors: seeded.errors, url: seeded.url };
  } finally {
    await seeded.page.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const normal = await bootPage(browser, false);
  const lineageMicro = await normal.page.evaluate(() => window.__alifeDebug.runCarnivoreLineageMicroTests());
  const packSharingMicro = await normal.page.evaluate(() => window.__alifeDebug.runPackSharingMicroTests());
  const micro = {
    ok: !!(lineageMicro?.ok && packSharingMicro?.ok),
    lineage: lineageMicro,
    packSharing: packSharingMicro
  };
  const runs = [];
  const runErrors = [];
  for (const variant of variants) {
    for (const seed of seeds) {
      const seededRun = await runSeededDiagnostic(browser, variant, seed, steps);
      runs.push(seededRun.run);
      runErrors.push({ variant: variant.name, seed, errors: seededRun.errors });
    }
  }
  const selected = chooseLongRun(runs);
  const selectedVariant = variants.find(v => v.name === selected.variant) || { name: selected.variant, shareFraction: selected.shareFraction };
  const seededLongRun = await runSeededDiagnostic(browser, selectedVariant, selected.seed, longSteps);
  const longRun = seededLongRun.run;
  const roundTrip = await normal.page.evaluate(() => window.__alifeDebug.roundTripSave());
  const normalBoot = await normal.page.evaluate(() => ({
    counts: window.__alifeDebug.counts(),
    developerMode: window.__alifeDebug.developerMode(),
    health: window.__alifeDebug.diagnosticNumberHealth(),
    performance: window.__alifeDebug.performanceSummary()
  }));

  const dev = await bootPage(browser, true);
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
    longSteps,
    variants,
    micro,
    runs,
    selectedLongRun: {
      variant: selected.variant,
      shareFraction: selected.shareFraction,
      seed: selected.seed,
      reason: 'highest pack born Level 3, then pack max generation depth, then carnivore persistence frame, then ending carnivores',
      packBornLevel3: packBornLevel3(selected),
      packMaxGenerationDepth: packMaxGenerationDepth(selected),
      persistenceFrames: persistenceFrames(selected),
      endCarnivores: selected.endCarnivores
    },
    longRun,
    roundTrip,
    boot: {
      normal: normalBoot,
      developer: devBoot
    },
    errors: {
      normal: normal.errors,
      developer: dev.errors,
      runs: runErrors,
      longRun: { variant: selected.variant, seed: selected.seed, errors: seededLongRun.errors }
    }
  };
  const payload = compactOutput ? compactResult(result) : result;
  const json = JSON.stringify(payload, null, 2);
  if (outputFile) {
    const outputDir = path.dirname(path.resolve(outputFile));
    if (outputDir && outputDir !== process.cwd()) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputFile, json);
    console.log(JSON.stringify({
      outputFile,
      seeds,
      steps,
      longSteps,
      variants,
      selectedLongRun: payload.selectedLongRun,
      microOk: payload.micro.ok,
      normalErrors: payload.errors.normal.length,
      developerErrors: payload.errors.developer.length,
      runErrors: payload.errors.runs.reduce((sum, r) => sum + r.errors.length, 0),
      longRunErrors: payload.errors.longRun.errors.length
    }, null, 2));
    return;
  }
  console.log(json);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
