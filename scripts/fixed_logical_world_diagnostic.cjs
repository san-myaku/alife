const crypto = require('crypto');
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
addNodeModuleDir(path.join(userHome, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules'));
addNodeModuleDir(path.join(userHome, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', '.pnpm', 'node_modules'));

const { chromium } = require('playwright');

const HTML_FILE = path.resolve(process.env.ALIFE_FILE || 'index.html');
const BASELINE_FILE = path.resolve(process.env.ALIFE_BASELINE_FILE || path.join('..', 'algae_regeneration_balance', 'index.html'));
const OUTPUT_DIR = path.resolve(process.env.ALIFE_FIXED_WORLD_OUTPUT_DIR || path.join('artifacts', 'fixed_logical_world_camera_20260729'));
const INVARIANCE_STEPS = Math.max(1, Number(process.env.ALIFE_INVARIANCE_STEPS || 600));
const SMOKE_STEPS = Math.max(1, Number(process.env.ALIFE_SMOKE_STEPS || 2000));
const PHASE = String(process.env.ALIFE_FIXED_WORLD_PHASE || 'all').toLowerCase();
const VIEWPORTS = [
  { label: 'mobile_portrait', width: 390, height: 844 },
  { label: 'tablet_portrait', width: 768, height: 1024 },
  { label: 'desktop', width: 1365, height: 768 },
  { label: 'large_desktop', width: 1920, height: 1080 }
];
const CANONICAL_VIEWPORT = { label: 'canonical_reference', width: 1280, height: 720 };

function stable(value) {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stable);
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function finitePaths(value, parts = [], bad = []) {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    bad.push(parts.join('.'));
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => finitePaths(item, parts.concat(index), bad));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => finitePaths(item, parts.concat(key), bad));
  }
  return bad;
}

function firstDiff(left, right, parts = []) {
  if (Object.is(left, right)) return null;
  if (typeof left !== typeof right || left == null || right == null) return { path: parts.join('.'), left, right };
  if (typeof left !== 'object') return { path: parts.join('.'), left, right };
  const leftKeys = Array.isArray(left) ? left.map((_, index) => String(index)) : Object.keys(left).sort();
  const rightKeys = Array.isArray(right) ? right.map((_, index) => String(index)) : Object.keys(right).sort();
  if (leftKeys.join('|') !== rightKeys.join('|')) return { path: parts.join('.'), leftKeys, rightKeys };
  for (const key of leftKeys) {
    const diff = firstDiff(left[key], right[key], parts.concat(key));
    if (diff) return diff;
  }
  return null;
}

function diagnosticOptions(seed, steps, includeModelState = true) {
  return {
    seed,
    steps,
    restoreAfterRun: false,
    variant: 'fixed-logical-world',
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
    resourceLimitedAlgaeRegrowth: true,
    algaeRegrowthScale: 0.7
  };
}

async function openPage(browser, file, viewport, seed = 41001) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
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
  const url = 'file:///' + file.replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__alifeDebug?.runSeededWorldDiagnostic === 'function', null, { timeout: 20000 });
  return { page, errors, url };
}

async function runDiagnostic(browser, file, viewport, seed, steps, includeModelState = true) {
  const boot = await openPage(browser, file, viewport, seed);
  try {
    const run = await boot.page.evaluate(
      options => window.__alifeDebug.runSeededWorldDiagnostic(options),
      diagnosticOptions(seed, steps, includeModelState)
    );
    const geometry = await boot.page.evaluate(() => window.__alifeDebug.worldGeometry ? window.__alifeDebug.worldGeometry() : null);
    return { run, geometry, errors: boot.errors.slice() };
  } finally {
    await boot.page.close();
  }
}

function categoryHashes(state) {
  if (!state) return null;
  return {
    full: hash(state),
    organisms: hash(state.organisms),
    environment: hash(state.envState),
    resources: hash({ food: state.food, corpses: state.corpses, plankton: state.plankton, patches: state.patches, membranes: state.membranes }),
    pack: hash({ packIdentity: state.packIdentity, organisms: state.organisms?.map(o => ({
      id: o.id,
      packId: o.packId,
      packJoinFrame: o.packJoinFrame,
      packFounderId: o.packFounderId,
      packSharedTargetId: o.packSharedTargetId
    })) }),
    lineage: hash({ lineage: state.lineage, lineageRegistry: state.lineageRegistry }),
    species: hash({ speciesStats: state.speciesStats, organisms: state.organisms?.map(o => ({ id: o.id, speciesKey: o.speciesKey, lineageId: o.lineageId })) })
  };
}

