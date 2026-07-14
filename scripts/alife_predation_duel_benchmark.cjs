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

function percent(x) {
  return x == null ? 'N/A' : `${(x * 100).toFixed(1)}%`;
}

function compactRun(name, group, condition, result) {
  const s = result.summary || {};
  return {
    group,
    condition,
    name,
    repeats: result.repeatsCompleted,
    targetRate: s.targetRate,
    contactRate: s.contactRate,
    attackRate: s.attackRate,
    successRate: s.successRate,
    targetToContactRate: s.targetToContactRate,
    contactToAttackRate: s.contactToAttackRate,
    attackToSuccessRate: s.attackToSuccessRate,
    averageContactStep: s.averageContactStep,
    averageMinDistance: s.averageMinDistance,
    averageEnergySpent: s.averageEnergySpent,
    averageActualSpeedRatio: s.averageActualSpeedRatio,
    failureReasons: s.failureReasons,
    predatorSize: result.results?.[0]?.predatorSize ?? null,
    preySize: result.results?.[0]?.preySize ?? null,
    realizedPreySizeRatio: result.results?.[0]?.preySizeRatio ?? null,
    realizedSpeedRatio: result.results?.[0]?.actualSpeedRatio ?? null
  };
}

function consoleSummary(rows) {
  const lines = [];
  lines.push('group\tcondition\ttarget\tcontact\tattack\tsuccess\ttarget->contact\tminDist\tenergy\tfailures');
  for (const r of rows) {
    const failures = Object.entries(r.failureReasons || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    lines.push([
      r.group,
      r.condition,
      percent(r.targetRate),
      percent(r.contactRate),
      percent(r.attackRate),
      percent(r.successRate),
      percent(r.targetToContactRate),
      r.averageMinDistance == null ? 'N/A' : r.averageMinDistance.toFixed(2),
      r.averageEnergySpent == null ? 'N/A' : r.averageEnergySpent.toFixed(2),
      failures
    ].join('\t'));
  }
  return lines.join('\n');
}

async function runDuel(page, name, group, condition, options) {
  const result = await page.evaluate(opts => window.__alifeDebug.runPredationDuel(opts), options);
  return { raw: result, compact: compactRun(name, group, condition, result) };
}

(async () => {
  const htmlFile = process.env.ALIFE_FILE || 'index.html';
  const viewport = parseViewport(process.env.ALIFE_VIEWPORT || '390x844');
  const formalRepeats = Math.max(1, Math.min(100, Number(argValue('--repeats', hasArg('--smoke') ? 5 : 20))));
  const smoke = hasArg('--smoke');
  const maxSteps = Math.max(1, Math.min(2000, Number(argValue('--max-steps', 600))));
  const outPath = argValue('--out', null);
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
  await page.waitForFunction(() => !!window.__alifeDebug?.runPredationDuel && !!window.__alifeDebug?.predationDuelSummary);

  const conditions = [];
  conditions.push({ name: 'C0 stationary small', group: 'C', condition: 'C0', repeats: Math.min(5, formalRepeats), opts: { preySizeRatio: 0.70, preySpeedRatio: 0.00, preyBehavior: 'stationary' } });
  conditions.push({ name: 'C1 slow straight', group: 'C', condition: 'C1', repeats: Math.min(5, formalRepeats), opts: { preySizeRatio: 0.70, preySpeedRatio: 0.60, preyBehavior: 'straightEscape' } });
  conditions.push({ name: 'C2 oversized stationary', group: 'C', condition: 'C2', repeats: Math.min(5, formalRepeats), opts: { preySizeRatio: 1.01, preySpeedRatio: 0.00, preyBehavior: 'stationary' } });

  for (const [condition, ratio] of [['D1', 0.50], ['D2', 0.70], ['D3', 0.85], ['D4', 0.95], ['D5', 0.99], ['D6', 1.01], ['D7', 1.10]]) {
    conditions.push({ name: `size ${ratio.toFixed(2)}`, group: 'D', condition, repeats: formalRepeats, opts: { preySizeRatio: ratio, preySpeedRatio: 0.70, preyBehavior: 'straightEscape' } });
  }

  for (const [condition, ratio] of [['V1', 0.00], ['V2', 0.40], ['V3', 0.60], ['V4', 0.80], ['V5', 1.00], ['V6', 1.10], ['V7', 1.20]]) {
    conditions.push({ name: `speed ${ratio.toFixed(2)}`, group: 'V', condition, repeats: formalRepeats, opts: { preySizeRatio: 0.70, preySpeedRatio: ratio, preyBehavior: 'straightEscape' } });
  }

  const behaviorRepeats = smoke ? Math.min(5, formalRepeats) : Math.min(10, formalRepeats);
  for (const [condition, behavior] of [['B1', 'stationary'], ['B2', 'straightEscape'], ['B3', 'normal']]) {
    conditions.push({ name: `behavior ${behavior}`, group: 'B', condition, repeats: behaviorRepeats, opts: { preySizeRatio: 0.70, preySpeedRatio: 0.80, preyBehavior: behavior } });
  }

  const runs = [];
  for (let i = 0; i < conditions.length; i++) {
    const c = conditions[i];
    const opts = {
      predatorTemplate: 'viableCarnivore',
      preyTemplate: 'controlledHerbivore',
      initialDistance: 45,
      initialAngleDeg: 0,
      preyHeadingMode: 'away',
      preyDefenseMode: 'none',
      maxSteps,
      repeats: c.repeats,
      restoreAfterRun: true,
      seed: 73000 + i * 997,
      ...c.opts
    };
    const run = await runDuel(page, c.name, c.group, c.condition, opts);
    runs.push({ ...c, options: opts, ...run });
  }

  const smokeCheck = await page.evaluate(() => ({
    counts: window.__alifeDebug.counts(),
    developerMode: window.__alifeDebug.developerMode(),
    summaryCount: window.__alifeDebug.predationDuelSummary().experiments.length,
    roundTrip: window.__alifeDebug.roundTripSave()
  }));
  const performance = await page.evaluate(() => window.__alifeDebug.performanceSummary());

  const compact = runs.map(r => r.compact);
  const output = {
    file: htmlFile,
    url,
    viewport,
    repeats: formalRepeats,
    maxSteps,
    smoke,
    pageErrors,
    smokeCheck,
    performance,
    compact,
    runs: runs.map(r => ({ group: r.group, condition: r.condition, name: r.name, options: r.options, summary: r.raw.summary, firstResult: r.raw.results?.[0] || null }))
  };

  await browser.close();

  const summaryText = consoleSummary(compact);
  console.log(summaryText);
  if (!quiet) {
    console.log('ALIFE_PREDATION_DUEL_JSON_START');
    console.log(JSON.stringify(output, null, 2));
    console.log('ALIFE_PREDATION_DUEL_JSON_END');
  }

  if (outPath) {
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  }

  if (pageErrors.length) {
    process.exitCode = 1;
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
