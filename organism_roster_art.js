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
    const f = o.flags || {};
    return !!(o.isMega || f.glow || f.crown || f.colony || f.chl || o.morphologyTopology === "mesh");
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
    const n = 42;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const front = Math.max(0, Math.cos(a));
      const lobes = 1 + irregular * 0.18 * Math.sin(a * 3 + rng() * 0.2) +
        irregular * 0.10 * Math.sin(a * 5.5 + 1.7);
      const taper = 1 + point * 0.22 * front - point * 0.10 * Math.max(0, -Math.cos(a));
      const x = Math.cos(a) * r * aspect * lobes * taper;
      const y = Math.sin(a) * r * (1 + irregular * 0.08 * Math.cos(a * 4));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function fillAndStroke(ctx, r, pal, alpha) {
    ctx.fillStyle = bodyGradient(ctx, r, pal, alpha == null ? 0.82 : alpha);
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = Math.max(0.9, r * 0.038);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = hsla(pal.hue + 24, 60, 94, 0.20);
    ctx.lineWidth = Math.max(0.6, r * 0.018);
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
      const inner = r * (0.84 + rng() * 0.10);
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

  function drawCilia(ctx, r, pal, rng, count, len, alpha) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = hsla(pal.hue + 18, 84, 73, alpha || 0.34);
    ctx.lineWidth = Math.max(0.65, r * 0.025);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + rng() * 0.08;
      const inner = r * (0.86 + rng() * 0.08);
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
      drawNucleus(ctx, x2, y2, r * 0.09, pal, rng, 0.80);
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
    if (f.crown) drawSpines(ctx, r * 1.05, pal, rng, 10, 0.38);
    if (f.colony) {
      ctx.save();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + rng() * 0.2;
        const d = r * (1.10 + rng() * 0.18);
        drawNucleus(ctx, Math.cos(a) * d, Math.sin(a) * d, r * 0.13, pal, rng, 0.76);
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
    if ((g.sense || 0.5) > 0.62) {
      ctx.strokeStyle = hsla(pal.hue + 18, 80, 40, 0.50);
      ctx.lineWidth = Math.max(0.8, r * 0.028);
      ctx.beginPath();
      ctx.moveTo(r * 0.92, -r * 0.12);
      ctx.quadraticCurveTo(r * 1.42, -r * 0.68, r * 1.26, -r * 1.06);
      ctx.stroke();
    }
    drawNucleus(ctx, -r * 0.05, -r * 0.02, r * 0.17, pal, rng, 0.85);
    drawFineHalo(ctx, r * 0.78, pal, rng, 10, 0.24, 0.14);
    ctx.restore();
  }

  function drawCrescent(ctx, o, r, pal, rng) {
    ctx.save();
    ctx.rotate(-0.20 + rng() * 0.24);
    ctx.beginPath();
    for (let i = 0; i <= 32; i++) {
      const a = -1.32 + (i / 32) * 2.64;
      ctx.lineTo(Math.cos(a) * r * 1.12, Math.sin(a) * r * 0.88);
    }
    for (let i = 32; i >= 0; i--) {
      const a = -1.05 + (i / 32) * 2.10;
      ctx.lineTo(r * 0.32 + Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.52);
    }
    ctx.closePath();
    fillAndStroke(ctx, r, pal, 0.64);
    drawFineHalo(ctx, r * 0.78, pal, rng, 9, 0.48, 0.27);
    drawSurfaceSpeckles(ctx, r, pal, rng, 10, 0.18);
    drawNucleus(ctx, -r * 0.22, 0, r * 0.18, pal, rng, 0.92);
    ctx.restore();
  }

  function drawSingle(ctx, o, r, pal, rng) {
    const g = genesOf(o);
    if ((g.diet || 0.5) > 0.68 && (g.speed || 0.5) > 0.42) drawCrescent(ctx, o, r, pal, rng);
    else if ((g.speed || 0.5) > 0.62 || (o.flags && o.flags.chl)) drawLeaf(ctx, o, r, pal, rng);
    else drawCellBlob(ctx, o, r, pal, rng);
    if ((g.diet || 0.5) < 0.42) drawCilia(ctx, r, pal, rng, 24, 0.45, 0.28);
    if ((g.sense || 0.5) > 0.72) drawAntennae(ctx, r, pal, rng, 5);
    drawRare(ctx, o, r, pal, rng);
  }

  function drawChain(ctx, o, r, pal, rng) {
    const g = genesOf(o);
    const n = 3 + Math.round(clamp((g.fecundity || 0.5) * 5 + (o.form ? o.form.length : 0.5) * 2, 0, 7));
    const step = r * lerp(0.48, 0.64, g.speed || 0.5);
    ctx.save();
    ctx.rotate(-0.42 + rng() * 0.55);
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
    if ((g.diet || 0.5) > 0.64) drawFineHalo(ctx, r * 0.85, pal, rng, 16, 0.42, 0.24);
    else drawFineHalo(ctx, r * 0.90, pal, rng, 22, 0.30, 0.18);
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

  function drawRadial(ctx, o, r, pal, rng) {
    const g = genesOf(o);
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
    const n = 8 + Math.round((g.fecundity || 0.5) * 10);
    ctx.save();
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU;
      const d = Math.sqrt(rng()) * r * 0.66;
      const x = Math.cos(a) * d;
      const y = Math.sin(a) * d;
      const rr = r * (0.19 + rng() * 0.13);
      ctx.save();
      ctx.translate(x, y);
      drawBlobPath(ctx, rr, 1.0 + (rng() - 0.5) * 0.25, 0.28, 0.1, rng);
      fillAndStroke(ctx, rr, pal, 0.72);
      drawNucleus(ctx, 0, 0, rr * 0.32, pal, rng, 0.70);
      ctx.restore();
    }
    if ((g.diet || 0.5) < 0.40) drawCilia(ctx, r * 0.82, pal, rng, 30, 0.32, 0.20);
    ctx.restore();
  }

  function drawAmoeba(ctx, o, r, pal, rng) {
    const g = genesOf(o);
    ctx.save();
    ctx.beginPath();
    const n = 54;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const wave = 1 + 0.25 * Math.sin(a * 3.0 + 0.7) + 0.16 * Math.sin(a * 6.0 + 1.8);
      const pseudo = Math.max(0, Math.cos(a * 4 + 0.4)) * 0.24;
      const rr = r * (0.74 + wave * 0.15 + pseudo);
      const x = Math.cos(a) * rr * (1.06 + (g.speed || 0.5) * 0.24);
      const y = Math.sin(a) * rr * (0.92 + (g.size || 0.5) * 0.08);
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
    const rings = 2 + Math.round((g.metabolism || 0.5) * 2);
    const nodes = [];
    for (let ring = 0; ring < rings; ring++) {
      const n = 6 + ring * 4;
      const d = r * (0.22 + ring * 0.24);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + ring * 0.18;
        nodes.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, ring, i, n });
      }
    }
    ctx.save();
    ctx.strokeStyle = hsla(pal.hue + 8, 64, 48, 0.44);
    ctx.lineWidth = Math.max(0.9, r * 0.035);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < r * 0.35) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
    for (const node of nodes) drawNucleus(ctx, node.x, node.y, r * 0.055, pal, rng, 0.70);
    drawNucleus(ctx, 0, 0, r * 0.18, pal, rng, 0.86);
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

    if (topology === "chain") drawChain(ctx, o, r, pal, rng);
    else if (topology === "ring") drawRing(ctx, o, r, pal, rng);
    else if (topology === "radial") drawRadial(ctx, o, r, pal, rng);
    else if (topology === "branch") drawBranch(ctx, o, r, pal, rng);
    else if (topology === "cluster") drawCluster(ctx, o, r, pal, rng);
    else if (topology === "amoeba") drawAmoeba(ctx, o, r, pal, rng);
    else if (topology === "mesh") drawMesh(ctx, o, r, pal, rng);
    else if ((g.sense || 0.5) > 0.78 && (g.size || 0.5) > 0.55) drawJelly(ctx, o, r, pal, rng);
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
    drawOrganism
  };
})(typeof window !== "undefined" ? window : globalThis);
