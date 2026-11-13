import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const clientDate = read('src/utils/datetime.ts');
const serverDate = read('server/time.ts');
const loanModal = read('src/components/modals/CreateLoanModal.tsx');
const businessDateFiles = [
  'src/App.tsx',
  'src/components/modals/CreateAssetModal.tsx',
  'src/components/modals/CreateContractModal.tsx',
  'src/components/modals/CreateRoomReservationModal.tsx',
  'src/components/views/MaintenanceView.tsx',
  'src/components/views/MeetingRoomsView.tsx',
  'server.ts',
  'server/db.ts',
  'server/services.ts',
  'src/services/gabahService.ts',
].map(read);

const checks = [
  ['browser business-date formatter uses Asia/Jakarta explicitly', /timeZone: BUSINESS_TIME_ZONE/.test(clientDate) && /BUSINESS_TIME_ZONE = 'Asia\/Jakarta'/.test(clientDate)],
  ['server business-date formatter uses Asia/Jakarta explicitly', /timeZone: BUSINESS_TIME_ZONE/.test(serverDate) && /BUSINESS_TIME_ZONE = 'Asia\/Jakarta'/.test(serverDate)],
  ['datetime-local loan requests are serialized with explicit +07:00 offset', /\+07:00/.test(clientDate) && /toJakartaIsoDateTime\(startDate\)/.test(loanModal) && /start_date: startDateIso/.test(loanModal) && /due_date: dueDateIso/.test(loanModal)],
  ['loan default start date uses Jakarta calendar date', /formatJakartaDate\(new Date\(Date\.now\(\) \+ 86400000\)\)/.test(loanModal)],
  ['all form defaults, server defaults, and CSV dates use business-date helpers', businessDateFiles.every(source => source.includes('formatJakartaDate'))],
  ['no UTC ISO date slicing remains in the audited form and server date paths', businessDateFiles.every(source => !/toISOString\(\)\.split\(['"]T['"]\)\[0\]/.test(source))],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
  if (!pass) failed++;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
assert.equal(failed, 0, 'Jakarta business-date contract failed.');
