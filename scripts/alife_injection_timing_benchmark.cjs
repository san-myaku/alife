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
const finalStep = Math.max(1, Number(process.env.ALIFE_STEPS || 1800));
const viewportRaw = process.env.ALIFE_VIEWPORT || '390x844';
const chunk = Math.max(1, Math.min(20, Number(process.env.ALIFE_CHUNK || 20)));
const chromePath = process.env.ALIFE_CHROME || undefined;
const injectionSteps = String(process.env.ALIFE_INJECTION_STEPS || '300,600,900')
  .split(',')
  .map(v => Number(v.trim()))
  .filter(Number.isFinite)
  .filter(v => v > 0 && v < finalStep);

function parseViewport(value) {
  const m = String(value).match(/^(\d+)x(\d+)$/);
  if (!m) return { width: 390, height: 844 };
  return { width: Number(m[1]), height: Number(m[2]) };
}

function rate(num, den) {
  return den ? num / den : null;
}

function mean(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function settleLevel(lineage, outcome) {
  if (!lineage || lineage.found === false) return null;
  const injected = lineage.injected || {};
  const g1 = lineage.generations?.generation1 || {};
  const g2 = lineage.generations?.generation2 || {};
  const g3 = lineage.generations?.generation3plus || {};
  const carnivoreRatio = outcome?.population?.endPopulation
    ? (outcome.population.endDiets?.c || 0) / outcome.population.endPopulation
    : 0;
  const herbivores = outcome?.population?.endDiets?.h || 0;
  if ((g2.firstPredationSuccess || g2.reproduced || g3.alive || g3.firstPredationSuccess) &&
      (lineage.persistenceFrames || 0) >= 600 && herbivores > 0 && carnivoreRatio < 0.4) return 4;
  if ((g1.producedNextGeneration || 0) > 0 || (g2.births || 0) > 0) return 3;
  if ((g1.births || 0) > 0 && (g1.firstPredationSuccess || 0) > 0) return 2;
  if ((injected.firstPredationSuccess || 0) > 0 || (lineage.currentInjectedAlive || 0) > 0) return 1;
  return 0;
}

function compactOutcome(raw) {
  const pop = raw.population || {};
  const individual = raw.individualFunnel || {};
  const chase = raw.chase || {};
  const feeding = raw.feeding || {};
  const eco = raw.ecosystem || {};
  const perf = raw.performance || {};
  const lineage = raw.lineage || null;
  return {
    frame: raw.frame,
    population: {
      endPopulation: pop.endPopulation,
      endDiets: pop.endDiets,
      births: pop.births,
      deaths: pop.deaths,
      overcrowdingDeaths: pop.deathCauses?.overcrowding || 0,
      carnivoreBirths: pop.byDiet?.c?.births || 0,
      carnivoreDeaths: pop.byDiet?.c?.deaths || 0,
      carnivoreNet: (pop.byDiet?.c?.births || 0) - (pop.byDiet?.c?.deaths || 0)
    },
    individual: {
      observedCarnivores: individual.observedCarnivores,
      startedChase: individual.startedChase,
      reachedContact: individual.reachedContact,
      attemptedAttack: individual.attemptedAttack,
      succeededPredation: individual.succeededPredation,
      reachedThresholdAfterPredation: individual.reachedReproductionThresholdAfterPredation,
      reproducedAfterPredation: individual.reproducedAfterPredation,
      deathBeforeFirstPredation: individual.deathBeforeFirstPredation
    },
    chase: {
      episodes: chase.episodes,
      uniqueCarnivores: chase.uniqueCarnivores,
      averageDistanceReductionRatio: chase.distance?.averageDistanceReductionRatio,
      contactReached: chase.proximity?.contactReached,
      contactReachedRate: chase.proximity?.contactReachedRate,
      averageEnergySpentPerEpisode: chase.energy?.averageEnergySpentPerEpisode
    },
    feeding: {
      interruptedAlgaeByFleeing:
        (feeding.herbivore?.interruptedAlgaeByFleeing || 0) +
        (feeding.omnivore?.interruptedAlgaeByFleeing || 0) +
        (feeding.carnivore?.interruptedAlgaeByFleeing || 0),
      fleeingBackgroundAlgaeEaten:
        (feeding.herbivore?.fleeingBackgroundAlgaeEaten || 0) +
        (feeding.omnivore?.fleeingBackgroundAlgaeEaten || 0) +
        (feeding.carnivore?.fleeingBackgroundAlgaeEaten || 0)
    },
    ecosystem: {
      averageAlgae: eco.averageAlgae,
      averageOxygen: eco.averageOxygen,
      averageDetritus: eco.averageDetritus,
      species: eco.extantSpecies ?? eco.species,
      maxSpeciesShare: eco.maxSpeciesShare
    },
    performance: {
      fps: perf.fps,
      updateMs: perf.updateMs,
      drawMs: perf.drawMs
    },
    lineage,
    settlementLevel: settleLevel(lineage, raw)
  };
}

async function stepFrames(page, frames) {
  let remaining = frames;
  while (remaining > 0) {
    const n = Math.min(chunk, remaining);
    await page.evaluate(nFrames => window.__alifeDebug.modelStep(nFrames), n);
    remaining -= n;
  }
}

async function collect(page, batchId, windowFrames = finalStep) {
  return await page.evaluate(({ batchId, windowFrames }) => {
    const d = window.__alifeDebug;
    return {
      frame: d.developerMode().frame,
      counts: d.counts(),
      population: d.populationTurnoverSummary(windowFrames),
      funnel: d.predationFunnelSummary(windowFrames),
      individualFunnel: d.predationIndividualFunnelSummary(windowFrames),
      chase: d.chaseEfficiencySummary(windowFrames),
      feeding: d.feedingBehaviorSummary(windowFrames),
      ecosystem: d.ecosystemImpactSummary(windowFrames),
      capacity: d.capacitySummary(),
      performance: d.performanceSummary(),
      lineage: batchId ? d.injectionLineageSummary({ batchId, windowFrames }) : null
    };
  }, { batchId, windowFrames });
}

async function preflight(page) {
  return await page.evaluate(() => {
    const d = window.__alifeDebug;
    d.resetSimulation();
    const carn = d.spawnOrganisms({
      count: 5,
      dietType: 'carnivore',
      preset: 'viable',
      ageMode: 'mature',
      positionMode: 'random',
      energyMode: 'standard',
      lineageTracking: true
    });
    const carnLineage = d.injectionLineageSummary({ batchId: carn.batchId });
    const roundTrip = d.roundTripSave();
    const carnLineageAfterLoad = d.injectionLineageSummary({ batchId: carn.batchId });
    d.resetSimulation();
    const herb = d.spawnOrganisms({ count: 2, dietType: 'herbivore', preset: 'random', ageMode: 'newborn', positionMode: 'center', energyMode: 'standard', lineageTracking: true });
    const omni = d.spawnOrganisms({ count: 2, dietType: 'omnivore', preset: 'viable', ageMode: 'mature', positionMode: 'center', energyMode: 'full', lineageTracking: true });
    d.resetSimulation();
    const snap = d.captureTestSnapshot('preflight');
    d.modelStep(20);
    const restored = d.restoreTestSnapshot('preflight');
    return { carn, carnLineage, roundTrip, carnLineageAfterLoad, herb, omni, snap, restored, dev: d.developerMode() };
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
  await page.waitForFunction(() => !!window.__alifeDebug && !!window.__alifeDebug.spawnOrganisms);

  const validation = await preflight(page);

  await page.evaluate(() => window.__alifeDebug.resetSimulation());
  const snapshotEnvironments = {};
  let currentStep = 0;
  for (const step of injectionSteps) {
    await stepFrames(page, step - currentStep);
    currentStep = step;
    const name = `step-${step}`;
    await page.evaluate(name => window.__alifeDebug.captureTestSnapshot(name), name);
    snapshotEnvironments[step] = await page.evaluate(() => {
      const d = window.__alifeDebug;
      return {
        frame: d.developerMode().frame,
        counts: d.counts(),
        population: d.populationTurnoverSummary(180),
        ecosystem: d.ecosystemImpactSummary(180),
        feeding: d.feedingBehaviorSummary(180),
        capacity: d.capacitySummary()
      };
    });
  }

  const scenarios = [];
  for (const step of injectionSteps) {
    const name = `step-${step}`;
    await page.evaluate(name => window.__alifeDebug.restoreTestSnapshot(name), name);
    await stepFrames(page, finalStep - step);
    const controlRaw = await collect(page, null, finalStep - step);
    scenarios.push({ injectionStep: step, condition: 'control', raw: controlRaw, compact: compactOutcome(controlRaw) });

    await page.evaluate(name => window.__alifeDebug.restoreTestSnapshot(name), name);
    const spawn = await page.evaluate(() => window.__alifeDebug.spawnOrganisms({
      count: 5,
      dietType: 'carnivore',
      preset: 'viable',
      ageMode: 'mature',
      positionMode: 'random',
      energyMode: 'standard',
      lineageTracking: true
    }));
    const checkpoints = {};
    let elapsed = 0;
    for (const delta of [60, 180, 300, 600, 900]) {
      if (step + delta > finalStep) continue;
      await stepFrames(page, delta - elapsed);
      elapsed = delta;
      const raw = await collect(page, spawn.batchId, delta);
      checkpoints[`plus${delta}`] = compactOutcome(raw);
    }
    if (step + elapsed < finalStep) await stepFrames(page, finalStep - step - elapsed);
    const injectedRaw = await collect(page, spawn.batchId, finalStep - step);
    scenarios.push({ injectionStep: step, condition: 'injected', spawn, checkpoints, raw: injectedRaw, compact: compactOutcome(injectedRaw) });
  }

  const injected = scenarios.filter(s => s.condition === 'injected');
  const summary = {
    file: htmlFile,
    viewport,
    finalStep,
    injectionSteps,
    validation,
    snapshotEnvironments,
    scenarios,
    aggregates: {
      injectedSettlementLevels: injected.map(s => ({ step: s.injectionStep, level: s.compact.settlementLevel })),
      averageInjectedFirstPredation: mean(injected.map(s => s.compact.lineage?.injected?.firstPredationSuccess)),
      averageInjectedSecondPredation: mean(injected.map(s => s.compact.lineage?.injected?.secondPredationSuccess)),
      averageInjectedReproducers: mean(injected.map(s => s.compact.lineage?.injected?.reproducingOrganisms)),
      averageGeneration1Births: mean(injected.map(s => s.compact.lineage?.generations?.generation1?.births)),
      averageGeneration1Predation: mean(injected.map(s => s.compact.lineage?.generations?.generation1?.firstPredationSuccess)),
      averageGeneration1Reproducers: mean(injected.map(s => s.compact.lineage?.generations?.generation1?.reproduced)),
      averageGeneration2Births: mean(injected.map(s => s.compact.lineage?.generations?.generation2?.births)),
      averagePersistenceFrames: mean(injected.map(s => s.compact.lineage?.persistenceFrames)),
      averageContactReachedInjected: mean(injected.map(s => s.compact.individual.reachedContact)),
      averagePredationSucceededInjected: mean(injected.map(s => s.compact.individual.succeededPredation)),
      averageCarnivoreBirthsInjected: mean(injected.map(s => s.compact.population.carnivoreBirths)),
      averageCarnivoreDeathsInjected: mean(injected.map(s => s.compact.population.carnivoreDeaths))
    }
  };

  console.log(JSON.stringify(summary, null, 2));
  await browser.close();
})().catch(err => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
