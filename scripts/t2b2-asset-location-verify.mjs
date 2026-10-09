/**
 * T2B-2 VERIFY — Asset Location Master (2026-10-09)
 * Memverifikasi test plan T2B-2 (butuh `npm run build` dulu; boot dist/server.cjs,
 * mode file store; state file asli di-backup lalu direstore):
 *   1. Migration 008 additive & idempotent (inspeksi statis SQL + boot ulang).
 *   2. CRUD master lokasi oleh Admin GABAH (create/rename/disable/enable).
 *   3. Non-admin (IT) ditolak 403; Auditor tetap read-only (GET 200, mutasi 403).
 *   4. Referensi lokasi valid diterima pada create & patch aset.
 *   5. Referensi tidak dikenal ditolak 400 ( nilai tidak berubah ).
 *   6. Lokasi nonaktif tidak dapat dipilih untuk perubahan baru, tetapi nilai
 *      historis yang sudah melekat tetap dipertahankan.
 *   7. Aset legacy tanpa relasi tetap terbaca (GET detail & list).
 *   8. Backfill TIDAK menebak: teks tanpa cocokan unik → null.
 *   9. Lokasi fisik tidak mengubah owner_division.
 *  10. Lokasi fisik tidak mengubah managing_unit_id.
 *  11. asset_number & corporate_asset_number tidak berubah.
 *  12. JSON fallback mempertahankan data lokasi (roundtrip lewat restart).
 *  13. Auditor read-only pada master & aset.
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

  // ================= Test 1 (statis): migration 008 additive & idempotent =================
  const migRaw = fs.readFileSync(path.resolve('server/migrations/008_asset_location_master.sql'), 'utf8');
  // Abaikan baris komentar (--) saat inspeksi statis agar tidak false-positive.
  const mig = migRaw.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
  const noDrop = !/\bDROP\s+(TABLE|COLUMN)/i.test(mig);
  const allIfNotExists = (mig.match(/CREATE TABLE|CREATE INDEX|ADD COLUMN/g) || []).length > 0 && !/CREATE TABLE (?!IF NOT EXISTS)|CREATE INDEX (?!IF NOT EXISTS)|ADD COLUMN (?!IF NOT EXISTS)/i.test(mig);
  const backfillGuarded = /WHERE a\.asset_location_id IS NULL/i.test(mig);
  const guardedUnique = /NOT EXISTS/i.test(mig); // ambiguitas → jangan isi
  const untouchedCols = !/SET\s+(owner_division|managing_unit_id|asset_number|corporate_asset_number|location)\s*=/i.test(mig);
  rec('1a: migration additive (tanpa DROP, semua IF NOT EXISTS)', 'no DROP + IF NOT EXISTS', `${noDrop ? 'OK' : 'ADA DROP'}+${allIfNotExists ? 'OK' : 'ADA YANG TANPA GUARD'}`, noDrop && allIfNotExists);
  rec('1b: backfill hanya baris NULL + penjaga ambiguitas', 'IS NULL + NOT EXISTS', `${backfillGuarded ? 'OK' : 'TANPA'}+${guardedUnique ? 'OK' : 'TANPA'}`, backfillGuarded && guardedUnique);
  rec('1c: migration tidak menyentuh owner/unit/nomor/teks lokasi', 'tanpa UPDATE kolom tsb', untouchedCols ? 'OK' : 'ADA!', untouchedCols);

  const env = {
    ap: crypto.randomBytes(12).toString('base64url'),
    up: crypto.randomBytes(12).toString('base64url'),
  };
  let s1 = null, s2 = null;
  try {
    // ================= PHASE 1 (fresh seed) =================
    s1 = await boot(sp, 39200 + Math.floor(Math.random() * 500), env);
    const login = async (b, e, pw) => {
      const r = await req(b, 'POST', '/api/auth/login', { body: { email: e, password: pw } });
      return r.json?.data?.token || '';
    };
    const admin = await login(s1.base, 'admin@foodstation.co.id', env.ap);
    const it = await login(s1.base, 'it.support@foodstation.co.id', env.up);
    const aud = await login(s1.base, 'auditor@foodstation.co.id', env.up);
    if (!admin || !it || !aud) throw Error('login gagal');

    // ================= Master hierarchy seed =================
    const masters = (await req(s1.base, 'GET', '/api/master/asset-locations', { token: admin })).json?.data || [];
    const roots = masters.filter(l => !l.parent_id);
    const childRefOk = masters.every(l => !l.parent_id || masters.some(p => p.id === l.parent_id));
    const hoChild = masters.find(l => l.id === 'ALOC-HO-IT');
    rec('M1: master seed hierarchical tersedia (root + anak, referensi valid)',
      'roots>=4 & semua parent valid & ALOC-HO-IT child of ALOC-HO',
      `roots=${roots.length}, validRef=${childRefOk}, ALOC-HO-IT.parent=${hoChild?.parent_id}`,
      roots.length >= 4 && childRefOk && hoChild?.parent_id === 'ALOC-HO');

    // ================= Backfill deterministik (seed aset) =================
    const assets0 = (await req(s1.base, 'GET', '/api/assets', { token: admin })).json?.data || [];
    const unmapped = assets0.filter(a => !a.asset_location_id);
    const undefinedCount = assets0.filter(a => a.asset_location_id === undefined).length;
    const EXPECTED_BY_DIV = { IT: 'UNIT-IT-MIS', SC: 'UNIT-SC', PIBC: 'UNIT-PIBC', GA: null };
    const unitOk = assets0.every(a => a.managing_unit_id === (EXPECTED_BY_DIV[a.owner_division] ?? null));
    rec('B1: seluruh aset seed terpetakan deterministik (exact-match path)', '0 belum terpetak, 0 undefined',
      `total=${assets0.length}, unMapped=${unmapped.length}, undefined=${undefinedCount}`,
      assets0.length > 0 && unmapped.length === 0 && undefinedCount === 0);
    rec('B2: backfill tidak mengubah owner_division & managing_unit_id (T2B-1 utuh)',
      'mapping T2B-1 identik', unitOk ? 'OK' : 'ADA YANG BERUBAH', unitOk);

    // ================= 2. CRUD master oleh Admin =================
    const c1 = await req(s1.base, 'POST', '/api/master/asset-locations', { token: admin, body: { name: 'Area Uji T2B-2', parent_id: 'ALOC-PIBC' } });
    const newId = c1.json?.data?.id;
    const c2 = await req(s1.base, 'POST', '/api/master/asset-locations', { token: admin, body: { name: 'area uji t2b-2', parent_id: 'ALOC-PIBC' } });
    rec('2a: Admin create lokasi anak + duplikat nama level sama ditolak', '201 lalu 400',
      `${c1.status} lalu ${c2.status}`, c1.status === 201 && c2.status === 400);
    const p1 = await req(s1.base, 'PATCH', `/api/master/asset-locations/${newId}`, { token: admin, body: { name: 'Area Uji T2B-2 (Revised)' } });
    const p2 = await req(s1.base, 'PATCH', `/api/master/asset-locations/${newId}`, { token: admin, body: { is_active: false } });
    const disabledId = newId;
    const p3 = await req(s1.base, 'PATCH', `/api/master/asset-locations/${newId}`, { token: admin, body: { is_active: true } });
    rec('2b: Admin rename + disable + enable', '200/200/200 & nama baru', `${p1.status}/${p2.status}/${p3.status} name=${p1.json?.data?.name}`,
      p1.status === 200 && p2.status === 200 && p3.status === 200 && p1.json?.data?.name === 'Area Uji T2B-2 (Revised)');

    // ================= 7a. Guard hierarki (self & cycle) =================
    const selfP = await req(s1.base, 'PATCH', `/api/master/asset-locations/${newId}`, { token: admin, body: { parent_id: newId } });
    const cycChild = await req(s1.base, 'POST', '/api/master/asset-locations', { token: admin, body: { name: 'Siklus A', parent_id: 'ALOC-HO' } });
    const cycA = cycChild.json?.data?.id;
    const cycB = await req(s1.base, 'POST', '/api/master/asset-locations', { token: admin, body: { name: 'Siklus B', parent_id: cycA } });
    const cycBreak = await req(s1.base, 'PATCH', `/api/master/asset-locations/${cycA}`, { token: admin, body: { parent_id: cycB.json?.data?.id } });
    rec('2c: parent self-reference & siklus ditolak', '400 + 400', `${selfP.status} + ${cycBreak.status}`,
      selfP.status === 400 && cycBreak.status === 400);

    // ================= 3. Non-admin & Auditor =================
    const itPost = await req(s1.base, 'POST', '/api/master/asset-locations', { token: it, body: { name: 'Lokasi Ilegal' } });
    const itPatch = await req(s1.base, 'PATCH', `/api/master/asset-locations/ALOC-HO`, { token: it, body: { name: 'Hacked' } });
    const audPost = await req(s1.base, 'POST', '/api/master/asset-locations', { token: aud, body: { name: 'Lokasi Auditor' } });
    const audGet = await req(s1.base, 'GET', '/api/master/asset-locations', { token: aud });
    const audPatchAsset = await req(s1.base, 'PATCH', `/api/assets/${assets0[0]?.id}`, { token: aud, body: { asset_location_id: 'ALOC-HO' } });
    rec('3a: non-admin (IT) ditolak kelola master', '403 + 403', `${itPost.status} + ${itPatch.status}`,
      itPost.status === 403 && itPatch.status === 403);
    rec('3b: Auditor read-only (GET 200, mutasi master & aset 403)', '200/403/403',
      `${audGet.status}/${audPost.status}/${audPatchAsset.status}`,
      audGet.status === 200 && audPost.status === 403 && audPatchAsset.status === 403);

    // ================= 4/5/9/10/11. Valid & invalid reference pada aset =================
    const before = ((await req(s1.base, 'GET', '/api/assets', { token: admin })).json?.data || []).find(a => a.owner_division === 'IT');
    const r1 = await req(s1.base, 'PATCH', `/api/assets/${before.id}`, { token: admin, body: { asset_location_id: 'ALOC-HO-IT' } });
    const after1 = r1.json?.data;
    rec('4a: patch aset dengan lokasi valid diterima', '200 & relasi tersimpan', `${r1.status} & id=${after1?.asset_location_id}`,
      r1.status === 200 && after1?.asset_location_id === 'ALOC-HO-IT');
    rec('9/10/11a: patch lokasi tidak mengubah owner_division, managing_unit_id, asset_number, corporate_asset_number',
      'identik sebelum→sesudah',
      `${before.owner_division}/${after1?.owner_division}, ${before.managing_unit_id}/${after1?.managing_unit_id}, ${before.asset_number}==${after1?.asset_number}, corp=${before.corporate_asset_number}==${after1?.corporate_asset_number}`,
      before.owner_division === after1?.owner_division && before.managing_unit_id === after1?.managing_unit_id &&
      before.asset_number === after1?.asset_number && before.corporate_asset_number === after1?.corporate_asset_number);

    const bad1 = await req(s1.base, 'PATCH', `/api/assets/${before.id}`, { token: admin, body: { asset_location_id: 'ALOC-TIDAK-ADA' } });
    const afterBad = ((await req(s1.base, 'GET', `/api/assets/${before.id}`, { token: admin })).json?.data);
    rec('5a: referensi tidak dikenal ditolak & nilai lama tidak berubah', '400 & tetap ALOC-HO-IT',
      `${bad1.status} & ${afterBad?.asset_location_id}`, bad1.status === 400 && afterBad?.asset_location_id === 'ALOC-HO-IT');

    // ================= 6. Lokasi nonaktif =================
    await req(s1.base, 'PATCH', `/api/master/asset-locations/${disabledId}`, { token: admin, body: { is_active: false } });
    const cBad = await req(s1.base, 'POST', '/api/assets', { token: admin, body: { category_name_or_code: 'MSN', owner_division: 'PIBC', name: 'Aset Uji T2B-2 nonaktif', asset_location_id: disabledId } });
    const pBad = await req(s1.base, 'PATCH', `/api/assets/${before.id}`, { token: admin, body: { asset_location_id: disabledId } });
    rec('6a: lokasi nonaktif ditolak untuk aset baru & perubahan', '400 + 400', `${cBad.status} + ${pBad.status}`,
      cBad.status === 400 && pBad.status === 400);
    // Kompatibilitas historis: kirim ulang nilai yang SUDAH melekat (kini nonaktif) → diperbolehkan
    const cAct = await req(s1.base, 'POST', '/api/assets', { token: admin, body: { category_name_or_code: 'MSN', owner_division: 'PIBC', name: 'Aset Uji T2B-2 historis', asset_location_id: 'ALOC-PIBC-KANTOR-1' } });
    const histId = cAct.json?.data?.id;
    await req(s1.base, 'PATCH', `/api/master/asset-locations/ALOC-PIBC-KANTOR-1`, { token: admin, body: { is_active: false } });
    const histKeep = await req(s1.base, 'PATCH', `/api/assets/${histId}`, { token: admin, body: { asset_location_id: 'ALOC-PIBC-KANTOR-1', notes: 'catatan historis' } });
    await req(s1.base, 'PATCH', `/api/master/asset-locations/ALOC-PIBC-KANTOR-1`, { token: admin, body: { is_active: true } });
    rec('6b: nilai historis (lokasi kini nonaktif) tetap dipertahankan', '200', `${histKeep.status} & id=${histKeep.json?.data?.asset_location_id}`,
      histKeep.status === 200 && histKeep.json?.data?.asset_location_id === 'ALOC-PIBC-KANTOR-1');

    // ================= 8. Backfill tidak menebak (teks bebas) =================
    const cCust = await req(s1.base, 'POST', '/api/assets', { token: admin, body: { category_name_or_code: 'MSN', owner_division: 'PIBC', name: 'Aset Uji T2B-2 teks bebas', location: 'Lokasi Misterius 999' } });
    const cust = cCust.json?.data;
    rec('8a: teks tanpa cocokan unik → relasi null (tidak ditebak)', '201 & asset_location_id=null',
      `${cCust.status} & ${cust?.asset_location_id} & location=${cust?.location}`,
      cCust.status === 201 && (cust?.asset_location_id === null || cust?.asset_location_id === undefined) && cust?.location === 'Lokasi Misterius 999');

    // ================= 7b. Aset legacy tanpa relasi tetap terbaca =================
    const legacy = await req(s1.base, 'GET', `/api/assets/${cust.id}`, { token: admin });
    const listAll = await req(s1.base, 'GET', '/api/assets', { token: admin });
    rec('7a: aset legacy tanpa relasi tetap terbaca (detail & list)', '200 + 200 & teks location utuh',
      `${legacy.status} + ${listAll.status} & location=${legacy.json?.data?.location}`,
      legacy.status === 200 && listAll.status === 200 && legacy.json?.data?.location === 'Lokasi Misterius 999');

    // ================= Move: reolusi deterministik =================
    const cMove = await req(s1.base, 'POST', '/api/assets', { token: admin, body: { category_name_or_code: 'MSN', owner_division: 'PIBC', name: 'Aset Uji T2B-2 move', location: 'Pasar Induk Beras Cipinang - Kantor Pos 1' } });
    const mvMapped = cMove.json?.data?.asset_location_id;
    const mv1 = await req(s1.base, 'POST', `/api/assets/${cMove.json?.data?.id}/move`, { token: admin, body: { newLocation: 'Lokasi Manual Belum Di Master', reason: 'uji T2B-2' } });
    const mvAfter = mv1.json?.data;
    rec('8b: move teks non-master → relasi dilepas (null), teks tercatat', 'id=null & teks berubah',
      `${mvMapped} → ${mvAfter?.asset_location_id} & location=${mvAfter?.location}`,
      mvMapped === 'ALOC-PIBC-KANTOR-1' && (mvAfter?.asset_location_id === null || mvAfter?.asset_location_id === undefined) && mvAfter?.location === 'Lokasi Manual Belum Di Master');

    // ================= Snapshot untuk roundtrip =================
    const beforeRestart = ((await req(s1.base, 'GET', '/api/assets', { token: admin })).json?.data || [])
      .map(a => ({ id: a.id, n: a.asset_number, c: a.corporate_asset_number, l: a.asset_location_id, o: a.owner_division, u: a.managing_unit_id }));
    const mastersBefore = (await req(s1.base, 'GET', '/api/master/asset-locations', { token: admin })).json?.data || [];
    kill(s1.c);
    await new Promise(r => setTimeout(r, 400));

    // ================= PHASE 2 (restart — JSON fallback roundtrip) =================
    s2 = await boot(sp, 39700 + Math.floor(Math.random() * 200), env);
    const admin2 = await login(s2.base, 'admin@foodstation.co.id', env.ap);
    const assets2 = (await req(s2.base, 'GET', '/api/assets', { token: admin2 })).json?.data || [];
    const masters2 = (await req(s2.base, 'GET', '/api/master/asset-locations', { token: admin2 })).json?.data || [];
    const key = (a) => `${a.id}|${a.n}|${a.c}|${a.l}|${a.o}|${a.u}`;
    const assets2keyed = assets2.map(a => ({ id: a.id, n: a.asset_number, c: a.corporate_asset_number, l: a.asset_location_id, o: a.owner_division, u: a.managing_unit_id }));
    const sameAssets = beforeRestart.length === assets2keyed.length &&
      beforeRestart.every(a => assets2keyed.some(b => key(b) === key(a)));
    const diffSample = beforeRestart
      .filter(a => !assets2keyed.some(b => key(b) === key(a)))
      .map(a => {
        const now = assets2keyed.find(b => b.id === a.id);
        return now ? `now=${key(now)} (was ${key(a)})` : `hilang: ${key(a)}`;
      }).slice(0, 3).join(' ; ');
    rec('12a: JSON fallback mempertahankan relasi lokasi & snapshot aset (restart)', 'identik',
      `${beforeRestart.length} vs ${assets2keyed.length} aset, sama=${sameAssets}${diffSample ? ' | ' + diffSample : ''}`, sameAssets);
    const mKey = (l) => `${l.id}|${l.name}|${l.parent_id}|${l.is_active}`;
    const sameMasters = mastersBefore.length === masters2.length &&
      mastersBefore.every(l => masters2.some(b => mKey(b) === mKey(l)));
    rec('12b: master lokasi bertahan lewat hydrate (termasuk yang dinonaktifkan)', 'identik',
      `${mastersBefore.length} lokasi, sama=${sameMasters}`, sameMasters);

    // Idempotensi backfill di boot kedua: tidak ada relasi yang "berubah sendiri"
    const unmapped2 = assets2.filter(a => a.asset_location_id === undefined).length;
    rec('12c: backfill idempoten (boot ulang tidak mengubah hasil)', '0 undefined', `undefined=${unmapped2}`, unmapped2 === 0);

    const p = R.filter(x => x.p).length;
    console.log('\n=== T2B-2 ASSET LOCATION VERIFY ===');
    R.forEach(x => console.log(`${x.p ? 'PASS' : 'FAIL'} | ${x.n} | expected: ${x.e} | actual: ${x.a}`));
    console.log(`TOTAL: ${R.length} | PASS: ${p} | FAIL: ${R.length - p}`);
    process.exit(p === R.length ? 0 : 1);
  } catch (e) {
    console.error('Verification error:', e.message);
    console.error((s2?.log?.() || s1?.log?.() || '').slice(-2000));
    process.exit(1);
  } finally {
    kill(s1?.c); kill(s2?.c);
  }
}
main();
