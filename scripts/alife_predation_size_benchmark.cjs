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

const htmlFile = process.env.ALIFE_FILE || 'index.html';
const snapshotStep = Math.max(1, Number(process.env.ALIFE_SNAPSHOT_STEP || 600));
const followSteps = Math.max(1, Number(process.env.ALIFE_FOLLOW_STEPS || 600));
const viewportRaw = process.env.ALIFE_VIEWPORT || '390x844';
const chunk = Math.max(1, Math.min(20, Number(process.env.ALIFE_CHUNK || 20)));
const chromePath = process.env.ALIFE_CHROME || undefined;
const scenariosRaw = process.env.ALIFE_SIZE_SCENARIOS || 'S0:random,S1:nearPrey,S2:nearValidPrey,S3:nearOversizedPrey';
const scenarios = scenariosRaw.split(',').map(item => {
  const [name, mode] = item.split(':');
  return { name: String(name || '').trim(), positionMode: String(mode || '').trim() };
}).filter(s => s.name && s.positionMode);

const CARNIVORE_TEMPLATES = Array.from({ length: 5 }, () => ({
  speed: 0.62,
  size: 0.58,
  metabolism: 0.62,
  fecundity: 0.45,
  sense: 0.66,
  diet: 0.82,
  formSeed: 0.78
}));

function parseViewport(value) {
  const m = String(value).match(/^(\d+)x(\d+)$/);
  if (!m) return { width: 390, height: 844 };
  return { width: Number(m[1]), height: Number(m[2]) };
}

function rate(num, den) {
  return den ? num / den : null;
}

async function stepFrames(page, frames) {
  let remaining = frames;
  while (remaining > 0) {
    const n = Math.min(chunk, remaining);
    await page.evaluate(nFrames => window.__alifeDebug.modelStep(nFrames), n);
    remaining -= n;
  }
}

function compact(raw) {
  const lineage = raw.lineage || {};
  const injected = lineage.injected || {};
  const g1 = lineage.generations?.generation1 || {};
  const size = raw.size || {};
  const events = size.events || {};
  const rates = size.rates || {};
  const unique = size.uniqueOrganisms || {};
  const eco = raw.ecosystem || {};
  const population = raw.population || {};
  return {
    frame: raw.frame,
    spawn: raw.spawn,
    size: {
      organismCount: size.organismCount,
      dietCompatiblePrey: events.dietCompatiblePrey,
      tooLargeRejected: events.tooLargeRejected,
      tooLargeRejectedRate: rates.tooLargeRejectedRate,
      validPrey: events.validPrey,
      zeroValidWithDietCompatibleStepRate: rates.zeroValidWithDietCompatibleStepRate,
      uniqueDietCompatible: unique.dietCompatiblePrey,
      uniqueTooLarge: unique.tooLargeRejected,
      uniqueValid: unique.validPrey,
      targetAcquired: events.targetAcquired,
      contactReached: events.contactReached,
      attackAttempted: events.attackAttempted,
      predationSucceeded: events.predationSucceeded,
      within10: size.oversizeBands?.within10 || 0,
      nearestDietAverage: size.nearestDistances?.dietCompatibleAverage,
      nearestValidAverage: size.nearestDistances?.validAverage,
      starvedWithDietCompatibleButZeroValid: size.starvationContexts?.starvedWithDietCompatibleButZeroValid || 0
    },
    lineage: {
      firstPredationSuccess: injected.firstPredationSuccess,
      secondPredationSuccess: injected.secondPredationSuccess,
      reproducingOrganisms: injected.reproducingOrganisms,
      deathsBeforeFirstPredation: injected.deathsBeforeFirstPredation,
      deathsAfterFirstBeforeSecond: injected.deathsAfterFirstBeforeSecond,
      deathCauses: injected.deathCauses,
      generation1Births: g1.births,
      generation1FirstPredation: g1.firstPredationSuccess,
      persistenceFrames: lineage.persistenceFrames,
      currentLineageAlive: lineage.currentLineageAlive,
      maxGeneration: lineage.maxGeneration
    },
    population: {
      endPopulation: population.endPopulation,
      endDiets: population.endDiets,
      carnivoreBirths: population.byDiet?.c?.births || 0,
      carnivoreDeaths: population.byDiet?.c?.deaths || 0,
      overcrowdingDeaths: population.deathCauses?.overcrowding || 0
    },
    ecosystem: {
      averageAlgae: eco.averageAlgae,
      species: eco.extantSpecies ?? eco.species,
      maxSpeciesShare: eco.maxSpeciesShare
    },
    performance: raw.performance
  };
}

async function collect(page, batchId, windowFrames, spawn) {
  const raw = await page.evaluate(({ batchId, windowFrames }) => {
    const d = window.__alifeDebug;
    return {
      frame: d.developerMode().frame,
      counts: d.counts(),
      population: d.populationTurnoverSummary(windowFrames),
      ecosystem: d.ecosystemImpactSummary(windowFrames),
      individualFunnel: d.predationIndividualFunnelSummary(windowFrames),
      size: d.predationSizeFunnelSummary({ batchId, windowFrames }),
      lineage: batchId ? d.injectionLineageSummary({ batchId, windowFrames }) : null,
      performance: d.performanceSummary()
    };
  }, { batchId, windowFrames });
  raw.spawn = spawn;
  return raw;
}

