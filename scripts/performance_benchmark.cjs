const fs = require('fs');
const path = require('path');
const Module = require('module');

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

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function csvCell(value) {
  if (value == null) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function fileUrl(file) {
  return `file:///${path.resolve(file).replace(/\\/g, '/')}`;
}

function parsePopulations(value) {
  const rows = String(value || '200,500,1000,1500,2000,3000')
    .split(',')
    .map(Number)
    .filter(value => Number.isFinite(value) && value > 0)
    .map(value => Math.round(value));
  return rows.length ? [...new Set(rows)] : [200, 500, 1000, 1500, 2000, 3000];
}

function seededInit(seed) {
  let state = Number(seed) >>> 0;
  if (!state) state = 1;
  Math.random = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  window.__alifePerfObserver = { longTasks: [], gc: [] };
  try {
    const longTaskObserver = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        window.__alifePerfObserver.longTasks.push({
          startTime: entry.startTime,
          duration: entry.duration,
          name: entry.name
        });
      }
    });
    longTaskObserver.observe({ entryTypes: ['longtask'] });
  } catch (_) {}
  try {
    const gcObserver = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        window.__alifePerfObserver.gc.push({
          startTime: entry.startTime,
          duration: entry.duration,
          kind: entry.kind || 0
        });
      }
    });
    gcObserver.observe({ entryTypes: ['gc'] });
  } catch (_) {}
}

const htmlFile = arg('file', process.env.ALIFE_FILE || 'index.html');
const label = arg('label', 'baseline');
const artifactDir = arg('out-dir', path.join('artifacts', 'performance_optimization'));
const populations = parsePopulations(arg('populations'));
const seed = Math.round(finite(arg('seed', 61001), 61001));
const warmupMs = Math.max(250, finite(arg('warmup-ms', 900), 900));
const sampleMs = Math.max(500, finite(arg('sample-ms', 2200), 2200));
const viewport = { width: 1280, height: 720 };
const shouldProfile = !flag('no-profile');
const profilePopulation = Math.max(1, Math.round(finite(arg('profile-population', 2000), 2000)));
const profileDurationMs = Math.max(1000, finite(arg('profile-ms', 4000), 4000));
const cameraZoom = Math.max(0, finite(arg('camera-zoom', 0), 0));

const conditions = [
  { id: 'A', renderMode: 'full', running: true, label: '通常描画・実行中' },
  { id: 'B', renderMode: 'tiny', running: true, label: '軽量描画・実行中' },
  { id: 'C', renderMode: 'full', running: false, label: '通常描画・一時停止中' },
  { id: 'D', renderMode: 'tiny', running: false, label: '軽量描画・一時停止中' }
];

