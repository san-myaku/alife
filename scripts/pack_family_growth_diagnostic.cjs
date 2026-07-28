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

const home = process.env.USERPROFILE || process.env.HOME || '';
addNodeModuleDir(path.join(home, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules'));
addNodeModuleDir(path.join(home, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', '.pnpm', 'node_modules'));

const { chromium } = require('playwright');

const htmlFile = process.env.ALIFE_FILE || 'index.html';
const seeds = String(process.env.ALIFE_SEEDS || '41001,42001,43001,44001,45001')
  .split(',')
  .map(s => Number(s.trim()))
  .filter(Number.isFinite);
const steps = Math.max(1, Number(process.env.ALIFE_STEPS || 2000));
const outputDir = process.env.ALIFE_PACK_FAMILY_OUTPUT_DIR || path.join('artifacts', 'pack_family_growth_20260728');
const outputJson = path.join(outputDir, 'pack_family_growth_results.json');
const outputMarkdown = path.join(outputDir, 'pack_family_growth_summary.md');
const shareFraction = Math.max(0, Math.min(0.95, Number(process.env.ALIFE_PACK_SHARE_FRACTION || 0)));
const targetConsensus = String(process.env.ALIFE_PACK_TARGET_CONSENSUS || '').toLowerCase() === 'true';
const packAttackBase = Math.max(0.1, Math.min(2, Number(process.env.ALIFE_PACK_ATTACK_BASE || 0.78)));
const variant = process.env.ALIFE_PACK_VARIANT || 'pack-family-growth';
const lineageAwarePackIdentity = String(process.env.ALIFE_LINEAGE_AWARE_PACK_IDENTITY || 'true').toLowerCase() !== 'false';
const includeModelState = String(process.env.ALIFE_INCLUDE_MODEL_STATE || '').toLowerCase() === 'true';
const viewport = { width: 1280, height: 720 };

function average(rows) {
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : 0;
}

function summarizePacks(packState) {
  const packs = Object.values(packState?.packs || {});
  return packs.map(pack => ({
    id: pack.id,
    lineageId: pack.lineageId,
    identityMode: pack.identityMode,
    identityKey: pack.identityKey,
    createdFrame: pack.createdFrame,
    dissolvedFrame: pack.dissolvedFrame,
    founderId: pack.founderId,
    parentPackId: pack.parentPackId,
    totalMembersEver: pack.totalMembersEver,
    birthsIntoPack: pack.birthsIntoPack,
    joins: pack.joins,
    leaves: pack.leaves,
    deaths: pack.deaths,
    currentLivingMembers: pack.currentLivingMembers,
    maximumLivingMembers: pack.maximumLivingMembers,
    memberFramesTotal: pack.memberFramesTotal
  })).sort((a, b) => Number(a.createdFrame || 0) - Number(b.createdFrame || 0) || String(a.id).localeCompare(String(b.id)));
}

function compactRun(seed, payload) {
  const run = payload.run;
  const packSummary = payload.packSummary || run.packIdentity || {};
  const telemetry = payload.packState?.telemetry || {};
  const packs = summarizePacks(payload.packState);
  const invariants = packSummary.invariants || {};
  const conservation = run.conservation || {};
  const health = run.health || {};
  const maxPackSizeEver = packs.reduce((max, pack) => Math.max(max, Number(pack.maximumLivingMembers || 0)), 0);
  return {
    seed,
    steps: run.steps,
    frame: run.frame,
    elapsedMs: run.elapsedMs,
    packSummary,
    packTelemetry: telemetry,
    packMemberLifecycle: payload.packMemberLifecycle,
    juvenileDevelopment: payload.juvenileDevelopment,
    packs,
    maxPackSizeEver,
    packsAtLeast3: packs.filter(pack => Number(pack.maximumLivingMembers || 0) >= 3).map(pack => pack.id),
    activePackCount: Number(packSummary.activePackCount || 0),
    activeMaximumPackSize: Number(packSummary.maximumPackSize || 0),
    lineageMismatchMembers: Number(invariants.lineageMismatchMembers || 0),
    mixedLineagePacks: Number(invariants.mixedLineagePacks || 0),
    missingRecordIdentityPacks: Number(invariants.missingRecordIdentityPacks || 0),
    energyCreationEvents: Number(conservation.energyCreationEvents || 0),
    nutrientCreationEvents: Number(conservation.nutrientCreationEvents || 0),
    badNumberCount: Number(health.badCount || 0),
    roundTrip: payload.roundTrip,
    run
  };
}

function aggregate(results) {
  const packRows = results.flatMap(result => result.packs.map(pack => ({ seed: result.seed, ...pack })));
  const maxSizes = packRows.map(pack => Number(pack.maximumLivingMembers || 0));
  const packMemberRows = results.flatMap(result => (result.packMemberLifecycle?.members || []).map(member => ({ seed: result.seed, ...member })));
  const spatialPackRows = results.flatMap(result => (result.packMemberLifecycle?.spatialPacks || []).map(pack => ({ seed: result.seed, ...pack })));
  const totalPairObservations = spatialPackRows.reduce((sum, pack) => sum + Number(pack.pairObservations || 0), 0);
  const totalParentChildPairObservations = spatialPackRows.reduce((sum, pack) => sum + Number(pack.parentChildPairObservations || 0), 0);
  return {
    seeds: results.map(result => result.seed),
    steps,
    totalPacksCreated: results.reduce((sum, result) => sum + Number(result.packSummary.packsCreated || 0), 0),
    totalPackJoins: results.reduce((sum, result) => sum + Number(result.packSummary.joins || 0), 0),
    totalPackInheritedBirths: results.reduce((sum, result) => sum + Number(result.packSummary.parentInheritedBirths || 0), 0),
    totalLineageFamilyNeighborJoins: results.reduce((sum, result) => sum + Number(result.packSummary.lineageFamilyNeighborJoins || 0), 0),
    totalFamilyNeighborScanCalls: results.reduce((sum, result) => sum + Number(result.packSummary.familyNeighborScanCalls || 0), 0),
    totalFamilyNeighborSameLineageUnassigned: results.reduce((sum, result) => sum + Number(result.packSummary.familyNeighborSameLineageUnassigned || 0), 0),
    totalFamilyNeighborSameLineageEligible: results.reduce((sum, result) => sum + Number(result.packSummary.familyNeighborSameLineageEligible || 0), 0),
    totalFamilyNeighborSameLineageIneligible: results.reduce((sum, result) => sum + Number(result.packSummary.familyNeighborSameLineageIneligible || 0), 0),
    totalFamilyNeighborNearEligible: results.reduce((sum, result) => sum + Number(result.packSummary.familyNeighborNearEligible || 0), 0),
    totalFamilyNeighborNearIneligible: results.reduce((sum, result) => sum + Number(result.packSummary.familyNeighborNearIneligible || 0), 0),
    totalLifetimeOpportunitySamples: results.reduce((sum, result) => sum + Number(result.packSummary.lifetimeOpportunitySamples || 0), 0),
    totalLifetimeSameLineageUnassignedEligible: results.reduce((sum, result) => sum + Number(result.packSummary.lifetimeSameLineageUnassignedEligible || 0), 0),
    totalLifetimeNearUnassignedEligible: results.reduce((sum, result) => sum + Number(result.packSummary.lifetimeNearUnassignedEligible || 0), 0),
    totalLifetimeSameLineageUnassignedIneligible: results.reduce((sum, result) => sum + Number(result.packSummary.lifetimeSameLineageUnassignedIneligible || 0), 0),
    totalLifetimeNearUnassignedIneligible: results.reduce((sum, result) => sum + Number(result.packSummary.lifetimeNearUnassignedIneligible || 0), 0),
    totalLifetimeSameLineageOtherPack: results.reduce((sum, result) => sum + Number(result.packSummary.lifetimeSameLineageOtherPack || 0), 0),
    totalLifetimeNearOtherPack: results.reduce((sum, result) => sum + Number(result.packSummary.lifetimeNearOtherPack || 0), 0),
    totalFamilyReproductionEvents: results.reduce((sum, result) => sum + Number(result.packSummary.familyReproductionEvents || 0), 0),
    totalFamilyMultiClutchEvents: results.reduce((sum, result) => sum + Number(result.packSummary.familyMultiClutchEvents || 0), 0),
    totalFamilyMultiClutchChildren: results.reduce((sum, result) => sum + Number(result.packSummary.familyMultiClutchChildren || 0), 0),
    totalInheritedClutchEvents: results.reduce((sum, result) => sum + Number(result.packSummary.inheritedClutchEvents || 0), 0),
    totalInheritedClutchChildren: results.reduce((sum, result) => sum + Number(result.packSummary.inheritedClutchChildren || 0), 0),
    totalOverflowFeedingEvents: results.reduce((sum, result) => sum + Number(result.packSummary.overflowFeedingEvents || 0), 0),
    totalOverflowEnergyTransferred: results.reduce((sum, result) => sum + Number(result.packSummary.overflowEnergyTransferred || 0), 0),
    totalOverflowNutrientTransferred: results.reduce((sum, result) => sum + Number(result.packSummary.overflowNutrientTransferred || 0), 0),
    totalOverflowRecipients: results.reduce((sum, result) => sum + Number(result.packSummary.overflowRecipients || 0), 0),
    totalSurplusFeedingEvents: results.reduce((sum, result) => sum + Number(result.packSummary.surplusFeedingEvents || 0), 0),
    totalSurplusEnergyTransferred: results.reduce((sum, result) => sum + Number(result.packSummary.surplusEnergyTransferred || 0), 0),
    totalSurplusRecipients: results.reduce((sum, result) => sum + Number(result.packSummary.surplusRecipients || 0), 0),
    totalCapacityCullEvents: results.reduce((sum, result) => sum + Number(result.run.capacityCull?.events || 0), 0),
    totalCapacityCullDeaths: results.reduce((sum, result) => sum + Number(result.run.capacityCull?.selected || 0), 0),
    totalCarnivoreCapacityCullDeaths: results.reduce((sum, result) => sum + Number(result.run.capacityCull?.selectedByDiet?.c || 0), 0),
    totalActivePackMemberCapacityCullDeaths: results.reduce((sum, result) => sum + Number(result.run.capacityCull?.selectedActivePackMembers || 0), 0),
    totalPackBornCapacityCullDeaths: results.reduce((sum, result) => sum + Number(result.run.capacityCull?.selectedPackBorn || 0), 0),
    totalLastMatureDietCapacityCullDeaths: results.reduce((sum, result) => sum + Number(result.run.capacityCull?.selectedLastMatureOfDiet || 0), 0),
    totalLastMatureLineageCapacityCullDeaths: results.reduce((sum, result) => sum + Number(result.run.capacityCull?.selectedLastMatureOfLineage || 0), 0),
    totalExactPackSexualAttempts: results.reduce((sum, result) => sum + Number(result.run.packReproductionBottleneck?.sexualAttempts || 0), 0),
    totalExactPackAsexualAttempts: results.reduce((sum, result) => sum + Number(result.run.packReproductionBottleneck?.asexualAttempts || 0), 0),
    totalExactPackSameLineageMateAttempts: results.reduce((sum, result) => sum + Number(result.run.packReproductionBottleneck?.sameLineageMateAttempts || 0), 0),
    totalExactPackLegacyMateAttempts: results.reduce((sum, result) => sum + Number(result.run.packReproductionBottleneck?.legacyMateAttempts || 0), 0),
    seedsWithExactPackSameLineageMating: results
      .filter(result => Number(result.run.packReproductionBottleneck?.sameLineageMateAttempts || 0) > 0)
      .map(result => result.seed),
    totalLaterInheritedBirths: packRows.reduce((sum, pack) => sum + Math.max(0, Number(pack.birthsIntoPack || 0) - 1), 0),
    packsWithRepeatedInheritedBirths: packRows.filter(pack => Number(pack.birthsIntoPack || 0) > 1).length,
    totalActivePackCount: results.reduce((sum, result) => sum + Number(result.activePackCount || 0), 0),
    totalPackMembers: results.reduce((sum, result) => sum + Number(result.packMemberLifecycle?.memberCount || 0), 0),
    totalBornPackMembers: results.reduce((sum, result) => sum + Number(result.packMemberLifecycle?.bornMembers || 0), 0),
    totalBornPackMemberDeaths: results.reduce((sum, result) => sum + Number(result.packMemberLifecycle?.bornDeaths || 0), 0),
    totalBornPackMembersMaturedBeforeDeath: results.reduce((sum, result) => sum + Number(result.packMemberLifecycle?.bornMaturedBeforeDeath || 0), 0),
    totalBornPackMembersReproduced: results.reduce((sum, result) => sum + Number(result.packMemberLifecycle?.bornReproduced || 0), 0),
    totalBornPackMembersWithPredationSuccess: results.reduce((sum, result) => sum + Number(result.packMemberLifecycle?.bornPredationSuccess || 0), 0),
    totalPackSpatialSamples: results.reduce((sum, result) => sum + Number(result.packMemberLifecycle?.spatialSampleCount || 0), 0),
    totalPackPairObservations: totalPairObservations,
    totalPackMatureOverlapSamples: spatialPackRows.reduce((sum, pack) => sum + Number(pack.matureOverlapSamples || 0), 0),
    totalPackReproductionReadyOverlapSamples: spatialPackRows.reduce((sum, pack) => sum + Number(pack.reproductionReadyOverlapSamples || 0), 0),
    packPairsWithinMutualSocialRangeRate: totalPairObservations
      ? spatialPackRows.reduce((sum, pack) => sum + Number(pack.withinMutualSocialRangePairs || 0), 0) / totalPairObservations
      : null,
    packPairsWithinHelperRadiusRate: totalPairObservations
      ? spatialPackRows.reduce((sum, pack) => sum + Number(pack.withinHelperRadiusPairs || 0), 0) / totalPairObservations
      : null,
    parentChildPairsWithinMutualSocialRangeRate: totalParentChildPairObservations
      ? spatialPackRows.reduce((sum, pack) => sum + Number(pack.parentChildWithinMutualSocialRange || 0), 0) / totalParentChildPairObservations
      : null,
    parentChildPairsWithinHelperRadiusRate: totalParentChildPairObservations
      ? spatialPackRows.reduce((sum, pack) => sum + Number(pack.parentChildWithinHelperRadius || 0), 0) / totalParentChildPairObservations
      : null,
    maximumPackSizeEver: maxSizes.length ? Math.max(...maxSizes) : 0,
    maximumPackGenerationDepth:packMemberRows.reduce((max,member)=>Math.max(max,Number(member.generationDepth||0)),0),
    averageMaximumPackSize: average(maxSizes),
    packsAtLeast3Count: packRows.filter(pack => Number(pack.maximumLivingMembers || 0) >= 3).length,
    seedsWithPackAtLeast3: results.filter(result => result.maxPackSizeEver >= 3).map(result => result.seed),
    lineageMismatchMembers: results.reduce((sum, result) => sum + result.lineageMismatchMembers, 0),
    mixedLineagePacks: results.reduce((sum, result) => sum + result.mixedLineagePacks, 0),
    missingRecordIdentityPacks: results.reduce((sum, result) => sum + result.missingRecordIdentityPacks, 0),
    energyCreationEvents: results.reduce((sum, result) => sum + result.energyCreationEvents, 0),
    nutrientCreationEvents: results.reduce((sum, result) => sum + result.nutrientCreationEvents, 0),
    badNumberCount: results.reduce((sum, result) => sum + result.badNumberCount, 0),
    roundTripOk: results.every(result => result.roundTrip?.ok === true),
    packRows,
    spatialPackRows
  };
}

function markdownReport(data) {
  const lines = [];
  lines.push('# Pack Family Growth Diagnostic');
  lines.push('');
  lines.push(`- seeds: ${data.aggregate.seeds.join(', ')}`);
  lines.push(`- steps: ${data.aggregate.steps}`);
  lines.push(`- variant: ${data.variant}`);
  lines.push(`- shareFraction: ${data.shareFraction}`);
  lines.push(`- targetConsensus: ${data.targetConsensus}`);
  lines.push(`- packAttackBase: ${data.packAttackBase}`);
  lines.push(`- lineageAwarePackIdentity: ${data.lineageAwarePackIdentity}`);
  lines.push(`- maximumPackSizeEver: ${data.aggregate.maximumPackSizeEver}`);
  lines.push(`- maximumPackGenerationDepth: ${data.aggregate.maximumPackGenerationDepth}`);
  lines.push(`- seedsWithPackAtLeast3: ${data.aggregate.seedsWithPackAtLeast3.join(', ') || 'none'}`);
  lines.push(`- totalPacksCreated: ${data.aggregate.totalPacksCreated}`);
  lines.push(`- totalPackJoins: ${data.aggregate.totalPackJoins}`);
  lines.push(`- totalPackInheritedBirths: ${data.aggregate.totalPackInheritedBirths}`);
  lines.push(`- totalLineageFamilyNeighborJoins: ${data.aggregate.totalLineageFamilyNeighborJoins}`);
  lines.push(`- totalFamilyNeighborScanCalls: ${data.aggregate.totalFamilyNeighborScanCalls}`);
  lines.push(`- totalFamilyNeighborSameLineageUnassigned: ${data.aggregate.totalFamilyNeighborSameLineageUnassigned}`);
  lines.push(`- totalFamilyNeighborSameLineageEligible: ${data.aggregate.totalFamilyNeighborSameLineageEligible}`);
  lines.push(`- totalFamilyNeighborSameLineageIneligible: ${data.aggregate.totalFamilyNeighborSameLineageIneligible}`);
  lines.push(`- totalFamilyNeighborNearEligible: ${data.aggregate.totalFamilyNeighborNearEligible}`);
  lines.push(`- totalFamilyNeighborNearIneligible: ${data.aggregate.totalFamilyNeighborNearIneligible}`);
  lines.push(`- totalLifetimeOpportunitySamples: ${data.aggregate.totalLifetimeOpportunitySamples}`);
  lines.push(`- totalLifetimeSameLineageUnassignedEligible: ${data.aggregate.totalLifetimeSameLineageUnassignedEligible}`);
  lines.push(`- totalLifetimeNearUnassignedEligible: ${data.aggregate.totalLifetimeNearUnassignedEligible}`);
  lines.push(`- totalLifetimeSameLineageUnassignedIneligible: ${data.aggregate.totalLifetimeSameLineageUnassignedIneligible}`);
  lines.push(`- totalLifetimeNearUnassignedIneligible: ${data.aggregate.totalLifetimeNearUnassignedIneligible}`);
  lines.push(`- totalLifetimeSameLineageOtherPack: ${data.aggregate.totalLifetimeSameLineageOtherPack}`);
  lines.push(`- totalLifetimeNearOtherPack: ${data.aggregate.totalLifetimeNearOtherPack}`);
  lines.push(`- totalFamilyReproductionEvents: ${data.aggregate.totalFamilyReproductionEvents}`);
  lines.push(`- totalFamilyMultiClutchEvents: ${data.aggregate.totalFamilyMultiClutchEvents}`);
  lines.push(`- totalFamilyMultiClutchChildren: ${data.aggregate.totalFamilyMultiClutchChildren}`);
  lines.push(`- totalInheritedClutchEvents: ${data.aggregate.totalInheritedClutchEvents}`);
  lines.push(`- totalOverflowFeedingEvents: ${data.aggregate.totalOverflowFeedingEvents}`);
  lines.push(`- totalOverflowEnergyTransferred: ${data.aggregate.totalOverflowEnergyTransferred}`);
  lines.push(`- totalOverflowNutrientTransferred: ${data.aggregate.totalOverflowNutrientTransferred}`);
  lines.push(`- totalOverflowRecipients: ${data.aggregate.totalOverflowRecipients}`);
  lines.push(`- totalSurplusFeedingEvents: ${data.aggregate.totalSurplusFeedingEvents}`);
  lines.push(`- totalSurplusEnergyTransferred: ${data.aggregate.totalSurplusEnergyTransferred}`);
  lines.push(`- totalSurplusRecipients: ${data.aggregate.totalSurplusRecipients}`);
  lines.push(`- totalCapacityCullEvents: ${data.aggregate.totalCapacityCullEvents}`);
  lines.push(`- totalCapacityCullDeaths: ${data.aggregate.totalCapacityCullDeaths}`);
  lines.push(`- totalCarnivoreCapacityCullDeaths: ${data.aggregate.totalCarnivoreCapacityCullDeaths}`);
  lines.push(`- totalActivePackMemberCapacityCullDeaths: ${data.aggregate.totalActivePackMemberCapacityCullDeaths}`);
  lines.push(`- totalPackBornCapacityCullDeaths: ${data.aggregate.totalPackBornCapacityCullDeaths}`);
  lines.push(`- totalLastMatureDietCapacityCullDeaths: ${data.aggregate.totalLastMatureDietCapacityCullDeaths}`);
  lines.push(`- totalLastMatureLineageCapacityCullDeaths: ${data.aggregate.totalLastMatureLineageCapacityCullDeaths}`);
  lines.push(`- totalExactPackSexualAttempts: ${data.aggregate.totalExactPackSexualAttempts}`);
  lines.push(`- totalExactPackAsexualAttempts: ${data.aggregate.totalExactPackAsexualAttempts}`);
  lines.push(`- totalExactPackSameLineageMateAttempts: ${data.aggregate.totalExactPackSameLineageMateAttempts}`);
  lines.push(`- totalExactPackLegacyMateAttempts: ${data.aggregate.totalExactPackLegacyMateAttempts}`);
  lines.push(`- seedsWithExactPackSameLineageMating: ${data.aggregate.seedsWithExactPackSameLineageMating.join(', ') || 'none'}`);
  lines.push(`- totalLaterInheritedBirths: ${data.aggregate.totalLaterInheritedBirths}`);
  lines.push(`- packsWithRepeatedInheritedBirths: ${data.aggregate.packsWithRepeatedInheritedBirths}`);
  lines.push(`- totalActivePackCount: ${data.aggregate.totalActivePackCount}`);
  lines.push(`- totalBornPackMembers: ${data.aggregate.totalBornPackMembers}`);
  lines.push(`- totalBornPackMemberDeaths: ${data.aggregate.totalBornPackMemberDeaths}`);
  lines.push(`- totalBornPackMembersMaturedBeforeDeath: ${data.aggregate.totalBornPackMembersMaturedBeforeDeath}`);
  lines.push(`- totalBornPackMembersReproduced: ${data.aggregate.totalBornPackMembersReproduced}`);
  lines.push(`- totalBornPackMembersWithPredationSuccess: ${data.aggregate.totalBornPackMembersWithPredationSuccess}`);
  lines.push(`- totalPackSpatialSamples: ${data.aggregate.totalPackSpatialSamples}`);
  lines.push(`- totalPackPairObservations: ${data.aggregate.totalPackPairObservations}`);
  lines.push(`- totalPackMatureOverlapSamples: ${data.aggregate.totalPackMatureOverlapSamples}`);
  lines.push(`- totalPackReproductionReadyOverlapSamples: ${data.aggregate.totalPackReproductionReadyOverlapSamples}`);
  lines.push(`- packPairsWithinMutualSocialRangeRate: ${data.aggregate.packPairsWithinMutualSocialRangeRate}`);
  lines.push(`- packPairsWithinHelperRadiusRate: ${data.aggregate.packPairsWithinHelperRadiusRate}`);
  lines.push(`- parentChildPairsWithinMutualSocialRangeRate: ${data.aggregate.parentChildPairsWithinMutualSocialRangeRate}`);
  lines.push(`- parentChildPairsWithinHelperRadiusRate: ${data.aggregate.parentChildPairsWithinHelperRadiusRate}`);
  lines.push(`- invariants: lineageMismatch=${data.aggregate.lineageMismatchMembers}, mixedLineage=${data.aggregate.mixedLineagePacks}, missingIdentity=${data.aggregate.missingRecordIdentityPacks}`);
  lines.push(`- conservation: energyCreation=${data.aggregate.energyCreationEvents}, nutrientCreation=${data.aggregate.nutrientCreationEvents}`);
  lines.push(`- badNumbers: ${data.aggregate.badNumberCount}`);
  lines.push(`- roundTripOk: ${data.aggregate.roundTripOk}`);
  lines.push('');
  lines.push('| seed | packsCreated | maxPackSizeEver | joins | inheritedBirths | laterInheritedBirths | familyNeighborJoins | sameLineageEligible | nearEligible | familyMultiClutch | inheritedClutchEvents | activePacks | mismatch | mixed | missingIdentity | energyCreate | nutrientCreate | badNumbers | roundTrip |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
  for (const result of data.results) {
    const laterInheritedBirths = result.packs.reduce((sum, pack) => sum + Math.max(0, Number(pack.birthsIntoPack || 0) - 1), 0);
    lines.push([
      result.seed,
      Number(result.packSummary.packsCreated || 0),
      result.maxPackSizeEver,
      Number(result.packSummary.joins || 0),
      Number(result.packSummary.parentInheritedBirths || 0),
      laterInheritedBirths,
      Number(result.packSummary.lineageFamilyNeighborJoins || 0),
      Number(result.packSummary.familyNeighborSameLineageEligible || 0),
      Number(result.packSummary.familyNeighborNearEligible || 0),
      Number(result.packSummary.familyMultiClutchEvents || 0),
      Number(result.packSummary.inheritedClutchEvents || 0),
      result.activePackCount,
      result.lineageMismatchMembers,
      result.mixedLineagePacks,
      result.missingRecordIdentityPacks,
      result.energyCreationEvents,
      result.nutrientCreationEvents,
      result.badNumberCount,
      result.roundTrip?.ok === true ? 'ok' : 'fail'
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }
  lines.push('');
  lines.push('## Pack Rows');
  lines.push('');
  lines.push('| seed | packId | lineageId | createdFrame | dissolvedFrame | maxMembers | totalEver | joins | birthsIntoPack | leaves | deaths | activeMembers |');
  lines.push('| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const pack of data.aggregate.packRows) {
    lines.push(`| ${pack.seed} | ${pack.id} | ${pack.lineageId || ''} | ${pack.createdFrame} | ${pack.dissolvedFrame ?? ''} | ${pack.maximumLivingMembers} | ${pack.totalMembersEver} | ${pack.joins} | ${pack.birthsIntoPack} | ${pack.leaves} | ${pack.deaths} | ${pack.currentLivingMembers} |`);
  }
  lines.push('');
  lines.push('## Active Pack Spatial Cohesion');
  lines.push('');
  lines.push('| seed | packId | samples | multiMember | matureOverlap | reproductionReadyOverlap | pairObservations | avgDistance | socialRangeRate | helperRadiusRate | sameTargetPairs | differentTargetPairs | parentChildPairs | parentChildSocialRate | parentChildHelperRate |');
  lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const pack of data.aggregate.spatialPackRows) {
    lines.push(`| ${pack.seed} | ${pack.packId} | ${pack.samples} | ${pack.multiMemberSamples} | ${pack.matureOverlapSamples} | ${pack.reproductionReadyOverlapSamples} | ${pack.pairObservations} | ${pack.averageDistance ?? ''} | ${pack.withinMutualSocialRangeRate ?? ''} | ${pack.withinHelperRadiusRate ?? ''} | ${pack.sameTargetPairs} | ${pack.differentTargetPairs} | ${pack.parentChildPairObservations} | ${pack.parentChildWithinMutualSocialRangeRate ?? ''} | ${pack.parentChildWithinHelperRadiusRate ?? ''} |`);
  }
  lines.push('');
  lines.push('## Pack Member Lifecycle');
  lines.push('');
  lines.push('| seed | packId | organismId | founder | born | joinFrame | joinReason | birthEnergy | minimumBirthEnergy | maturityAge | deathFrame | deathCause | ageAtDeath | matured | validPrey | targets | chases | contacts | attacks | predationSuccess | reproducedFrame |');
  lines.push('| --- | --- | ---: | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const result of data.results) {
    for (const member of result.packMemberLifecycle?.members || []) {
      lines.push(`| ${result.seed} | ${member.packId} | ${member.organismId} | ${member.founder ? 'yes' : 'no'} | ${member.born ? 'yes' : 'no'} | ${member.joinFrame ?? ''} | ${member.joinReason ?? ''} | ${member.birthEnergy ?? ''} | ${member.minimumViableBirthEnergy ?? ''} | ${member.maturityAge ?? ''} | ${member.deathFrame ?? ''} | ${member.deathCause ?? ''} | ${member.ageAtDeath ?? ''} | ${member.reachedMaturity ? 'yes' : 'no'} | ${member.validPreySenseCount ?? ''} | ${member.targetCount ?? ''} | ${member.chaseCount ?? ''} | ${member.contactCount ?? ''} | ${member.attackCount ?? ''} | ${member.predationSuccessCount ?? ''} | ${member.reproducedFrame ?? ''} |`);
    }
  }
  return lines.join('\n') + '\n';
}

async function bootPage(browser, initSeed = null) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  if (initSeed != null) {
    await page.addInitScript(seed => {
      let state = (Number(seed) || 1) >>> 0;
      if (state === 0) state = 1;
      Math.random = function seededDiagnosticRandom() {
        state = (state + 0x6D2B79F5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
      };
    }, initSeed);
  }
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror:${error.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console:${msg.text()}`);
  });
  const url = 'file:///' + path.resolve(htmlFile).replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__alifeDebug?.runSeededWorldDiagnostic, null, { timeout: 15000 });
  return { page, errors, url };
}

async function runSeed(browser, seed) {
  const boot = await bootPage(browser, seed);
  try {
    const payload = await boot.page.evaluate(({ seed, steps, shareFraction, targetConsensus, packAttackBase, variant, lineageAwarePackIdentity, includeModelState }) => {
      const flags = {
        evolvableLifeHistory: true,
        juvenileDevelopment: true,
        predictiveHuntingReserve: true,
        persistentPackIdentity: true,
        speciesIdentityV2: true,
        canonicalSpeciesAppearance: true,
        persistentLineageRegistry: true,
        provisionalLineageClassification: true,
        lineageAwareMateSelection: true,
        lineageReproductiveIsolation: false,
        lineageAwarePackIdentity,
        eventKeyedVisualRng: true
      };
      const d = window.__alifeDebug;
      const run = d.runSeededWorldDiagnostic({
        seed,
        steps,
        restoreAfterRun: false,
        variant,
        shareFraction,
        targetConsensus,
        packAttackBase,
        packHuntTelemetry: true,
        includeLineageRegistryState: true,
        includeModelState,
        ...flags
      });
      d.setPersistentLineageRegistry(true);
      d.setProvisionalLineageClassification(true);
      d.setPersistentPackIdentity(true);
      d.setLineageAwarePackIdentity(lineageAwarePackIdentity);
      const packState = d.capturePackIdentityState();
      const packSummary = d.packIdentitySummary();
      const packMemberLifecycle = d.packMemberLifecycleSummary?.() || {
        eventCount:0,
        packCount:0,
        memberCount:0,
        bornMembers:0,
        bornDeaths:0,
        bornMaturedBeforeDeath:0,
        bornReproduced:0,
        bornPredationSuccess:0,
        deathCauses:{},
        packs:[],
        members:[],
        events:[]
      };
      const juvenileDevelopment = d.juvenileDevelopmentSummary();
      const roundTrip = d.roundTripSave();
      const packStateAfterRoundTrip = d.capturePackIdentityState();
      return { run, packState, packSummary, packMemberLifecycle, juvenileDevelopment, roundTrip, packStateAfterRoundTrip };
    }, { seed, steps, shareFraction, targetConsensus, packAttackBase, variant, lineageAwarePackIdentity, includeModelState });
    return { ...compactRun(seed, payload), browserErrors: boot.errors };
  } finally {
    await boot.page.close();
  }
}

async function runMicros(browser) {
  const boot = await bootPage(browser);
  try {
    return {
      ...(await boot.page.evaluate(() => ({
        speciesIdentityV2: window.__alifeDebug.runSpeciesIdentityV2MicroTests(),
        canonicalAppearance: window.__alifeDebug.runCanonicalSpeciesAppearanceMicroTests(),
        persistentLineage: window.__alifeDebug.runPersistentLineageRegistryMicroTests(),
        provisionalLineage: window.__alifeDebug.runProvisionalLineageClassificationMicroTests(),
        lineageAwareMateSelection: window.__alifeDebug.runLineageAwareMateSelectionMicroTests(),
        eventKeyedVisualRng: window.__alifeDebug.runEventKeyedVisualRngMicroTests(),
        juvenileDevelopment: window.__alifeDebug.runJuvenileDevelopmentMicroTests(),
        persistentPackIdentity: window.__alifeDebug.runPersistentPackIdentityMicroTests(),
        lineageAwarePackIdentity: window.__alifeDebug.runLineageAwarePackIdentityMicroTests(),
        packReproductionBottleneck: window.__alifeDebug.runPackReproductionBottleneckMicroTests(),
        roundTrip: window.__alifeDebug.roundTripSave()
      }))),
      browserErrors: boot.errors
    };
  } finally {
    await boot.page.close();
  }
}

const requiredMicroKeys = [
  'speciesIdentityV2',
  'canonicalAppearance',
  'persistentLineage',
  'provisionalLineage',
  'lineageAwareMateSelection',
  'eventKeyedVisualRng',
  'juvenileDevelopment',
  'persistentPackIdentity',
  'lineageAwarePackIdentity',
  'packReproductionBottleneck',
  'roundTrip'
];

function requiredMicrosPassed(micro) {
  return requiredMicroKeys.every(key => micro[key]?.ok === true);
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const micro = await runMicros(browser);
    const results = [];
    for (const seed of seeds) {
      results.push(await runSeed(browser, seed));
    }
    const data = {
      generatedAt: new Date().toISOString(),
      htmlFile,
      seeds,
      steps,
      variant,
      shareFraction,
      targetConsensus,
      packAttackBase,
      lineageAwarePackIdentity,
      includeModelState,
      micro,
      results,
      aggregate: aggregate(results)
    };
    fs.writeFileSync(outputJson, JSON.stringify(data, null, 2), 'utf8');
    fs.writeFileSync(outputMarkdown, markdownReport(data), 'utf8');
    console.log(JSON.stringify({
      outputJson,
      outputMarkdown,
      microOk: requiredMicrosPassed(micro),
      aggregate: data.aggregate
    }, null, 2));
    const ok = requiredMicrosPassed(micro)
      && data.aggregate.maximumPackSizeEver >= 3
      && data.aggregate.totalPackInheritedBirths > 0
      && (data.aggregate.totalLineageFamilyNeighborJoins > 0
        || data.aggregate.totalInheritedClutchEvents > 0
        || data.aggregate.totalLaterInheritedBirths > 0)
      && data.aggregate.lineageMismatchMembers === 0
      && data.aggregate.mixedLineagePacks === 0
      && data.aggregate.missingRecordIdentityPacks === 0
      && data.aggregate.energyCreationEvents === 0
      && data.aggregate.nutrientCreationEvents === 0
      && data.aggregate.badNumberCount === 0
      && data.aggregate.roundTripOk;
    if (!ok) process.exit(1);
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
