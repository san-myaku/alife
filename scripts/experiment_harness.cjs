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

const EXPERIMENT = process.env.ALIFE_EXPERIMENT || 'pack_attack_base';
const htmlFile = process.env.ALIFE_FILE || 'index.html';
const viewport = { width: 390, height: 844 };
const outputFile = process.env.ALIFE_EXPERIMENT_OUTPUT || path.join('artifacts', 'experiments', `${EXPERIMENT}.json`);
const decisionFile = process.env.ALIFE_EXPERIMENT_DECISION || path.join('artifacts', 'experiments', `${EXPERIMENT}_decision.json`);
const variants = [
  { name: 'baseline', packAttackBase: 0.78 },
  { name: 'candidate', packAttackBase: 1.00 }
];
const stages = {
  screening: {
    name: 'screening',
    seeds: [41001, 42001, 43001],
    steps: 2000,
    artificialTrials: 10,
    artificialSteps: 260
  },
  full: {
    name: 'full',
    seeds: [41001, 42001, 43001, 44001, 45001],
    steps: 6000,
    artificialTrials: 30,
    artificialSteps: 260
  }
};

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function rate(count, denominator) {
  const d = num(denominator, 0);
  return d > 0 ? num(count, 0) / d : null;
}

function rateObject(numerator, denominator) {
  return { numerator: num(numerator, 0), denominator: num(denominator, 0), rate: rate(numerator, denominator) };
}

function addRate(a, b) {
  return rateObject(num(a?.numerator) + num(b?.numerator), num(a?.denominator) + num(b?.denominator));
}

function safeDelta(candidate, baseline) {
  if (candidate == null && baseline == null) return 0;
  if (candidate == null) return -num(baseline, 0);
  if (baseline == null) return num(candidate, 0);
  return num(candidate) - num(baseline);
}

function nonWorse(candidate, baseline, tolerance = 1e-12) {
  if (candidate == null && baseline == null) return true;
  if (candidate == null) return baseline == null || baseline <= tolerance;
  if (baseline == null) return true;
  return candidate + tolerance >= baseline;
}

function pct(n) {
  return n == null ? null : Number(num(n).toFixed(6));
}

function getPack(run) {
  return run?.lineage?.strategies?.pack || {};
}

function getFormation(run) {
  return run?.lineage?.packFormation || {};
}

function getPopulation(run) {
  return run?.population || {};
}

function naturalMetrics(run) {
  const pack = getPack(run);
  const counts = pack.counts || {};
  const formation = getFormation(run);
  const attacks = formation.attacks || {};
  const population = getPopulation(run);
  const packAttack = rateObject(attacks.successes, attacks.total);
  const helperless = rateObject(
    num(attacks.successes) - num(attacks.successesWithEligibleHelper),
    attacks.withoutEligibleHelper
  );
  const helper = rateObject(attacks.successesWithEligibleHelper, attacks.withEligibleHelper);
  return {
    variant: run.variant,
    seed: run.seed,
    steps: run.steps,
    packAttackBase: run.packAttackBase,
    firstPredation: rateObject(counts.firstPredationSuccess, counts.born),
    maturity: rateObject(counts.reachedMaturity, counts.born),
    reproduction: rateObject(counts.reproduced, counts.born),
    packAttack,
    helperlessAttack: helperless,
    helperAttack: helper,
    survived60: rateObject(counts.survived60, counts.born),
    survived120: rateObject(counts.survived120, counts.born),
    survived180: rateObject(counts.survived180, counts.born),
    maxPackGenerationDepth: num(pack.maxGenerationDepth),
    endPack: num(formation.records?.currentLivingPack),
    packLevel1: pack.level1 || rateObject(0, 0),
    packLevel2: pack.level2 || rateObject(0, 0),
    packLevel3: pack.level3 || rateObject(0, 0),
    allCarnivoreLevel3: run?.lineage?.parentLineage?.level3 || rateObject(0, 0),
    endPopulation: num(population.endPopulation),
    endDiets: population.endDiets || {},
    births: population.births || {},
    deaths: population.deaths || {},
    worldReseedCount: num(run.worldReseedCount),
    safety: {
      nanOrInfinity: num(run.health?.badCount),
      energyCreationEvents: num(run.lineage?.packHunt?.energyCreationEvents),
      nutrientCreationEvents: num(run.lineage?.packHunt?.nutrientCreationEvents)
    }
  };
}

