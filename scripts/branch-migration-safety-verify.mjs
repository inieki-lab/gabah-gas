import fs from 'node:fs';

const file = fs.readFileSync('server/migrations/026_map_branch_accounts_to_employee_location.sql', 'utf8');
const sql = file.replace(/--[^\n]*/g, '').trim();
const forbidden = /\b(UPDATE|DELETE|INSERT|MERGE|TRUNCATE|ALTER|DROP)\b/i;
const checks = [
  ['Migration 026 tidak menjalankan DML/DDL', !forbidden.test(sql)],
  ['Migration menjelaskan lokasi dan role sebagai dimensi terpisah', /Location is not an application role/i.test(file)],
  ['Migration mempertahankan role dan assignment sampai mapping terverifikasi', /retain their actual job level, unit, primary role/i.test(file)],
  ['Migration melarang scope otomatis dari lokasi', /location alone never grants/i.test(file)],
  ['Migration memberi peringatan untuk database yang pernah menjalankan versi lama', /already applied/i.test(file)],
];
for (const [name, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
const failed = checks.filter(([, pass]) => !pass).length;
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
process.exit(failed ? 1 : 0);
