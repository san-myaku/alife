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

const BASE_COMMIT = '0c4d29b5ebb823adf83e4083fc2583a92c53ae8a';
const HTML_FILE = process.env.ALIFE_FILE || 'index.html';
const PHASE = String(process.env.ALIFE_ALGAE_PHASE || 'sweep').toLowerCase();
const OUTPUT_DIR = process.env.ALIFE_ALGAE_OUTPUT_DIR || path.join('artifacts', 'algae_regrowth_balance_20260729');
const STEPS = Math.max(1, Number(process.env.ALIFE_STEPS || (PHASE === 'final' ? 2000 : 1500)));
const SEEDS = String(process.env.ALIFE_SEEDS || (PHASE === 'final' ? '41001,43001,51001,53001,55001' : '41001,43001'))
  .split(',')
  .map(value => Number(value.trim()))
  .filter(Number.isFinite);
const SCALES = String(process.env.ALIFE_ALGAE_SCALES || (PHASE === 'final' ? '0.7' : '0.65,0.5,0.35'))
  .split(',')
  .map(value => Number(value.trim()))
  .filter(Number.isFinite);
const VIEWPORT = { width: 1280, height: 720 };

function stable(value) {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stable);
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function finiteTree(value, parts = [], bad = []) {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    bad.push({ path: parts.join('.'), value: String(value) });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => finiteTree(item, parts.concat(index), bad));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => finiteTree(item, parts.concat(key), bad));
  }
  return bad;
}

function diagnosticOptions(seed, enabled, scale, includeModelState = false) {
  return {
    seed,
    steps: STEPS,
    restoreAfterRun: false,
    variant: enabled ? `algae-regrowth-${scale}` : 'legacy-algae-regrowth',
    environmentInitializationMode: 'patchy-intermediate',
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
    packCooperativeTargeting: true,
    resourceLimitedAlgaeRegrowth: enabled,
    ...(enabled ? { algaeRegrowthScale: scale } : {})
  };
}

