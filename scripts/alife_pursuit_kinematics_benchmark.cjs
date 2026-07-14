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

function fmt(value, digits = 3) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : 'N/A';
}

function pct(value) {
  return value == null ? 'N/A' : `${(Number(value) * 100).toFixed(1)}%`;
}

function compactCondition(record) {
  const s = record.summary || {};
  const failures = Object.entries(s.failureReasons || {})
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
  return {
    group: record.condition?.group,
    key: record.condition?.key,
    label: record.condition?.label,
    repeats: s.repeats,
    targetRate: s.targetRate,
    contactRate: s.contactRate,
    successRate: s.successRate,
    energyDepletedRate: s.energyDepletedRate,
    meanMinDistance: s.minDistance?.mean ?? null,
    meanEndDistance: s.endDistance?.mean ?? null,
    meanPredatorSpeed: s.predatorSpeed?.mean ?? null,
    meanPreySpeed: s.preySpeed?.mean ?? null,
    meanActualSpeedRatio: s.actualSpeedRatio?.mean ?? null,
    meanPredatorSpeedFraction: s.predatorSpeedFraction?.mean ?? null,
    meanPreySpeedFraction: s.preySpeedFraction?.mean ?? null,
    meanPredatorProjected: s.predatorProjected?.mean ?? null,
    meanPreyProjected: s.preyProjected?.mean ?? null,
    meanObservedClosing: s.observedClosing?.mean ?? null,
    meanTheoreticalClosing: s.theoreticalClosing?.mean ?? null,
    meanClosingEfficiency: s.closingEfficiency?.mean ?? null,
    predator90Step: s.predator90Step?.median ?? null,
    prey90Step: s.prey90Step?.median ?? null,
    distanceReduction30: s.distanceReduction30?.mean ?? null,
    distanceReduction60: s.distanceReduction60?.mean ?? null,
    meanEnergySpent: s.energySpent?.mean ?? null,
    closingReconciliationError: s.closingReconciliationError?.mean ?? null,
    failures
  };
}

function consoleSummary(rows) {
  const lines = [];
  lines.push('group\tcondition\ttarget\tcontact\tsuccess\tpred_spd\tprey_spd\tactual_ratio\tpred_frac\tclosing\tclosing_eff\tenergy\tfailures');
  for (const r of rows) {
    lines.push([
      r.group,
      r.key || r.label,
      pct(r.targetRate),
      pct(r.contactRate),
      pct(r.successRate),
      fmt(r.meanPredatorSpeed),
      fmt(r.meanPreySpeed),
      fmt(r.meanActualSpeedRatio),
      fmt(r.meanPredatorSpeedFraction),
      fmt(r.meanObservedClosing),
      fmt(r.meanClosingEfficiency),
      fmt(r.meanEnergySpent, 2),
      r.failures || ''
    ].join('\t'));
  }
  return lines.join('\n');
}

function findLikelyCause(rows) {
  const boundary = rows.filter(r => r.group === 'velocity-boundary');
  const current623 = rows.find(r => r.group === 'velocity-boundary' && /0_623/.test(r.key || ''));
  const integrated623 = rows.find(r => r.group === 'movement-integration' && /integrated-0_623/.test(r.key || ''));
  const constant623 = rows.find(r => r.group === 'movement-integration' && /constant-0_623/.test(r.key || ''));
  const constantEnergy623 = rows.find(r => r.group === 'constant-energy' && /0_623/.test(r.key || ''));
  const contactLimit = boundary
    .filter(r => Number(r.contactRate) > 0)
    .map(r => r.key)
    .join(',');
  const notes = [];
  if (current623) {
    notes.push(`0.623 current contact=${pct(current623.contactRate)}, predator speed fraction=${fmt(current623.meanPredatorSpeedFraction)}, observed closing=${fmt(current623.meanObservedClosing)}`);
  }
  if (integrated623) {
    notes.push(`0.623 integrated contact=${pct(integrated623.contactRate)}, closing=${fmt(integrated623.meanObservedClosing)}`);
  }
  if (constant623) {
    notes.push(`0.623 constant velocity contact=${pct(constant623.contactRate)}, closing=${fmt(constant623.meanObservedClosing)}`);
  }
  if (constantEnergy623) {
    notes.push(`0.623 constant energy contact=${pct(constantEnergy623.contactRate)}, closing=${fmt(constantEnergy623.meanObservedClosing)}`);
  }
  return {
    contactLimit,
    notes,
    likelyCause: 'inspect rows: current escape, effective max speed decline, initial-distance clamp, and constant-energy/integrated deltas'
  };
}

(async () => {
  const htmlFile = process.env.ALIFE_FILE || 'index.html';
  const viewport = parseViewport(process.env.ALIFE_VIEWPORT || '390x844');
  const pack = String(argValue('--pack', 'all'));
  const repeats = Math.max(1, Math.min(100, Number(argValue('--repeats', hasArg('--smoke') ? 3 : 20))));
  const maxSteps = Math.max(1, Math.min(2000, Number(argValue('--max-steps', hasArg('--smoke') ? 180 : 600))));
  const outPath = argValue('--json-out', argValue('--out', null));
  const quiet = hasArg('--quiet');
  const chromePath = process.env.ALIFE_CHROME || undefined;

  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage({ viewport });
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(String(err.stack || err.message || err)));
  page.on('console', msg => {
    if (msg.type() === 'error') pageErrors.push(msg.text());
  });

  const url = 'file:///' + path.resolve(htmlFile).replace(/\\/g, '/') + '?dev=1';
  await page.goto(url);
  await page.waitForFunction(() => !!window.__alifeDebug?.runPredationDuel && !!window.__alifeDebug?.runExperimentPack && !!window.__alifeDebug?.pursuitKinematicsSummary);

  const result = await page.evaluate(opts => window.__alifeDebug.runExperimentPack(opts), {
    pack: pack === 'all' ? 'pursuit-kinematics' : pack,
    repeats,
    maxSteps,
    seed: 97001
  });

  const smokeCheck = await page.evaluate(() => ({
    counts: window.__alifeDebug.counts(),
    developerMode: window.__alifeDebug.developerMode(),
    pursuitHistory: window.__alifeDebug.pursuitKinematicsSummary().experiments.length,
    roundTrip: window.__alifeDebug.roundTripSave()
  }));
  const performance = await page.evaluate(() => window.__alifeDebug.performanceSummary());
  await browser.close();

  const compact = (result.conditions || []).map(compactCondition);
  const output = {
    file: htmlFile,
    url,
    viewport,
    pack,
    repeats,
    maxSteps,
    pageErrors,
    smokeCheck,
    performance,
    compact,
    likelyCause: findLikelyCause(compact),
    raw: result
  };

  console.log(consoleSummary(compact));
  if (!quiet) {
    console.log('ALIFE_PURSUIT_KINEMATICS_JSON_START');
    console.log(JSON.stringify(output, null, 2));
    console.log('ALIFE_PURSUIT_KINEMATICS_JSON_END');
  }
  if (outPath) fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  if (pageErrors.length) process.exitCode = 1;
})().catch(err => {
  console.error(err);
  process.exit(1);
});
