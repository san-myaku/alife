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

const experiment = 'role_social_ecology';
const htmlFile = process.env.ALIFE_FILE || 'index.html';
const seeds = String(process.env.ALIFE_SEEDS || '41001,42001,43001,44001,45001')
  .split(',')
  .map(s => Number(s.trim()))
  .filter(Number.isFinite);
const steps = Math.max(1, Number(process.env.ALIFE_STEPS || 2000));
const staticSeed = Number(process.env.ALIFE_STATIC_SEED || 61001);
const staticSamples = Math.max(1, Number(process.env.ALIFE_STATIC_SAMPLES || 50000));
const outputFile = process.env.ALIFE_EXPERIMENT_OUTPUT || path.join('artifacts', 'experiments', `${experiment}.json`);
const decisionFile = process.env.ALIFE_EXPERIMENT_DECISION || path.join('artifacts', 'experiments', `${experiment}_decision.json`);
const viewport = { width: 390, height: 844 };

const roles = ['pursuit', 'ambusher', 'scav', 'filter', 'other'];
const modes = ['solitary', 'hunt-pack', 'defense-school', 'trail', 'cluster', 'school'];
const groups = ['A', 'B', 'C', 'D'];
const diets = ['herbivore', 'omnivore', 'carnivore'];
const metricFields = [
  'initial',
  'births',
  'livingEnd',
  'survived60',
  'survived120',
  'survived180',
  'matured',
  'firstPredation',
  'attackAttempts',
  'predationSuccesses',
  'reproduced',
  'starvationDeaths',
  'predationDeaths',
  'oldAgeDeaths',
  'otherDeaths',
  'maxGenerationDepth'
];

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function rate(numerator, denominator) {
  const d = num(denominator);
  return d > 0 ? num(numerator) / d : null;
}

function rateObject(numerator, denominator) {
  return { numerator: num(numerator), denominator: num(denominator), rate: rate(numerator, denominator) };
}

function round(value, digits = 6) {
  return value == null ? null : Number(num(value).toFixed(digits));
}

function blankMetric(label = undefined) {
  const metric = {};
  if (label) metric.label = label;
  for (const key of metricFields) metric[key] = 0;
  return metric;
}

function addMetric(target, source) {
  if (!target || !source) return;
  for (const key of metricFields) {
    if (key === 'maxGenerationDepth') target[key] = Math.max(num(target[key]), num(source[key]));
    else target[key] = num(target[key]) + num(source[key]);
  }
}

function finishMetric(metric) {
  const birthDen = num(metric.births);
  const deathDen = num(metric.initial) + birthDen;
  metric.rates = {
    survived60: rateObject(metric.survived60, birthDen),
    survived120: rateObject(metric.survived120, birthDen),
    survived180: rateObject(metric.survived180, birthDen),
    maturity: rateObject(metric.matured, birthDen),
    firstPredation: rateObject(metric.firstPredation, birthDen),
    attackSuccess: rateObject(metric.predationSuccesses, metric.attackAttempts),
    reproduction: rateObject(metric.reproduced, birthDen),
    starvationDeath: rateObject(metric.starvationDeaths, deathDen),
    predationDeath: rateObject(metric.predationDeaths, deathDen),
    oldAgeDeath: rateObject(metric.oldAgeDeaths, deathDen),
    otherDeath: rateObject(metric.otherDeaths, deathDen)
  };
  return metric;
}

function finishMetricTree(node) {
  if (!node || typeof node !== 'object') return;
  if (Object.prototype.hasOwnProperty.call(node, 'births') && Object.prototype.hasOwnProperty.call(node, 'initial')) {
    finishMetric(node);
    return;
  }
  for (const value of Object.values(node)) finishMetricTree(value);
}

function blankCross() {
  const out = {};
  for (const role of roles) {
    out[role] = {};
    for (const mode of modes) out[role][mode] = blankMetric();
  }
  return out;
}

function blankByDiet() {
  const out = {};
  for (const diet of diets) out[diet] = blankCross();
  return out;
}

function blankTransitions() {
  const matrix = {};
  for (const from of groups) {
    matrix[from] = { total: 0 };
    for (const to of groups) matrix[from][to] = 0;
  }
  return {
    matrix,
    unknownParent: 0,
    changes: {
      parentKnown: 0,
      huntPackParent: 0,
      huntPackLost: 0,
      huntPackGained: 0,
      pursuitParent: 0,
      pursuitLost: 0,
      pursuitGained: 0
    }
  };
}

