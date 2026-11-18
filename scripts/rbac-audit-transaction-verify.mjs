import fs from 'node:fs';
const server = fs.readFileSync('server.ts', 'utf8');
const failures = [];
const assert = (name, condition) => { console.log(`${condition ? 'PASS' : 'FAIL'} — ${name}`); if (!condition) failures.push(name); };
const helperStart = server.indexOf('const insertRbacAudit = async');
const helperEnd = server.indexOf('const rbacFailure', helperStart);
const helper = server.slice(helperStart, helperEnd);
assert('RBAC audit helper inserts through active transaction client', helperStart >= 0 && helper.includes('client.query(') && helper.includes('INSERT INTO audit_logs'));
assert('RBAC audit helper records actor identity and request IP', helper.includes('actor.id') && helper.includes('actor.name') && helper.includes('actor.role') && helper.includes('requestIp || null'));
assert('RBAC audit IDs use collision-resistant UUID values', helper.includes("'LOG-' + crypto.randomUUID()"));
const routes = [
 {name:'role creation',start:"app.post('/api/admin/rbac/roles'",end:"app.patch('/api/admin/rbac/roles/:id'",action:'RBAC_ROLE_CREATED'},
 {name:'role update',start:"app.patch('/api/admin/rbac/roles/:id'",end:"app.delete('/api/admin/rbac/roles/:id'",action:'RBAC_ROLE_UPDATED'},
 {name:'role deletion',start:"app.delete('/api/admin/rbac/roles/:id'",end:"app.put('/api/admin/rbac/roles/:id/permissions'",action:'RBAC_ROLE_DELETED'},
 {name:'permission replacement',start:"app.put('/api/admin/rbac/roles/:id/permissions'",end:"app.put('/api/admin/rbac/roles/:id/scopes'",action:'RBAC_PERMISSIONS_UPDATED'},
 {name:'scope replacement',start:"app.put('/api/admin/rbac/roles/:id/scopes'",end:"app.put('/api/admin/rbac/users/:id/roles'",action:'RBAC_SCOPES_UPDATED'},
 {name:'user-role assignment replacement',start:"app.put('/api/admin/rbac/users/:id/roles'",end:'// API ROUTES (FIRST)',action:'RBAC_USER_ROLES_UPDATED'},
];
for (const route of routes) {
 const start=server.indexOf(route.start), end=server.indexOf(route.end,start+1), body=server.slice(start,end<0?undefined:end);
 const tx=body.indexOf('withRbacTransaction(async client =>'), audit=body.indexOf(`await insertRbacAudit(client, '${route.action}'`), txEnd=body.indexOf('});',tx);
 assert(`${route.name} audit insert is inside the mutation transaction`,start>=0&&tx>=0&&audit>tx&&audit<txEnd);
 assert(`${route.name} no longer uses fire-and-forget audit helper`,!body.includes('GabahDomainService.recordAudit'));
}
console.log(`RBAC audit transaction regression: ${15-failures.length}/15 checks passed.`);
if(failures.length) process.exit(1);