function saveRoundTripCore(state) {
  return {
    worldVersion: state.worldVersion,
    worldWidth: state.worldWidth,
    worldHeight: state.worldHeight,
    frame: state.frame,
    generation: state.generation,
    dayNight: state.dayNight,
    worldEvent: state.worldEvent,
    eco: state.eco,
    environmentInitialization: state.environmentInitialization,
    features: state.features,
    envState: state.envState,
    food: state.food,
    corpses: state.corpses,
    patches: state.patches,
    plankton: state.plankton,
    membranes: state.membranes,
    organisms: (state.organisms || []).map(o => ({
      id: o.id,
      x: o.x,
      y: o.y,
      vx: o.vx,
      vy: o.vy,
      energy: o.energy,
      age: o.age,
      birthFrame: o.birthFrame,
      lineageInitial: o.lineageInitial,
      parentId: o.parentId,
      mateParentId: o.mateParentId,
      generationDepth: o.generationDepth,
      birthExactDiet: o.birthExactDiet,
      birthDietClass: o.birthDietClass,
      protect: o.protect,
      storeN: o.storeN,
      storeO: o.storeO,
      storeD: o.storeD,
      mem: o.mem,
      genes: o.genes,
      role: o.role,
      socialMode: o.socialMode,
      sociality: o.sociality,
      speciesKey: o.speciesKey,
      speciesIdentityVersion: o.speciesIdentityVersion,
      traits: o.traits,
      flags: o.flags,
      morphologyTopology: o.morphologyTopology,
      packId: o.packId,
      packJoinFrame: o.packJoinFrame,
      packFounderId: o.packFounderId,
      packInheritedFromParent: o.packInheritedFromParent,
      packLeaveCandidateSince: o.packLeaveCandidateSince,
      lineageId: o.lineageId,
      canonicalAppearanceKey: o.canonicalAppearanceKey,
      lineageGeneration: o.lineageGeneration
    })),
    extinctRecords: state.extinctRecords,
    discoveredRareTraits: state.discoveredRareTraits,
    evolutionMilestones: state.evolutionMilestones,
    lineage: state.lineage ? {
      nodes: (state.lineage.nodes || []).map(([key, value]) => [key, { firstSeen: value?.firstSeen }]),
      edges: state.lineage.edges
    } : null,
    packIdentity: state.packIdentity,
    lineageRegistry: state.lineageRegistry,
    injectionBatches: state.injectionBatches
  };
}

function freeWorldPoint(organisms, ordinal = 0) {
  const candidates = [];
  for (let y = 70; y <= 618; y += 74) {
    for (let x = 70; x <= 802; x += 82) {
      const nearest = organisms.length ? Math.min(...organisms.map(o => Math.hypot(o.x - x, o.y - y))) : Infinity;
      candidates.push({ x, y, nearest });
    }
  }
  candidates.sort((a, b) => b.nearest - a.nearest);
  const point = candidates[Math.min(ordinal, candidates.length - 1)];
  return { x: point.x, y: point.y };
}

function ecologyCompact(run, errors) {
  const population = run.population || {};
  return {
    seed: run.seed,
    steps: run.steps,
    frame: run.frame,
    modelHash: hash(run.modelState),
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
    algae: run.environmentCurrent,
    carnivore: {
      maximum: run.maxCarnivores,
      end: run.endCarnivores,
      extinctionFrame: run.carnivoreExtinctionFrame,
      births: run.bornCarnivores
    },
    pack: {
      identity: run.lineage?.packIdentity,
      cooperativeTargeting: run.packCooperativeTargeting,
      bottleneck: run.packReproductionBottleneck
    },
    lineage: {
      maximumGenerationDepth: run.maxGenerationDepth,
      registry: run.lineageRegistryState || null
    },
    species: run.lineage?.species || null,
    predation: run.predation,
    conservation: run.conservation,
    health: run.health,
    browserErrors: errors
  };
}

async function initializeManualPage(page, seed) {
  await page.evaluate(options => {
    window.__alifeDebug.runSeededWorldDiagnostic(options);
  }, diagnosticOptions(seed, 1, false));
}

