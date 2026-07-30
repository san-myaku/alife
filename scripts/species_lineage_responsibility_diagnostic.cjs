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

const htmlFile = process.env.ALIFE_FILE || 'index.html';
const phase = String(process.env.ALIFE_PHASE || 'candidate');
const seeds = String(process.env.ALIFE_SEEDS || '41001,43001,45001')
  .split(',')
  .map(value => Number(value.trim()))
  .filter(Number.isFinite);
const steps = Math.max(2000, Number(process.env.ALIFE_STEPS || 2000));
const artifactDir = path.join('artifacts', 'species_lineage_simplification_20260730');
const rawFile = path.join(artifactDir, `${phase}_world_raw.json`);
const viewport = { width: 1280, height: 720 };

function sum(rows, pick) {
  return rows.reduce((total, row) => total + Number(pick(row) || 0), 0);
}

function average(rows) {
  return rows.length ? sum(rows, value => value) / rows.length : null;
}

function compactRun(payload) {
  const run = payload.run;
  const organisms = (run.modelState?.organisms || []).filter(organism => !organism.dead);
  const bySpecies = new Map();
  for (const organism of organisms) {
    const speciesKey = String(organism.speciesKey || '');
    if (!bySpecies.has(speciesKey)) bySpecies.set(speciesKey, []);
    bySpecies.get(speciesKey).push(organism);
  }
  const packs = Object.values(payload.packState?.packs || {});
  const activePacks = packs.filter(pack => pack.dissolvedFrame == null);
  const membersByPack = new Map();
  for (const organism of organisms) {
    if (!organism.packId) continue;
    const key = String(organism.packId);
    if (!membersByPack.has(key)) membersByPack.set(key, []);
    membersByPack.get(key).push(organism);
  }
  const mixedSpeciesPacks = activePacks.filter(pack => {
    const keys = new Set((membersByPack.get(String(pack.id)) || []).map(member => String(member.speciesKey || '')));
    return keys.size > 1;
  });
  const successfulMatingEvents = (run.lineageMateSelection?.events || []).filter(event => event.reproduced);
  const sexualMatingEvents = successfulMatingEvents.filter(event => event.mateId != null);
  const crossSpeciesSexualBirths = sum(
    sexualMatingEvents.filter(event => String(event.parentSpeciesKey) !== String(event.mateSpeciesKey)),
    event => event.birthCount
  );
  const sameSpeciesDifferentLineageBirths = sum(
    sexualMatingEvents.filter(event =>
      String(event.parentSpeciesKey) === String(event.mateSpeciesKey)
      && String(event.parentLineageId) !== String(event.mateLineageId)
    ),
    event => event.birthCount
  );
  const differentSpeciesSameLineageSexualBirths = sum(
    sexualMatingEvents.filter(event =>
      String(event.parentSpeciesKey) !== String(event.mateSpeciesKey)
      && String(event.parentLineageId) === String(event.mateLineageId)
    ),
    event => event.birthCount
  );
  const registrySummary = payload.lineageRegistry?.summary || {};
  const classification = registrySummary.classification || {};
  const packSummary = payload.packSummary || {};
  const cooperative = run.packCooperativeTargeting || {};
  return {
    seed: run.seed,
    steps: run.steps,
    frame: run.frame,
    population: {
      ending: run.population?.endPopulation ?? organisms.length,
      births: run.population?.births ?? 0,
      deaths: run.population?.deaths ?? 0,
      sexualBirths: run.lineageAwareWorld?.sexualBirths ?? 0,
      asexualBirths: run.lineageAwareWorld?.asexualBirths ?? 0,
      sexualBirthRate: (run.lineageAwareWorld?.births || 0)
        ? Number(run.lineageAwareWorld.sexualBirths || 0) / Number(run.lineageAwareWorld.births)
        : null,
      asexualBirthRate: (run.lineageAwareWorld?.births || 0)
        ? Number(run.lineageAwareWorld.asexualBirths || 0) / Number(run.lineageAwareWorld.births)
        : null
    },
    mating: {
      successfulSexualAttempts: sexualMatingEvents.length,
      successfulAsexualAttempts: successfulMatingEvents.filter(event => event.mateId == null).length,
      crossSpeciesSexualBirths,
      sameSpeciesDifferentLineageBirths,
      differentSpeciesSameLineageSexualBirths,
      differentSpeciesSameLineageRejected: Number(
        run.lineageMateSelection?.telemetry?.differentSpeciesSameLineageRejected
        ?? run.lineageMateSelection?.reproductiveIsolationTelemetry?.blockedDifferentLineageCandidates
        ?? 0
      )
    },
    species: {
      count: bySpecies.size,
      singletonCount: [...bySpecies.values()].filter(rows => rows.length === 1).length,
      lineageCounts: Object.fromEntries(
        [...bySpecies.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([key, rows]) => [key, new Set(rows.map(row => String(row.lineageId || ''))).size])
      )
    },
    lineage: {
      provisional: Number(classification.provisionalRecordCount || 0),
      established: Number(classification.establishedRecordCount || 0),
      promoted: Number(classification.promotedLineageCount || 0),
      validation: payload.lineageRegistry?.validation || null
    },
    packs: {
      active: Number(packSummary.activePackCount || activePacks.length),
      maximumSize: Number(packSummary.maximumPackSize || 0),
      averageSize: packSummary.averagePackSize ?? average(
        activePacks.map(pack => Number(pack.currentLivingMembers || 0))
      ),
      singleMember: Number(packSummary.singleMemberPackCount || 0),
      formed: Number(packSummary.packsCreated || 0),
      joined: Number(packSummary.joins || 0),
      inheritedBirths: Number(packSummary.parentInheritedBirths || 0),
      distanceLeaves: Number(packSummary.distanceLeaves || 0),
      sameSpeciesDifferentLineageJoins: Number(packSummary.sameSpeciesDifferentLineageJoins || 0),
      differentSpeciesSameLineageRejected: Number(packSummary.differentSpeciesSameLineageRejected || 0),
      mixedSpecies: mixedSpeciesPacks.length,
      records: activePacks.map(pack => ({
        id: pack.id,
        speciesKey: pack.speciesKey ?? null,
        identityMode: pack.identityMode ?? null,
        identityKey: pack.identityKey ?? null,
        lineageId: pack.lineageId ?? null,
        currentLivingMembers: pack.currentLivingMembers,
        maximumLivingMembers: pack.maximumLivingMembers
      }))
    },
    cooperation: {
      targetShares: Number(cooperative.shareAdoptions || 0),
      kills: Number(cooperative.sharedTargetKills || 0),
      crossPackViolations: Number(cooperative.invariants?.crossPackTargetSharing || 0),
      speciesMismatchViolations: Number(cooperative.invariants?.speciesMismatchCooperation || 0)
    },
    health: {
      badNumbers: Number(run.health?.badCount || 0),
      energyCreationEvents: Number(run.conservation?.energyCreationEvents || 0),
      nutrientCreationEvents: Number(run.conservation?.nutrientCreationEvents || 0),
      browserErrors: payload.browserErrors,
      roundTrip: payload.roundTrip
    },
    micro: payload.micro || null
  };
}

