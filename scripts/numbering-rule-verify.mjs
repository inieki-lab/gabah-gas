import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AssetNumberingEngine } from '../server/numbering.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'server/migrations/043_asset_numbering_rules.sql'), 'utf8');
const persistence = fs.readFileSync(path.join(root, 'server/persistence.ts'), 'utf8');
const services = fs.readFileSync(path.join(root, 'server/services.ts'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
const createAssetUi = fs.readFileSync(path.join(root, 'src/components/modals/CreateAssetModal.tsx'), 'utf8');
const assetDetailUi = fs.readFileSync(path.join(root, 'src/components/modals/AssetDetailModal.tsx'), 'utf8');
const assetImportUi = fs.readFileSync(path.join(root, 'src/components/modals/AssetImportModal.tsx'), 'utf8');
const mockKnowledge = fs.readFileSync(path.join(root, 'src/data/mockData.ts'), 'utf8');
const dbSeed = fs.readFileSync(path.join(root, 'server/db.ts'), 'utf8');

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
assert.match(persistence, /INSERT INTO asset_number_sequences[\s\S]*ON CONFLICT \(owner_division_id, asset_code, sequence_year\)[\s\S]*last_sequence = asset_number_sequences\.last_sequence \+ 1[\s\S]*RETURNING last_sequence/i);
assert.match(persistence, /GREATEST\(asset_number_sequences\.last_sequence, EXCLUDED\.last_sequence\)/i);
assert.match(persistence, /reserveAssetNumberSequence[\s\S]*postgresFailureLatched/i);
assert.match(services, /static async createAsset/);
assert.match(services, /await reserveAssetNumberSequence/);
assert.match(services, /isPostgresFailureLatched\(\)[\s\S]*throw Object\.assign/);
assert.match(services, /isPostgresPersistenceActive\(\)[\s\S]*generateAssetNumber/);
assert.match(server, /app\.get\('\/api\/numbering\/rules'/);
assert.match(server, /app\.post\('\/api\/numbering\/rules'/);
assert.match(server, /app\.patch\('\/api\/numbering\/rules\/:id'/);
assert.match(server, /app\.delete\('\/api\/numbering\/rules\/:id'/);
assert.match(server, /requireRbacPermission\(req, res, 'numbering\.manage'\)/);
assert.match(server, /usageCount > 0 \|\| \(sequence\?\.current \|\| 0\) > 0/);
assert.match(server, /confirmation !== expected \|\| reason\.length < 20/);
assert.match(server, /nomor yang telah terbit tidak diubah/);
assert.doesNotMatch(createAssetUi, /Sistem Penomoran Resmi GABAH|Format Nomor Aset Resmi/,
  'asset creation UI must not call an unapproved technical format the corporate standard');
assert.match(createAssetUi, /Nomor aset diterbitkan server berdasarkan aturan aktif saat disimpan/);
assert.match(createAssetUi, /Nomor diterbitkan server saat penyimpanan/);
assert.doesNotMatch(createAssetUi, /livePreviewNumber|Seq \\+1|currentYear/,
  'client must not fabricate the next canonical asset number or sequence');
assert.doesNotMatch(assetDetailUi, /Format resmi:.*DIVISI/,
  'asset detail must not describe a historical pattern as an approved corporate standard');
assert.match(assetImportUi, /nomor aset diterbitkan otomatis mengikuti aturan aktif/);
const mockNumberingArticleStart = mockKnowledge.indexOf("id: 'kb-003'");
const mockNumberingArticleEnd = mockKnowledge.indexOf("id: 'kb-004'", mockNumberingArticleStart);
assert.ok(mockNumberingArticleStart >= 0 && mockNumberingArticleEnd > mockNumberingArticleStart);
const mockNumberingArticle = mockKnowledge.slice(mockNumberingArticleStart, mockNumberingArticleEnd);
assert.match(mockNumberingArticle, /Standar nomor aset korporat belum disahkan/);
assert.doesNotMatch(mockNumberingArticle, /Struktur Format Nomor Aset Resmi|SC-MSN-2026|PIBC-KDR-2026/);
assert.match(dbSeed, /Standar nomor aset korporat belum disahkan/);
assert.doesNotMatch(dbSeed, /Nomor Resmi Aset \(\{DIVISI\}-\{KODE\}-\{TAHUN\}-XXXX\)/);
assert.match(css, /Theme enforcement layer/);
assert.match(css, /--gabah-green-800/);

console.log('PASS numbering rule format, resume sequence, inactive guard, CRUD authorization, delete safeguards, and theme enforcement');
