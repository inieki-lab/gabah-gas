import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');

assert.match(server, /const isNotificationRecipient = \(actor: ServerUser, notification: any\): boolean =>/);
assert.match(server, /if \(notification\.recipient_user_id\) return notification\.recipient_user_id === actor\.id;/);
assert.match(server, /hasApplicationRole\(actor, primaryRoleKey\(notification\.recipient_role\)\)/);
assert.match(server, /if \(notification\.recipient_division\) return notification\.recipient_division === actor\.division;/);
assert.match(server, /const isRecipient = notif \? isNotificationRecipient\(actor, notif\) : false;/);
assert.match(server, /app\.patch\('\/api\/notifications\/:id\/read',[\s\S]*?requireRbacPermission\(req, res, 'notifications\.read'\)/);
assert.match(server, /app\.post\('\/api\/notifications\/read-all',[\s\S]*?requireRbacPermission\(req, res, 'notifications\.read_all'\)/);
assert.match(server, /const isRecipient = isNotificationRecipient\(actor, n\);/);
assert.match(server, /Recipient metadata is authoritative/);
assert.match(server, /db\.notifications\.filter\(n => isNotificationRecipient\(actor, n\)\)/);
assert.doesNotMatch(server, /isPhotoNotification && !hasApplicationRole\(actor, 'humas'\)/);
assert.equal(packageJson.scripts['test:notification-recipient-rbac'], 'node scripts/notification-recipient-rbac-verify.mjs');
assert.match(ci, /npm run test:notification-recipient-rbac/);

console.log('Notification recipient multi-role RBAC checks passed.');
