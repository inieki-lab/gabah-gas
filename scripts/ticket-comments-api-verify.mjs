import fs from 'node:fs';
import assert from 'node:assert/strict';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../server/migrations/001_gabah_normalized_schema.sql', import.meta.url), 'utf8');

assert.match(migration, /CREATE TABLE IF NOT EXISTS ticket_comments[\s\S]*?ticket_id VARCHAR\(64\) NOT NULL REFERENCES tickets\(id\) ON DELETE CASCADE[\s\S]*?user_id VARCHAR\(64\) NOT NULL REFERENCES users\(id\)[\s\S]*?body TEXT NOT NULL/i);
const readStart = server.indexOf("app.get('/api/tickets/:id/comments'");
const writeStart = server.indexOf("app.post('/api/tickets/:id/comments'");
const nextRoute = server.indexOf("app.post('/api/tickets'", writeStart);
assert.ok(readStart >= 0 && writeStart > readStart && nextRoute > writeStart, 'comment routes must be registered before ticket creation route');
const commentRoutes = server.slice(readStart, nextRoute);
assert.match(commentRoutes, /requireRbacPermission\(req, res, 'tickets\.read'\)/);
assert.match(commentRoutes, /canAccessTicketRecord\(ticket, actor\)/);
assert.match(commentRoutes, /isAuditorActor\(actor\)/);
assert.match(commentRoutes, /hasRbacPermission\(String\(actor\.id\), 'tickets\.update'\)/);
assert.match(commentRoutes, /body\.trim\(\)\.length > 4000/);
assert.match(commentRoutes, /FROM ticket_comments c[\s\S]*INNER JOIN users u ON u\.id = c\.user_id/);
assert.match(commentRoutes, /INSERT INTO ticket_comments \(ticket_id, user_id, body\)/);
assert.match(commentRoutes, /withRbacTransaction/);
assert.match(commentRoutes, /__gabahPersisted\s*=\s*true/);
assert.match(commentRoutes, /TICKET_COMMENTS_REQUIRE_POSTGRES/);
console.log('PASS: ticket comments require ticket visibility, reporter/handler write authority, Auditor read-only, bounded input, and transactional PostgreSQL persistence.');

const apiClient = fs.readFileSync(new URL('../src/services/gabahApi.ts', import.meta.url), 'utf8');
const ticketView = fs.readFileSync(new URL('../src/components/views/TicketsView.tsx', import.meta.url), 'utf8');
assert.match(apiClient, /getTicketComments\(ticketId: string\)/);
assert.match(apiClient, /addTicketComment\(ticketId: string, body: string\)/);
assert.match(ticketView, /Lihat Diskusi \/ Komentar/);
assert.match(ticketView, /submitTicketComment/);
assert.match(ticketView, /!isReadOnly/);
assert.match(ticketView, /maxLength=\{4000\}/);
console.log('PASS: ticket discussion is reachable from the list UI and Auditor cannot submit comments.');
