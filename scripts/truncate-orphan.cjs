const fs = require('fs');
const path = 'src/components/batch/batch-scenario-step.tsx';
const lines = fs.readFileSync(path, 'utf8').split('\n');
const keepLines = 939;
const out = lines.slice(0, keepLines).join('\n');
fs.writeFileSync(path, out + '\n');
console.log('Done, kept', keepLines, 'lines');
