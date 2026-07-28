const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
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
addNodeModuleDir(path.join(userHome, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules'));
addNodeModuleDir(path.join(userHome, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', '.pnpm', 'node_modules'));

const { chromium } = require('playwright');

const BASE_COMMIT = 'dcc22eaba9fb9116e793b89f88bb57ac4cd0108c';
const HTML_FILE = process.env.ALIFE_FILE || 'index.html';
const OUTPUT_DIR = process.env.ALIFE_ACTUAL_PACK_OUTPUT_DIR || path.join('artifacts', 'actual_pack_cooperative_targeting_20260728');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'fixed_seed_results.json');
const OUTPUT_MARKDOWN = path.join(OUTPUT_DIR, 'summary.md');
const SEEDS = String(process.env.ALIFE_SEEDS || '41001,43001,45001')
  .split(',')
  .map(value => Number(value.trim()))
  .filter(Number.isFinite);
const STEPS = Math.max(1, Number(process.env.ALIFE_STEPS || 2000));
const VIEWPORT = { width: 1280, height: 720 };

function stable(value) {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stable);
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function stableJson(value) {
  return JSON.stringify(stable(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

function firstDiff(a, b, currentPath = '$') {
  if (Object.is(a, b)) return null;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') {
    return { path: currentPath, base: a, current: b };
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return { path: currentPath, base: a, current: b };
    if (a.length !== b.length) return { path: `${currentPath}.length`, base: a.length, current: b.length };
    for (let i = 0; i < a.length; i++) {
      const diff = firstDiff(a[i], b[i], `${currentPath}[${i}]`);
      if (diff) return diff;
    }
    return null;
  }
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(a, key) || !Object.prototype.hasOwnProperty.call(b, key)) {
      return { path: `${currentPath}.${key}`, base: a[key], current: b[key] };
    }
    const diff = firstDiff(a[key], b[key], `${currentPath}.${key}`);
    if (diff) return diff;
  }
  return null;
}

function dietClass(organism) {
  const diet = Number(organism?.genes?.diet ?? 0.5);
  return diet < 0.34 ? 'h' : (diet < 0.66 ? 'm' : 'c');
}

function packRows(packState) {
  return Object.values(packState?.packs || {}).map(pack => ({
    id: pack.id,
    identityMode: pack.identityMode,
    identityKey: pack.identityKey,
    lineageId: pack.lineageId,
    createdFrame: pack.createdFrame,
    dissolvedFrame: pack.dissolvedFrame,
    maximumLivingMembers: pack.maximumLivingMembers,
    currentLivingMembers: pack.currentLivingMembers,
    totalMembersEver: pack.totalMembersEver,
    birthsIntoPack: pack.birthsIntoPack,
    joins: pack.joins,
    leaves: pack.leaves,
    deaths: pack.deaths
  })).sort((a, b) => Number(a.createdFrame || 0) - Number(b.createdFrame || 0) || String(a.id).localeCompare(String(b.id)));
}

function compactRun(payload) {
  const run = payload.run;
  const stateOrganisms = run.modelState?.organisms || [];
  const packedOrganisms = stateOrganisms.filter(organism => organism.packId);
  const omnivorePackIds = [...new Set(packedOrganisms.filter(organism => dietClass(organism) === 'm').map(organism => organism.packId))].sort();
  const carnivorePackIds = [...new Set(packedOrganisms.filter(organism => dietClass(organism) === 'c').map(organism => organism.packId))].sort();
  const packs = packRows(payload.packState);
  const lifecycleMembers = payload.packMemberLifecycle?.members || [];
  const lineage = run.lineage || {};
  return {
    seed: run.seed,
    steps: run.steps,
    frame: run.frame,
    elapsedMs: run.elapsedMs,
    cooperativeTargeting: run.packCooperativeTargeting,
    pack: {
      summary: payload.packSummary,
      created: Number(payload.packSummary?.packsCreated || 0),
      active: Number(payload.packSummary?.activePackCount || 0),
      maximumSize: packs.reduce((max, pack) => Math.max(max, Number(pack.maximumLivingMembers || 0)), 0),
      maximumGenerationDepth: lifecycleMembers.reduce((max, member) => Math.max(max, Number(member.generationDepth || 0)), 0),
      carnivorePackIds,
      omnivorePackIds,
      omnivorePackCount: omnivorePackIds.length,
      rows: packs
    },
    carnivore: {
      initial: Number(lineage.totals?.initialBirthCarnivores || 0),
      births: Number(run.population?.byDiet?.c?.births || 0),
      reachedMaturity: Number(lineage.funnel?.counts?.reachedMaturity || 0),
      deaths: Number(run.population?.byDiet?.c?.deaths || 0),
      end: Number(run.population?.endDiets?.c || 0),
      extinctionFrame: run.carnivoreExtinctionFrame,
      maximum: run.maxCarnivores
    },
    population: {
      start: run.population?.startPopulation,
      end: run.population?.endPopulation,
      peak: run.population?.peakPopulation,
      firstCapFrame: run.population?.firstPopulationCapFrame,
      births: run.population?.births,
      deaths: run.population?.deaths,
      reproductions: run.population?.reproductions,
      endDiets: run.population?.endDiets
    },
    predation: {
      packStrategy: lineage.strategies?.pack,
      packHunt: lineage.packHunt,
      packFormation: lineage.packFormation
    },
    environmentInitialization: run.environmentInitialization,
    conservation: run.conservation,
    health: run.health,
    roundTrip: payload.roundTrip,
    browserErrors: payload.errors
  };
}

async function openPage(browser, file, seed) {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror:${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console:${message.text()}`);
  });
  await page.addInitScript(initialSeed => {
    let state = (Number(initialSeed) || 1) >>> 0;
    if (state === 0) state = 1;
    Math.random = function seededDiagnosticRandom() {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);
  const url = 'file:///' + path.resolve(file).replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__alifeDebug?.runSeededWorldDiagnostic === 'function', null, { timeout: 20000 });
  return { page, errors, url };
}

function diagnosticOptions(seed, cooperativeTargeting, includeModelState = true) {
  return {
    seed,
    steps: STEPS,
    restoreAfterRun: false,
    variant: cooperativeTargeting ? 'actual-pack-cooperative-targeting' : 'actual-pack-cooperative-targeting-off',
    shareFraction: 0,
    targetConsensus: false,
    packAttackBase: 0.78,
    packHuntTelemetry: true,
    includeModelState,
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
    packCooperativeTargeting: cooperativeTargeting
  };
}

async function runWorld(browser, file, seed, cooperativeTargeting) {
  const boot = await openPage(browser, file, seed);
  try {
    const payload = await boot.page.evaluate(options => {
      const run = window.__alifeDebug.runSeededWorldDiagnostic(options);
      return {
        run,
        packSummary: window.__alifeDebug.packIdentitySummary(),
        packState: window.__alifeDebug.capturePackIdentityState(),
        packMemberLifecycle: window.__alifeDebug.packMemberLifecycleSummary(),
        roundTrip: window.__alifeDebug.roundTripSave()
      };
    }, diagnosticOptions(seed, cooperativeTargeting, true));
    payload.errors = boot.errors;
    return payload;
  } finally {
    await boot.page.close();
  }
}

function sum(rows, pick) {
  return rows.reduce((total, row) => total + Number(pick(row) || 0), 0);
}

function aggregate(rows) {
  return {
    seeds: rows.map(row => row.seed),
    steps: STEPS,
    packsCreated: sum(rows, row => row.pack.created),
    maximumPackSize: rows.reduce((max, row) => Math.max(max, row.pack.maximumSize), 0),
    maximumPackGenerationDepth: rows.reduce((max, row) => Math.max(max, row.pack.maximumGenerationDepth), 0),
    omnivorePacks: sum(rows, row => row.pack.omnivorePackCount),
    shareAttempts: sum(rows, row => row.cooperativeTargeting?.shareAttempts),
    shareAdoptions: sum(rows, row => row.cooperativeTargeting?.shareAdoptions),
    shareRejections: sum(rows, row => row.cooperativeTargeting?.shareRejections),
    observedActualPackTargetSwitches: sum(rows, row => row.cooperativeTargeting?.observedActualPackTargetSwitches),
    targetSwitches: sum(rows, row => row.cooperativeTargeting?.targetSwitches),
    maximumActualPackSimultaneousTrackers: rows.reduce((max, row) => Math.max(max, Number(row.cooperativeTargeting?.maximumActualPackSimultaneousTrackers || 0)), 0),
    sharedTargetContacts: sum(rows, row => row.cooperativeTargeting?.sharedTargetContacts),
    sharedTargetKills: sum(rows, row => row.cooperativeTargeting?.sharedTargetKills),
    sameLineageCrossSpeciesCooperations: sum(rows, row => row.cooperativeTargeting?.sameLineageCrossSpeciesCooperations),
    crossPackTargetSharing: sum(rows, row => row.cooperativeTargeting?.invariants?.crossPackTargetSharing),
    mixedLineageCooperation: sum(rows, row => row.cooperativeTargeting?.invariants?.mixedLineageCooperation),
    invalidTargetSharing: sum(rows, row => row.cooperativeTargeting?.invariants?.invalidTargetSharing),
    carnivoreBirths: sum(rows, row => row.carnivore.births),
    carnivoreReachedMaturity: sum(rows, row => row.carnivore.reachedMaturity),
    carnivoreDeaths: sum(rows, row => row.carnivore.deaths),
    energyCreationEvents: sum(rows, row => row.conservation?.energyCreationEvents),
    nutrientCreationEvents: sum(rows, row => row.conservation?.nutrientCreationEvents),
    badNumberCount: sum(rows, row => row.health?.badCount),
    browserErrors: sum(rows, row => row.browserErrors?.length),
    roundTripOk: rows.every(row => row.roundTrip?.ok === true)
  };
}

function markdown(data) {
  const lines = [
    '# actual Pack cooperative targeting 検証',
    '',
    `- 基準HEAD: \`${BASE_COMMIT}\``,
    `- seed: ${data.seeds.join(', ')}`,
    `- step: ${data.steps}`,
    `- Micro: ${data.micro.ok ? 'PASS' : 'FAIL'}`,
    `- flag OFF model state一致: ${data.offComparison.same}`,
    `- flag OFF base/current hash: \`${data.offComparison.baseHash}\` / \`${data.offComparison.currentHash}\``,
    `- page/console error: ${data.aggregate.browserErrors + data.micro.errors.length + data.offComparison.errors.length}`,
    `- NaN / Infinity: ${data.aggregate.badNumberCount}`,
    '',
    '## 3 seed集計',
    '',
    `- Pack作成: ${data.aggregate.packsCreated}`,
    `- 最大Pack規模: ${data.aggregate.maximumPackSize}`,
    `- 最大Pack世代深度: ${data.aggregate.maximumPackGenerationDepth}`,
    `- omnivore Pack: ${data.aggregate.omnivorePacks}`,
    `- target共有観測 / 採用 / 拒否: ${data.aggregate.shareAttempts} / ${data.aggregate.shareAdoptions} / ${data.aggregate.shareRejections}`,
    `- 最大同時追跡actual Pack人数: ${data.aggregate.maximumActualPackSimultaneousTrackers}`,
    `- actual Pack全target切替 / 共有target切替: ${data.aggregate.observedActualPackTargetSwitches} / ${data.aggregate.targetSwitches}`,
    `- seed ${data.offComparison.seed} actual Pack全target切替 ON / OFF: ${data.runs.find(row => row.seed===data.offComparison.seed)?.cooperativeTargeting?.observedActualPackTargetSwitches ?? 'n/a'} / ${data.offComparison.current.cooperativeTargeting?.observedActualPackTargetSwitches ?? 'n/a'}`,
    `- shared target→contact / kill: ${data.aggregate.sharedTargetContacts} / ${data.aggregate.sharedTargetKills}`,
    `- 同lineage・別speciesKey協力: ${data.aggregate.sameLineageCrossSpeciesCooperations}`,
    `- cross-pack / mixed-lineage / invalid sharing: ${data.aggregate.crossPackTargetSharing} / ${data.aggregate.mixedLineageCooperation} / ${data.aggregate.invalidTargetSharing}`,
    `- 肉食出生 / 成熟 / 死亡: ${data.aggregate.carnivoreBirths} / ${data.aggregate.carnivoreReachedMaturity} / ${data.aggregate.carnivoreDeaths}`,
    `- energy / nutrient creation: ${data.aggregate.energyCreationEvents} / ${data.aggregate.nutrientCreationEvents}`,
    `- roundTrip: ${data.aggregate.roundTripOk}`,
    '',
    '## seed別',
    '',
    '| seed | packs | max size | max gen | shares adopted | max trackers | contact | kill | target switches | end H/M/C | cap frame | carn extinction |',
    '|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|'
  ];
  for (const row of data.runs) {
    const diets = row.population.endDiets || {};
    lines.push(`| ${row.seed} | ${row.pack.created} | ${row.pack.maximumSize} | ${row.pack.maximumGenerationDepth} | ${row.cooperativeTargeting.shareAdoptions} | ${row.cooperativeTargeting.maximumActualPackSimultaneousTrackers} | ${row.cooperativeTargeting.sharedTargetContacts} | ${row.cooperativeTargeting.sharedTargetKills} | ${row.cooperativeTargeting.targetSwitches} | ${diets.h || 0}/${diets.m || 0}/${diets.c || 0} | ${row.population.firstCapFrame ?? '-'} | ${row.carnivore.extinctionFrame ?? '-'} |`);
  }
  lines.push(
    '',
    '## 判定',
    '',
    data.accepted
      ? '採用候補。actual Pack内の自然共有、contact/killへの進行、OFF非干渉、保存則、不変条件を満たした。'
      : '撤回または局所修正候補。採用条件のいずれかを満たしていない。',
    ''
  );
  return lines.join('\n');
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alife-actual-pack-base-'));
  const baseFile = path.join(tempDir, 'index.html');
  for (const relativeFile of ['index.html', 'organism_render.js']) {
    fs.writeFileSync(
      path.join(tempDir, relativeFile),
      childProcess.execFileSync('git', ['show', `${BASE_COMMIT}:${relativeFile}`], {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024
      }),
      'utf8'
    );
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const microBoot = await openPage(browser, HTML_FILE, SEEDS[0] || 41001);
    let micro;
    try {
      const result = await microBoot.page.evaluate(() => ({
        lineageAwarePackIdentity: window.__alifeDebug.runLineageAwarePackIdentityMicroTests(),
        roundTrip: window.__alifeDebug.roundTripSave()
      }));
      micro = {
        ok: result.lineageAwarePackIdentity?.ok === true && result.roundTrip?.ok === true && microBoot.errors.length === 0,
        lineageAwarePackIdentity: result.lineageAwarePackIdentity,
        roundTrip: result.roundTrip,
        errors: microBoot.errors
      };
    } finally {
      await microBoot.page.close();
    }

    const offSeed = SEEDS[0] || 41001;
    const baseOff = await runWorld(browser, baseFile, offSeed, false);
    const currentOff = await runWorld(browser, HTML_FILE, offSeed, false);
    const baseState = baseOff.run.modelState;
    const currentState = currentOff.run.modelState;
    const offComparison = {
      seed: offSeed,
      steps: STEPS,
      same: stableJson(baseState) === stableJson(currentState),
      baseHash: sha256(baseState),
      currentHash: sha256(currentState),
      firstDiff: firstDiff(baseState, currentState),
      base: compactRun(baseOff),
      current: compactRun(currentOff),
      errors: [...baseOff.errors, ...currentOff.errors]
    };

    const runs = [];
    for (const seed of SEEDS) {
      runs.push(compactRun(await runWorld(browser, HTML_FILE, seed, true)));
    }
    const aggregated = aggregate(runs);
    const totalErrors = aggregated.browserErrors + micro.errors.length + offComparison.errors.length;
    const accepted = micro.ok
      && offComparison.same
      && aggregated.shareAdoptions > 0
      && aggregated.maximumActualPackSimultaneousTrackers >= 2
      && (aggregated.sharedTargetContacts > 0 || aggregated.sharedTargetKills > 0)
      && aggregated.crossPackTargetSharing === 0
      && aggregated.mixedLineageCooperation === 0
      && aggregated.invalidTargetSharing === 0
      && aggregated.energyCreationEvents === 0
      && aggregated.nutrientCreationEvents === 0
      && aggregated.badNumberCount === 0
      && aggregated.roundTripOk
      && totalErrors === 0;
    const data = {
      generatedAt: new Date().toISOString(),
      baseCommit: BASE_COMMIT,
      htmlFile: HTML_FILE,
      seeds: SEEDS,
      steps: STEPS,
      feature: 'packCooperativeTargeting',
      micro,
      offComparison,
      runs,
      aggregate: aggregated,
      accepted
    };
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(data, null, 2), 'utf8');
    fs.writeFileSync(OUTPUT_MARKDOWN, markdown(data), 'utf8');
    console.log(JSON.stringify({
      outputJson: OUTPUT_JSON,
      outputMarkdown: OUTPUT_MARKDOWN,
      accepted,
      microOk: micro.ok,
      offSame: offComparison.same,
      aggregate: aggregated
    }, null, 2));
    if (!accepted) process.exitCode = 1;
  } finally {
    await browser.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
