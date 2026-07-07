/*
 * render_organism.js — canonical organism appearance renderer (ALIFE)
 *
 * Single source of truth for "how a creature looks", shared by:
 *   - generator.html (design/curate the visual vocabulary)
 *   - index.html (the game) — integration is a later step
 *
 * Design rules (see Obsidian: 2026-07-07_次期バックログとロードマップ):
 *   - Appearance = f(genes, appearanceGenome). Nothing here touches stats.
 *   - Same species => same look & colour. A species is identified by its genes;
 *     its appearanceGenome is derived from the same seed, so it is stable.
 *   - Base colour stays diet-driven (herbivore cyan 195 -> carnivore red 6) so
 *     players can still read strategy from colour. appearanceGenome only adds
 *     accent hue / iridescence / surface detail on top.
 *
 * Plain global (window.RenderOrganism) on purpose: works from file:// and
 * GitHub Pages with a simple <script src>, no ES-module CORS headaches on phones.
 */
(function (global) {
  'use strict';
  var TAU = Math.PI * 2;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // deterministic string -> [0,1)
  function hash01(str) {
    var h = 2166136261 >>> 0;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= h >>> 15; h = Math.imul(h, 2246822507);
    h ^= h >>> 13; h = Math.imul(h, 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // seeded RNG (mulberry32) from a 32-bit uint seed
  function rngFromSeed(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var GENE_KEYS = ['speed', 'size', 'metabolism', 'fecundity', 'sense', 'diet', 'formSeed'];

  // ---- genes ---------------------------------------------------------------
  function genesFromSeed(seed) {
    var r = rngFromSeed(seed);
    var g = {};
    for (var i = 0; i < GENE_KEYS.length; i++) g[GENE_KEYS[i]] = r();
    return g;
  }

  // stable species id from genes (quantised — mirrors the game's speciesKey idea)
  function speciesId(genes) {
    function q(v) { return Math.round(clamp(v, 0, 1) * 3); }
    return q(genes.speed) + '' + q(genes.size) + '' + q(genes.sense) + '' + q(genes.diet) + '' + Math.round((genes.formSeed || 0) * 7);
  }

  // ---- silhouette family (topology) ---------------------------------------
  // Derived from functional genes only, so shape reflects strategy.
  function topologyFromGenes(g) {
    var detail = clamp((g.sense || 0) * 0.6 + (g.metabolism || 0) * 0.4, 0, 1);
    var length = clamp((g.speed || 0) * 0.6 + (g.formSeed || 0) * 0.4, 0, 1);
    if ((g.metabolism || 0) > 0.70 && (g.sense || 0) > 0.50 && (g.size || 0) > 0.40) return 'mesh';
    if (detail > 0.72 && (g.diet || 0) > 0.43) return 'radial';
    if ((g.metabolism || 0) > 0.62 && detail > 0.46 && length < 0.68) return 'ring';
    if ((g.sense || 0) > 0.66 && detail > 0.35) return 'branch';
    if ((g.fecundity || 0) > 0.66 && (g.size || 0) < 0.72) return 'cluster';
    if (length > 0.60 || ((g.speed || 0) > 0.58 && (g.sense || 0) > 0.42)) return 'chain';
    if ((g.metabolism || 0) > 0.55 && (g.speed || 0) < 0.40) return 'amoeba';
    return 'single';
  }

  function dietClass(diet) { return diet < 0.33 ? 'herb' : (diet < 0.66 ? 'omni' : 'carn'); }

  // ---- palette (same species => same colour) ------------------------------
  function palette(genes) {
    var sid = speciesId(genes);
    var dietHue = lerp(195, 6, clamp(genes.diet, 0, 1));          // cyan -> red
    var speedTint = lerp(-18, 18, clamp(genes.speed, 0, 1));
    var hue = (dietHue + speedTint * 0.25 + (hash01('hue:' + sid) - 0.5) * 90 + 360) % 360;
    var sat = 62 + Math.round(hash01('sat:' + sid) * 20);
    var light = 48 + Math.round(hash01('light:' + sid) * 14);
    var nucleusHue = (hue + 132 + hash01('nuc:' + sid) * 80) % 360;
    return { hue: hue, sat: sat, light: light, nucleusHue: nucleusHue, sid: sid };
  }

  // ---- appearance genome (cosmetic only) ----------------------------------
  // Derived from the species seed so it is stable per species; the generator
  // may override any field by hand. Speciation drift = new seed => new genome.
  var PATTERNS = ['none', 'spots', 'stripes', 'spiral', 'reticulate'];

  function appearanceFromSeed(seed) {
    var r = rngFromSeed((seed >>> 0) ^ 0x9e3779b9);
    return {
      waviness: 0.06 + r() * 0.34,      // outline undulation amount
      waveFreq: 3 + Math.floor(r() * 8), // undulation frequency
      asymmetry: r() * 0.30,             // left/right imbalance
      ciliaDensity: r(),                 // 0 none .. 1 dense fringe
      ciliaLength: 0.12 + r() * 0.55,    // relative hair length
      patternType: Math.floor(r() * PATTERNS.length),
      patternStrength: r() * 0.9,
      membraneOpacity: 0.45 + r() * 0.55,
      accentHue: r() * 360,              // decorative accent offset
      iridescence: r() * 0.8,
      coreSeed: r()                      // nucleus / organelle detail
    };
  }

  function makeSpecies(seed) {
    seed = (seed >>> 0);
    var genes = genesFromSeed(seed);
    return {
      seed: seed,
      genes: genes,
      appearanceGenome: appearanceFromSeed(seed),
      adaptations: [],   // e.g. ['toxin','spines','sessileFarmer','symbiotic']
      rareTraits: []     // e.g. ['glow','crown','colony','chl']
    };
  }

  // slightly perturb a species -> a "child species" that resembles the parent
  function driftSpecies(parent, amount) {
    amount = amount == null ? 0.12 : amount;
    var r = rngFromSeed((parent.seed >>> 0) ^ (0xabcdef | 0));
    var genes = {};
    for (var i = 0; i < GENE_KEYS.length; i++) {
      var k = GENE_KEYS[i];
      genes[k] = clamp(parent.genes[k] + (r() - 0.5) * 2 * amount, 0, 1);
    }
    var ag = {};
    var pag = parent.appearanceGenome;
    for (var f in pag) if (pag.hasOwnProperty(f)) {
      if (typeof pag[f] === 'number') {
        if (f === 'waveFreq') ag[f] = clamp(Math.round(pag[f] + (r() - 0.5) * 4), 3, 11);
        else if (f === 'patternType') ag[f] = clamp(Math.round(pag[f] + (r() - 0.5) * 2), 0, PATTERNS.length - 1);
        else ag[f] = pag[f] + (r() - 0.5) * 2 * amount * (f === 'accentHue' ? 60 : 0.35);
      } else ag[f] = pag[f];
    }
    return { seed: (parent.seed ^ Math.floor(r() * 1e9)) >>> 0, genes: genes, appearanceGenome: ag, adaptations: parent.adaptations.slice(), rareTraits: parent.rareTraits.slice() };
  }

  // ---- drawing -------------------------------------------------------------
  // draws centred at (0,0); caller sets up translate/scale. `size` is body radius px.
  function draw(ctx, spec, size, opts) {
    opts = opts || {};
    var genes = spec.genes;
    var ag = spec.appearanceGenome;
    var pal = palette(genes);
    var topo = topologyFromGenes(genes);
    var pts = Math.max(28, (ag.waveFreq || 5) * 6);
    var baseR = size;
    var glow = (spec.rareTraits && spec.rareTraits.indexOf('glow') >= 0);

    // radius function of angle for the wavy microbial membrane
    function radiusAt(t) {
      var w = ag.waviness * Math.sin((ag.waveFreq) * t + ag.coreSeed * TAU);
      var a = ag.asymmetry * Math.sin(t + 1.3);
      var shape = 1;
      if (topo === 'chain') shape = 0.62 + 0.5 * Math.abs(Math.cos(t));      // elongated
      else if (topo === 'ring') shape = 1;                                    // handled by donut hole
      else if (topo === 'radial') shape = 1 + 0.22 * Math.cos((ag.waveFreq | 0) * t); // lobed
      else if (topo === 'amoeba') shape = 1 + 0.18 * Math.sin(3 * t + 0.7) + 0.12 * Math.sin(7 * t);
      return baseR * shape * (1 + w + a);
    }

    ctx.save();

    // cilia (drawn under the body so they read as a fringe)
    if (ag.ciliaDensity > 0.04) {
      var nc = Math.round(lerp(8, 60, ag.ciliaDensity));
      ctx.strokeStyle = 'hsla(' + pal.hue + ',' + pal.sat + '%,' + (pal.light + 22) + '%,0.5)';
      ctx.lineWidth = Math.max(0.6, baseR * 0.03);
      for (var c = 0; c < nc; c++) {
        var ct = (c / nc) * TAU;
        var rr = radiusAt(ct);
        var len = baseR * ag.ciliaLength * (0.6 + 0.4 * ((c * 7) % 5) / 5);
        var wob = 0.25 * Math.sin(c * 1.7 + (opts.phase || 0));
        ctx.beginPath();
        ctx.moveTo(Math.cos(ct) * rr, Math.sin(ct) * rr);
        ctx.lineTo(Math.cos(ct + wob) * (rr + len), Math.sin(ct + wob) * (rr + len));
        ctx.stroke();
      }
    }

    // body path
    ctx.beginPath();
    for (var i = 0; i <= pts; i++) {
      var t = (i / pts) * TAU;
      var r = radiusAt(t);
      var x = Math.cos(t) * r, y = Math.sin(t) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();

    // body fill: radial gradient in species colour
    var grad = ctx.createRadialGradient(0, 0, baseR * 0.1, 0, 0, baseR * 1.15);
    grad.addColorStop(0, 'hsla(' + pal.hue + ',' + pal.sat + '%,' + (pal.light + 18) + '%,0.96)');
    grad.addColorStop(0.6, 'hsla(' + pal.hue + ',' + pal.sat + '%,' + pal.light + '%,0.9)');
    grad.addColorStop(1, 'hsla(' + ((pal.hue + ag.accentHue * 0.15) % 360) + ',' + pal.sat + '%,' + (pal.light - 14) + '%,0.86)');
    ctx.fillStyle = grad;
    if (glow) { ctx.shadowColor = 'hsla(' + pal.hue + ',90%,70%,0.9)'; ctx.shadowBlur = baseR * 0.9; }
    ctx.fill();
    ctx.shadowBlur = 0;

    // iridescent accent rim
    if (ag.iridescence > 0.05) {
      ctx.strokeStyle = 'hsla(' + (ag.accentHue % 360) + ',90%,72%,' + (0.15 + ag.iridescence * 0.5) + ')';
      ctx.lineWidth = Math.max(0.8, baseR * 0.05);
      ctx.stroke();
    }

    // membrane outline
    ctx.strokeStyle = 'hsla(' + pal.hue + ',' + Math.min(90, pal.sat + 12) + '%,' + (pal.light + 26) + '%,' + ag.membraneOpacity + ')';
    ctx.lineWidth = Math.max(0.8, baseR * 0.045);
    ctx.stroke();

    // surface pattern (clipped to body)
    if (ag.patternType > 0 && ag.patternStrength > 0.05) {
      ctx.save();
      ctx.clip();
      drawPattern(ctx, ag, pal, baseR);
      ctx.restore();
    }

    // ring topology: punch a lighter hole to read as a torus
    if (topo === 'ring') {
      ctx.save(); ctx.clip();
      var hg = ctx.createRadialGradient(0, 0, 0, 0, 0, baseR * 0.55);
      hg.addColorStop(0, 'rgba(6,12,30,0.85)');
      hg.addColorStop(1, 'rgba(6,12,30,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, 0, baseR * 0.55, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // cluster/colony: extra small blobs
    if (topo === 'cluster' || (spec.rareTraits && spec.rareTraits.indexOf('colony') >= 0)) {
      var nb = 4;
      for (var b = 0; b < nb; b++) {
        var bt = (b / nb) * TAU + 0.5;
        var bx = Math.cos(bt) * baseR * 0.8, by = Math.sin(bt) * baseR * 0.8;
        ctx.beginPath(); ctx.arc(bx, by, baseR * 0.3, 0, TAU);
        ctx.fillStyle = 'hsla(' + pal.hue + ',' + pal.sat + '%,' + (pal.light + 6) + '%,0.9)';
        ctx.fill();
      }
    }

    // nucleus (round, kept inside)
    if (topo !== 'ring') {
      var ng = ctx.createRadialGradient(0, 0, 0, 0, 0, baseR * 0.42);
      ng.addColorStop(0, 'hsla(' + pal.nucleusHue + ',90%,88%,0.92)');
      ng.addColorStop(0.55, 'hsla(' + pal.nucleusHue + ',75%,52%,0.7)');
      ng.addColorStop(1, 'hsla(' + pal.nucleusHue + ',70%,40%,0)');
      ctx.fillStyle = ng;
      ctx.beginPath(); ctx.arc(0, 0, baseR * 0.42, 0, TAU); ctx.fill();
    }

    // crown rare trait: little spikes on top
    if (spec.rareTraits && spec.rareTraits.indexOf('crown') >= 0) {
      ctx.strokeStyle = 'hsla(' + ((pal.hue + 40) % 360) + ',90%,75%,0.9)';
      ctx.lineWidth = Math.max(0.8, baseR * 0.05);
      for (var k = 0; k < 5; k++) {
        var kt = -Math.PI / 2 + (k - 2) * 0.28;
        var kr = radiusAt(kt);
        ctx.beginPath();
        ctx.moveTo(Math.cos(kt) * kr, Math.sin(kt) * kr);
        ctx.lineTo(Math.cos(kt) * (kr + baseR * 0.3), Math.sin(kt) * (kr + baseR * 0.3));
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawPattern(ctx, ag, pal, R) {
    var type = PATTERNS[ag.patternType];
    var alpha = 0.15 + ag.patternStrength * 0.5;
    ctx.fillStyle = 'hsla(' + ((pal.nucleusHue + 20) % 360) + ',80%,70%,' + alpha + ')';
    ctx.strokeStyle = 'hsla(' + ((pal.nucleusHue + 20) % 360) + ',80%,72%,' + alpha + ')';
    ctx.lineWidth = Math.max(0.6, R * 0.04);
    var i;
    if (type === 'spots') {
      for (i = 0; i < 14; i++) {
        var a = hash01('spx' + i) * TAU, d = hash01('spd' + i) * R * 0.9;
        ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, R * (0.06 + 0.08 * hash01('spr' + i)), 0, TAU); ctx.fill();
      }
    } else if (type === 'stripes') {
      for (i = -6; i <= 6; i++) {
        ctx.beginPath(); ctx.moveTo(-R * 1.2, i * R * 0.22); ctx.lineTo(R * 1.2, i * R * 0.22); ctx.stroke();
      }
    } else if (type === 'spiral') {
      ctx.beginPath();
      for (i = 0; i < 120; i++) {
        var th = i * 0.28, rr = (i / 120) * R * 1.1;
        var x = Math.cos(th) * rr, y = Math.sin(th) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else if (type === 'reticulate') {
      for (i = -6; i <= 6; i++) {
        ctx.beginPath(); ctx.moveTo(-R * 1.2, i * R * 0.24); ctx.lineTo(R * 1.2, i * R * 0.24); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(i * R * 0.24, -R * 1.2); ctx.lineTo(i * R * 0.24, R * 1.2); ctx.stroke();
      }
    }
  }

  global.RenderOrganism = {
    GENE_KEYS: GENE_KEYS,
    PATTERNS: PATTERNS,
    clamp: clamp,
    hash01: hash01,
    genesFromSeed: genesFromSeed,
    appearanceFromSeed: appearanceFromSeed,
    makeSpecies: makeSpecies,
    driftSpecies: driftSpecies,
    speciesId: speciesId,
    topologyFromGenes: topologyFromGenes,
    dietClass: dietClass,
    palette: palette,
    draw: draw
  };
})(typeof window !== 'undefined' ? window : this);
