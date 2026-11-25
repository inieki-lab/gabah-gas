import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const api = fs.readFileSync('src/services/gabahApi.ts', 'utf8');
const modal = fs.readFileSync('src/components/modals/AdministrationModal.tsx', 'utf8');
const migration = fs.readFileSync('server/migrations/103_system_settings_company_profile.sql', 'utf8');

const checks = [
  ['System settings read requires active Superadmin authorization', /app\.get\('\/api\/admin\/system-settings'[\s\S]*?requireRbacSuperadmin\(req, res\)[\s\S]*?isPostgresPersistenceActive\(\)/.test(server)],
  ['System settings mutation requires stable Superadmin authorization', /app\.patch\('\/api\/admin\/system-settings'[\s\S]*?requireRbacSuperadmin\(req, res\)/.test(server)],
  ['Only the four approved company-profile fields are accepted', /SYSTEM_SETTING_KEYS = \['companyName', 'accountingStandard', 'baseCurrency', 'fiscalYear'\] as const/.test(server)],
  ['Company profile fields, strict string types, and fiscal year are validated', /SYSTEM_SETTING_KEYS\.some\(key => typeof body\[key\] !== 'string'\)/.test(server) && server.includes('nextSettings.companyName.length < 3') && /\^\(20\[0-9\]\{2\}|2100\)\$/.test(server)],
  ['Concurrent updates lock the singleton settings row', /WHERE settings_key = 'company_profile' FOR UPDATE/.test(server)],
  ['Settings update and audit insert share one transaction', /withRbacTransaction\(async client =>[\s\S]*UPDATE gabah_system_settings[\s\S]*INSERT INTO gabah_system_settings_audit/.test(server)],
  ['No-op updates do not create false audit events', /const unchanged = SYSTEM_SETTING_KEYS\.every/.test(server)],
  ['Migration seeds company defaults without overwriting existing values', /INSERT INTO gabah_system_settings[\s\S]*ON CONFLICT \(settings_key\) DO NOTHING/.test(migration)],
  ['System settings audit history is protected from UPDATE, DELETE, and TRUNCATE', /CREATE TRIGGER gabah_system_settings_audit_no_row_mutation[\s\S]*BEFORE UPDATE OR DELETE[\s\S]*CREATE TRIGGER gabah_system_settings_audit_no_truncate[\s\S]*BEFORE TRUNCATE/.test(migration)],
  ['Frontend reads and saves system settings through the API client', /getSystemSettings\(\)[\s\S]*\/api\/admin\/system-settings/.test(api) && /updateSystemSettings\(payload:[\s\S]*method: 'PATCH'/.test(api)],
  ['Frontend no longer uses localStorage for system settings', !/localStorage\.(?:getItem|setItem)\(['"]gabah_system_settings['"]/.test(modal)],
  ['Settings form waits for authoritative server data and disables writes on errors', modal.includes('settingsLoading &&') && modal.includes('settingsError &&') && /disabled=\{!isCurrentUserAdmin \|\| settingsLoading \|\| !!settingsError \|\| settingsSaving\}/.test(modal)],
  ['Save handler persists before showing success', /await gabahApi\.updateSystemSettings\([\s\S]*?showToast\('Profil perusahaan berhasil disimpan ke PostgreSQL\.'/ .test(modal)],
  ['Operational SLA reference fields remain read-only and disclose server ownership', (modal.match(/disabled=\{true\}/g) || []).length >= 4 && modal.includes('Batas SLA helpdesk di bawah merupakan <strong>referensi</strong>') && modal.includes('nilai SLA operasional riil saat ini ditetapkan server')],
];
let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed++;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed ? 1 : 0);
