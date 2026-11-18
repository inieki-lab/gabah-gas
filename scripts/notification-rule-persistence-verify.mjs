import fs from 'node:fs';
import assert from 'node:assert/strict';

const server = fs.readFileSync('server.ts', 'utf8');
const api = fs.readFileSync('src/services/gabahApi.ts', 'utf8');
const modal = fs.readFileSync('src/components/modals/AdministrationModal.tsx', 'utf8');
const migration = fs.readFileSync('server/migrations/098_notification_rule_settings.sql', 'utf8');
  ['Notification settings require authentication for reads', server.includes("app.get('/api/admin/notification-rules', async") && server.includes('getActor(req);')],
  ['Notification settings require Superadmin for writes', server.includes("app.patch('/api/admin/notification-rules/:ruleId', async") && server.includes('const actor = requireRbacSuperadmin(req, res);')],
  ['Notification settings require Superadmin for writes', /app\.patch\('\/api\/admin\/notification-rules\/:ruleId'[\s\S]*requireRbacSuperadmin\(req, res\)/.test(server)],
  ['Only known notification rule IDs are accepted', /NOTIFICATION_RULE_IDS = new Set\(\['rule-warranty', 'rule-loan', 'rule-sla', 'rule-bast'\]\)/.test(server)],
  ['Mutation accepts a strict boolean only', /typeof req\.body\?\.is_active !== 'boolean'/.test(server)],
  ['Concurrent changes lock the setting row', /SELECT is_active FROM gabah_notification_rule_settings WHERE rule_id = \$1 FOR UPDATE/.test(server)],
  ['Status change and audit insert share one transaction', /withRbacTransaction\(async client =>[\s\S]*UPDATE gabah_notification_rule_settings[\s\S]*INSERT INTO gabah_notification_rule_audit/.test(server)],
  ['No-op updates do not create fake audit events', /if \(previous === next\)[\s\S]*return unchanged\.rows\[0\]/.test(server)],
  ['Settings are seeded enabled without overwriting existing state', /INSERT INTO gabah_notification_rule_settings[\s\S]*ON CONFLICT \(rule_id\) DO NOTHING/.test(migration)],
  ['Audit history is protected from update/delete/truncate', /CREATE TRIGGER gabah_notification_rule_audit_no_row_mutation[\s\S]*CREATE TRIGGER gabah_notification_rule_audit_no_truncate/.test(migration)],
  ['Frontend reads server settings through the API client', /getNotificationRuleSettings\(\)[\s\S]*\/api\/admin\/notification-rules/.test(api)],
  ['Frontend persists status through the API client', /updateNotificationRuleSetting\(ruleId: string, isActive: boolean\)[\s\S]*method: 'PATCH'/.test(api)],
  ['Frontend no longer reads or writes notification rules in localStorage', !/localStorage\.(getItem|setItem)\(['"]gabah_notification_rules['"]/.test(modal)],
  ['UI loads server settings before allowing toggles', /notificationRulesLoading \|\| !!notificationRulesError \|\| savingNotificationRuleId !== null/.test(modal)],
  ['UI updates state only after API success', /await gabahApi\.updateNotificationRuleSetting\(id, nextStatus === 'Aktif'\);[\s\S]*setNotificationRules\(previous/.test(modal)],
  ['Dashboard attention applies stored warranty, loan, and SLA switches', server.includes("app.get('/api/dashboard/attention', async") && server.includes("SELECT rule_id, is_active FROM gabah_notification_rule_settings") && server.includes("item.type === 'warranty_expiring'") && server.includes("item.type === 'loan_pending'") && server.includes("item.type === 'sla_breach'")],

  ['BAST rule is checked before the physical handover mutation', server.includes("app.post('/api/loans/:id/handover', async") && server.includes("rule-bast") && server.includes('GabahDomainService.handoverLoan')],
  ['BAST completion creates borrower and owner-division notifications', server.includes('recipient_user_id: handedOver.borrower_id') && server.includes('recipient_division: handedOver.owner_division')],

];
let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed++;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed ? 1 : 0);
