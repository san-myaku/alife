/*
 * render_organism.js — canonical organism appearance renderer (ALIFE)
 *
 * Shared by generator.html (design/curate) and, later, index.html (the game).
 *
 * This version reproduces the game's "Sea-Glass" look: family-based silhouette,
 * translucent gene-tinted body, interior frost / ambient occlusion / rim, a
 * round nucleus, and cilia — ported faithfully from the game's draw code
 * (index.html: formFromGenes / prepareSymbolDetails / drawSymbolicLive) so the
 * generator matches the game. The appearanceGenome is layered on top as
 * cosmetic-only detail.
 *
 * Design rules:
 *   - Appearance = f(genes, appearanceGenome). Nothing here touches stats.
 *   - Same species => same look & colour (everything derives from genes/seed).
 *   - Base look/colour is gene-driven (diet -> hue). appearanceGenome only adds
 *     accent hue / pattern / cilia detail on top.
 *
 * NOTE: not yet byte-identical to the game's full symbol/node system; the true
 * single-source unification is planned together with the render perf work.
 *
 * Plain global (window.RenderOrganism): works from file:// and GitHub Pages.
 */
(function (global) {
  'use strict';
  var TAU = Math.PI * 2;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function q4(v) { return Math.round(clamp(v, 0, 1) * 4) / 4; }

  function hash01(str) {
    var h = 2166136261 >>> 0; str = String(str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
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
  var PATTERNS = ['none', 'spots', 'stripes', 'spiral', 'reticulate'];
  // family index -> name (ported from the game's comment at prepareSymbolDetails)
  var FAMILIES = ['mantle', 'leaf', 'segmented', 'jelly', 'star', 'tube', 'ribbon', 'armored', 'disc', 'colony'];

  // ---- form (ported from index.html formFromGenes) -------------------------
  function formFromGenes(g, key) {
    key = key || '';
    var speed = clamp(g.speed, 0, 1), sense = clamp(g.sense, 0, 1), size = clamp(g.size, 0, 1),
        met = clamp(g.metabolism, 0, 1), diet = clamp(g.diet, 0, 1), seed = clamp(g.formSeed, 0, 1);
    function rv(salt) { return hash01('form:' + salt + ':' + q4(seed) + ':' + q4(speed) + ':' + q4(size) + ':' + q4(sense) + ':' + q4(diet) + ':' + key); }
    var length = clamp(0.10 + 0.58 * speed + 0.22 * (1 - size) + 0.10 * rv('len'), 0, 1);
    var detail = clamp(0.12 + 0.56 * sense + 0.18 * diet + 0.14 * rv('detail'), 0, 1);
    var wave = clamp(0.10 + 0.42 * (1 - size) + 0.20 * rv('wave'), 0, 1);
    var layout = clamp(0.64 * seed + 0.36 * rv('layout'), 0, 0.999);
    var shape = clamp(0.58 * seed + 0.42 * rv('shape'), 0, 0.999);
    return { length: length, detail: detail, wave: wave, layout: layout, shape: shape, phaseJitter: rv('phase') * 0.2 };
  }

  // resolve the full render spec (family, edges, aspect...) from genes
  function morphFromGenes(g) {
    var form = formFromGenes(g);
    var fam = Math.floor(clamp(form.shape, 0, 0.999) * 10);
    var edgeCount = Math.round(lerp(0, 6, form.detail));
    var edgeAmp = lerp(0.0, 0.45, form.wave);
    var aspect = lerp(1.0, 3.2, form.length);
    if (fam === 1 || fam === 2 || fam === 6) aspect = Math.max(1.2, aspect * 1.6);
    if (fam === 3) { edgeCount = 0; edgeAmp = 0; }
    if (fam === 4) { edgeCount = 5 + Math.round(form.detail * 7); edgeAmp = Math.max(edgeAmp, 0.28); }
    return {
      form: form, family: fam, edgeCount: edgeCount, edgeAmp: edgeAmp, aspect: aspect,
      segCount: 7 + Math.round(form.detail * 10),
      facetN: 4 + Math.round(form.detail * 8),
      petalN: 8 + Math.round(form.detail * 12)
    };
  }

  function speciesId(genes) {
    return q4(genes.speed) + ':' + q4(genes.size) + ':' + q4(genes.sense) + ':' + q4(genes.diet) + ':' + q4(genes.formSeed);
  }
  function topologyFromGenes(g) { return FAMILIES[morphFromGenes(g).family] || 'mantle'; }
  function dietClass(diet) { return diet < 0.33 ? 'herb' : (diet < 0.66 ? 'omni' : 'carn'); }

  // ---- palette (ported from index.html speciesPalette) ---------------------
  function palette(genes) {
    var sid = speciesId(genes);
    var dietHue = lerp(195, 6, clamp(genes.diet, 0, 1));   // herbivore cyan -> carnivore red
    var speedTint = lerp(-18, 18, clamp(genes.speed, 0, 1));
    var hue = (dietHue + speedTint * 0.25 + (hash01('speciesHue:' + sid) - 0.5) * 96 + 360) % 360;
    var sat = 58 + Math.round(hash01('speciesSat:' + sid) * 16);
    var nucleusHue = (hue + 132 + hash01('speciesNucleus:' + sid) * 86) % 360;
    return { hue: hue, sat: sat, nucleusHue: nucleusHue, sid: sid };
  }

  // ---- appearance genome (cosmetic only) ----------------------------------
  function appearanceFromSeed(seed) {
    var r = rngFromSeed((seed >>> 0) ^ 0x9e3779b9);
    return {
      waviness: 0.06 + r() * 0.34, waveFreq: 3 + Math.floor(r() * 8), asymmetry: r() * 0.30,
      ciliaDensity: r(), ciliaLength: 0.12 + r() * 0.55,
      // bias toward none/spots so surface markings stay a subtle accent, not a dominant overlay
      patternType: Math.floor(Math.pow(r(), 2) * PATTERNS.length), patternStrength: r() * 0.5,
      membraneOpacity: 0.45 + r() * 0.55, accentHue: r() * 360, iridescence: r() * 0.8, coreSeed: r()
    };
  }
  function genesFromSeed(seed) { var r = rngFromSeed(seed), g = {}; for (var i = 0; i < GENE_KEYS.length; i++) g[GENE_KEYS[i]] = r(); return g; }
  function makeSpecies(seed) {
    seed = (seed >>> 0);
    return { seed: seed, genes: genesFromSeed(seed), appearanceGenome: appearanceFromSeed(seed), adaptations: [], rareTraits: [] };
  }
  function driftSpecies(parent, amount) {
    amount = amount == null ? 0.12 : amount;
    var r = rngFromSeed((parent.seed >>> 0) ^ 0xabcdef);
    var genes = {}, i;
    for (i = 0; i < GENE_KEYS.length; i++) { var k = GENE_KEYS[i]; genes[k] = clamp(parent.genes[k] + (r() - 0.5) * 2 * amount, 0, 1); }
    var ag = {}, pag = parent.appearanceGenome;
    for (var f in pag) if (pag.hasOwnProperty(f)) {
      if (typeof pag[f] !== 'number') { ag[f] = pag[f]; }
      else if (f === 'waveFreq') ag[f] = clamp(Math.round(pag[f] + (r() - 0.5) * 4), 3, 11);
      else if (f === 'patternType') ag[f] = clamp(Math.round(pag[f] + (r() - 0.5) * 2), 0, PATTERNS.length - 1);
      else ag[f] = pag[f] + (r() - 0.5) * 2 * amount * (f === 'accentHue' ? 60 : 0.35);
    }
    return { seed: (parent.seed ^ Math.floor(r() * 1e9)) >>> 0, genes: genes, appearanceGenome: ag, adaptations: parent.adaptations.slice(), rareTraits: parent.rareTraits.slice() };
  }

  // ---- Sea-Glass silhouette (ported from drawSymbolicLive body loop) -------
  function familyRadius(fam, t, m, phase, frame) {
    var r = 1, ry = 1, rx = 1;
    if (fam === 1) { r *= 1 + 0.18 * Math.cos(t - 0.45); ry *= 0.74; }
    else if (fam === 2) { r *= 1 + 0.05 * Math.sin(m.segCount * t + frame * 0.01); ry *= 0.58; rx *= 1.12; }
    else if (fam === 3) { r *= 1 + 0.06 * Math.sin(8 * t + phase); ry *= 0.92 + 0.08 * Math.cos(t); }
    else if (fam === 4) { r *= 1 + 0.28 * Math.sin(m.petalN * 0.5 * t + phase); }
    else if (fam === 5) { r *= 1 + 0.05 * Math.sin(6 * t); ry *= 0.42; rx *= 1.25; }
    else if (fam === 6) { r *= 1 + 0.12 * Math.sin(3 * t + phase); ry *= 0.34; rx *= 1.55; }
    else if (fam === 7) { r *= 0.95 + 0.10 * (Math.sin(m.facetN * t + 0.3) >= 0 ? 1 : -1); }
    else if (fam === 8) { r *= 1 + 0.05 * Math.sin(14 * t + phase); ry *= 0.82; rx *= 0.98; }
    else if (fam === 9) { r *= 1 + 0.08 * Math.sin(5 * t + phase) + 0.05 * Math.sin(11 * t); }
    return { r: r, rx: rx, ry: ry };
  }

  // draws centred at (0,0); `size` ~ body radius px.
  function draw(ctx, spec, size, opts) {
    opts = opts || {};
    var genes = spec.genes, ag = spec.appearanceGenome;
    var m = morphFromGenes(genes), pal = palette(genes);
    var frame = opts.frame || 0;
    var phase = hash01('phase:' + pal.sid) * TAU + (ag.coreSeed || 0) * 0.6;
    var glow = spec.rareTraits && spec.rareTraits.indexOf('glow') >= 0;

    // Sea-glass optical properties (representative fresh adult; age-driven frost simplified)
    var ageF = 0.12;
    var frost = clamp(0.15 + 0.35 * ageF * (0.5 + 0.5 * (1 - genes.metabolism)), 0, 0.65);
    var clarity = clamp(0.80 - frost + 0.05 * (1 - genes.size) + 0.05, 0.30, 0.95);
    var hue = pal.hue, sat = pal.sat;
    var dispAspect = Math.min(m.aspect, 3.2); // keep ribbons from becoming hair-thin cell-wide streaks

    // unit silhouette (rx = aspect, ry = 1); scaled to fit the cell afterwards
    function unitAt(t) {
      var wave = m.edgeCount > 0 ? Math.sin(m.edgeCount * t + phase) * m.edgeAmp : 0;
      var membrane = Math.sin((ag.waveFreq || 5) * t + phase + frame * 0.006) * (0.02 + ag.waviness * 0.06);
      var fm = familyRadius(m.family, t, m, phase, frame);
      var r = Math.max(0.48, 1 + wave + membrane) * fm.r;
      return { x: Math.cos(t) * dispAspect * fm.rx * r, y: Math.sin(t) * fm.ry * r };
    }
    var segs = 80, pts = [], hw = 0.001, hh = 0.001;
    for (var pi = 0; pi <= segs; pi++) {
      var pt = unitAt(pi / segs * TAU); pts.push(pt);
      if (Math.abs(pt.x) > hw) hw = Math.abs(pt.x);
      if (Math.abs(pt.y) > hh) hh = Math.abs(pt.y);
    }
    var k = size / Math.max(hw, hh);           // uniform fit into a box of half-size `size`
    for (var pk = 0; pk < pts.length; pk++) { pts[pk].x *= k; pts[pk].y *= k; }
    var s = size;                              // interior layers are clipped to the silhouette

    ctx.save();

    // cilia under the body (lighter blend) — family bias + genome density
    var ciliaBias = (m.family === 3 || m.family === 4 || m.family === 8) ? 1.0 : 0.55;
    var nc = Math.round(lerp(6, 44, clamp(ciliaBias * (0.4 + 0.6 * ag.ciliaDensity), 0, 1)));
    if (nc > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'hsla(' + ((hue + 35) % 360) + ',86%,84%,0.16)';
      ctx.lineWidth = Math.max(0.5, s * 0.03);
      for (var ci = 0; ci < nc; ci++) {
        var p = pts[Math.floor(ci / nc * segs)];
        var pulse = 0.75 + 0.25 * Math.sin(ci * 0.9 + phase);
        var len = s * (0.14 + ag.ciliaLength * 0.34) * pulse;
        var mag = Math.sqrt(p.x * p.x + p.y * p.y) || 1;
        ctx.beginPath();
        ctx.moveTo(p.x * 0.98, p.y * 0.98);
        ctx.lineTo(p.x + p.x / mag * len, p.y + p.y / mag * len);
        ctx.stroke();
      }
      ctx.restore();
    }

    // body silhouette (precomputed, fitted points)
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i].x, pts[i].y); else ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();

    // BASE: translucent radial gradient (transmitted colour)
    var c1 = 'hsla(' + hue + ',' + sat + '%,70%,' + (0.65 * clarity) + ')';
    var c2 = 'hsla(' + hue + ',' + sat + '%,40%,' + (0.85 * clarity) + ')';
    var rg = ctx.createRadialGradient(-s * 0.25, -s * 0.25, Math.max(1, s * 0.2), 0, 0, s * 1.2);
    rg.addColorStop(0, c1); rg.addColorStop(1, c2);
    if (glow) { ctx.shadowColor = 'hsla(' + hue + ',90%,70%,0.9)'; ctx.shadowBlur = s * 0.8; }
    ctx.fillStyle = rg; ctx.fill();
    ctx.shadowBlur = 0;

    // clip to silhouette for interior layers
    ctx.save(); ctx.clip();

    // FROST interior haze
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    var fog = ctx.createRadialGradient(0, 0, 1, 0, 0, s * 1.05);
    fog.addColorStop(0, 'rgba(255,255,255,' + (0.18 * frost) + ')');
    fog.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = fog; ctx.fillRect(-s * 3, -s * 3, s * 6, s * 6);
    ctx.restore();

    // INNER ambient occlusion (bottom darkening)
    var ao = ctx.createRadialGradient(0, s * 0.35, 1, 0, s * 0.35, s * 1.1);
    ao.addColorStop(0, 'rgba(0,0,0,0.06)'); ao.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.globalAlpha = 0.6; ctx.fillStyle = ao; ctx.fillRect(-s * 3, -s * 3, s * 6, s * 6);
    ctx.globalAlpha = 1;

    // cosmetic surface pattern (appearanceGenome), subtle, clipped to the body polygon
    if (ag.patternType > 0 && ag.patternStrength > 0.05) drawPattern(ctx, ag, pal, s, pts);

    ctx.restore(); // end clip

    // membrane rim
    ctx.strokeStyle = 'hsla(' + hue + ',' + sat + '%,82%,' + (0.30 * ag.membraneOpacity + 0.12) + ')';
    ctx.lineWidth = Math.max(0.6, s * 0.03);
    ctx.stroke();

    // iridescent accent rim (cosmetic)
    if (ag.iridescence > 0.05) {
      ctx.strokeStyle = 'hsla(' + (ag.accentHue % 360) + ',90%,76%,' + (0.10 + ag.iridescence * 0.28) + ')';
      ctx.lineWidth = Math.max(0.5, s * 0.02);
      ctx.stroke();
    }

    // NUCLEUS / vacuole
    var nx = (hash01('nx:' + pal.sid) - 0.5) * s * 0.3, ny = (hash01('ny:' + pal.sid) - 0.5) * s * 0.3;
    var nr = s * (0.26 + 0.1 * hash01('nr:' + pal.sid));
    var ng = ctx.createRadialGradient(nx - s * 0.08, ny - s * 0.10, 0.5, nx, ny, nr * 1.45);
    ng.addColorStop(0, 'hsla(' + pal.nucleusHue + ',92%,86%,0.40)');
    ng.addColorStop(0.55, 'hsla(' + pal.nucleusHue + ',70%,58%,0.22)');
    ng.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(nx, ny, nr * 1.45, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'hsla(' + pal.nucleusHue + ',90%,88%,0.26)';
    ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(nx, ny, nr, 0, TAU); ctx.stroke();

    ctx.restore();
  }

  function drawPattern(ctx, ag, pal, R, pts) {
    var type = PATTERNS[ag.patternType];
    var alpha = 0.05 + ag.patternStrength * 0.13;   // subtle interior texture
    ctx.save();
    // clip to the body's bounding box (reliable even for thin/self-intersecting silhouettes)
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (var pp = 0; pp < pts.length; pp++) {
      if (pts[pp].x < minX) minX = pts[pp].x; if (pts[pp].x > maxX) maxX = pts[pp].x;
      if (pts[pp].y < minY) minY = pts[pp].y; if (pts[pp].y > maxY) maxY = pts[pp].y;
    }
    ctx.beginPath(); ctx.rect(minX, minY, maxX - minX, maxY - minY); ctx.clip();
    ctx.fillStyle = 'hsla(' + ((pal.nucleusHue + 20) % 360) + ',80%,72%,' + alpha + ')';
    ctx.strokeStyle = 'hsla(' + ((pal.nucleusHue + 20) % 360) + ',80%,74%,' + alpha + ')';
    ctx.lineWidth = Math.max(0.5, R * 0.025);
    var i;
    if (type === 'spots') {
      for (i = 0; i < 10; i++) { var a = hash01('spx' + i) * TAU, d = hash01('spd' + i) * R * 0.5; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, R * (0.04 + 0.05 * hash01('spr' + i)), 0, TAU); ctx.fill(); }
    } else if (type === 'stripes') {
      for (i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(-R * 0.7, i * R * 0.2); ctx.lineTo(R * 0.7, i * R * 0.2); ctx.stroke(); }
    } else if (type === 'spiral') {
      ctx.beginPath(); for (i = 0; i < 70; i++) { var th = i * 0.34, rr = (i / 70) * R * 0.6; var x = Math.cos(th) * rr, y = Math.sin(th) * rr; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
    } else if (type === 'reticulate') {
      for (i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-R * 0.6, i * R * 0.24); ctx.lineTo(R * 0.6, i * R * 0.24); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * R * 0.24, -R * 0.6); ctx.lineTo(i * R * 0.24, R * 0.6); ctx.stroke(); }
    }
    ctx.restore();
  }

  global.RenderOrganism = {
    GENE_KEYS: GENE_KEYS, PATTERNS: PATTERNS, FAMILIES: FAMILIES,
    clamp: clamp, hash01: hash01,
    genesFromSeed: genesFromSeed, appearanceFromSeed: appearanceFromSeed,
    makeSpecies: makeSpecies, driftSpecies: driftSpecies, speciesId: speciesId,
    morphFromGenes: morphFromGenes, topologyFromGenes: topologyFromGenes, dietClass: dietClass,
    palette: palette, draw: draw
  };
})(typeof window !== 'undefined' ? window : this);
