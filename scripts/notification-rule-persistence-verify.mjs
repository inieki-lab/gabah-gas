import fs from 'node:fs';
import assert from 'node:assert/strict';

const server = fs.readFileSync('server.ts', 'utf8');
const api = fs.readFileSync('src/services/gabahApi.ts', 'utf8');
const modal = fs.readFileSync('src/components/modals/AdministrationModal.tsx', 'utf8');
const migration = fs.readFileSync('server/migrations/102_notification_rule_settings.sql', 'utf8');

const checks = [
  ['Notification settings reads require active Superadmin authorization', /app\.get\('\/api\/admin\/notification-rules'[\s\S]*?requireRbacSuperadmin\(req, res\)[\s\S]*?FROM gabah_notification_rule_settings/.test(server)],
  ['Notification settings writes require stable Superadmin authorization', /app\.patch\('\/api\/admin\/notification-rules\/:ruleId'[\s\S]*?requireRbacSuperadmin\(req, res\)/.test(server)],
  ['Only the four known notification rules can be changed', /NOTIFICATION_RULE_IDS = new Set\(\['rule-warranty', 'rule-loan', 'rule-sla', 'rule-bast'\]\)/.test(server) && ['rule-warranty', 'rule-loan', 'rule-sla', 'rule-bast'].every(id => migration.includes("'" + id + "'"))],
  ['Notification rule status accepts strict booleans only', /typeof req\.body\?\.is_active !== 'boolean'/.test(server)],
  ['Concurrent notification rule changes lock the current setting row', /SELECT is_active FROM gabah_notification_rule_settings WHERE rule_id = \$1 FOR UPDATE/.test(server)],
  ['Setting update and append-only audit insert share one RBAC transaction', /withRbacTransaction\(async client =>[\s\S]*?UPDATE gabah_notification_rule_settings[\s\S]*?INSERT INTO gabah_notification_rule_audit/.test(server)],
  ['No-op notification updates do not create false audit events', /if \(previous === next\)[\s\S]*?return unchanged\.rows\[0\]/.test(server)],
  ['Migration seeds defaults without overwriting existing operator choices', /INSERT INTO gabah_notification_rule_settings[\s\S]*?ON CONFLICT \(rule_id\) DO NOTHING/.test(migration)],
  ['Notification rule audit is protected from UPDATE, DELETE, and TRUNCATE', /CREATE TRIGGER gabah_notification_rule_audit_no_row_mutation[\s\S]*?BEFORE UPDATE OR DELETE[\s\S]*?CREATE TRIGGER gabah_notification_rule_audit_no_truncate[\s\S]*?BEFORE TRUNCATE/.test(migration)],
  ['API client exposes authenticated read and update operations', /getNotificationRuleSettings\(\)[\s\S]*?\/api\/admin\/notification-rules/.test(api) && /updateNotificationRuleSetting\(ruleId: string, isActive: boolean\)[\s\S]*?method: 'PATCH'/.test(api)],
  ['UI loads server rule state instead of assuming all rules are active', /useState<NotificationRule\[]>\(\[\]\)/.test(modal) && /getNotificationRuleSettings\(\)/.test(modal) && /setNotificationRules\(\[\]\)/.test(modal)],
  ['UI updates visible state only after the server confirms the change', /await gabahApi\.updateNotificationRuleSetting\(id, nextStatus === 'Aktif'\);[\s\S]*?setNotificationRules\(previous/.test(modal)],
  ['UI disables notification controls while loading, on error, and during a save', /disabled=\{notificationRulesLoading \|\| !!notificationRulesError \|\| savingNotificationRuleId !== null\}/.test(modal)],
  ['Dashboard attention applies persisted warranty, loan, and SLA switches', /app\.get\('\/api\/dashboard\/attention', async[\s\S]*?SELECT rule_id, is_active FROM gabah_notification_rule_settings[\s\S]*?item\.type === 'warranty_expiring'[\s\S]*?item\.type === 'loan_pending'[\s\S]*?item\.type === 'sla_breach'/.test(server)],
  ['BAST switch is checked before loan handover and notifications are in the atomic loan mutation', /app\.post\('\/api\/loans\/:id\/handover'[\s\S]*?rule-bast[\s\S]*?persistLoanMutation\(\(\) =>[\s\S]*?db\.notifications\.unshift/.test(server)],
  ['Legacy notification localStorage preview is removed', !/localStorage\.(?:getItem|setItem)\(['"]gabah_notification_rules['"]/.test(modal)],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed++;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed ? 1 : 0);
