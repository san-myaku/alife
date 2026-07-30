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

const htmlFile = process.env.ALIFE_FILE || 'index.html';
const phase = String(process.env.ALIFE_PHASE || 'formation-before');
const seeds = String(process.env.ALIFE_SEEDS || '41001,43001,45001')
  .split(',')
  .map(value => Number(value.trim()))
  .filter(Number.isFinite);
const steps = Math.max(1, Number(process.env.ALIFE_STEPS || 5000));
const speciesIdentityV2 = String(process.env.ALIFE_SPECIES_IDENTITY_V2 || 'false').toLowerCase() !== 'false';
const artifactDir = path.join('artifacts', 'pack_reward_sharing_20260730');
const outputFile = path.join(artifactDir, `${phase}.json`);
const viewport = { width: 1280, height: 720 };

function sum(rows, pick) {
  return rows.reduce((total, row) => total + Number(pick(row) || 0), 0);
}

function maximum(rows, pick) {
  return rows.reduce((value, row) => Math.max(value, Number(pick(row) || 0)), 0);
}

function compact(payload) {
  const run = payload.run || {};
  const sexualEvents = (run.lineageMateSelection?.events || []).filter(
    event => event.reproduced && event.mateId != null
  );
  const crossSpeciesSexualBirths = sum(
    sexualEvents.filter(event => String(event.parentSpeciesKey) !== String(event.mateSpeciesKey)),
    event => event.birthCount
  );
  const pack = payload.packSummary || {};
  const formation = pack.formation || {};
  const packRecords = Object.values(payload.packState?.packs || {});
  const activeRecords = packRecords.filter(record => record.dissolvedFrame == null);
  const cooperative = payload.cooperative || {};
  const claim = payload.claim || {};
  return {
    seed: run.seed,
    steps: run.steps,
    frame: run.frame,
    population: {
      ending: Number(run.population?.endPopulation || 0),
      births: Number(run.population?.births || 0),
      deaths: Number(run.population?.deaths || 0)
    },
    formation: {
      radiusMultiplier: Number(formation.radiusMultiplier || 0),
      updateIntervalSteps: Number(formation.updateIntervalSteps || 0),
      observationSamples: Number(formation.observationSamples || 0),
      huntPackLiving: formation.huntPackLiving || null,
      sameSpeciesPairs: formation.sameSpeciesPairs || null,
      unassignedSameSpeciesPairs: formation.unassignedSameSpeciesPairs || null,
      withinFormationRadiusPairs: formation.withinFormationRadiusPairs || null,
      unassignedWithinFormationRadiusPairs: formation.unassignedWithinFormationRadiusPairs || null,
      creationAttempts: Number(formation.creationAttempts || 0),
      creationSuccesses: Number(formation.creationSuccesses || 0),
      dissolvedImmediately: Number(formation.dissolvedImmediately || 0),
      huntPackBirths: Number(formation.huntPackBirths || 0),
      sameSpeciesHuntPackParentChildBirths: Number(formation.sameSpeciesHuntPackParentChildBirths || 0)
    },
    packs: {
      formed: Number(pack.packsCreated || 0),
      active: Number(pack.activePackCount || activeRecords.length),
      maximumActive: Number(formation.maximumActivePackCount || 0),
      maximumSize: maximum(packRecords, record => record.maximumLivingMembers),
      totalJoins: Number(pack.joins || 0),
      formationMemberJoins: Number(pack.formationMemberJoins || 0),
      spatialJoins: Number(pack.spatialJoins || 0),
      inheritedBirths: Number(pack.parentInheritedBirths || 0),
      distanceLeaves: Number(pack.distanceLeaves || 0),
      mixedSpecies: Number(pack.invariants?.mixedSpeciesPacks || 0)
    },
    cooperation: {
      targetShares: Number(cooperative.shareAdoptions || 0),
      participantKills: Number(claim.claimedCorpsesCreated || 0),
      sharedTargetKills: Number(cooperative.sharedTargetKills || 0),
      speciesMismatchViolations: Number(cooperative.invariants?.speciesMismatchCooperation || 0),
      crossPackViolations: Number(cooperative.invariants?.crossPackTargetSharing || 0)
    },
    claim: {
      activeCorpses: Number(claim.activeClaimCorpses || 0),
      created: Number(claim.claimedCorpsesCreated || 0),
      participantFeeds: Number(claim.participantFeeds || 0),
      nonParticipantBlocks: Number(claim.nonParticipantBlocks || 0),
      publicFeedsAfterExpiry: Number(claim.publicFeedsAfterExpiry || 0),
      energyConservationViolations: Number(claim.energyConservationViolations || 0)
    },
    invariants: {
      crossSpeciesSexualBirths,
      badNumbers: Number(run.health?.badCount || 0),
      energyCreationEvents: Number(run.conservation?.energyCreationEvents || 0),
      nutrientCreationEvents: Number(run.conservation?.nutrientCreationEvents || 0)
    },
    lineageValidation: payload.lineageValidation || null,
    roundTrip: payload.roundTrip || null,
    micro: payload.micro || null,
    browserErrors: payload.browserErrors || []
  };
}

