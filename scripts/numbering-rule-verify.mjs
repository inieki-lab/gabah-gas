import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AssetNumberingEngine } from '../server/numbering.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'server/migrations/043_asset_numbering_rules.sql'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
const persistence = fs.readFileSync(path.join(root, 'server/persistence.ts'), 'utf8');
const services = fs.readFileSync(path.join(root, 'server/services.ts'), 'utf8');
const app = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
const modal = fs.readFileSync(path.join(root, 'src/components/modals/AdministrationModal.tsx'), 'utf8');

AssetNumberingEngine._resetForTesting();
AssetNumberingEngine.configureRules([{
  id: 'rule-it-hlt',
  owner_division: 'IT',
  asset_code: 'HLT',
  separator: '_',
  sequence_digits: 5,
  is_active: true,
}]);
AssetNumberingEngine.syncFromExistingAssets([
  { asset_number: 'IT-HLT-2026-0007' },
  { asset_number: 'IT_HLT_2026_0009' },
]);
assert.equal(
  AssetNumberingEngine.generateAssetNumber('IT', 'HLT', 2026),
  'IT_HLT_2026_00010',
  'format edits must affect future numbers while resuming the maximum across old and new separators',
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


assert.ok(persistence.includes('INSERT INTO asset_number_sequences') && persistence.includes('ON CONFLICT (owner_division_id, asset_code, sequence_year) DO NOTHING'),
  'PostgreSQL sequence row must be initialized without overwriting an existing counter');
assert.ok(persistence.includes('SELECT last_sequence FROM asset_number_sequences') && persistence.includes('FOR UPDATE'),
  'sequence allocation must serialize concurrent processes with a row lock');
assert.ok(persistence.includes('UPDATE asset_number_sequences SET last_sequence = $4'));
assert.ok(services.includes('static async createAsset(') && services.includes('Promise<ServerAsset>'));
assert.ok(services.includes('await allocateAssetSequence(resolvedOwnerDivision, taxonomy.code, numberingYear)'),
  'PostgreSQL asset creation must await the database allocator');
assert.ok(app.includes('await GabahDomainService.createAsset(req.body, actor)'));
assert.ok(app.includes('await GabahDomainService.createAsset({'));
assert.ok(app.includes("const canReadLicensesOnly = hasRbacPermission(actor.id, 'licenses.read')") && app.includes("canReadLicensesOnly ? 'licenses' : 'my_assets'"),
  'license-only readers must be governed by the licenses lifecycle module');

assert.ok(!modal.includes('gabah_numbering_config') && !modal.includes('numberingConfig'),
  'Administration must not retain a browser-only numbering configuration shadow');
assert.ok(modal.includes('numbering_rules: numberingRules || []') && modal.includes('numbering_sequences: liveSequences || []'),
  'Full backup must export the PostgreSQL-authoritative numbering rules and counters');
console.log('PASS numbering rule format, PostgreSQL row-locked allocation contract, inactive guard, CRUD authorization, delete safeguards, license module routing, and theme enforcement');