function addTransitions(target, source) {
  if (!source) return;
  target.unknownParent += num(source.unknownParent);
  for (const from of groups) {
    target.matrix[from].total += num(source.matrix?.[from]?.total);
    for (const to of groups) target.matrix[from][to] += num(source.matrix?.[from]?.[to]);
  }
  for (const key of Object.keys(target.changes)) target.changes[key] += num(source.changes?.[key]);
}

function finishTransitions(transitions) {
  transitions.rates = {};
  for (const from of groups) {
    transitions.rates[from] = { total: transitions.matrix[from].total };
    for (const to of groups) transitions.rates[from][to] = rateObject(transitions.matrix[from][to], transitions.matrix[from].total);
  }
  transitions.changeRates = {
    huntPackLoss: rateObject(transitions.changes.huntPackLost, transitions.changes.huntPackParent),
    pursuitLoss: rateObject(transitions.changes.pursuitLost, transitions.changes.pursuitParent),
    huntPackGainPerKnownParent: rateObject(transitions.changes.huntPackGained, transitions.changes.parentKnown),
    pursuitGainPerKnownParent: rateObject(transitions.changes.pursuitGained, transitions.changes.parentKnown)
  };
}

function blankRuntimeAggregate() {
  return {
    groups: {
      A: blankMetric('role=pursuit && socialMode=hunt-pack'),
      B: blankMetric('role=pursuit && socialMode!=hunt-pack'),
      C: blankMetric('role!=pursuit && socialMode=hunt-pack'),
      D: blankMetric('role!=pursuit && socialMode!=hunt-pack')
    },
    dCarnivore: blankMetric('D and diet>=0.66'),
    cRoleBreakdown: {
      ambusher: blankMetric(),
      scav: blankMetric(),
      filter: blankMetric(),
      other: blankMetric()
    },
    bSocialModeBreakdown: {
      solitary: blankMetric(),
      'defense-school': blankMetric(),
      trail: blankMetric(),
      cluster: blankMetric(),
      school: blankMetric()
    },
    cross: blankCross(),
    byDiet: blankByDiet(),
    parentChildTransitions: blankTransitions()
  };
}

function aggregateRuntime(summaries) {
  const pooled = blankRuntimeAggregate();
  for (const summary of summaries) {
    for (const group of groups) addMetric(pooled.groups[group], summary.groups?.[group]);
    addMetric(pooled.dCarnivore, summary.dCarnivore);
    for (const role of Object.keys(pooled.cRoleBreakdown)) addMetric(pooled.cRoleBreakdown[role], summary.cRoleBreakdown?.[role]);
    for (const mode of Object.keys(pooled.bSocialModeBreakdown)) addMetric(pooled.bSocialModeBreakdown[mode], summary.bSocialModeBreakdown?.[mode]);
    for (const role of roles) {
      for (const mode of modes) addMetric(pooled.cross[role][mode], summary.cross?.[role]?.[mode]);
    }
    for (const diet of diets) {
      for (const role of roles) {
        for (const mode of modes) addMetric(pooled.byDiet[diet][role][mode], summary.byDiet?.[diet]?.[role]?.[mode]);
      }
    }
    addTransitions(pooled.parentChildTransitions, summary.parentChildTransitions);
  }
  finishMetricTree(pooled);
  finishTransitions(pooled.parentChildTransitions);
  return pooled;
}

function compactRun(run) {
  return {
    seed: run.seed,
    steps: run.steps,
    elapsedMs: run.elapsedMs,
    variant: run.variant,
    shareFraction: run.shareFraction,
    targetConsensus: run.targetConsensus,
    packAttackBase: run.packAttackBase,
    worldReseedCount: run.worldReseedCount,
    population: {
      startPopulation: run.population?.startPopulation,
      endPopulation: run.population?.endPopulation,
      endDiets: run.population?.endDiets,
      births: run.population?.births,
      deaths: run.population?.deaths,
      deathCauses: run.population?.deathCauses
    },
    packHunt: run.lineage?.packHunt,
    health: run.health,
    performance: run.performance,
    telemetryCounts: run.telemetryCounts
  };
}

function countErrorEntries(value) {
  if (!value) return 0;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countErrorEntries(item), 0);
  if (typeof value === 'object') return Object.values(value).reduce((sum, item) => sum + countErrorEntries(item), 0);
  return typeof value === 'string' && value.length ? 1 : 0;
}

