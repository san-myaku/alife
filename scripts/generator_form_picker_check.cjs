// The roster cards tag each creature with its visual-kind id (e.g. "single-sawback"),
// but the generator's form picker lists labels. If a label shares no word with its id,
// the form is effectively unselectable: you can see the creature but can't find it in
// the picker. Run this after adding or renaming a form.
//
//   node scripts/generator_form_picker_check.cjs
//
const path = require('path');

require(path.join(__dirname, '..', 'organism_roster_art.js'));
const A = globalThis.OrganismRosterArt;

function tokens(id) {
  // "single-sawback" -> the distinctive tail word; also accept singular/plural.
  const t = id.split('-').pop().toLowerCase();
  const alts = [t];
  if (t.endsWith('s')) alts.push(t.slice(0, -1));
  else alts.push(t + 's');
  if (t.endsWith('ed')) alts.push(t.slice(0, -2));
  return alts;
}

const problems = [];
A.visualTypes.filter(t => t.id !== 'all').forEach(t => {
  const label = t.label.toLowerCase().replace(/[^a-z]/g, '');
  if (!tokens(t.id).some(tok => label.includes(tok))) {
    problems.push('  ' + t.id.padEnd(18) + ' -> "' + t.label + '"');
  }
});

const total = A.visualTypes.length - 1;
if (problems.length) {
  console.error('形態 ' + problems.length + '/' + total + ' がカードのタグ名からピッカーで引けません:');
  console.error(problems.join('\n'));
  console.error('\nラベルに id の識別語を含めてください（例: single-sawback -> "sawback (sawtooth dome)"）。');
  process.exit(1);
}
console.log('OK: ' + total + ' 形態すべて、カードのタグ名からピッカーで引けます。');