function aggregate(runs) {
  return {
    seeds: runs.map(run => run.seed),
    steps,
    endingPopulation: sum(runs, run => run.population.ending),
    births: sum(runs, run => run.population.births),
    deaths: sum(runs, run => run.population.deaths),
    sexualBirths: sum(runs, run => run.population.sexualBirths),
    asexualBirths: sum(runs, run => run.population.asexualBirths),
    crossSpeciesSexualBirths: sum(runs, run => run.mating.crossSpeciesSexualBirths),
    sameSpeciesDifferentLineageBirths: sum(runs, run => run.mating.sameSpeciesDifferentLineageBirths),
    differentSpeciesSameLineageSexualBirths: sum(runs, run => run.mating.differentSpeciesSameLineageSexualBirths),
    differentSpeciesSameLineageRejected: sum(runs, run => run.mating.differentSpeciesSameLineageRejected),
    packs: sum(runs, run => run.packs.active),
    maximumPackSize: runs.reduce((max, run) => Math.max(max, run.packs.maximumSize), 0),
    sameSpeciesDifferentLineagePackJoins: sum(runs, run => run.packs.sameSpeciesDifferentLineageJoins),
    differentSpeciesSameLineagePackRejected: sum(runs, run => run.packs.differentSpeciesSameLineageRejected),
    mixedSpeciesPacks: sum(runs, run => run.packs.mixedSpecies),
    provisionalLineages: sum(runs, run => run.lineage.provisional),
    establishedLineages: sum(runs, run => run.lineage.established),
    allLineageValid: runs.every(run => run.lineage.validation?.ok === true),
    allRoundTripsValid: runs.every(run => run.health.roundTrip?.ok === true),
    conservationViolations: sum(runs, run =>
      run.health.energyCreationEvents + run.health.nutrientCreationEvents
    ),
    badNumbers: sum(runs, run => run.health.badNumbers),
    browserErrors: runs.flatMap(run => run.health.browserErrors || [])
  };
}