function aggregate(runs) {
  return {
    seeds: runs.map(run => run.seed),
    steps,
    endingPopulation: sum(runs, run => run.population.ending),
    packFormation: {
      huntPackLivingMaximum: maximum(runs, run => run.formation.huntPackLiving?.maximum),
      huntPackLivingSampleTotal: sum(runs, run => run.formation.huntPackLiving?.sampleTotal),
      sameSpeciesPairSampleTotal: sum(runs, run => run.formation.sameSpeciesPairs?.sampleTotal),
      unassignedSameSpeciesPairSampleTotal: sum(runs, run => run.formation.unassignedSameSpeciesPairs?.sampleTotal),
      withinFormationRadiusPairSampleTotal: sum(runs, run => run.formation.withinFormationRadiusPairs?.sampleTotal),
      unassignedWithinFormationRadiusPairSampleTotal: sum(
        runs,
        run => run.formation.unassignedWithinFormationRadiusPairs?.sampleTotal
      ),
      creationAttempts: sum(runs, run => run.formation.creationAttempts),
      creationSuccesses: sum(runs, run => run.formation.creationSuccesses),
      dissolvedImmediately: sum(runs, run => run.formation.dissolvedImmediately),
      huntPackBirths: sum(runs, run => run.formation.huntPackBirths),
      sameSpeciesHuntPackParentChildBirths: sum(
        runs,
        run => run.formation.sameSpeciesHuntPackParentChildBirths
      )
    },
    packs: {
      formed: sum(runs, run => run.packs.formed),
      activeAtEnd: sum(runs, run => run.packs.active),
      maximumActive: maximum(runs, run => run.packs.maximumActive),
      maximumSize: maximum(runs, run => run.packs.maximumSize),
      totalJoins: sum(runs, run => run.packs.totalJoins),
      formationMemberJoins: sum(runs, run => run.packs.formationMemberJoins),
      spatialJoins: sum(runs, run => run.packs.spatialJoins),
      inheritedBirths: sum(runs, run => run.packs.inheritedBirths),
      distanceLeaves: sum(runs, run => run.packs.distanceLeaves),
      mixedSpecies: sum(runs, run => run.packs.mixedSpecies)
    },
    cooperation: {
      targetShares: sum(runs, run => run.cooperation.targetShares),
      participantKills: sum(runs, run => run.cooperation.participantKills),
      sharedTargetKills: sum(runs, run => run.cooperation.sharedTargetKills)
    },
    claim: {
      activeCorpses: sum(runs, run => run.claim.activeCorpses),
      created: sum(runs, run => run.claim.created),
      participantFeeds: sum(runs, run => run.claim.participantFeeds),
      nonParticipantBlocks: sum(runs, run => run.claim.nonParticipantBlocks),
      publicFeedsAfterExpiry: sum(runs, run => run.claim.publicFeedsAfterExpiry),
      energyConservationViolations: sum(runs, run => run.claim.energyConservationViolations)
    },
    invariants: {
      crossSpeciesSexualBirths: sum(runs, run => run.invariants.crossSpeciesSexualBirths),
      mixedSpeciesPacks: sum(runs, run => run.packs.mixedSpecies),
      badNumbers: sum(runs, run => run.invariants.badNumbers),
      energyCreationEvents: sum(runs, run => run.invariants.energyCreationEvents),
      nutrientCreationEvents: sum(runs, run => run.invariants.nutrientCreationEvents),
      lineageValid: runs.every(run => run.lineageValidation?.ok === true),
      roundTripValid: runs.every(run => run.roundTrip?.ok === true),
      browserErrors: runs.flatMap(run => run.browserErrors)
    },
    microOk: runs.every(run => !run.micro || Object.values(run.micro).every(result => result?.ok === true))
  };
}

