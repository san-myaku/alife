/*
 * organism_model.js — shared gene->phenotype helpers (ALIFE).
 * Copied VERBATIM from index.html so the generator derives creatures
 * exactly like the game. If the game changes these, re-sync this file.
 * (Stage 3A of the render unification.)
 */
(function (global) {
  "use strict";
  const TAU=Math.PI*2; const rnd=(a,b)=>Math.random()*(b-a)+a; const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)); const clamp01=(x)=>clamp(x,0,1); const lerp=(a,b,t)=>a+(b-a)*t; const sigmoid=x=>1/(1+Math.exp(-x));
  const hash01 = (s)=>{ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h>>>0)/2**32; };
  const ROLE_HUE = { ambusher:285, pack:6, scav:45, filter:145, other:200 };
  function q4(x){ return x<0.25?0: x<0.5?1: x<0.75?2:3; }
  function q3(x){ return x<1/3?0: x<2/3?1:2; }
  function hashStr32(s){ let h=0x811c9dc5; for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = (h>>>0) * 0x01000193; h>>>0; } return h>>>0; }
  function rngFromKey(key){ let x = hashStr32(String(key))||1; return function(){ x ^= x<<13; x ^= x>>>17; x ^= x<<5; x>>>=0; return (x & 0xffffffff)/0x100000000; }; }
  const SYMBOL_SHAPES = Object.freeze(['circle','square','triangle','ellipse','pentagon','hexagon','leaf','diamond','sparkle4','star6','cloud5','blob6','amoeba','pseudopod']);
  function formFromGenes(g, key=''){
    const speed=clamp(g.speed??0.5,0,1), sense=clamp(g.sense??0.5,0,1), size=clamp(g.size??0.5,0,1), met=clamp(g.metabolism??0.5,0,1), diet=clamp(g.diet??0.5,0,1), seed=clamp(g.formSeed??0.5,0,1);
    const rv=salt=>hash01(`form:${salt}:${q4(seed)}:${q4(speed)}:${q4(size)}:${q4(sense)}:${q4(diet)}:${key}`);
    const length=clamp(0.10+0.58*speed+0.22*(1-size)+0.10*rv('len'),0,1);
    const detail=clamp(0.12+0.56*sense+0.18*diet+0.14*rv('detail'),0,1);
    const wave=clamp(0.10+0.42*(1-size)+0.20*rv('wave'),0,1);
    const layout=clamp(0.64*seed+0.36*rv('layout'),0,0.999);
    const shape=clamp(0.58*seed+0.42*rv('shape'),0,0.999);
    return {
      points:Math.max(1,Math.min(8,Math.round(1+detail*7))),
      ampMean:0.4*wave,
      pointiness:Math.pow(speed,0.8),
      ampIrregular:0.15+0.25*detail,
      frontBias:(met*2-1)*0.5,
      twist:(diet*2-1)*0.1,
      split:0.6*(diet>0.6?(diet-0.6)/0.4:0),
      notchDepth:0.4*diet,
      phaseJitter:rv('phase')*0.2,
      aspect:clamp(1.0+length,1.0,2.0),
      length,detail,wave,layout,shape
    };
  }
  function speciesKey(g){ const base=`${q4(g.speed)}${q4(g.size)}${q4(g.sense)}${q4(g.diet)}`; const m=formFromGenes(g,base); const p=q3(m.pointiness); const a=m.aspect<1.33?0:(m.aspect<1.66?1:2); const pts=Math.max(1,Math.min(8,Math.round(m.points))); return `${base}${p}${a}${pts}`; }
  function speciesPalette(key){
    const s=String(key||'0000000');
    const speedQ=Number(s[0]||1)/3;
    const carnQ=Number(s[3]||1)/3;
    const dietHue=lerp(195,6,clamp(carnQ,0,1));
    const speedTint=lerp(-18,18,clamp(speedQ,0,1));
    const hue=(dietHue + speedTint*0.25 + (hash01('speciesHue:'+s)-0.5)*96 + 360) % 360;
    const sat=64 + Math.round(hash01('speciesSat:'+s)*18);
    const light=50 + Math.round(hash01('speciesLight:'+s)*12);
    const nucleusHue=(hue + 132 + hash01('speciesNucleus:'+s)*86) % 360;
    const gradientShift=28 + 96*hash01('speciesGradient:'+s);
    return { hue, sat, light, nucleusHue, gradientShift };
  }
  function computeRole(g){
    const c=g.diet, sp=g.speed, se=g.sense, ef=g.metabolism, sz=g.size;

    // Carnivores -> predator roles only (never filter)
    if(c>=0.66){
      if(se>0.55) return (sp<0.55)? 'ambusher' : 'pack';
      return (sp>0.72 && se>0.38)? 'pack' : 'other';
    }

    // Herbivores -> grazer or filter feeder
    if(c<=0.33){
      if(ef>0.62 && sz<0.50) return 'filter';
      return 'other';
    }

    // Omnivores -> scavenger tendency (and rare small efficient ones can also filter)
    if(ef>0.62 && se>0.35 && sp<0.70) return 'scav';
    if(c<0.50 && ef>0.72 && sz<0.42) return 'filter';
    return 'other';
  }
  function topologyFromGenes(g){
    if(!g) return 'single';
    const h=hash01('topology:'+Object.values(g).map(v=>Math.round((v||0)*97)).join('.'));
    const form=formFromGenes(g);
    if(form.layout>0.84 && form.wave>0.26 && (g.diet??0)<0.68) return 'amoeba';
    if((g.metabolism??0)>0.70 && (g.sense??0)>0.50 && (g.size??0)>0.40) return 'mesh';
    if(form.detail>0.72 && (g.diet??0)>0.43) return 'radial';
    if((g.metabolism??0)>0.62 && form.detail>0.46 && form.length<0.68) return 'ring';
    if((g.sense??0)>0.66 && form.detail>0.35) return 'branch';
    if((g.fecundity??0)>0.66 && (g.size??0)<0.72) return 'cluster';
    if(form.length>0.60 || ((g.speed??0)>0.58 && (g.sense??0)>0.42)) return 'chain';
    const order=['single','chain','radial','ring','branch','cluster','amoeba','mesh'];
    return order[Math.floor(h*order.length)] || 'single';
  }
  function rareTraitNames(flags, threshold=false){
    const f=flags||{};
    const on=(v)=> threshold ? v>0.5 : !!v;
    return [
      on(f.glow)?'夜光':'',
      on(f.crown)?'冠':'',
      on(f.colony)?'群体':'',
      on(f.chl)?'葉緑体':''
    ].filter(Boolean);
  }
  const ADAPTATION_DEFS = [
    {id:'tentacle',label:'触手型',unlock:c=>c.se>0.70&&c.form.detail>0.42&&c.form.length>0.28,effect:o=>{o.senseR*=1.14;o.senseCost*=1.08;o.baseMetabolic*=1.04;},cost:0.04,visual:'触手で周囲を探れる',counter:'触手維持の負担が重い'},
    {id:'spines',label:'防御トゲ型',unlock:c=>c.c<0.58&&c.sp<0.56&&c.ef<0.64&&(c.r==='filter'||c.sz>0.42||c.topology==='ring'||c.topology==='mesh'),effect:o=>{o.maxSpeed*=0.78;o.baseMetabolic*=1.02;o.predationRiskMul=(o.predationRiskMul||1)*0.74;},cost:0.04,visual:'外周のトゲで直接つかむ捕食をはじく',counter:'直接掴む捕食者に強い／機動力が落ちる',defense:{avoidMul:0.78,ambusherAvoidMul:0.62,retaliate:8,cooldown:46},draw:(o,v)=>{const ctx=v.ctx,bodyR=v.bodyR,outlineHue=v.outlineHue,form=v.form,sym=v.sym;ctx.save();ctx.lineCap='round';ctx.globalCompositeOperation='lighter';ctx.strokeStyle=`hsla(${(outlineHue+32)%360},94%,84%,${v.dayNight.isNight?0.34:0.24})`;ctx.lineWidth=Math.max(0.75,o.size*0.10);const n=8+Math.round(form.detail*6);for(let i=0;i<n;i++){const a=i/n*TAU+sym.pulse*0.08;const inner=bodyR*(0.92+0.05*Math.sin(sym.pulse+i));const outer=bodyR*(1.34+0.10*((i%2)?form.detail:1-form.detail));ctx.beginPath();ctx.moveTo(Math.cos(a)*inner,Math.sin(a)*inner);ctx.lineTo(Math.cos(a)*outer,Math.sin(a)*outer);ctx.stroke();}ctx.restore();}},
    {id:'colonyBuilder',label:'コロニー形成',unlock:c=>(c.topology==='cluster'||c.flags?.colony||c.re>0.76)&&c.re>0.62&&c.sz<0.72,effect:o=>{o.reproThreshold*=0.96;o.maxSpeed*=0.88;o.protect=Math.max(o.protect||0,118);},cost:0.02,visual:'近接した子で群体を作る',counter:'過密で広がりにくい'},
    {id:'toxin',label:'防御毒型',unlock:c=>c.c<0.55&&c.ef>0.62&&(c.r==='filter'||c.sp<0.42||c.form.detail>0.58),effect:o=>{o.baseMetabolic*=1.08;o.reproThreshold*=1.04;o.predationRiskMul=(o.predationRiskMul||1)*0.56;},cost:0.06,visual:'食べた捕食者を弱らせる',counter:'捕食者に対して有利／維持コストが高い',defense:{avoidMul:0.58,energyLoss:14,memDamage:0.10,cooldown:72},draw:(o,v)=>{const ctx=v.ctx,bodyR=v.bodyR,outlineHue=v.outlineHue,form=v.form,sym=v.sym;ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=`hsla(${(outlineHue+330)%360},95%,78%,${v.dayNight.isNight?0.30:0.22})`;ctx.lineWidth=Math.max(0.7,o.size*0.08);const n=7+Math.round(form.detail*5);for(let i=0;i<n;i++){const a=i/n*TAU+sym.pulse*0.12;ctx.beginPath();ctx.moveTo(Math.cos(a)*bodyR*0.84,Math.sin(a)*bodyR*0.84);ctx.lineTo(Math.cos(a)*bodyR*1.28,Math.sin(a)*bodyR*1.28);ctx.stroke();}ctx.restore();}},
    {id:'sessileFarmer',label:'固着養藻型',unlock:c=>c.ef>0.70&&c.sp<0.34&&c.c<0.42&&(c.r==='filter'||c.c<0.33),effect:o=>{o.maxSpeed*=0.24;o.baseMetabolic*=0.96;o.senseCost*=0.92;o.localAlgaeFarm={grow:0.0075,graze:0.0048,oxygen:0.0022,radius:2};o.predationRiskMul=(o.predationRiskMul||1)*1.26;},cost:0.05,visual:'ほぼ動かず周囲の藻を育てて食べる',counter:'捕食に弱い'},
    {id:'adhesiveMat',label:'付着マット型',unlock:c=>c.ef>0.72&&c.sp<0.40&&c.c<0.58,effect:o=>{o.baseMetabolic*=0.84;o.maxSpeed*=0.70;o.senseCost*=0.90;},cost:-0.03,visual:'省エネで張り付く',counter:'環境変化から逃げにくい'},
    {id:'cyst',label:'休眠シスト型',unlock:c=>c.ef>0.70&&c.sz>0.52&&c.sp<0.58,effect:o=>{o.baseMetabolic*=0.88;o.reproThreshold*=1.04;},cost:-0.01,visual:null,counter:null},
    {id:'filterFan',label:'濾過扇型',unlock:c=>c.r==='filter'&&(c.se>0.38||c.form.detail>0.35),effect:o=>{o.senseR*=1.08;o.maxSpeed*=0.95;},cost:0.02,visual:null,counter:null},
    {id:'symbiotic',label:'共生葉緑型',unlock:c=>!!c.flags?.chl,effect:null,cost:0,visual:null,counter:null},
    {id:'nightGlow',label:'夜光遊泳型',unlock:c=>!!c.flags?.glow,effect:null,cost:0,visual:null,counter:null}
  ];
  const ADAPTATION_BY_ID = Object.fromEntries(ADAPTATION_DEFS.map(d=>[d.id,d]));
  function adaptationProfilesFromGenes(g, flags=null, topology=topologyFromGenes(g), role=null){
    if(!g) return [];
    const c={g,flags:flags||{},topology,role,r:role||computeRole(g),form:formFromGenes(g),sp:g.speed??0.5,sz:g.size??0.5,ef:g.metabolism??0.5,re:g.fecundity??0.5,se:g.sense??0.5,c:g.diet??0.5};
    return ADAPTATION_DEFS.filter(d=>d.unlock(c)).slice(0,2).map(d=>d.id);
  }

  function buildOrganismBase(genes, id){
    id = id || 1;
    const sk = speciesKey(genes);
    const form = formFromGenes(genes, sk);
    const topo = topologyFromGenes(genes);
    const geneHash = hash01('g:' + Object.values(genes).join(','));
    const maxSizeScale = 2.0; // CONFIG.organism.maxSizeScale (desktop)
    const baseSize = lerp(3.0, 11.0 * maxSizeScale, Math.pow(genes.size, 0.85));
    const isMega = (genes.size > 0.97) || (geneHash > 0.985);
    const size = baseSize * (isMega ? 1.65 : 1.0);
    const pal = speciesPalette(sk);
    const role = computeRole(genes);
    return {
      id: id, genes: genes,
      speciesKey: sk, form: form, morphologyTopology: topo,
      size: size, isMega: isMega, senseR: lerp(50, 140, genes.sense),
      role: role, hue: pal.hue, sat: pal.sat, light: pal.light,
      x:0, y:0, heading:0, gait:0, phase: hash01('ph:'+id)*Math.PI*2,
      energy:120, motionLevel:0, fleeTimer:0, burstTimer:0, chaseTimer:0,
      mateSeekT:0, newSpeciesFlash:0, preyTargetId:null, protect:0, trail:[],
      flags:{}
    };
  }

  global.OrganismModel = global.OrganismModel || {};
  global.OrganismModel.clamp = clamp;
  global.OrganismModel.clamp01 = clamp01;
  global.OrganismModel.lerp = lerp;
  global.OrganismModel.sigmoid = sigmoid;
  global.OrganismModel.hash01 = hash01;
  global.OrganismModel.q4 = q4;
  global.OrganismModel.q3 = q3;
  global.OrganismModel.hashStr32 = hashStr32;
  global.OrganismModel.rngFromKey = rngFromKey;
  global.OrganismModel.SYMBOL_SHAPES = SYMBOL_SHAPES;
  global.OrganismModel.ROLE_HUE = ROLE_HUE;
  global.OrganismModel.formFromGenes = formFromGenes;
  global.OrganismModel.speciesKey = speciesKey;
  global.OrganismModel.speciesPalette = speciesPalette;
  global.OrganismModel.computeRole = computeRole;
  global.OrganismModel.topologyFromGenes = topologyFromGenes;
  global.OrganismModel.rareTraitNames = rareTraitNames;
  global.OrganismModel.ADAPTATION_DEFS = ADAPTATION_DEFS;
  global.OrganismModel.ADAPTATION_BY_ID = ADAPTATION_BY_ID;
  global.OrganismModel.adaptationProfilesFromGenes = adaptationProfilesFromGenes;
  global.OrganismModel.buildOrganismBase = buildOrganismBase;
})(typeof window !== "undefined" ? window : this);
