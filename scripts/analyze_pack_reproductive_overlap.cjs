const fs = require('fs');
const path = require('path');

const inputFiles = process.argv.slice(2);
if (!inputFiles.length) {
  throw new Error('Usage: node scripts/analyze_pack_reproductive_overlap.cjs <result.json> [...]');
}

const outputDir = process.env.ALIFE_PACK_OVERLAP_OUTPUT_DIR
  || path.join('artifacts', 'pack_reproductive_overlap');

function median(values) {
  const rows = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!rows.length) return null;
  const mid = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[mid] : (rows[mid - 1] + rows[mid]) / 2;
}

function packDiet(pack, result) {
  const bottleneckPack = (result?.run?.packReproductionBottleneck?.topPacks || [])
    .find(row => row.packId === pack?.id);
  const identity = String(
    pack?.lineageId
      || pack?.identityKey
      || bottleneckPack?.speciesKey
      || ''
  );
  const directMatch = identity.match(/\|D([^|]+)/);
  if (directMatch) return directMatch[1];
  const fallbackMatch = String(bottleneckPack?.speciesKey || '').match(/\|D([^|]+)/);
  const match = directMatch || fallbackMatch;
  return match ? match[1] : 'unknown';
}

function energyRatio(member) {
  return Number(member?.energy || 0) / Math.max(1, Number(member?.reproThreshold || 0));
}

function analyzePack(result, pack) {
  const lifecycle = result.packMemberLifecycle || {};
  const samples = (lifecycle.spatialSamples || [])
    .filter(sample => sample.packId === pack.id)
    .sort((a, b) => a.frame - b.frame);
  const lifecycleMembers = (lifecycle.members || []).filter(member => member.packId === pack.id);
  const lifecycleById = new Map(lifecycleMembers.map(member => [member.organismId, member]));
  const matureSamples = samples.filter(sample => Number(sample.matureMemberCount || 0) >= 2);
  const secondHighestRatios = matureSamples.map(sample => {
    const ratios = sample.members
      .filter(member => member.mature)
      .map(energyRatio)
      .sort((a, b) => b - a);
    return ratios[1];
  }).filter(Number.isFinite);

  const childMaturityRows = [];
  for (const child of lifecycleMembers) {
    if (!child.born || child.parentId == null) continue;
    const firstMatureSample = samples.find(sample =>
      sample.members.some(member => member.id === child.organismId && member.mature)
    );
    if (!firstMatureSample) continue;
    const childAtMaturity = firstMatureSample.members.find(member => member.id === child.organismId);
    const parentAtMaturity = firstMatureSample.members.find(member => member.id === child.parentId) || null;
    const priorGeneration = firstMatureSample.members.filter(member =>
      member.id !== child.organismId
        && Number(member.generationDepth || 0) < Number(childAtMaturity?.generationDepth || 0)
    );
    const parentLifecycle = lifecycleById.get(child.parentId) || null;
    const estimatedMaturityFrame = Number(child.joinFrame || 0) + Number(child.maturityAge || 0);
    childMaturityRows.push({
      organismId: child.organismId,
      parentId: child.parentId,
      generationDepth: child.generationDepth,
      firstMatureSampleFrame: firstMatureSample.frame,
      estimatedMaturityFrame,
      parentDeathFrame: parentLifecycle?.deathFrame ?? null,
      parentSurvivedEstimatedMaturity: parentLifecycle?.deathFrame == null
        || Number(parentLifecycle.deathFrame) >= estimatedMaturityFrame,
      parentPresent: !!parentAtMaturity,
      parentMature: !!parentAtMaturity?.mature,
      parentReady: !!parentAtMaturity?.reproductionReady,
      parentEnergyRatio: parentAtMaturity ? energyRatio(parentAtMaturity) : null,
      priorGenerationPresent: priorGeneration.length,
      priorGenerationMature: priorGeneration.filter(member => member.mature).length,
      priorGenerationReady: priorGeneration.filter(member => member.reproductionReady).length,
      maximumPriorGenerationEnergyRatio: priorGeneration.length
        ? Math.max(...priorGeneration.map(energyRatio))
        : null
    });
  }

  return {
    seed: result.seed,
    packId: pack.id,
    diet: packDiet(pack, result),
    createdFrame: pack.createdFrame,
    dissolvedFrame: pack.dissolvedFrame,
    lifetimeFrames: pack.dissolvedFrame == null
      ? Number(result.frame || 0) - Number(pack.createdFrame || 0)
      : Number(pack.dissolvedFrame) - Number(pack.createdFrame || 0),
    maximumLivingMembers: Number(pack.maximumLivingMembers || 0),
    totalMembersEver: Number(pack.totalMembersEver || 0),
    birthsIntoPack: Number(pack.birthsIntoPack || 0),
    samples: samples.length,
    matureOverlapSamples: matureSamples.length,
    exactlyOneReadySamples: samples.filter(sample => Number(sample.reproductionReadyMemberCount || 0) === 1).length,
    reproductionReadyOverlapSamples: samples.filter(sample => Number(sample.reproductionReadyMemberCount || 0) >= 2).length,
    medianSecondHighestMatureEnergyRatio: median(secondHighestRatios),
    maximumSecondHighestMatureEnergyRatio: secondHighestRatios.length
      ? Math.max(...secondHighestRatios)
      : null,
    childMaturityRows
  };
}

