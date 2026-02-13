const fs = require('fs');
const path = 'src/components/batch/batch-scenario-step.tsx';
const s = fs.readFileSync(path, 'utf8');
const marker = '\n      <Card id="batch-overrides" className="scroll-mt-6">';
const i = s.lastIndexOf(marker);
if (i === -1) {
  console.log('Marker not found');
  process.exit(1);
}
const before = s.substring(0, i);
const closing = '\n    </div>\n  )\n}\n';
fs.writeFileSync(path, before + closing);
console.log('Done');
