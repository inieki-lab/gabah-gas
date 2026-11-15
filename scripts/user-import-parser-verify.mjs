import assert from 'node:assert/strict';
import { parseUsersImportCsv } from '../src/services/gabahService.ts';

const roles = ['Admin GABAH', 'IT', 'GA', 'Karyawan', 'Auditor', 'Supply Chain', 'PIBC'];
const divisions = ['IT', 'GA', 'Umum', 'Audit'];
const jobLevels = ['STAF'];
const units = ['UNIT-SC', 'UNIT-PIBC'];
const offices = ['OFF-RPC', 'OFF-PIBC'];

const csv = [
  'Nama,Email,Role Utama,Divisi Referensi,Departemen,Telepon,Kode Jabatan,ID Unit,ID Lokasi Kantor',
  'Pegawai Umum,pegawai@example.test,Karyawan,Umum,Operasional,08123456789,STAF,UNIT-PIBC,OFF-PIBC',
  'Pegawai RPC,rpc@example.test,Supply Chain,Umum,Distribusi,,STAF,UNIT-SC,OFF-RPC',
  'Pegawai PIBC,pibc@example.test,PIBC,Umum,Pasar,,STAF,UNIT-PIBC,OFF-PIBC',
  'Pegawai Humas,humas@example.test,Humas,Umum,Humas,,,,',
  'Role Tidak Dikenal,unknown@example.test,Peran Ngawur,Umum,Operasional,,,,',
].join('\n');

const parsed = parseUsersImportCsv(csv, roles, divisions, jobLevels, units, offices);
assert.equal(parsed.valid.length, 3);
assert.equal(parsed.errors.length, 2);
assert.equal(parsed.valid[0].role, 'Karyawan');
assert.equal(parsed.valid[0].job_level_code, 'STAF');
assert.equal(parsed.valid[0].unit_id, 'UNIT-PIBC');
assert.equal(parsed.valid[1].role, 'Supply Chain', 'legacy SC alias is retained for server-side mapping');
assert.equal(parsed.valid[1].unit_id, 'UNIT-SC');
assert.equal(parsed.valid[1].office_location_id, 'OFF-RPC');
assert.equal(parsed.valid[2].role, 'PIBC', 'legacy PIBC alias is retained for server-side mapping');
assert.ok(parsed.errors.some(error => error.includes('Humas')));
assert.ok(parsed.errors.some(error => error.includes('Peran Ngawur')));

const invalidMasterCsv = [
  'Nama,Email,Role Utama,Divisi Referensi,Departemen,Telepon,Kode Jabatan,ID Unit,ID Lokasi Kantor',
  'Pegawai Invalid,invalid@example.test,Karyawan,Umum,Ops,,STAF,UNIT-NOT-FOUND,OFF-PIBC',
].join('\n');
const invalidMaster = parseUsersImportCsv(invalidMasterCsv, roles, divisions, jobLevels, units, offices);
assert.equal(invalidMaster.valid.length, 0);
assert.ok(invalidMaster.errors.some(error => error.includes('UNIT-NOT-FOUND')));

console.log('User import parser: 12 assertions passed');
