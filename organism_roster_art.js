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
      var singleShapes = ["single-cell", "single-teardrop", "single-pear", "single-gourd", "single-clover", "single-trefoil", "single-triangle", "single-fan", "single-crescent", "single-needle", "single-trap"];
      return singleShapes[Math.min(singleShapes.length - 1, Math.floor((g.formSeed == null ? 0.5 : g.formSeed) * singleShapes.length))];
    }
    if (topology === "radial") {
      if (variantIndex(o, "radial", 3) === 2) return "radial-arms";
      return (g.diet || 0.5) > 0.62 ? "radial-spines" : "radial-beads";
    }
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
    const pts = [];
    for (let i = 0; i <= m; i++) {
      const a = -A + (i / m) * 2 * A;
      const w = wmax * (1 - Math.pow(a / A, 2));
      const cx = Math.sin(a) * Rc, cy = cyc - Math.cos(a) * Rc;
      const ox = Math.sin(a), oy = -Math.cos(a);
      pts.push({ x: cx + ox * w * 0.5, y: cy + oy * w * 0.5 });
    }
    for (let i = m; i >= 0; i--) {
      const a = -A + (i / m) * 2 * A;
      const w = wmax * (1 - Math.pow(a / A, 2));
      const cx = Math.sin(a) * Rc, cy = cyc - Math.cos(a) * Rc;
      const ox = Math.sin(a), oy = -Math.cos(a);
      pts.push({ x: cx - ox * w * 0.5, y: cy - oy * w * 0.5 });
    }
    appendageBehind(ctx, o, r, pal, rng, pts); // selectable appendage, behind the body
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
  function singleOutline(kind, r, o, rng) {
    const form = o.form || {};
    const pts = [], n = 84;
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
    for (let i=0;i<n;i++){
      const a = (i/n)*TAU; let x, y;
      if (kind === "single-pear") {
        const cy = Math.sin(a), t = -cy;
        const bottom = Math.exp(-Math.pow((t+0.5)/0.5,2)), top = Math.exp(-Math.pow((t-0.6)/0.36,2));
        const w = 0.66*bottom + 0.40*top + 0.06;
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
  function appendageBehind(ctx, o, r, pal, rng, pts) {
    const g = genesOf(o), diet = g.diet == null ? 0.5 : g.diet;
    const c = _centroid(pts);
    function norm(p){ const dx=p.x-c.x, dy=p.y-c.y, m=Math.hypot(dx,dy)||1; return {nx:dx/m, ny:dy/m}; }
    let h = hashStr32((o.speciesKey || "x") + ":app:" + Math.round((g.formSeed || 0) * 997)) / 4294967296;
    let kind;
    if (o.appendageKind && o.appendageKind !== "auto") {
      kind = o.appendageKind;                 // explicit override from the generator UI
    } else {
      kind = h < 0.34 ? "cilia" : (h < 0.60 ? "spikes" : (h < 0.80 ? "antennae" : "flagella"));
      if (diet > 0.66 && kind === "cilia") kind = "spikes";
      if (diet < 0.33 && kind === "spikes") kind = "cilia";
    }
    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (kind === "cilia") {
      ctx.strokeStyle = hsla(pal.hue + 30, 70, 82, 0.30); ctx.lineWidth = Math.max(0.5, r * 0.017);
      const count = Math.min(pts.length, 34 + Math.round(h * 26));
      for (let i=0;i<count;i++){ const p = pts[Math.floor(i/count*pts.length)]; const nn = norm(p); const len = r*(0.09 + 0.05*Math.abs(Math.sin(i*1.7))); ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x+nn.nx*len, p.y+nn.ny*len); ctx.stroke(); }
    } else if (kind === "spikes") {
      ctx.strokeStyle = hsla(pal.hue - 10, 88, 52, 0.55); ctx.fillStyle = hsla(pal.hue + 8, 88, 70, 0.28); ctx.lineWidth = Math.max(0.8, r * 0.028);
      const spikes = 9 + Math.round(h * 8);
      for (let i=0;i<spikes;i++){ const p = pts[Math.floor(i/spikes*pts.length)]; const nn = norm(p); const len = r*(0.26 + h*0.22); const tx=p.x+nn.nx*len, ty=p.y+nn.ny*len; const bw = r*0.05; ctx.beginPath(); ctx.moveTo(p.x-(-nn.ny)*bw, p.y-(nn.nx)*bw); ctx.lineTo(tx,ty); ctx.lineTo(p.x+(-nn.ny)*bw, p.y+(nn.nx)*bw); ctx.closePath(); ctx.fill(); ctx.stroke(); }
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

  function drawSingle(ctx, o, r, pal, rng) {
    const kind = visualKind(o);
    if (kind === "single-leaf") { drawLeaf(ctx, o, r, pal, rng); drawRare(ctx, o, r, pal, rng); return; }
    if (kind === "single-spindle") { drawSpindle(ctx, o, r, pal, rng); drawRare(ctx, o, r, pal, rng); return; }
    if (kind === "single-crescent") { drawCrescent(ctx, o, r, pal, rng); drawRare(ctx, o, r, pal, rng); return; }
    if (kind === "single-needle") { drawNeedle(ctx, o, r, pal, rng); drawRare(ctx, o, r, pal, rng); return; }
    if (kind === "single-trap") { drawTrap(ctx, o, r, pal, rng); drawRare(ctx, o, r, pal, rng); return; }
    const pts = singleOutline(kind, r, o, rng);
    appendageBehind(ctx, o, r, pal, rng, pts); // behind the body
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
    const variant = variantIndex(o, "chain", 3);
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
    drawChainEdgeCilia(ctx, n, step, r, pal, rng, (g.diet || 0.5) > 0.64);
    if (variant === 2 && (g.speed || 0.5) > 0.40) {
      const endX = (n - 1) * 0.5 * step;
      const endY = Math.sin((n - 1) * 0.9) * r * 0.18;
      drawAttachedFlagellum(ctx, endX + r * 0.26, endY, -0.12, r * 0.66, pal, rng, 0.34);
    }
    ctx.restore();
  }

  function drawRing(ctx, o, r, pal, rng) {
    const g = genesOf(o);
    const n = 8 + Math.round((g.fecundity || 0.5) * 6);
    ctx.save();
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
    drawFineHalo(ctx, r * 0.78, pal, rng, 34, 0.16, 0.15);
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

  function drawRadial(ctx, o, r, pal, rng) {
    const g = genesOf(o);
    if (visualKind(o) === "radial-arms") { drawRadialArms(ctx, o, r, pal, rng); return; }
    const pred = (g.diet || 0.5) > 0.62;
    const points = 9 + Math.round((g.sense || 0.5) * 8);
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = hsla(pal.hue - 8, pred ? 70 : 56, pred ? 48 : 58, pred ? 0.42 : 0.28);
    ctx.lineWidth = Math.max(0.7, r * (pred ? 0.025 : 0.018));
    for (let i = 0; i < points; i++) {
      const a = (i / points) * TAU + (rng() - 0.5) * 0.08;
      const inner = r * (0.62 + rng() * 0.07);
      const outer = r * (pred ? 1.24 + rng() * 0.24 : 1.06 + rng() * 0.14);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.quadraticCurveTo(
        Math.cos(a + 0.04) * (inner + outer) * 0.5,
        Math.sin(a + 0.04) * (inner + outer) * 0.5,
        Math.cos(a) * outer,
        Math.sin(a) * outer
      );
      ctx.stroke();
      if (!pred && i % 2 === 0) {
        drawNucleus(ctx, Math.cos(a) * outer, Math.sin(a) * outer, r * 0.045, pal, rng, 0.58);
      }
    }
    ctx.restore();
    if (pred) drawFineHalo(ctx, r * 0.84, pal, rng, points, 0.62, 0.24);
    else drawFineHalo(ctx, r * 0.86, pal, rng, points * 2, 0.34, 0.16);
    ctx.save();
    drawBlobPath(ctx, r * 0.82, 1.02, 0.18, pred ? 0.26 : 0.08, rng);
    fillAndStroke(ctx, r, pal, 0.62);
    ctx.clip();
    drawGranules(ctx, r * 0.70, pal, rng, 10 + Math.round((g.sense || 0.5) * 10), !!(o.flags && o.flags.chl));
    drawSurfaceSpeckles(ctx, r, pal, rng, 22, 0.22);
    drawNucleus(ctx, 0, 0, r * 0.22, pal, rng, 0.95);
    ctx.restore();
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
      const petals = 5 + Math.round((g.fecundity || 0.5) * 4);
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * TAU + rng() * 0.08;
        const d = r * (0.34 + rng() * 0.08);
        drawOvalCell(ctx, Math.cos(a) * d, Math.sin(a) * d, r * 0.22, r * 0.29, a, pal, rng, 0.68);
      }
      drawOvalCell(ctx, 0, 0, r * 0.24, r * 0.24, 0, pal, rng, 0.78);
      drawFineHalo(ctx, r * 0.70, pal, rng, 18, 0.18, 0.12);
      ctx.restore();
      return;
    }

    if (variant === 2) {
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
    // cilia hugging the outline (behind the translucent body)
    ctx.save();
    ctx.lineCap = "round";
    const meshPred = (g.diet || 0.5) > 0.62;
    ctx.strokeStyle = hsla(pal.hue + (meshPred ? -6 : 26), 66, meshPred ? 60 : 80, 0.26);
    ctx.lineWidth = Math.max(0.5, r * 0.016);
    for (let i = 0; i < mpts.length; i += 2) {
      const p = mpts[i], m = Math.hypot(p.x, p.y) || 1;
      const len = r * (0.10 + 0.05 * Math.abs(Math.sin(i * 1.3)));
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + (p.x / m) * len, p.y + (p.y / m) * len);
      ctx.stroke();
    }
    ctx.restore();

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
    const fitScale = topology === "chain" ? 0.58 :
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
      { id:"single-crescent", label:"crescent" },
      { id:"single-needle", label:"needle cell" },
      { id:"single-trap", label:"toothed trap" },
      { id:"chain-beads", label:"bead chain" },
      { id:"chain-segment", label:"segmented long body" },
      { id:"ring", label:"cell ring" },
      { id:"radial-spines", label:"radial spines" },
      { id:"radial-beads", label:"radial beads" },
      { id:"radial-arms", label:"beaded arms" },
      { id:"branch-vesicles", label:"branch vesicles" },
      { id:"cluster-bubbles", label:"bubble cluster" },
      { id:"cluster-rosette", label:"rosette cluster" },
      { id:"cluster-membrane", label:"membrane cluster" },
      { id:"amoeba", label:"amoeba" },
      { id:"mesh-lace", label:"lace mesh" }
    ]
  };
})(typeof window !== "undefined" ? window : globalThis);
