import fs from 'node:fs';

const auth = fs.readFileSync(new URL('../server/auth.ts', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const checks = [
  ['Default user serialization redacts Telegram ID and server-only authVersion', auth.includes('temp_password, telegram_chat_id, authVersion, ...safe')],
  ['Telegram chat ID requires explicit opt-in', auth.includes('options.includeTelegramChatId && telegram_chat_id') && auth.includes(': safe;')],
  ['User directory limits Telegram ID to Superadmin', server.includes('sanitizeUser(u, { includeTelegramChatId: isSuperadminActor(actor) })')],
  ['Admin create/import/edit responses explicitly opt in', server.includes('sanitizeUser(newUser, { includeTelegramChatId: true })') && server.includes('sanitizeUser(targetUser, { includeTelegramChatId: true })') && server.includes('sanitizeUser(u, { includeTelegramChatId: true })')],
];
let failed = 0;
for (const [name, pass] of checks) { console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name); if (!pass) failed += 1; }
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed === 0 ? 0 : 1);
