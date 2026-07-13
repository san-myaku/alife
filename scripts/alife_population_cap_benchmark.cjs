const { chromium } = require('playwright');
const path = require('path');

const htmlFile = process.env.ALIFE_FILE || 'index.html';
const label = process.env.ALIFE_LABEL || 'benchmark';
const trials = Math.max(1, Number(process.env.ALIFE_TRIALS || 20));
const steps = Math.max(1, Number(process.env.ALIFE_STEPS || 1800));
const viewportRaw = process.env.ALIFE_VIEWPORT || '390x844';
const chunk = Math.max(1, Math.min(20, Number(process.env.ALIFE_CHUNK || 20)));
const chromePath = process.env.ALIFE_CHROME || undefined;
const includeDetails = process.env.ALIFE_DETAIL !== '0';

function parseViewport(value) {
  const m = String(value).match(/^(\d+)x(\d+)$/);
  if (!m) return { width: 390, height: 844 };
  return { width: Number(m[1]), height: Number(m[2]) };
}

function median(values) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stat(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return { mean: 0, median: 0, min: 0, max: 0 };
  return {
    mean: Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(4)),
    median: Number(median(nums).toFixed(4)),
    min: Number(Math.min(...nums).toFixed(4)),
    max: Number(Math.max(...nums).toFixed(4))
  };
}