function compactRun(run) {
  const metrics = naturalMetrics(run);
  return {
    variant: run.variant,
    seed: run.seed,
    steps: run.steps,
    elapsedMs: run.elapsedMs,
    packAttackBase: run.packAttackBase,
    shareFraction: run.shareFraction,
    targetConsensus: run.targetConsensus,
    maxCarnivores: run.maxCarnivores,
    endCarnivores: run.endCarnivores,
    worldReseedCount: run.worldReseedCount,
    metrics,
    packStrategy: getPack(run),
    packFormation: {
      records: getFormation(run).records,
      funnel: getFormation(run).funnel,
      attacks: getFormation(run).attacks,
      targetSharing: getFormation(run).targetSharing,
      maxGenerationDepth: getFormation(run).maxGenerationDepth
    },
    packHunt: run.lineage?.packHunt,
    population: getPopulation(run),
    health: run.health,
    telemetryCounts: run.telemetryCounts
  };
}

function pooledNatural(rows) {
  const pooled = {
    firstPredation: rateObject(0, 0),
    maturity: rateObject(0, 0),
    reproduction: rateObject(0, 0),
    packAttack: rateObject(0, 0),
    helperlessAttack: rateObject(0, 0),
    helperAttack: rateObject(0, 0),
    survived60: rateObject(0, 0),
    survived120: rateObject(0, 0),
    survived180: rateObject(0, 0),
    packLevel1: rateObject(0, 0),
    packLevel2: rateObject(0, 0),
    packLevel3: rateObject(0, 0),
    allCarnivoreLevel3: rateObject(0, 0),
    maxPackGenerationDepth: 0,
    endPackAverage: 0,
    endPopulationAverage: 0,
    endDietsAverage: { h: 0, m: 0, c: 0 },
    safety: { nanOrInfinity: 0, energyCreationEvents: 0, nutrientCreationEvents: 0 }
  };
  for (const row of rows) {
    for (const key of ['firstPredation', 'maturity', 'reproduction', 'packAttack', 'helperlessAttack', 'helperAttack', 'survived60', 'survived120', 'survived180', 'packLevel1', 'packLevel2', 'packLevel3', 'allCarnivoreLevel3']) {
      pooled[key] = addRate(pooled[key], row[key]);
    }
    pooled.maxPackGenerationDepth = Math.max(pooled.maxPackGenerationDepth, num(row.maxPackGenerationDepth));
    pooled.endPackAverage += num(row.endPack);
    pooled.endPopulationAverage += num(row.endPopulation);
    pooled.endDietsAverage.h += num(row.endDiets.h);
    pooled.endDietsAverage.m += num(row.endDiets.m);
    pooled.endDietsAverage.c += num(row.endDiets.c);
    pooled.safety.nanOrInfinity += num(row.safety.nanOrInfinity);
    pooled.safety.energyCreationEvents += num(row.safety.energyCreationEvents);
    pooled.safety.nutrientCreationEvents += num(row.safety.nutrientCreationEvents);
  }
  const n = Math.max(1, rows.length);
  pooled.endPackAverage /= n;
  pooled.endPopulationAverage /= n;
  pooled.endDietsAverage.h /= n;
  pooled.endDietsAverage.m /= n;
  pooled.endDietsAverage.c /= n;
  return pooled;
}

function artificialMetrics(run) {
  const out = {};
  for (const [size, row] of Object.entries(run?.results || {})) {
    const same = row.scenarios?.allSameTarget || {};
    out[size] = {
      groupSize: Number(size),
      successRate: same.predationSuccessRate ?? null,
      helperAttackRate: same.helperAttackRate ?? null,
      attackRate: same.attackRate ?? null,
      trials: same.trials || 0,
      safety: same.safety || { nanOrInfinity: 0, energyCreationEvents: 0, nutrientCreationEvents: 0 }
    };
  }
  return out;
}

function countErrorEntries(value) {
  if (!value) return 0;
  if (Array.isArray(value)) {
    if (value.every(item => typeof item === 'string')) return value.length;
    return value.reduce((sum, item) => sum + countErrorEntries(item), 0);
  }
  if (typeof value === 'object') {
    return Object.values(value).reduce((sum, item) => sum + countErrorEntries(item), 0);
  }
  return 0;
}

