const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const htmlFile = process.argv[2] || 'index.html';
const html = fs.readFileSync(htmlFile, 'utf8');
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]);

if (!inlineScripts.length) {
  throw new Error(`No inline scripts found in ${htmlFile}`);
}

const outputFile = path.join(os.tmpdir(), 'alife-inline-script-check.js');
fs.writeFileSync(outputFile, inlineScripts.join('\n'), 'utf8');
const result = childProcess.spawnSync(process.execPath, ['--check', outputFile], {
  encoding: 'utf8'
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status || 1);

console.log(`Syntax OK: ${htmlFile} (${inlineScripts.length} inline script block${inlineScripts.length === 1 ? '' : 's'})`);
