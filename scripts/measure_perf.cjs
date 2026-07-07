const { chromium } = require('playwright');
const path = require('path');

const chromePath = process.env.ALIFE_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const htmlFile = process.env.ALIFE_FILE || 'alife_symbolic_shapes_v1.html';
const label = process.env.ALIFE_LABEL || 'perf';
const population = Math.max(1, Math.min(200, Number(process.env.ALIFE_POP || 180)));
const viewportRaw = process.env.ALIFE_VIEWPORT || '1280x720';
const sampleCount = Math.max(1, Number(process.env.ALIFE_SAMPLES || 10));
const warmupMs = Math.max(0, Number(process.env.ALIFE_WARMUP_MS || 3000));
const sampleGapMs = Math.max(50, Number(process.env.ALIFE_SAMPLE_GAP_MS || 500));

function parseViewport(value) {
  const m = String(value).match(/^(\d+)x(\d+)$/);
  if (!m) return { width: 1280, height: 720 };
  return { width: Number(m[1]), height: Number(m[2]) };
}

function avg(samples, key) {
  return samples.reduce((sum, s) => sum + Number(s[key] || 0), 0) / Math.max(1, samples.length);
}

(async () => {
  const viewport = parseViewport(viewportRaw);
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror:${e.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console:${msg.text()}`);
  });

  const fileUrl = 'file:///' + path.resolve(htmlFile).replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__alifeDebug && window.__alifeDebug.performanceSummary, null, { timeout: 10000 });
  await page.evaluate(target => {
    const slider = document.getElementById('popmax-slider');
    if (slider) {
      slider.value = String(target);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }
    window.__alifeDebug.forcePopulation(target);
  }, population);
  await page.click('#start-btn');
  await page.waitForTimeout(warmupMs);

  const samples = [];
  for (let i = 0; i < sampleCount; i++) {
    await page.waitForTimeout(sampleGapMs);
    samples.push(await page.evaluate(() => window.__alifeDebug.performanceSummary()));
  }

  const hud = await page.locator('#fps-hud').textContent();
  const screenshot = path.resolve(process.env.TEMP || '.', `alife-${label}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  await browser.close();

  const result = {
    label,
    viewport: `${viewport.width}x${viewport.height}`,
    requestedPopulation: population,
    hud,
    avgFps: Number(avg(samples, 'fps').toFixed(2)),
    avgUpdateMs: Number(avg(samples, 'updateMs').toFixed(2)),
    avgDrawMs: Number(avg(samples, 'drawMs').toFixed(2)),
    avgNeighborQueries: Number(avg(samples, 'neighborQueriesPerSample').toFixed(2)),
    avgPredationScans: Number(avg(samples, 'predationScansPerSample').toFixed(2)),
    last: samples[samples.length - 1],
    errors,
    screenshot
  };
  console.log(JSON.stringify(result, null, 2));
})();
