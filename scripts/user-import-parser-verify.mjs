import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseUsersImportCsv } from '../src/services/gabahService.ts';

const roles = ['Admin GABAH', 'Superadmin', 'Karyawan', 'Supply Chain', 'SC', 'PIBC'];
const divisions = ['IT', 'GA', 'Umum', 'Audit'];
const jobLevels = ['STAF'];
const units = ['UNIT-SC', 'UNIT-PIBC'];
const offices = ['OFF-RPC', 'OFF-PIBC'];

const csv = [
  'Nama,Email,Role Utama,Divisi Referensi,Departemen,Telepon,Kode Jabatan,ID Unit,ID Lokasi Kantor',
  'Pegawai Umum,pegawai@example.test,Karyawan,Umum,Operasional,08123456789,STAF,,OFF-PIBC',
  'Pegawai RPC,rpc@example.test,Supply Chain,Umum,Distribusi,,STAF,,OFF-RPC',
  'Pegawai PIBC,pibc@example.test,PIBC,Umum,Pasar,,STAF,,OFF-PIBC',
  'Admin Legacy,superadmin@example.test,Superadmin,Umum,Admin,,STAF,,,',
  'Pegawai IT,it@example.test,IT,IT,Support,,,,',
  'Pegawai GA,ga@example.test,GA,GA,Sarpras,,,,',
  'Pegawai Auditor,auditor@example.test,Auditor,Audit,SPI,,,,',
  'Pegawai Humas,humas@example.test,Humas,Umum,Humas,,,,',
  'Pegawai Sekdir,sekdir@example.test,Sekretaris Direksi,Umum,Sekretariat,,,,',
  'Role Tidak Dikenal,unknown@example.test,Peran Ngawur,Umum,Operasional,,,,',
].join('\n');

const parsed = parseUsersImportCsv(csv, roles, divisions, jobLevels, units, offices);
assert.equal(parsed.valid.length, 4);
assert.equal(parsed.errors.length, 6);
assert.equal(parsed.valid[0].role, 'Karyawan');
assert.equal(parsed.valid[0].job_level_code, 'STAF');
assert.equal(parsed.valid[0].unit_id, undefined);
assert.equal(parsed.valid[1].role, 'Supply Chain', 'legacy SC alias is retained for server-side mapping');
assert.equal(parsed.valid[1].office_location_id, 'OFF-RPC');
assert.equal(parsed.valid[2].role, 'PIBC', 'legacy PIBC alias is retained for server-side mapping');
assert.equal(parsed.valid[2].unit_id, undefined);
assert.equal(parsed.valid[3].role, 'Superadmin', 'legacy Superadmin alias remains accepted for server-side normalization');
assert.ok(parsed.errors.some(error => error.includes('IT')));
assert.ok(parsed.errors.some(error => error.includes('GA')));
assert.ok(parsed.errors.some(error => error.includes('Auditor')));
assert.ok(parsed.errors.some(error => error.includes('Humas')));
assert.ok(parsed.errors.some(error => error.includes('Sekretaris Direksi')));
assert.ok(parsed.errors.some(error => error.includes('Peran Ngawur')));

const invalidMasterCsv = [
  'Nama,Email,Role Utama,Divisi Referensi,Departemen,Telepon,Kode Jabatan,ID Unit,ID Lokasi Kantor',
  'Pegawai Invalid,invalid@example.test,Karyawan,Umum,Ops,,STAF,UNIT-NOT-FOUND,OFF-PIBC',
].join('\n');
const invalidMaster = parseUsersImportCsv(invalidMasterCsv, roles, divisions, jobLevels, units, offices);
assert.equal(invalidMaster.valid.length, 0);
assert.ok(invalidMaster.errors.some(error => error.includes('UNIT-NOT-FOUND')));

console.log('User import parser: 12 assertions passed');

const administrationSource = fs.readFileSync('src/components/modals/AdministrationModal.tsx', 'utf8');
assert.match(administrationSource, /const validImportRoles = \[\.\.\.PRIMARY_PROFILE_ROLES\.map\(r => r\.value as string\), 'Superadmin', 'Supply Chain', 'SC', 'PIBC'\]/);
assert.doesNotMatch(administrationSource, /const validImportRoles = [^;]*(?:'IT'|'GA'|'Auditor'|'Humas'|'Sekretaris Direksi')/);
