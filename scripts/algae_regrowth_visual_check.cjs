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

const userHome = process.env.USERPROFILE || process.env.HOME || '';
addNodeModuleDir(path.join(userHome, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules'));
addNodeModuleDir(path.join(userHome, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', '.pnpm', 'node_modules'));

const { chromium } = require('playwright');

const htmlFile = process.env.ALIFE_FILE || 'index.html';
const outputDir = process.env.ALIFE_ALGAE_OUTPUT_DIR || path.join('artifacts', 'algae_regrowth_balance_20260729');
const seed = Number(process.env.ALIFE_SEED || 41001);
const enabled = String(process.env.ALIFE_ALGAE_ENABLED || 'true').toLowerCase() !== 'false';
const variant = enabled ? 'resource_limited' : 'legacy';
const milestones = [0, 500, 1000, 2000];

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror:${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console:${message.text()}`);
  });
  await page.addInitScript(initialSeed => {
    let state = (Number(initialSeed) || 1) >>> 0;
    Math.random = function seededVisualCheckRandom() {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);
  const url = 'file:///' + path.resolve(htmlFile).replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__alifeDebug?.setResourceLimitedAlgaeRegrowth === 'function', null, { timeout: 20000 });
  await page.evaluate(options => {
    const debug = window.__alifeDebug;
    debug.setResourceLimitedAlgaeRegrowth(options.enabled, { clearScaleOverride: true });
    debug.resetSimulation({ mode: 'patchy-intermediate', seed: options.seed });
  }, { seed, enabled });

  const rows = [];
  let currentFrame = 0;
  for (const milestone of milestones) {
    while (currentFrame < milestone) {
      const batch = Math.min(20, milestone - currentFrame);
      await page.evaluate(frames => window.__alifeDebug.modelStep(frames), batch);
      currentFrame += batch;
    }
    const snapshot = await page.evaluate(() => ({
      counts: window.__alifeDebug.counts(),
      field: window.__alifeDebug.currentAlgaeSummary(),
      flow: window.__alifeDebug.algaeRegrowthSummary(),
      population: window.__alifeDebug.populationTurnoverSummary(2100),
      grazing: window.__alifeDebug.grazingSummary()
    }));
    const image = path.join(outputDir, `${variant}_seed_${seed}_frame_${milestone}.png`);
    await page.screenshot({ path: image, fullPage: false });
    rows.push({ frame: milestone, image, ...snapshot });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    seed,
    enabled,
    variant,
    scale: rows[0]?.flow?.effectiveScale ?? null,
    rows,
    errors
  };
  const json = path.join(outputDir, `visual_check_${variant}.json`);
  fs.writeFileSync(json, JSON.stringify(output, null, 2) + '\n', 'utf8');
  process.stdout.write(JSON.stringify({ json, seed, scale: output.scale, errors, frames: rows.map(row => ({
    frame: row.frame,
    population: row.counts?.organisms,
    meanAlgae: row.field?.meanAlgae,
    minimumAlgae: row.field?.minimumAlgae,
    standardDeviation: row.field?.standardDeviation,
    fieldHash: row.field?.fieldHash,
    image: row.image
  })) }, null, 2) + '\n');
  await browser.close();
}

main().catch(error => {
  process.stderr.write((error && error.stack) ? error.stack + '\n' : String(error) + '\n');
  process.exitCode = 1;
});
