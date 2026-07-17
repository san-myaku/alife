/*
 * Generator-only organism concept renderer.
 *
 * This file is intentionally not used by the game. It explores a more
 * illustrated roster look before any shared renderer integration happens.
 */
(function (global) {
  "use strict";

  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function hashStr32(s) {
    let h = 0x811c9dc5;
    s = String(s || "");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function rngFrom(seed) {
    let x = hashStr32(seed) || 1;
    return function () {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      x >>>= 0;
      return x / 4294967296;
    };
  }

  function hsla(h, s, l, a) {
    return "hsla(" + ((h % 360) + 360) % 360 + "," + s + "%," + l + "%," + a + ")";
  }

  function genesOf(o) {
    return o.genes || {};
  }

  function isSpecial(o) {
    // Only genuine "mega" specials take the purple trophic category.
    // Diet drives colour otherwise, so mesh/glow/chl no longer hijack the hue.
    return !!o.isMega;
  }

  function paletteFor(o, opts) {
    const g = genesOf(o);
    const diet = clamp(g.diet == null ? 0.5 : g.diet, 0, 1);
    const speed = clamp(g.speed == null ? 0.5 : g.speed, 0, 1);
    const sense = clamp(g.sense == null ? 0.5 : g.sense, 0, 1);
    const key = String(o.speciesKey || o.id || "organism");
    const hJitter = (hashStr32("h:" + key) / 4294967296 - 0.5) * 20;
    let hue;
    if (isSpecial(o)) hue = 270 + hJitter;
    else if (diet < 0.33) hue = lerp(150, 186, speed) + hJitter;
    else if (diet < 0.66) hue = lerp(38, 56, sense) + hJitter;
    else hue = lerp(338, 6, speed) + hJitter;
    if (opts && opts.groupColor) {
      hue = hue * 0.72 + parseHexHue(opts.groupColor) * 0.28;
    }
    return {
      hue,
      sat: 52 + Math.round(15 * sense),
      light: 53 + Math.round(9 * (1 - diet)),
      dark: hsla(hue - 8, 54, 30, 0.54),
      line: hsla(hue - 12, 58, 30, 0.38),
      bright: hsla(hue + 18, 78, 84, 0.72),
      faint: hsla(hue + 10, 74, 80, 0.13),
      coreHue: hue + 125 + (hashStr32("c:" + key) / 4294967296) * 70
    };
  }

  function parseHexHue(hex) {
    if (!hex || hex.charAt(0) !== "#") return 190;
    const n = parseInt(hex.slice(1), 16);
    if (!Number.isFinite(n)) return 190;
    const r = ((n >> 16) & 255) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max === min) return 0;
    let h = 0;
    if (max === r) h = (g - b) / (max - min) + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / (max - min) + 2;
    else h = (r - g) / (max - min) + 4;
    return h * 60;
  }

  function bodyGradient(ctx, r, pal, alpha) {
    const g = ctx.createRadialGradient(-r * 0.25, -r * 0.34, r * 0.06, 0, 0, r * 1.24);
    g.addColorStop(0, hsla(pal.hue + 26, 66, 94, alpha * 0.92));
    g.addColorStop(0.45, hsla(pal.hue, pal.sat, pal.light + 13, alpha * 0.82));
    g.addColorStop(1, hsla(pal.hue - 18, pal.sat + 4, Math.max(30, pal.light - 10), alpha));
    return g;
  }

  function drawShadow(ctx, r) {
    ctx.save();
    ctx.fillStyle = "rgba(28,58,72,.16)";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.84, r * 0.76, r * 0.15, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawBlobPath(ctx, r, aspect, irregular, point, rng) {
    const n = 64;
    const ph = rng() * TAU;      // fixed phase: no rng() inside the loop, so start==end (no seam notch)
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const front = Math.max(0, Math.cos(a));
      const lobes = 1 + irregular * 0.15 * Math.sin(a * 3 + ph) +
        irregular * 0.08 * Math.sin(a * 5 + ph * 1.7);
      const taper = 1 + point * 0.13 * front - point * 0.07 * Math.max(0, -Math.cos(a));
      const x = Math.cos(a) * r * aspect * lobes * taper;
      const y = Math.sin(a) * r * (1 + irregular * 0.06 * Math.cos(a * 4));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawSoftMembranePath(ctx, r, aspect, wobble, rng) {
    const n = 72;
    const p1 = rng() * TAU;
    const p2 = rng() * TAU;
    const p3 = rng() * TAU;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const lobe = 1 +
        wobble * 0.13 * Math.sin(a * 2 + p1) +
        wobble * 0.08 * Math.sin(a * 3 + p2) +
        wobble * 0.05 * Math.sin(a * 5 + p3);
      const x = Math.cos(a) * r * aspect * lobe;
      const y = Math.sin(a) * r * (1 + wobble * 0.05 * Math.sin(a * 2 + p2));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function fillAndStroke(ctx, r, pal, alpha) {
    ctx.fillStyle = bodyGradient(ctx, r, pal, alpha == null ? 0.82 : alpha);
    ctx.fill();
    // glassy top-left glaze: light passing through the translucent membrane (clipped to body)
    ctx.save();
    ctx.clip();
    ctx.globalCompositeOperation = "screen";
    const gl = ctx.createRadialGradient(-r * 0.34, -r * 0.44, r * 0.04, -r * 0.18, -r * 0.26, r * 1.16);
    gl.addColorStop(0, hsla(pal.hue + 30, 72, 96, 0.30));
    gl.addColorStop(0.5, hsla(pal.hue + 20, 60, 90, 0.06));
    gl.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gl;
    ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4);
    ctx.restore();
    // crisp ink outline (confident dark contour, like a field-guide plate)
    ctx.strokeStyle = hsla(pal.hue - 14, 46, 22, 0.66);
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.stroke();
    // bright glass rim on the lit edge
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = hsla(pal.hue + 26, 62, 95, 0.24);
    ctx.lineWidth = Math.max(0.6, r * 0.02);
    ctx.stroke();
    ctx.restore();
  }

  function drawNucleus(ctx, x, y, r, pal, rng, alpha) {
    const g = ctx.createRadialGradient(x - r * 0.22, y - r * 0.30, r * 0.05, x, y, r);
    g.addColorStop(0, hsla(pal.coreHue, 82, 88, alpha || 0.96));
    g.addColorStop(0.52, hsla(pal.coreHue, 78, 48, (alpha || 0.96) * 0.92));
    g.addColorStop(1, hsla(pal.coreHue - 30, 78, 24, (alpha || 0.96) * 0.74));
    ctx.save();
    ctx.fillStyle = g;
    ctx.strokeStyle = "rgba(35,63,73,.38)";
    ctx.lineWidth = Math.max(0.8, r * 0.10);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.62)";
    ctx.beginPath();
    ctx.arc(x - r * 0.26, y - r * 0.30, r * 0.24, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawGranules(ctx, r, pal, rng, count, chl) {
    ctx.save();
    for (let i = 0; i < count; i++) {
      const a = rng() * TAU;
      const d = Math.sqrt(rng()) * r * 0.68;
      const x = Math.cos(a) * d * (0.82 + rng() * 0.28);
      const y = Math.sin(a) * d * (0.72 + rng() * 0.22);
      const rr = r * (0.045 + rng() * 0.055);
      const hue = chl ? lerp(94, 128, rng()) : pal.hue + lerp(-26, 34, rng());
      ctx.fillStyle = hsla(hue, chl ? 72 : 68, chl ? 48 : 62, 0.46);
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(38,78,82,.18)";
      ctx.lineWidth = Math.max(0.35, rr * 0.14);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSurfaceSpeckles(ctx, r, pal, rng, count, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < count; i++) {
      const a = rng() * TAU;
      const d = Math.sqrt(rng()) * r * (0.28 + rng() * 0.50);
      const rr = r * (0.010 + rng() * 0.026);
      ctx.fillStyle = hsla(pal.hue + 28, 48, 96, (alpha || 0.20) * (0.45 + rng() * 0.55));
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, rr, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFineHalo(ctx, r, pal, rng, count, len, alpha) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = hsla(pal.hue + 16, 52, 70, alpha || 0.20);
    ctx.lineWidth = Math.max(0.55, r * 0.014);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + (rng() - 0.5) * 0.10;
      const inner = r * (0.76 + rng() * 0.10);
      const outer = r * (1.02 + len * (0.22 + rng() * 0.42));
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.quadraticCurveTo(
        Math.cos(a + 0.06) * (inner + outer) * 0.5,
        Math.sin(a + 0.06) * (inner + outer) * 0.5,
        Math.cos(a + (rng() - 0.5) * 0.10) * outer,
        Math.sin(a + (rng() - 0.5) * 0.10) * outer
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOvalCell(ctx, x, y, rx, ry, angle, pal, rng, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    const rr = Math.max(rx, ry);
    const g = ctx.createRadialGradient(-rx * 0.26, -ry * 0.30, rr * 0.05, 0, 0, rr);
    g.addColorStop(0, hsla(pal.hue + 24, 64, 94, alpha || 0.78));
    g.addColorStop(0.52, hsla(pal.hue, pal.sat, pal.light + 12, (alpha || 0.78) * 0.86));
    g.addColorStop(1, hsla(pal.hue - 14, pal.sat + 4, pal.light - 8, (alpha || 0.78) * 0.92));
    ctx.fillStyle = g;
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = Math.max(0.45, rr * 0.035);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    drawSurfaceSpeckles(ctx, rr, pal, rng, 3, 0.22);
    drawNucleus(ctx, -rx * 0.10, -ry * 0.02, Math.min(rx, ry) * 0.24, pal, rng, 0.70);
    ctx.restore();
  }

  function variantIndex(o, salt, count) {
    const key = String(o.speciesKey || o.id || "x") + ":" + salt + ":" + Math.round(((o.genes || {}).formSeed || 0) * 997);
    return hashStr32(key) % count;
  }

  // formSeed buckets this list, so the "form" gene picks the plain-body silhouette.
  // Order is load-bearing: the generator derives each form's formSeed from the index.
  const SINGLE_SHAPES = [
    "single-cell", "single-teardrop", "single-pear", "single-gourd", "single-clover",
    "single-trefoil", "single-triangle", "single-fan", "single-star", "single-shard",
    "single-crescent", "single-needle", "single-serpent", "single-forktail",
    "single-sawback", "single-dart", "single-barb", "single-finned", "single-trap"
  ];

  function visualKind(o) {
    const g = genesOf(o);
    const flags = o.flags || {};
    const topology = o.morphologyTopology || "single";
    if (topology === "chain") {
      return variantIndex(o, "chain", 2) === 1 ? "chain-segment" : "chain-beads";
    }
    if (topology === "cluster") {
      const v = variantIndex(o, "cluster", 3);
      return v === 1 ? "cluster-rosette" : (v === 2 ? "cluster-membrane" : "cluster-bubbles");
    }
    if (topology === "single") {
      if ((g.speed || 0.5) > 0.62 || flags.chl) return "single-leaf";
      if ((o.form && o.form.aspect > 1.46) && (g.size || 0.5) > 0.38) return "single-spindle";
      // formSeed picks the plain-body silhouette so the "form" gene has real reach.
      var singleShapes = SINGLE_SHAPES;
      return singleShapes[Math.min(singleShapes.length - 1, Math.floor((g.formSeed == null ? 0.5 : g.formSeed) * singleShapes.length))];
    }
    // formSeed also splits the two radial bodies (spines/beads are appendages, not forms)
    if (topology === "radial") return (g.formSeed == null ? 0.5 : g.formSeed) < 0.5 ? "radial-arms" : "radial-star";
    if (topology === "branch") return "branch-vesicles";
    if (topology === "ring") return "ring";
    if (topology === "amoeba") return "amoeba";
    if (topology === "mesh") return "mesh-lace";
    return "single-cell";
  }

  function drawAttachedFlagellum(ctx, sx, sy, angle, length, pal, rng, alpha) {
    const root = Math.max(1.0, length * 0.030);
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = hsla(pal.hue + 18, 64, 42, alpha || 0.42);
    ctx.lineWidth = root;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    const c1x = sx + Math.cos(angle) * length * 0.34 - Math.sin(angle) * length * 0.12;
    const c1y = sy + Math.sin(angle) * length * 0.34 + Math.cos(angle) * length * 0.12;
    const c2x = sx + Math.cos(angle) * length * 0.66 + Math.sin(angle) * length * 0.18;
    const c2y = sy + Math.sin(angle) * length * 0.66 - Math.cos(angle) * length * 0.18;
    const ex = sx + Math.cos(angle) * length;
    const ey = sy + Math.sin(angle) * length;
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, ex, ey);
    ctx.stroke();
    ctx.strokeStyle = hsla(pal.hue + 34, 66, 88, 0.22);
    ctx.lineWidth = Math.max(0.55, root * 0.45);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, ex, ey);
    ctx.stroke();
    ctx.restore();
  }

  function drawSegmentationLines(ctx, r, pal, count, angle) {
    ctx.save();
    ctx.rotate(angle || 0);
    ctx.strokeStyle = hsla(pal.hue - 8, 50, 34, 0.18);
    ctx.lineWidth = Math.max(0.55, r * 0.018);
    for (let i = 1; i < count; i++) {
      const x = lerp(-r * 0.58, r * 0.58, i / count);
      ctx.beginPath();
      ctx.moveTo(x, -r * 0.32);
      ctx.quadraticCurveTo(x + r * 0.05, 0, x, r * 0.32);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawChainEdgeCilia(ctx, n, step, r, pal, rng, pred) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = hsla(pal.hue + 16, 62, pred ? 58 : 74, pred ? 0.42 : 0.32);
    ctx.lineWidth = Math.max(0.65, r * 0.014);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * step;
      const y = Math.sin(i * 0.9) * r * 0.18;
      const rr = r * lerp(0.30, 0.43, 1 - Math.abs(i / Math.max(1, n - 1) - 0.5) * 1.2);
      const roots = pred ? [-0.84, 0.84] : [-0.88, -0.55, 0.55, 0.88];
      for (const side of roots) {
        if (rng() < (pred ? 0.16 : 0.12)) continue;
        const sx = x + (rng() - 0.5) * rr * 0.70;
        const sy = y + side * rr * 0.72;
        const len = r * (0.16 + rng() * (pred ? 0.22 : 0.16));
        const outward = side < 0 ? -Math.PI / 2 : Math.PI / 2;
        const bend = (rng() - 0.5) * 0.44;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(
          sx + Math.cos(outward + bend) * len * 0.50,
          sy + Math.sin(outward + bend) * len * 0.50,
          sx + Math.cos(outward + bend * 0.6) * len,
          sy + Math.sin(outward + bend * 0.6) * len
        );
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawSegmentBodyCilia(ctx, r, pal, rng, pred) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = hsla(pal.hue + 16, 54, pred ? 52 : 70, pred ? 0.28 : 0.20);
    ctx.lineWidth = Math.max(0.55, r * 0.010);
    const count = 12;
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const x = lerp(-r * 0.82, r * 0.82, t);
      const top = i % 2 === 0 ? -1 : 1;
      const y = top * r * (0.28 + rng() * 0.08);
      const len = r * (0.15 + rng() * 0.14);
      const a = top < 0 ? -Math.PI / 2 : Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (rng() - 0.5) * r * 0.07, y + Math.sin(a) * len * 0.48, x + (rng() - 0.5) * r * 0.10, y + Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCilia(ctx, r, pal, rng, count, len, alpha) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = hsla(pal.hue + 18, 84, 73, alpha || 0.34);
    ctx.lineWidth = Math.max(0.65, r * 0.025);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + rng() * 0.08;
      const inner = r * (0.76 + rng() * 0.10);
      const outer = r * (1 + len * (0.32 + rng() * 0.32));
      const bend = (rng() - 0.5) * r * 0.14;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.quadraticCurveTo(
        Math.cos(a) * (inner + outer) * 0.5 - Math.sin(a) * bend,
        Math.sin(a) * (inner + outer) * 0.5 + Math.cos(a) * bend,
        Math.cos(a) * outer,
        Math.sin(a) * outer
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSpines(ctx, r, pal, rng, count, len) {
    ctx.save();
    ctx.strokeStyle = hsla(pal.hue - 10, 90, 50, 0.58);
    ctx.fillStyle = hsla(pal.hue + 10, 90, 70, 0.28);
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.lineJoin = "round";
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + rng() * 0.05;
      const base = r * (0.86 + rng() * 0.10);
      const tip = r * (1.08 + len * (0.34 + rng() * 0.22));
      const spread = 0.035 + rng() * 0.035;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - spread) * base, Math.sin(a - spread) * base);
      ctx.lineTo(Math.cos(a) * tip, Math.sin(a) * tip);
      ctx.lineTo(Math.cos(a + spread) * base, Math.sin(a + spread) * base);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawAntennae(ctx, r, pal, rng, count) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = hsla(pal.hue + 35, 72, 42, 0.50);
    ctx.lineWidth = Math.max(0.9, r * 0.035);
    for (let i = 0; i < count; i++) {
      const a = -Math.PI * 0.72 + (i / Math.max(1, count - 1)) * Math.PI * 1.44;
      const len = r * (0.76 + rng() * 0.30);
      const x1 = Math.cos(a) * r * 0.68;
      const y1 = Math.sin(a) * r * 0.68;
      const x2 = Math.cos(a) * (r + len);
      const y2 = Math.sin(a) * (r + len);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo((x1 + x2) * 0.52, (y1 + y2) * 0.52 - r * 0.12, x2, y2);
      ctx.stroke();
      drawNucleus(ctx, x2, y2, r * 0.13, pal, rng, 0.85);
    }
    ctx.restore();
  }

  // sessile-farmer roots: branching tendrils spreading outward/down onto the field.
  function drawRootTendrils(ctx, r, pal, rng) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = hsla(pal.hue - 6, 42, 48, 0.42);
    const roots = 4 + Math.floor(rng() * 3);
    for (let i = 0; i < roots; i++) {
      const a = Math.PI * 0.18 + (i / Math.max(1, roots - 1)) * Math.PI * 0.64; // fan downward
      let x = Math.cos(a) * r * 0.72, y = Math.sin(a) * r * 0.72, ang = a;
      const segs = 3 + Math.floor(rng() * 3);
      for (let s = 0; s < segs; s++) {
        ctx.lineWidth = Math.max(0.7, r * 0.05 * (1 - s / (segs + 1)));
        const step = r * (0.38 + rng() * 0.42);
        ang += (rng() - 0.5) * 0.7;
        const nx = x + Math.cos(ang) * step, ny = y + Math.sin(ang) * step;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
        if (rng() < 0.5) {
          const ba = ang + (rng() - 0.5) * 1.3, bl = r * (0.28 + rng() * 0.34);
          ctx.lineWidth = Math.max(0.6, r * 0.03);
          ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx + Math.cos(ba) * bl, ny + Math.sin(ba) * bl); ctx.stroke();
        }
        x = nx; y = ny;
      }
    }
    ctx.restore();
  }

  function drawRare(ctx, o, r, pal, rng) {
    const f = o.flags || {};
    if (f.glow) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(120,225,255,.22)";
      for (let i = 0; i < 4; i++) {
        const a = rng() * TAU;
        const d = r * (0.18 + rng() * 0.45);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * (0.07 + rng() * 0.05), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawCellBlob(ctx, o, r, pal, rng) {
    const g = genesOf(o);
    const form = o.form || {};
    const aspect = 0.90 + (form.aspect || 1.2) * 0.22;
    const point = clamp((g.speed || 0.5) * 0.62 + (g.diet || 0.5) * 0.28, 0, 1);
    const irregular = 0.25 + clamp(form.detail || 0.5, 0, 1) * 0.78;
    ctx.save();
    if ((g.speed || 0.5) > 0.62) ctx.rotate(-0.24 + rng() * 0.18);
    drawBlobPath(ctx, r, aspect, irregular, point, rng);
    fillAndStroke(ctx, r, pal, 0.68);
    ctx.clip();
    drawGranules(ctx, r, pal, rng, 7 + Math.round((form.detail || 0.5) * 10), !!(o.flags && o.flags.chl));
    drawSurfaceSpeckles(ctx, r, pal, rng, 18, 0.24);
    drawNucleus(ctx, -r * 0.12, -r * 0.03, r * 0.23, pal, rng, 0.92);
    ctx.restore();
  }

  function drawLeaf(ctx, o, r, pal, rng) {
    const g = genesOf(o);
    ctx.save();
    ctx.rotate(-0.30 + rng() * 0.22);
    const pts = _sampleSegs([
      [{x:-r*0.92,y:r*0.05},{x:-r*0.40,y:-r*0.78},{x:r*0.42,y:-r*0.92},{x:r*1.12,y:-r*0.10}],
      [{x:r*1.12,y:-r*0.10},{x:r*0.42,y:r*0.75},{x:-r*0.42,y:r*0.74},{x:-r*0.92,y:r*0.05}]
    ], 22);
    appendageBehind(ctx, o, r, pal, rng, pts); // selectable appendage, behind the body
    ctx.beginPath();
    ctx.moveTo(-r * 0.92, r * 0.05);
    ctx.bezierCurveTo(-r * 0.40, -r * 0.78, r * 0.42, -r * 0.92, r * 1.12, -r * 0.10);
    ctx.bezierCurveTo(r * 0.42, r * 0.75, -r * 0.42, r * 0.74, -r * 0.92, r * 0.05);
    ctx.closePath();
    fillAndStroke(ctx, r, pal, 0.60);
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = hsla(pal.hue - 18, 78, 36, 0.30);
    ctx.lineWidth = Math.max(0.8, r * 0.025);
    for (let i = 0; i < 6; i++) {
      const y = -r * 0.42 + i * r * 0.16;
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, y);
      ctx.bezierCurveTo(-r * 0.10, y - r * 0.10, r * 0.35, y - r * 0.04, r * 0.70, y * 0.32);
      ctx.stroke();
    }
    drawGranules(ctx, r, pal, rng, 5 + Math.round((g.metabolism || 0.5) * 10), !!(o.flags && o.flags.chl));
    drawSurfaceSpeckles(ctx, r, pal, rng, 12, 0.20);
    ctx.restore();
    drawNucleus(ctx, -r * 0.05, -r * 0.02, r * 0.17, pal, rng, 0.85);
    ctx.restore();
  }

  function drawSpindle(ctx, o, r, pal, rng) {
    const g = genesOf(o);
    ctx.save();
    ctx.rotate(-0.24 + rng() * 0.20);
    const pts = _sampleSegs([
      [{x:-r*1.02,y:r*0.02},{x:-r*0.62,y:-r*0.46},{x:r*0.32,y:-r*0.52},{x:r*1.12,y:-r*0.08}],
      [{x:r*1.12,y:-r*0.08},{x:r*0.52,y:r*0.48},{x:-r*0.54,y:r*0.48},{x:-r*1.02,y:r*0.02}]
    ], 22);
    appendageBehind(ctx, o, r, pal, rng, pts); // selectable appendage, behind the body
    ctx.beginPath();
    ctx.moveTo(-r * 1.02, r * 0.02);
    ctx.bezierCurveTo(-r * 0.62, -r * 0.46, r * 0.32, -r * 0.52, r * 1.12, -r * 0.08);
    ctx.bezierCurveTo(r * 0.52, r * 0.48, -r * 0.54, r * 0.48, -r * 1.02, r * 0.02);
    ctx.closePath();
    fillAndStroke(ctx, r, pal, 0.58);
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = hsla(pal.hue - 8, 62, 42, 0.20);
    ctx.lineWidth = Math.max(0.8, r * 0.024);
    for (let i = 0; i < 5; i++) {
      const y = -r * 0.22 + i * r * 0.11;
      ctx.beginPath();
      ctx.moveTo(-r * 0.62, y);
      ctx.bezierCurveTo(-r * 0.12, y - r * 0.08, r * 0.42, y + r * 0.04, r * 0.78, y * 0.45);
      ctx.stroke();
    }
    drawGranules(ctx, r * 0.82, pal, rng, 6 + Math.round((g.metabolism || 0.5) * 8), !!(o.flags && o.flags.chl));
    drawSurfaceSpeckles(ctx, r, pal, rng, 14, 0.18);
    ctx.restore();
    drawNucleus(ctx, -r * 0.22, -r * 0.02, r * 0.17, pal, rng, 0.88);
    ctx.restore();
  }

  // crescent / lune: a clean banana arc that bows upward, tapering to pointed tips.
  function drawCrescent(ctx, o, r, pal, rng) {
    ctx.save();
    ctx.rotate((rng() - 0.5) * 0.34);
    const A = 1.18, Rc = r * 1.28, cyc = r * 0.62, wmax = r * 0.62, m = 44;
    const pts = [], outer = [], outerN = [];
    for (let i = 0; i <= m; i++) {
      const a = -A + (i / m) * 2 * A;
      const w = wmax * (1 - Math.pow(a / A, 2));
      const cx = Math.sin(a) * Rc, cy = cyc - Math.cos(a) * Rc;
      const ox = Math.sin(a), oy = -Math.cos(a);
      const p = { x: cx + ox * w * 0.5, y: cy + oy * w * 0.5 };
      pts.push(p); outer.push(p); outerN.push({ nx: ox, ny: oy }); // convex edge + its true outward normal
    }
    for (let i = m; i >= 0; i--) {
      const a = -A + (i / m) * 2 * A;
      const w = wmax * (1 - Math.pow(a / A, 2));
      const cx = Math.sin(a) * Rc, cy = cyc - Math.cos(a) * Rc;
      const ox = Math.sin(a), oy = -Math.cos(a);
      pts.push({ x: cx - ox * w * 0.5, y: cy - oy * w * 0.5 });
    }
    // appendages only on the outer convex edge, so nothing juts into the hollow of the crescent
    appendageBehind(ctx, o, r, pal, rng, outer, { normals: outerN });
    _fillOutline(ctx, pts);
    fillAndStroke(ctx, r, pal, 0.64);
    ctx.save();
    ctx.clip();
    drawGranules(ctx, r * 0.7, pal, rng, 6, !!(o.flags && o.flags.chl));
    drawSurfaceSpeckles(ctx, r, pal, rng, 8, 0.16);
    ctx.restore();
    const na = -0.12, ncx = Math.sin(na) * Rc, ncy = cyc - Math.cos(na) * Rc;
    drawNucleus(ctx, ncx, ncy + r * 0.02, r * 0.14, pal, rng, 0.90);
    ctx.restore();
  }

  // needle / thin spindle: a very elongated lens pointed at both tips.
  function drawNeedle(ctx, o, r, pal, rng) {
    const g = genesOf(o);
    ctx.save();
    ctx.rotate((rng() - 0.5) * 0.28);
    const L = r * 1.66, wid = r * 0.30;
    const pts = _sampleSegs([
      [{x:0,y:-L},{x:wid*0.7,y:-L*0.5},{x:wid,y:-L*0.05},{x:wid,y:0}],
      [{x:wid,y:0},{x:wid,y:L*0.05},{x:wid*0.7,y:L*0.5},{x:0,y:L}],
      [{x:0,y:L},{x:-wid*0.7,y:L*0.5},{x:-wid,y:L*0.05},{x:-wid,y:0}],
      [{x:-wid,y:0},{x:-wid,y:-L*0.05},{x:-wid*0.7,y:-L*0.5},{x:0,y:-L}]
    ], 14);
    appendageBehind(ctx, o, r, pal, rng, pts); // selectable appendage, behind the body
    ctx.beginPath();
    ctx.moveTo(0, -L);
    ctx.bezierCurveTo(wid * 0.7, -L * 0.5, wid, -L * 0.05, wid, 0);
    ctx.bezierCurveTo(wid, L * 0.05, wid * 0.7, L * 0.5, 0, L);
    ctx.bezierCurveTo(-wid * 0.7, L * 0.5, -wid, L * 0.05, -wid, 0);
    ctx.bezierCurveTo(-wid, -L * 0.05, -wid * 0.7, -L * 0.5, 0, -L);
    ctx.closePath();
    fillAndStroke(ctx, r, pal, 0.60);
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = hsla(pal.hue - 8, 60, 42, 0.20);
    ctx.lineWidth = Math.max(0.7, r * 0.02);
    for (let i = 0; i < 5; i++) {
      const y = -L * 0.4 + i * L * 0.2;
      ctx.beginPath();
      ctx.moveTo(-wid * 0.7, y);
      ctx.quadraticCurveTo(0, y + r * 0.05, wid * 0.7, y);
      ctx.stroke();
    }
    drawSurfaceSpeckles(ctx, r, pal, rng, 8, 0.16);
    ctx.restore();
    drawNucleus(ctx, 0, 0, r * 0.15, pal, rng, 0.90);
    ctx.restore();
  }

  // teeth following a smooth sampled curve; `teeth` are spaced evenly along it and
  // their apexes point away from the body centre (up into the open mouth).
  function drawTeeth(ctx, curvePts, cen, r, pal, teeth) {
    ctx.save();
    ctx.strokeStyle = hsla(pal.hue - 14, 52, 26, 0.66);
    ctx.fillStyle = hsla(pal.hue + 20, 60, 90, 0.55);
    ctx.lineWidth = Math.max(0.6, r * 0.02);
    ctx.lineJoin = "round";
    function at(t) {
      const f = t * (curvePts.length - 1), i = Math.min(curvePts.length - 2, Math.floor(f)), u = f - i;
      return { x: curvePts[i].x + (curvePts[i + 1].x - curvePts[i].x) * u, y: curvePts[i].y + (curvePts[i + 1].y - curvePts[i].y) * u };
    }
    for (let k = 0; k < teeth; k++) {
      const p0 = at(k / teeth), p1 = at((k + 1) / teeth), pm = at((k + 0.5) / teeth);
      const dx = p1.x - p0.x, dy = p1.y - p0.y, len = Math.hypot(dx, dy) || 1;
      let nx = -dy / len, ny = dx / len;
      if ((pm.x - cen.x) * nx + (pm.y - cen.y) * ny < 0) { nx = -nx; ny = -ny; }
      const depth = r * (0.16 + 0.12 * Math.sin(((k + 0.5) / teeth) * Math.PI));
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(pm.x + nx * depth, pm.y + ny * depth);
      ctx.lineTo(p1.x, p1.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  // carnivorous flytrap: a left-right symmetric leaf that tapers to a thin trailing
  // tail and opens into a smooth, wide toothed mouth between two jaw tips.
  function drawTrap(ctx, o, r, pal, rng) {
    const g = genesOf(o);
    ctx.save();
    ctx.rotate((rng() - 0.5) * 0.10);
    const LT = { x: -r * 0.95, y: -r * 1.00 };  // left jaw tip
    const RT = { x: r * 0.95, y: -r * 1.00 };   // right jaw tip
    const TB = { x: 0, y: r * 1.70 };           // thin tail tip (bottom centre)
    const mc1 = { x: r * 0.42, y: -r * 0.30 };  // mouth control (dips to a throat)
    const mc2 = { x: -r * 0.42, y: -r * 0.30 };
    // selectable appendage placed along the two outer flanks (not the mouth), drawn behind.
    const appPts = _sampleSegs([
      [LT, {x:-r*1.05,y:-r*0.10}, {x:-r*0.30,y:r*1.22}, TB],
      [TB, {x:r*0.30,y:r*1.22}, {x:r*1.05,y:-r*0.10}, RT]
    ], 20);
    appendageBehind(ctx, o, r, pal, rng, appPts);
    ctx.beginPath();
    ctx.moveTo(LT.x, LT.y);
    ctx.bezierCurveTo(-r * 1.05, -r * 0.10, -r * 0.30, r * 1.22, TB.x, TB.y);  // left flank down to the thin tail
    ctx.bezierCurveTo(r * 0.30, r * 1.22, r * 1.05, -r * 0.10, RT.x, RT.y);     // mirror: tail up to the right jaw
    ctx.bezierCurveTo(mc1.x, mc1.y, mc2.x, mc2.y, LT.x, LT.y);                   // smooth mouth lip RT -> LT
    ctx.closePath();
    fillAndStroke(ctx, r, pal, 0.62);
    ctx.save();
    ctx.clip();
    drawGranules(ctx, r, pal, rng, 9, !!(o.flags && o.flags.chl));
    drawSurfaceSpeckles(ctx, r, pal, rng, 12, 0.20);
    ctx.restore();
    // the toothed mouth is a built-in trait carried by only some species (others gape smooth).
    const hasTeeth = (hashStr32((o.speciesKey || "x") + ":teeth") % 1000) < 520;
    if (hasTeeth) {
      const mouth = [], M = 20;
      for (let i = 0; i <= M; i++) mouth.push(_bez(RT, mc1, mc2, LT, i / M));
      drawTeeth(ctx, mouth, { x: 0, y: r * 0.35 }, r, pal, 9 + Math.round((g.diet || 0.5) * 4));
    }
    drawNucleus(ctx, 0, r * 0.42, r * 0.15, pal, rng, 0.90);
    ctx.restore();
  }

  // Plain-body silhouette variants (traced path -> filled body -> interior).
  function pathTeardrop(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.30);
    ctx.bezierCurveTo(r * 0.92, -r * 0.40, r * 0.86, r * 0.98, 0, r * 1.02);
    ctx.bezierCurveTo(-r * 0.86, r * 0.98, -r * 0.92, -r * 0.40, 0, -r * 1.30);
    ctx.closePath();
  }
  function pathPear(ctx, r) {
    // gourd/pear: big bottom bulge + small top bulge with a concave waist between.
    const n = 80; ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const cy = Math.sin(a);        // -1 top .. 1 bottom (canvas y)
      const t = -cy;                 // 1 top .. -1 bottom
      const bottom = Math.exp(-Math.pow((t + 0.5) / 0.5, 2));
      const top = Math.exp(-Math.pow((t - 0.6) / 0.36, 2));
      const w = 0.66 * bottom + 0.40 * top + 0.06;
      const x = Math.cos(a) * r * w * 1.45;
      const y = cy * r * 1.12;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  function pathTrefoil(ctx, r) {
    const n = 96; ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const rr = r * (0.72 + 0.36 * Math.max(0, Math.cos(3 * (a + Math.PI / 2))));
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  function pathTriangle(ctx, r) {
    const n = 90; ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const rr = r * (0.98 + 0.20 * Math.cos(3 * a - Math.PI / 2));
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  function pathFan(ctx, r) {
    const spread = 1.05;
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, 0);
    ctx.arc(-r * 0.55, 0, r * 1.5, -spread, spread);
    ctx.closePath();
  }
  // ---- outline-based single bodies -------------------------------------------
  // Each plain-body form is generated as boundary POINTS so appendages can attach
  // to the real silhouette (along the outward normal) and be drawn BEHIND the body.
  function _bez(p0, c1, c2, p1, t) {
    const u = 1 - t;
    return { x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
             y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y };
  }
  // sample a chain of cubic-bezier segments ([p0,c1,c2,p1]) into a boundary point list.
  function _sampleSegs(segs, per) {
    const pts = [];
    for (let s = 0; s < segs.length; s++) {
      const g = segs[s];
      for (let i = 0; i < per; i++) pts.push(_bez(g[0], g[1], g[2], g[3], i / per));
    }
    return pts;
  }
  // Per-species shape dial in [0,1). Stable for a species, independent per `salt`, and
  // nudged by formSeed so the "form" gene still has reach inside a single form.
  function shapeVar(o, salt) {
    const key = String(o.speciesKey || o.id || "x") + ":shape:" + salt + ":" +
      Math.round(((o.genes || {}).formSeed || 0) * 997);
    return hashStr32(key) / 4294967296;
  }
  function svLerp(o, salt, lo, hi) { return lo + (hi - lo) * shapeVar(o, salt); }
  // sharp-tipped star: explicit tips joined by edges that bow deep toward the centre,
  // so the points stay needle-sharp instead of rounding off into petals.
  function _concaveStar(tips, inward) {
    const segs = [];
    for (let i = 0; i < tips.length; i++) {
      const a = tips[i], b = tips[(i + 1) % tips.length];
      const c = { x: (a.x + b.x) * 0.5 * inward, y: (a.y + b.y) * 0.5 * inward };
      segs.push([a, c, c, b]);
    }
    return _sampleSegs(segs, 22);
  }
  // S-curved ribbon body: shared spine so the outline and the segment lines agree.
  // Length, waviness and girth all vary per species, so a lineage can be a short fat
  // grub or a long thin eel.
  function _serpentSpine(r, o) {
    const len = svLerp(o, "serpLen", 1.10, 2.45);     // half-length in r units
    const waves = svLerp(o, "serpWave", 1.5, 3.0);
    const amp = svLerp(o, "serpAmp", 0.22, 0.62);
    const girth = svLerp(o, "serpGirth", 0.20, 0.40);
    const m = 56 + Math.round(len * 10), cl = [];
    for (let i = 0; i <= m; i++) {
      const t = i / m;
      cl.push({ x: r * amp * Math.sin((t - 0.5) * Math.PI * waves), y: lerp(-r * len, r * len, t), t: t });
    }
    function halfW(t) { return r * girth * Math.pow(Math.sin(Math.PI * t), 0.45); }  // tapers to a point at both ends
    function nrm(i) {
      const a = cl[Math.max(0, i - 1)], b = cl[Math.min(m, i + 1)];
      const tx = b.x - a.x, ty = b.y - a.y, mm = Math.hypot(tx, ty) || 1;
      return { nx: ty / mm, ny: -tx / mm };
    }
    return { m: m, cl: cl, halfW: halfW, nrm: nrm, segStep: Math.max(4, Math.round(m / 9)) };
  }
  function singleOutline(kind, r, o, rng) {
    const form = o.form || {};
    const pts = [], n = 84;
    // ---- swimmers: nose points up (-y), tail trails down (+y) ----
    if (kind === "single-dart") {
      const tl_ = svLerp(o, "dartTail", 1.35, 2.55);   // tail length
      const bw_ = svLerp(o, "dartBarb", 0.60, 0.98);   // barb spread
      const hd_ = svLerp(o, "dartHead", 1.05, 1.55);   // head length
      const apex = {x:0,y:-r*hd_}, bl = {x:-r*bw_,y:r*0.42}, tl = {x:-r*0.15,y:r*0.24},
            tip = {x:0,y:r*tl_}, tr = {x:r*0.15,y:r*0.24}, br = {x:r*bw_,y:r*0.42};
      return _sampleSegs([
        [apex,{x:-r*bw_*0.30,y:-r*hd_*0.49},{x:-r*bw_*0.68,y:r*0.00},bl],
        [bl,{x:-r*bw_*0.76,y:-r*0.10},{x:-r*0.36,y:-r*0.02},tl],  // swept-back barb, concave from outside
        [tl,{x:-r*0.17,y:r*tl_*0.50},{x:-r*0.09,y:r*tl_*0.79},tip],
        [tip,{x:r*0.09,y:r*tl_*0.79},{x:r*0.17,y:r*tl_*0.50},tr],
        [tr,{x:r*0.36,y:-r*0.02},{x:r*bw_*0.76,y:-r*0.10},br],
        [br,{x:r*bw_*0.68,y:r*0.00},{x:r*bw_*0.30,y:-r*hd_*0.49},apex]
      ], 16);
    }
    if (kind === "single-barb") {
      // harpoon: two hooked cusps per side, a rear barb, then a long thin tail.
      const bl_ = svLerp(o, "barbLen", 1.30, 1.85), bt_ = svLerp(o, "barbTail", 1.55, 2.75),
            bh_ = svLerp(o, "barbHook", 0.78, 1.30);   // how far the hooks flare out
      const apex = {x:0,y:-r*bl_}, tip = {x:0,y:r*bt_};
      const L = [{x:-r*0.30*bh_,y:-r*0.70},{x:-r*0.15,y:-r*0.48},{x:-r*0.46*bh_,y:-r*0.14},{x:-r*0.24,y:r*0.08},{x:-r*0.62*bh_,y:r*0.36}];
      const R = L.map(function(p){ return {x:-p.x, y:p.y}; });
      const rootL = {x:-r*0.13,y:r*0.42}, rootR = {x:r*0.13,y:r*0.42};
      return _sampleSegs([
        [apex,{x:-r*0.10,y:-r*bl_*0.80},{x:-r*0.22,y:-r*bl_*0.59},L[0]],
        [L[0],{x:-r*0.26,y:-r*0.60},{x:-r*0.19,y:-r*0.54},L[1]],
        [L[1],{x:-r*0.24,y:-r*0.38},{x:-r*0.40,y:-r*0.26},L[2]],
        [L[2],{x:-r*0.40,y:-r*0.04},{x:-r*0.30,y:r*0.02},L[3]],
        [L[3],{x:-r*0.36,y:r*0.16},{x:-r*0.54,y:r*0.24},L[4]],
        [L[4],{x:-r*0.40,y:r*0.10},{x:-r*0.22,y:r*0.28},rootL],
        [rootL,{x:-r*0.15,y:r*bt_*0.56},{x:-r*0.08,y:r*bt_*0.81},tip],
        [tip,{x:r*0.08,y:r*bt_*0.81},{x:r*0.15,y:r*bt_*0.56},rootR],
        [rootR,{x:r*0.16,y:r*0.30},{x:r*0.40,y:r*0.10},R[4]],
        [R[4],{x:r*0.54,y:r*0.24},{x:r*0.36,y:r*0.16},R[3]],
        [R[3],{x:r*0.30,y:r*0.02},{x:r*0.40,y:-r*0.04},R[2]],
        [R[2],{x:r*0.40,y:-r*0.26},{x:r*0.24,y:-r*0.38},R[1]],
        [R[1],{x:r*0.19,y:-r*0.54},{x:r*0.26,y:-r*0.60},R[0]],
        [R[0],{x:r*0.22,y:-r*bl_*0.59},{x:r*0.10,y:-r*bl_*0.80},apex]
      ], 10);
    }
    if (kind === "single-finned") {
      // notch cuts back from the lobe tips; much past ~45% and the body reads as a
      // chevron rather than a fish, so keep the per-species range under that.
      const hd_ = svLerp(o, "finHead", 1.15, 1.62), lb_ = svLerp(o, "finLobe", 1.14, 1.52),
            sp_ = svLerp(o, "finSpread", 0.70, 1.02);
      const nY = lb_ - (lb_ + hd_) * svLerp(o, "finNotch", 0.16, 0.34);
      const apex = {x:0,y:-r*hd_}, ll = {x:-r*sp_,y:r*lb_}, notch = {x:0,y:r*nY}, rl = {x:r*sp_,y:r*lb_};
      return _sampleSegs([
        [apex,{x:-r*sp_*0.40,y:-r*hd_*0.71},{x:-r*sp_*1.02,y:r*0.44},ll],   // sharp nose, arced flank
        [ll,{x:-r*sp_*0.63,y:r*(nY+lb_)*0.55},{x:-r*0.26,y:r*(nY+0.06)},notch],   // crescent tail notch
        [notch,{x:r*0.26,y:r*(nY+0.06)},{x:r*sp_*0.63,y:r*(nY+lb_)*0.55},rl],
        [rl,{x:r*sp_*1.02,y:r*0.44},{x:r*sp_*0.40,y:-r*hd_*0.71},apex]
      ], 26);
    }
    if (kind === "single-forktail") {
      // Two thin needles hang off the dome's chord. Spikes wide enough to touch the
      // dome's corners read as the legs of an arch instead, so keep the roots narrow.
      const chord = r * 0.04;
      const dw = svLerp(o, "forkW", 0.78, 1.10), dd = svLerp(o, "forkDome", 0.66, 1.14),
            nl = svLerp(o, "forkNeedle", 1.40, 2.60), nw = svLerp(o, "forkRoot", 0.24, 0.44),
            ns = svLerp(o, "forkSpread", 0.28, 0.62);   // how far apart the needle tips sit
      const dome = _sampleSegs([
        [{x:-r*dw,y:chord},{x:-r*dw*1.05,y:-r*dd*0.53},{x:-r*dw*0.57,y:-r*dd*1.02},{x:0,y:-r*dd}],
        [{x:0,y:-r*dd},{x:r*dw*0.57,y:-r*dd*1.02},{x:r*dw*1.05,y:-r*dd*0.53},{x:r*dw,y:chord}]
      ], 30);
      for (let i = 0; i < dome.length; i++) pts.push(dome[i]);
      const rOut = ns + nw * 0.5, rIn = ns - nw * 0.5;
      pts.push({x:r*rOut,y:chord});          // right needle
      pts.push({x:r*ns*0.72,y:r*nl});
      pts.push({x:r*rIn,y:chord});
      pts.push({x:-r*rIn,y:chord});          // left needle
      pts.push({x:-r*ns*0.72,y:r*nl});
      pts.push({x:-r*rOut,y:chord});
      return pts;
    }
    if (kind === "single-sawback") {
      // smooth dome, sawtooth zigzag along the flat side (longest teeth in the middle)
      // stubbier teeth read as a saw; long thin ones read as jellyfish tentacles
      const chordY = r * 0.26, cut = r * 0.10;
      const teeth = 5 + Math.floor(shapeVar(o, "sawN") * 5);      // 5..9 teeth
      const dw = svLerp(o, "sawW", 0.78, 1.02), dd = svLerp(o, "sawDome", 0.98, 1.34),
            base = svLerp(o, "sawBase", 0.22, 0.40), gain = svLerp(o, "sawGain", 0.30, 0.62);
      const dome = _sampleSegs([
        [{x:-r*dw,y:chordY},{x:-r*dw*1.18,y:-r*dd*0.53},{x:-r*dw*0.58,y:-r*dd*1.02},{x:0,y:-r*dd}],
        [{x:0,y:-r*dd},{x:r*dw*0.58,y:-r*dd*1.02},{x:r*dw*1.18,y:-r*dd*0.53},{x:r*dw,y:chordY}]
      ], 30);
      for (let i = 0; i < dome.length; i++) pts.push(dome[i]);
      for (let k = 0; k < teeth; k++) {
        const tx = r * dw - r * dw * 2 * ((k + 0.5) / teeth);
        const len = r * (base + gain * Math.sin(Math.PI * (k + 0.5) / teeth));
        pts.push({ x: tx, y: chordY + len });
        // valleys bite back up into the dome, so this reads as a saw edge, not a comb
        pts.push({ x: r * dw - r * dw * 2 * ((k + 1) / teeth), y: chordY - cut });
      }
      return pts;
    }
    if (kind === "single-serpent") {
      const sp = _serpentSpine(r, o);
      for (let i = 0; i <= sp.m; i++) { const nn = sp.nrm(i), w = sp.halfW(sp.cl[i].t); pts.push({ x: sp.cl[i].x + nn.nx * w, y: sp.cl[i].y + nn.ny * w }); }
      for (let i = sp.m; i >= 0; i--) { const nn = sp.nrm(i), w = sp.halfW(sp.cl[i].t); pts.push({ x: sp.cl[i].x - nn.nx * w, y: sp.cl[i].y - nn.ny * w }); }
      return pts;
    }
    if (kind === "single-star") {
      const n = 5 + Math.floor(shapeVar(o, "starN") * 4);      // 5..8 points
      const tipR = svLerp(o, "starTip", 1.06, 1.44);
      const inward = svLerp(o, "starCut", 0.18, 0.38);         // how deep the edges bow in
      const tips = [];
      for (let k = 0; k < n; k++) {                            // a point faces up
        const a = -Math.PI / 2 + k * TAU / n;
        tips.push({ x: Math.cos(a) * r * tipR, y: Math.sin(a) * r * tipR });
      }
      return _concaveStar(tips, inward);
    }
    if (kind === "single-shard") {
      const lng = svLerp(o, "shardLen", 1.28, 1.78);           // long axis
      const wide = svLerp(o, "shardWide", 0.34, 0.60);         // side points
      const mid = svLerp(o, "shardMid", 0.30, 0.62);           // where the side points sit
      return _concaveStar([
        {x:0,y:-r*lng}, {x:r*wide,y:-r*lng*mid}, {x:r*wide*0.95,y:r*lng*mid*0.62},
        {x:0,y:r*lng}, {x:-r*wide*0.95,y:r*lng*mid*0.62}, {x:-r*wide,y:-r*lng*mid}
      ], svLerp(o, "shardCut", 0.22, 0.40));
    }
    if (kind === "single-teardrop") {
      const A = {x:0,y:-r*1.30}, B = {x:r*0.92,y:-r*0.40}, C = {x:r*0.86,y:r*0.98},
            D = {x:0,y:r*1.02}, E = {x:-r*0.86,y:r*0.98}, F = {x:-r*0.92,y:-r*0.40};
      const m = 42;
      for (let i=0;i<m;i++) pts.push(_bez(A,B,C,D,i/m));
      for (let i=0;i<m;i++) pts.push(_bez(D,E,F,A,i/m));
      return pts;
    }
    if (kind === "single-fan") {
      const spread = 1.05, ax = -r*0.55, rad = r*1.5, m = 56;
      pts.push({x:ax,y:0});
      for (let i=0;i<=m;i++){ const a = -spread + (i/m)*2*spread; pts.push({x:ax+Math.cos(a)*rad, y:Math.sin(a)*rad}); }
      return pts;
    }
    const blobPh = rng() * TAU;
    const pearP = kind !== "single-pear" ? null : {
      bw: svLerp(o, "pearBot", 0.46, 0.80), ts: svLerp(o, "pearTopS", 0.28, 0.50),
      tw: svLerp(o, "pearTop", 0.24, 0.62), bs: svLerp(o, "pearBotS", 0.40, 0.62),
      waist: svLerp(o, "pearWaist", 0.02, 0.12)
    };
    for (let i=0;i<n;i++){
      const a = (i/n)*TAU; let x, y;
      if (kind === "single-pear") {
        // the two bulges are dialled per species: top-heavy, bottom-heavy or near-oval
        const cy = Math.sin(a), t = -cy;
        const bottom = Math.exp(-Math.pow((t+0.5)/pearP.bs,2)), top = Math.exp(-Math.pow((t-0.6)/pearP.ts,2));
        const w = pearP.bw*bottom + pearP.tw*top + pearP.waist;
        x = Math.cos(a)*r*w*1.45; y = cy*r*1.12;
      } else if (kind === "single-gourd") {
        // peanut / figure-8: two vertically stacked lobes with a pinched waist.
        const cy = Math.sin(a), t = -cy;
        const topL = Math.exp(-Math.pow((t - 0.55) / 0.40, 2));
        const botL = Math.exp(-Math.pow((t + 0.52) / 0.46, 2));
        const w = 0.54 * topL + 0.64 * botL + 0.12;
        x = Math.cos(a) * r * w * 1.30; y = cy * r * 1.26;
      } else if (kind === "single-clover") {
        // three round lobes in a triangle (union of 3 circles: one top, two below).
        const d = r * 0.60, rr = r * 0.86, dx = Math.cos(a), dy = Math.sin(a);
        let rad = 0;
        for (let k = 0; k < 3; k++) {
          const ang = -Math.PI / 2 + k * TAU / 3, cxk = Math.cos(ang) * d, cyk = Math.sin(ang) * d;
          const proj = cxk * dx + cyk * dy, perp = Math.abs(cxk * dy - cyk * dx);
          if (perp < rr) { const dcap = proj + Math.sqrt(rr * rr - perp * perp); if (dcap > rad) rad = dcap; }
        }
        x = dx * rad; y = dy * rad;
      } else if (kind === "single-trefoil") {
        const rr = r*(0.72 + 0.36*Math.max(0, Math.cos(3*(a+Math.PI/2)))); x = Math.cos(a)*rr; y = Math.sin(a)*rr;
      } else if (kind === "single-triangle") {
        const rr = r*(0.98 + 0.20*Math.cos(3*a - Math.PI/2)); x = Math.cos(a)*rr; y = Math.sin(a)*rr;
      } else { // single-cell: smooth seamless blob
        const irr = 0.25 + clamp(form.detail || 0.5, 0, 1) * 0.6;
        const lobes = 1 + irr*0.14*Math.sin(a*3 + blobPh) + irr*0.07*Math.sin(a*5 + blobPh*1.7);
        const rr = r*0.94*lobes;
        x = Math.cos(a)*rr*(0.98 + (form.aspect || 1.2)*0.05); y = Math.sin(a)*rr;
      }
      pts.push({x,y});
    }
    return pts;
  }
  function _centroid(pts){ let sx=0, sy=0; for (let i=0;i<pts.length;i++){ sx+=pts[i].x; sy+=pts[i].y; } return {x:sx/pts.length, y:sy/pts.length}; }
  // per-point outward normals taken from the local tangent, so appendages sit correctly
  // on concave edges (the centroid direction only works on convex blobs).
  function _outlineNormals(pts) {
    const c = _centroid(pts), n = pts.length, out = [];
    let s = 0;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[(i + 1) % n];
      const tx = p1.x - p0.x, ty = p1.y - p0.y, m = Math.hypot(tx, ty) || 1;
      const nx = ty / m, ny = -tx / m;
      out.push({ nx: nx, ny: ny });
      s += nx * (pts[i].x - c.x) + ny * (pts[i].y - c.y);
    }
    if (s < 0) for (let i = 0; i < n; i++) { out[i].nx = -out[i].nx; out[i].ny = -out[i].ny; }
    return out;
  }
  // keep only the stretch of outline that reads as "body", so appendages don't
  // sprout along a tail spike or a row of teeth.
  function _zone(pts, normals, keep) {
    const zp = [], zn = [];
    for (let i = 0; i < pts.length; i++) if (keep(pts[i])) { zp.push(pts[i]); zn.push(normals[i]); }
    return zp.length >= 6 ? { pts: zp, normals: zn } : { pts: pts, normals: normals };
  }
  function _fillOutline(ctx, pts){ ctx.beginPath(); for (let i=0;i<pts.length;i++){ if(i===0) ctx.moveTo(pts[i].x,pts[i].y); else ctx.lineTo(pts[i].x,pts[i].y); } ctx.closePath(); }
  function drawBodyFromPts(ctx, o, r, pal, rng, pts, nuclei) {
    const form = o.form || {};
    ctx.save();
    _fillOutline(ctx, pts);
    fillAndStroke(ctx, r, pal, 0.68);
    ctx.clip();
    drawGranules(ctx, r, pal, rng, 7 + Math.round((form.detail || 0.5) * 10), !!(o.flags && o.flags.chl));
    drawSurfaceSpeckles(ctx, r, pal, rng, 18, 0.24);
    if (nuclei && nuclei.length) {
      for (const nu of nuclei) drawNucleus(ctx, nu.x, nu.y, nu.r, pal, rng, 0.92);
    } else {
      drawNucleus(ctx, -r * 0.10, -r * 0.02, r * 0.22, pal, rng, 0.92);
    }
    ctx.restore();
  }
  // Appendages placed on the actual outline (outward normal), drawn BEHIND the body.
  function appendageBehind(ctx, o, r, pal, rng, pts, opts) {
    const g = genesOf(o), diet = g.diet == null ? 0.5 : g.diet;
    const c = _centroid(pts);
    const normals = opts && opts.normals;   // optional per-point true outward normals (for concave shapes)
    function norm(p, idx){ if (normals && idx != null && normals[idx]) return normals[idx]; const dx=p.x-c.x, dy=p.y-c.y, m=Math.hypot(dx,dy)||1; return {nx:dx/m, ny:dy/m}; }
    let h = hashStr32((o.speciesKey || "x") + ":app:" + Math.round((g.formSeed || 0) * 997)) / 4294967296;
    const PERIM = ["cilia", "spikes", "spokes", "beads"];  // fringe types that suit any silhouette
    let kind;
    if (o.appendageKind && o.appendageKind !== "auto") {
      kind = o.appendageKind;                 // explicit override from the generator UI
    } else {
      kind = h < 0.20 ? "cilia" : h < 0.40 ? "spikes" : h < 0.58 ? "spokes" : h < 0.72 ? "beads" : h < 0.86 ? "antennae" : "flagella";
      if (diet > 0.66 && kind === "cilia") kind = "spikes";
      if (diet < 0.33 && (kind === "spikes" || kind === "spokes")) kind = "cilia";
    }
    // point appendages (antennae/flagella) don't read on ring/mesh/cluster bodies -> use a fringe.
    if (opts && opts.perimeter && PERIM.indexOf(kind) < 0) kind = PERIM[Math.floor(h * 4) % 4];
    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (kind === "cilia") {
      ctx.strokeStyle = hsla(pal.hue + 30, 70, 82, 0.30); ctx.lineWidth = Math.max(0.5, r * 0.017);
      const count = Math.min(pts.length, 34 + Math.round(h * 26));
      for (let i=0;i<count;i++){ const idx = Math.floor(i/count*pts.length); const p = pts[idx]; const nn = norm(p, idx); const len = r*(0.09 + 0.05*Math.abs(Math.sin(i*1.7))); ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x+nn.nx*len, p.y+nn.ny*len); ctx.stroke(); }
    } else if (kind === "spikes") {
      ctx.strokeStyle = hsla(pal.hue - 10, 88, 52, 0.55); ctx.fillStyle = hsla(pal.hue + 8, 88, 70, 0.28); ctx.lineWidth = Math.max(0.8, r * 0.028);
      const spikes = 9 + Math.round(h * 8);
      for (let i=0;i<spikes;i++){ const idx = Math.floor(i/spikes*pts.length); const p = pts[idx]; const nn = norm(p, idx); const len = r*(0.26 + h*0.22); const tx=p.x+nn.nx*len, ty=p.y+nn.ny*len; const bw = r*0.05; ctx.beginPath(); ctx.moveTo(p.x-(-nn.ny)*bw, p.y-(nn.nx)*bw); ctx.lineTo(tx,ty); ctx.lineTo(p.x+(-nn.ny)*bw, p.y+(nn.nx)*bw); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    } else if (kind === "spokes") {
      // long, narrow, tapered spines radiating outward (proper thorns, not hairs)
      ctx.strokeStyle = hsla(pal.hue - 8, 82, 44, 0.58); ctx.lineWidth = Math.max(0.7, r * 0.02);
      const nsp = 11 + Math.round(h * 8), bw = r * 0.055;
      for (let i=0;i<nsp;i++){
        const idx = Math.floor(i/nsp*pts.length), p = pts[idx], nn = norm(p, idx);
        const len = r*(0.52 + h*0.34) * (0.86 + (i%2)*0.18);
        const tx = p.x+nn.nx*len, ty = p.y+nn.ny*len, px = -nn.ny, py = nn.nx;
        const grd = ctx.createLinearGradient(p.x, p.y, tx, ty);
        grd.addColorStop(0, hsla(pal.hue+8, 82, 66, 0.52)); grd.addColorStop(1, hsla(pal.hue-8, 86, 50, 0.10));
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.moveTo(p.x+px*bw, p.y+py*bw); ctx.lineTo(tx, ty); ctx.lineTo(p.x-px*bw, p.y-py*bw); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    } else if (kind === "beads") {
      // radiating spokes tipped with small beaded cells
      ctx.strokeStyle = hsla(pal.hue - 8, 50, 54, 0.26); ctx.lineWidth = Math.max(0.7, r * 0.02);
      const nsp = 9 + Math.round(h * 6);
      for (let i=0;i<nsp;i++){
        const idx = Math.floor(i/nsp*pts.length), p = pts[idx], nn = norm(p, idx), nb = 2 + (i%2);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x+nn.nx*(r*(0.24+nb*0.16)), p.y+nn.ny*(r*(0.24+nb*0.16))); ctx.stroke();
        for (let b=1;b<=nb;b++){ const d = r*0.18 + b*r*0.16, bx = p.x+nn.nx*d, by = p.y+nn.ny*d, rr = r*(0.095 - b*0.012); drawOvalCell(ctx, bx, by, rr*1.1, rr*0.92, Math.atan2(nn.ny, nn.nx), pal, rng, 0.7); }
      }
    } else if (kind === "antennae") {
      ctx.strokeStyle = hsla(pal.hue + 35, 72, 48, 0.55); ctx.lineWidth = Math.max(0.9, r * 0.028);
      const upper = pts.slice().sort(function(a,b){return a.y-b.y;}).slice(0,3);
      for (let i=0;i<upper.length;i++){ const p = upper[i]; const nn = norm(p); const len = r*(0.7 + rng()*0.4); const ex=p.x+nn.nx*len, ey=p.y+nn.ny*len; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.quadraticCurveTo(p.x+nn.nx*len*0.5+(rng()-0.5)*r*0.1, p.y+nn.ny*len*0.5, ex, ey); ctx.stroke(); drawNucleus(ctx, ex, ey, r*0.12, pal, rng, 0.85); }
    } else {
      ctx.strokeStyle = hsla(pal.hue + 16, 80, 74, 0.40); ctx.lineWidth = Math.max(0.7, r * 0.03);
      const lower = pts.slice().sort(function(a,b){return b.y-a.y;}).slice(0, 3 + Math.round(h*3));
      for (let i=0;i<lower.length;i++){ const p = lower[i]; const len = r*(1.1 + rng()*0.7); const segs = 7; ctx.beginPath(); ctx.moveTo(p.x,p.y); for (let s=1;s<=segs;s++){ const tt=s/segs; ctx.lineTo(p.x + Math.sin(tt*6+i)*r*0.16*tt, p.y + len*tt); } ctx.stroke(); }
    }
    ctx.restore();
  }
  // a ring of boundary points (used to hang perimeter appendages on multi-node bodies)
  function ringOutline(rx, ry, n) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; pts.push({ x: Math.cos(a) * rx, y: Math.sin(a) * ry }); }
    return pts;
  }

  // Forms whose silhouette ends in a tail/spike/teeth: appendages stay above this y
  // (in r units) so they hang off the body rather than the trailing spike.
  const SWIMMER_ZONE_Y = {
    "single-dart": 0.30, "single-barb": 0.34, "single-finned": 0.50,
    "single-forktail": 0.08, "single-sawback": 0.24
  };
  // nucleus sits in the head for the swimmers, dead centre for the stars (r units)
  const SWIMMER_NUC = {
    "single-dart": { x: 0, y: -0.55, r: 0.15 }, "single-barb": { x: 0, y: -0.86, r: 0.12 },
    "single-finned": { x: 0, y: -0.52, r: 0.16 }, "single-forktail": { x: 0, y: -0.42, r: 0.17 },
    "single-sawback": { x: -0.30, y: -0.30, r: 0.15 },
    "single-star": { x: 0, y: 0, r: 0.17 }, "single-shard": { x: 0, y: 0, r: 0.14 }
  };

  // `r` is a fixed radius, not a bounding-box fit, and the card clips past ~1.19r
  // vertically / ~2.2r horizontally. These forms vary their silhouette per species,
  // so a static per-form scale can't hold: measure the actual outline instead.
  const VARIED_FORMS = {
    "single-dart": 1, "single-barb": 1, "single-forktail": 1, "single-finned": 1,
    "single-serpent": 1, "single-shard": 1, "single-star": 1, "single-sawback": 1,
    "single-pear": 1
  };
  function variedFit(kind, o) {
    // sampled at r=1; every outline is linear in r, so this scales exactly.
    const pts = singleOutline(kind, 1, o, rngFrom("fit:" + (o.speciesKey || "x")));
    let my = 0, mx = 0;
    for (let i = 0; i < pts.length; i++) {
      const ay = Math.abs(pts[i].y), ax = Math.abs(pts[i].x);
      if (ay > my) my = ay;
      if (ax > mx) mx = ax;
    }
    return Math.min(1, 1.06 / Math.max(my, 1e-6), 2.10 / Math.max(mx, 1e-6));
  }
  // The sketched forms carry their character in the silhouette, so they stay bare
  // unless the generator's appendage picker explicitly asks for one.
  const SKETCH_FORMS = {
    "single-star": 1, "single-shard": 1, "single-serpent": 1, "single-forktail": 1,
    "single-sawback": 1, "single-dart": 1, "single-barb": 1, "single-finned": 1
  };
  function wantsAppendage(o, kind) {
    if (!SKETCH_FORMS[kind]) return true;
    return !!(o.appendageKind && o.appendageKind !== "auto");
  }

  function drawSerpent(ctx, o, r, pal, rng) {
    const pts = singleOutline("single-serpent", r, o, rng);
    if (wantsAppendage(o, "single-serpent")) appendageBehind(ctx, o, r, pal, rng, pts, { normals: _outlineNormals(pts) });
    const sp = _serpentSpine(r, o);
    const head = sp.cl[Math.round(sp.m * 0.14)];   // ride the spine so it stays in the body
    drawBodyFromPts(ctx, o, r, pal, rng, pts, [{ x: head.x, y: head.y, r: sp.halfW(head.t) * 0.52 }]);
    ctx.save();
    _fillOutline(ctx, pts);
    ctx.clip();
    ctx.strokeStyle = hsla(pal.hue - 8, 58, 36, 0.44);
    ctx.lineWidth = Math.max(0.8, r * 0.028);
    for (let i = sp.segStep; i < sp.m - 4; i += sp.segStep) {
      const nn = sp.nrm(i), w = sp.halfW(sp.cl[i].t) * 1.6;
      ctx.beginPath();
      ctx.moveTo(sp.cl[i].x - nn.nx * w, sp.cl[i].y - nn.ny * w);
      ctx.lineTo(sp.cl[i].x + nn.nx * w, sp.cl[i].y + nn.ny * w);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSingle(ctx, o, r, pal, rng) {
    const kind = visualKind(o);
    if (kind === "single-leaf") { drawLeaf(ctx, o, r, pal, rng); drawRare(ctx, o, r, pal, rng); return; }
    if (kind === "single-spindle") { drawSpindle(ctx, o, r, pal, rng); drawRare(ctx, o, r, pal, rng); return; }
    if (kind === "single-crescent") { drawCrescent(ctx, o, r, pal, rng); drawRare(ctx, o, r, pal, rng); return; }
    if (kind === "single-needle") { drawNeedle(ctx, o, r, pal, rng); drawRare(ctx, o, r, pal, rng); return; }
    if (kind === "single-trap") { drawTrap(ctx, o, r, pal, rng); drawRare(ctx, o, r, pal, rng); return; }
    if (kind === "single-serpent") { drawSerpent(ctx, o, r, pal, rng); drawRare(ctx, o, r, pal, rng); return; }
    const pts = singleOutline(kind, r, o, rng);
    // forms with tails/teeth: hang appendages on the body only, using true outline normals
    const zoneY = SWIMMER_ZONE_Y[kind];
    if (!wantsAppendage(o, kind)) {
      /* bare silhouette */
    } else if (zoneY != null) {
      const nn = _outlineNormals(pts);
      const z = _zone(pts, nn, function (p) { return p.y < r * zoneY; });
      appendageBehind(ctx, o, r, pal, rng, z.pts, { normals: z.normals });
    } else if (kind === "single-star" || kind === "single-shard") {
      appendageBehind(ctx, o, r, pal, rng, pts, { normals: _outlineNormals(pts) });
    } else {
      appendageBehind(ctx, o, r, pal, rng, pts); // behind the body
    }
    if (SWIMMER_NUC[kind]) {
      const nu = SWIMMER_NUC[kind];
      drawBodyFromPts(ctx, o, r, pal, rng, pts, [{ x: nu.x * r, y: nu.y * r, r: nu.r * r }]);
      drawRare(ctx, o, r, pal, rng);
      return;
    }
    if (kind === "single-gourd") {
      drawBodyFromPts(ctx, o, r, pal, rng, pts, [{ x: 0, y: -r * 0.66, r: r * 0.14 }, { x: 0, y: r * 0.60, r: r * 0.17 }]);
    } else if (kind === "single-clover") {
      const d = r * 0.60, nuc = [];
      for (let k = 0; k < 3; k++) { const ang = -Math.PI / 2 + k * TAU / 3; nuc.push({ x: Math.cos(ang) * d, y: Math.sin(ang) * d, r: r * 0.16 }); }
      drawBodyFromPts(ctx, o, r, pal, rng, pts, nuc);
    } else {
      drawBodyFromPts(ctx, o, r, pal, rng, pts); // body on top
    }
    drawRare(ctx, o, r, pal, rng);
  }

  function drawChain(ctx, o, r, pal, rng) {
    const g = genesOf(o);
    const n = 3 + Math.round(clamp((g.fecundity || 0.5) * 5 + (o.form ? o.form.length : 0.5) * 2, 0, 7));
    const step = r * lerp(0.48, 0.64, g.speed || 0.5);
    const variant = variantIndex(o, "chain", 2); // match visualKind: 1 = segment, 0 = bead chain
    ctx.save();
    ctx.rotate(-0.42 + rng() * 0.55);

    if (variant === 1) {
      const pred = (g.diet || 0.5) > 0.62;
      drawBlobPath(ctx, r * 0.80, 1.85, 0.18, pred ? 0.44 : 0.18, rng);
      fillAndStroke(ctx, r, pal, 0.54);
      ctx.save();
      ctx.clip();
      drawGranules(ctx, r * 0.75, pal, rng, 7 + Math.round((g.sense || 0.5) * 6), !!(o.flags && o.flags.chl));
      drawSurfaceSpeckles(ctx, r, pal, rng, 16, 0.16);
      drawSegmentationLines(ctx, r, pal, 5 + Math.round((g.fecundity || 0.5) * 3), 0);
      ctx.restore();
      drawNucleus(ctx, -r * 0.42, -r * 0.03, r * 0.18, pal, rng, 0.82);
      drawSegmentBodyCilia(ctx, r, pal, rng, pred);
      if ((g.speed || 0.5) > 0.48) drawAttachedFlagellum(ctx, r * 1.12, -r * 0.03, -0.16, r * 0.70, pal, rng, 0.38);
      ctx.restore();
      return;
    }

    ctx.lineCap = "round";
    ctx.strokeStyle = hsla(pal.hue - 10, 52, 52, 0.16);
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * step;
      const y = Math.sin(i * 0.9) * r * 0.18;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1);
      const x = (i - (n - 1) / 2) * step;
      const y = Math.sin(i * 0.9) * r * 0.18;
      const rr = r * lerp(0.30, 0.43, 1 - Math.abs(t - 0.5) * 1.2);
      drawOvalCell(ctx, x, y, rr * 1.06, rr * 0.88, (rng() - 0.5) * 0.34, pal, rng, 0.70);
    }
    // bead chain: cilia only, running along the top and bottom edge of the body
    drawChainEdgeCilia(ctx, n, step, r, pal, rng, (g.diet || 0.5) > 0.64);
    ctx.restore();
  }

  function drawRing(ctx, o, r, pal, rng) {
    const g = genesOf(o);
    const n = 8 + Math.round((g.fecundity || 0.5) * 6);
    ctx.save();
    appendageBehind(ctx, o, r, pal, rng, ringOutline(r * 0.84, r * 0.84, 42), { perimeter: true });
    ctx.strokeStyle = hsla(pal.hue - 6, 48, 50, 0.20);
    ctx.lineWidth = Math.max(1, r * 0.050);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.68, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const d = r * (0.66 + 0.04 * Math.sin(i * 1.7));
      const rr = r * (0.17 + rng() * 0.035);
      drawOvalCell(ctx, Math.cos(a) * d, Math.sin(a) * d, rr * 1.08, rr * 0.92, a + Math.PI * 0.5, pal, rng, 0.68);
    }
    ctx.restore();
  }

  // radial arms: a central cell with several beaded arms (X-cross / downward arch).
  function drawRadialArms(ctx, o, r, pal, rng) {
    const g = genesOf(o);
    ctx.save();
    ctx.scale(0.86, 0.86);
    ctx.rotate((rng() - 0.5) * 0.5);
    const arms = 2 + variantIndex(o, "armn", 4);              // 2..5 arms
    const downward = variantIndex(o, "armdir", 2) === 1 && arms <= 3;
    // per-species base length, then each arm is a bit longer/shorter than that base.
    const baseBeads = 2 + Math.round(((o.form && o.form.length) || 0.5) * 3) + variantIndex(o, "armlen", 2); // 2..6
    for (let i = 0; i < arms; i++) {
      let a;
      if (downward) a = Math.PI * 0.28 + (arms <= 1 ? 0.5 : i / (arms - 1)) * Math.PI * 0.44;
      else a = (i / arms) * TAU + Math.PI * 0.2 + (rng() - 0.5) * 0.2;
      const beads = clamp(baseBeads + Math.floor(rng() * 3) - 1, 2, 7); // per-arm variation
      const centers = [];
      let cx = Math.cos(a) * r * 0.44, cy = Math.sin(a) * r * 0.44, cang = a;
      for (let b = 0; b < beads; b++) {
        cx += Math.cos(cang) * r * 0.30; cy += Math.sin(cang) * r * 0.30;
        cang += (rng() - 0.5) * 0.4;
        centers.push({ x: cx, y: cy });
      }
      ctx.strokeStyle = hsla(pal.hue - 10, 52, 52, 0.16);
      ctx.lineWidth = r * 0.10; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.40, Math.sin(a) * r * 0.40);
      for (const c of centers) ctx.lineTo(c.x, c.y);
      ctx.stroke();
      for (let b = 0; b < centers.length; b++) {
        const rr = r * lerp(0.19, 0.11, b / Math.max(1, beads - 1));
        drawOvalCell(ctx, centers[b].x, centers[b].y, rr * 1.06, rr * 0.9, cang, pal, rng, 0.72);
      }
      // a small curling flagellum trailing off each arm tip (matches the sketch's curled ends)
      const tip = centers[centers.length - 1];
      drawAttachedFlagellum(ctx, tip.x, tip.y, cang, r * (0.42 + rng() * 0.22), pal, rng, 0.34);
    }
    ctx.save();
    drawBlobPath(ctx, r * 0.52, 1.04, 0.22, 0.05, rng);
    fillAndStroke(ctx, r * 0.6, pal, 0.72);
    ctx.clip();
    drawGranules(ctx, r * 0.5, pal, rng, 6, !!(o.flags && o.flags.chl));
    drawNucleus(ctx, 0, 0, r * 0.2, pal, rng, 0.95);
    ctx.restore();
    ctx.restore();
  }

  // radiolarian: a big central vesicle ringed by partitioned arm bases, each drawing
  // out into a long tapered spike.
  function radialStarParams(o) {
    return {
      arms: 5 + Math.floor(shapeVar(o, "radN") * 4),        // 5..8 spikes
      baseR: svLerp(o, "radBase", 0.60, 0.84),
      tipR: svLerp(o, "radTip", 1.45, 2.30),
      spikeW: svLerp(o, "radW", 0.11, 0.24),
      cR: svLerp(o, "radCore", 0.30, 0.48)
    };
  }
  function drawRadialStar(ctx, o, r, pal, rng) {
    const P = radialStarParams(o);
    const arms = P.arms;
    ctx.save();
    ctx.rotate((rng() - 0.5) * 0.6);
    const baseR = r * P.baseR, tipR = r * P.tipR, spikeW = P.spikeW, cR = r * P.cR;
    const pts = [], m = 240;
    for (let i = 0; i < m; i++) {
      const a = (i / m) * TAU;
      let d = Infinity;
      for (let k = 0; k < arms; k++) {
        const dd = Math.abs(((a - k * TAU / arms + Math.PI) % TAU + TAU) % TAU - Math.PI);
        if (dd < d) d = dd;
      }
      let rr = baseR * (0.90 + 0.10 * Math.cos(arms * a));
      if (d < spikeW) rr = Math.max(rr, baseR + (tipR - baseR) * Math.pow(1 - d / spikeW, 1.7));
      pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr });
    }
    _fillOutline(ctx, pts);
    fillAndStroke(ctx, r, pal, 0.62);
    ctx.save();
    ctx.clip();
    drawGranules(ctx, r * 0.62, pal, rng, 5, !!(o.flags && o.flags.chl));
    drawSurfaceSpeckles(ctx, r, pal, rng, 14, 0.18);
    ctx.restore();
    ctx.strokeStyle = hsla(pal.hue - 10, 56, 38, 0.34);
    ctx.lineWidth = Math.max(0.6, r * 0.018);
    for (let k = 0; k < arms; k++) {
      const a = (k + 0.5) * TAU / arms;   // partition between two arm bases
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * cR, Math.sin(a) * cR);
      ctx.lineTo(Math.cos(a) * baseR * 0.94, Math.sin(a) * baseR * 0.94);
      ctx.stroke();
    }
    for (let k = 0; k < arms; k++) {
      const a = k * TAU / arms, d = (cR + baseR) * 0.5;
      drawNucleus(ctx, Math.cos(a) * d, Math.sin(a) * d, r * 0.05, pal, rng, 0.8);
    }
    drawOvalCell(ctx, 0, 0, cR, cR * 0.94, 0, pal, rng, 0.82);
    ctx.restore();
  }

  // radial topology renders the beaded-arms body or the spiked radiolarian; the old
  // spoke/bead "radial-spines" / "radial-beads" looks live on as selectable appendages.
  function drawRadial(ctx, o, r, pal, rng) {
    if (visualKind(o) === "radial-star") drawRadialStar(ctx, o, r, pal, rng);
    else drawRadialArms(ctx, o, r, pal, rng);
  }

  function drawBranch(ctx, o, r, pal, rng) {
    const g = genesOf(o);
    const branchCount = 5 + Math.round((g.sense || 0.5) * 4);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.rotate((rng() - 0.5) * 0.20);

    const trunk = [];
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      trunk.push({
        x: Math.sin(t * Math.PI * 1.15) * r * 0.10,
        y: lerp(r * 0.70, -r * 0.48, t)
      });
    }

    ctx.strokeStyle = hsla(pal.hue - 4, 56, 44, 0.28);
    ctx.lineWidth = Math.max(3.4, r * 0.20);
    ctx.beginPath();
    trunk.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    ctx.strokeStyle = hsla(pal.hue + 10, 66, 76, 0.48);
    ctx.lineWidth = Math.max(1.2, r * 0.060);
    ctx.beginPath();
    trunk.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    for (let i = 0; i < branchCount; i++) {
      const t = (i + 0.5) / branchCount;
      const side = i % 2 ? 1 : -1;
      const y = lerp(r * 0.46, -r * 0.42, t);
      const x = Math.sin(t * Math.PI * 1.15) * r * 0.10;
      const len = r * (0.34 + rng() * 0.34);
      const tipX = x + side * len;
      const tipY = y - r * (0.10 + rng() * 0.20);
      ctx.strokeStyle = hsla(pal.hue - 4, 54, 44, 0.26);
      ctx.lineWidth = Math.max(2.1, r * 0.12);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + side * len * 0.35, y - r * 0.05, tipX, tipY);
      ctx.stroke();
      ctx.strokeStyle = hsla(pal.hue + 10, 66, 76, 0.46);
      ctx.lineWidth = Math.max(0.9, r * 0.048);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + side * len * 0.35, y - r * 0.05, tipX, tipY);
      ctx.stroke();
      drawOvalCell(ctx, tipX, tipY, r * (0.17 + rng() * 0.04), r * (0.22 + rng() * 0.05), side * 0.28, pal, rng, 0.74);
    }
    for (let i = 1; i < trunk.length - 1; i += 2) {
      drawOvalCell(ctx, trunk[i].x + (rng() - 0.5) * r * 0.05, trunk[i].y, r * 0.12, r * 0.16, 0, pal, rng, 0.54);
    }
    drawOvalCell(ctx, trunk[0].x, trunk[0].y + r * 0.05, r * 0.18, r * 0.22, 0, pal, rng, 0.60);
    drawOvalCell(ctx, trunk[trunk.length - 1].x, trunk[trunk.length - 1].y - r * 0.04, r * 0.17, r * 0.22, 0, pal, rng, 0.72);
    ctx.restore();
  }

  function drawCluster(ctx, o, r, pal, rng) {
    const g = genesOf(o);
    const variant = variantIndex(o, "cluster", 3);
    const n = 8 + Math.round((g.fecundity || 0.5) * 10);
    ctx.save();

    if (variant === 1) {
      appendageBehind(ctx, o, r, pal, rng, ringOutline(r * 0.60, r * 0.60, 34), { perimeter: true });
      const petals = 5 + Math.round((g.fecundity || 0.5) * 4);
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * TAU + rng() * 0.08;
        const d = r * (0.34 + rng() * 0.08);
        drawOvalCell(ctx, Math.cos(a) * d, Math.sin(a) * d, r * 0.22, r * 0.29, a, pal, rng, 0.68);
      }
      drawOvalCell(ctx, 0, 0, r * 0.24, r * 0.24, 0, pal, rng, 0.78);
      ctx.restore();
      return;
    }

    if (variant === 2) {
      appendageBehind(ctx, o, r, pal, rng, ringOutline(r * 0.78, r * 0.74, 38), { perimeter: true });
      drawSoftMembranePath(ctx, r * 0.74, 1.04, 0.54, rng);
      fillAndStroke(ctx, r, pal, 0.30);
      ctx.clip();
    }

    const bubbles = [];
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU;
      const d = Math.sqrt(rng()) * r * (variant === 2 ? 0.58 : 0.66);
      const rr = r * (variant === 2 ? 0.15 + rng() * 0.10 : 0.19 + rng() * 0.13);
      bubbles.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, d: d, rr: rr, ang: a });
    }
    // cilia growing from the OUTER bubbles' outward side (behind them), so the fringe
    // hugs the real cluster silhouette instead of sitting on a circle.
    if ((g.diet || 0.5) < 0.42 && variant !== 2) {
      let maxd = 0.0001;
      for (const b of bubbles) if (b.d > maxd) maxd = b.d;
      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = hsla(pal.hue + 26, 70, 80, 0.28);
      ctx.lineWidth = Math.max(0.5, r * 0.015);
      for (const b of bubbles) {
        if (b.d < maxd * 0.5) continue;
        const cnt = 5;
        for (let k = 0; k < cnt; k++) {
          const dir = b.ang + (k / (cnt - 1) - 0.5) * 1.4;
          const sx = b.x + Math.cos(dir) * b.rr * 0.92, sy = b.y + Math.sin(dir) * b.rr * 0.92;
          const len = r * (0.13 + rng() * 0.09);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(sx + Math.cos(dir + 0.2) * len * 0.6, sy + Math.sin(dir + 0.2) * len * 0.6, sx + Math.cos(dir) * len, sy + Math.sin(dir) * len);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    for (const b of bubbles) {
      ctx.save();
      ctx.translate(b.x, b.y);
      drawBlobPath(ctx, b.rr, 1.0 + (rng() - 0.5) * 0.25, 0.28, 0.1, rng);
      fillAndStroke(ctx, b.rr, pal, variant === 2 ? 0.58 : 0.72);
      drawNucleus(ctx, 0, 0, b.rr * 0.32, pal, rng, 0.70);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawAmoeba(ctx, o, r, pal, rng) {
    const g = genesOf(o);
    ctx.save();
    ctx.beginPath();
    const n = 64;
    // per-creature variety: pseudopod count, phases and amplitudes differ each time.
    const pods = 3 + Math.floor((g.formSeed == null ? 0.5 : g.formSeed) * 4); // 3..6 lobes
    const ph1 = rng() * TAU, ph2 = rng() * TAU, ph3 = rng() * TAU;
    const amp1 = 0.16 + rng() * 0.16;
    const podAmp = 0.18 + rng() * 0.24;
    const aspect = 1.02 + (g.speed || 0.5) * 0.22 + (rng() - 0.5) * 0.24;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const wave = 1 + amp1 * Math.sin(a * 3.0 + ph1) + 0.11 * Math.sin(a * 6.0 + ph2);
      const pseudo = Math.pow(Math.max(0, Math.cos(a * pods + ph3)), 1.4) * podAmp;
      const rr = r * (0.70 + wave * 0.15 + pseudo);
      const x = Math.cos(a) * rr * aspect;
      const y = Math.sin(a) * rr * (0.90 + (g.size || 0.5) * 0.10);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    fillAndStroke(ctx, r, pal, 0.62);
    ctx.clip();
    drawGranules(ctx, r, pal, rng, 14 + Math.round((g.sense || 0.5) * 8), !!(o.flags && o.flags.chl));
    drawNucleus(ctx, -r * 0.10, r * 0.04, r * 0.24, pal, rng, 0.84);
    ctx.restore();
    drawCilia(ctx, r * 0.86, pal, rng, 16, 0.22, 0.18);
  }

  function drawMesh(ctx, o, r, pal, rng) {
    const g = genesOf(o);
    ctx.save();

    // build the wobbly mesh outline as points so the fringe can hug the real silhouette.
    const mpts = [], mn = 64, mph = rng() * TAU, irr = 0.42, aspect = 1.08, R0 = r * 0.84;
    for (let i = 0; i < mn; i++) {
      const a = (i / mn) * TAU;
      const lobes = 1 + irr * 0.15 * Math.sin(a * 3 + mph) + irr * 0.08 * Math.sin(a * 5 + mph * 1.7);
      const taper = 1 + 0.04 * 0.13 * Math.max(0, Math.cos(a));
      mpts.push({ x: Math.cos(a) * R0 * aspect * lobes * taper, y: Math.sin(a) * R0 * (1 + irr * 0.06 * Math.cos(a * 4)) });
    }
    // selectable perimeter appendage hugging the real silhouette (behind the translucent body)
    appendageBehind(ctx, o, r, pal, rng, mpts, { perimeter: true });

    _fillOutline(ctx, mpts);
    fillAndStroke(ctx, r, pal, 0.20);
    ctx.clip();

    const holes = [];
    const holeCount = 8 + Math.round((g.sense || 0.5) * 5);
    for (let i = 0; i < holeCount; i++) {
      const a = (i / holeCount) * TAU + (rng() - 0.5) * 0.46;
      const d = r * (0.18 + rng() * 0.52);
      holes.push({
        x: Math.cos(a) * d * (0.94 + rng() * 0.24),
        y: Math.sin(a) * d * (0.78 + rng() * 0.20),
        rr: r * (0.105 + rng() * 0.070)
      });
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 0; i < holes.length; i++) {
      for (let j = i + 1; j < holes.length; j++) {
        const a = holes[i], b = holes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < r * 0.50) {
          ctx.strokeStyle = hsla(pal.hue + 8, 62, 56, 0.36);
          ctx.lineWidth = Math.max(1.1, r * 0.075);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo((a.x + b.x) * 0.5 + (rng() - 0.5) * r * 0.10, (a.y + b.y) * 0.5 + (rng() - 0.5) * r * 0.10, b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (const h of holes) {
      const bg = ctx.createRadialGradient(h.x - h.rr * 0.2, h.y - h.rr * 0.2, h.rr * 0.1, h.x, h.y, h.rr * 1.3);
      bg.addColorStop(0, "rgba(246,254,255,.88)");
      bg.addColorStop(1, hsla(pal.hue + 20, 42, 94, 0.46));
      ctx.fillStyle = bg;
      ctx.strokeStyle = hsla(pal.hue - 12, 56, 38, 0.42);
      ctx.lineWidth = Math.max(0.8, r * 0.024);
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, h.rr * (1.18 + rng() * 0.18), h.rr * (0.86 + rng() * 0.22), rng() * TAU, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (rng() > 0.55) {
        ctx.fillStyle = hsla(pal.hue + 12, 62, 62, 0.38);
        ctx.beginPath();
        ctx.arc(h.x + h.rr * 0.48, h.y - h.rr * 0.24, h.rr * 0.16, 0, TAU);
        ctx.fill();
      }
    }
    drawSurfaceSpeckles(ctx, r, pal, rng, 20, 0.18);
    ctx.restore();
  }

  function drawJelly(ctx, o, r, pal, rng) {
    const g = genesOf(o);
    ctx.save();
    ctx.translate(0, -r * 0.18);
    ctx.beginPath();
    ctx.moveTo(-r * 0.78, 0);
    ctx.bezierCurveTo(-r * 0.70, -r * 0.70, r * 0.70, -r * 0.70, r * 0.78, 0);
    ctx.bezierCurveTo(r * 0.60, r * 0.30, -r * 0.60, r * 0.30, -r * 0.78, 0);
    ctx.closePath();
    fillAndStroke(ctx, r, pal, 0.58);
    drawGranules(ctx, r * 0.74, pal, rng, 8, !!(o.flags && o.flags.chl));
    ctx.restore();
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = hsla(pal.hue + 18, 80, 58, 0.44);
    ctx.lineWidth = Math.max(0.9, r * 0.035);
    const n = 7 + Math.round((g.sense || 0.5) * 5);
    for (let i = 0; i < n; i++) {
      const x = lerp(-r * 0.55, r * 0.55, i / Math.max(1, n - 1));
      const len = r * (0.70 + rng() * 0.72);
      ctx.beginPath();
      ctx.moveTo(x, r * 0.02);
      ctx.bezierCurveTo(x + (rng() - 0.5) * r * 0.20, r * 0.42, x + (rng() - 0.5) * r * 0.44, len, x + (rng() - 0.5) * r * 0.36, len);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOrganism(ctx, o, w, h, opts) {
    opts = opts || {};
    const g = genesOf(o);
    const key = (o.speciesKey || "x") + ":" + (o.id || "") + ":" + Math.round((g.formSeed || 0) * 1000);
    const rng = rngFrom(key);
    const pal = paletteFor(o, opts);
    const fill = opts.fill == null ? 0.42 : opts.fill;
    const sizeBoost = o.isMega ? 1.16 : 1;
    const sizeGene = clamp(g.size == null ? 0.5 : g.size, 0, 1);
    const topology = o.morphologyTopology || "single";
    // `r` is a fixed radius, not a bounding-box fit: the card clips past ~1.19r
    // vertically, so tall forms must be scaled down or their tails get cut off.
    const vkind = visualKind(o);
    const fitScale = VARIED_FORMS[vkind] ? variedFit(vkind, o) :
      vkind === "radial-star" ? Math.min(1, 1.06 / radialStarParams(o).tipR) :
      topology === "chain" ? 0.58 :
      topology === "branch" ? 0.78 :
      topology === "radial" ? 0.86 :
      topology === "amoeba" ? 0.90 : 1;
    const r = Math.max(10, Math.min(w, h) * fill * lerp(0.84, 1.12, sizeGene) * sizeBoost * fitScale);

    ctx.save();
    ctx.translate(w * 0.5, h * 0.50);
    drawShadow(ctx, r);
    if (opts.roster) ctx.translate(0, -h * 0.02);
    if (topology === "branch") ctx.translate(0, r * 0.08);
    if (topology !== "branch" && topology !== "mesh") ctx.rotate((rng() - 0.5) * 0.28);

    // sessile farmer: roots/tendrils spreading onto the field, drawn behind the body
    if (o.adaptations && o.adaptations.indexOf("sessileFarmer") >= 0) drawRootTendrils(ctx, r, pal, rng);

    if (topology === "chain") drawChain(ctx, o, r, pal, rng);
    else if (topology === "ring") drawRing(ctx, o, r, pal, rng);
    else if (topology === "radial") drawRadial(ctx, o, r, pal, rng);
    else if (topology === "branch") drawBranch(ctx, o, r, pal, rng);
    else if (topology === "cluster") drawCluster(ctx, o, r, pal, rng);
    else if (topology === "amoeba") drawAmoeba(ctx, o, r, pal, rng);
    else if (topology === "mesh") drawMesh(ctx, o, r, pal, rng);
    else drawSingle(ctx, o, r, pal, rng);

    if (o.isMega) {
      ctx.save();
      ctx.strokeStyle = hsla(pal.hue + 30, 76, 78, 0.24);
      ctx.lineWidth = Math.max(1, r * 0.035);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.05, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  global.OrganismRosterArt = {
    version: "generator-art-v1",
    drawOrganism,
    visualKind,
    singleShapes: SINGLE_SHAPES,
    // Diagnostic: a silhouette's reach in r units *after* its fit scale. The card
    // clips past ~1.06r vertically at the largest size gene, so tests can use this
    // to prove a per-species shape never grows out of its card.
    formExtent: function (kind, o) {
      if (kind === "radial-star") {
        const P = radialStarParams(o), fit = Math.min(1, 1.06 / P.tipR);
        return { x: P.tipR * fit, y: P.tipR * fit, fit: fit };
      }
      const fit = VARIED_FORMS[kind] ? variedFit(kind, o) : 1;
      const pts = singleOutline(kind, 1, o, rngFrom("fit:" + (o.speciesKey || "x")));
      let my = 0, mx = 0;
      for (let i = 0; i < pts.length; i++) {
        my = Math.max(my, Math.abs(pts[i].y));
        mx = Math.max(mx, Math.abs(pts[i].x));
      }
      return { x: mx * fit, y: my * fit, fit: fit };
    },
    visualTypes: [
      { id:"all", label:"All forms" },
      { id:"single-cell", label:"single cell" },
      { id:"single-leaf", label:"leaf swimmer" },
      { id:"single-spindle", label:"spindle cell" },
      { id:"single-teardrop", label:"teardrop cell" },
      { id:"single-pear", label:"pear cell" },
      { id:"single-gourd", label:"gourd / peanut" },
      { id:"single-clover", label:"clover / triple lobe" },
      { id:"single-trefoil", label:"trefoil cell" },
      { id:"single-triangle", label:"triangle cell" },
      { id:"single-fan", label:"fan cell" },
      { id:"single-star", label:"pointed star" },
      { id:"single-shard", label:"elongated star shard" },
      { id:"single-crescent", label:"crescent" },
      { id:"single-needle", label:"needle cell" },
      { id:"single-serpent", label:"segmented serpent" },
      { id:"single-forktail", label:"domed fork-tail" },
      { id:"single-sawback", label:"sawback (sawtooth dome)" },
      { id:"single-dart", label:"barbed dart" },
      { id:"single-barb", label:"barb (hooked harpoon)" },
      { id:"single-finned", label:"finned (crescent-tail fish)" },
      { id:"single-trap", label:"toothed trap" },
      { id:"chain-beads", label:"bead chain" },
      { id:"chain-segment", label:"segmented long body" },
      { id:"ring", label:"cell ring" },
      { id:"radial-arms", label:"beaded arms" },
      { id:"radial-star", label:"radial star (radiolarian)" },
      { id:"branch-vesicles", label:"branch vesicles" },
      { id:"cluster-bubbles", label:"bubble cluster" },
      { id:"cluster-rosette", label:"rosette cluster" },
      { id:"cluster-membrane", label:"membrane cluster" },
      { id:"amoeba", label:"amoeba" },
      { id:"mesh-lace", label:"lace mesh" }
    ]
  };
})(typeof window !== "undefined" ? window : globalThis);
