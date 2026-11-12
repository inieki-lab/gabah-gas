import fs from 'node:fs';

const auth = fs.readFileSync(new URL('../server/auth.ts', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const sanitizeStart = auth.indexOf('export function sanitizeUser(');
const sanitizeEnd = auth.indexOf('\n}', sanitizeStart);
const sanitizer = sanitizeStart >= 0 && sanitizeEnd > sanitizeStart ? auth.slice(sanitizeStart, sanitizeEnd + 2) : '';

const checks = [
  ['Default user serialization destructures and omits Telegram chat ID', /telegram_chat_id/.test(sanitizer) && /: safe;/.test(sanitizer)],
  ['Telegram chat ID is returned only behind explicit include option', /options\.includeTelegramChatId && telegram_chat_id/.test(sanitizer)],
  ['Authentication/session serialization never includes Telegram ID', /const safe = sanitizeUser\(user\) as any;/.test(server) && /user: serializeAuthenticatedUser\(user\)/.test(server) && /data: serializeAuthenticatedUser\(actor\)/.test(server)],
  ['User directory includes Telegram ID only for Superadmin', /db\.users\.map\(u => sanitizeUser\(u, \{ includeTelegramChatId: isSuperadminActor\(actor\) \}\)\)/.test(server)],
  ['Admin-managed create/import/edit responses explicitly opt in', /sanitizeUser\(newUser, \{ includeTelegramChatId: true \}\)/.test(server) && /sanitizeUser\(targetUser, \{ includeTelegramChatId: true \}\)/.test(server) && /sanitizeUser\(u, \{ includeTelegramChatId: true \}\)/.test(server)],
  ['Role-switch response keeps Telegram ID redacted by default', /data: \{ user: sanitizeUser\(user\), token: session\.token/.test(server)],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed += 1;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed === 0 ? 0 : 1);