async function openPage(browser, file, seed = 41001) {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror:${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console:${message.text()}`);
  });
  await page.addInitScript(initialSeed => {
    let state = (Number(initialSeed) || 1) >>> 0;
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

function compactRun(run, errors) {
  const population = run.population || {};
  const algae = run.environmentCurrent || {};
  const flow = run.algaeRegrowth?.current || null;
  return {
    seed: run.seed,
    steps: run.steps,
    variant: run.variant,
    elapsedMs: run.elapsedMs,
    population: {
      start: population.startPopulation,
      end: population.endPopulation,
      peak: population.peakPopulation,
      firstCapFrame: population.firstPopulationCapFrame,
      births: population.births,
      reproductions: population.reproductions,
      deaths: population.deaths,
      deathCauses: population.deathCauses,
      byDiet: population.byDiet,
      endDiets: population.endDiets
    },
    algae: {
      initial: run.environmentInitialization,
      current: algae,
      flow,
      spatialMilestones: run.resourceSpatial?.milestones || [],
      flowMilestones: run.algaeRegrowth?.milestones || []
    },
    carnivore: {
      maximum: run.maxCarnivores,
      end: run.endCarnivores,
      extinctionFrame: run.carnivoreExtinctionFrame,
      births: run.bornCarnivores
    },
    conservation: run.conservation,
    health: run.health,
    browserErrors: errors.slice()
  };
}

async function runWorld(browser, file, seed, enabled, scale, includeModelState = false) {
  const boot = await openPage(browser, file, seed);
  try {
    const run = await boot.page.evaluate(options => window.__alifeDebug.runSeededWorldDiagnostic(options), diagnosticOptions(seed, enabled, scale, includeModelState));
    return { compact: compactRun(run, boot.errors), modelState: run.modelState || null, errors: boot.errors.slice() };
  } finally {
    await boot.page.close();
  }
}

function sum(rows, pick) {
  return rows.reduce((total, row) => total + Number(pick(row) || 0), 0);
}

function median(values) {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function aggregate(rows) {
  return {
    seeds: rows.map(row => row.seed),
    runs: rows.length,
    meanFinalAlgae: rows.length ? sum(rows, row => row.algae.current?.meanAlgae) / rows.length : null,
    meanFinalAlgaeStdDev: rows.length ? sum(rows, row => row.algae.current?.standardDeviation) / rows.length : null,
    meanFinalMinimumAlgae: rows.length ? sum(rows, row => row.algae.current?.minimumAlgae) / rows.length : null,
    meanPopulationEnd: rows.length ? sum(rows, row => row.population.end) / rows.length : null,
    meanPopulationPeak: rows.length ? sum(rows, row => row.population.peak) / rows.length : null,
    medianFirstCapFrame: median(rows.map(row => Number(row.population.firstCapFrame)).filter(value => value > 0)),
    capReachedRuns: rows.filter(row => row.population.firstCapFrame != null).length,
    herbivoreStarvationDeaths: sum(rows, row => row.population.byDiet?.h?.starvationDeaths),
    omnivoreStarvationDeaths: sum(rows, row => row.population.byDiet?.m?.starvationDeaths),
    carnivoreStarvationDeaths: sum(rows, row => row.population.byDiet?.c?.starvationDeaths),
    herbivoreOvercrowdingDeaths: sum(rows, row => row.population.byDiet?.h?.overcrowdingDeaths),
    omnivoreOvercrowdingDeaths: sum(rows, row => row.population.byDiet?.m?.overcrowdingDeaths),
    fieldRegrowth: sum(rows, row => row.algae.flow?.algaeRegrowth),
    decompositionInput: sum(rows, row => row.algae.flow?.decompositionInput),
    grazingRemoved: sum(rows, row => row.algae.flow?.grazingRemoved),
    carnivoreBirths: sum(rows, row => row.population.byDiet?.c?.births),
    endDiets: {
      h: sum(rows, row => row.population.endDiets?.h),
      m: sum(rows, row => row.population.endDiets?.m),
      c: sum(rows, row => row.population.endDiets?.c)
    },
    energyCreationEvents: sum(rows, row => row.conservation?.energyCreationEvents),
    nutrientCreationEvents: sum(rows, row => row.conservation?.nutrientCreationEvents),
    browserErrors: rows.flatMap(row => row.browserErrors || []).length,
    badNumbers: finiteTree(rows).length
  };
}

async function saveLoadCheck(page, legacySave = null) {
  return page.evaluate(legacy => {
    const debug = window.__alifeDebug;
    debug.setResourceLimitedAlgaeRegrowth(true, { clearScaleOverride: true });
    debug.resetSimulation({ mode: 'patchy-intermediate', seed: 41001 });
    const defaultRegrowth = debug.algaeRegrowthSummary();
    const initialHash = debug.currentAlgaeSummary().fieldHash;
    for (let i = 0; i < 20; i++) debug.modelStep(20);
    const beforeSave = debug.currentAlgaeSummary();
    const save = debug.captureSaveData();
    const decode = data => JSON.parse(decodeURIComponent(escape(atob(data.split(':', 2)[1]))));
    const savedState = decode(save);
    debug.setResourceLimitedAlgaeRegrowth(false);
    debug.resetSimulation({ mode: 'patchy-intermediate', seed: 43001 });
    debug.restoreSaveData(save);
    const afterLoad = debug.currentAlgaeSummary();
    const restoredFeature = debug.resourceLimitedAlgaeRegrowthEnabled();
    const restoredRegrowth = debug.algaeRegrowthSummary();
    debug.resetSimulation({ mode: 'patchy-intermediate', seed: 41001 });
    const afterReset = debug.currentAlgaeSummary();
    let legacyCompatibility = null;
    if (legacy?.save) {
      debug.setResourceLimitedAlgaeRegrowth(true, { clearScaleOverride: true });
      debug.restoreSaveData(legacy.save);
      const restoredLegacyField = debug.currentAlgaeSummary();
      legacyCompatibility = {
        expectedFieldHash: legacy.fieldHash,
        restoredFieldHash: restoredLegacyField.fieldHash,
        fieldPreserved: legacy.fieldHash === restoredLegacyField.fieldHash,
        featureDefaultedOn: debug.resourceLimitedAlgaeRegrowthEnabled(),
        effectiveScale: debug.algaeRegrowthSummary()?.effectiveScale ?? null
      };
    }
    return {
      saveVersion: savedState.v,
      savedFeature: savedState.features?.resourceLimitedAlgaeRegrowth,
      restoredFeature,
      defaultEffectiveScale: defaultRegrowth?.effectiveScale ?? null,
      restoredEffectiveScale: restoredRegrowth?.effectiveScale ?? null,
      initialHash,
      beforeSaveHash: beforeSave.fieldHash,
      afterLoadHash: afterLoad.fieldHash,
      afterResetHash: afterReset.fieldHash,
      loadPreservedField: beforeSave.fieldHash === afterLoad.fieldHash,
      resetReproducedInitial: initialHash === afterReset.fieldHash,
      legacyCompatibility
    };
  }, legacySave);
}

function markdown(data) {
  const lines = [
    '# 藻再生バランス診断',
    '',
    `- 基準commit: \`${data.baseCommit}\``,
    `- phase: ${data.phase}`,
    `- steps: ${data.steps}`,
    `- seeds: ${data.seeds.join(', ')}`,
    ''
  ];
  for (const group of data.groups) {
    const a = group.aggregate;
    lines.push(
      `## ${group.label}`,
      '',
      `- 最終平均藻量: ${Number(a.meanFinalAlgae).toFixed(4)}`,
      `- 最終藻量標準偏差: ${Number(a.meanFinalAlgaeStdDev).toFixed(4)}`,
      `- cap到達: ${a.capReachedRuns}/${a.runs}、中央値frame: ${a.medianFirstCapFrame ?? 'なし'}`,
      `- 草食/雑食/肉食の餓死: ${a.herbivoreStarvationDeaths}/${a.omnivoreStarvationDeaths}/${a.carnivoreStarvationDeaths}`,
      `- 草食/雑食の過密死: ${a.herbivoreOvercrowdingDeaths}/${a.omnivoreOvercrowdingDeaths}`,
      `- 再生/分解入力/採食除去: ${a.fieldRegrowth.toFixed(2)} / ${a.decompositionInput.toFixed(2)} / ${a.grazingRemoved.toFixed(2)}`,
      `- 終了時H/M/C合計: ${a.endDiets.h}/${a.endDiets.m}/${a.endDiets.c}`,
      ''
    );
  }
  if (data.offComparison) {
    lines.push(
      '## flag OFF非干渉',
      '',
      `- base hash: \`${data.offComparison.baseHash}\``,
      `- current OFF hash: \`${data.offComparison.currentHash}\``,
      `- 一致: ${data.offComparison.matches}`,
      ''
    );
  }
  if (data.saveLoad) {
    lines.push(
      '## save/load・reset',
      '',
      `- save version: ${data.saveLoad.saveVersion}`,
      `- feature保存/復元: ${data.saveLoad.savedFeature}/${data.saveLoad.restoredFeature}`,
      `- default/復元後scale: ${data.saveLoad.defaultEffectiveScale}/${data.saveLoad.restoredEffectiveScale}`,
      `- 保存field維持: ${data.saveLoad.loadPreservedField}`,
      `- 同seed reset再現: ${data.saveLoad.resetReproducedInitial}`,
      `- 旧save field維持/新feature既定ON: ${data.saveLoad.legacyCompatibility?.fieldPreserved}/${data.saveLoad.legacyCompatibility?.featureDefaultedOn}`,
      ''
    );
  }
  return lines.join('\n');
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const groups = [];
  const allErrors = [];
  let offComparison = null;
  let saveLoad = null;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alife-algae-base-'));
  try {
    const baselineRows = [];
    for (const seed of SEEDS) {
      const result = await runWorld(browser, HTML_FILE, seed, false, 1, false);
      baselineRows.push(result.compact);
      allErrors.push(...result.errors);
    }
    groups.push({ label: 'legacy scale 1.0', enabled: false, scale: 1, rows: baselineRows, aggregate: aggregate(baselineRows) });

    for (const scale of SCALES) {
      const rows = [];
      for (const seed of SEEDS) {
        const result = await runWorld(browser, HTML_FILE, seed, true, scale, false);
        rows.push(result.compact);
        allErrors.push(...result.errors);
      }
      groups.push({ label: `resource-limited scale ${scale}`, enabled: true, scale, rows, aggregate: aggregate(rows) });
    }

    if (PHASE === 'final') {
      const baseHtml = childProcess.execFileSync('git', ['show', `${BASE_COMMIT}:index.html`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
      const baseRender = childProcess.execFileSync('git', ['show', `${BASE_COMMIT}:organism_render.js`], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
      fs.writeFileSync(path.join(tempDir, 'index.html'), baseHtml, 'utf8');
      fs.writeFileSync(path.join(tempDir, 'organism_render.js'), baseRender, 'utf8');
      const base = await runWorld(browser, path.join(tempDir, 'index.html'), 41001, false, 1, true);
      const current = await runWorld(browser, HTML_FILE, 41001, false, 1, true);
      allErrors.push(...base.errors, ...current.errors);
      offComparison = {
        seed: 41001,
        steps: STEPS,
        baseHash: sha256(base.modelState),
        currentHash: sha256(current.modelState),
        matches: sha256(base.modelState) === sha256(current.modelState)
      };

      const baseBoot = await openPage(browser, path.join(tempDir, 'index.html'), 41001);
      let legacySave = null;
      try {
        legacySave = await baseBoot.page.evaluate(options => {
          window.__alifeDebug.runSeededWorldDiagnostic(options);
          return {
            save: window.__alifeDebug.captureSaveData(),
            fieldHash: window.__alifeDebug.currentAlgaeSummary().fieldHash
          };
        }, diagnosticOptions(41001, false, 1, false));
        allErrors.push(...baseBoot.errors);
      } finally {
        await baseBoot.page.close();
      }

      const boot = await openPage(browser, HTML_FILE, 41001);
      try {
        saveLoad = await saveLoadCheck(boot.page, legacySave);
        allErrors.push(...boot.errors);
      } finally {
        await boot.page.close();
      }
    }

    const badNumbers = finiteTree({ groups, offComparison, saveLoad });
    const data = {
      generatedAt: new Date().toISOString(),
      baseCommit: BASE_COMMIT,
      phase: PHASE,
      htmlFile: path.resolve(HTML_FILE),
      steps: STEPS,
      seeds: SEEDS,
      scales: SCALES,
      groups,
      offComparison,
      saveLoad,
      errors: allErrors,
      badNumbers
    };
    const suffix = PHASE === 'final' ? 'fixed_seed_results' : 'sweep_results';
    const jsonPath = path.join(OUTPUT_DIR, `${suffix}.json`);
    const markdownPath = path.join(OUTPUT_DIR, `${suffix}.md`);
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    fs.writeFileSync(markdownPath, markdown(data) + '\n', 'utf8');
    process.stdout.write(JSON.stringify({
      jsonPath,
      markdownPath,
      phase: PHASE,
      groups: groups.map(group => ({ label: group.label, aggregate: group.aggregate })),
      offComparison,
      saveLoad,
      errors: allErrors,
      badNumbers
    }, null, 2) + '\n');
  } finally {
    await browser.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  process.stderr.write((error && error.stack) ? error.stack + '\n' : String(error) + '\n');
  process.exitCode = 1;
});
