import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', 'n8n');
const files = fs.readdirSync(root).filter(f => f.endsWith('.json'));
if (!files.length) throw new Error('no workflow JSON files found');
for (const file of files) {
  const parsed = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  if (!Array.isArray(parsed.nodes) || !parsed.nodes.length) throw new Error(`${file}: missing nodes`);
  if (!parsed.connections || typeof parsed.connections !== 'object') throw new Error(`${file}: missing connections`);
  const names = new Set(parsed.nodes.map(n => n.name));
  if (names.size !== parsed.nodes.length) throw new Error(`${file}: duplicate node names`);
}
console.log(`validated ${files.length} workflow JSON files`);