function microOk(micro) {
  if (!micro || typeof micro !== 'object') return false;
  return Object.values(micro).every(result => !!result?.ok);
}

function sumSafety(stageResult) {
  const safety = { pageErrors: 0, nanOrInfinity: 0, energyCreationEvents: 0, nutrientCreationEvents: 0 };
  safety.pageErrors = countErrorEntries(stageResult.errors);
  for (const run of stageResult.runs || []) {
    const m = naturalMetrics(run);
    safety.nanOrInfinity += num(m.safety.nanOrInfinity);
    safety.energyCreationEvents += num(m.safety.energyCreationEvents);
    safety.nutrientCreationEvents += num(m.safety.nutrientCreationEvents);
  }
  for (const artificial of Object.values(stageResult.artificial || {})) {
    for (const row of Object.values(artificialMetrics(artificial))) {
      safety.nanOrInfinity += num(row.safety.nanOrInfinity);
      safety.energyCreationEvents += num(row.safety.energyCreationEvents);
      safety.nutrientCreationEvents += num(row.safety.nutrientCreationEvents);
    }
  }
  return safety;
}

function compareStage(stageResult) {
  const metrics = {};
  for (const variant of variants) {
    metrics[variant.name] = (stageResult.runs || [])
      .filter(r => r.variant === variant.name)
      .map(naturalMetrics);
  }
  const pooled = {
    baseline: pooledNatural(metrics.baseline || []),
    candidate: pooledNatural(metrics.candidate || [])
  };
  const artificial = {
    baseline: artificialMetrics(stageResult.artificial?.baseline),
    candidate: artificialMetrics(stageResult.artificial?.candidate)
  };
  const pairedSeeds = (metrics.baseline || []).map(base => {
    const cand = (metrics.candidate || []).find(r => r.seed === base.seed);
    const firstPredationRateDelta = safeDelta(cand?.firstPredation.rate, base.firstPredation.rate);
    const maturityRateDelta = safeDelta(cand?.maturity.rate, base.maturity.rate);
    const packAttackSuccessRateDelta = safeDelta(cand?.packAttack.rate, base.packAttack.rate);
    return {
      seed: base.seed,
      firstPredationRateDelta,
      maturityRateDelta,
      packAttackSuccessRateDelta,
      nonWorse: !!cand &&
        nonWorse(cand.firstPredation.rate, base.firstPredation.rate) &&
        nonWorse(cand.maturity.rate, base.maturity.rate) &&
        nonWorse(cand.packAttack.rate, base.packAttack.rate)
    };
  });
  const endPopulationDeltaRate = pooled.baseline.endPopulationAverage > 0
    ? (pooled.candidate.endPopulationAverage - pooled.baseline.endPopulationAverage) / pooled.baseline.endPopulationAverage
    : 0;
  return {
    metrics,
    pooled,
    artificial,
    pairedSeeds,
    deltas: {
      firstPredationRateDelta: safeDelta(pooled.candidate.firstPredation.rate, pooled.baseline.firstPredation.rate),
      maturityRateDelta: safeDelta(pooled.candidate.maturity.rate, pooled.baseline.maturity.rate),
      packAttackSuccessRateDelta: safeDelta(pooled.candidate.packAttack.rate, pooled.baseline.packAttack.rate),
      helperlessAttackSuccessRateDelta: safeDelta(pooled.candidate.helperlessAttack.rate, pooled.baseline.helperlessAttack.rate),
      helperAttackSuccessRateDelta: safeDelta(pooled.candidate.helperAttack.rate, pooled.baseline.helperAttack.rate),
      maxPackGenerationDepthDelta: pooled.candidate.maxPackGenerationDepth - pooled.baseline.maxPackGenerationDepth,
      endPackDelta: pooled.candidate.endPackAverage - pooled.baseline.endPackAverage,
      endPopulationDeltaRate
    },
    safety: sumSafety(stageResult),
    microOk: microOk(stageResult.micro)
  };
}

function artificialNonWorse(compare, groupSize) {
  const key = String(groupSize);
  return nonWorse(compare.artificial.candidate?.[key]?.successRate, compare.artificial.baseline?.[key]?.successRate);
}

