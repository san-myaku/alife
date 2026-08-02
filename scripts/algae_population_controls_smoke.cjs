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
const proceduralSource=fs.readFileSync(path.resolve('webgl_procedural_organism_renderer.js'),'utf8');

function assert(condition,message){ if(!condition) throw new Error(message); }
function closeTo(actual,expected,epsilon=1e-9){ return Math.abs(Number(actual)-Number(expected))<=epsilon; }
function insideWorld(point,world){
  if(!point || !world) return false;
  if(world.worldShape==='circle') return Math.hypot(point.x-world.centerX,point.y-world.centerY)<=world.radius;
  return point.x>=0 && point.x<=world.worldWidth && point.y>=0 && point.y<=world.worldHeight;
}

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
      const speedSlider=document.getElementById('speed-slider');
      debug.modelStep(19);
      speedSlider.value='3'; speedSlider.dispatchEvent(new Event('input',{bubbles:true}));
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
      speedSlider.value='1'; speedSlider.dispatchEvent(new Event('input',{bubbles:true}));

      const beforePopulation=debug.counts().organisms;
      const randomNavigator=debug.setPopulationNavigator({diet:'h',group:'species'});
      const randomLabel=document.querySelector('[data-navigator-key="__random__"] small')?.textContent || '';
      const randomResult=debug.showPopulationNavigatorSelection();
      const randomSelected=debug.selectedOrganism();
      const speciesKey=randomNavigator.groups[0]?.key || null;
      const speciesNavigator=speciesKey ? debug.setPopulationNavigator({diet:'h',group:'species',selectedKey:speciesKey}) : null;
      const speciesResult=speciesKey ? debug.showPopulationNavigatorSelection() : null;
      const speciesSelected=debug.selectedOrganism();
      const afterPopulation=debug.counts().organisms;

      const packDecoded=JSON.parse(decodeURIComponent(escape(atob(saved.split(':',2)[1]))));
      packDecoded.features=packDecoded.features || {};
      packDecoded.features.persistentPackIdentity=true;
      const packSave='ALIFE2:'+btoa(unescape(encodeURIComponent(JSON.stringify(packDecoded))));
      const packRestore=debug.restoreSaveData(packSave);
      const packSeed=debug.spawnOrganisms({count:2,dietType:'carnivore',preset:'viable',ageMode:'mature',positionMode:'center',energyMode:'full'});
      debug.modelStep(20);
      let packNavigator=debug.setPopulationNavigator({diet:'c',group:'pack'});
      const packKey=packNavigator.groups[0]?.key || null;
      if(packKey) packNavigator=debug.setPopulationNavigator({diet:'c',group:'pack',selectedKey:packKey});
      const packPopulationBefore=debug.counts().organisms;
      const packResult=packKey ? debug.showPopulationNavigatorSelection() : null;
      const packSelected=debug.selectedOrganism();
      const packPopulationAfter=debug.counts().organisms;
      const ui={
        legendLabels:[...document.querySelectorAll('#mix-canvas + .legend .hint')].map(node=>node.textContent),
        dietButtons:[...document.querySelectorAll('#navigator-diets button')].map(node=>({diet:node.dataset.diet,text:node.textContent,pressed:node.getAttribute('aria-pressed')})),
        groupButtons:[...document.querySelectorAll('#navigator-groups button')].map(node=>({group:node.dataset.group,text:node.textContent,pressed:node.getAttribute('aria-pressed')})),
        showButtonText:document.getElementById('navigator-show-btn').textContent,
        navigatorCount:document.getElementById('navigator-count').textContent,
        randomLabel,
        chartWidth:document.getElementById('mix-canvas').width,
        chartHeight:document.getElementById('mix-canvas').height
      };
      debug.restoreSaveData(saved);
      debug.setAlgaeRegrowthPercent(200);
      debug.resetSimulation();
      const afterReset=debug.algaeRegrowthControlSummary();
      return {initial,at10,at200,savedRestore,afterSavedRestore,legacyRestore,afterLegacyRestore,historyInitial,historyAfter,beforePopulation,afterPopulation,randomNavigator,randomResult,randomSelected,speciesNavigator,speciesResult,speciesSelected,packRestore,packSeed,packNavigator,packResult,packSelected,packPopulationBefore,packPopulationAfter,world:debug.worldGeometry(),ui,afterReset};
    });

    assert(result.initial.slider.min==='10' && result.initial.slider.max==='200' && result.initial.slider.step==='10','slider range is not 10..200 step 10');
    assert(result.initial.control.percent===100 && closeTo(result.initial.control.baseScale,0.70) && closeTo(result.initial.control.effectiveScale,0.70),'100 must preserve the current 0.70 scale');
    assert(result.at10.control.percent===10 && closeTo(result.at10.control.effectiveScale,0.07),'10 must map to 0.07');
    assert(result.at200.control.percent===200 && closeTo(result.at200.control.effectiveScale,1.40),'200 must map to 1.40');
    assert(result.savedRestore.ok && result.afterSavedRestore.percent===200,'save/load did not preserve the slider');
    assert(result.legacyRestore.ok && result.afterLegacyRestore.percent===100,'legacy save did not default to 100');
    assert(result.historyAfter.length>=2,'population history did not advance');
    assert(result.historyAfter.latest.frame>=20 && result.historyAfter.latest.frame<=22,'3x speed skipped the first 20-step population sample window');
    for(const row of result.historyAfter.rows) assert(row.h+row.m+row.c===row.total,'diet counts do not sum to total');
    assert(result.ui.legendLabels.join('|')==='草食|雑食|肉食|総数','chart legend is incomplete');
    assert(result.randomNavigator.selectedKey==='__random__','random diet option was not selected by default');
    assert(result.randomResult?.mode==='random-diet' && result.randomResult.sourceId==null && result.randomResult.diet==='h','random diet spawn copied an existing organism or ignored the diet');
    assert(result.randomResult.organismId===result.randomSelected?.id && closeTo(result.randomResult.spawnPosition.x,result.randomSelected.x) && closeTo(result.randomResult.spawnPosition.y,result.randomSelected.y),'random diet spawn position was not measured from the selected organism');
    assert(insideWorld(result.randomSelected,result.world) && insideWorld(result.speciesSelected,result.world),'random organism was placed outside the field');
    assert(Math.hypot(result.randomSelected.x-result.speciesSelected.x,result.randomSelected.y-result.speciesSelected.y)>1,'independent random spawns reused the same field position');
    assert(result.speciesNavigator?.groups.length>0 && result.speciesResult?.mode==='random-within-species','species-constrained random spawn did not run');
    assert(result.speciesResult.speciesKey===result.speciesNavigator.selectedKey && result.speciesResult.organismId===result.speciesSelected?.id,'species-constrained spawn did not preserve the selected species');
    assert(result.speciesResult.randomPosition===true && result.speciesResult.variationApplied===true,'species-constrained spawn reused an exact gene copy');
    assert(result.afterPopulation===result.beforePopulation+2,'navigator did not add the two diagnostic organisms');
    assert(result.packRestore.ok && result.packSeed.spawnedCount===2 && result.packNavigator.groups.length>0,'Pack test setup did not create an active Pack');
    assert(result.packResult?.mode==='random-within-pack-species' && result.packResult.joinedPack===true && result.packResult.packId===result.packNavigator.selectedKey,'Pack-constrained random spawn did not join the selected Pack');
    assert(result.packResult.variationApplied===true && result.packResult.organismId===result.packSelected?.id && result.packPopulationAfter===result.packPopulationBefore+1,'Pack-constrained spawn copied genes, was not selected, or was not added');
    assert(result.ui.randomLabel.includes('ランダム個体') && !result.ui.randomLabel.includes('新種'),'random option still promises an unverified new species');
    assert(proceduralSource.includes('const hues={ambusher:285,pursuit:6,scav:45,filter:145,other:200};'),'Procedural role colors do not match the Canvas role palette');
    assert(result.afterReset.percent===100 && closeTo(result.afterReset.effectiveScale,0.70),'reset did not restore 100');
    assert(errors.length===0,errors.join('\n'));

    await page.evaluate(()=>window.__alifeDebug.setPopulationNavigator({diet:'h',group:'species'}));
    await page.locator('#mix-canvas').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(outDir,'panel.png')});
    const artifact={schemaVersion:3,environment:'Playwright Chromium headless',targetUrl,result,assertions:{sliderRange:true,current100Preserved:true,tenAndTwoHundredMapped:true,saveRoundTrip:true,legacyDefault:true,historyFourSeries:true,speedThreeSampling:true,randomDietSpawn:true,randomSpeciesSpawn:true,noExistingOrganismCopy:true,packSpawnAndJoin:true,randomLabelAccurate:true,proceduralRolePalette:true,resetDefault:true,noErrors:true},errors};
    fs.writeFileSync(path.join(outDir,'ui-smoke.json'),JSON.stringify(artifact,null,2));
    console.log(JSON.stringify({ok:true,artifact:path.join(outDir,'ui-smoke.json'),screenshot:path.join(outDir,'panel.png'),summary:{initial:result.initial.control,at10:result.at10.control,at200:result.at200.control,historyLength:result.historyAfter.length,navigatorGroups:result.speciesNavigator.groups.length,randomResult:result.randomResult,speciesResult:result.speciesResult,packGroups:result.packNavigator.groups.length}},null,2));
  }finally{
    await page.close();
    await browser.close();
  }
})().catch(error=>{ console.error(error.stack||error); process.exitCode=1; });