function safetySummary(result) {
  const safety = {
    pageErrors: countErrorEntries(result.errors),
    nanOrInfinity: 0,
    energyCreationEvents: 0,
    nutrientCreationEvents: 0
  };
  for (const row of result.runs || []) {
    safety.nanOrInfinity += num(row.health?.badCount);
    safety.energyCreationEvents += num(row.run?.packHunt?.energyCreationEvents);
    safety.nutrientCreationEvents += num(row.run?.packHunt?.nutrientCreationEvents);
  }
  safety.nanOrInfinity += num(result.boot?.normal?.health?.badCount);
  safety.nanOrInfinity += num(result.boot?.developer?.health?.badCount);
  return safety;
}

function pct(metric, rateKey) {
  return round(metric?.rates?.[rateKey]?.rate ?? null, 6);
}

function classify(staticSummary, pooled) {
  const staticA = staticSummary.groups?.A?.rate ?? null;
  const A = pooled.groups.A;
  const B = pooled.groups.B;
  const C = pooled.groups.C;
  const D = pooled.groups.D;
  const dc = pooled.dCarnivore;
  const packBirths = num(A.births) + num(C.births);
  const packMaturity = rate(num(A.matured) + num(C.matured), packBirths);
  const bMaturity = pct(B, 'maturity');
  const dcMaturity = pct(dc, 'maturity');
  const scores = [];
  const add = (key, score, reason) => scores.push({ key, score, reason });

  const geneticRare = staticA != null && (staticA < 0.02 || (staticA < (staticSummary.groups?.B?.rate ?? 1) * 0.35 && staticA < (staticSummary.groups?.C?.rate ?? 1) * 0.35));
  add('A. 遺伝的希少', geneticRare ? 3 : 0, `static A rate=${round(staticA, 6)}`);

  const aBirths = num(A.births);
  const aSurvival180 = pct(A, 'survived180');
  const aMaturity = pct(A, 'maturity');
  const earlyCull = aBirths >= 3 && ((aSurvival180 != null && aSurvival180 < 0.35) || (aMaturity != null && aMaturity < 0.08));
  add('B. 出生はするが早期淘汰', earlyCull ? 2.5 : 0, `A births=${aBirths}, survived180=${round(aSurvival180)}, maturity=${round(aMaturity)}`);

  const cDominant = num(C.births) > Math.max(4, num(A.births) * 1.5);
  const cPredation = pct(C, 'firstPredation');
  const styleMismatch = cDominant && (cPredation == null || cPredation < 0.12);
  add('C. 捕食スタイル不一致', styleMismatch ? 2 : 0, `C births=${C.births}, A births=${A.births}, C firstPredation=${round(cPredation)}`);

  const packDisadvantage = packBirths >= 5 && packMaturity != null && (
    (bMaturity != null && packMaturity < bMaturity * 0.75) ||
    (dcMaturity != null && packMaturity < dcMaturity * 0.75)
  );
  add('D. 群れ狩り自体が不利', packDisadvantage ? 2.25 : 0, `pack maturity=${round(packMaturity)}, B maturity=${round(bMaturity)}, D-carnivore maturity=${round(dcMaturity)}`);

  const functional = aBirths > 0 && num(B.births) > 0 && num(C.births) > 0 &&
    (pct(A, 'firstPredation') !== pct(B, 'firstPredation') || pct(C, 'maturity') !== pct(dc, 'maturity'));
  add('E. 分類は機能している', functional ? 1.5 : 0, `A/B/C births=${A.births}/${B.births}/${C.births}`);

  scores.sort((a, b) => b.score - a.score);
  const dominant = scores[0].score > 0 ? scores[0] : { key: 'E. 分類は機能している', score: 0, reason: 'no stronger failure classification dominated' };
  return {
    dominant,
    next: scores.filter(s => s.key !== dominant.key && s.score > 0).slice(0, 2)
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
  await page.waitForFunction(() => !!window.__alifeDebug?.roleSocialEcologySummary, null, { timeout: 15000 });
  return { page, errors, url };
}

async function runSeed(browser, seed) {
  const boot = await bootPage(browser, false, seed);
  try {
    const payload = await boot.page.evaluate(({ seed, steps }) => {
      const run = window.__alifeDebug.runSeededWorldDiagnostic({
        seed,
        steps,
        variant: 'role_social_ecology',
        shareFraction: 0,
        targetConsensus: false,
        packAttackBase: 0.78,
        packHuntTelemetry: true
      });
      const roleSocial = window.__alifeDebug.roleSocialEcologySummary();
      const compat = window.__alifeDebug.packRoleSocialGroupSummary();
      const health = window.__alifeDebug.diagnosticNumberHealth({ roleSocial });
      return { run, roleSocial, compat, health };
    }, { seed, steps });
    return {
      seed,
      errors: boot.errors,
      run: compactRun(payload.run),
      roleSocial: payload.roleSocial,
      compat: payload.compat,
      health: payload.health
    };
  } finally {
    await boot.page.close();
  }
}

(async () => {
  const browser = await launchBrowser();
  const result = {
    experiment,
    baseCommit: 'f17e778b3a528358262a40b85221fcb31e58d3e2',
    htmlFile,
    seeds,
    steps,
    staticSeed,
    staticSamples,
    protocol: {
      diagnosticOnly: true,
      targetConsensus: false,
      shareFraction: 0,
      packAttackBase: 0.78,
      behaviorParametersChanged: false
    },
    boot: {},
    runs: [],
    errors: { normal: [], developer: [], runs: [] }
  };

  try {
    const normal = await bootPage(browser, false, seeds[0] || 1);
    try {
      result.staticGeneSpace = await normal.page.evaluate(
        ({ seed, samples }) => window.__alifeDebug.roleSocialStaticGeneSpaceSummary({ seed, samples }),
        { seed: staticSeed, samples: staticSamples }
      );
      result.reachability = await normal.page.evaluate(() => window.__alifeDebug.roleSocialReachabilitySummary());
      const roundTrip = await normal.page.evaluate(() => window.__alifeDebug.roundTripSave());
      result.boot.normal = await normal.page.evaluate(() => ({
        counts: window.__alifeDebug.counts(),
        developerMode: window.__alifeDebug.developerMode(),
        health: window.__alifeDebug.diagnosticNumberHealth(),
        performance: window.__alifeDebug.performanceSummary(),
        roleSocialApi: !!window.__alifeDebug.roleSocialEcologySummary
      }));
      result.boot.normal.roundTrip = roundTrip;
      result.errors.normal = normal.errors;
    } finally {
      await normal.page.close();
    }

    for (const seed of seeds) {
      const row = await runSeed(browser, seed);
      result.runs.push(row);
      result.errors.runs.push({ seed, errors: row.errors });
    }

    const dev = await bootPage(browser, true, seeds[0] || 1);
    try {
      result.boot.developer = await dev.page.evaluate(() => ({
        counts: window.__alifeDebug.counts(),
        developerMode: window.__alifeDebug.developerMode(),
        health: window.__alifeDebug.diagnosticNumberHealth(),
        performance: window.__alifeDebug.performanceSummary(),
        roleSocialApi: !!window.__alifeDebug.roleSocialEcologySummary
      }));
      result.errors.developer = dev.errors;
    } finally {
      await dev.page.close();
    }
  } finally {
    await browser.close();
  }

  result.pooled = aggregateRuntime(result.runs.map(row => row.roleSocial));
  result.safety = safetySummary(result);
  result.classification = classify(result.staticGeneSpace, result.pooled);

  const decision = {
    experiment,
    stage: 'diagnostic',
    decision: 'diagnostic_only',
    classification: result.classification,
    staticGeneSpace: {
      A: result.staticGeneSpace.groups.A,
      B: result.staticGeneSpace.groups.B,
      C: result.staticGeneSpace.groups.C,
      D: result.staticGeneSpace.groups.D
    },
    pooled: {
      groups: result.pooled.groups,
      dCarnivore: result.pooled.dCarnivore,
      cRoleBreakdown: result.pooled.cRoleBreakdown,
      bSocialModeBreakdown: result.pooled.bSocialModeBreakdown,
      parentChildTransitions: result.pooled.parentChildTransitions
    },
    safety: result.safety,
    artifact: outputFile
  };
  result.decision = decision;

  fs.mkdirSync(path.dirname(path.resolve(outputFile)), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
  fs.writeFileSync(decisionFile, JSON.stringify(decision, null, 2));
  console.log(JSON.stringify({
    experiment,
    stage: decision.stage,
    decision: decision.decision,
    classification: decision.classification.dominant.key,
    staticABCD: Object.fromEntries(groups.map(k => [k, round(decision.staticGeneSpace[k].rate, 6)])),
    pooledBirths: Object.fromEntries(groups.map(k => [k, decision.pooled.groups[k].births])),
    safety: decision.safety,
    artifact: outputFile,
    decisionArtifact: decisionFile
  }, null, 2));
})().catch(err => {
  console.error(err);
  process.exit(1);
});
