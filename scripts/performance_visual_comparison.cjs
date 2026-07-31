const fs = require('fs');
const path = require('path');
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
const { PNG } = require('pngjs');

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : fallback;
}

function fileUrl(file) {
  return `file:///${path.resolve(file).replace(/\\/g, '/')}`;
}

function materialize(ref, label) {
  const source = ref === 'WORKTREE'
    ? fs.readFileSync('index.html', 'utf8')
    : childProcess.execFileSync('git', ['show', `${ref}:index.html`], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
      });
  const file = path.resolve(`.performance-visual-${label}.html`);
  fs.writeFileSync(file, source, 'utf8');
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
  await page.goto(`${fileUrl(htmlFile)}?dev=1&performance-visual=1`, { waitUntil: 'load' });
  await page.waitForFunction(
    () => typeof window.__alifeDebug?.preparePerformanceBenchmark === 'function',
    null,
    { timeout: 15000 }
  );
  await page.evaluate(() => window.__alifeDebug.setSimulationRunning(false));
  return { page, errors };
}

const scenarios = [
  { id: 'few-organisms', population: 32, steps: 1, camera: 'fit' },
  { id: 'population-200', population: 200, steps: 1, camera: 'fit' },
  { id: 'population-1000', population: 1000, steps: 1, camera: 'fit' },
  { id: 'zoom-in', population: 200, steps: 1, camera: 'zoom-in' },
  { id: 'zoom-out', population: 200, steps: 1, camera: 'zoom-out' },
  { id: 'complex-environment', population: 200, steps: 240, camera: 'fit' },
  { id: 'predation-active', population: null, steps: 300, camera: 'fit' },
  { id: 'many-carcasses', population: null, steps: 1000, camera: 'fit' }
];

async function prepareScenario(page, scenario, seed) {
  return page.evaluate(({ scenario, seed }) => {
    window.__alifeDebug.setSimulationRunning(false);
    window.__alifeDebug.runSeededWorldDiagnostic({
      seed,
      steps: scenario.steps,
      restoreAfterRun: false,
      includeModelState: false,
      populationSampleInterval: Math.max(20, scenario.steps),
      variant: `performance-visual-${scenario.id}`
    });
    if (scenario.population != null) {
      window.__alifeDebug.preparePerformanceBenchmark({
        population: scenario.population,
        renderMode: 'full'
      });
    } else {
      window.__alifeDebug.setBenchmarkRenderMode('full');
    }
    const world = window.__alifeDebug.worldGeometry();
    window.__alifeDebug.fitCamera();
    if (scenario.camera === 'zoom-in') {
      window.__alifeDebug.focusCamera(world.centerX, world.centerY, 2);
    } else if (scenario.camera === 'zoom-out') {
      window.__alifeDebug.focusCamera(
        world.centerX,
        world.centerY,
        world.camera.minZoom
      );
    }
    return {
      counts: window.__alifeDebug.counts(),
      world: window.__alifeDebug.worldGeometry(),
      predation: window.__alifeDebug.predationSummary()
    };
  }, { scenario, seed });
}

async function captureVersion(browser, htmlFile, label, outputDir, seed) {
  const { page, errors } = await openPage(browser, htmlFile, seed);
  const rows = [];
  try {
    for (const scenario of scenarios) {
      process.stdout.write(`${label} ${scenario.id}\n`);
      const state = await prepareScenario(page, scenario, seed);
      await page.waitForTimeout(250);
      const file = path.join(outputDir, `${scenario.id}-${label}.png`);
      await page.locator('#viewport').screenshot({ path: file });
      rows.push({ scenario: scenario.id, file, state });
    }
    return { label, rows, errors };
  } finally {
    await page.close();
  }
}

function comparePng(baselineFile, optimizedFile) {
  const baseline = PNG.sync.read(fs.readFileSync(baselineFile));
  const optimized = PNG.sync.read(fs.readFileSync(optimizedFile));
  if (baseline.width !== optimized.width || baseline.height !== optimized.height) {
    return {
      sameDimensions: false,
      baseline: { width: baseline.width, height: baseline.height },
      optimized: { width: optimized.width, height: optimized.height }
    };
  }
  let differingPixels = 0;
  let totalAbsoluteChannelDifference = 0;
  let maxChannelDifference = 0;
  for (let offset = 0; offset < baseline.data.length; offset += 4) {
    let pixelDiffers = false;
    for (let channel = 0; channel < 4; channel++) {
      const difference = Math.abs(
        baseline.data[offset + channel] - optimized.data[offset + channel]
      );
      totalAbsoluteChannelDifference += difference;
      maxChannelDifference = Math.max(maxChannelDifference, difference);
      if (difference !== 0) pixelDiffers = true;
    }
    if (pixelDiffers) differingPixels++;
  }
  const pixels = baseline.width * baseline.height;
  return {
    sameDimensions: true,
    width: baseline.width,
    height: baseline.height,
    pixels,
    differingPixels,
    differingPixelRatio: differingPixels / pixels,
    meanAbsoluteChannelDifference: totalAbsoluteChannelDifference / (pixels * 4),
    maxChannelDifference
  };
}

async function main() {
  const outputDir = path.resolve(arg(
    'output-dir',
    path.join('artifacts', 'performance_optimization', 'visual-comparison')
  ));
  const baselineRef = arg('baseline-ref', '645e163');
  const seed = Math.round(Number(arg('seed', '61001'))) || 61001;
  fs.mkdirSync(outputDir, { recursive: true });
  const files = {
    baseline: materialize(baselineRef, 'baseline'),
    optimized: materialize('WORKTREE', 'optimized')
  };
  const browser = await chromium.launch({ headless: true });
  try {
    const baseline = await captureVersion(
      browser,
      files.baseline,
      'baseline',
      outputDir,
      seed
    );
    const optimized = await captureVersion(
      browser,
      files.optimized,
      'optimized',
      outputDir,
      seed
    );
    const comparisons = scenarios.map(scenario => {
      const baselineRow = baseline.rows.find(row => row.scenario === scenario.id);
      const optimizedRow = optimized.rows.find(row => row.scenario === scenario.id);
      return {
        scenario: scenario.id,
        baselineState: baselineRow.state,
        optimizedState: optimizedRow.state,
        stateExact: JSON.stringify(baselineRow.state) === JSON.stringify(optimizedRow.state),
        image: comparePng(baselineRow.file, optimizedRow.file)
      };
    });
    const report = {
      generatedAt: new Date().toISOString(),
      seed,
      baselineRef,
      optimizedHead: childProcess.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      scenarios,
      comparisons,
      errors: {
        baseline: baseline.errors,
        optimized: optimized.errors
      }
    };
    const reportFile = path.join(outputDir, 'visual-comparison.json');
    fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    process.stdout.write(`${reportFile}\n`);
    process.stdout.write(`${JSON.stringify(comparisons.map(row => ({
      scenario: row.scenario,
      stateExact: row.stateExact,
      differingPixelRatio: row.image.differingPixelRatio,
      meanAbsoluteChannelDifference: row.image.meanAbsoluteChannelDifference
    })), null, 2)}\n`);
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