async function openPage(browser) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror:${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console:${message.text()}`);
  });
  await page.addInitScript(seededInit, seed);
  await page.goto(`${fileUrl(htmlFile)}?dev=1&performance-benchmark=1`, { waitUntil: 'load' });
  await page.waitForFunction(
    () => typeof window.__alifeDebug?.preparePerformanceBenchmark === 'function',
    null,
    { timeout: 15000 }
  );
  return { page, errors };
}

async function runCondition(browser, population, condition) {
  const { page, errors } = await openPage(browser);
  try {
    const prepared = await page.evaluate(options =>
      window.__alifeDebug.preparePerformanceBenchmark(options), {
        population,
        renderMode: condition.renderMode
      }
    );
    if (cameraZoom > 0) {
      await page.evaluate(zoom => {
        const world = window.__alifeDebug.worldGeometry();
        window.__alifeDebug.focusCamera(world.centerX, world.centerY, zoom);
      }, cameraZoom);
    }
    if (condition.running) {
      await page.evaluate(() => window.__alifeDebug.setSimulationRunning(true));
    }
    await page.waitForTimeout(warmupMs);
    const startCounts = await page.evaluate(() => window.__alifeDebug.counts());
    await page.evaluate(() => {
      window.__alifePerfObserver.longTasks.length = 0;
      window.__alifePerfObserver.gc.length = 0;
      window.__alifeDebug.resetPerformanceProfiler();
    });
    await page.waitForTimeout(sampleMs);
    const result = await page.evaluate(() => {
      const profiler = window.__alifeDebug.performanceProfilerSummary({ frames: 720 });
      const legacy = window.__alifeDebug.performanceSummary();
      const observer = window.__alifePerfObserver || { longTasks: [], gc: [] };
      const memory = performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      } : null;
      return {
        profiler,
        legacy,
        idIndex: typeof window.__alifeDebug.validateOrganismIdIndex === 'function'
          ? window.__alifeDebug.validateOrganismIdIndex()
          : null,
        observer,
        memory,
        hud: document.getElementById('fps-hud')?.textContent || null,
        counts: window.__alifeDebug.counts()
      };
    });
    await page.evaluate(() => window.__alifeDebug.setSimulationRunning(false));
    const longTaskTotalMs = result.observer.longTasks
      .reduce((sum, row) => sum + finite(row.duration), 0);
    const gcTotalMs = result.observer.gc
      .reduce((sum, row) => sum + finite(row.duration), 0);
    return {
      population,
      condition: condition.id,
      conditionLabel: condition.label,
      renderModeRequested: condition.renderMode,
      running: condition.running,
      prepared,
      startCounts,
      endCounts: result.counts,
      profiler: result.profiler,
      legacy: result.legacy,
      idIndex: result.idIndex,
      hud: result.hud,
      browserSignals: {
        longTaskCount: result.observer.longTasks.length,
        longTaskTotalMs,
        longestTaskMs: Math.max(0, ...result.observer.longTasks.map(row => finite(row.duration))),
        gcCount: result.observer.gc.length,
        gcTotalMs,
        memory: result.memory
      },
      errors
    };
  } finally {
    await page.close();
  }
}

function cpuProfileSummary(profile) {
  const nodes = Array.isArray(profile?.nodes) ? profile.nodes : [];
  const samples = Array.isArray(profile?.samples) ? profile.samples : [];
  const deltas = Array.isArray(profile?.timeDeltas) ? profile.timeDeltas : [];
  const byId = new Map(nodes.map(node => [node.id, node]));
  const selfMicros = new Map();
  for (let index = 0; index < samples.length; index++) {
    const nodeId = samples[index];
    selfMicros.set(nodeId, (selfMicros.get(nodeId) || 0) + finite(deltas[index]));
  }
  const totalMicros = new Map();
  function aggregate(nodeId, visiting = new Set()) {
    if (totalMicros.has(nodeId)) return totalMicros.get(nodeId);
    if (visiting.has(nodeId)) return finite(selfMicros.get(nodeId));
    visiting.add(nodeId);
    const node = byId.get(nodeId);
    let total = finite(selfMicros.get(nodeId));
    for (const childId of node?.children || []) total += aggregate(childId, visiting);
    visiting.delete(nodeId);
    totalMicros.set(nodeId, total);
    return total;
  }
  for (const node of nodes) aggregate(node.id);
  function row(node) {
    const frame = node.callFrame || {};
    return {
      functionName: frame.functionName || '(anonymous)',
      url: frame.url || '',
      lineNumber: finite(frame.lineNumber, -1) + 1,
      selfMs: finite(selfMicros.get(node.id)) / 1000,
      totalMs: finite(totalMicros.get(node.id)) / 1000,
      hitCount: finite(node.hitCount)
    };
  }
  const rows = nodes.map(row);
  const gcRows = rows.filter(row => /garbage collector/i.test(row.functionName));
  return {
    sampleCount: samples.length,
    durationMs: (finite(profile?.endTime) - finite(profile?.startTime)) / 1000,
    topSelf: rows.sort((a, b) => b.selfMs - a.selfMs).slice(0, 30),
    topTotal: [...rows].sort((a, b) => b.totalMs - a.totalMs).slice(0, 30),
    garbageCollector: {
      nodes: gcRows.length,
      selfMs: gcRows.reduce((sum, row) => sum + row.selfMs, 0),
      hitCount: gcRows.reduce((sum, row) => sum + row.hitCount, 0)
    }
  };
}

function allocationProfileSummary(profile, durationMs) {
  const rows = [];
  function visit(node) {
    if (!node) return 0;
    const frame = node.callFrame || {};
    let total = finite(node.selfSize);
    for (const child of node.children || []) total += visit(child);
    rows.push({
      functionName: frame.functionName || '(anonymous)',
      url: frame.url || '',
      lineNumber: finite(frame.lineNumber, -1) + 1,
      selfBytes: finite(node.selfSize),
      totalBytes: total
    });
    return total;
  }
  const totalBytes = visit(profile?.head);
  return {
    sampledBytes: totalBytes,
    sampledBytesPerSecond: durationMs > 0 ? totalBytes * 1000 / durationMs : 0,
    topSelf: rows.sort((a, b) => b.selfBytes - a.selfBytes).slice(0, 30),
    topTotal: [...rows].sort((a, b) => b.totalBytes - a.totalBytes).slice(0, 30)
  };
}

function metricsObject(metrics) {
  const out = {};
  for (const row of metrics || []) out[row.name] = row.value;
  return out;
}

async function runBrowserProfile(browser) {
  const { page, errors } = await openPage(browser);
  const session = await page.context().newCDPSession(page);
  try {
    await page.evaluate(options => {
      window.__alifeDebug.preparePerformanceBenchmark(options);
      window.__alifeDebug.setPerformanceProfiling({ deepEnabled: false });
      window.__alifeDebug.setSimulationRunning(true);
    }, { population: profilePopulation, renderMode: 'full' });
    await page.waitForTimeout(warmupMs);
    await page.evaluate(() => {
      window.__alifePerfObserver.longTasks.length = 0;
      window.__alifePerfObserver.gc.length = 0;
      window.__alifeDebug.resetPerformanceProfiler();
    });
    await session.send('Profiler.enable');
    await session.send('Performance.enable');
    await session.send('HeapProfiler.enable');
    const beforeMetrics = metricsObject((await session.send('Performance.getMetrics')).metrics);
    await session.send('HeapProfiler.startSampling', {
      samplingInterval: 32768,
      includeObjectsCollectedByMajorGC: true,
      includeObjectsCollectedByMinorGC: true
    });
    await session.send('Profiler.start');
    await page.waitForTimeout(profileDurationMs);
    const cpuProfile = (await session.send('Profiler.stop')).profile;
    const allocationProfile = (await session.send('HeapProfiler.stopSampling')).profile;
    const afterMetrics = metricsObject((await session.send('Performance.getMetrics')).metrics);
    const pageSummary = await page.evaluate(() => ({
      profiler: window.__alifeDebug.performanceProfilerSummary({ frames: 720 }),
      observer: window.__alifePerfObserver,
      counts: window.__alifeDebug.counts(),
      memory: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize
      } : null
    }));
    const deltaMetrics = {};
    for (const key of Object.keys(afterMetrics)) {
      if (beforeMetrics[key] != null) deltaMetrics[key] = afterMetrics[key] - beforeMetrics[key];
    }
    return {
      population: profilePopulation,
      renderMode: 'full',
      running: true,
      durationMs: profileDurationMs,
      cpu: cpuProfileSummary(cpuProfile),
      allocations: allocationProfileSummary(allocationProfile, profileDurationMs),
      performanceMetricsBefore: beforeMetrics,
      performanceMetricsAfter: afterMetrics,
      performanceMetricsDelta: deltaMetrics,
      profiler: pageSummary.profiler,
      observer: pageSummary.observer,
      counts: pageSummary.counts,
      memory: pageSummary.memory,
      errors
    };
  } finally {
    await page.close();
  }
}

function staticAudit() {
  const source = fs.readFileSync(htmlFile, 'utf8');
  const count = pattern => (source.match(pattern) || []).length;
  return {
    sourceLines: source.split(/\r?\n/).length,
    findCalls: count(/\.find\s*\(/g),
    filterCalls: count(/\.filter\s*\(/g),
    mapCalls: count(/\.map\s*\(/g),
    spliceCalls: count(/\.splice\s*\(/g),
    shiftCalls: count(/\.shift\s*\(/g),
    objectLiteralXY: count(/\{\s*x\s*:/g),
    canvasCalls: {
      save: count(/\.save\s*\(/g),
      restore: count(/\.restore\s*\(/g),
      translate: count(/\.translate\s*\(/g),
      rotate: count(/\.rotate\s*\(/g),
      beginPath: count(/\.beginPath\s*\(/g),
      arc: count(/\.arc\s*\(/g),
      drawImage: count(/\.drawImage\s*\(/g),
      fillText: count(/\.fillText\s*\(/g)
    }
  };
}

function writeCsv(runs, outputFile) {
  const metricNames = [
    'totalFrame', 'simulationUpdate', 'drawTotal', 'organismUpdate', 'spatialIndex',
    'foodSearch', 'carcassSearch', 'planktonSearch', 'targetLookup', 'reproduction',
    'predation', 'deathRemoval', 'telemetryStatistics', 'trailHistory',
    'environmentDraw', 'organismDraw', 'resourceDraw', 'effectsDraw', 'uiHudDraw',
    'otherUpdate', 'otherDraw'
  ];
  const header = [
    'population', 'condition', 'condition_label', 'render_mode', 'running',
    'start_organisms', 'end_organisms', 'fps', 'long_task_count', 'gc_count',
    ...metricNames.flatMap(name => [`${name}_avg_ms`, `${name}_p50_ms`, `${name}_p95_ms`, `${name}_max_ms`, `${name}_calls_per_frame`]),
    'errors'
  ];
  const rows = [header.join(',')];
  for (const run of runs) {
    const metrics = run.profiler.metrics;
    rows.push([
      run.population,
      run.condition,
      run.conditionLabel,
      run.renderModeRequested,
      run.running,
      run.startCounts.organisms,
      run.endCounts.organisms,
      run.profiler.fps,
      run.browserSignals.longTaskCount,
      run.browserSignals.gcCount,
      ...metricNames.flatMap(name => {
        const metric = metrics[name] || {};
        return [metric.average, metric.median, metric.p95, metric.max, metric.callsPerFrame];
      }),
      run.errors.join(' | ')
    ].map(csvCell).join(','));
  }
  fs.writeFileSync(outputFile, `${rows.join('\n')}\n`, 'utf8');
}

async function main() {
  fs.mkdirSync(artifactDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const runs = [];
    for (const population of populations) {
      for (const condition of conditions) {
        const run = await runCondition(browser, population, condition);
        runs.push(run);
        process.stdout.write(JSON.stringify({
          population,
          condition: condition.id,
          fps: Number(run.profiler.fps.toFixed(2)),
          frameMs: Number(run.profiler.metrics.totalFrame.average.toFixed(2)),
          updateMs: Number(run.profiler.metrics.simulationUpdate.average.toFixed(2)),
          drawMs: Number(run.profiler.metrics.drawTotal.average.toFixed(2)),
          errors: run.errors.length
        }) + '\n');
      }
    }
    const browserProfile = shouldProfile ? await runBrowserProfile(browser) : null;
    const output = {
      schemaVersion: 1,
      label,
      generatedAt: new Date().toISOString(),
      source: {
        file: path.resolve(htmlFile),
        gitHead: require('child_process').execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
      },
      benchmark: {
        seed,
        viewport,
        warmupMs,
        sampleMs,
        cameraZoom,
        populations,
        conditions
      },
      staticAudit: staticAudit(),
      runs,
      browserProfile
    };
    const jsonFile = path.join(artifactDir, `${label}.json`);
    const csvFile = path.join(artifactDir, `${label}.csv`);
    fs.writeFileSync(jsonFile, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
    writeCsv(runs, csvFile);
    process.stdout.write(JSON.stringify({ jsonFile, csvFile, runs: runs.length }, null, 2) + '\n');
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