async function modelSteps(page, steps) {
  return page.evaluate(total => {
    let remaining = total;
    while (remaining > 0) {
      const n = Math.min(20, remaining);
      window.__alifeDebug.modelStep(n);
      remaining -= n;
    }
    return window.__alifeDebug.comparableModelState();
  }, steps);
}

async function dispatchPointer(page, type, pointerId, screen, pointerType = 'touch') {
  await page.evaluate(({ type, pointerId, screen, pointerType }) => {
    const canvas = document.getElementById('viewport');
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent(type, {
      pointerId,
      pointerType,
      clientX: rect.left + screen.x,
      clientY: rect.top + screen.y,
      bubbles: true,
      cancelable: true,
      isPrimary: pointerId === 1
    }));
  }, { type, pointerId, screen, pointerType });
}

async function viewportIndependence(browser) {
  const rows = [];
  for (const viewport of VIEWPORTS) {
    const result = await runDiagnostic(browser, HTML_FILE, viewport, 41001, INVARIANCE_STEPS, true);
    rows.push({
      viewport,
      geometry: result.geometry,
      hashes: categoryHashes(result.run.modelState),
      environment: result.run.environmentCurrent,
      population: result.run.population,
      errors: result.errors
    });
  }
  const canonical = await runDiagnostic(browser, HTML_FILE, CANONICAL_VIEWPORT, 41001, INVARIANCE_STEPS, true);
  const baseline = await runDiagnostic(browser, BASELINE_FILE, CANONICAL_VIEWPORT, 41001, INVARIANCE_STEPS, true);
  const expected = rows[0].hashes.full;
  const allMatch = rows.every(row => row.hashes.full === expected);

  const control = await openPage(browser, HTML_FILE, { width: 1365, height: 768 }, 41001);
  const operated = await openPage(browser, HTML_FILE, { width: 1365, height: 768 }, 41001);
  let cameraInvariance;
  try {
    await initializeManualPage(control.page, 41001);
    await initializeManualPage(operated.page, 41001);
    await modelSteps(control.page, 150);
    await modelSteps(operated.page, 150);
    for (let cycle = 0; cycle < 3; cycle++) {
      await operated.page.evaluate(index => {
        const debug = window.__alifeDebug;
        const state = debug.comparableModelState();
        const o = state.organisms[index % Math.max(1, state.organisms.length)];
        debug.panCameraByScreen(70 - index * 12, -48 + index * 9);
        const world = debug.worldGeometry();
        debug.zoomCameraAt(world.viewWidth * 0.46, world.viewHeight * 0.52, world.camera.zoom * 1.32);
        debug.fitCamera();
        if (o) {
          debug.selectOrganismById(o.id);
          debug.focusCamera(o.x, o.y, Math.max(world.camera.zoom, world.camera.minZoom * 2.2));
          debug.clearSelection();
        }
      }, cycle);
      await modelSteps(control.page, 150);
      await modelSteps(operated.page, 150);
    }
    const controlState = await control.page.evaluate(() => window.__alifeDebug.comparableModelState());
    const operatedState = await operated.page.evaluate(() => window.__alifeDebug.comparableModelState());
    cameraInvariance = {
      controlHash: hash(controlState),
      operatedHash: hash(operatedState),
      matches: hash(controlState) === hash(operatedState),
      controlErrors: control.errors,
      operatedErrors: operated.errors
    };
  } finally {
    await control.page.close();
    await operated.page.close();
  }

  return {
    generatedAt: new Date().toISOString(),
    baseCommit: 'ee359044fa3024bc13075d6aa9a0ee274eb966a8',
    seed: 41001,
    steps: INVARIANCE_STEPS,
    canonicalWorld: { width: 872, height: 688 },
    rows,
    allViewportModelHashesMatch: allMatch,
    canonicalCompatibility: {
      viewport: CANONICAL_VIEWPORT,
      baselineHash: hash(baseline.run.modelState),
      currentHash: hash(canonical.run.modelState),
      matches: hash(baseline.run.modelState) === hash(canonical.run.modelState),
      baselineErrors: baseline.errors,
      currentErrors: canonical.errors
    },
    cameraInvariance,
    badNumbers: finitePaths(rows)
  };
}

