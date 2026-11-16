import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');

assert.match(server, /const isNotificationRecipient = \(actor: ServerUser, notification: any\): boolean =>/);
assert.match(server, /if \(notification\.recipient_user_id\) return notification\.recipient_user_id === actor\.id;/);
assert.match(server, /const recipientRoleKey = normalizeRoleKey\(notification\.recipient_role\);[\s\S]*?if \(recipientRoleKey === 'humas' && isPostgresPersistenceActive\(\)\) \{[\s\S]*?hasRbacPermission\(String\(actor\.id\), 'room_reservations\.documentation\.read'\)[\s\S]*?return hasApplicationRole\(actor, recipientRoleKey\);/);
assert.match(server, /if \(notification\.recipient_division\) return notification\.recipient_division === actor\.division;/);
assert.match(server, /const isRecipient = notif \? isNotificationRecipient\(actor, notif\) : false;/);
assert.match(server, /const isRecipient = isNotificationRecipient\(actor, n\);/);
assert.match(server, /const canReadDocumentationNotifications = isPostgresPersistenceActive\(\)[\s\S]*?hasRbacPermission\(String\(actor\.id\), 'room_reservations\.documentation\.read'\)[\s\S]*?hasApplicationRole\(actor, 'humas'\)/);
assert.match(server, /if (isPhotoNotification && !canReadDocumentationNotifications && !isSuperadminActor\(actor\)\) return false;/);
assert.match(server, /Production checks only explicit database role assignments/);
assert.equal(packageJson.scripts['test:notification-recipient-rbac'], 'node scripts/notification-recipient-rbac-verify.mjs');
assert.match(ci, /npm run test:notification-recipient-rbac/);

console.log('Notification recipient multi-role RBAC checks passed.');
