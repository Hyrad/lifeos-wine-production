import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
for(const name of await readdir('.private-dist/assets')) {
  const text=await readFile(`.private-dist/assets/${name}`,'utf8');
  assert.doesNotMatch(text, /(?:ntn_|secret_|ghp_|github_pat_)[A-Za-z0-9_]{8,}|\.ts\.net|\b[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\b/);
}
const files=await readdir('.private-dist/assets');const js=await readFile(`.private-dist/assets/${files.find(f=>f.endsWith('.js'))}`,'utf8');
assert.ok(js.includes('/api/v1/wine-supplies'));assert.ok(js.includes('Refresh from LifeOS'));assert.ok(js.includes('1.207-private.1'));assert.ok(!js.includes('Last checked'));
console.log('Private build PASS: live client present; no credential, private hostname or UUID configuration.');