function shouldPromote(compare) {
  const primaryImproved = compare.deltas.firstPredationRateDelta >= 0.10 ||
    compare.deltas.maturityRateDelta >= 0.05;
  const seedNonWorseCount = compare.pairedSeeds.filter(s => s.nonWorse).length;
  const populationOk = compare.deltas.endPopulationDeltaRate > -0.20;
  const safetyOk = compare.safety.pageErrors === 0 &&
    compare.safety.nanOrInfinity === 0 &&
    compare.safety.energyCreationEvents === 0 &&
    compare.safety.nutrientCreationEvents === 0;
  return {
    decision: primaryImproved &&
      seedNonWorseCount >= 2 &&
      populationOk &&
      artificialNonWorse(compare, 1) &&
      artificialNonWorse(compare, 2) &&
      safetyOk &&
      compare.microOk ? 'promote' : 'reject',
    checks: {
      primaryImproved,
      seedNonWorseCount,
      populationOk,
      artificial1NonWorse: artificialNonWorse(compare, 1),
      artificial2NonWorse: artificialNonWorse(compare, 2),
      safetyOk,
      microOk: compare.microOk
    }
  };
}

function shouldAdopt(compare) {
  const improvedSeeds = compare.pairedSeeds.filter(s => s.firstPredationRateDelta > 0 || s.maturityRateDelta > 0).length;
  const pooledImproved = compare.deltas.firstPredationRateDelta > 0 || compare.deltas.maturityRateDelta > 0;
  const depthOk = compare.deltas.maxPackGenerationDepthDelta >= 0;
  const allCarnivoreOk = nonWorse(compare.pooled.candidate.allCarnivoreLevel3.rate, compare.pooled.baseline.allCarnivoreLevel3.rate);
  const populationOk = Math.abs(compare.deltas.endPopulationDeltaRate) <= 0.20;
  const dietOk = ['h', 'm'].every(key => {
    const base = num(compare.pooled.baseline.endDietsAverage[key]);
    const cand = num(compare.pooled.candidate.endDietsAverage[key]);
    return base <= 1 || cand >= base * 0.50;
  });
  const safetyOk = compare.safety.pageErrors === 0 &&
    compare.safety.nanOrInfinity === 0 &&
    compare.safety.energyCreationEvents === 0 &&
    compare.safety.nutrientCreationEvents === 0;
  const artificialSmallOk = artificialNonWorse(compare, 1) && artificialNonWorse(compare, 2);
  const artificialLargeOk = [3, 4].every(size => {
    const key = String(size);
    const base = compare.artificial.baseline?.[key]?.successRate;
    const cand = compare.artificial.candidate?.[key]?.successRate;
    const delta = safeDelta(cand, base);
    return cand == null || (cand <= 0.90 && delta <= 0.25);
  });
  return {
    decision: improvedSeeds >= 3 &&
      pooledImproved &&
      depthOk &&
      allCarnivoreOk &&
      populationOk &&
      dietOk &&
      safetyOk &&
      compare.microOk &&
      artificialSmallOk &&
      artificialLargeOk ? 'adopt' : 'keep_baseline',
    checks: {
      improvedSeeds,
      pooledImproved,
      depthOk,
      allCarnivoreOk,
      populationOk,
      dietOk,
      safetyOk,
      microOk: compare.microOk,
      artificialSmallOk,
      artificialLargeOk
    }
  };
}

function decisionSummary(stage, decision, compare, extra = {}) {
  return {
    experiment: EXPERIMENT,
    stage,
    decision,
    primary: {
      firstPredationRateDelta: pct(compare.deltas.firstPredationRateDelta),
      maturityRateDelta: pct(compare.deltas.maturityRateDelta),
      packAttackSuccessRateDelta: pct(compare.deltas.packAttackSuccessRateDelta)
    },
    population: {
      endPopulationDeltaRate: pct(compare.deltas.endPopulationDeltaRate)
    },
    safety: compare.safety,
    ...extra
  };
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (err) {
    const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    if (!fs.existsSync(chromePath)) throw err;
    return chromium.launch({ headless: true, executablePath: chromePath });
  }
}

async function bootPage(browser, initSeed = null) {
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
  const url = 'file:///' + path.resolve(htmlFile).replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__alifeDebug?.runSeededWorldDiagnostic, null, { timeout: 15000 });
  return { page, errors, url };
}

