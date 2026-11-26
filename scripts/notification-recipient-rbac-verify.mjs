import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const routes = server.slice(server.indexOf('  // Notifications'), server.indexOf('  // Dashboard Stats & Attention Center'));

assert.match(server, /const notificationRoleKey = \(label: string\): string =>/);
assert.match(server, /const isNotificationRecipient = \(actor: ServerUser, notification: any\): boolean =>/);
assert.match(server, /if \(notification\.recipient_user_id\) return notification\.recipient_user_id === actor\.id;/);
assert.match(server, /hasApplicationRole\(actor, notificationRoleKey\(notification\.recipient_role\)\)/);
assert.match(server, /if \(notification\.recipient_division\) return notification\.recipient_division === actor\.division;/);
assert.match(routes, /app\.patch\('\/api\/notifications\/:id\/read', async \(req, res\) => \{[\s\S]*?requireRbacPermission\(req, res, 'notifications\.read'\)/);
assert.match(routes, /app\.post\('\/api\/notifications\/read-all', async \(req, res\) => \{[\s\S]*?requireRbacPermission\(req, res, 'notifications\.read_all'\)/);
assert.match(routes, /notif\.is_read = true;[\s\S]*?await persistDataStore\(\);/);
assert.match(routes, /n\.is_read = true;[\s\S]*?await persistDataStore\(\);/);
assert.doesNotMatch(routes, /isPhotoNotification|title\.toLowerCase\(\).*humas|message\.toLowerCase\(\).*humas/);

console.log('Notification recipient RBAC contract: PASS (multi-role recipient, self-read vs read-all, persistence, metadata-only scope)');