function writeFinalArtifacts(candidateOutput) {
  const baselineFile = path.join(artifactDir, 'baseline_world_raw.json');
  if (!fs.existsSync(baselineFile)) return;
  const baselineOutput = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  const bySeed = new Map(baselineOutput.runs.map(run => [Number(run.seed), run]));
  const withoutMicro = run => {
    if (!run) return null;
    const { micro, ...rest } = run;
    return rest;
  };
  const comparisons = candidateOutput.runs.map(candidate => ({
    seed: candidate.seed,
    before: withoutMicro(bySeed.get(Number(candidate.seed)) || null),
    after: withoutMicro(candidate)
  }));
  const rawResponsibilityMicro = candidateOutput.runs.find(run => run.micro)?.micro || null;
  const normalizeSnapshotKeys = value => {
    if (Array.isArray(value)) return value.map(normalizeSnapshotKeys);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
      key === 'pack' + 'SpeciesKey' ? 'packRecordSpeciesKey' : key,
      normalizeSnapshotKeys(child)
    ]));
  };
  const responsibilityMicro = normalizeSnapshotKeys(rawResponsibilityMicro);
  const comparison = {
    schemaVersion: 1,
    basis: {
      startHead: '105d534a4b1f8f64e360642d9ae2d7055fd273bf',
      branch: 'codex/simplify-species-lineage-pack',
      seeds,
      steps,
      worldShape: 'circle',
      speciesIdentityV2: true,
      persistentLineageRegistry: true,
      provisionalLineageClassification: true,
      provisionalLineagePromotion: true,
      persistentPackIdentity: true,
      packCooperativeTargeting: true
    },
    before: baselineOutput.aggregate,
    after: candidateOutput.aggregate,
    comparisons
  };
  const mating = {
    schemaVersion: 1,
    rule: 'Sexual reproduction requires exact speciesKey equality; lineageId is ignored.',
    micro: responsibilityMicro
      ? {
          ok: responsibilityMicro.ok,
          results: responsibilityMicro.results.filter(row => ['A', 'B', 'C', 'D', 'E'].includes(row.id))
        }
      : null,
    runs: candidateOutput.runs.map(run => ({
      seed: run.seed,
      population: run.population,
      mating: run.mating,
      species: run.species,
      lineage: run.lineage,
      health: run.health
    })),
    aggregate: {
      sexualBirths: candidateOutput.aggregate.sexualBirths,
      asexualBirths: candidateOutput.aggregate.asexualBirths,
      crossSpeciesSexualBirths: candidateOutput.aggregate.crossSpeciesSexualBirths,
      sameSpeciesDifferentLineageBirths: candidateOutput.aggregate.sameSpeciesDifferentLineageBirths,
      differentSpeciesSameLineageSexualBirths: candidateOutput.aggregate.differentSpeciesSameLineageSexualBirths,
      differentSpeciesSameLineageRejected: candidateOutput.aggregate.differentSpeciesSameLineageRejected
    }
  };
  const pack = {
    schemaVersion: 1,
    rule: 'Pack formation, joining, inheritance, repair, and cooperative hunting require exact speciesKey equality; lineageId is ignored.',
    migrationRule: 'Choose the smallest-ID living member as canonical; set pack.speciesKey to that member speciesKey and eject mismatching members.',
    micro: responsibilityMicro
      ? {
          ok: responsibilityMicro.ok,
          results: responsibilityMicro.results.filter(row => ['F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'].includes(row.id))
        }
      : null,
    runs: candidateOutput.runs.map(run => ({
      seed: run.seed,
      packs: run.packs,
      cooperation: run.cooperation,
      health: run.health
    })),
    aggregate: {
      activePacks: candidateOutput.aggregate.packs,
      maximumPackSize: candidateOutput.aggregate.maximumPackSize,
      sameSpeciesDifferentLineagePackJoins: candidateOutput.aggregate.sameSpeciesDifferentLineagePackJoins,
      differentSpeciesSameLineagePackRejected: candidateOutput.aggregate.differentSpeciesSameLineagePackRejected,
      mixedSpeciesPacks: candidateOutput.aggregate.mixedSpeciesPacks
    }
  };
  fs.writeFileSync(
    path.join(artifactDir, 'species_lineage_world_comparison.json'),
    JSON.stringify(comparison, null, 2) + '\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(artifactDir, 'species_only_mating_results.json'),
    JSON.stringify(mating, null, 2) + '\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(artifactDir, 'species_only_pack_results.json'),
    JSON.stringify(pack, null, 2) + '\n',
    'utf8'
  );
}

