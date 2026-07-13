const { chromium } = require('playwright');
const path = require('path');

const htmlFile = process.env.ALIFE_FILE || 'index.html';
const label = process.env.ALIFE_LABEL || 'benchmark';
const trials = Math.max(1, Number(process.env.ALIFE_TRIALS || 20));
const steps = Math.max(1, Number(process.env.ALIFE_STEPS || 1800));
const viewportRaw = process.env.ALIFE_VIEWPORT || '390x844';
const chunk = Math.max(1, Math.min(20, Number(process.env.ALIFE_CHUNK || 20)));
const chromePath = process.env.ALIFE_CHROME || undefined;
const detailMode = String(process.env.ALIFE_DETAIL ?? '1').toLowerCase();
const includeDetails = detailMode !== '0';
const includeRawDetails = includeDetails && detailMode !== 'flat';

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
  const individual = t.individualFunnel || {};
  const individualEvents = individual.events || {};
  const individualEnergy = individual.energy || {};
  const individualDominantFailures = individual.dominantFailureReasons || {};
  const individualDeathBeforeFirst = individual.deathBeforeFirstPredation || {};
  const individualLifetimeFailureOrganisms = individual.lifetimeFailureOrganisms || {};
  const chase = t.chase || {};
  const chaseProximity = chase.proximity || {};
  const chaseNearMiss = chase.nearMiss || {};
  const chaseEnergy = chase.energy || {};
  const chaseCosts = chase.costs || {};
  const chaseTargetState = chase.targetState || {};
  const chaseEndReasons = chase.endReasons || {};
  const nutrition = t.nutrition || {};
  const feeding = t.feeding || {};
  const feedingPredation = feeding.predation || {};
  const feedingSatiety = feeding.satiety || {};
  const feedingHerbivore = feeding.herbivore || {};
  const feedingOmnivore = feeding.omnivore || {};
  const feedingCarnivore = feeding.carnivore || {};
  const feedingInvariant = feeding.invariant || {};
  const storeDCurrent = feeding.currentStoreDByDiet || {};
  const storeDHerbivore = storeDCurrent.herbivore || {};
  const storeDOmnivore = storeDCurrent.omnivore || {};
  const storeDCarnivore = storeDCurrent.carnivore || {};
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
    individualObservedCarnivores: individual.observedCarnivores ?? null,
    individualCarnivoresBorn: individual.carnivoresBorn ?? null,
    individualInitialCarnivores: individual.initialCarnivores ?? null,
    individualReproductionBornCarnivores: individual.reproductionBornCarnivores ?? null,
    individualHadPotentialPreyInSense: individual.hadPotentialPreyInSense ?? null,
    individualHadValidPreyInSense: individual.hadValidPreyInSense ?? null,
    individualAcquiredTarget: individual.acquiredTarget ?? null,
    individualTargetSet: individual.targetSet ?? null,
    individualStartedChase: individual.startedChase ?? null,
    individualReachedContact: individual.reachedContact ?? null,
    individualAttemptedAttack: individual.attemptedAttack ?? null,
    individualSucceededPredation: individual.succeededPredation ?? null,
    individualReachedThresholdAfterPredation: individual.reachedReproductionThresholdAfterPredation ?? null,
    individualReproducedAfterPredation: individual.reproducedAfterPredation ?? null,
    individualValidPreyRate: rate(individual.hadValidPreyInSense ?? null, individual.carnivoresBorn ?? individual.observedCarnivores ?? null),
    individualTargetFromValidRate: rate(individual.acquiredTarget ?? null, individual.hadValidPreyInSense ?? null),
    individualChaseFromTargetRate: rate(individual.startedChase ?? null, individual.acquiredTarget ?? null),
    individualContactFromChaseRate: rate(individual.reachedContact ?? null, individual.startedChase ?? null),
    individualAttackFromContactRate: rate(individual.attemptedAttack ?? null, individual.reachedContact ?? null),
    individualSuccessFromAttackRate: rate(individual.succeededPredation ?? null, individual.attemptedAttack ?? null),
    individualScans: individualEvents.scans ?? null,
    individualPotentialPreyScanEvents: individualEvents.potentialPreyScanEvents ?? null,
    individualValidPreyScanEvents: individualEvents.validPreyScanEvents ?? null,
    individualPreySizeBlockedEvents: individualEvents.preySizeBlockedEvents ?? null,
    individualSameSpeciesExcludedEvents: individualEvents.sameSpeciesExcludedEvents ?? null,
    individualTargetSwitchesBeforeSuccess: individualEvents.targetSwitchesBeforeSuccess ?? null,
    individualChaseFramesBeforeSuccess: individualEvents.chaseFramesBeforeSuccess ?? null,
    individualAttackAttemptsBeforeSuccess: individualEvents.attackAttemptsBeforeSuccess ?? null,
    individualDominantPreyUnavailable: individualDominantFailures.preyUnavailable ?? null,
    individualDominantPreyTooLarge: individualDominantFailures.preyTooLarge ?? null,
    individualDominantSameSpeciesExcluded: individualDominantFailures.sameSpeciesExcluded ?? null,
    individualDominantTargetNotAcquired: individualDominantFailures.targetNotAcquired ?? null,
    individualDominantChaseNotStarted: individualDominantFailures.chaseNotStarted ?? null,
    individualDominantChaseFailed: individualDominantFailures.chaseFailed ?? null,
    individualDominantAttackOpportunityFailed: individualDominantFailures.attackOpportunityFailed ?? null,
    individualDominantAttackCooldownBlocked: individualDominantFailures.attackCooldownBlocked ?? null,
    individualDominantAttackResolutionFailed: individualDominantFailures.attackResolutionFailed ?? null,
    individualDeathBeforeFirstStarvation: individualDeathBeforeFirst.starvationBeforeFirstPredation ?? null,
    individualDeathBeforeFirstOldAge: individualDeathBeforeFirst.oldAgeBeforeFirstPredation ?? null,
    individualDeathBeforeFirstOvercrowding: individualDeathBeforeFirst.overcrowdingBeforeFirstPredation ?? null,
    individualDeathBeforeFirstPredation: individualDeathBeforeFirst.predationDeathBeforeFirstPredation ?? null,
    individualDeathBeforeFirstOther: individualDeathBeforeFirst.otherBeforeFirstPredation ?? null,
    individualFailurePreyUnavailable: individualLifetimeFailureOrganisms.preyUnavailable ?? null,
    individualFailurePreyTooLarge: individualLifetimeFailureOrganisms.preyTooLarge ?? null,
    individualFailureSameSpeciesExcluded: individualLifetimeFailureOrganisms.sameSpeciesExcluded ?? null,
    individualFailureAttackCooldownBlocked: individualLifetimeFailureOrganisms.attackCooldownBlocked ?? null,
    individualFailureBaseProbabilityFailed: individualLifetimeFailureOrganisms.baseProbabilityFailed ?? null,
    individualFailureSizeResolutionFailed: individualLifetimeFailureOrganisms.sizeResolutionFailed ?? null,
    individualFailureGroupDefenseFailed: individualLifetimeFailureOrganisms.groupDefenseFailed ?? null,
    individualFailureDefenseFailed: individualLifetimeFailureOrganisms.defenseFailed ?? null,
    individualAverageBirthEnergy: individualEnergy.averageBirthEnergy ?? null,
    individualAverageFirstTargetEnergy: individualEnergy.averageFirstTargetEnergy ?? null,
    individualAverageFirstChaseEnergy: individualEnergy.averageFirstChaseEnergy ?? null,
    individualAverageFirstContactEnergy: individualEnergy.averageFirstContactEnergy ?? null,
    individualAverageFirstAttackEnergy: individualEnergy.averageFirstAttackEnergy ?? null,
    individualAverageFirstSuccessEnergyBefore: individualEnergy.averageFirstSuccessEnergyBefore ?? null,
    individualAverageFirstSuccessEnergyAfter: individualEnergy.averageFirstSuccessEnergyAfter ?? null,
    individualAverageFirstSuccessSteps: individualEnergy.averageFirstSuccessSteps ?? null,
    individualMedianFirstSuccessSteps: individualEnergy.medianFirstSuccessSteps ?? null,
    individualAverageEnergySpentToFirstSuccess: individualEnergy.averageEnergySpentToFirstSuccess ?? null,
    individualAverageDeathEnergyBeforeFirstPredation: individualEnergy.averageDeathEnergyBeforeFirstPredation ?? null,
    individualAveragePreSuccessChaseFrames: individualEnergy.averagePreSuccessChaseFrames ?? null,
    individualAveragePreSuccessTargetSwitches: individualEnergy.averagePreSuccessTargetSwitches ?? null,
    individualAveragePreSuccessAttackAttempts: individualEnergy.averagePreSuccessAttackAttempts ?? null,
    chaseEpisodes: chase.episodes ?? null,
    chaseCompletedEpisodes: chase.completedEpisodes ?? null,
    chaseActiveEpisodes: chase.activeEpisodes ?? null,
    chaseUniqueCarnivores: chase.uniqueCarnivores ?? null,
    chaseAverageStartDistance: chase.averageStartDistance ?? null,
    chaseAverageMinimumDistance: chase.averageMinimumDistance ?? null,
    chaseAverageEndDistance: chase.averageEndDistance ?? null,
    chaseAverageDistanceReduction: chase.averageDistanceReduction ?? null,
    chaseAverageDistanceReductionRatio: chase.averageDistanceReductionRatio ?? null,
    chaseAverageDistanceReductionPerStep: chase.averageDistanceReductionPerStep ?? null,
    chaseAverageDuration: chase.averageDuration ?? null,
    chaseAveragePredatorSpeed: chase.averagePredatorSpeed ?? null,
    chaseAveragePreySpeed: chase.averagePreySpeed ?? null,
    chaseAveragePredatorPreySpeedRatio: chase.averagePredatorPreySpeedRatio ?? null,
    chaseAverageRelativeSpeed: chase.averageRelativeSpeed ?? null,
    chaseAverageAngleDifferenceDeg: chase.averageAngleDifferenceDeg ?? null,
    chaseAverageCloseAngleDifferenceDeg: chase.averageCloseAngleDifferenceDeg ?? null,
    chaseAverageContactRadius: chase.contactRadius?.average ?? null,
    chaseAverageMinimumDistanceContactRatio: chase.contactRadius?.averageMinimumDistanceRatio ?? null,
    chaseWithin2xContactRadiusRate: chaseProximity.within2xContactRadiusRate ?? null,
    chaseWithin15xContactRadiusRate: chaseProximity.within15xContactRadiusRate ?? null,
    chaseWithin125xContactRadiusRate: chaseProximity.within125xContactRadiusRate ?? null,
    chaseWithin11xContactRadiusRate: chaseProximity.within11xContactRadiusRate ?? null,
    chaseReachedContactRate: chaseProximity.reachedContactRate ?? null,
    chaseAttemptedAttackRate: chaseProximity.attemptedAttackRate ?? null,
    chaseSucceededPredationRate: chaseProximity.succeededPredationRate ?? null,
    chaseUniqueWithin15xContactRadius: chaseProximity.uniqueWithin15xContactRadius ?? null,
    chaseUniqueWithin125xContactRadius: chaseProximity.uniqueWithin125xContactRadius ?? null,
    chaseUniqueReachedContact: chaseProximity.uniqueReachedContact ?? null,
    chasePossibleContactSkipEpisodes: chaseNearMiss.possibleContactSkipEpisodes ?? null,
    chasePossibleContactSkipRate: chaseNearMiss.possibleContactSkipRate ?? null,
    chaseSharpPassEpisodes: chaseNearMiss.sharpPassEpisodes ?? null,
    chaseSharpPassRate: chaseNearMiss.sharpPassRate ?? null,
    chaseAverageEnergyAtStart: chaseEnergy.averageEnergyAtChaseStart ?? null,
    chaseAverageEnergyAtClosestApproach: chaseEnergy.averageEnergyAtClosestApproach ?? null,
    chaseAverageEnergyAtContact: chaseEnergy.averageEnergyAtContact ?? null,
    chaseAverageEnergyAtSuccessBeforeGain: chaseEnergy.averageEnergyAtSuccessfulPredationBeforeGain ?? null,
    chaseAverageEnergyAtSuccessAfterGain: chaseEnergy.averageEnergyAtSuccessfulPredationAfterGain ?? null,
    chaseAverageEnergyAtFailedEnd: chaseEnergy.averageEnergyAtFailedChaseEnd ?? null,
    chaseAverageEnergySpentPerEpisode: chaseEnergy.averageEnergySpentPerEpisode ?? null,
    chaseAverageEnergySpentPerStep: chaseEnergy.averageEnergySpentPerStep ?? null,
    chaseAverageDistanceReducedPerEnergy: chaseEnergy.averageDistanceReducedPerEnergy ?? null,
    chaseAverageBaseMetabolismPerStep: chaseCosts.averageBaseMetabolismPerStep ?? null,
    chaseAverageNormalMoveCostPerStep: chaseCosts.averageNormalMoveCostPerStep ?? null,
    chaseAverageSenseCostPerStep: chaseCosts.averageSenseCostPerStep ?? null,
    chaseAverageDensityCostPerStep: chaseCosts.averageDensityCostPerStep ?? null,
    chaseAverageBurstCostPerStep: chaseCosts.averageBurstCostPerStep ?? null,
    chaseAverageTotalCostPerStep: chaseCosts.averageTotalCostPerStep ?? null,
    chaseTargetSwitches: chaseTargetState.targetSwitches ?? null,
    chaseSamePreyReacquisitions: chaseTargetState.samePreyReacquisitions ?? null,
    chaseTargetInvalidations: chaseTargetState.targetInvalidations ?? null,
    chaseTargetLostCount: chaseTargetState.targetLostCount ?? null,
    chaseEndPredationSuccess: chaseEndReasons.predationSuccess?.episodes ?? null,
    chaseEndTargetLost: chaseEndReasons.targetLost?.episodes ?? null,
    chaseEndTargetInvalid: chaseEndReasons.targetInvalid?.episodes ?? null,
    chaseEndTargetChanged: chaseEndReasons.targetChanged?.episodes ?? null,
    chaseEndPreyDiedElsewhere: chaseEndReasons.preyDiedElsewhere?.episodes ?? null,
    chaseEndEnergyDepleted: chaseEndReasons.energyDepleted?.episodes ?? null,
    chaseEndPredatorDied: chaseEndReasons.predatorDied?.episodes ?? null,
    chaseEndDistanceExceeded: chaseEndReasons.distanceExceeded?.episodes ?? null,
    chaseEndTrackingStateEnded: chaseEndReasons.trackingStateEnded?.episodes ?? null,
    chaseEndOther: chaseEndReasons.other?.episodes ?? null,
    nutritionPredationSuccesses: nutrition.predationSuccesses ?? null,
    averageStoreNBeforePredation: nutrition.averageStoreNBefore ?? null,
    averageStoreNAfterPredation: nutrition.averageStoreNAfter ?? null,
    averageStoreNGainedPredation: nutrition.averageStoreNGained ?? null,
    averageStoreDBeforePredation: nutrition.averageStoreDBefore ?? null,
    averageStoreDAfterPredation: nutrition.averageStoreDAfter ?? null,
    averageStoreDGainedPredation: nutrition.averageStoreDGained ?? null,
    averageEnergyBeforePredation: nutrition.averageEnergyBefore ?? null,
    averageEnergyAfterPredation: nutrition.averageEnergyAfter ?? null,
    predationReproducedWithin300: nutrition.reproducedWithin300 ?? null,
    predationReproducedWithin300Rate: rate(nutrition.reproducedWithin300 ?? null, predationWithin300),
    predationDiedWithin300: nutrition.diedWithin300 ?? null,
    predationSurvivedTo300: nutrition.survivedTo300 ?? null,
    feedingPredationSuccesses: feedingPredation.successes ?? null,
    feedingAverageEnergyAfterPredation: feedingPredation.averageEnergyAfter ?? null,
    feedingAverageStoreNAfterPredation: feedingPredation.averageStoreNAfter ?? null,
    feedingAverageStoreDAfterPredation: feedingPredation.averageStoreDAfter ?? null,
    feedingAverageStoreDGainedPredation: feedingPredation.averageStoreDGained ?? null,
    feedingAverageStoreD60AfterPredation: feedingPredation.averageStoreD60 ?? null,
    feedingAverageStoreD180AfterPredation: feedingPredation.averageStoreD180 ?? null,
    feedingTrackingAfterPredation: feedingPredation.trackingAfterPredation ?? null,
    feedingTrackingWithin60AfterPredation: feedingPredation.trackingWithin60 ?? null,
    feedingTrackingWithin180AfterPredation: feedingPredation.trackingWithin180 ?? null,
    feedingAverageStepsToNextTracking: feedingPredation.averageStepsToNextTracking ?? null,
    feedingSecondPredationSuccessOrganisms: feedingPredation.secondPredationSuccessOrganisms ?? null,
    feedingDiedAfterFirstBeforeSecond: feedingPredation.diedAfterFirstBeforeSecond ?? null,
    feedingStarvedAfterFirstBeforeSecond: feedingPredation.starvedAfterFirstBeforeSecond ?? null,
    satietyEvaluatedSteps: feedingSatiety.evaluatedSteps ?? null,
    satietyAppliedSteps: feedingSatiety.appliedSteps ?? null,
    satietyAverageRawIntent: feedingSatiety.averageRawIntent ?? null,
    satietyAverageAppliedIntent: feedingSatiety.averageAppliedIntent ?? null,
    satietyAverageRawIntentWhileApplied: feedingSatiety.averageRawIntentWhileApplied ?? null,
    satietyAverageAppliedIntentWhileApplied: feedingSatiety.averageAppliedIntentWhileApplied ?? null,
    satietyAverageMultiplier: feedingSatiety.averageMultiplier ?? null,
    herbivoreGrazingSteps: feedingHerbivore.grazingStateSteps ?? null,
    omnivoreGrazingSteps: feedingOmnivore.grazingStateSteps ?? null,
    carnivoreGrazingSteps: feedingCarnivore.grazingStateSteps ?? null,
    herbivoreAlgaeEatingSteps: feedingHerbivore.backgroundAlgaeEatingSteps ?? null,
    omnivoreAlgaeEatingSteps: feedingOmnivore.backgroundAlgaeEatingSteps ?? null,
    herbivoreFleeingSteps: feedingHerbivore.fleeingSteps ?? null,
    omnivoreFleeingSteps: feedingOmnivore.fleeingSteps ?? null,
    herbivoreGrazingSpeedMulApplied: feedingHerbivore.grazingSpeedMulApplied ?? null,
    omnivoreGrazingSpeedMulApplied: feedingOmnivore.grazingSpeedMulApplied ?? null,
    herbivoreAverageGrazingMaxSpBefore: feedingHerbivore.averageGrazingMaxSpBefore ?? null,
    herbivoreAverageGrazingMaxSpAfter: feedingHerbivore.averageGrazingMaxSpAfter ?? null,
    herbivoreAverageGrazingMaxSpRatio: feedingHerbivore.averageGrazingMaxSpRatio ?? null,
    herbivoreGrazingTimerClearedByFleeing: feedingHerbivore.grazingTimerClearedByFleeing ?? null,
    omnivoreAverageGrazingMaxSpBefore: feedingOmnivore.averageGrazingMaxSpBefore ?? null,
    omnivoreAverageGrazingMaxSpAfter: feedingOmnivore.averageGrazingMaxSpAfter ?? null,
    omnivoreAverageGrazingMaxSpRatio: feedingOmnivore.averageGrazingMaxSpRatio ?? null,
    omnivoreGrazingTimerClearedByFleeing: feedingOmnivore.grazingTimerClearedByFleeing ?? null,
    herbivoreAverageGrazingSpeed: feedingHerbivore.averageGrazingSpeed ?? null,
    herbivoreAverageNormalSpeed: feedingHerbivore.averageNormalSpeed ?? null,
    herbivoreAverageFleeingSpeed: feedingHerbivore.averageFleeingSpeed ?? null,
    omnivoreAverageGrazingSpeed: feedingOmnivore.averageGrazingSpeed ?? null,
    omnivoreAverageNormalSpeed: feedingOmnivore.averageNormalSpeed ?? null,
    omnivoreAverageFleeingSpeed: feedingOmnivore.averageFleeingSpeed ?? null,
    fleeingBackgroundAlgaeEatenInvariant: feedingInvariant.fleeingBackgroundAlgaeEaten ?? null,
    grazingAndFleeingStepsInvariant: feedingInvariant.grazingAndFleeingSteps ?? null,
    herbivoreInterruptedAlgae: feedingHerbivore.interruptedAlgaeByFleeing ?? null,
    omnivoreInterruptedAlgae: feedingOmnivore.interruptedAlgaeByFleeing ?? null,
    herbivorePredatorNearAlgaeEaten: feedingHerbivore.predatorNearAlgaeEaten ?? null,
    herbivorePredatorFarAlgaeEaten: feedingHerbivore.predatorFarAlgaeEaten ?? null,
    herbivoreAverageStoreD: feedingHerbivore.averageStoreD ?? null,
    omnivoreAverageStoreD: feedingOmnivore.averageStoreD ?? null,
    carnivoreAverageStoreD: feedingCarnivore.averageStoreD ?? null,
    herbivoreCurrentStoreDAverage: storeDHerbivore.average ?? null,
    herbivoreCurrentStoreDMedian: storeDHerbivore.median ?? null,
    herbivoreCurrentStoreDMax: storeDHerbivore.max ?? null,
    herbivoreCurrentStoreDAbove010: storeDHerbivore.above010 ?? null,
    herbivoreCurrentStoreDAbove033: storeDHerbivore.above033 ?? null,
    herbivoreCurrentMemAverage: storeDHerbivore.averageMem ?? null,
    omnivoreCurrentStoreDAverage: storeDOmnivore.average ?? null,
    omnivoreCurrentStoreDMedian: storeDOmnivore.median ?? null,
    omnivoreCurrentStoreDMax: storeDOmnivore.max ?? null,
    omnivoreCurrentStoreDAbove010: storeDOmnivore.above010 ?? null,
    omnivoreCurrentStoreDAbove033: storeDOmnivore.above033 ?? null,
    omnivoreCurrentMemAverage: storeDOmnivore.averageMem ?? null,
    carnivoreCurrentStoreDAverage: storeDCarnivore.average ?? null,
    carnivoreCurrentStoreDMedian: storeDCarnivore.median ?? null,
    carnivoreCurrentStoreDMax: storeDCarnivore.max ?? null,
    carnivoreCurrentStoreDAbove010: storeDCarnivore.above010 ?? null,
    carnivoreCurrentStoreDAbove033: storeDCarnivore.above033 ?? null,
    carnivoreCurrentMemAverage: storeDCarnivore.averageMem ?? null,
    carnivoreAverageStoreDPredationExperienced: feedingCarnivore.averageStoreDPredationExperienced ?? null,
    carnivoreAverageStoreDNoPredation: feedingCarnivore.averageStoreDNoPredation ?? null,
    carnivoreHighStoreDSteps: feedingCarnivore.highStoreDSteps ?? null,
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
        individualFunnel: window.__alifeDebug.predationIndividualFunnelSummary(steps + 60),
        chase: window.__alifeDebug.chaseEfficiencySummary(steps + 60),
        nutrition: window.__alifeDebug.predationNutritionSummary(steps + 60),
        feeding: window.__alifeDebug.feedingBehaviorSummary(steps + 60),
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

  const flat = trialResults.map(t => ({ trial: t.trial, ...flattenTrial(t) }));
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
    ...(includeDetails ? { flatTrials: flat } : {}),
    ...(includeRawDetails ? { trialsDetail: trialResults } : {}),
    errors
  }, null, 2));
})().catch(err => {
  console.error(err);
  process.exit(1);
});