async function resizeInvariance(browser) {
  const control = await openPage(browser, HTML_FILE, { width: 1365, height: 768 }, 43001);
  const resized = await openPage(browser, HTML_FILE, { width: 1365, height: 768 }, 43001);
  try {
    await initializeManualPage(control.page, 43001);
    await initializeManualPage(resized.page, 43001);
    const sequence = [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1920, height: 1080 },
      { width: 1365, height: 768 }
    ];
    for (const viewport of sequence) {
      await modelSteps(control.page, 150);
      await modelSteps(resized.page, 150);
      await resized.page.setViewportSize(viewport);
      await resized.page.waitForTimeout(40);
    }
    const controlState = await control.page.evaluate(() => window.__alifeDebug.comparableModelState());
    const resizedState = await resized.page.evaluate(() => window.__alifeDebug.comparableModelState());
    const controlGeometry = await control.page.evaluate(() => window.__alifeDebug.worldGeometry());
    const resizedGeometry = await resized.page.evaluate(() => window.__alifeDebug.worldGeometry());
    return {
      generatedAt: new Date().toISOString(),
      seed: 43001,
      steps: sequence.length * 150,
      sequence,
      controlHash: hash(controlState),
      resizedHash: hash(resizedState),
      matches: hash(controlState) === hash(resizedState),
      categoryHashes: {
        control: categoryHashes(controlState),
        resized: categoryHashes(resizedState)
      },
      geometry: { control: controlGeometry, resized: resizedGeometry },
      errors: { control: control.errors, resized: resized.errors },
      badNumbers: finitePaths({ controlState, resizedState })
    };
  } finally {
    await control.page.close();
    await resized.page.close();
  }
}

