import fs from 'node:fs';

const migration = fs.readFileSync('server/migrations/045_rpc_location_label_consistency.sql', 'utf8');
const db = fs.readFileSync('server/db.ts', 'utf8');
const persistence = fs.readFileSync('server/persistence.ts', 'utf8');
const services = fs.readFileSync('server/services.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');
const prd = fs.readFileSync('PRD.md', 'utf8');
const businessRules = fs.readFileSync('docs/product/BUSINESS-RULES.md', 'utf8');
const batchQrUi = fs.readFileSync('src/components/modals/BatchQRPrintModal.tsx', 'utf8');
const gabahServiceUi = fs.readFileSync('src/services/gabahService.ts', 'utf8');
const mockData = fs.readFileSync('src/data/mockData.ts', 'utf8');
const ticketsView = fs.readFileSync('src/components/views/TicketsView.tsx', 'utf8');
const checks = [
  ['Office location OFF-RPC is displayed as RPC in migration and defaults', migration.includes("name = 'RPC'") && migration.includes("WHERE id = 'OFF-RPC'") && db.includes("id: 'OFF-RPC', name: 'RPC'") && persistence.includes("id: 'OFF-RPC', name: 'RPC'")],
  ['Legacy unit ID remains stable while its display label becomes RPC', migration.includes("WHERE id = 'UNIT-SC'") && db.includes("id: 'UNIT-SC', name: 'RPC'") && persistence.includes("id: 'UNIT-SC', name: 'RPC'")],
  ['Legacy SC/PIBC division keys are retained as compatibility labels', migration.includes("RPC (legacy references)") && migration.includes("PIBC (legacy references)") && db.includes("code: 'SC', name: 'RPC (legacy references)'") && db.includes("code: 'PIBC', name: 'PIBC (legacy references)'")],
  ['Legacy Supply Chain user is normalized to Karyawan at RPC without changing account ID', db.includes('Karyawan — Lokasi RPC') && persistence.includes('Karyawan — Lokasi RPC') && persistence.includes("office_location_id = 'OFF-RPC'")],
  ['New assets cannot use SC/PIBC as owner domains', services.includes("['SC', 'PIBC', 'UNASSIGNED']") && server.includes("!['SC', 'PIBC'].includes(owner.code)")],
  ['Migration does not rewrite existing assets or user role assignments', !/UPDATE (assets|users|gabah_user_roles)|DELETE FROM (assets|users|gabah_user_roles)/i.test(migration)],
  ['README and PRD distinguish RPC/PIBC locations from asset ownership', readme.includes('RPC dan PIBC adalah konteks lokasi, bukan owner aset otomatis.') && prd.includes('RPC dan PIBC dalam konteks pembahasan ini adalah nama kantor/unit lokasi operasional')],
  ['Business rules preserve legacy owner records pending per-asset review', businessRules.includes('owner code') && businessRules.includes('SC/PIBC') && businessRules.includes('ditinjau satu per satu')],
  ['Batch QR owner filters are derived from actual owner domains, not a fixed division list', batchQrUi.includes('ownerOptions = Array.from(new Set(') && batchQrUi.includes('filterOwnerDomain') && !/option value="Supply Chain"|option value="PIBC"/.test(batchQrUi)],
  ['Legacy SC/PIBC values are grouped as review-only labels in QR output', batchQrUi.includes("new Set(['SC', 'SUPPLY CHAIN', 'PIBC', 'RPC'])") && batchQrUi.includes('LEGACY_LOCATION_OWNER') && batchQrUi.includes('Legacy owner code (RPC)') && batchQrUi.includes('Legacy owner code PIBC') && batchQrUi.includes('Lokasi RPC (bukan owner domain)')],
  ['Legacy owner badges no longer call SC/PIBC active divisions', gabahServiceUi.includes('Kode owner legacy (RPC)') && gabahServiceUi.includes('Kode owner legacy PIBC') && gabahServiceUi.includes('Lokasi RPC (bukan owner domain)') && !gabahServiceUi.includes('Divisi Supply Chain') && !gabahServiceUi.includes('Divisi Pasar PIBC')],
  ['Mock SC assets remain historical fixtures, not active Supply Chain ownership claims', mockData.includes('Legacy SC owner-code fixtures retained for per-asset review') && !mockData.includes('// SC Assets - Owned by Supply Chain')],
  ['Legacy ticket queue uses the current RPC display name, not Supply Chain', ticketsView.includes('Helpdesk & Tiket RPC (Legacy)') && ticketsView.includes('Daftar tiket historis terkait lokasi RPC') && !ticketsView.includes('Helpdesk & Tiket Supply Chain') && !ticketsView.includes('Daftar kendala operasional Supply Chain')],
];

for (const [name, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
const failed = checks.filter(([, pass]) => !pass);
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed.length} | FAIL: ${failed.length}`);
if (failed.length) process.exit(1);