async function preflight(page) {
  return await page.evaluate(() => {
    const d = window.__alifeDebug;
    d.resetSimulation();
    d.modelStep(60);
    const snap = d.captureTestSnapshot('preflight-size');
    const templates = Array.from({ length: 2 }, () => ({
      speed: 0.62,
      size: 0.58,
      metabolism: 0.62,
      fecundity: 0.45,
      sense: 0.66,
      diet: 0.82,
      formSeed: 0.78
    }));
    const random = d.spawnOrganisms({ count: 2, dietType: 'carnivore', preset: 'viable', templates, ageMode: 'mature', positionMode: 'random', energyMode: 'standard', lineageTracking: true });
    const nearPrey = d.spawnOrganisms({ count: 1, dietType: 'carnivore', preset: 'viable', templates, ageMode: 'mature', positionMode: 'nearPrey', energyMode: 'standard', lineageTracking: true });
    const nearValid = d.spawnOrganisms({ count: 1, dietType: 'carnivore', preset: 'viable', templates, ageMode: 'mature', positionMode: 'nearValidPrey', energyMode: 'standard', lineageTracking: true });
    const nearOversized = d.spawnOrganisms({ count: 1, dietType: 'carnivore', preset: 'viable', templates, ageMode: 'mature', positionMode: 'nearOversizedPrey', energyMode: 'standard', lineageTracking: true });
    d.selectFirstCarnivore();
    const overlay = d.predationSizeOverlaySummary();
    const sizeSummary = d.predationSizeFunnelSummary({ batchId: random.batchId, windowFrames: 60 });
    const roundTrip = d.roundTripSave();
    const restored = d.restoreTestSnapshot('preflight-size');
    return { snap, random, nearPrey, nearValid, nearOversized, overlay: !!overlay, sizeSummary: !!sizeSummary, roundTrip, restored };
  });
}

(async () => {
  const viewport = parseViewport(viewportRaw);
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage({ viewport });
  page.on('pageerror', err => {
    throw err;
  });
  const url = 'file:///' + path.resolve(htmlFile).replace(/\\/g, '/') + '?dev=1';
  await page.goto(url);
  await page.waitForFunction(() => !!window.__alifeDebug && !!window.__alifeDebug.predationSizeFunnelSummary);

  const validation = await preflight(page);

  await page.evaluate(() => window.__alifeDebug.resetSimulation());
  await stepFrames(page, snapshotStep);
  const snapshot = await page.evaluate(() => {
    const d = window.__alifeDebug;
    const snap = d.captureTestSnapshot('size-step');
    return {
      snap,
      frame: d.developerMode().frame,
      counts: d.counts(),
      population: d.populationTurnoverSummary(180),
      ecosystem: d.ecosystemImpactSummary(180),
      capacity: d.capacitySummary()
    };
  });

  const results = [];
  for (const scenario of scenarios) {
    await page.evaluate(() => window.__alifeDebug.restoreTestSnapshot('size-step'));
    const spawn = await page.evaluate(({ templates, positionMode }) => window.__alifeDebug.spawnOrganisms({
      count: 5,
      dietType: 'carnivore',
      preset: 'viable',
      templates,
      ageMode: 'mature',
      positionMode,
      energyMode: 'standard',
      lineageTracking: true
    }), { templates: CARNIVORE_TEMPLATES, positionMode: scenario.positionMode });
    if (!spawn.spawnedCount) {
      results.push({ ...scenario, skipped: true, spawn });
      continue;
    }
    await stepFrames(page, followSteps);
    const raw = await collect(page, spawn.batchId, followSteps, spawn);
    results.push({ ...scenario, skipped: false, raw, compact: compact(raw) });
  }

  const output = {
    file: htmlFile,
    viewport,
    snapshotStep,
    followSteps,
    templates: CARNIVORE_TEMPLATES,
    validation,
    snapshot,
    results,
    diagnosis: {
      sizeDominantHint: results.some(r => !r.skipped && (r.compact?.size?.tooLargeRejectedRate || 0) >= 0.5),
      s2BetterThanS1: (() => {
        const s1 = results.find(r => r.name === 'S1' && !r.skipped)?.compact;
        const s2 = results.find(r => r.name === 'S2' && !r.skipped)?.compact;
        if (!s1 || !s2) return null;
        return {
          firstPredationDelta: (s2.lineage.firstPredationSuccess || 0) - (s1.lineage.firstPredationSuccess || 0),
          targetDelta: (s2.size.targetAcquired || 0) - (s1.size.targetAcquired || 0),
          contactDelta: (s2.size.contactReached || 0) - (s1.size.contactReached || 0)
        };
      })()
    }
  };

  console.log(JSON.stringify(output, null, 2));
  await browser.close();
})().catch(err => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
