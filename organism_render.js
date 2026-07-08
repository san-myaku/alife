/*
 * organism_render.js — shared, game-faithful organism renderer (ALIFE).
 * Extracted verbatim from index.html so the game and the generator draw
 * from one source. Pure canvas drawing; no game globals.
 * Stage 2 of the render extraction (see Obsidian: 描画アーキテクチャ解剖).
 */
(function (global) {
  'use strict';
  var TAU = Math.PI * 2;
  function clampLocal(x, a, b){ return Math.max(a, Math.min(b, x)); }
  function geneValue(o, key, fallback){
    return o && o.genes && Number.isFinite(o.genes[key]) ? o.genes[key] : fallback;
  }
  function det01(seed){
    var x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }
  function nodeInnerLimit(shape){
    if(shape==='triangle' || shape==='leaf' || shape==='sparkle4' || shape==='star6') return 0.20;
    if(shape==='diamond') return 0.23;
    if(shape==='blob6' || shape==='amoeba' || shape==='pseudopod') return 0.27;
    if(shape==='ellipse') return 0.25;
    return 0.29;
  }
  function drawPeripheralFilaments(c, o, posed, nodes, sym, outlineHue, topo, gait, dayNight, renderPerf, adaptationTags){
    if(!nodes.length || renderPerf.tiny) return;
    var diet = geneValue(o, 'diet', 0.5);
    var sense = geneValue(o, 'sense', 0.5);
    var speed = geneValue(o, 'speed', 0.5);
    var metabolism = geneValue(o, 'metabolism', 0.5);
    var predator = diet >= 0.66 || o.role === 'ambusher' || o.role === 'pack';
    var filterish = o.role === 'filter' || diet <= 0.34 || adaptationTags.indexOf('filterFan') >= 0;
    var special = topo === 'mesh' || topo === 'amoeba' || (o.flags && (o.flags.glow || o.flags.chl));
    var shouldDraw = predator || filterish || special || sense > 0.62;
    if(!shouldDraw) return;

    var visualR = Math.max(o.size, sym.visualR || o.size);
    var outer = [];
    for(var i=0;i<nodes.length;i++){
      var p = posed[i] || nodes[i];
      if(Math.hypot(p.x, p.y) + nodes[i].r >= visualR * 0.42) outer.push(i);
    }
    if(!outer.length) outer = nodes.map(function(_, i){ return i; });
    var maxN = renderPerf.low ? 12 : (predator ? 22 : 30);
    var step = Math.max(1, Math.ceil(outer.length / maxN));
    var nightAlpha = dayNight.isNight ? 0.72 : 1;
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = predator
      ? `hsla(${(outlineHue + 338) % 360},96%,78%,${0.16 * nightAlpha})`
      : (special
        ? `hsla(${(outlineHue + 80) % 360},92%,82%,${0.15 * nightAlpha})`
        : `hsla(${(outlineHue + 42) % 360},88%,84%,${0.13 * nightAlpha})`);
    c.lineWidth = Math.max(0.45, o.size * (predator ? 0.060 : 0.042));
    for(var oi=0; oi<outer.length; oi+=step){
      var idx = outer[oi];
      var n = nodes[idx], p = posed[idx] || n;
      var baseA = Math.atan2(p.y, p.x);
      if(!Number.isFinite(baseA) || Math.hypot(p.x, p.y) < o.size * 0.08) baseA = idx / Math.max(1, nodes.length) * TAU + sym.pulse;
      var fans = predator ? 1 : (filterish ? 2 : 1);
      for(var f=0; f<fans; f++){
        var fanOffset = fans === 1 ? 0 : (f - 0.5) * 0.26;
        var wobble = Math.sin(gait * 0.38 + idx * 1.41 + f) * 0.12;
        var a = baseA + fanOffset + wobble;
        var root = n.r * (predator ? 0.78 : 0.70);
        var len = o.size * (predator ? (0.52 + diet * 0.70 + speed * 0.18) : (0.34 + sense * 0.58 + metabolism * 0.12));
        var sx = p.x + Math.cos(a) * root;
        var sy = p.y + Math.sin(a) * root;
        var ex = p.x + Math.cos(a) * (root + len);
        var ey = p.y + Math.sin(a) * (root + len);
        var bend = Math.sin(gait * 0.70 + idx * 0.83 + f * 2.1) * len * (predator ? 0.10 : 0.26);
        c.beginPath();
        c.moveTo(sx, sy);
        if(predator){
          c.lineTo(ex, ey);
        } else {
          var mx = p.x + Math.cos(a) * (root + len * 0.54) + Math.cos(a + Math.PI / 2) * bend;
          var my = p.y + Math.sin(a) * (root + len * 0.54) + Math.sin(a + Math.PI / 2) * bend;
          c.quadraticCurveTo(mx, my, ex, ey);
        }
        c.stroke();
      }
    }
    c.restore();
  }
  function drawNodeInterior(c, o, shape, r, hue, sym, nodeIndex, energy, night, topo, outlineHue){
    if(r < 2.3) return;
    var diet = geneValue(o, 'diet', 0.5);
    var sense = geneValue(o, 'sense', 0.5);
    var metabolism = geneValue(o, 'metabolism', 0.5);
    var fecundity = geneValue(o, 'fecundity', 0.5);
    var limit = nodeInnerLimit(shape);
    var detailR = r * (limit + 0.22);
    var grainCount = Math.min(5, 1 + Math.round(sense * 2 + metabolism * 1.4 + (topo === 'cluster' ? 1 : 0)));
    var grainHue = diet < 0.34 ? 132 : (diet > 0.66 ? (hue + 338) % 360 : 44);
    c.save();
    c.globalCompositeOperation = 'lighter';
    for(var g=0; g<grainCount; g++){
      var seed = (nodeIndex + 1) * 31 + g * 17 + Math.round((o.size || 1) * 13);
      var a = det01(seed) * TAU;
      var dist = detailR * (0.18 + 0.58 * det01(seed + 3.7));
      var gx = Math.cos(a) * dist;
      var gy = Math.sin(a) * dist;
      var gr = Math.max(0.32, r * (0.040 + 0.055 * det01(seed + 9.1) + (topo === 'cluster' ? 0.016 : 0)));
      c.beginPath();
      c.arc(gx, gy, gr, 0, TAU);
      c.fillStyle = `hsla(${grainHue},88%,${diet > 0.66 ? 72 : 76}%,${clampLocal(0.13 + 0.10 * energy - 0.06 * night, 0.06, 0.24)})`;
      c.fill();
    }
    if(metabolism > 0.55 || topo === 'ring' || topo === 'mesh'){
      c.strokeStyle = `hsla(${(outlineHue + 96) % 360},78%,86%,${clampLocal(0.09 + metabolism * 0.09 - night * 0.05, 0.06, 0.18)})`;
      c.lineWidth = Math.max(0.35, r * 0.034);
      var arcs = topo === 'mesh' ? 3 : 2;
      for(var s=0; s<arcs; s++){
        var rr = r * (0.38 + s * 0.17 + fecundity * 0.05);
        c.beginPath();
        c.arc(0, 0, rr, sym.pulse + s * 1.4, sym.pulse + s * 1.4 + Math.PI * (0.70 + sense * 0.30));
        c.stroke();
      }
    }
    c.restore();
  }
  function symbolShapePath(c, shape, r){
      c.beginPath();
      if(shape==='circle'){
        c.arc(0,0,r,0,TAU);
      } else if(shape==='ellipse'){
        c.ellipse(0,0,r*1.42,r*0.72,0,0,TAU);
      } else if(shape==='leaf'){
        c.moveTo(0,-r*1.46);
        c.bezierCurveTo(r*0.62,-r*0.98,r*0.62,r*0.98,0,r*1.46);
        c.bezierCurveTo(-r*0.62,r*0.98,-r*0.62,-r*0.98,0,-r*1.46);
        c.closePath();
      } else if(shape==='diamond'){
        c.moveTo(0,-r*1.02);
        c.lineTo(r*1.30,-r*0.14);
        c.lineTo(0,r*1.02);
        c.lineTo(-r*1.30,r*0.14);
        c.closePath();
      } else if(shape==='sparkle4'){
        c.moveTo(0,-r*1.36);
        c.quadraticCurveTo(r*0.18,-r*0.34,r*1.36,0);
        c.quadraticCurveTo(r*0.18,r*0.34,0,r*1.36);
        c.quadraticCurveTo(-r*0.18,r*0.34,-r*1.36,0);
        c.quadraticCurveTo(-r*0.18,-r*0.34,0,-r*1.36);
        c.closePath();
      } else if(shape==='star6' || shape==='cloud5' || shape==='blob6' || shape==='amoeba' || shape==='pseudopod'){
        const points = shape==='star6' ? 6 : (shape==='cloud5' ? 5 : (shape==='pseudopod' ? 7 : 6));
        const samples = points*14;
        for(let i=0;i<=samples;i++){
          const a=-Math.PI/2 + i/samples*TAU;
          const wave=Math.cos(points*a);
          const soft=Math.sin((points-1)*a+0.72)*0.50 + Math.cos((points+2)*a-0.35)*0.30;
          let rr = shape==='star6' ? r*(0.82 + 0.28*wave) : r*(0.92 + 0.18*wave);
          if(shape==='blob6') rr = r*(0.96 + 0.13*wave + 0.08*soft);
          if(shape==='amoeba') rr = r*(0.98 + 0.18*Math.sin(3*a+0.4) + 0.10*Math.cos(6*a-0.8));
          if(shape==='pseudopod'){
            const front=Math.max(0,Math.cos(a-0.35));
            rr = r*(0.86 + 0.12*wave + 0.38*front*front + 0.08*soft);
          }
          const x=Math.cos(a)*rr*((shape==='cloud5'||shape==='amoeba')?1.08:(shape==='pseudopod'?1.18:1.0));
          const y=Math.sin(a)*rr*(shape==='cloud5'?0.98:(shape==='pseudopod'?0.90:1.0));
          if(i===0) c.moveTo(x,y); else c.lineTo(x,y);
        }
        c.closePath();
      } else if(shape==='square'){
        if(c.roundRect) c.roundRect(-r,-r,r*2,r*2,r*0.22);
        else c.rect(-r,-r,r*2,r*2);
      } else {
        const sides = shape==='triangle' ? 3 : (shape==='pentagon' ? 5 : 6);
        const start = shape==='triangle' ? -Math.PI/2 : -Math.PI/2 + Math.PI/sides;
        for(let i=0;i<sides;i++){
          const a=start + i/sides*TAU;
          const x=Math.cos(a)*r, y=Math.sin(a)*r;
          if(i===0) c.moveTo(x,y); else c.lineTo(x,y);
        }
        c.closePath();
      }
  }
  function buildSymbol(o, env){
    var SYMBOL_SHAPES=env.SYMBOL_SHAPES, clamp=env.clamp, formFromGenes=env.formFromGenes, rngFromKey=env.rngFromKey, speciesKey=env.speciesKey, speciesPalette=env.speciesPalette, topologyFromGenes=env.topologyFromGenes;
      const geneKey = Object.values(o.genes).map(v=>Math.round(v*101)).join('.');
      const seedKey = 'symbol:'+o.id+':'+geneKey;
      const rng = rngFromKey(seedKey);
      const pal = speciesPalette(o.speciesKey || speciesKey(o.genes));
      const baseHue = pal.hue;
      const shapeNames = SYMBOL_SHAPES;
      const shapeCount = shapeNames.length;
      const topology = o.morphologyTopology || topologyFromGenes(o.genes);
      const form = o.form || formFromGenes(o.genes,o.speciesKey);
      const primaryIndex = Math.max(0, Math.min(shapeCount-1, Math.floor(form.shape*shapeCount)));
      const secondaryIndex = Math.max(0, Math.min(shapeCount-1, Math.floor(clamp((form.detail*0.55 + form.layout*0.45),0,0.999)*shapeCount)));
      const solitaryChance = clamp(0.42 + 0.24*o.genes.size - 0.24*form.length - 0.14*o.genes.fecundity + 0.08*(rng()-0.5), 0.16, 0.66);
      const chainBase = 2 + form.length*4.4 + o.genes.fecundity*1.9 + rng()*1.4;
      const longChainChance = clamp(0.08 + form.length*0.30 + o.genes.sense*0.12 + o.genes.fecundity*0.10, 0.08, 0.54);
      const longChainBonus = rng()<longChainChance ? Math.round(2 + rng()*4 + form.length*2.2) : 0;
      const chainLen = (rng()<solitaryChance)
        ? 1
        : Math.max(2, Math.min(13, Math.round(chainBase + longChainBonus)));
      const ringBody = chainLen>=5 && rng()<clamp(0.05 + form.detail*0.30 + o.genes.metabolism*0.16 + o.genes.fecundity*0.08 - form.length*0.06, 0.04, 0.48);
      const tipFork = !ringBody && chainLen>=4 && rng()<clamp(0.10 + o.genes.sense*0.28 + form.detail*0.20 + form.length*0.12, 0.10, 0.58);
      const branchCount = chainLen<=1 ? 0 : (ringBody ? (rng()<0.28 + o.genes.sense*0.20 ? 1 : 0) : Math.max(0, Math.min(4, Math.round((o.genes.sense*2.0 + form.detail*1.7 + rng()*0.8) - (tipFork ? 1.75 : 1.35)))));
      const spacing = o.size*(0.78 + 0.38*form.length);
      const nodes = [];
      const extraLinks = [];
      const nodeR = o.size*(0.62 + 0.52*o.genes.size)*(0.92 + 0.12*rng());
      if(ringBody){
        const ringLen = Math.max(6, Math.min(15, chainLen + Math.round(form.detail*3.2 + rng()*2.2)));
        const ringR = spacing*ringLen/TAU*(0.72 + 0.18*rng());
        const oval = 0.82 + form.length*0.30;
        for(let i=0;i<ringLen;i++){
          const a = -Math.PI/2 + i/ringLen*TAU;
          const q = i/ringLen - 0.5;
          nodes.push({
            x: Math.cos(a)*ringR*oval,
            y: Math.sin(a)*ringR,
            r: nodeR,
            shape: primaryIndex,
            hue: baseHue,
            alpha: 0.44 + 0.34*o.genes.metabolism + 0.10*rng(),
            rot: rng()*TAU,
            parent: i>0 ? i-1 : -1,
            kind: 'ring'
          });
        }
        extraLinks.push({a:ringLen-1,b:0,kind:'ring'});
      } else {
        const mainStart = -spacing*(chainLen-1)*0.5;
        for(let i=0;i<chainLen;i++){
          const q = chainLen===1 ? 0 : (i/(chainLen-1)-0.5);
          const wob = Math.sin((i*0.95 + rng()*2.0))*o.size*(0.10 + 0.24*o.genes.sense);
          nodes.push({
            x: mainStart + i*spacing,
            y: wob,
            r: nodeR,
            shape: primaryIndex,
            hue: baseHue,
            alpha: 0.46 + 0.34*o.genes.metabolism + 0.12*rng(),
            rot: rng()*TAU,
            parent: i>0 ? i-1 : -1,
            kind: 'main'
          });
        }
      }
      const mainLen = nodes.length;
      for(let b=0;b<branchCount;b++){
        const parent = Math.max(0, Math.min(mainLen-1, Math.floor((0.26 + rng()*0.64)*mainLen)));
        const side = rng()<0.5 ? -1 : 1;
        const len = 1 + Math.floor(rng()*(1 + o.genes.fecundity*3));
        let px = nodes[parent].x;
        let py = nodes[parent].y;
        for(let j=0;j<len;j++){
          const ang = side*(0.65 + rng()*0.78) + (rng()-0.5)*0.35;
          const step = spacing*(0.72 + 0.28*rng());
          px += Math.cos(ang)*step;
          py += Math.sin(ang)*step;
          const parentIndex = j===0 ? parent : nodes.length-1;
          nodes.push({
            x:px, y:py,
            r:nodeR,
            shape: primaryIndex,
            hue:baseHue,
            alpha:0.38 + 0.30*o.genes.metabolism + 0.14*rng(),
            rot:rng()*TAU,
            parent:parentIndex,
            kind:'branch'
          });
        }
      }
      if(tipFork){
        const parent = mainLen-1;
        const prev = nodes[Math.max(0, mainLen-2)];
        const tip = nodes[parent];
        const baseAng = Math.atan2(tip.y-prev.y, tip.x-prev.x);
        for(const side of [-1,1]){
          const len = 1 + (rng()<0.34 + o.genes.fecundity*0.28 ? 1 : 0);
          let px = tip.x;
          let py = tip.y;
          let parentIndex = parent;
          for(let j=0;j<len;j++){
            const spread = 0.54 + rng()*0.36 + j*0.08;
            const ang = baseAng + side*spread + (rng()-0.5)*0.18;
            const step = spacing*(0.78 + 0.18*rng());
            px += Math.cos(ang)*step;
            py += Math.sin(ang)*step;
            nodes.push({
              x:px, y:py,
              r:nodeR,
              shape: primaryIndex,
              hue:baseHue,
              alpha:0.40 + 0.30*o.genes.metabolism + 0.12*rng(),
              rot:rng()*TAU,
              parent:parentIndex,
              kind:'tip'
            });
            parentIndex = nodes.length-1;
          }
        }
      }
      const resetNodes = ()=>{ nodes.length=0; extraLinks.length=0; };
      const addNode = (x,y,r=nodeR,parent=-1,kind='main',shape=primaryIndex,alpha=null,rot=null)=>{
        nodes.push({x,y,r,shape,hue:baseHue,alpha:alpha==null ? 0.46 + 0.34*o.genes.metabolism + 0.12*rng() : alpha,rot:rot==null ? rng()*TAU : rot,parent,kind});
        return nodes.length-1;
      };
      if(topology==='single'){
        resetNodes();
        addNode(0,0,nodeR*1.18,-1,'single');
      } else if(topology==='radial'){
        resetNodes();
        const center=addNode(0,0,nodeR*1.00,-1,'center',primaryIndex,0.56 + 0.26*o.genes.metabolism);
        const arms=5 + Math.round(form.detail*5);
        const rr=o.size*(1.25 + o.genes.sense*1.35);
        for(let i=0;i<arms;i++){
          const a=-Math.PI/2 + i/arms*TAU;
          addNode(Math.cos(a)*rr,Math.sin(a)*rr,nodeR*0.82,center,'ray',primaryIndex,0.42 + 0.28*o.genes.metabolism,a);
        }
      } else if(topology==='ring'){
        resetNodes();
        const ringLen=7 + Math.round(form.detail*5 + o.genes.metabolism*3);
        const ringR=spacing*ringLen/TAU*(0.74 + 0.12*rng());
        const oval=0.88 + form.length*0.18;
        for(let i=0;i<ringLen;i++){
          const a=-Math.PI/2 + i/ringLen*TAU;
          addNode(Math.cos(a)*ringR*oval,Math.sin(a)*ringR,nodeR*0.92,i>0?i-1:-1,'ring',primaryIndex,0.46 + 0.30*o.genes.metabolism,a);
        }
        extraLinks.push({a:ringLen-1,b:0,kind:'ring'});
      } else if(topology==='cluster'){
        resetNodes();
        const n=6 + Math.round(o.genes.fecundity*9);
        addNode(0,0,nodeR*0.88,-1,'cluster-core');
        for(let i=1;i<n;i++){
          const a=i/n*TAU + rng()*0.42;
          const rr=o.size*(0.55 + Math.sqrt(rng())*(1.4 + o.genes.fecundity*1.2));
          addNode(Math.cos(a)*rr,Math.sin(a)*rr,nodeR*(0.74+0.18*rng()),0,'cluster',primaryIndex,0.38 + 0.30*o.genes.metabolism,a);
        }
      } else if(topology==='amoeba'){
        resetNodes();
        const n=5 + Math.round(form.detail*4 + o.genes.fecundity*3);
        const core=addNode(0,0,nodeR*(1.04+0.18*rng()),-1,'amoeba-core',secondaryIndex,0.50 + 0.28*o.genes.metabolism);
        for(let i=0;i<n;i++){
          const a=i/n*TAU + rng()*0.50;
          const rr=o.size*(0.55 + Math.sqrt(rng())*(1.25 + form.wave*1.65));
          const lobeR=nodeR*(0.60 + 0.32*rng() + 0.10*form.wave);
          addNode(Math.cos(a)*rr,Math.sin(a)*rr,lobeR,core,'amoeba-lobe',11 + Math.floor(rng()*3),0.38 + 0.30*o.genes.metabolism,a);
        }
      } else if(topology==='mesh'){
        resetNodes();
        const cols=3, rows=2 + Math.round(form.detail*1.5);
        const sx=spacing*0.92, sy=spacing*0.76;
        for(let y=0;y<rows;y++){
          for(let x=0;x<cols;x++){
            const i=y*cols+x;
            const xx=(x-(cols-1)/2)*sx + (y%2-0.5)*sx*0.35;
            const yy=(y-(rows-1)/2)*sy;
            addNode(xx,yy,nodeR*0.72,i>0?Math.max(0,i-1):-1,'mesh',primaryIndex,0.40 + 0.30*o.genes.metabolism);
            if(x>0) extraLinks.push({a:i-1,b:i,kind:'mesh'});
            if(y>0) extraLinks.push({a:i-cols,b:i,kind:'mesh'});
          }
        }
      } else if(topology==='branch' && nodes.length<4){
        const root=nodes.length ? 0 : addNode(0,0,nodeR,-1,'main');
        for(const side of [-1,1]){
          let parent=root, px=nodes[root].x, py=nodes[root].y;
          for(let j=0;j<2;j++){
            const a=side*(0.75+j*0.12);
            px+=Math.cos(a)*spacing*0.82;
            py+=Math.sin(a)*spacing*0.82;
            parent=addNode(px,py,nodeR*0.92,parent,'branch');
          }
        }
      }
      let visualR = 0;
      for(const n of nodes){ visualR = Math.max(visualR, Math.hypot(n.x,n.y) + n.r); }
      const personalSpaceR = clamp(nodeR*(0.88 + Math.min(2.4, Math.sqrt(nodes.length))*0.16) + Math.min(visualR,o.size*5.2)*0.16, o.size*0.96, o.size*2.55);
      const symbol = {
        shapeNames,
        nodes,
        extraLinks,
        bodyPlan: topology,
        visualR,
        personalSpaceR,
        primaryIndex,
        secondaryIndex,
        outlineHue: baseHue,
        lineAlpha: 0.16 + 0.24*o.genes.sense,
        nucleusHue: pal.nucleusHue,
        gradientShift: pal.gradientShift,
        transparency: clamp(0.42 + 0.34*o.genes.metabolism - 0.12*o.genes.size, 0.30, 0.82),
        coreScale: 0.18 + 0.11*o.genes.fecundity,
        pulse: rng()*TAU,
        shapeRot: (rng()-0.5)*0.42,
        wiggleAmp: 0.14 + 0.54*o.genes.speed + 0.24*o.genes.sense,
        wiggleSpeed: 0.030 + 0.060*o.genes.speed,
        wigglePhase: rng()*TAU
      };
    return { symbol: symbol, personalSpaceR: personalSpaceR };
  }
  function drawOrganism(o, c, bake, env){
    var ADAPTATION_BY_ID=env.ADAPTATION_BY_ID, CONFIG=env.CONFIG, ROLE_HUE=env.ROLE_HUE, adaptationProfilesFromGenes=env.adaptationProfilesFromGenes, clamp=env.clamp, clamp01=env.clamp01, dayNight=env.dayNight, formFromGenes=env.formFromGenes, isPredatorBursting=env.isPredatorBursting, lerp=env.lerp, organismVisualScale=env.organismVisualScale, renderPerf=env.renderPerf, selectedOrganism=env.selectedOrganism, ui=env.ui;
      if(renderPerf.tiny && !bake){ o.drawTinySymbolic(); return; }
      const sym = o._symbol || (o.prepareSymbolDetails(), o._symbol);
      const nodes = sym.nodes || [];
      const visualScale=bake?.visualScale ?? organismVisualScale(this);
      if(!bake && !renderPerf.low && o.trail.length>1){
        c.beginPath();
        for(let i=0;i<o.trail.length;i++){ const p=o.trail[i]; if(i===0) c.moveTo(p.x,p.y); else c.lineTo(p.x,p.y); }
        c.strokeStyle='rgba(150,190,255,0.10)';
        c.lineWidth=Math.max(0.45,1.6*visualScale);
        c.stroke();
      }
      c.save();
      c.translate(bake?.x ?? o.x,bake?.y ?? o.y);
      if(!bake && ui.microView && visualScale>CONFIG.rendering.microView.baseScale+0.03){
        const hue=(sym.outlineHue ?? o.hue ?? 190);
        const rr=Math.max(4,(sym.visualR||o.size)*visualScale*1.22);
        c.beginPath();
        c.arc(0,0,rr,0,TAU);
        c.strokeStyle=`hsla(${hue},94%,86%,${this===selectedOrganism?0.34:0.18})`;
        c.lineWidth=this===selectedOrganism?1.3:1;
        c.stroke();
      }
      c.scale(visualScale,visualScale);
      c.rotate(Number.isFinite(bake?.heading) ? bake.heading : (Number.isFinite(o.heading) ? o.heading : 0));

      if(!bake && ui.showSense){
        c.beginPath(); c.arc(0,0,o.senseR,0,TAU);
        c.strokeStyle='rgba(100,180,255,0.08)';
        c.lineWidth=1;
        c.stroke();
      }
      if(!bake && o.newSpeciesFlash>0){
        const k=clamp(o.newSpeciesFlash/140,0,1);
        const hue=(o._symbol?.outlineHue ?? o.hue ?? 190);
        const rr=o.size*(1.85 + 0.95*(1-k));
        c.save();
        c.globalCompositeOperation='lighter';
        const halo=c.createRadialGradient(0,0,1,0,0,rr*1.35);
        halo.addColorStop(0,`hsla(${hue},96%,78%,${0.14*k})`);
        halo.addColorStop(1,'rgba(0,0,0,0)');
        c.fillStyle=halo; c.beginPath(); c.arc(0,0,rr*1.35,0,TAU); c.fill();
        c.strokeStyle=`hsla(${hue},96%,86%,${0.38*k})`;
        c.lineWidth=1.0+2.0*k;
        c.beginPath(); c.arc(0,0,rr,0,TAU); c.stroke();
        c.strokeStyle=`hsla(${(hue+70)%360},96%,88%,${0.22*k})`;
        c.lineWidth=0.8;
        c.beginPath(); c.arc(0,0,rr*(0.58+0.20*(1-k)),0,TAU); c.stroke();
        c.restore();
      }

      const roleHue = ROLE_HUE[o.role] ?? sym.outlineHue;
      const outlineHue = ui.roleViz ? roleHue : sym.outlineHue;
      const energy = clamp(o.energy/160,0,1);
      const night = clamp01(dayNight.night ?? (dayNight.isNight ? 1 : 0));
      const dayContrast = 1 - night;
      const motion = clamp(o.motionLevel||0,0,1.65);
      const predatorBursting=isPredatorBursting(this);
      const behavior = clamp(
        motion + (o.fleeTimer>0?0.35:0) + (predatorBursting?0.34:((o.role==='ambusher' && o.burstTimer>0)?0.30:0)) + (o.mateSeekT>120?0.10:0),
        0, 1.9
      );
      const intent = clamp(0.18 + behavior, 0.16, 1.9);
      const gait = bake?.gait ?? (o.gait || o.phase || 0);
      const topo = sym.bodyPlan || o.morphologyTopology || 'single';
      if(topo==='ring') c.rotate(Math.sin(gait*0.18 + sym.pulse)*0.10);
      if(topo==='amoeba') c.rotate(Math.sin(gait*0.16 + sym.pulse)*0.035);
      const pulse = 0.985 + 0.022*Math.sin(gait*0.65 + sym.pulse);
      const posed = [];
      for(let i=0;i<nodes.length;i++){
        const n=nodes[i];
        if(n.parent==null || n.parent<0 || !nodes[n.parent] || !posed[n.parent]){
          posed[i]={
            x:n.x,
            y:n.y + (nodes.length===1 ? Math.sin(gait*0.85 + sym.pulse)*o.size*0.045*intent : Math.sin(gait*0.45 + sym.pulse)*o.size*0.018*intent),
            angle:0,
            bend:0
          };
          continue;
        }
        const restParent=nodes[n.parent];
        const parentPose=posed[n.parent];
        const dx=n.x-restParent.x, dy=n.y-restParent.y;
        const len=Math.hypot(dx,dy)||1;
        let dynLen=len;
        if(topo==='radial') dynLen *= 1 + 0.070*Math.sin(gait*0.78 + i*0.62 + sym.pulse);
        else if(topo==='mesh') dynLen *= 0.965 + 0.045*Math.sin(gait*0.45 + sym.pulse);
        else if(topo==='cluster') dynLen *= 0.94 + 0.11*Math.sin(gait*0.72 + i*1.31);
        else if(topo==='amoeba') dynLen *= 0.90 + 0.14*Math.sin(gait*0.58 + i*0.81 + sym.pulse);
        const baseA=Math.atan2(dy,dx);
        let branchMul=n.kind==='ring'?0.34:(n.kind==='branch'||n.kind==='tip'?0.72:1.0);
        if(topo==='radial') branchMul=0.22;
        if(topo==='mesh') branchMul=0.18;
        if(topo==='cluster') branchMul=0.44;
        if(topo==='amoeba') branchMul=0.58;
        if(topo==='branch') branchMul*=1.35;
        const wave1=Math.sin(gait*1.15 + sym.wigglePhase + i*0.95 + (n.kind==='branch'?0.7:0));
        const wave2=Math.sin(gait*0.52 + sym.wigglePhase*1.7 + i*0.41);
        const joint=(wave1*0.78 + wave2*0.22) * sym.wiggleAmp * intent * branchMul;
        const inherited=(parentPose.bend||0)*0.76;
        const a=baseA + joint + inherited;
        posed[i]={
          x:parentPose.x + Math.cos(a)*dynLen,
          y:parentPose.y + Math.sin(a)*dynLen,
          angle:a,
          bend:joint + inherited*0.45
        };
      }

      const adaptationTags = adaptationProfilesFromGenes(o.genes, o.flags, topo, o.role);
      if(adaptationTags.length && !renderPerf.tiny){
        const form = o.form || formFromGenes(o.genes,o.speciesKey);
        const bodyR=Math.max(o.size*1.0,(sym.visualR||o.size)*0.48);
        if(adaptationTags.includes('adhesiveMat')){
          c.save();
          c.globalCompositeOperation='source-over';
          c.fillStyle=`hsla(${outlineHue},60%,62%,${dayNight.isNight?0.06:0.045})`;
          c.beginPath();
          c.ellipse(0,o.size*0.18,bodyR*1.55,bodyR*0.78,Math.sin(gait*0.08)*0.18,0,TAU);
          c.fill();
          c.restore();
        }
        if(adaptationTags.includes('tentacle') || adaptationTags.includes('filterFan')){
          c.save();
          c.globalCompositeOperation='lighter';
          const tentacleN = adaptationTags.includes('filterFan') ? 8 : (4 + Math.round(o.genes.sense*5));
          const spread = adaptationTags.includes('filterFan') ? TAU : Math.PI*1.35;
          const startA = adaptationTags.includes('filterFan') ? sym.pulse : -spread*0.5;
          c.strokeStyle=`hsla(${outlineHue},92%,84%,${dayNight.isNight?0.30:0.20})`;
          c.lineWidth=Math.max(0.65,o.size*0.07);
          c.lineCap='round';
          for(let i=0;i<tentacleN;i++){
            const q=tentacleN===1?0.5:i/(tentacleN-1);
            const a=startA + q*spread + Math.sin(gait*0.09+i)*0.10;
            const rootR=bodyR*(0.72+0.08*Math.sin(i));
            const len=o.size*(1.25 + o.genes.sense*1.65 + (adaptationTags.includes('filterFan')?0.55:0));
            const sx=Math.cos(a)*rootR, sy=Math.sin(a)*rootR;
            const ex=Math.cos(a)*(rootR+len), ey=Math.sin(a)*(rootR+len);
            const bend=Math.sin(gait*0.62 + i*1.7)*o.size*(0.28+form.detail*0.22);
            const mx=Math.cos(a)*(rootR+len*0.52) + Math.cos(a+Math.PI/2)*bend;
            const my=Math.sin(a)*(rootR+len*0.52) + Math.sin(a+Math.PI/2)*bend;
            c.beginPath();
            c.moveTo(sx,sy);
            c.quadraticCurveTo(mx,my,ex,ey);
            c.stroke();
            if(adaptationTags.includes('filterFan')){
              c.beginPath();
              c.arc(ex,ey,Math.max(0.45,o.size*0.055),0,TAU);
              c.fillStyle=`hsla(${(outlineHue+70)%360},94%,82%,0.20)`;
              c.fill();
            }
          }
          c.restore();
        }
        for(const d of adaptationTags.map(k=>ADAPTATION_BY_ID[k])) d?.draw?.(this,{ctx:c,bodyR,outlineHue,dayNight,form,sym});
        if(adaptationTags.includes('colonyBuilder')){
          c.save();
          const n=5 + Math.round(o.genes.fecundity*5);
          for(let i=0;i<n;i++){
            const a=i/n*TAU + Math.sin(gait*0.18+i)*0.10;
            const rr=bodyR*(1.05+0.25*Math.sin(gait*0.22+i));
            c.beginPath();
            c.arc(Math.cos(a)*rr,Math.sin(a)*rr,Math.max(0.8,o.size*0.12),0,TAU);
            c.fillStyle=`hsla(${outlineHue},72%,80%,0.18)`;
            c.fill();
          }
          c.restore();
        }
      }

      drawPeripheralFilaments(c, o, posed, nodes, sym, outlineHue, topo, gait, dayNight, renderPerf, adaptationTags);

      // Soft aura for readable overlap.
      if(!renderPerf.low){
        c.save();
        c.globalCompositeOperation='lighter';
        const auraR = o.size*(1.4 + 0.35*nodes.length);
        const aura=c.createRadialGradient(0,0,1,0,0,auraR);
        aura.addColorStop(0,`hsla(${outlineHue},82%,76%,${lerp(0.18,0.12,night)})`);
        aura.addColorStop(1,'rgba(0,0,0,0)');
        c.fillStyle=aura;
        c.beginPath(); c.arc(0,0,auraR,0,TAU); c.fill();
        c.restore();
      }

      // Smooth connective tissue between joints.
      c.save();
      c.lineCap='round';
      c.lineJoin='round';
      c.globalCompositeOperation='source-over';
      for(let i=0;i<nodes.length;i++){
        const n=nodes[i];
        if(n.parent==null || n.parent<0 || !nodes[n.parent]) continue;
        const p=posed[n.parent], q=posed[i];
        if(!p || !q) continue;
        const mx=(p.x+q.x)*0.5, my=(p.y+q.y)*0.5;
        const dx=q.x-p.x, dy=q.y-p.y;
        const d=Math.hypot(dx,dy)||1;
        const bend=(posed[i].bend||0);
        const cx=mx + (-dy/d)*bend*o.size*0.66;
        const cy=my + ( dx/d)*bend*o.size*0.66;
        c.beginPath();
        c.moveTo(p.x,p.y);
        c.quadraticCurveTo(cx,cy,q.x,q.y);
        const linkAlpha=clamp(sym.lineAlpha*lerp(0.86,0.54,night)*(0.75+0.25*energy),0.08,0.40);
        c.strokeStyle=`hsla(${outlineHue},82%,78%,${linkAlpha})`;
        c.lineWidth=Math.max(1.0, Math.min(nodes[n.parent].r,n.r)*0.30);
        c.stroke();
      }
      for(const link of (sym.extraLinks||[])){
        const p=posed[link.a], q=posed[link.b];
        if(!p || !q || !nodes[link.a] || !nodes[link.b]) continue;
        const mx=(p.x+q.x)*0.5, my=(p.y+q.y)*0.5;
        const dx=q.x-p.x, dy=q.y-p.y;
        const d=Math.hypot(dx,dy)||1;
        const bend=Math.sin(gait*0.82 + sym.wigglePhase + link.a*0.37)*sym.wiggleAmp*intent*0.22;
        const cx=mx + (-dy/d)*bend*o.size*0.38;
        const cy=my + ( dx/d)*bend*o.size*0.38;
        c.beginPath();
        c.moveTo(p.x,p.y);
        c.quadraticCurveTo(cx,cy,q.x,q.y);
        const linkAlpha=clamp(sym.lineAlpha*lerp(0.90,0.58,night)*(0.78+0.22*energy),0.10,0.44);
        c.strokeStyle=`hsla(${outlineHue},84%,80%,${linkAlpha})`;
        c.lineWidth=Math.max(1.0, Math.min(nodes[link.a].r,nodes[link.b].r)*0.30);
        c.stroke();
      }
      c.restore();

      // Articulation joints.
      if(!renderPerf.tiny){
        c.save();
        c.globalCompositeOperation='lighter';
        for(let i=0;i<nodes.length;i++){
          const n=nodes[i];
          if(n.parent==null || n.parent<0 || !posed[n.parent] || !posed[i]) continue;
          const p=posed[n.parent], q=posed[i];
          const jx=(p.x+q.x)*0.5, jy=(p.y+q.y)*0.5;
          const jr=Math.max(0.85, Math.min(nodes[n.parent].r,n.r)*0.18);
          c.beginPath();
          c.arc(jx,jy,jr,0,TAU);
          c.fillStyle=`hsla(${outlineHue},92%,84%,${0.20+0.16*energy+0.08*motion})`;
          c.fill();
          c.strokeStyle=`rgba(255,255,255,${0.22+0.16*energy+0.06*motion})`;
          c.lineWidth=0.7;
          c.stroke();
        }
        for(const link of (sym.extraLinks||[])){
          const p=posed[link.a], q=posed[link.b];
          if(!p || !q || !nodes[link.a] || !nodes[link.b]) continue;
          const jx=(p.x+q.x)*0.5, jy=(p.y+q.y)*0.5;
          const jr=Math.max(0.85, Math.min(nodes[link.a].r,nodes[link.b].r)*0.18);
          c.beginPath();
          c.arc(jx,jy,jr,0,TAU);
          c.fillStyle=`hsla(${outlineHue},94%,86%,${0.18+0.16*energy+0.06*motion})`;
          c.fill();
          c.strokeStyle=`rgba(255,255,255,${0.20+0.16*energy+0.05*motion})`;
          c.lineWidth=0.7;
          c.stroke();
        }
        c.restore();
      }

      for(let i=0;i<nodes.length;i++){
        const n=nodes[i];
        const pn=posed[i] || n;
        const shape = sym.shapeNames[n.shape] || 'circle';
        const hue = ui.roleViz ? roleHue : n.hue;
        const r = n.r * pulse;
        const alpha = clamp(n.alpha*sym.transparency, 0.20, 0.84);
        c.save();
        c.translate(pn.x,pn.y);
        c.rotate(sym.shapeRot || 0);

        if(renderPerf.tiny){
          c.fillStyle=`hsla(${hue},78%,58%,${alpha})`;
        } else {
          const grad=c.createRadialGradient(-r*0.35,-r*0.38,Math.max(0.8,r*0.08),0,0,r*1.35);
          grad.addColorStop(0,`hsla(${(hue+sym.gradientShift*0.28)%360},92%,78%,${alpha+0.06})`);
          grad.addColorStop(0.62,`hsla(${hue},78%,58%,${alpha})`);
          grad.addColorStop(1,`hsla(${(hue+24)%360},72%,48%,${alpha*0.82})`);
          c.fillStyle=grad;
        }
        o.symbolShapePath(c, shape, r);
        c.fill();

        c.strokeStyle=`hsla(${(hue+210)%360},44%,42%,${clamp(0.25 + 0.09*energy - 0.16*night,0.06,0.34)})`;
        c.lineWidth=Math.max(1.0,r*0.13);
        o.symbolShapePath(c, shape, r);
        c.stroke();

        c.strokeStyle=`hsla(${hue},96%,${Math.round(lerp(96,88,night))}%,${clamp(0.50 + 0.28*energy + 0.08*dayContrast,0,0.86)})`;
        c.lineWidth=Math.max(0.75,r*0.09);
        o.symbolShapePath(c, shape, r);
        c.stroke();

        if(!renderPerf.tiny){
          drawNodeInterior(c, o, shape, r, hue, sym, i, energy, night, topo, outlineHue);
        }

        // Round nucleus: centered and kept inside every shape.
        const shapeLimit = nodeInnerLimit(shape);
        const nucR=Math.max(0.9, Math.min(r*shapeLimit, r*sym.coreScale));
        const nucX=0, nucY=0;
        const ng=c.createRadialGradient(nucX-nucR*0.25,nucY-nucR*0.25,0.2,nucX,nucY,nucR*1.45);
        ng.addColorStop(0,`hsla(${sym.nucleusHue},90%,88%,${0.72 + 0.18*energy})`);
        ng.addColorStop(0.55,`hsla(${sym.nucleusHue},75%,52%,${0.48 + 0.22*energy})`);
        ng.addColorStop(1,'rgba(0,0,0,0)');
        c.fillStyle=ng;
        c.beginPath();
        c.arc(nucX,nucY,nucR*1.45,0,TAU);
        c.fill();
        c.strokeStyle=`rgba(255,255,255,${0.26 + 0.22*energy})`;
        c.lineWidth=Math.max(0.55,nucR*0.16);
        c.beginPath(); c.arc(nucX,nucY,nucR,0,TAU); c.stroke();

        // Tiny marker rings make variants distinct without becoming noisy.
        if((i + sym.primaryIndex) % 3 === 0){
          c.strokeStyle=`hsla(${(hue+120)%360},90%,82%,${0.18 + 0.12*energy})`;
          c.lineWidth=0.6;
          c.beginPath(); c.arc(-r*0.30,r*0.24,Math.max(0.7,r*0.16),0,TAU); c.stroke();
        }
        c.restore();
      }

      if(o.flags && o.flags.chl && !renderPerf.tiny){
        c.save();
        c.globalCompositeOperation='lighter';
        const k=dayNight.isNight?0.38:0.78;
        for(let i=0;i<Math.min(6,nodes.length+2);i++){
          const a=i/Math.min(6,nodes.length+2)*TAU + sym.pulse;
          const rr=Math.max(o.size*1.1, (sym.visualR||o.size)*0.42);
          c.beginPath(); c.arc(Math.cos(a)*rr*0.45,Math.sin(a)*rr*0.45,Math.max(0.9,o.size*0.13),0,TAU);
          c.fillStyle=`rgba(102,238,142,${0.18*k})`;
          c.fill();
        }
        c.restore();
      }
      if(o.flags && o.flags.glow && !renderPerf.tiny){
        const k=(dayNight.isNight?0.58:0.18)*(0.75+0.25*Math.sin(gait+o.id));
        c.save(); c.globalCompositeOperation='lighter';
        const rr=Math.max(o.size*2.0,(sym.visualR||o.size)*1.04);
        const g=c.createRadialGradient(0,0,1,0,0,rr);
        g.addColorStop(0,`hsla(${outlineHue},96%,84%,${k})`);
        g.addColorStop(1,'rgba(0,0,0,0)');
        c.fillStyle=g; c.beginPath(); c.arc(0,0,rr,0,TAU); c.fill();
        c.restore();
      }
      if(o.flags && o.flags.crown && !renderPerf.tiny){
        c.save(); c.globalCompositeOperation='lighter';
        const rr=Math.max(o.size*1.5,(sym.visualR||o.size)*0.62);
        const n=7;
        for(let i=0;i<n;i++){
          const a=i/n*TAU + sym.pulse*0.15;
          c.beginPath(); c.arc(Math.cos(a)*rr,Math.sin(a)*rr,Math.max(0.8,o.size*0.10),0,TAU);
          c.fillStyle=`hsla(${outlineHue},96%,86%,0.28)`;
          c.fill();
        }
        c.restore();
      }
      if(o.flags && o.flags.colony && !renderPerf.tiny){
        c.save();
        const rr=Math.max(o.size*1.35,(sym.visualR||o.size)*0.56);
        for(let i=0;i<5;i++){
          const a=i/5*TAU + Math.sin(gait*0.33+i)*0.12;
          c.beginPath(); c.arc(Math.cos(a)*rr,Math.sin(a)*rr,Math.max(0.9,o.size*0.15),0,TAU);
          c.fillStyle=`hsla(${outlineHue},70%,82%,0.22)`;
          c.fill();
          c.strokeStyle=`rgba(238,252,255,0.20)`; c.lineWidth=0.6; c.stroke();
        }
        c.restore();
      }

      if(!bake && (o.chaseTimer>0 || o.preyTargetId)){
        c.beginPath();
        c.arc(0,0,Math.max(o.size*1.75,(sym.visualR||o.size)*0.80),0,TAU);
        c.strokeStyle=predatorBursting?'rgba(255,170,90,0.52)':'rgba(255,118,126,0.34)';
        c.lineWidth=predatorBursting?1.8:1.4;
        c.stroke();
      }
      if(!bake && o.fleeTimer>0){
        const fk=clamp(o.fleeTimer/42,0,1);
        c.beginPath();
        c.arc(0,0,Math.max(o.size*1.65,(sym.visualR||o.size)*0.72)*(1.0+0.18*Math.sin(gait*0.8)),0,TAU);
        c.strokeStyle=`rgba(172,235,255,${0.16+0.20*fk})`;
        c.lineWidth=1.2;
        c.stroke();
      }

      if(!bake && o.protect>0){
        c.beginPath();
        c.arc(0,0,o.size*(1.35 + Math.min(4,nodes.length)*0.18),0,TAU);
        c.strokeStyle='rgba(255,255,255,0.16)';
        c.lineWidth=1;
        c.stroke();
      }
      c.restore();
  }
  global.OrganismRender = global.OrganismRender || {};
  global.OrganismRender.symbolShapePath = symbolShapePath;
  global.OrganismRender.buildSymbol = buildSymbol;
  global.OrganismRender.drawOrganism = drawOrganism;
})(typeof window !== 'undefined' ? window : this);