async function inputAndSave(browser) {
  const boot = await openPage(browser, HTML_FILE, { width: 390, height: 844 }, 45001);
  const page = boot.page;
  try {
    await initializeManualPage(page, 45001);
    const initialState = await page.evaluate(() => window.__alifeDebug.comparableModelState());
    const organism = initialState.organisms[0];
    const organismScreen = await page.evaluate(o => window.__alifeDebug.worldToScreen(o.x, o.y), organism);
    await dispatchPointer(page, 'pointerdown', 1, organismScreen);
    await dispatchPointer(page, 'pointerup', 1, organismScreen);
    const selected = await page.evaluate(() => window.__alifeDebug.selectedOrganism());

    const foodBefore = await page.evaluate(() => window.__alifeDebug.interactionState().food.length);
    const foodWorld = freeWorldPoint(initialState.organisms, 0);
    const foodScreen = await page.evaluate(p => window.__alifeDebug.worldToScreen(p.x, p.y), foodWorld);
    await page.evaluate(() => window.__alifeDebug.setTool('food'));
    await dispatchPointer(page, 'pointerdown', 2, foodScreen);
    await dispatchPointer(page, 'pointerup', 2, foodScreen);
    const afterFood = await page.evaluate(() => window.__alifeDebug.interactionState());
    const newFood = afterFood.food.slice(foodBefore);

    const geometry = await page.evaluate(() => window.__alifeDebug.worldGeometry());
    const worldTop = await page.evaluate(() => window.__alifeDebug.worldToScreen(0, 0).y);
    const letterboxPoint = { x: geometry.viewWidth * 0.5, y: Math.max(1, worldTop * 0.35) };
    const letterboxBefore = afterFood.food.length;
    await dispatchPointer(page, 'pointerdown', 3, letterboxPoint);
    await dispatchPointer(page, 'pointerup', 3, letterboxPoint);
    const letterboxAfter = await page.evaluate(() => window.__alifeDebug.interactionState().food.length);

    const effectWorld = freeWorldPoint(initialState.organisms, 1);
    const effectScreen = await page.evaluate(p => window.__alifeDebug.worldToScreen(p.x, p.y), effectWorld);
    await page.evaluate(() => window.__alifeDebug.setTool('repel'));
    await dispatchPointer(page, 'pointerdown', 4, effectScreen);
    await dispatchPointer(page, 'pointerup', 4, effectScreen);
    const afterRepel = await page.evaluate(() => window.__alifeDebug.interactionState());

    const mutagenWorld = freeWorldPoint(initialState.organisms, 2);
    const mutagenScreen = await page.evaluate(p => window.__alifeDebug.worldToScreen(p.x, p.y), mutagenWorld);
    await page.evaluate(() => window.__alifeDebug.setTool('mutagen'));
    await dispatchPointer(page, 'pointerdown', 9, mutagenScreen);
    await dispatchPointer(page, 'pointerup', 9, mutagenScreen);
    const afterMutagen = await page.evaluate(() => window.__alifeDebug.interactionState());

    const membraneStartWorld = { x: 210, y: 220 };
    const membraneEndWorld = { x: 330, y: 286 };
    const membraneStart = await page.evaluate(p => window.__alifeDebug.worldToScreen(p.x, p.y), membraneStartWorld);
    const membraneEnd = await page.evaluate(p => window.__alifeDebug.worldToScreen(p.x, p.y), membraneEndWorld);
    await page.evaluate(() => window.__alifeDebug.setTool('membrane'));
    await dispatchPointer(page, 'pointerdown', 5, membraneStart);
    await dispatchPointer(page, 'pointermove', 5, membraneEnd);
    await dispatchPointer(page, 'pointerup', 5, membraneEnd);
    const afterMembrane = await page.evaluate(() => window.__alifeDebug.interactionState());

    await page.evaluate(() => window.__alifeDebug.setTool('food'));
    await page.evaluate(() => {
      const debug = window.__alifeDebug;
      const world = debug.worldGeometry();
      debug.zoomCameraAt(world.viewWidth * 0.5, world.viewHeight * 0.5, world.camera.minZoom * 2.2);
    });
    const cameraBeforePan = await page.evaluate(() => window.__alifeDebug.worldGeometry().camera);
    const panStart = { x: geometry.viewWidth * 0.55, y: geometry.viewHeight * 0.52 };
    const panEnd = { x: panStart.x - 74, y: panStart.y + 42 };
    const panFoodBefore = afterMembrane.food.length;
    await dispatchPointer(page, 'pointerdown', 6, panStart);
    await dispatchPointer(page, 'pointermove', 6, panEnd);
    await dispatchPointer(page, 'pointerup', 6, panEnd);
    const afterPan = await page.evaluate(() => ({ camera: window.__alifeDebug.worldGeometry().camera, interactions: window.__alifeDebug.interactionState() }));

    await page.evaluate(() => window.__alifeDebug.fitCamera());
    const pinchBefore = await page.evaluate(() => window.__alifeDebug.worldGeometry().camera);
    const pinchA0 = { x: geometry.viewWidth * 0.36, y: geometry.viewHeight * 0.5 };
    const pinchB0 = { x: geometry.viewWidth * 0.64, y: geometry.viewHeight * 0.5 };
    const pinchA1 = { x: geometry.viewWidth * 0.25, y: geometry.viewHeight * 0.5 };
    const pinchB1 = { x: geometry.viewWidth * 0.75, y: geometry.viewHeight * 0.5 };
    await dispatchPointer(page, 'pointerdown', 7, pinchA0);
    await dispatchPointer(page, 'pointerdown', 8, pinchB0);
    await dispatchPointer(page, 'pointermove', 7, pinchA1);
    await dispatchPointer(page, 'pointermove', 8, pinchB1);
    await dispatchPointer(page, 'pointerup', 7, pinchA1);
    await dispatchPointer(page, 'pointerup', 8, pinchB1);
    const pinchAfter = await page.evaluate(() => window.__alifeDebug.worldGeometry().camera);

    const mappingWorld = { x: 643.25, y: 511.75 };
    const mapping = await page.evaluate(world => {
      const screen = window.__alifeDebug.worldToScreen(world.x, world.y);
      const roundTrip = window.__alifeDebug.screenToWorld(screen.x, screen.y);
      return { world, screen, roundTrip, error: Math.hypot(world.x - roundTrip.x, world.y - roundTrip.y) };
    }, mappingWorld);

    await page.evaluate(options => window.__alifeDebug.runSeededWorldDiagnostic(options), {
      ...diagnosticOptions(45001, 300, false),
      preserveFeatureFlagsAfterRun: true
    });
    const beforeSave = await page.evaluate(() => {
      const save = window.__alifeDebug.captureSaveData();
      const decoded = JSON.parse(decodeURIComponent(escape(atob(save.split(':', 2)[1]))));
      return { save, decoded, camera: window.__alifeDebug.worldGeometry().camera };
    });
    const savedCore = saveRoundTripCore(beforeSave.decoded);
    const savedModelHash = hash(savedCore);
    await modelSteps(page, 80);
    const loadResult = await page.evaluate(save => window.__alifeDebug.restoreSaveData(save), beforeSave.save);
    const afterSave = await page.evaluate(() => {
      const save = window.__alifeDebug.captureSaveData();
      return {
        decoded: JSON.parse(decodeURIComponent(escape(atob(save.split(':', 2)[1])))),
        camera: window.__alifeDebug.worldGeometry().camera
      };
    });
    const loadedCore = saveRoundTripCore(afterSave.decoded);
    const loadedModelHash = hash(loadedCore);
    const oldSaveResult = await page.evaluate(save => {
      const state = JSON.parse(decodeURIComponent(escape(atob(save.split(':', 2)[1]))));
      delete state.worldVersion;
      delete state.worldWidth;
      delete state.worldHeight;
      const oldSave = 'ALIFE2:' + btoa(unescape(encodeURIComponent(JSON.stringify(state))));
      let alertText = null;
      const oldAlert = window.alert;
      window.alert = text => { alertText = String(text); };
      const result = window.__alifeDebug.restoreSaveData(oldSave);
      window.alert = oldAlert;
      return { result, alertText };
    }, beforeSave.save);

    const lastRepel = afterRepel.effects[afterRepel.effects.length - 1] || null;
    const lastMutagen = afterMutagen.effects[afterMutagen.effects.length - 1] || null;
    const lastMembrane = afterMembrane.membranes[afterMembrane.membranes.length - 1] || null;
    return {
      generatedAt: new Date().toISOString(),
      selection: {
        expectedId: organism.id,
        selected,
        matches: selected?.id === organism.id
      },
      food: {
        requestedWorld: foodWorld,
        createdCount: newFood.length,
        maximumDistance: newFood.length ? Math.max(...newFood.map(f => Math.hypot(f.x - foodWorld.x, f.y - foodWorld.y))) : null,
        mapped: newFood.length === 8 && newFood.every(f => Math.hypot(f.x - foodWorld.x, f.y - foodWorld.y) <= 57)
      },
      letterbox: {
        worldTopScreenY: worldTop,
        point: letterboxPoint,
        before: letterboxBefore,
        after: letterboxAfter,
        ignored: letterboxBefore === letterboxAfter
      },
      repel: {
        requestedWorld: effectWorld,
        actual: lastRepel,
        error: lastRepel ? Math.hypot(lastRepel.x - effectWorld.x, lastRepel.y - effectWorld.y) : null
      },
      mutagen: {
        requestedWorld: mutagenWorld,
        actual: lastMutagen,
        error: lastMutagen ? Math.hypot(lastMutagen.x - mutagenWorld.x, lastMutagen.y - mutagenWorld.y) : null
      },
      membrane: {
        requestedStartWorld: membraneStartWorld,
        requestedEndWorld: membraneEndWorld,
        actual: lastMembrane,
        endpointError: lastMembrane ? Math.min(
          Math.hypot(lastMembrane.x1 - membraneStartWorld.x, lastMembrane.y1 - membraneStartWorld.y) + Math.hypot(lastMembrane.x2 - membraneEndWorld.x, lastMembrane.y2 - membraneEndWorld.y),
          Math.hypot(lastMembrane.x2 - membraneStartWorld.x, lastMembrane.y2 - membraneStartWorld.y) + Math.hypot(lastMembrane.x1 - membraneEndWorld.x, lastMembrane.y1 - membraneEndWorld.y)
        ) : null
      },
      pan: {
        before: cameraBeforePan,
        after: afterPan.camera,
        changed: cameraBeforePan.x !== afterPan.camera.x || cameraBeforePan.y !== afterPan.camera.y,
        modelToolLeak: afterPan.interactions.food.length !== panFoodBefore
      },
      pinch: { before: pinchBefore, after: pinchAfter, zoomed: pinchAfter.zoom > pinchBefore.zoom },
      mapping,
      saveLoad: {
        worldVersion: beforeSave.decoded.worldVersion,
        worldWidth: beforeSave.decoded.worldWidth,
        worldHeight: beforeSave.decoded.worldHeight,
        loadResult,
        savedModelHash,
        loadedModelHash,
        modelRoundTripMatches: savedModelHash === loadedModelHash,
        firstModelDiff: firstDiff(savedCore, loadedCore),
        cameraAfterLoad: afterSave.camera,
        oldSaveRejected: oldSaveResult.result?.ok === false,
        oldSaveMessage: oldSaveResult.alertText
      },
      errors: boot.errors,
      badNumbers: finitePaths({ afterFood, afterRepel, afterMutagen, afterMembrane, afterPan, pinchAfter, mapping, afterSave })
    };
  } finally {
    await page.close();
  }
}