async function runMicros(page) {
  return page.evaluate(() => ({
    carnivoreLineage: window.__alifeDebug.runCarnivoreLineageMicroTests(),
    packFormation: window.__alifeDebug.runPackFormationMicroTests(),
    packSharing: window.__alifeDebug.runPackSharingMicroTests(),
    packConsensus: window.__alifeDebug.runPackConsensusMicroTests()
  }));
}

async function runWorld(browser, stageConfig, variant, seed) {
  const boot = await bootPage(browser, seed);
  try {
    const run = await boot.page.evaluate(
      ({ seed, steps, variant }) => window.__alifeDebug.runSeededWorldDiagnostic({
        seed,
        steps,
        variant: variant.name,
        shareFraction: 0,
        targetConsensus: false,
        packAttackBase: variant.packAttackBase,
        packHuntTelemetry: true
      }),
      { seed, steps: stageConfig.steps, variant }
    );
    return { run, errors: boot.errors };
  } finally {
    await boot.page.close();
  }
}

async function runArtificial(page, stageConfig, variant) {
  return page.evaluate(
    ({ trials, maxSteps, variant }) => window.__alifeDebug.runArtificialPackFormationExperiment({
      trials,
      maxSteps,
      seed: 92001,
      targetConsensus: false,
      packAttackBase: variant.packAttackBase,
      groupSizes: [1, 2, 3, 4],
      scenarios: ['allSameTarget']
    }),
    { trials: stageConfig.artificialTrials, maxSteps: stageConfig.artificialSteps, variant }
  );
}

async function runStage(browser, stageConfig) {
  const control = await bootPage(browser, stageConfig.seeds[0]);
  const result = {
    config: stageConfig,
    micro: null,
    artificial: {},
    runs: [],
    errors: { control: control.errors, world: [] }
  };
  try {
    result.micro = await runMicros(control.page);
    for (const variant of variants) {
      result.artificial[variant.name] = await runArtificial(control.page, stageConfig, variant);
    }
  } finally {
    await control.page.close();
  }
  for (const seed of stageConfig.seeds) {
    for (const variant of variants) {
      const world = await runWorld(browser, stageConfig, variant, seed);
      result.runs.push(world.run);
      result.errors.world.push({ variant: variant.name, seed, errors: world.errors });
    }
  }
  const compare = compareStage(result);
  return {
    ...result,
    runs: result.runs.map(compactRun),
    compare
  };
}

(async () => {
  const browser = await launchBrowser();
  const artifact = {
    experiment: EXPERIMENT,
    htmlFile,
    variants,
    protocol: {
      oneFactor: 'packAttackBase',
      baseline: '0.78 + 0.095 * mates',
      candidate: '1.00 + 0.095 * mates',
      targetConsensus: false,
      shareFraction: 0
    },
    stages: {}
  };
  let decision;
  try {
    const screening = await runStage(browser, stages.screening);
    artifact.stages.screening = screening;
    const promotion = shouldPromote(screening.compare);
    if (promotion.decision !== 'promote') {
      decision = decisionSummary('screening', 'reject', screening.compare, {
        promotionChecks: promotion.checks,
        normalDefault: 0.78
      });
    } else {
      const full = await runStage(browser, stages.full);
      artifact.stages.full = full;
      const adoption = shouldAdopt(full.compare);
      decision = decisionSummary('full', adoption.decision, full.compare, {
        promotionChecks: promotion.checks,
        adoptionChecks: adoption.checks,
        normalDefault: adoption.decision === 'adopt' ? 1.00 : 0.78
      });
    }
  } finally {
    await browser.close();
  }

  fs.mkdirSync(path.dirname(path.resolve(outputFile)), { recursive: true });
  fs.mkdirSync(path.dirname(path.resolve(decisionFile)), { recursive: true });
  artifact.decision = decision;
  fs.writeFileSync(outputFile, JSON.stringify(artifact, null, 2));
  fs.writeFileSync(decisionFile, JSON.stringify(decision, null, 2));
  console.log(JSON.stringify({
    experiment: decision.experiment,
    stage: decision.stage,
    decision: decision.decision,
    primary: decision.primary,
    population: decision.population,
    safety: decision.safety,
    artifact: outputFile,
    decisionArtifact: decisionFile
  }, null, 2));
})().catch(err => {
  console.error(err);
  process.exit(1);
});
