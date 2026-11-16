import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AssetNumberingEngine } from '../server/numbering.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'server/migrations/034_asset_numbering_rules.sql'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');

AssetNumberingEngine._resetForTesting();
AssetNumberingEngine.syncFromExistingAssets([
  { asset_number: 'IT-HLT-2026-0007' },
]);
AssetNumberingEngine.configureRules([{
  id: 'rule-it-hlt',
  owner_division: 'IT',
  asset_code: 'HLT',
  separator: '_',
  sequence_digits: 5,
  is_active: true,
}]);
assert.equal(
  AssetNumberingEngine.generateAssetNumber('IT', 'HLT', 2026),
  'IT_HLT_2026_00008',
  'format edits must affect future numbers while continuing above the existing sequence',
);
assert.throws(
  () => {
    AssetNumberingEngine.configureRules([{
      id: 'rule-it-hlt',
      owner_division: 'IT',
      asset_code: 'HLT',
      separator: '-',
      sequence_digits: 4,
      is_active: false,
    }]);
    AssetNumberingEngine.generateAssetNumber('IT', 'HLT', 2026);
  },
  /sedang nonaktif/,
  'inactive rules must block new number issuance',
);

assert.match(migration, /UNIQUE\s*\(owner_division,\s*asset_code\)/i);
assert.match(server, /app\.get\('\/api\/numbering\/rules'/);
assert.match(server, /app\.post\('\/api\/numbering\/rules'/);
assert.match(server, /app\.patch\('\/api\/numbering\/rules\/:id'/);
assert.match(server, /app\.delete\('\/api\/numbering\/rules\/:id'/);
assert.match(server, /requireRbacPermission\(req, res, 'numbering\.manage'\)/);
assert.match(server, /usageCount > 0 \|\| \(sequence\?\.current \|\| 0\) > 0/);
assert.match(server, /confirmation !== expected \|\| reason\.length < 20/);
assert.match(server, /nomor yang telah terbit tidak diubah/);
assert.match(css, /Theme enforcement layer/);
assert.match(css, /--gabah-green-800/);

console.log('PASS numbering rule format, resume sequence, inactive guard, CRUD authorization, delete safeguards, and theme enforcement');
