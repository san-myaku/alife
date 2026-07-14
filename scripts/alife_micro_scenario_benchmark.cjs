const fs = require('fs');
const path = require('path');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (error) {
  const bundledNodeModules = path.join(process.env.USERPROFILE || '', '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules');
  const bundledPnpmModules = path.join(bundledNodeModules, '.pnpm', 'node_modules');
  process.env.NODE_PATH = [process.env.NODE_PATH, bundledNodeModules, bundledPnpmModules].filter(Boolean).join(path.delimiter);
  require('module').Module._initPaths();
  ({ chromium } = require('playwright'));
}

function argValue(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  const pref = `${name}=`;
  const found = process.argv.find(a => a.startsWith(pref));
  return found ? found.slice(pref.length) : fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function parseViewport(value) {
  const m = String(value || '').match(/^(\d+)x(\d+)$/);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : { width: 390, height: 844 };
}

function num(value, digits = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : 'N/A';
}

function pct(value) {
  return value == null ? 'N/A' : `${(Number(value) * 100).toFixed(1)}%`;
}

function compactCondition(pack, conditionRecord) {
  const s = conditionRecord.summary || {};
  return {
    pack,
    key: conditionRecord.condition?.key,
    label: conditionRecord.condition?.label,
    scenarioType: conditionRecord.condition?.scenarioType,
    repeats: s.repeats,
    meanSurvivalSteps: s.survivalSteps?.mean ?? null,
    medianSurvivalSteps: s.survivalSteps?.median ?? null,
    minSurvivalSteps: s.survivalSteps?.min ?? null,
    maxSurvivalSteps: s.survivalSteps?.max ?? null,
    energyLossPer100Steps: s.energyLossPer100Steps?.mean ?? null,
    totalDistance: s.totalDistance?.mean ?? null,
    predationSuccessRate: s.predationSuccessRate,
    secondPredationSuccessRate: s.secondPredationSuccessRate,
    deathReasons: s.deathReasons,
    averageReconciliationError: s.averageReconciliationError,
    representativeScenarioId: s.representativeScenarioId,
    representativeTraceSteps: s.representativeTraceSteps
  };
}

function consoleSummary(rows) {
  const lines = [];
  lines.push('pack\tcondition\tsurvival_mean\tsurvival_median\tenergy_loss_100\tmove_dist\tpredation\tsecond_predation\tdeath_reasons\trecon_error');
  for (const r of rows) {
    const deaths = Object.entries(r.deathReasons || {})
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    lines.push([
      r.pack,
      r.key || r.label,
      num(r.meanSurvivalSteps, 1),
      num(r.medianSurvivalSteps, 1),
      num(r.energyLossPer100Steps, 3),
      num(r.totalDistance, 1),
      pct(r.predationSuccessRate),
      pct(r.secondPredationSuccessRate),
      deaths,
      num(r.averageReconciliationError, 6)
    ].join('\t'));
  }
  return lines.join('\n');
}

(async () => {
  const htmlFile = process.env.ALIFE_FILE || 'index.html';
  const viewport = parseViewport(process.env.ALIFE_VIEWPORT || '390x844');
  const packArg = String(argValue('--pack', 'all'));
  const repeats = Math.max(1, Math.min(100, Number(argValue('--repeats', hasArg('--smoke') ? 3 : 20))));
  const maxSteps = Math.max(1, Math.min(3000, Number(argValue('--max-steps', 3000))));
  const outPath = argValue('--out', null);
  const quiet = hasArg('--quiet');
  const chromePath = process.env.ALIFE_CHROME || undefined;
  const packs = packArg === 'all'
    ? ['starvation-lifespan', 'single-meal-value', 'second-meal-delay']
    : [packArg];

  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage({ viewport });
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(String(err.stack || err.message || err)));
  page.on('console', msg => {
    if (msg.type() === 'error') pageErrors.push(msg.text());
  });

  const url = 'file:///' + path.resolve(htmlFile).replace(/\\/g, '/') + '?dev=1';
  await page.goto(url);
  await page.waitForFunction(() => !!window.__alifeDebug?.runMicroScenario && !!window.__alifeDebug?.runExperimentPack);

  const packResults = [];
  for (let i = 0; i < packs.length; i++) {
    const pack = packs[i];
    const result = await page.evaluate(opts => window.__alifeDebug.runExperimentPack(opts), {
      pack,
      repeats,
      maxSteps,
      seed: 97000 + i * 5000,
      recordTrace: true
    });
    packResults.push(result);
  }

  const smokeCheck = await page.evaluate(() => ({
    counts: window.__alifeDebug.counts(),
    developerMode: window.__alifeDebug.developerMode(),
    microScenarioHistory: window.__alifeDebug.microScenarioSummary().history.length,
    experimentPackHistory: window.__alifeDebug.experimentPackSummary().history.length,
    roundTrip: window.__alifeDebug.roundTripSave()
  }));
  const performance = await page.evaluate(() => window.__alifeDebug.performanceSummary());
  await browser.close();

  const compact = packResults.flatMap(pack => (pack.conditions || []).map(c => compactCondition(pack.pack, c)));
  const output = {
    file: htmlFile,
    url,
    viewport,
    pack: packArg,
    repeats,
    maxSteps,
    pageErrors,
    smokeCheck,
    performance,
    compact,
    packs: packResults
  };

  console.log(consoleSummary(compact));
  if (!quiet) {
    console.log('ALIFE_MICRO_SCENARIO_JSON_START');
    console.log(JSON.stringify(output, null, 2));
    console.log('ALIFE_MICRO_SCENARIO_JSON_END');
  }
  if (outPath) fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  if (pageErrors.length) process.exitCode = 1;
})().catch(err => {
  console.error(err);
  process.exit(1);
});
