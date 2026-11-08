import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const services = read('server/services.ts');
const hardening = read('server/runtime-hardening.ts');
const policy = read('server/rbac-policy.ts');
const migration = read('server/migrations/021_dynamic_rbac_ga_it_workstation_read.sql');

const checks = [
  ['IT list scope hanya owner IT', /if \(user\.role === 'IT'\) \{\s*return db\.assets\.filter\(a => String\(a\.owner_division \|\| ''\)\.toUpperCase\(\) === 'IT'\);/.test(services)],
  ['GA list scope mengelola owner GA', /if \(user\.role === 'GA'\) \{\s*const canReadItWorkstations = hasRbacPermission/.test(services)],
  ['GA IT read scope memerlukan permission khusus', /hasRbacPermission\(String\(user\.id\), 'assets\.read\.it_workstations'\)/.test(services)],
  ['GA IT read scope dibatasi taxonomy HLT dan HPC', /\['HLT', 'HPC'\]\.includes\(String\(asset\.category_code/.test(services)],
  ['Tidak ada lagi scope aset berdasarkan lokasi SC/PIBC di resolver utama', !/user\.role === 'Supply Chain'[\s\S]{0,500}owner_division === 'SC'|user\.role === 'PIBC'[\s\S]{0,500}owner_division === 'PIBC'/.test(services)],
  ['Direct asset guard memakai permission GA yang sama', /hasRbacPermission\(String\(actor\.id\), 'assets\.read\.it_workstations'\)/.test(hardening)],
  ['Direct asset guard menggunakan dynamic scope untuk custom role', /assetVisibleUnderDynamicScopes\(actor, asset\)/.test(hardening)],
  ['GA read permission didaftarkan khusus untuk role GA', /'assets\.read\.it_workstations'[\s\S]*?WHERE r\.role_key = 'ga'/.test(migration)],
  ['Permission khusus tidak memberi permission mutasi', !/assets\.(create|update|delete|assign|move|lifecycle)/.test(migration)],
  ['RBAC policy mengevaluasi permission efektif per user', /export function hasRbacPermission/.test(policy)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}`);
  if (!ok) failed++;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
