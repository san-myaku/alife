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
  const ROLE_HUE = { ambusher:285, pursuit:6, scav:45, filter:145, other:200 };
  const featureFlags = { speciesIdentityV2:false, evolvableLifeHistory:false, canonicalSpeciesAppearance:false, eventKeyedVisualRng:false };
  const BASE_GENE_KEYS=Object.freeze(['speed','size','metabolism','fecundity','sense','diet','formSeed']);
  function finiteGeneValue(value,fallback=0.5){ const n=Number(value); return clamp(Number.isFinite(n) ? n : fallback,0,1); }
  function normalizeRole(role){ return role==='pack' ? 'pursuit' : role; }
  function speciesIdentityV2Enabled(){ return !!featureFlags.speciesIdentityV2; }
  function setSpeciesIdentityV2(enabled){ featureFlags.speciesIdentityV2=!!enabled; return featureFlags.speciesIdentityV2; }
  function canonicalSpeciesAppearanceEnabled(){ return !!featureFlags.canonicalSpeciesAppearance && speciesIdentityV2Enabled(); }
  function setCanonicalSpeciesAppearance(enabled){ featureFlags.canonicalSpeciesAppearance=!!enabled; return canonicalSpeciesAppearanceEnabled(); }
  function setEvolvableLifeHistory(enabled){ featureFlags.evolvableLifeHistory=!!enabled; return featureFlags.evolvableLifeHistory; }
  function eventKeyedVisualRngEnabled(){ return !!featureFlags.eventKeyedVisualRng; }
  function setEventKeyedVisualRng(enabled){ featureFlags.eventKeyedVisualRng=!!enabled; return featureFlags.eventKeyedVisualRng; }
  function q4(x){ return x<0.25?0: x<0.5?1: x<0.75?2:3; }
  function q3(x){ return x<1/3?0: x<2/3?1:2; }
  function hashStr32(s){ let h=0x811c9dc5; for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = (h>>>0) * 0x01000193; h>>>0; } return h>>>0; }
  function visualHashMixString32(h,value){
    const s=String(value);
    for(let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h,0x01000193)>>>0;
    }
    return h>>>0;
  }
  function visualAvalanche32(h){
    h ^= h>>>16;
    h = Math.imul(h,0x7feb352d)>>>0;
    h ^= h>>>15;
    h = Math.imul(h,0x846ca68b)>>>0;
    h ^= h>>>16;
    return h>>>0;
  }
  function visualEventSeed32(key,worldSeed){
    let h=0x811c9dc5;
    h=visualHashMixString32(h,'alife:visual:event-keyed:v1');
    h=visualHashMixString32(h,'|seed|');
    h=visualHashMixString32(h,worldSeed);
    h=visualHashMixString32(h,'|key|');
    h=visualHashMixString32(h,key);
    return visualAvalanche32(h) || 0x9e3779b9;
  }
  function visualRngFromSeed32(seed){
    let x=(seed>>>0) || 0x9e3779b9;
    return function(){
      x ^= x<<13;
      x ^= x>>>17;
      x ^= x<<5;
      x >>>= 0;
      return (x>>>0)/4294967296;
    };
  }
  function rngFromKey(key,worldSeed){
    if(worldSeed==null){
      let x = hashStr32(String(key))||1;
      return function(){ x ^= x<<13; x ^= x>>>17; x ^= x<<5; x>>>=0; return (x & 0xffffffff)/0x100000000; };
    }
    return visualRngFromSeed32(visualEventSeed32(key,worldSeed));
  }
  function visualRandomFromKey(key,sampleIndex=0,worldSeed=0){
    const n=Number(sampleIndex);
    const idx=Math.max(0,Math.floor(Number.isFinite(n) ? n : 0));
    const rng=rngFromKey(key,worldSeed);
    let value=0;
    for(let i=0;i<=idx;i++) value=rng();
    return value;
  }
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
  function legacySpeciesKey(g){ const base=`${q4(g.speed)}${q4(g.size)}${q4(g.sense)}${q4(g.diet)}`; const m=formFromGenes(g,base); const p=q3(m.pointiness); const a=m.aspect<1.33?0:(m.aspect<1.66?1:2); const pts=Math.max(1,Math.min(8,Math.round(m.points))); return `${base}${p}${a}${pts}`; }
  function lifeHistorySpeciesSuffix(g){ return ''; }
  function speciesDietClassFromGenes(genes){
    const diet=finiteGeneValue(genes?.diet,0.5);
    if(diet<0.33) return 'herbivore';
    if(diet<0.66) return 'omnivore';
    return 'carnivore';
  }
  function speciesRoleFromGenes(genes){ return normalizeRole(computeRole(genes || {})); }
  function expressedRareTraitSignature(flags){
    const f=flags || {};
    return [f.glow?'g':'-',f.crown?'c':'-',f.colony?'k':'-',f.chl?'p':'-'].join('');
  }
  function speciesSocialModeFromGenes(genes){ return socialStrategyFromGenes(genes || {}).mode; }
  function speciesMorphologySignature(genes,flags=null){
    const g=genes || {};
    const role=speciesRoleFromGenes(g);
    const topology=topologyFromGenes(g);
    const form=formFromGenes(g,legacySpeciesKey(g));
    const adaptations=adaptationProfilesFromGenes(g,flags,topology,role).slice().sort();
    return {
      topology,
      formSeedClass:q4(finiteGeneValue(g?.formSeed,0.5)),
      shapeClass:q4(form.shape),
      layoutClass:q4(form.layout),
      detailClass:q4(form.detail),
      adaptations
    };
  }
  function speciesIdentityV2Components(genes,flags=null){
    const morphology=speciesMorphologySignature(genes,flags);
    return {
      version:2,
      legacyKey:legacySpeciesKey(genes || {}),
      lifeHistorySuffix:featureFlags.evolvableLifeHistory ? lifeHistorySpeciesSuffix(genes || {}) : '',
      dietClass:speciesDietClassFromGenes(genes || {}),
      role:speciesRoleFromGenes(genes || {}),
      socialMode:speciesSocialModeFromGenes(genes || {}),
      topology:morphology.topology,
      formSeedClass:morphology.formSeedClass,
      shapeClass:morphology.shapeClass,
      layoutClass:morphology.layoutClass,
      detailClass:morphology.detailClass,
      adaptations:morphology.adaptations,
      expressedRareTraits:expressedRareTraitSignature(flags)
    };
  }
  function speciesKeyV2(genes,flags=null){
    const c=speciesIdentityV2Components(genes,flags);
    const adaptationKey=c.adaptations.length ? c.adaptations.join('+') : 'none';
    return ['S2',`G${c.legacyKey}${c.lifeHistorySuffix}`,`D${c.dietClass}`,`R${c.role}`,`S${c.socialMode}`,`T${c.topology}`,`M${c.formSeedClass}${c.shapeClass}${c.layoutClass}${c.detailClass}`,`A${adaptationKey}`,`X${c.expressedRareTraits}`].join('|');
  }
  function speciesKey(g,flags=null){
    if(!speciesIdentityV2Enabled()){
      const legacy=legacySpeciesKey(g || {});
      return featureFlags.evolvableLifeHistory ? `${legacy}${lifeHistorySpeciesSuffix(g || {})}` : legacy;
    }
    return speciesKeyV2(g || {},flags);
  }
  function speciesKeyForOrganism(organism){
    return speciesKey(organism?.genes || {},organism?.flags || {});
  }
  const speciesAppearanceProfileCache = new Map();
  function canonicalClassCenter(classIndex,classCount=4){
    return (Number(classIndex) + 0.5) / classCount;
  }
  function canonicalValueForLegacyBin(components,gene,rng){
    const index={speed:0,size:1,sense:2,diet:3}[gene];
    const legacy=String(components?.legacyKey || '1111');
    const q=Number(legacy[index]);
    if(Number.isFinite(q)) return canonicalClassCenter(q,4);
    return clamp(0.08 + rng()*0.84,0,1);
  }
  function canonicalDietValue(dietClass,rng){
    if(dietClass==='herbivore') return clamp(0.08 + rng()*0.20,0.02,0.329);
    if(dietClass==='omnivore') return clamp(0.38 + rng()*0.20,0.331,0.659);
    if(dietClass==='carnivore') return clamp(0.72 + rng()*0.20,0.661,0.98);
    return 0.5;
  }
  function canonicalMetabolismValue(components,rng){ return clamp(0.18 + rng()*0.64,0,1); }
  function canonicalFecundityValue(components,rng){
    const social=components?.socialMode || 'solitary';
    const bias=social==='cluster' ? 0.62 : (social==='hunt-pack' ? 0.46 : 0.50);
    return clamp(bias*0.65 + rng()*0.35,0,1);
  }
  function canonicalVisualGenesFromIdentity(components,speciesKey){
    const rng=rngFromKey(`canonical-visual-genes:${speciesKey}`);
    return {
      speed:canonicalValueForLegacyBin(components,'speed',rng),
      size:canonicalValueForLegacyBin(components,'size',rng),
      sense:canonicalValueForLegacyBin(components,'sense',rng),
      diet:canonicalDietValue(components?.dietClass,rng),
      metabolism:canonicalMetabolismValue(components,rng),
      fecundity:canonicalFecundityValue(components,rng),
      formSeed:canonicalClassCenter(components?.formSeedClass ?? 1),
      energyCapacity:0.5,
      clutchPotential:0.5,
      parentalInvestment:0.5
    };
  }
  function speciesIdentityComponentsFromKey(key){
    const s=String(key || '');
    if(!s.startsWith('S2|')) return null;
    const parts=Object.fromEntries(s.split('|').slice(1).map(part=>[part[0],part.slice(1)]));
    const m=String(parts.M || '1111');
    return {
      version:2,
      legacyKey:parts.G || '',
      lifeHistorySuffix:'',
      dietClass:parts.D || 'omnivore',
      role:parts.R || 'other',
      socialMode:parts.S || 'solitary',
      topology:parts.T || 'single',
      formSeedClass:Number(m[0] || 1),
      shapeClass:Number(m[1] || 1),
      layoutClass:Number(m[2] || 1),
      detailClass:Number(m[3] || 1),
      adaptations:parts.A && parts.A!=='none' ? parts.A.split('+').filter(Boolean).sort() : [],
      expressedRareTraits:parts.X || '----'
    };
  }
  function rareFlagsFromSignature(signature){
    const s=String(signature || '----');
    return {glow:s[0]==='g',crown:s[1]==='c',colony:s[2]==='k',chl:s[3]==='p'};
  }
  function speciesAppearanceProfile(organismOrKey,components=null){
    const key=typeof organismOrKey==='string' ? organismOrKey : speciesKeyForOrganism(organismOrKey);
    if(speciesAppearanceProfileCache.has(key)) return speciesAppearanceProfileCache.get(key);
    const c=components || (typeof organismOrKey==='string' ? speciesIdentityComponentsFromKey(key) : speciesIdentityV2Components(organismOrKey.genes,organismOrKey.flags));
    const rng=rngFromKey(`species-appearance:${key}`);
    const profile={
      speciesKey:key,
      topology:c?.topology || 'single',
      adaptations:(c?.adaptations || []).slice().sort(),
      expressedRareTraits:c?.expressedRareTraits || '----',
      baseHueSeed:rng(),
      primaryShapeSeed:rng(),
      secondaryShapeSeed:rng(),
      layoutSeed:rng(),
      detailSeed:rng(),
      nodeCountSeed:rng(),
      branchSeed:rng(),
      rotationSeed:rng(),
      nucleusSeed:rng(),
      patternSeed:rng(),
      motionStyleSeed:rng(),
      canonicalVisualGenes:canonicalVisualGenesFromIdentity(c || speciesIdentityComponentsFromKey(key) || {},key)
    };
    speciesAppearanceProfileCache.set(key,profile);
    return profile;
  }
  function clearSpeciesAppearanceProfileCache(){ speciesAppearanceProfileCache.clear(); }
  function speciesPalette(key){
    const s=String(key||'0000000');
    const legacyPart=s.startsWith('S2|') ? (s.match(/\|G([^|]+)/)?.[1] || '') : s;
    const dietPart=s.startsWith('S2|') ? (s.match(/\|D([^|]+)/)?.[1] || '') : '';
    const speedDigit=Number(legacyPart[0]);
    const dietDigit=Number(legacyPart[3]);
    const speedQ=Number.isFinite(speedDigit) ? speedDigit/3 : hash01('speciesSpeed:'+s);
    const carnQ=dietPart==='herbivore' ? 0 : (dietPart==='omnivore' ? 0.5 : (dietPart==='carnivore' ? 1 : (Number.isFinite(dietDigit) ? dietDigit/3 : hash01('speciesDiet:'+s))));
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
      if(se>0.55) return (sp<0.55)? 'ambusher' : 'pursuit';
      return (sp>0.72 && se>0.38)? 'pursuit' : 'other';
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
  const GROUP_MAX_SIZE_GENE = 0.58;
  function canUseGroupStrategy(g){ return !!g && (g.size ?? 1) <= GROUP_MAX_SIZE_GENE; }
  function socialStrategyFromGenes(g){
    const form=formFromGenes(g);
    const social = clamp(0.10 + g.sense*0.38 + g.fecundity*0.24 + (1-g.diet)*0.16 + form.detail*0.14 - g.size*0.10, 0, 1);
    if(social<0.34) return { mode:'solitary', sociality:social };
    if(!canUseGroupStrategy(g)) return { mode:'solitary', sociality:social*0.55 };
    if(g.diet>0.62 && g.speed>0.52 && g.sense>0.42) return { mode:'hunt-pack', sociality:social };
    if(g.diet<=0.34 && social>=0.38 && (g.sense>0.42 || g.fecundity>0.52)) return { mode:'defense-school', sociality:social };
    if(form.length>0.66 && g.sense>0.44) return { mode:'trail', sociality:social };
    if(g.metabolism>0.62 && g.speed<0.58) return { mode:'cluster', sociality:social };
    return { mode:'school', sociality:social };
  }
  function topologyFromGenes(g){
    if(!g) return 'single';
    const h=hash01('topology:'+BASE_GENE_KEYS.map(k=>Math.round(finiteGeneValue(g?.[k],0.5)*97)).join('.'));
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

  function buildOrganismBase(genes, id, flags={}){
    id = id || 1;
    const sk = speciesKey(genes, flags);
    const appearance = canonicalSpeciesAppearanceEnabled() ? speciesAppearanceProfile(sk, speciesIdentityV2Components(genes, flags)) : null;
    const visualGenes = appearance?.canonicalVisualGenes || genes;
    const form = formFromGenes(visualGenes, sk);
    const topo = appearance?.topology || topologyFromGenes(genes);
    const geneHash = hash01('g:' + Object.values(genes).join(','));
    const maxSizeScale = 2.0; // CONFIG.organism.maxSizeScale (desktop)
    const baseSize = lerp(3.0, 11.0 * maxSizeScale, Math.pow(genes.size, 0.85));
    const isMega = (genes.size > 0.97) || (geneHash > 0.985);
    const size = baseSize * (isMega ? 1.65 : 1.0);
    const pal = speciesPalette(sk);
    const role = normalizeRole(computeRole(genes));
    return {
      id: id, genes: genes, visualGenes: visualGenes,
      speciesKey: sk, form: form, morphologyTopology: topo,
      size: size, isMega: isMega, senseR: lerp(50, 140, genes.sense),
      role: role, hue: pal.hue, sat: pal.sat, light: pal.light,
      x:0, y:0, heading:0, gait:0, phase: hash01('ph:'+id)*Math.PI*2,
      energy:120, motionLevel:0, fleeTimer:0, burstTimer:0, chaseTimer:0,
      mateSeekT:0, newSpeciesFlash:0, preyTargetId:null, protect:0, trail:[],
      flags:{...flags}
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
  global.OrganismModel.visualRandomFromKey = visualRandomFromKey;
  global.OrganismModel.SYMBOL_SHAPES = SYMBOL_SHAPES;
  global.OrganismModel.ROLE_HUE = ROLE_HUE;
  global.OrganismModel.formFromGenes = formFromGenes;
  global.OrganismModel.legacySpeciesKey = legacySpeciesKey;
  global.OrganismModel.speciesKey = speciesKey;
  global.OrganismModel.speciesKeyForOrganism = speciesKeyForOrganism;
  global.OrganismModel.speciesKeyV2 = speciesKeyV2;
  global.OrganismModel.speciesIdentityV2Components = speciesIdentityV2Components;
  global.OrganismModel.speciesIdentityComponentsFromKey = speciesIdentityComponentsFromKey;
  global.OrganismModel.speciesDietClassFromGenes = speciesDietClassFromGenes;
  global.OrganismModel.speciesRoleFromGenes = speciesRoleFromGenes;
  global.OrganismModel.speciesSocialModeFromGenes = speciesSocialModeFromGenes;
  global.OrganismModel.speciesMorphologySignature = speciesMorphologySignature;
  global.OrganismModel.expressedRareTraitSignature = expressedRareTraitSignature;
  global.OrganismModel.rareFlagsFromSignature = rareFlagsFromSignature;
  global.OrganismModel.speciesIdentityV2Enabled = speciesIdentityV2Enabled;
  global.OrganismModel.setSpeciesIdentityV2 = setSpeciesIdentityV2;
  global.OrganismModel.canonicalSpeciesAppearanceEnabled = canonicalSpeciesAppearanceEnabled;
  global.OrganismModel.setCanonicalSpeciesAppearance = setCanonicalSpeciesAppearance;
  global.OrganismModel.eventKeyedVisualRngEnabled = eventKeyedVisualRngEnabled;
  global.OrganismModel.setEventKeyedVisualRng = setEventKeyedVisualRng;
  global.OrganismModel.canonicalVisualGenesFromIdentity = canonicalVisualGenesFromIdentity;
  global.OrganismModel.speciesAppearanceProfile = speciesAppearanceProfile;
  global.OrganismModel.clearSpeciesAppearanceProfileCache = clearSpeciesAppearanceProfileCache;
  global.OrganismModel.setEvolvableLifeHistory = setEvolvableLifeHistory;
  global.OrganismModel.speciesPalette = speciesPalette;
  global.OrganismModel.computeRole = computeRole;
  global.OrganismModel.normalizeRole = normalizeRole;
  global.OrganismModel.socialStrategyFromGenes = socialStrategyFromGenes;
  global.OrganismModel.topologyFromGenes = topologyFromGenes;
  global.OrganismModel.rareTraitNames = rareTraitNames;
  global.OrganismModel.ADAPTATION_DEFS = ADAPTATION_DEFS;
  global.OrganismModel.ADAPTATION_BY_ID = ADAPTATION_BY_ID;
  global.OrganismModel.adaptationProfilesFromGenes = adaptationProfilesFromGenes;
  global.OrganismModel.buildOrganismBase = buildOrganismBase;
})(typeof window !== "undefined" ? window : this);
