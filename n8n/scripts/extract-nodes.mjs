import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const base = fileURLToPath(new URL('../', import.meta.url));
const workflow = JSON.parse(readFileSync(join(base, 'workflows/revenue-workflow-v6.sanitized.json'), 'utf8'));
const selected = {
  'verify-claim.js': 'Verify Claim',
  'verify-sent-commit.js': 'Verify SENT Commit (LANE-A)',
  'classify-send-error.js': 'Handle Send Error (LANE-A)',
  'detect-permanent-bounce.js': 'Detect Permanent Bounce',
  'copy-gate.js': 'Specificity + Factuality + Copy Gate',
  'dispatcher-lease.js': 'Acquire Dispatcher Lease',
  'classify-reply.js': 'Classify Reply + Commercial Action',
};
const check = process.argv.includes('--check');
if (!check) mkdirSync(join(base, 'extracted'), { recursive: true });
for (const [file, name] of Object.entries(selected)) {
  const node = workflow.nodes.find(n => n.name === name);
  if (!node?.parameters?.jsCode) throw new Error(`Missing Code node: ${name}`);
  const content = `// Extracted from SANITIZED historical n8n source.\n// Node: ${name}\n// Mode: ${node.parameters.mode ?? 'runOnceForAllItems'}\n// n8n context variables are supplied by the node runner.\n\n${node.parameters.jsCode.trim()}\n`;
  const target = join(base, 'extracted', file);
  if (check) {
    if (readFileSync(target, 'utf8') !== content) throw new Error(`Extraction differs: ${file}`);
  } else writeFileSync(target, content);
}
console.log(`${check ? 'Verified' : 'Extracted'} ${Object.keys(selected).length} source node bodies`);
