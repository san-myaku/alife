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
  global.OrganismRender = global.OrganismRender || {};
  global.OrganismRender.symbolShapePath = symbolShapePath;
})(typeof window !== 'undefined' ? window : this);
