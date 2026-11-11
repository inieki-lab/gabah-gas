import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const service = read('server/services.ts');
const server = read('server.ts');
const admin = read('src/components/modals/AdministrationModal.tsx');
const assetDetail = read('src/components/modals/AssetDetailModal.tsx');
const migration = read('server/migrations/037_rename_supply_chain_domain_to_rpc.sql');

const sectionStart = admin.indexOf("VIEW: 5. ASSET NUMBERING");
const sectionEnd = admin.indexOf("VIEW: 6. NOTIFICATION CENTER", sectionStart);
const numberingUi = sectionStart >= 0 && sectionEnd > sectionStart
  ? admin.slice(sectionStart, sectionEnd)
  : '';

const checks = [
  ['createAsset asynchronous for database-backed sequence allocation', /static async createAsset[\s\S]*?Promise<ServerAsset>/.test(service)],
  ['PostgreSQL sequence uses atomic INSERT ... ON CONFLICT', /INSERT INTO asset_number_sequences[\s\S]*?ON CONFLICT \(owner_division_id, asset_code, sequence_year\)/.test(service)],
  ['Sequence reconciles with the highest existing asset number', /MAX\(\(regexp_match\(a\.asset_number/.test(service) && /GREATEST\(asset_number_sequences\.last_sequence, EXCLUDED\.last_sequence - 1\) \+ 1/.test(service)],
  ['Single asset route awaits asynchronous creation', /await GabahDomainService\.createAsset\(req\.body, actor\)/.test(server)],
  ['Bulk import awaits each asynchronous asset creation', /await GabahDomainService\.createAsset\(\{/.test(server)],
  ['PostgreSQL sequence endpoint reads persisted counters', /FROM asset_number_sequences s[\s\S]*?JOIN divisions d/.test(server)],
  ['File-store fallback remains explicit', /AssetNumberingEngine\.generateAssetNumber\(resolvedOwnerDivision, taxonomy\.code, targetYear\)/.test(service)],
  ['Initial numbering simulator exposes IT and GA only', numberingUi.includes('<option value="IT">') && numberingUi.includes('<option value="GA">') && !numberingUi.includes('<option value="RPC">') && !numberingUi.includes('<option value="PIBC">')],
  ['Simulator does not claim to allocate a real asset number', numberingUi.includes('bukan penerbitan nomor aset aktual')],
  ['RPC migration aborts on an asset-number collision', migration.includes('RAISE EXCEPTION') && migration.includes("legacy.asset_number LIKE 'SC-%'")],
  ['RPC migration renames legacy KDR-SC category tokens inside asset numbers', migration.includes("'-KDR-SC-', '-KDR-RPC-'")],
  ['RPC migration merges sequence counters without lowering them', migration.includes('GREATEST(asset_number_sequences.last_sequence, EXCLUDED.last_sequence)')],
  ['RPC migration preserves asset managing-unit references', migration.includes("UPDATE assets SET managing_unit_id = 'UNIT-RPC' WHERE managing_unit_id = 'UNIT-SC'")],
  ['RPC migration merges old role permissions and user assignments', migration.includes('INSERT INTO gabah_role_permissions') && migration.includes('UPDATE gabah_user_roles legacy')],
  ['RPC migration merges role scopes safely', migration.includes('INSERT INTO gabah_role_division_scopes') && migration.includes('ON CONFLICT DO NOTHING')],
  ['SC-to-RPC rename has no known accidental SQL/identifier corruption', !server.includes('DERPC') && !assetDetail.includes('isSC') && !admin.includes('DERPC')],
];

for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
}

const failed = checks.filter(([, pass]) => !pass).length;
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
if (failed) process.exit(1);