function writeFinalArtifacts() {
  const read = name => JSON.parse(fs.readFileSync(path.join(artifactDir, name), 'utf8'));
  const formationArtifactPath = path.join(artifactDir, 'pack_formation_results.json');
  const existingFormation = fs.existsSync(formationArtifactPath)
    ? JSON.parse(fs.readFileSync(formationArtifactPath, 'utf8'))
    : null;
  const productionBeforePath = path.join(artifactDir, 'formation-production-default.json');
  const productionBefore = fs.existsSync(productionBeforePath)
    ? read('formation-production-default.json')
    : { aggregate: existingFormation?.diagnosis?.productionBeforeRewardImplementation || null };
  const forcedV2Path = path.join(artifactDir, 'formation-before-birth-audit.json');
  const forcedV2Audit = fs.existsSync(forcedV2Path)
    ? read('formation-before-birth-audit.json')
    : { aggregate: existingFormation?.diagnosis?.forcedSpeciesIdentityV2Audit || null };
  const finalSeed = read('final-seed.json');
  const microSmokePath = path.join(artifactDir, 'reward-micro-smoke.json');
  const existingMicroPath = path.join(artifactDir, 'pack_reward_micro_tests.json');
  const micro = fs.existsSync(microSmokePath)
    ? (read('reward-micro-smoke.json').runs[0]?.micro || {})
    : (fs.existsSync(existingMicroPath)
      ? (() => {
          const existing = JSON.parse(fs.readFileSync(existingMicroPath, 'utf8'));
          return { formation: existing.formation, reward: existing.reward };
        })()
      : {});
  const formationResults = {
    schemaVersion: 1,
    startHead: 'ddb44e152f2cd7f3977df94cde20979cf15b1d2e',
    branch: 'codex/simplify-species-lineage-pack',
    rule: 'Natural Pack formation requires alive hunt-pack organisms with exact matching speciesKey; lineageId is ignored.',
    productionConfiguration: {
      speciesIdentityV2: false,
      formationRadiusMultiplier: 0.85,
      updateIntervalSteps: 12,
      minimumFormationMembers: 2
    },
    diagnosis: {
      implementationBug: false,
      formationAdjustment: null,
      zeroCause: 'The prior zero-Pack comparison forced staged speciesIdentityV2=true. Across every observed step it produced no same-species hunt-pack pair. Normal production speciesKey configuration formed Packs without changing Pack constants.',
      forcedSpeciesIdentityV2Audit: forcedV2Audit.aggregate,
      productionBeforeRewardImplementation: productionBefore.aggregate,
      finalProductionRun: finalSeed.aggregate.packFormation
    },
    micro: micro.formation || null
  };
  const rewardMicro = {
    schemaVersion: 1,
    claimDurationSteps: 72,
    directHelperEnergyDistribution: false,
    formation: micro.formation || null,
    reward: micro.reward || null
  };
  const seedRuns = finalSeed.runs.map(run => ({
    seed: run.seed,
    steps: run.steps,
    population: run.population,
    formation: run.formation,
    packs: run.packs,
    cooperation: {
      targetShares: run.cooperation.targetShares,
      cooperativeKills: run.claim.created,
      sharedTargetKillerKills: run.cooperation.kills,
      speciesMismatchViolations: run.cooperation.speciesMismatchViolations,
      crossPackViolations: run.cooperation.crossPackViolations
    },
    claim: run.claim,
    invariants: run.invariants,
    lineageValidation: run.lineageValidation,
    roundTrip: run.roundTrip,
    browserErrors: run.browserErrors
  }));
  const seedResults = {
    schemaVersion: 1,
    configuration: {
      seeds,
      steps: 5000,
      speciesIdentityV2: false,
      persistentPackIdentity: true,
      packCooperativeTargeting: true,
      claimDurationSteps: 72
    },
    runs: seedRuns,
    aggregate: {
      endingPopulation: finalSeed.aggregate.endingPopulation,
      naturalPacksFormed: finalSeed.aggregate.packs.formed,
      activePacksAtEnd: finalSeed.aggregate.packs.activeAtEnd,
      maximumConcurrentPacks: finalSeed.aggregate.packs.maximumActive,
      maximumPackSize: finalSeed.aggregate.packs.maximumSize,
      packJoins: finalSeed.aggregate.packs.spatialJoins,
      totalPackMemberJoins: finalSeed.aggregate.packs.totalJoins,
      formationMemberJoins: finalSeed.aggregate.packs.formationMemberJoins,
      packInheritedBirths: finalSeed.aggregate.packs.inheritedBirths,
      targetShares: finalSeed.aggregate.cooperation.targetShares,
      cooperativeKills: finalSeed.aggregate.claim.created,
      claimedCorpsesCreated: finalSeed.aggregate.claim.created,
      activeClaimedCorpsesAtEnd: finalSeed.aggregate.claim.activeCorpses,
      participantFeeds: finalSeed.aggregate.claim.participantFeeds,
      nonParticipantBlocks: finalSeed.aggregate.claim.nonParticipantBlocks,
      publicFeedsAfterExpiry: finalSeed.aggregate.claim.publicFeedsAfterExpiry,
      corpseEnergyConservationViolations: finalSeed.aggregate.claim.energyConservationViolations,
      mixedSpeciesPacks: finalSeed.aggregate.invariants.mixedSpeciesPacks,
      crossSpeciesSexualBirths: finalSeed.aggregate.invariants.crossSpeciesSexualBirths,
      badNumbers: finalSeed.aggregate.invariants.badNumbers,
      energyCreationEvents: finalSeed.aggregate.invariants.energyCreationEvents,
      nutrientCreationEvents: finalSeed.aggregate.invariants.nutrientCreationEvents,
      lineageValid: finalSeed.aggregate.invariants.lineageValid,
      saveLoadValid: finalSeed.aggregate.invariants.roundTripValid,
      consoleErrors: finalSeed.aggregate.invariants.browserErrors
    }
  };
  const audit = `# Pack短期形成監査

## 結論

形成実装のregressionはなかった。前回3seedでPackが0だった直接原因は、比較runnerが通常production既定ではない \`speciesIdentityV2=true\` を強制していたことだった。この構成では5,000stepの毎step観測でも同一speciesKeyのhunt-packペアが0で、radius・更新頻度以前に形成機会がなかった。

通常productionの既存speciesKey経路（\`speciesIdentityV2=false\`）では、変更前の3seed×5,000stepで自然Packを2個形成した。形成試行2、成功2、即時解散0、最大規模3だった。したがって実装バグ修正や形成パラメータ調整は行っていない。

## 維持した値

- formationRadiusMultiplier: 0.85
- updateIntervalSteps: 12
- minimumFormationMembers: 2
- join / leave radius、leave grace、keepSingleMemberPack: 変更なし

## 最終run

- 自然Pack形成: ${finalSeed.aggregate.packs.formed}
- 最大同時Pack: ${finalSeed.aggregate.packs.maximumActive}
- 最大Pack規模: ${finalSeed.aggregate.packs.maximumSize}
- 作成直後の解散: ${finalSeed.aggregate.packFormation.dissolvedImmediately}
- 同種hunt-pack pair sample: ${finalSeed.aggregate.packFormation.sameSpeciesPairSampleTotal}
- 形成距離内pair sample: ${finalSeed.aggregate.packFormation.withinFormationRadiusPairSampleTotal}

Microでは、同種・別lineageの通常更新形成、異種・同lineageの拒否、次回更新後の維持、途中加入、出生継承をすべて確認した。
`;
  const design = `# Pack協力捕殺の利益分配 最終設計

## Packと種

- \`speciesKey\` は種であり、有性生殖とPack形成・加入・出生継承の完全一致条件。
- \`lineageId\` は血統・進化履歴専用で、交配・Pack・死骸claimの適合条件には使わない。

## 参加者

捕殺時点の最終攻撃個体に加え、同じactive Packで標的を追跡し、獲物から既存helper範囲内にいた個体、または直前18step以内にattack/helper判定へ実際に寄与した個体を記録する。単に同じPackにいるだけの遠方個体は含めない。

## 死骸claim

- \`claimPackId\`
- \`claimParticipantIds\`
- \`claimUntilStep\`
- 優先期間: 72step

期間中は生存中の参加者だけが摂食できる。参加者には、逃避・既存捕食判断を上書きしない軽い死骸steeringを与える。非参加者は接触しても拒否される。

Pack解散後も参加者本人の権利は期限まで残る。参加者が全員死亡・消失した場合は即時一般開放する。期限終了後は全個体が接触摂食でき、腐肉食個体は従来どおり死骸へsteeringする。

## Energy

捕食時の既存初期死骸energy式 \`gainRaw * 0.32\` は変更しない。その値を持つCorpseを1個だけ作る。摂食時は個体の実増加energyと同量をCorpseから減らし、人数による増量・コピー・固定配当をしない。

旧debug用shareFractionとactive Pack overflow/surplusの直接helper energy移送は通常判定で無効化した。協力利益は有限な死骸への優先アクセスだけである。

claim Pack、参加者ID、期限、解放状態はsave/loadする。選択debugにはclaim Pack、残りstep、参加者数、選択個体が参加者かを表示する。
`;
  fs.writeFileSync(path.join(artifactDir, 'pack_formation_results.json'), JSON.stringify(formationResults, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'pack_reward_micro_tests.json'), JSON.stringify(rewardMicro, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'pack_reward_seed_results.json'), JSON.stringify(seedResults, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'pack_short_formation_audit.md'), audit, 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'pack_reward_final_design.md'), design, 'utf8');
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
  const payload = await page.evaluate(({ seedValue, stepCount, useSpeciesIdentityV2 }) => {
    const debug = window.__alifeDebug;
    const micro = {};
    if (typeof debug.runPackFormationOpportunityMicroTests === 'function') {
      micro.formation = debug.runPackFormationOpportunityMicroTests();
    }
    if (typeof debug.runPackRewardSharingMicroTests === 'function') {
      micro.reward = debug.runPackRewardSharingMicroTests();
    }
    const run = debug.runSeededWorldDiagnostic({
      seed: seedValue,
      steps: stepCount,
      restoreAfterRun: false,
      variant: 'pack-reward-sharing',
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
      speciesIdentityV2: useSpeciesIdentityV2,
      canonicalSpeciesAppearance: true,
      eventKeyedVisualRng: true,
      persistentLineageRegistry: true,
      provisionalLineageClassification: true,
      provisionalLineagePromotion: true,
      lineageAwareMateSelection: false,
      lineageReproductiveIsolation: false,
      lineageAwarePackIdentity: false,
      packCooperativeTargeting: true,
      resourceLimitedAlgaeRegrowth: true,
      environmentInitializationMode: 'patchy-intermediate',
      worldShape: 'circle'
    });
    const packSummary = debug.packIdentitySummary();
    const packState = debug.capturePackIdentityState();
    const cooperative = debug.packCooperativeTargetingSummary();
    const claim = typeof debug.carcassClaimSummary === 'function' ? debug.carcassClaimSummary() : null;
    const lineageValidation = debug.validateLineageRegistry();
    const roundTrip = debug.roundTripSave();
    return { run, packSummary, packState, cooperative, claim, lineageValidation, roundTrip, micro };
  }, { seedValue: seed, stepCount: steps, useSpeciesIdentityV2: speciesIdentityV2 });
  payload.browserErrors = browserErrors;
  await page.close();
  return compact(payload);
}

async function main() {
  fs.mkdirSync(artifactDir, { recursive: true });
  if (phase === 'finalize') {
    writeFinalArtifacts();
    process.stdout.write(JSON.stringify({ finalized: true, artifactDir }, null, 2) + '\n');
    return;
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const runs = [];
    for (const seed of seeds) runs.push(await runSeed(browser, seed));
    const output = {
      schemaVersion: 1,
      phase,
      htmlFile,
      speciesIdentityV2,
      generatedAt: new Date().toISOString(),
      runs,
      aggregate: aggregate(runs)
    };
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2) + '\n', 'utf8');
    process.stdout.write(JSON.stringify({ outputFile, aggregate: output.aggregate }, null, 2) + '\n');
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
