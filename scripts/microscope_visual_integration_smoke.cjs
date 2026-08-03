const fs=require('fs');
const path=require('path');
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

const outDir=path.resolve('artifacts','visual-integration');
const targetUrl='file:///'+path.resolve('index.html').replace(/\\/g,'/')+'?microscope-smoke=1';
fs.mkdirSync(outDir,{recursive:true});
function assert(condition,message){ if(!condition) throw new Error(message); }

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(`pageerror: ${error.message||error}`));
  page.on('console',message=>{ if(message.type()==='error') errors.push(`console: ${message.text()}`); });
  try{
    await page.goto(targetUrl,{waitUntil:'load'});
    await page.waitForFunction(()=>typeof window.__alifeDebug?.microscopeLensSummary==='function');
    const lensTarget=await page.evaluate(()=>{
      const debug=window.__alifeDebug;
      const spawned=debug.spawnOrganisms({count:1,dietType:'omnivore',preset:'viable',ageMode:'mature',positionMode:'center',energyMode:'full'});
      const organism=debug.selectOrganismById(spawned.organismIds[0]);
      const screen=debug.worldToScreen(organism.x,organism.y);
      debug.clearSelection();
      return {organismId:organism.id,screen};
    });
    const before=await page.evaluate(()=>({
      model:JSON.stringify(window.__alifeDebug.comparableModelState()),
      frame:window.__alifeDebug.microscopeLensSummary(),
      counts:window.__alifeDebug.counts(),
      running:document.getElementById('pause-btn').disabled
    }));

    await page.click('#microscope-btn');
    await page.evaluate(target=>window.__alifeDebug.setMicroscopeLens(true,{x:target.x,y:target.y,magnification:3.2,followSelection:false}),lensTarget.screen);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
    const enabled=await page.evaluate(()=>({
      summary:window.__alifeDebug.microscopeLensSummary(),
      button:{
        text:document.getElementById('microscope-btn').textContent,
        pressed:document.getElementById('microscope-btn').getAttribute('aria-pressed')
      },
      performance:window.__alifeDebug.performanceSummary()
    }));
    await page.screenshot({path:path.join(outDir,'microscope-lens.png')});

    await page.click('#microscope-btn');
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const after=await page.evaluate(()=>({
      model:JSON.stringify(window.__alifeDebug.comparableModelState()),
      summary:window.__alifeDebug.microscopeLensSummary(),
      counts:window.__alifeDebug.counts(),
      button:{
        text:document.getElementById('microscope-btn').textContent,
        pressed:document.getElementById('microscope-btn').getAttribute('aria-pressed')
      }
    }));

    const randomIsolation=await page.evaluate(async target=>{
      const debug=window.__alifeDebug;
      const original=Math.random;
      let calls=0;
      Math.random=function(){ calls++; return original(); };
      try{
        debug.setMicroscopeLens(true,{x:target.x,y:target.y,magnification:3.2,followSelection:false});
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        const on=debug.microscopeLensSummary();
        debug.setMicroscopeLens(false);
        await new Promise(resolve=>requestAnimationFrame(resolve));
        return {calls,on,off:debug.microscopeLensSummary()};
      }finally{
        Math.random=original;
      }
    },lensTarget.screen);

    const benchmark=await page.evaluate(async target=>{
      const debug=window.__alifeDebug;
      const summarize=values=>{
        const sorted=values.slice().sort((a,b)=>a-b);
        const percentile=p=>sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*p)-1))] ?? null;
        return {
          samples:sorted.length,
          median:percentile(0.5),
          p95:percentile(0.95),
          max:sorted[sorted.length-1] ?? null
        };
      };
      async function sample(enabled){
        debug.setMicroscopeLens(enabled,{x:target.x,y:target.y,magnification:3.2,followSelection:false});
        const rows=[];
        await new Promise(resolve=>{
          let previous=null;
          let frameCount=0;
          function tick(now){
            frameCount++;
            if(previous!=null && frameCount>10){
              rows.push({frameMs:now-previous,drawMs:debug.performanceSummary().drawMs});
            }
            previous=now;
            if(frameCount<70) requestAnimationFrame(tick);
            else resolve();
          }
          requestAnimationFrame(tick);
        });
        return {
          enabled,
          lens:debug.microscopeLensSummary(),
          frameMs:summarize(rows.map(row=>row.frameMs)),
          drawMs:summarize(rows.map(row=>row.drawMs))
        };
      }
      const off=await sample(false);
      const on=await sample(true);
      debug.setMicroscopeLens(false);
      return {off,on};
    },lensTarget.screen);

    assert(before.running===true,'simulation was not paused at load');
    assert(before.frame.available===true,'microscope renderer is unavailable');
    assert(enabled.summary.enabled===true && enabled.button.pressed==='true','microscope button did not enable the lens');
    assert(enabled.summary.rendererVersion==='generator-art-v2-microscope','unexpected microscope renderer version');
    assert(enabled.summary.lastDrawn>0 && enabled.summary.lastDrawn<=enabled.summary.maxOrganisms,'lens drew no organisms or exceeded its cap');
    assert(enabled.performance.microscopeLens.enabled===true,'performance summary did not expose the enabled lens');
    assert(after.summary.enabled===false && after.button.pressed==='false','microscope button did not disable the lens');
    assert(before.model===after.model,'microscope rendering changed comparable model state');
    assert(JSON.stringify(before.counts)===JSON.stringify(after.counts),'microscope rendering changed entity counts');
    assert(randomIsolation.calls===0,'microscope rendering consumed Math.random');
    assert(randomIsolation.on.lastDrawn>0 && randomIsolation.off.enabled===false,'debug lens toggle failed');
    assert(errors.length===0,errors.join('\n'));

    const artifact={
      schemaVersion:2,
      environment:'Playwright Chromium headless',
      targetUrl,
      lensTarget,
      before:{counts:before.counts,lens:before.frame},
      enabled,
      after:{counts:after.counts,lens:after.summary,button:after.button},
      randomIsolation,
      benchmark,
      assertions:{uiToggle:true,rendererLoaded:true,drawCap:true,modelNonInterference:true,countNonInterference:true,visualRngIsolation:true,noErrors:true},
      errors
    };
    fs.writeFileSync(path.join(outDir,'microscope-smoke.json'),JSON.stringify(artifact,null,2));
    console.log(JSON.stringify({ok:true,artifact:path.join(outDir,'microscope-smoke.json'),screenshot:path.join(outDir,'microscope-lens.png'),drawn:enabled.summary.lastDrawn,randomCalls:randomIsolation.calls,benchmark},null,2));
  }finally{
    await page.close();
    await browser.close();
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
