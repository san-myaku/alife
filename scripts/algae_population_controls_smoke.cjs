const fs=require('fs');
const path=require('path');
const Module=require('module');

function addModules(dir){
  if(!dir || !fs.existsSync(dir)) return;
  const rows=(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean);
  if(!rows.includes(dir)){ rows.push(dir); process.env.NODE_PATH=rows.join(path.delimiter); Module._initPaths(); }
}
const userRoot=process.env.USERPROFILE||process.env.HOME||'';
const modules=path.join(userRoot,'.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules');
addModules(modules);
addModules(path.join(modules,'.pnpm','node_modules'));
const {chromium}=require('playwright');

const outDir=path.resolve('artifacts','algae-population-controls');
const targetUrl='file:///'+path.resolve('index.html').replace(/\\/g,'/')+'?ui-smoke=1';
fs.mkdirSync(outDir,{recursive:true});

function assert(condition,message){ if(!condition) throw new Error(message); }
function closeTo(actual,expected,epsilon=1e-9){ return Math.abs(Number(actual)-Number(expected))<=epsilon; }

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(`pageerror: ${error.message||error}`));
  page.on('console',message=>{ if(message.type()==='error') errors.push(`console: ${message.text()}`); });
  try{
    await page.goto(targetUrl,{waitUntil:'load'});
    await page.waitForFunction(()=>typeof window.__alifeDebug?.algaeRegrowthControlSummary==='function');
    const result=await page.evaluate(async()=>{
      const debug=window.__alifeDebug;
      const slider=document.getElementById('algae-regrowth-slider');
      const label=document.getElementById('algae-regrowth-value');
      const initial={control:debug.algaeRegrowthControlSummary(),slider:{min:slider.min,max:slider.max,step:slider.step,value:slider.value,label:label.textContent}};

      slider.value='10'; slider.dispatchEvent(new Event('input',{bubbles:true}));
      const at10={control:debug.algaeRegrowthControlSummary(),value:slider.value,label:label.textContent};
      slider.value='200'; slider.dispatchEvent(new Event('input',{bubbles:true}));
      const at200={control:debug.algaeRegrowthControlSummary(),value:slider.value,label:label.textContent};

      const saved=debug.captureSaveData();
      debug.setAlgaeRegrowthPercent(10);
      const savedRestore=debug.restoreSaveData(saved);
      const afterSavedRestore=debug.algaeRegrowthControlSummary();
      const decoded=JSON.parse(decodeURIComponent(escape(atob(saved.split(':',2)[1]))));
      delete decoded.settings.algaeRegrowthPercent;
      const legacy='ALIFE2:'+btoa(unescape(encodeURIComponent(JSON.stringify(decoded))));
      debug.setAlgaeRegrowthPercent(200);
      const legacyRestore=debug.restoreSaveData(legacy);
      const afterLegacyRestore=debug.algaeRegrowthControlSummary();

      const historyInitial=debug.populationHistorySummary();
      debug.modelStep(19);
      debug.setSimulationRunning(true);
      await new Promise(resolve=>{
        const started=performance.now();
        function poll(){
          if(debug.populationHistorySummary().length>=2 || performance.now()-started>5000){ debug.setSimulationRunning(false); resolve(); return; }
          requestAnimationFrame(poll);
        }
        requestAnimationFrame(poll);
      });
      const historyAfter=debug.populationHistorySummary();

      const beforePopulation=debug.counts().organisms;
      const speciesNavigator=debug.setPopulationNavigator({diet:'h',group:'species'});
      const showResult=debug.showPopulationNavigatorSelection();
      const selected=debug.selectedOrganism();
      const afterPopulation=debug.counts().organisms;
      const packNavigator=debug.setPopulationNavigator({diet:'c',group:'pack'});
      const ui={
        legendLabels:[...document.querySelectorAll('#mix-canvas + .legend .hint')].map(node=>node.textContent),
        dietButtons:[...document.querySelectorAll('#navigator-diets button')].map(node=>({diet:node.dataset.diet,text:node.textContent,pressed:node.getAttribute('aria-pressed')})),
        groupButtons:[...document.querySelectorAll('#navigator-groups button')].map(node=>({group:node.dataset.group,text:node.textContent,pressed:node.getAttribute('aria-pressed')})),
        showButtonText:document.getElementById('navigator-show-btn').textContent,
        navigatorCount:document.getElementById('navigator-count').textContent,
        chartWidth:document.getElementById('mix-canvas').width,
        chartHeight:document.getElementById('mix-canvas').height
      };
      debug.setAlgaeRegrowthPercent(200);
      debug.resetSimulation();
      const afterReset=debug.algaeRegrowthControlSummary();
      return {initial,at10,at200,savedRestore,afterSavedRestore,legacyRestore,afterLegacyRestore,historyInitial,historyAfter,beforePopulation,afterPopulation,speciesNavigator,showResult,selected,packNavigator,ui,afterReset};
    });

    assert(result.initial.slider.min==='10' && result.initial.slider.max==='200' && result.initial.slider.step==='10','slider range is not 10..200 step 10');
    assert(result.initial.control.percent===100 && closeTo(result.initial.control.baseScale,0.70) && closeTo(result.initial.control.effectiveScale,0.70),'100 must preserve the current 0.70 scale');
    assert(result.at10.control.percent===10 && closeTo(result.at10.control.effectiveScale,0.07),'10 must map to 0.07');
    assert(result.at200.control.percent===200 && closeTo(result.at200.control.effectiveScale,1.40),'200 must map to 1.40');
    assert(result.savedRestore.ok && result.afterSavedRestore.percent===200,'save/load did not preserve the slider');
    assert(result.legacyRestore.ok && result.afterLegacyRestore.percent===100,'legacy save did not default to 100');
    assert(result.historyAfter.length>=2,'population history did not advance');
    for(const row of result.historyAfter.rows) assert(row.h+row.m+row.c===row.total,'diet counts do not sum to total');
    assert(result.ui.legendLabels.join('|')==='草食|雑食|肉食|総数','chart legend is incomplete');
    assert(result.speciesNavigator.groups.length>0 && result.showResult?.organismId===result.selected?.id,'species navigation did not add and select an organism');
    assert(result.afterPopulation===result.beforePopulation+1,'navigator did not add exactly one organism');
    assert(result.packNavigator.group==='pack','Pack grouping did not activate');
    assert(result.afterReset.percent===100 && closeTo(result.afterReset.effectiveScale,0.70),'reset did not restore 100');
    assert(errors.length===0,errors.join('\n'));

    await page.evaluate(()=>window.__alifeDebug.setPopulationNavigator({diet:'h',group:'species'}));
    await page.locator('#mix-canvas').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(outDir,'panel.png')});
    const artifact={schemaVersion:1,environment:'Playwright Chromium headless',targetUrl,result,assertions:{sliderRange:true,current100Preserved:true,tenAndTwoHundredMapped:true,saveRoundTrip:true,legacyDefault:true,historyFourSeries:true,navigatorAddsAndSelectsOne:true,packModeAvailable:true,resetDefault:true,noErrors:true},errors};
    fs.writeFileSync(path.join(outDir,'ui-smoke.json'),JSON.stringify(artifact,null,2));
    console.log(JSON.stringify({ok:true,artifact:path.join(outDir,'ui-smoke.json'),screenshot:path.join(outDir,'panel.png'),summary:{initial:result.initial.control,at10:result.at10.control,at200:result.at200.control,historyLength:result.historyAfter.length,navigatorGroups:result.speciesNavigator.groups.length,selected:result.selected,packGroups:result.packNavigator.groups.length}},null,2));
  }finally{
    await page.close();
    await browser.close();
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