function aggregateByDiet(packRows) {
  const diets = [...new Set(packRows.map(row => row.diet))].sort();
  return Object.fromEntries(diets.map(diet => {
    const rows = packRows.filter(row => row.diet === diet);
    const childRows = rows.flatMap(row => row.childMaturityRows);
    const count = predicate => childRows.filter(predicate).length;
    return [diet, {
      packs: rows.length,
      totalMembersEver: rows.reduce((sum, row) => sum + row.totalMembersEver, 0),
      birthsIntoPack: rows.reduce((sum, row) => sum + row.birthsIntoPack, 0),
      matureOverlapSamples: rows.reduce((sum, row) => sum + row.matureOverlapSamples, 0),
      exactlyOneReadySamples: rows.reduce((sum, row) => sum + row.exactlyOneReadySamples, 0),
      reproductionReadyOverlapSamples: rows.reduce((sum, row) => sum + row.reproductionReadyOverlapSamples, 0),
      maximumSecondHighestMatureEnergyRatio: rows.reduce(
        (max, row) => Math.max(max, Number(row.maximumSecondHighestMatureEnergyRatio || 0)),
        0
      ),
      maturedChildren: childRows.length,
      parentSurvivedEstimatedMaturity: count(row => row.parentSurvivedEstimatedMaturity),
      parentPresentAtFirstMatureSample: count(row => row.parentPresent),
      parentMatureAtFirstMatureSample: count(row => row.parentMature),
      parentReadyAtFirstMatureSample: count(row => row.parentReady),
      priorGenerationPresentAtFirstMatureSample: count(row => row.priorGenerationPresent > 0),
      priorGenerationMatureAtFirstMatureSample: count(row => row.priorGenerationMature > 0),
      priorGenerationReadyAtFirstMatureSample: count(row => row.priorGenerationReady > 0),
      medianParentEnergyRatioAtFirstMatureSample: median(
        childRows.map(row => row.parentEnergyRatio)
      )
    }];
  }));
}

const sourceRows = inputFiles.map(file => ({
  file,
  data: JSON.parse(fs.readFileSync(file, 'utf8'))
}));
const packRows = sourceRows.flatMap(({ data }) =>
  (data.results || []).flatMap(result =>
    (result.packs || []).map(pack => analyzePack(result, pack))
  )
);
const report = {
  generatedAt: new Date().toISOString(),
  inputFiles,
  packRows,
  aggregateByDiet: aggregateByDiet(packRows)
};

const markdown = [
  '# Pack Reproductive Overlap',
  '',
  `- inputs: ${inputFiles.join(', ')}`,
  `- packs: ${packRows.length}`,
  '',
  '## Diet Summary',
  '',
  '| diet | packs | members | births | mature overlap | one ready | ready overlap | matured children | parent survived | parent present | parent mature | parent ready | prior generation ready | median parent ratio | max second ratio |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...Object.entries(report.aggregateByDiet).map(([diet, row]) =>
    `| ${diet} | ${row.packs} | ${row.totalMembersEver} | ${row.birthsIntoPack} | ${row.matureOverlapSamples} | ${row.exactlyOneReadySamples} | ${row.reproductionReadyOverlapSamples} | ${row.maturedChildren} | ${row.parentSurvivedEstimatedMaturity} | ${row.parentPresentAtFirstMatureSample} | ${row.parentMatureAtFirstMatureSample} | ${row.parentReadyAtFirstMatureSample} | ${row.priorGenerationReadyAtFirstMatureSample} | ${row.medianParentEnergyRatioAtFirstMatureSample ?? ''} | ${row.maximumSecondHighestMatureEnergyRatio ?? ''} |`
  ),
  '',
  '## Pack Rows',
  '',
  '| seed | pack | diet | lifetime | max members | births | mature overlap | one ready | ready overlap | median second ratio | max second ratio |',
  '| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...packRows.map(row =>
    `| ${row.seed} | ${row.packId} | ${row.diet} | ${row.lifetimeFrames} | ${row.maximumLivingMembers} | ${row.birthsIntoPack} | ${row.matureOverlapSamples} | ${row.exactlyOneReadySamples} | ${row.reproductionReadyOverlapSamples} | ${row.medianSecondHighestMatureEnergyRatio ?? ''} | ${row.maximumSecondHighestMatureEnergyRatio ?? ''} |`
  ),
  ''
].join('\n');

fs.mkdirSync(outputDir, { recursive: true });
const outputJson = path.join(outputDir, 'pack_reproductive_overlap.json');
const outputMarkdown = path.join(outputDir, 'pack_reproductive_overlap.md');
fs.writeFileSync(outputJson, JSON.stringify(report, null, 2), 'utf8');
fs.writeFileSync(outputMarkdown, markdown, 'utf8');
console.log(JSON.stringify({ outputJson, outputMarkdown, aggregateByDiet: report.aggregateByDiet }, null, 2));
