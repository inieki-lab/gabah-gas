import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const api = fs.readFileSync('src/services/gabahApi.ts', 'utf8');
const modal = fs.readFileSync('src/components/modals/AdministrationModal.tsx', 'utf8');
const migration = fs.readFileSync('server/migrations/099_system_settings_company_profile.sql', 'utf8');

const checks = [
  ['System settings read requires authentication', server.includes("app.get('/api/admin/system-settings', async") && server.includes('getActor(req);')],
  ['System settings mutation requires Superadmin', server.includes("app.patch('/api/admin/system-settings', async") && server.includes('const actor = requireRbacSuperadmin(req, res);')],
  ['Only the four approved company-profile fields are accepted', server.includes("['companyName', 'accountingStandard', 'baseCurrency', 'fiscalYear'] as const")],
  ['Company profile fields and fiscal year are validated', server.includes('nextSettings.companyName.length < 3') && server.includes('! /^(20[0-9]{2}|2100)$/') === false && server.includes('/^(20[0-9]{2}|2100)$/')],
  ['Concurrent updates lock the singleton settings row', server.includes("WHERE settings_key = 'company_profile' FOR UPDATE")],
  ['Settings update and audit insert share one transaction', /withRbacTransaction\(async client =>[\s\S]*UPDATE gabah_system_settings[\s\S]*INSERT INTO gabah_system_settings_audit/.test(server)],
  ['No-op updates do not create fake audit events', server.includes('const unchanged = SYSTEM_SETTING_KEYS.every')],
  ['Migration seeds company defaults without overwriting existing values', migration.includes("ON CONFLICT (settings_key) DO NOTHING")],
  ['System settings audit history is append-only', migration.includes('gabah_system_settings_audit_no_row_mutation') && migration.includes('gabah_system_settings_audit_no_truncate')],
  ['Frontend reads system settings through API', /getSystemSettings\(\)[\s\S]*\/api\/admin\/system-settings/.test(api)],
  ['Frontend saves system settings through API', /updateSystemSettings\(payload:[\s\S]*method: 'PATCH'/.test(api)],
  ['Frontend no longer uses localStorage for system settings', !/localStorage\.(getItem|setItem)\(['"]gabah_system_settings['"]/.test(modal)],
  ['Settings form waits for authoritative server data', modal.includes('settingsLoading &&') && modal.includes('settingsError &&') && modal.includes('disabled={!isCurrentUserAdmin || settingsLoading || !!settingsError || settingsSaving}')],
  ['Save handler persists before showing success', /await gabahApi\.updateSystemSettings\([\s\S]*showToast\('Profil perusahaan berhasil disimpan ke PostgreSQL\.'/ .test(modal)],
  ['Operational SLA reference fields remain read-only', (modal.match(/disabled=\{true\}/g) || []).length >= 4 && modal.includes('Batas SLA di bawah hanya referensi kebijakan server')],
];
let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed++;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed ? 1 : 0);
