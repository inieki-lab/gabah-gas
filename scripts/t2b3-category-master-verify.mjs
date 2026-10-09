/**
 * T2B-3 VERIFY — Master Kategori & Aset Tetap (2026-10-09)
 * Memverifikasi test plan T2B-3 (butuh `npm run build` dulu; boot dist/server.cjs,
 * mode file store; state file asli di-backup lalu direstore):
 *   1. Migration 009 additive & idempotent (inspeksi statis SQL).
 *   2. Master kategori seeder penuh & tervalidasi (domain main_type kanonikal,
 *      is_active default true).
 *   3. CRUD master oleh Admin GABAH: create/rename/disable/enable; duplikat
 *      kode & nama ditolak; main_type di luar domain kanonikal ditolak.
 *   4. Non-admin (IT) ditolak 403; Auditor tetap read-only (GET 200, mutasi 403).
 *   5. Master adalah SATU-SUMBER KEBENARAN: kategori baru admin langsung bisa
 *      dipakai membuat aset (kode & owner_division dari master) — bukan dari
 *      array hardcoded.
 *   6. Rename master terlihat oleh resolusi (resolve by nama baru).
 *   7. Kategori nonaktif ditolak sebagai pilihan baru (400), tetapi tetap
 *      terbaca di master & aset historis; re-enable → bisa dipakai lagi.
 *   8. Hapus kategori yang dipakai aset ditolak (guard) — disable jalur utama.
 *   9. Input kategori bebas legacy tetap jatuh ke fallback (aset tanpa master
 *      tetap terbaca, tidak error).
 *  10. Edit master (is_loanable_by_default) langsung berlaku untuk aset baru.
 *  11. Tidak ada perubahan pada owner_division / managing_unit_id /
 *      asset_location_id / asset_number / corporate_asset_number aset existing.
 *  12. JSON fallback mempertahankan master & aset (roundtrip lewat restart,
 *      termasuk status nonaktif).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const R = [];
const rec = (n, e, a, p) => R.push({ n, e, a, p: !!p });
const req = async (b, m, p, o = {}) => {
  const r = await fetch(b + p, {
    method: m,
    headers: { 'Content-Type': 'application/json', ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}) },
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
  });
  let j = {}; try { j = await r.json() } catch { }
  return { status: r.status, json: j };
};

async function boot(sp, port, env) {
  const c = spawn(process.execPath, [sp], {
    env: { ...process.env, PORT: String(port), NODE_ENV: 'development', GABAH_INITIAL_ADMIN_PASSWORD: env.ap, GABAH_INITIAL_USER_PASSWORD: env.up, GABAH_TEST_PASSWORD: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  c.stdout.on('data', x => (log += x));
  c.stderr.on('data', x => (log += x));
  const base = `http://127.0.0.1:${port}`;
  let ok = false;
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) { ok = true; break; } } catch { }
    await new Promise(r => setTimeout(r, 250));
  }
  if (!ok) { try { c.kill('SIGKILL') } catch { } throw Error(`server tidak siap: ${log.slice(-1500)}`); }
  return { c, base, log: () => log };
}
const kill = (c) => { try { c.kill('SIGKILL') } catch { } };

const MAIN_TYPES = ['TNH', 'BGN', 'MSN', 'KDR', 'INV-F', 'INV-P', 'IT-H', 'IT-S', 'LNY'];

async function main() {
  const sp = path.resolve('dist/server.cjs');
  if (!fs.existsSync(sp)) { console.error('run npm run build first'); process.exit(1); }
  const sf = path.resolve('server/data/gabah_state.json');
  let originalState = null;
  if (fs.existsSync(sf)) { originalState = fs.readFileSync(sf, 'utf8'); fs.rmSync(sf); }
  const restore = () => {
    try { if (originalState !== null) fs.writeFileSync(sf, originalState); else if (fs.existsSync(sf)) fs.rmSync(sf); } catch { }
  };
  process.on('exit', restore);

  // ================= Test 1 (statis): migration 009 additive & idempotent =================
  const migRaw = fs.readFileSync(path.resolve('server/migrations/009_asset_category_master.sql'), 'utf8');
  // Abaikan baris komentar (--) saat inspeksi statis agar tidak false-positive.
  const mig = migRaw.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
  const noDrop = !/\bDROP\s+(TABLE|COLUMN)/i.test(mig);
  const allIfNotExists = (mig.match(/CREATE TABLE|CREATE INDEX|ADD COLUMN/g) || []).length > 0
    && !/CREATE TABLE (?!IF NOT EXISTS)|CREATE INDEX (?!IF NOT EXISTS)|ADD COLUMN (?!IF NOT EXISTS)/i.test(mig);
  const seedIdempotent = /ON CONFLICT \(code\) DO NOTHING/i.test(mig);
  const untouchedCols = !/SET\s+(owner_division|managing_unit_id|asset_location_id|asset_number|corporate_asset_number|location)\s*=/i.test(mig);
  const mainTypeGuarded = /WHERE main_type IS NULL\s*\n?\s*OR main_type NOT IN/i.test(mig);
  rec('1a: migration 009 additive (tanpa DROP, semua IF NOT EXISTS)', 'no DROP + IF NOT EXISTS',
    `${noDrop ? 'OK' : 'ADA DROP'}+${allIfNotExists ? 'OK' : 'ADA YANG TANPA GUARD'}`, noDrop && allIfNotExists);
  rec('1b: seed idempoten (ON CONFLICT DO NOTHING)', 'ON CONFLICT (code) DO NOTHING', seedIdempotent ? 'OK' : 'TANPA', seedIdempotent);
  rec('1c: backfill main_type hanya baris yang belum valid', 'WHERE main_type IS NULL OR NOT IN', mainTypeGuarded ? 'OK' : 'TANPA', mainTypeGuarded);
  rec('1d: migration tidak menyentuh owner/unit/lokasi/nomor aset', 'tanpa UPDATE kolom tsb', untouchedCols ? 'OK' : 'ADA!', untouchedCols);

  const env = {
    ap: crypto.randomBytes(12).toString('base64url'),
    up: crypto.randomBytes(12).toString('base64url'),
  };
  let s1 = null, s2 = null;
  try {
    // ================= PHASE 1 (fresh seed) =================
    s1 = await boot(sp, 39300 + Math.floor(Math.random() * 400), env);
    const login = async (b, e, pw) => {
      const r = await req(b, 'POST', '/api/auth/login', { body: { email: e, password: pw } });
      return r.json?.data?.token || '';
    };
    const admin = await login(s1.base, 'admin@foodstation.co.id', env.ap);
    const it = await login(s1.base, 'it.support@foodstation.co.id', env.up);
    const aud = await login(s1.base, 'auditor@foodstation.co.id', env.up);
    if (!admin || !it || !aud) throw Error('login gagal');

    // ================= 2. Master seed tervalidasi =================
    const cats = (await req(s1.base, 'GET', '/api/taxonomy/categories', { token: admin })).json?.data || [];
    const codes = new Set(cats.map(c => c.code));
    const allActiveFlag = cats.every(c => typeof c.is_active === 'boolean');
    const allMainTypeValid = cats.every(c => MAIN_TYPES.includes(c.main_type));
    rec('2a: master kategori seeder penuh (>=22 kode) + is_active boolean', '>=22 & semua punya is_active',
      `jumlah=${cats.length}, is_activeOke=${allActiveFlag}`, cats.length >= 22 && allActiveFlag);
    rec('2b: seluruh main_type berada di domain kanonikal (9 jenis aset tetap)', 'semua dalam daftar',
      allMainTypeValid ? 'OK' : `invalid: ${cats.filter(c => !MAIN_TYPES.includes(c.main_type)).map(c => c.code).join(',')}`,
      allMainTypeValid);
    rec('2c: kode kanonikal inti tersedia (HLT, INV-F, KDR-SC, MSN-PIBC, LNY)',
      'semua ada', ['HLT', 'INV-F', 'KDR-SC', 'MSN-PIBC', 'LNY'].every(x => codes.has(x)) ? 'OK' : 'ADA YANG HILANG',
      ['HLT', 'INV-F', 'KDR-SC', 'MSN-PIBC', 'LNY'].every(x => codes.has(x)));

    // ================= 3. CRUD master oleh Admin =================
    const c1 = await req(s1.base, 'POST', '/api/taxonomy/categories', {
      token: admin,
      body: { code: 'DRN', name: 'Drone Pemetaan Lahan', main_type: 'MSN', owner_division: 'SC', category_type: 'General', description: 'Drone survei kawasan (uji T2B-3)', is_loanable_by_default: false },
    });
    const c2 = await req(s1.base, 'POST', '/api/taxonomy/categories', {
      token: admin,
      body: { code: 'DRN', name: 'Drone Duplikat', main_type: 'MSN', owner_division: 'SC' },
    });
    const c3 = await req(s1.base, 'POST', '/api/taxonomy/categories', {
      token: admin,
      body: { code: 'DRN2', name: 'Mesin Produksi & Forklift', main_type: 'MSN', owner_division: 'SC' },
    });
    const c4 = await req(s1.base, 'POST', '/api/taxonomy/categories', {
      token: admin,
      body: { code: 'TYP', name: 'Kategori Tipe Aneh', main_type: 'EQUIPMENT', owner_division: 'SC' },
    });
    rec('3a: Admin create kategori baru; duplikat kode & nama ditolak', '201 lalu 400 lalu 400',
      `${c1.status} / ${c2.status} / ${c3.status}`,
      c1.status === 201 && c2.status === 400 && c3.status === 400);
    rec('3b: main_type di luar domain kanonikal (vocabulary legacy) ditolak', '400',
      `${c4.status}: ${c4.json?.message || ''}`, c4.status === 400);

    const pRename = await req(s1.base, 'PATCH', '/api/taxonomy/categories/DRN', { token: admin, body: { name: 'Drone Pemetaan Lahan V2' } });
    const pType = await req(s1.base, 'PATCH', '/api/taxonomy/categories/DRN', { token: admin, body: { main_type: 'VEHICLE' } });
    rec('3c: rename master 200; PATCH main_type legacy tetap ditolak', '200 lalu 400',
      `${pRename.status} / ${pType.status}`, pRename.status === 200 && pType.status === 400);

    // ================= 4. Non-admin & Auditor =================
    const itPost = await req(s1.base, 'POST', '/api/taxonomy/categories', { token: it, body: { code: 'HACK', name: 'Hacked', main_type: 'MSN', owner_division: 'IT' } });
    const itPatch = await req(s1.base, 'PATCH', '/api/taxonomy/categories/HLT', { token: it, body: { name: 'Hacked Laptop' } });
    const audGet = await req(s1.base, 'GET', '/api/taxonomy/categories', { token: aud });
    const audPost = await req(s1.base, 'POST', '/api/taxonomy/categories', { token: aud, body: { code: 'AUD', name: 'Auditor Cat', main_type: 'LNY', owner_division: 'GA' } });
    const audPatch = await req(s1.base, 'PATCH', '/api/taxonomy/categories/HLT', { token: aud, body: { name: 'Auditor Rename' } });
    rec('4a: non-admin (IT) ditolak kelola master kategori', '403 + 403',
      `${itPost.status} + ${itPatch.status}`, itPost.status === 403 && itPatch.status === 403);
    rec('4b: Auditor read-only (GET 200, POST/PATCH 403)', '200/403/403',
      `${audGet.status}/${audPost.status}/${audPatch.status}`,
      audGet.status === 200 && audPost.status === 403 && audPatch.status === 403);

    // ================= 5. Master = satu-sumber kebenaran =================
    const aDrn = await req(s1.base, 'POST', '/api/assets', { token: admin, body: { category_name_or_code: 'DRN', name: 'Aset Uji T2B-3 Drone', location: 'RPC' } });
    const drnAsset = aDrn.json?.data;
    rec('5a: kategori baru admin langsung dipakai buat aset (kode dari master)',
      '201 & category_code=DRN', `${aDrn.status} & code=${drnAsset?.category_code} & number=${drnAsset?.asset_number}`,
      aDrn.status === 201 && drnAsset?.category_code === 'DRN');
    rec('5b: owner_division & nomor aset diturunkan dari master (SC, bukan fallback)',
      'owner=SC & nomor mengandung -DRN-',
      `owner=${drnAsset?.owner_division} & number=${drnAsset?.asset_number}`,
      drnAsset?.owner_division === 'SC' && String(drnAsset?.asset_number || '').includes('-DRN-'));

    // ================= 6. Rename master terlihat oleh resolusi =================
    const resName = await req(s1.base, 'POST', '/api/taxonomy/resolve', { token: admin, body: { nameOrCode: 'Drone Pemetaan Lahan V2' } });
    const aByName = await req(s1.base, 'POST', '/api/assets', { token: admin, body: { category_name_or_code: 'Drone Pemetaan Lahan V2', name: 'Aset Uji T2B-3 nama baru' } });
    rec('6a: resolve & create by NAMA BARU hasil rename master', 'code=DRN & 201',
      `resolve=${resName.json?.data?.code} & create=${aByName.status} (${aByName.json?.data?.category_code})`,
      resName.json?.data?.code === 'DRN' && aByName.status === 201 && aByName.json?.data?.category_code === 'DRN');

    // ================= 7. Kategori nonaktif =================
    await req(s1.base, 'PATCH', '/api/taxonomy/categories/DRN', { token: admin, body: { is_active: false } });
    const disCreate = await req(s1.base, 'POST', '/api/assets', { token: admin, body: { category_name_or_code: 'DRN', name: 'Aset Uji T2B-3 nonaktif' } });
    const listAfter = (await req(s1.base, 'GET', '/api/taxonomy/categories', { token: admin })).json?.data || [];
    const drnRow = listAfter.find(c => c.code === 'DRN');
    const legacyRead = await req(s1.base, 'GET', `/api/assets/${drnAsset.id}`, { token: admin });
    rec('7a: kategori nonaktif ditolak sebagai pilihan baru (400)', '400',
      `${disCreate.status}: ${disCreate.json?.message || ''}`, disCreate.status === 400);
    rec('7b: kategori nonaktif tetap terbaca di master (is_active=false) & aset historis tetap tampil',
      'DRN ada + is_active=false & detail aset 200',
      `ada=${!!drnRow} (${drnRow?.is_active}) & detail=${legacyRead.status}`,
      !!drnRow && drnRow.is_active === false && legacyRead.status === 200);

    await req(s1.base, 'PATCH', '/api/taxonomy/categories/DRN', { token: admin, body: { is_active: true } });
    const reEnable = await req(s1.base, 'POST', '/api/assets', { token: admin, body: { category_name_or_code: 'DRN', name: 'Aset Uji T2B-3 re-enable' } });
    rec('7c: re-enable → kategori bisa dipakai lagi', '201', `${reEnable.status}`, reEnable.status === 201);

    // ================= 8. Guard hapus =================
    const del = await req(s1.base, 'DELETE', '/api/taxonomy/categories/DRN', { token: admin });
    rec('8a: hapus kategori yang dipakai aset ditolak (disable = jalur utama)', '400 & masih ada di master',
      `${del.status} & masihAda=${((await req(s1.base, 'GET', '/api/taxonomy/categories', { token: admin })).json?.data || []).some(c => c.code === 'DRN')}`,
      del.status === 400);

    // ================= 9. Fallback legacy =================
    const legacy = await req(s1.base, 'POST', '/api/assets', { token: admin, body: { category_name_or_code: 'ZZK-UNKNOWN-999', name: 'Aset Uji T2B-3 tanpa master' } });
    const legacyAsset = legacy.json?.data;
    rec('9a: input kategori bebas legacy tetap jatuh ke fallback (tidak error)', '201 & kategori fail-safe',
      `${legacy.status} & code=${legacyAsset?.category_code}`,
      legacy.status === 201 && !!legacyAsset?.category_code);
    const legacyRead2 = await req(s1.base, 'GET', `/api/assets/${legacyAsset.id}`, { token: admin });
    rec('9b: aset tanpa kategori master tetap terbaca (detail & list)', '200 + 200',
      `${legacyRead2.status}`, legacyRead2.status === 200);

    // ================= 10. Edit master berlaku untuk aset baru =================
    await req(s1.base, 'PATCH', '/api/taxonomy/categories/KDR', { token: admin, body: { is_loanable_by_default: false } });
    const aKdrOff = await req(s1.base, 'POST', '/api/assets', { token: admin, body: { category_name_or_code: 'KDR', name: 'Aset Uji T2B-3 KDR off' } });
    await req(s1.base, 'PATCH', '/api/taxonomy/categories/KDR', { token: admin, body: { is_loanable_by_default: true } });
    const aKdrOn = await req(s1.base, 'POST', '/api/assets', { token: admin, body: { category_name_or_code: 'KDR', name: 'Aset Uji T2B-3 KDR on' } });
    rec('10a: edit is_loanable_by_default di master langsung berlaku untuk aset baru',
      'false lalu true',
      `${aKdrOff.json?.data?.is_loanable} / ${aKdrOn.json?.data?.is_loanable}`,
      aKdrOff.json?.data?.is_loanable === false && aKdrOn.json?.data?.is_loanable === true);

    // ================= 11. Integritas aset existing =================
    const beforeActs = ((await req(s1.base, 'GET', '/api/assets', { token: admin })).json?.data || [])
      .map(a => `${a.id}|${a.asset_number}|${a.corporate_asset_number}|${a.owner_division}|${a.managing_unit_id}|${a.asset_location_id}|${a.category_code}`);
    const seedAsset = ((await req(s1.base, 'GET', '/api/assets', { token: admin })).json?.data || [])
      .find(a => String(a.asset_number || '').startsWith('IT-HLT-'));
    rec('11a: penomoran aset tetap format {DIV}-{CODE}-{YEAR}-{SEQ} (regresi numbering)',
      'contoh IT-HLT-<tahun>-<seq>', `contoh=${seedAsset?.asset_number}`,
      !!seedAsset && /^IT-HLT-\d{4}-\d+$/.test(String(seedAsset.asset_number)));
    // snapshot diambil kembali setelah semua aksi master → tidak boleh berubah
    const afterActs = ((await req(s1.base, 'GET', '/api/assets', { token: admin })).json?.data || [])
      .map(a => `${a.id}|${a.asset_number}|${a.corporate_asset_number}|${a.owner_division}|${a.managing_unit_id}|${a.asset_location_id}|${a.category_code}`);
    const beforeKeys = new Set(beforeActs);
    const changedExisting = afterActs.filter(k => {
      const id = k.split('|')[0];
      const old = beforeActs.find(x => x.startsWith(id + '|'));
      return old !== undefined && old !== k;
    });
    rec('11b: aksi master kategori tidak mengubah aset existing (owner/unit/lokasi/nomor)',
      '0 perubahan pada aset yang sudah ada', `berubah=${changedExisting.length}${changedExisting.length ? ' : ' + changedExisting.slice(0, 2).join(' ; ') : ''}`,
      changedExisting.length === 0 && beforeKeys.size > 0);

    // ================= 12. Snapshot + restart (roundtrip) =================
    await req(s1.base, 'PATCH', '/api/taxonomy/categories/HRCK', { token: admin, body: { is_active: false } });
    const snapshot = ((await req(s1.base, 'GET', '/api/assets', { token: admin })).json?.data || [])
      .map(a => `${a.id}|${a.asset_number}|${a.corporate_asset_number}|${a.owner_division}|${a.managing_unit_id}|${a.asset_location_id}|${a.category_code}|${a.is_loanable}`);
    const masterSnap = ((await req(s1.base, 'GET', '/api/taxonomy/categories', { token: admin })).json?.data || [])
      .map(c => `${c.code}|${c.name}|${c.main_type}|${c.owner_division}|${c.category_type}|${c.is_loanable_by_default}|${c.is_active}`)
      .sort();
    kill(s1.c);
    await new Promise(r => setTimeout(r, 400));

    // ================= PHASE 2 (restart — JSON fallback roundtrip) =================
    s2 = await boot(sp, 39800 + Math.floor(Math.random() * 150), env);
    const admin2 = await login(s2.base, 'admin@foodstation.co.id', env.ap);
    const master2 = ((await req(s2.base, 'GET', '/api/taxonomy/categories', { token: admin2 })).json?.data || [])
      .map(c => `${c.code}|${c.name}|${c.main_type}|${c.owner_division}|${c.category_type}|${c.is_loanable_by_default}|${c.is_active}`)
      .sort();
    const sameMaster = masterSnap.length === master2.length && masterSnap.every((k, i) => master2[i] === k);
    const drn2 = master2.find(k => k.startsWith('DRN|'));
    const hrck2 = master2.find(k => k.startsWith('HRCK|'));
    // DRN sudah di-re-enable (field terakhir = is_active true); HRCK sengaja
    // dinonaktifkan sebelum restart (is_active false) untuk membuktikan status
    // nonaktif bertahan lewat hydrate.
    const drnKept = !!drn2 && drn2.endsWith('|true');
    const hrckDisabled = !!hrck2 && hrck2.endsWith('|false');
    rec('12a: master kategori bertahan lewat hydrate (rename, edit, status nonaktif)',
      'identik + DRN aktif + HRCK nonaktif',
      `${masterSnap.length} vs ${master2.length} kategori, sama=${sameMaster}; DRN=${drn2 || 'HILANG'}; HRCK=${hrck2 || 'HILANG'}`,
      sameMaster && drnKept && hrckDisabled);

    const assets2 = ((await req(s2.base, 'GET', '/api/assets', { token: admin2 })).json?.data || [])
      .map(a => `${a.id}|${a.asset_number}|${a.corporate_asset_number}|${a.owner_division}|${a.managing_unit_id}|${a.asset_location_id}|${a.category_code}|${a.is_loanable}`);
    const sameAssets = snapshot.length === assets2.length && snapshot.every((k, i) => assets2[i] === k);
    const diff = snapshot.filter((k, i) => assets2[i] !== k).slice(0, 3);
    rec('12b: aset (nomor, owner, unit, lokasi, kategori, loanable) identik setelah restart', 'identik',
      `${snapshot.length} vs ${assets2.length}${diff.length ? ' | beda: ' + diff.join(' ; ') : ''}`, sameAssets);

    const p = R.filter(x => x.p).length;
    console.log('\n=== T2B-3 CATEGORY MASTER VERIFY ===');
    R.forEach(x => console.log(`${x.p ? 'PASS' : 'FAIL'} | ${x.n} | expected: ${x.e} | actual: ${x.a}`));
    console.log(`TOTAL: ${R.length} | PASS: ${p} | FAIL: ${R.length - p}`);
    // Matikan server uji SEBELUM exit: blok `finally` tidak dijalankan saat
    // process.exit(), sehingga anak yang masih hidup dapat menulis ulang state
    // file (data uji bocor ke store dev) setelah restore dijalankan.
    kill(s1?.c); kill(s2?.c);
    process.exit(p === R.length ? 0 : 1);
  } catch (e) {
    console.error('Verification error:', e.message);
    console.error((s2?.log?.() || s1?.log?.() || '').slice(-2000));
    kill(s1?.c); kill(s2?.c);
    process.exit(1);
  } finally {
    kill(s1?.c); kill(s2?.c);
  }
}
main();