function rateFromDietRates(pop, threshold) {
  const diets = pop.newborn?.survivalRateByDiet || {};
  let eligible = 0;
  let survived = 0;
  for (const d of ['h', 'm', 'c']) {
    eligible += diets[d]?.[`eligible${threshold}`] || 0;
    survived += diets[d]?.[`survived${threshold}`] || 0;
  }
  return eligible ? survived / eligible : null;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function flattenTrial(t) {
  const pop = t.population;
  const funnel = t.funnel;
  const nutrition = t.nutrition || {};
  const reproduction = t.reproduction || {};
  const eligibility = t.eligibility || {};
  const carnRepro = reproduction.carnivore || {};
  const carnGate = eligibility.carnivore || {};
  const carnProgress = eligibility.carnivoreProgress || {};
  const carnChildren = eligibility.carnivoreChildren || {};
  const carnDeaths = eligibility.carnivoreDeathStateByCause || {};
  const starvationDeaths = carnDeaths.starvation || {};
  const predationDeaths = carnDeaths.predation || {};
  const overcrowdingDeaths = carnDeaths.overcrowding || {};
  const eco = t.ecosystem;
  const perf = t.performance;
  const predationSuccesses = funnel.predationSuccesses;
  const predationWithin300 = nutrition.predationSuccesses ?? predationSuccesses;
  return {
    endPopulation: pop.endPopulation,
    endHerbivores: pop.endDiets.h,
    endOmnivores: pop.endDiets.m,
    endCarnivores: pop.endDiets.c,
    herbivoreExtinct: pop.endDiets.h === 0 ? 1 : 0,
    carnivoreRatio: pop.endPopulation ? pop.endDiets.c / pop.endPopulation : 0,
    totalBirths: pop.births,
    totalDeaths: pop.deaths,
    totalOvercrowdingDeaths: pop.deathCauses.overcrowding || 0,
    newbornSurvival60: rateFromDietRates(pop, 60),
    newbornSurvival180: rateFromDietRates(pop, 180),
    newbornSurvival240: rateFromDietRates(pop, 240),
    herbivoreBirths: pop.byDiet.h.births,
    omnivoreBirths: pop.byDiet.m.births,
    carnivoreBirths: pop.byDiet.c.births,
    herbivoreDeaths: pop.byDiet.h.deaths,
    omnivoreDeaths: pop.byDiet.m.deaths,
    carnivoreDeaths: pop.byDiet.c.deaths,
    carnivoreNet: pop.byDiet.c.births - pop.byDiet.c.deaths,
    carnivoreReproductions: pop.byDiet.c.reproductions,
    carnivoreReproductionAttempts: carnRepro.attempts ?? null,
    carnivoreReproductionSuccesses: carnRepro.successes ?? null,
    carnivoreReproductionSuccessRate: rate(carnRepro.successes ?? null, carnRepro.attempts ?? null),
    carnivoreBirthDeathRatio: rate(pop.byDiet.c.births, pop.byDiet.c.deaths),
    carnivoreAverageStoreN: pop.endAverageStoreNByDiet?.c ?? null,
    carnivoreAverageEnAtReproduction: carnRepro.averageEn ?? null,
    carnivoreOriginalAlgaeMultiplier: carnRepro.averageOriginalAlgaeMultiplier ?? null,
    carnivoreAppliedResourceMultiplier: carnRepro.averageAppliedResourceMultiplier ?? null,
    carnivoreAverageCarnivoryWeight: carnRepro.averageCarnivoryWeight ?? null,
    carnivoreAverageEnergyAtReproduction: carnRepro.averageEnergy ?? null,
    carnivoreAverageStoreNAtReproduction: carnRepro.averageStoreN ?? null,
    carnivoreAverageStoreDAtReproduction: carnRepro.averageStoreD ?? null,
    carnivoreAverageStoreOAtReproduction: carnRepro.averageStoreO ?? null,
    carnivoreAverageMemAtReproduction: carnRepro.averageMem ?? null,
    carnivoreGateEvaluatedEvents: carnGate.evaluated?.events ?? null,
    carnivoreGateEvaluatedUnique: carnGate.evaluated?.uniqueOrganisms ?? null,
    carnivoreGateImmatureEvents: carnGate.immature?.events ?? null,
    carnivoreGateEnergyBelowEvents: carnGate.energyBelowThreshold?.events ?? null,
    carnivoreGateEnergyBelowUnique: carnGate.energyBelowThreshold?.uniqueOrganisms ?? null,
    carnivoreGateEligibleEvents: carnGate.eligible?.events ?? null,
    carnivoreGateEligibleUnique: carnGate.eligible?.uniqueOrganisms ?? null,
    carnivoreGateProbabilityFailedEvents: carnGate.probabilityFailed?.events ?? null,
    carnivoreGateReproducedEvents: carnGate.reproduced?.events ?? null,
    carnivoreProgressObserved: carnProgress.observedCarnivores ?? null,
    carnivoreProgressBorn: carnProgress.bornCarnivores ?? null,
    carnivoreProgressInitial: carnProgress.initialCarnivores ?? null,
    carnivoreProgressMatured: carnProgress.maturedCarnivores ?? null,
    carnivoreProgressCurrentMature: carnProgress.currentMatureCarnivores ?? null,
    carnivoreProgressAverageCurrentEnergyRatio: carnProgress.averageCurrentEnergyRatio ?? null,
    carnivoreProgressMedianCurrentEnergyRatio: carnProgress.medianCurrentEnergyRatio ?? null,
    carnivoreProgressAverageLifetimeMaxEnergyRatio: carnProgress.averageLifetimeMaxEnergyRatio ?? null,
    carnivoreProgressMedianLifetimeMaxEnergyRatio: carnProgress.medianLifetimeMaxEnergyRatio ?? null,
    carnivoreProgressMaxLifetimeEnergyRatio: carnProgress.maxLifetimeEnergyRatio ?? null,
    carnivoreReachedEnergy025: carnProgress.thresholdReached?.gte025 ?? null,
    carnivoreReachedEnergy050: carnProgress.thresholdReached?.gte050 ?? null,
    carnivoreReachedEnergy075: carnProgress.thresholdReached?.gte075 ?? null,
    carnivoreReachedEnergy090: carnProgress.thresholdReached?.gte090 ?? null,
    carnivoreReachedEnergy100: carnProgress.thresholdReached?.gte100 ?? null,
    carnivoreReachedEnergy125: carnProgress.thresholdReached?.gte125 ?? null,
    carnivorePredationBeforeMature: carnProgress.predationBeforeMature ?? null,
    carnivorePredationAfterMature: carnProgress.predationAfterMature ?? null,
    carnivoreNeverPredated: carnProgress.neverPredated ?? null,
    carnivorePredationSucceeded: carnProgress.predationSucceeded ?? null,
    carnivoreAverageMaxEnergyRatioAfterPredation: carnProgress.averageMaxEnergyRatioAfterPredation ?? null,
    carnivoreMaxEnergyRatioAfterPredation: carnProgress.maxEnergyRatioAfterPredation ?? null,
    carnivoreReachedThresholdAfterPredation: carnProgress.reachedThresholdAfterPredation ?? null,
    carnivoreEligibleAfterPredation: carnProgress.eligibleAfterPredation ?? null,
    carnivoreReproducedAfterPredation: carnProgress.reproducedAfterPredation ?? null,
    carnivoreProgressEligibleReached: carnProgress.eligibleReached ?? null,
    carnivoreProgressReproduced: carnProgress.reproduced ?? null,
    carnivoreDeathStarvation: starvationDeaths.deaths ?? null,
    carnivoreDeathStarvationEnergyRatio: starvationDeaths.averageEnergyRatio ?? null,
    carnivoreDeathPredation: predationDeaths.deaths ?? null,
    carnivoreDeathPredationEnergyRatio: predationDeaths.averageEnergyRatio ?? null,
    carnivoreDeathOvercrowding: overcrowdingDeaths.deaths ?? null,
    carnivoreDeathOvercrowdingEnergyRatio: overcrowdingDeaths.averageEnergyRatio ?? null,
    carnivoreChildrenFromHerbivoreParent: carnChildren.fromHerbivoreParent ?? null,
    carnivoreChildrenFromOmnivoreParent: carnChildren.fromOmnivoreParent ?? null,
    carnivoreChildrenFromCarnivoreParent: carnChildren.fromCarnivoreParent ?? null,
    carnivoreChildrenCrossingDietClass: carnChildren.carnivoreChildrenCrossingDietClass ?? null,
    carnivoreParentCarnivoreChildren: carnChildren.carnivoreParentCarnivoreChildren ?? null,
    carnivoreParentNonCarnivoreChildren: carnChildren.carnivoreParentNonCarnivoreChildren ?? null,
    carnivoresPresent: pop.endDiets.c > 0 ? 1 : 0,
    predationSuccesses,
    predationCandidates: funnel.preyCandidatesFound,
    predationTracking: funnel.trackingStarted,
    predationContact: funnel.contactReached,
    predationAttempts: funnel.predationAttempts,
    predationAfterRepro: funnel.reproductionAfterPredation,
    predationAfterReproRate: rate(funnel.reproductionAfterPredation, predationSuccesses),
    nutritionPredationSuccesses: nutrition.predationSuccesses ?? null,
    averageStoreNBeforePredation: nutrition.averageStoreNBefore ?? null,
    averageStoreNAfterPredation: nutrition.averageStoreNAfter ?? null,
    averageStoreNGainedPredation: nutrition.averageStoreNGained ?? null,
    averageEnergyBeforePredation: nutrition.averageEnergyBefore ?? null,
    averageEnergyAfterPredation: nutrition.averageEnergyAfter ?? null,
    predationReproducedWithin300: nutrition.reproducedWithin300 ?? null,
    predationReproducedWithin300Rate: rate(nutrition.reproducedWithin300 ?? null, predationWithin300),
    predationDiedWithin300: nutrition.diedWithin300 ?? null,
    predationSurvivedTo300: nutrition.survivedTo300 ?? null,
    carnivoreKidSurvived60: funnel.carnivoreOffspringSurvived60,
    carnivoreKidSurvived180: funnel.carnivoreOffspringSurvived180,
    carnivoreKidSurvived240: funnel.carnivoreOffspringSurvived240,
    averageAlgae: eco.averageAlgae,
    averageOxygen: eco.averageOxygen,
    averageDetritus: eco.averageDetritus,
    algaeEaten: eco.algaeEaten,
    fleeingAlgaeEaten: eco.fleeingAlgaeEaten,
    normalAlgaeEaten: eco.normalAlgaeEaten,
    predationDetritus: eco.predationDetritus,
    maxSpeciesShare: eco.maxSpeciesShare,
    extantSpecies: eco.extantSpecies,
    fps: perf.fps,
    updateMs: t.measuredUpdateMsPerStep,
    drawMs: perf.drawMs
  };
}

(async () => {
  const viewport = parseViewport(viewportRaw);
  const launchOptions = { headless: true };
  if (chromePath) launchOptions.executablePath = chromePath;
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror:${e.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console:${msg.text()}`);
  });

  const url = 'file:///' + path.resolve(htmlFile).replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__alifeDebug && window.__alifeDebug.populationTurnoverSummary, null, { timeout: 10000 });

  const trialResults = [];
  for (let i = 0; i < trials; i++) {
    const result = await page.evaluate(async ({ steps, chunk }) => {
      window.__alifeDebug.resetSimulation();
      const t0 = performance.now();
      let remaining = steps;
      while (remaining > 0) {
        const n = Math.min(chunk, remaining);
        window.__alifeDebug.modelStep(n);
        remaining -= n;
      }
      const elapsed = performance.now() - t0;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        population: window.__alifeDebug.populationTurnoverSummary(steps + 60),
        funnel: window.__alifeDebug.predationFunnelSummary(steps + 60),
        nutrition: window.__alifeDebug.predationNutritionSummary(steps + 60),
        reproduction: window.__alifeDebug.reproductionResourceSummary(steps + 60),
        eligibility: window.__alifeDebug.reproductionEligibilitySummary(steps + 60),
        ecosystem: window.__alifeDebug.ecosystemImpactSummary(steps + 60),
        performance: window.__alifeDebug.performanceSummary(),
        measuredUpdateMsPerStep: elapsed / steps
      };
    }, { steps, chunk });
    trialResults.push({ trial: i + 1, ...result });
  }

  await browser.close();

  const flat = trialResults.map(flattenTrial);
  const keys = Object.keys(flat[0] || {});
  const summary = {};
  for (const key of keys) {
    summary[key] = stat(flat.map(r => r[key]).filter(v => v != null));
  }

  console.log(JSON.stringify({
    label,
    htmlFile,
    viewport: `${viewport.width}x${viewport.height}`,
    trials,
    steps,
    chunk,
    summary,
    ...(includeDetails ? { trialsDetail: trialResults } : {}),
    errors
  }, null, 2));
})().catch(err => {
  console.error(err);
  process.exit(1);
});
