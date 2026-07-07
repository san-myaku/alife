/*
 * organism_render.js — shared, game-faithful organism renderer (ALIFE).
 * Extracted verbatim from index.html so the game and the generator draw
 * from one source. Pure canvas drawing; no game globals.
 * Stage 2 of the render extraction (see Obsidian: 描画アーキテクチャ解剖).
 */
(function (global) {
  'use strict';
  var TAU = Math.PI * 2;
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
  global.OrganismRender = global.OrganismRender || {};
  global.OrganismRender.symbolShapePath = symbolShapePath;
  global.OrganismRender.buildSymbol = buildSymbol;
})(typeof window !== 'undefined' ? window : this);
