import fs from 'node:fs';

const service = fs.readFileSync('server/services.ts', 'utf8');
const createTicket = service.slice(service.indexOf('static createTicket('), service.indexOf('Dashboard Attention Center Query'));
const checks = [
  ['IT routing runs only in PostgreSQL-backed mode', /payload\.category === 'IT' && isPostgresPersistenceActive\(\)/.test(createTicket)],
  ['Only active users with tickets.update and explicit IT ticket scope qualify', /db\.users\.filter\(user =>[\s\S]*?user\.is_active !== false[\s\S]*?hasRbacPermission\(String\(user\.id\), 'tickets\.update'\)[\s\S]*?hasRbacScope\(String\(user\.id\), 'division', 'IT', 'tickets'\)/.test(createTicket)],
  ['A single eligible IT agent is assigned directly and ticket becomes assigned', /eligibleAgents\.length === 1[\s\S]*?newTicket\.assigned_agent_id = directItAgent\.id[\s\S]*?newTicket\.status = 'assigned'/.test(createTicket)],
  ['Zero or multiple eligible agents are not assigned arbitrarily', /eligibleAgents\.length === 1/.test(createTicket) && !/eligibleAgents\[Math\.random/.test(createTicket)],
  ['Direct IT ticket notification targets the assigned support user', /recipient_user_id: directItAgent\?\.id[\s\S]*?recipient_role: directItAgent \? undefined : targetDivision[\s\S]*?recipient_division: directItAgent \? undefined : targetDivision/.test(createTicket)],
  ['Non-IT ticket categories retain their existing division queue notification', /const targetDivision = payload\.category[\s\S]*?recipient_role: directItAgent \? undefined : targetDivision/.test(createTicket)],
];

for (const [name, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
const failed = checks.filter(([, pass]) => !pass);
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed.length} | FAIL: ${failed.length}`);
if (failed.length) process.exit(1);
