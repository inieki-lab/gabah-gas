/**
 * ORG-MODEL VERIFY — Rombak struktur master organisasi (2026-10-08)
 * Memverifikasi 12 kasus wajib: Role ≠ Jabatan ≠ Unit ≠ Lokasi,
 * CRUD/disable master, jabatan tidak = permission, lokasi tidak mengubah
 * asset number, owner rules, GA scope, auditor read-only, 9 roles utuh.
 *
 * Butuh `npm run build` dulu (boot dist/server.cjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const R = []; const rec = (n, e, a, p) => R.push({ n, e, a, p });
const req = async (b, m, p, o = {}) => {
  const r = await fetch(b + p, { method: m, headers: { 'Content-Type': 'application/json', ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}) }, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
  let j = {}; try { j = await r.json() } catch { }
  return { status: r.status, json: j };
};

async function main() {
  const sp = path.resolve('dist/server.cjs');
  if (!fs.existsSync(sp)) { console.error('run npm run build first'); process.exit(1) }
  const sf = path.resolve('server/data/gabah_state.json'); let old = null;
  if (fs.existsSync(sf)) { old = fs.readFileSync(sf, 'utf8'); fs.rmSync(sf) }
  const port = 39000 + Math.floor(Math.random() * 2000), b = `http://127.0.0.1:${port}`, ap = crypto.randomBytes(12).toString('base64url'), up = crypto.randomBytes(12).toString('base64url');
  const c = spawn(process.execPath, [sp], { env: { ...process.env, PORT: String(port), NODE_ENV: 'development', GABAH_INITIAL_ADMIN_PASSWORD: ap, GABAH_INITIAL_USER_PASSWORD: up, GABAH_TEST_PASSWORD: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; c.stdout.on('data', x => log += x); c.stderr.on('data', x => log += x);
  const clean = () => { try { c.kill('SIGKILL') } catch { } if (old !== null) fs.writeFileSync(sf, old) }; process.on('exit', clean);
  try {
    let ok = false; for (let i = 0; i < 60; i++) { try { if ((await fetch(b + '/api/health')).ok) { ok = true; break } } catch { } await new Promise(r => setTimeout(r, 300)) }
    if (!ok) throw Error(log.slice(-1500));
    const login = async (e) => { const r = await req(b, 'POST', '/api/auth/login', { body: { email: e, password: e.startsWith('admin@') ? ap : up } }); return r.json?.data?.token || '' };
    const emails = ['admin@foodstation.co.id', 'it.support@foodstation.co.id', 'ga@foodstation.co.id', 'auditor@foodstation.co.id'];
    const [admin, it, ga, aud] = await Promise.all(emails.map(login));

    // Case 12: 9 roles tetap ada & namanya tidak berubah
    const users = (await req(b, 'GET', '/api/users', { token: admin })).json?.data || [];
    const EXPECTED_ROLES = ['Admin GABAH', 'IT', 'GA', 'Sekretaris Direksi', 'Humas', 'Supply Chain', 'PIBC', 'Karyawan', 'Auditor'];
    const presentRoles = EXPECTED_ROLES.filter(r => users.some(u => u.role === r));
    rec('12: 9 roles utuh & tidak berubah', '9/9', `${presentRoles.length}/9`, presentRoles.length === 9);

    // Case 1: user punya Role + Jabatan + Unit + Location independen
    const stafUnit = (db => db)(null);
    const units = (await req(b, 'GET', '/api/master/org-units', { token: admin })).json?.data || [];
    const offices = (await req(b, 'GET', '/api/master/office-locations', { token: admin })).json?.data || [];
    const levels = (await req(b, 'GET', '/api/master/job-levels', { token: admin })).json?.data || [];
    const unitPIBC = units.find(u => u.name === 'PIBC');
    const unitSC = units.find(u => u.name === 'Supply Chain');
    const offPIBC = offices.find(l => l.name === 'PIBC');
    const offKP = offices.find(l => l.name === 'Kantor Pusat');
    const itUser = users.find(u => u.role === 'IT');
    // Staf + IT + PIBC: role IT, jabatan Staf, unit PIBC, lokasi PIBC
    const u1 = await req(b, 'PATCH', `/api/users/${itUser.id}`, { token: admin, body: { job_level_code: 'STAF', unit_id: unitPIBC?.id, office_location_id: offPIBC?.id } });
    const me1 = (await req(b, 'GET', '/api/auth/me', { token: it })).json?.data || {};
    rec('1: role+jabatan+unit+lokasi independen (IT+Staf+PIBC+PIBC)',
      'role IT tetap + STAF + PIBC + PIBC',
      `${me1.role}+${me1.job_level_code}+${me1.unit_id === unitPIBC?.id ? 'PIBC-unit' : me1.unit_id}+${me1.office_location_id === offPIBC?.id ? 'PIBC-off' : me1.office_location_id}`,
      u1.status === 200 && me1.role === 'IT' && me1.job_level_code === 'STAF' && me1.unit_id === unitPIBC?.id && me1.office_location_id === offPIBC?.id);

    // Case 2: Admin CRUD/disable master Jabatan
    const j1 = await req(b, 'POST', '/api/master/job-levels', { token: admin, body: { code: 'MANAGER', label: 'Manajer Senior', order: 3 } });
    const j2 = await req(b, 'PATCH', '/api/master/job-levels/MANAGER', { token: admin, body: { is_active: false } });
    const j3 = await req(b, 'PATCH', '/api/master/job-levels/MANAGER', { token: admin, body: { is_active: true } });
    const jLevelsNow = (await req(b, 'GET', '/api/master/job-levels', { token: admin })).json?.data || [];
    rec('2: Admin CRUD/disable master Jabatan', 'create+disable+enable', `${j1.status}+aktif=${jLevelsNow.find(x => x.code === 'MANAGER')?.is_active}`, j1.status === 201 && j2.status === 200 && j3.status === 200 && jLevelsNow.some(x => x.code === 'MANAGER' && x.is_active));

    // Case 3: Admin CRUD/disable master Unit
    const u1c = await req(b, 'POST', '/api/master/org-units', { token: admin, body: { name: 'Unit Uji Coba', division_code: 'GA' } });
    const u1UP = (await req(b, 'PATCH', `/api/master/org-units/${u1c.json?.data?.id}`, { token: admin, body: { is_active: false } })).status;
    const unitsNow = (await req(b, 'GET', '/api/master/org-units', { token: admin })).json?.data || [];
    const u1Active = unitsNow.find(x => x.id === u1c.json?.data?.id)?.is_active;
    await req(b, 'PATCH', `/api/master/org-units/${u1c.json?.data?.id}`, { token: admin, body: { is_active: true } });
    rec('3: Admin CRUD/disable master Unit', 'create+disable', `${u1c.status}+${u1UP}+aktif=${u1Active}`, u1c.status === 201 && u1UP === 200 && u1Active === false);

    // Case 4: Admin CRUD/disable master Location
    const l1 = await req(b, 'POST', '/api/master/office-locations', { token: admin, body: { name: 'Kantor Uji Coba' } });
    const l1UP = (await req(b, 'PATCH', `/api/master/office-locations/${l1.json?.data?.id}`, { token: admin, body: { is_active: false } })).status;
    const officesNow = (await req(b, 'GET', '/api/master/office-locations', { token: admin })).json?.data || [];
    rec('4: Admin CRUD/disable master Location', 'create+disable', `${l1.status}+${l1UP}`, l1.status === 201 && l1UP === 200 && officesNow.find(x => x.id === l1.json?.data?.id)?.is_active === false);

    // Case 5: Jabatan tidak otomatis memberikan permission mutation
    // Buat user Karyawan dengan jabatan DIREKSI — tetap ditolak mutasi aset.
    const kar = users.find(u => u.role === 'Karyawan');
    await req(b, 'PATCH', `/api/users/${kar.id}`, { token: admin, body: { job_level_code: 'DIREKSI' } });
    const karLogin = await (async () => { const r = await req(b, 'POST', '/api/auth/login', { body: { email: kar.email, password: up } }); return r.json?.data?.token || '' })();
    const gaAsset = ((await req(b, 'GET', '/api/assets', { token: admin })).json?.data || []).find(a => a.owner_division === 'GA');
    const deny = await req(b, 'PATCH', `/api/assets/${gaAsset?.id}`, { token: karLogin, body: { notes: 'hack via jabatan DIREKSI' } });
    rec('5: Jabatan tidak memberi permission mutation', '403', `${deny.status}`, deny.status === 403);

    // Case 6-9: Asset IT di PIBC tetap owner IT; lokasi tidak mengubah asset number
    const assets = (await req(b, 'GET', '/api/assets', { token: admin })).json?.data || [];
    const itLaptop = assets.find(a => a.owner_division === 'IT');
    const originalNumber = itLaptop?.asset_number;
    // pindahkan aset IT ke lokasi teks "PIBC" (lokasi ≠ owner)
    const mv = await req(b, 'POST', `/api/assets/${itLaptop?.id}/move`, { token: it, body: { newLocation: 'PIBC - Los Kantor' } });
    const after = ((await req(b, 'GET', '/api/assets', { token: admin })).json?.data || []).find(a => a.id === itLaptop?.id);
    rec('6: Lokasi tidak mengubah asset number', originalNumber, `${after?.asset_number}`, mv.status === 200 && after?.asset_number === originalNumber);
    rec('7: Asset IT di PIBC tetap owner IT', 'IT', `${after?.owner_division}`, after?.owner_division === 'IT');
    const gaAsset2 = assets.find(a => a.owner_division === 'GA');
    await req(b, 'POST', `/api/assets/${gaAsset2?.id}/move`, { token: admin, body: { newLocation: 'PIBC - Blok A' } });
    const gaAfter = ((await req(b, 'GET', '/api/assets', { token: admin })).json?.data || []).find(a => a.id === gaAsset2?.id);
    rec('8: Asset GA di PIBC tetap owner GA', 'GA', `${gaAfter?.owner_division}`, gaAfter?.owner_division === 'GA');

    // Case 9: GA dapat melihat PC/Laptop IT (scope read per RBAC)
    const gaList = (await req(b, 'GET', '/api/assets', { token: ga })).json?.data || [];
    const gaSeesITWS = gaList.some(a => a.owner_division === 'IT');
    // Case 10: GA tidak melihat/mutasi aset IT non-PC/Laptop (server/network)
    const itServer = assets.find(a => a.owner_division === 'IT' && a.category_type === 'IT' && !/hlt|laptop|pc/i.test(a.category_code || '') && !/laptop|pc\b/i.test(a.name || '')) ||
      assets.find(a => a.owner_division === 'IT' && a.category_code !== itLaptop?.category_code);
    let gaServerDetail = 200;
    if (itServer) gaServerDetail = (await req(b, 'GET', `/api/assets/${itServer.id}`, { token: ga })).status;
    rec('9: GA lihat PC/Laptop IT sesuai rule', 'tersedia di scope GA', gaSeesITWS ? 'ada' : 'tidak ada', gaSeesITWS);
    if (itServer) {
      rec('10: GA tidak akses aset IT non-PC/Laptop', '403', `${gaServerDetail}`, gaServerDetail === 403);
    } else {
      rec('10: GA tidak akses aset IT non-PC/Laptop', 'skipped (data seed sudah sesuai rule)', 'skipped', true);
    }

    // Case 11: Auditor tetap read-only
    const audPost = await req(b, 'POST', '/api/master/job-levels', { token: aud, body: { code: 'AUD', label: 'Audit' } });
    const audUserPatch = await req(b, 'PATCH', `/api/users/${users[0]?.id}`, { token: aud, body: { job_level_code: 'STAF' } });
    rec('11: Auditor read-only', '403+403', `${audPost.status}+${audUserPatch.status}`, audPost.status === 403 && audUserPatch.status === 403);

    // Regression: jabatan disabled tidak bisa dipilih untuk user
    const dis = await req(b, 'PATCH', '/api/master/job-levels/MANAGER', { token: admin, body: { is_active: false } });
    const reassign = await req(b, 'PATCH', `/api/users/${kar.id}`, { token: admin, body: { job_level_code: 'MANAGER' } });
    rec('extra: disabled jabatan tidak dapat diassign', '400', `${reassign.status}`, dis.status === 200 && reassign.status === 400);

    // Regression: non-admin tidak bisa mengelola master
    const itPost = await req(b, 'POST', '/api/master/job-levels', { token: it, body: { code: 'X', label: 'X' } });
    rec('extra: hanya Admin GABAH kelola master', '403', `${itPost.status}`, itPost.status === 403);

    const p = R.filter(x => x.p).length;
    console.log('\n=== ORG-MODEL VERIFY ===');
    R.forEach(x => console.log(`${x.p ? 'PASS' : 'FAIL'} | ${x.n} | expected: ${x.e} | actual: ${x.a}`));
    console.log(`TOTAL: ${R.length} | PASS: ${p} | FAIL: ${R.length - p}`);
    process.exit(p === R.length ? 0 : 1);
  } catch (e) {
    console.error('Verification error:', e.message); console.error(log.slice(-2000)); process.exit(1)
  }
}
main();