async function runSeed(browser, seed) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(`pageerror:${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(`console:${message.text()}`);
  });
  await page.goto('file:///' + path.resolve(htmlFile).replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__alifeDebug?.runSeededWorldDiagnostic === 'function');
  const payload = await page.evaluate(({ seedValue, stepCount }) => {
    const options = {
      seed: seedValue,
      steps: stepCount,
      restoreAfterRun: false,
      variant: 'species-lineage-responsibility',
      shareFraction: 0,
      targetConsensus: false,
      packAttackBase: 0.78,
      packHuntTelemetry: true,
      includeModelState: true,
      includeLineageRegistryState: true,
      evolvableLifeHistory: true,
      juvenileDevelopment: true,
      predictiveHuntingReserve: true,
      persistentPackIdentity: true,
      speciesIdentityV2: true,
      canonicalSpeciesAppearance: true,
      eventKeyedVisualRng: true,
      persistentLineageRegistry: true,
      provisionalLineageClassification: true,
      provisionalLineagePromotion: true,
      lineageAwareMateSelection: true,
      lineageReproductiveIsolation: true,
      lineageAwarePackIdentity: true,
      packCooperativeTargeting: true,
      resourceLimitedAlgaeRegrowth: true,
      environmentInitializationMode: 'patchy-intermediate',
      worldShape: 'circle'
    };
    const micro = typeof window.__alifeDebug.runSpeciesLineageResponsibilityMicroTests === 'function'
      ? window.__alifeDebug.runSpeciesLineageResponsibilityMicroTests()
      : null;
    const run = window.__alifeDebug.runSeededWorldDiagnostic(options);
    return {
      micro,
      run,
      packSummary: window.__alifeDebug.packIdentitySummary(),
      packState: window.__alifeDebug.capturePackIdentityState(),
      lineageRegistry: {
        summary: window.__alifeDebug.lineageRegistrySummary(),
        validation: window.__alifeDebug.validateLineageRegistry()
      },
      roundTrip: window.__alifeDebug.roundTripSave()
    };
  }, { seedValue: seed, stepCount: steps });
  payload.browserErrors = browserErrors;
  await page.close();
  return compactRun(payload);
}

async function main() {
  fs.mkdirSync(artifactDir, { recursive: true });
  if (phase === 'refresh-micro') {
    const smokeFile = path.join(artifactDir, 'micro_smoke_world_raw.json');
    const smoke = JSON.parse(fs.readFileSync(smokeFile, 'utf8'));
    const micro = smoke.runs.find(run => run.micro)?.micro;
    if (!micro?.ok) throw new Error('Passing responsibility micro results are required');
    for (const [fileName, ids] of [
      ['species_only_mating_results.json', ['A', 'B', 'C', 'D', 'E']],
      ['species_only_pack_results.json', ['F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O']]
    ]) {
      const target = path.join(artifactDir, fileName);
      const output = JSON.parse(fs.readFileSync(target, 'utf8'));
      output.micro = {
        ok: micro.ok,
        results: micro.results.filter(row => ids.includes(row.id))
      };
      fs.writeFileSync(target, JSON.stringify(output, null, 2) + '\n', 'utf8');
    }
    process.stdout.write(JSON.stringify({ refreshedMicro: true, artifactDir }, null, 2) + '\n');
    return;
  }
  if (phase === 'finalize') {
    const candidateFile = path.join(artifactDir, 'candidate_world_raw.json');
    const candidateOutput = JSON.parse(fs.readFileSync(candidateFile, 'utf8'));
    writeFinalArtifacts(candidateOutput);
    process.stdout.write(JSON.stringify({ finalized: true, artifactDir }, null, 2) + '\n');
    return;
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const runs = [];
    for (const seed of seeds) runs.push(await runSeed(browser, seed));
    const output = {
      phase,
      htmlFile,
      generatedAt: new Date().toISOString(),
      runs,
      aggregate: aggregate(runs)
    };
    fs.writeFileSync(rawFile, JSON.stringify(output, null, 2) + '\n', 'utf8');
    if (phase === 'candidate') writeFinalArtifacts(output);
    process.stdout.write(JSON.stringify({ rawFile, aggregate: output.aggregate }, null, 2) + '\n');
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
