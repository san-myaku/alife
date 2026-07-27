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
    totalLaterInheritedBirths: packRows.reduce((sum, pack) => sum + Math.max(0, Number(pack.birthsIntoPack || 0) - 1), 0),
    packsWithRepeatedInheritedBirths: packRows.filter(pack => Number(pack.birthsIntoPack || 0) > 1).length,
    totalActivePackCount: results.reduce((sum, result) => sum + Number(result.activePackCount || 0), 0),
    maximumPackSizeEver: maxSizes.length ? Math.max(...maxSizes) : 0,
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
    packRows
  };
}

function markdownReport(data) {
  const lines = [];
  lines.push('# Pack Family Growth Diagnostic');
  lines.push('');
  lines.push(`- seeds: ${data.aggregate.seeds.join(', ')}`);
  lines.push(`- steps: ${data.aggregate.steps}`);
  lines.push(`- maximumPackSizeEver: ${data.aggregate.maximumPackSizeEver}`);
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
  lines.push(`- totalLaterInheritedBirths: ${data.aggregate.totalLaterInheritedBirths}`);
  lines.push(`- packsWithRepeatedInheritedBirths: ${data.aggregate.packsWithRepeatedInheritedBirths}`);
  lines.push(`- totalActivePackCount: ${data.aggregate.totalActivePackCount}`);
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
    const payload = await boot.page.evaluate(({ seed, steps }) => {
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
        lineageAwarePackIdentity: true,
        eventKeyedVisualRng: true
      };
      const d = window.__alifeDebug;
      const run = d.runSeededWorldDiagnostic({
        seed,
        steps,
        restoreAfterRun: false,
        variant: 'pack-family-growth',
        shareFraction: 0,
        targetConsensus: false,
        packAttackBase: 0.78,
        packHuntTelemetry: true,
        ...flags
      });
      d.setPersistentLineageRegistry(true);
      d.setProvisionalLineageClassification(true);
      d.setPersistentPackIdentity(true);
      d.setLineageAwarePackIdentity(true);
      const packState = d.capturePackIdentityState();
      const packSummary = d.packIdentitySummary();
      const roundTrip = d.roundTripSave();
      const packStateAfterRoundTrip = d.capturePackIdentityState();
      return { run, packState, packSummary, roundTrip, packStateAfterRoundTrip };
    }, { seed, steps });
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
      micro,
      results,
      aggregate: aggregate(results)
    };
    fs.writeFileSync(outputJson, JSON.stringify(data, null, 2), 'utf8');
    fs.writeFileSync(outputMarkdown, markdownReport(data), 'utf8');
    console.log(JSON.stringify({
      outputJson,
      outputMarkdown,
      microOk: micro.lineageAwarePackIdentity?.ok === true && micro.packReproductionBottleneck?.ok === true && micro.roundTrip?.ok === true,
      aggregate: data.aggregate
    }, null, 2));
    const ok = micro.lineageAwarePackIdentity?.ok === true
      && micro.packReproductionBottleneck?.ok === true
      && micro.roundTrip?.ok === true
      && data.aggregate.maximumPackSizeEver >= 3
      && data.aggregate.totalPackInheritedBirths > 0
      && (data.aggregate.totalLineageFamilyNeighborJoins > 0 || data.aggregate.totalInheritedClutchEvents > 0)
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
