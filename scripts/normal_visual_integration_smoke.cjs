const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const Module=require('module');

function addModules(dir){
  if(!dir || !fs.existsSync(dir)) return;
  const rows=(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean);
  if(!rows.includes(dir)){
    rows.push(dir);
    process.env.NODE_PATH=rows.join(path.delimiter);
    Module._initPaths();
  }
}

const userRoot=process.env.USERPROFILE||process.env.HOME||'';
const modules=path.join(userRoot,'.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules');
addModules(modules);
addModules(path.join(modules,'.pnpm','node_modules'));
const {chromium}=require('playwright');

const outDir=path.resolve('artifacts','normal-visual-integration');
const targetUrl='file:///'+path.resolve('index.html').replace(/\\/g,'/')+'?normal-visual-smoke=1';
fs.mkdirSync(outDir,{recursive:true});
function assert(condition,message){ if(!condition) throw new Error(message); }

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(`pageerror: ${error.message||error}`));
  page.on('console',message=>{ if(message.type()==='error') errors.push(`console: ${message.text()}`); });
  await page.addInitScript(()=>{
    let state=41001;
    Math.random=()=>{
      state=(state+0x6D2B79F5)>>>0;
      let value=state;
      value=Math.imul(value^(value>>>15),value|1);
      value^=value+Math.imul(value^(value>>>7),value|61);
      return ((value^(value>>>14))>>>0)/4294967296;
    };
  });
  try{
    await page.goto(targetUrl,{waitUntil:'load'});
    await page.waitForFunction(()=>typeof window.__alifeDebug?.normalOrganismRendererSummary==='function');
    const setup=await page.evaluate(()=>{
      const debug=window.__alifeDebug;
      debug.setSimulationRunning(false);
      const spawned=debug.spawnOrganisms({count:1,dietType:'omnivore',preset:'viable',ageMode:'mature',positionMode:'center',energyMode:'full'});
      const organism=debug.selectOrganismById(spawned.organismIds[0]);
      const screen=debug.worldToScreen(organism.x,organism.y);
      debug.clearSelection();
      debug.setMicroscopeLens(false);
      return {organismId:organism.id,screen,saved:debug.captureSaveData()};
    });

    const renderAudit=await page.evaluate(async target=>{
      const debug=window.__alifeDebug;
      const art=window.OrganismRosterArt;
      const originalDraw=art.drawOrganism;
      const originalRandom=Math.random;
      const calls=[];
      let randomCalls=0;
      const before={
        model:JSON.stringify(debug.comparableModelState()),
        counts:debug.counts(),
        renderer:debug.normalOrganismRendererSummary(),
        lens:debug.microscopeLensSummary()
      };
      art.drawOrganism=function(ctx,o,w,h,opts){
        if(calls.length<2000) calls.push({id:o?.id??null,closeUp:!!opts?.closeUp});
        return originalDraw.call(this,ctx,o,w,h,opts);
      };
      Math.random=function(){ randomCalls++; return originalRandom(); };
      try{
        debug.setNormalOrganismRenderer('legacy');
        debug.setNormalOrganismRenderer('roster');
        debug.setMicroscopeLens(false);
        await new Promise(resolve=>{
          let n=0;
          function tick(){ if(++n>=5) resolve(); else requestAnimationFrame(tick); }
          requestAnimationFrame(tick);
        });
        const normal={renderer:debug.normalOrganismRendererSummary(),lens:debug.microscopeLensSummary()};
        debug.setMicroscopeLens(true,{x:target.x,y:target.y,magnification:3.2,followSelection:false});
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const microscope=debug.microscopeLensSummary();
        debug.setMicroscopeLens(false);
        await new Promise(resolve=>requestAnimationFrame(resolve));
        const normalIds=[...new Set(calls.filter(call=>!call.closeUp).map(call=>call.id).filter(Number.isFinite))];
        const microscopeIds=[...new Set(calls.filter(call=>call.closeUp).map(call=>call.id).filter(Number.isFinite))];
        const sharedIds=normalIds.filter(id=>microscopeIds.includes(id));
        return {
          before,
          normal,
          microscope,
          normalIds,
          microscopeIds,
          sharedIds,
          targetShared:sharedIds.includes(target.organismId),
          calls:{normal:calls.filter(call=>!call.closeUp).length,microscope:calls.filter(call=>call.closeUp).length},
          randomCalls,
          after:{model:JSON.stringify(debug.comparableModelState()),counts:debug.counts(),renderer:debug.normalOrganismRendererSummary(),lens:debug.microscopeLensSummary()}
        };
      }finally{
        Math.random=originalRandom;
        art.drawOrganism=originalDraw;
      }
    },{...setup.screen,organismId:setup.organismId});

    await page.evaluate(()=>{
      window.__alifeDebug.setNormalOrganismRenderer('roster');
      window.__alifeDebug.setMicroscopeLens(false);
    });
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.screenshot({path:path.join(outDir,'normal-roster.png')});

    const benchmark=await page.evaluate(async()=>{
      const debug=window.__alifeDebug;
      const summarize=values=>{
        const sorted=values.slice().sort((a,b)=>a-b);
        const percentile=p=>sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*p)-1))]??null;
        return {samples:sorted.length,median:percentile(0.5),p95:percentile(0.95),max:sorted[sorted.length-1]??null};
      };
      async function frames(count,collect=false){
        const rows=[];
        await new Promise(resolve=>{
          let previous=null;
          let seen=0;
          function tick(now){
            if(collect && previous!=null){
              const perf=debug.performanceSummary();
              rows.push({frameMs:now-previous,drawMs:perf.drawMs});
            }
            previous=now;
            if(++seen>=count) resolve();
            else requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        });
        return rows;
      }
      async function sample(style){
        debug.setNormalOrganismRenderer(style);
        await frames(36,false);
        const rows=await frames(61,true);
        return {
          style,
          renderer:debug.normalOrganismRendererSummary(),
          frameMs:summarize(rows.map(row=>row.frameMs)),
          drawMs:summarize(rows.map(row=>row.drawMs))
        };
      }
      const cases=[];
      for(const population of [64,200,1000]){
        debug.preparePerformanceBenchmark({population,renderMode:'full'});
        const before=JSON.stringify(debug.comparableModelState());
        const legacy=await sample('legacy');
        const roster=await sample('roster');
        const after=JSON.stringify(debug.comparableModelState());
        cases.push({population,counts:debug.counts(),stateExact:before===after,legacy,roster});
      }
      return {cases};
    });

    await page.evaluate(saved=>{
      window.__alifeDebug.restoreSaveData(saved);
      window.__alifeDebug.setSimulationRunning(false);
      window.__alifeDebug.setNormalOrganismRenderer('roster');
      window.__alifeDebug.setMicroscopeLens(false);
    },setup.saved);

    assert(renderAudit.before.renderer.style==='roster','new normal renderer was not the default');
    assert(renderAudit.before.renderer.rendererVersion==='roster-art-v3-dual-mode','unexpected normal renderer version');
    assert(renderAudit.before.lens.enabled===false,'microscope lens was not off by default');
    assert(renderAudit.calls.normal>0 && renderAudit.calls.microscope>0,'normal and microscope modes were not both rendered');
    assert(renderAudit.targetShared && renderAudit.sharedIds.length>0,'normal and microscope modes did not render the same organism identity');
    assert(renderAudit.microscope.lastDrawn>0,'microscope mode did not draw an organism');
    assert(renderAudit.randomCalls===0,'normal or microscope art consumed Math.random');
    assert(renderAudit.before.model===renderAudit.after.model,'visual mode rendering changed comparable model state');
    assert(JSON.stringify(renderAudit.before.counts)===JSON.stringify(renderAudit.after.counts),'visual mode rendering changed entity counts');
    assert(renderAudit.after.lens.enabled===false,'microscope lens did not return to off');
    for(const row of benchmark.cases){
      assert(row.stateExact,`renderer benchmark changed model state at population ${row.population}`);
      assert(row.legacy.drawMs.samples===60 && row.roster.drawMs.samples===60,`renderer benchmark sample count failed at population ${row.population}`);
    }
    assert(errors.length===0,errors.join('\n'));

    const modelEvidence={
      exact:renderAudit.before.model===renderAudit.after.model,
      beforeSha256:crypto.createHash('sha256').update(renderAudit.before.model).digest('hex'),
      afterSha256:crypto.createHash('sha256').update(renderAudit.after.model).digest('hex')
    };
    const artifactRenderAudit={
      ...renderAudit,
      before:{...renderAudit.before,model:undefined},
      after:{...renderAudit.after,model:undefined},
      modelEvidence
    };
    const artifact={
      schemaVersion:1,
      environment:'Playwright Chromium headless',
      targetUrl,
      setup:{organismId:setup.organismId,screen:setup.screen},
      renderAudit:artifactRenderAudit,
      benchmark,
      assertions:{normalDefault:true,twoDistinctModes:true,sameOrganismIdentity:true,visualRngIsolation:true,modelNonInterference:true,countNonInterference:true,performanceSamples:true,noErrors:true},
      errors
    };
    fs.writeFileSync(path.join(outDir,'normal-visual-smoke.json'),JSON.stringify(artifact,null,2));
    console.log(JSON.stringify({
      ok:true,
      artifact:path.join(outDir,'normal-visual-smoke.json'),
      screenshot:path.join(outDir,'normal-roster.png'),
      sharedIds:renderAudit.sharedIds.length,
      targetShared:renderAudit.targetShared,
      randomCalls:renderAudit.randomCalls,
      benchmark:benchmark.cases.map(row=>({population:row.population,legacy:row.legacy.drawMs,roster:row.roster.drawMs}))
    },null,2));
  }finally{
    await page.close();
    await browser.close();
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