async function ecologySmoke(browser) {
  const rows = [];
  for (const seed of [41001, 43001, 45001]) {
    const result = await runDiagnostic(browser, HTML_FILE, CANONICAL_VIEWPORT, seed, SMOKE_STEPS, true);
    rows.push(ecologyCompact(result.run, result.errors));
  }
  return {
    generatedAt: new Date().toISOString(),
    viewport: CANONICAL_VIEWPORT,
    world: { width: 872, height: 688, environmentCells: 1911 },
    steps: SMOKE_STEPS,
    rows,
    totals: {
      energyCreationEvents: rows.reduce((sum, row) => sum + Number(row.conservation?.energyCreationEvents || 0), 0),
      nutrientCreationEvents: rows.reduce((sum, row) => sum + Number(row.conservation?.nutrientCreationEvents || 0), 0),
      browserErrors: rows.reduce((sum, row) => sum + row.browserErrors.length, 0)
    },
    badNumbers: finitePaths(rows)
  };
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  if (!fs.existsSync(BASELINE_FILE)) throw new Error(`Baseline file not found: ${BASELINE_FILE}`);
  const browser = await chromium.launch({ headless: true });
  try {
    const viewport = PHASE === 'interaction' ? JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'viewport_independence_results.json'), 'utf8')) : await viewportIndependence(browser);
    const resize = PHASE === 'interaction' ? JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'resize_invariance_results.json'), 'utf8')) : await resizeInvariance(browser);
    const interaction = await inputAndSave(browser);
    const ecology = PHASE === 'interaction' ? JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'fixed_world_ecology_smoke.json'), 'utf8')) : await ecologySmoke(browser);
    if (PHASE !== 'interaction') {
      fs.writeFileSync(path.join(OUTPUT_DIR, 'viewport_independence_results.json'), JSON.stringify(viewport, null, 2) + '\n', 'utf8');
      fs.writeFileSync(path.join(OUTPUT_DIR, 'resize_invariance_results.json'), JSON.stringify(resize, null, 2) + '\n', 'utf8');
      fs.writeFileSync(path.join(OUTPUT_DIR, 'fixed_world_ecology_smoke.json'), JSON.stringify(ecology, null, 2) + '\n', 'utf8');
    }
    fs.writeFileSync(path.join(OUTPUT_DIR, 'fixed_world_interaction_results.json'), JSON.stringify(interaction, null, 2) + '\n', 'utf8');
    const summary = {
      outputDir: OUTPUT_DIR,
      viewportHashesMatch: viewport.allViewportModelHashesMatch,
      canonicalCompatibility: viewport.canonicalCompatibility.matches,
      cameraInvariance: viewport.cameraInvariance.matches,
      resizeInvariance: resize.matches,
      input: {
        selection: interaction.selection.matches,
        food: interaction.food.mapped,
        letterbox: interaction.letterbox.ignored,
        repelError: interaction.repel.error,
        mutagenError: interaction.mutagen.error,
        membraneEndpointError: interaction.membrane.endpointError,
        pan: interaction.pan.changed && !interaction.pan.modelToolLeak,
        pinch: interaction.pinch.zoomed,
        mappingError: interaction.mapping.error
      },
      saveLoad: interaction.saveLoad,
      ecology: {
        seeds: ecology.rows.map(row => row.seed),
        energyCreationEvents: ecology.totals.energyCreationEvents,
        nutrientCreationEvents: ecology.totals.nutrientCreationEvents,
        browserErrors: ecology.totals.browserErrors,
        badNumbers: ecology.badNumbers.length
      }
    };
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
    if (!summary.viewportHashesMatch || !summary.canonicalCompatibility || !summary.cameraInvariance || !summary.resizeInvariance) process.exitCode = 2;
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  process.stderr.write((error && error.stack) ? error.stack + '\n' : String(error) + '\n');
  process.exitCode = 1;
});
