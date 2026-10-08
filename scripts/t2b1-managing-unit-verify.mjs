/**
 * T2B-1 VERIFY — Asset Ownership Core Model (2026-10-08)
 * Memverifikasi test plan T2B-1 (A–F; G = regression suite terpisah):
 *   A. Asset baru/bisa memiliki managing_unit_id (create eksplisit + default ownership).
 *   B. Referensi ke org_units valid: unit harus ada & aktif (invalid/nonaktif → 400),
 *      semua asset hanya merujuk unit yang dikenal atau null.
 *   C. Backfill memakai ownership mapping (owner_division), bukan lokasi.
 *   D. Asset owner=IT di lokasi PIBC tetap owner IT + unit IT.
 *   E. Asset number TIDAK berubah setelah create/patch/restart/backfill.
 *   F. JSON fallback tidak kehilangan managing_unit_id (roundtrip lewat restart).
 *
 * Butuh `npm run build` dulu (boot dist/server.cjs, mode file store).
 * State file asli di-backup lalu direstore di akhir run.
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

// Aturan mapping deterministik (harus identik dengan server/managing-unit.ts
// dan backfill SQL di server/migrations/007_asset_managing_unit.sql).
const EXPECTED_BY_DIV = { IT: 'UNIT-IT-MIS', SC: 'UNIT-SC', PIBC: 'UNIT-PIBC', GA: null };

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

  const env = {
    ap: crypto.randomBytes(12).toString('base64url'),
    up: crypto.randomBytes(12).toString('base64url'),
  };
  let s1 = null, s2 = null;
  try {
    // ================= PHASE 1 (fresh seed) =================
    s1 = await boot(sp, 39100 + Math.floor(Math.random() * 500), env);
    const login = async (b, e, pw) => {
      const r = await req(b, 'POST', '/api/auth/login', { body: { email: e, password: pw } });
      return r.json?.data?.token || '';
    };
    const admin = await login(s1.base, 'admin@foodstation.co.id', env.ap);
    if (!admin) throw Error('login admin gagal');

    const units = (await req(s1.base, 'GET', '/api/master/org-units', { token: admin })).json?.data || [];
    const assets0 = (await req(s1.base, 'GET', '/api/assets', { token: admin })).json?.data || [];

    // ---------- Test C: backfill ownership-based (bukan lokasi), sebelum mutasi ----------
    const divCounts = {};
    let cOk = assets0.length > 0, cUndefined = 0;
    for (const a of assets0) {
      divCounts[a.owner_division] = (divCounts[a.owner_division] || 0) + 1;
      if (a.managing_unit_id === undefined) cUndefined++;
      const exp = Object.prototype.hasOwnProperty.call(EXPECTED_BY_DIV, a.owner_division) ? EXPECTED_BY_DIV[a.owner_division] : 'ANY';
      if (exp !== 'ANY' && a.managing_unit_id !== exp) cOk = false;
      if (exp === 'ANY' && a.managing_unit_id !== null) cOk = false;
    }
    rec('C1: seed aset per divisi punya managing_unit_id (ownership mapping)',
      `IT→UNIT-IT-MIS, SC→UNIT-SC, PIBC→UNIT-PIBC, GA→null`,
      JSON.stringify(divCounts) + (cUndefined ? ` (${cUndefined} undefined!)` : ''),
      cOk && cUndefined === 0);
    rec('C2: seed memuat divisi IT & GA untuk bukti mapping', 'ada', `IT=${divCounts.IT || 0}, GA=${divCounts.GA || 0}, SC=${divCounts.SC || 0}, PIBC=${divCounts.PIBC || 0}`,
      (divCounts.IT || 0) > 0 && (divCounts.GA || 0) > 0);
    const gaSeed = assets0.find(a => a.owner_division === 'GA');
    rec('C3: aset GA TIDAK ditebak ke unit manapun (2 kandidat → null)', 'null', `${gaSeed?.managing_unit_id}`, gaSeed && gaSeed.managing_unit_id === null);

    // ---------- Test A: create/update membawa managing_unit_id ----------
    // A1: create eksplisit (owner PIBC via kategori MSN yang boleh di-override)
    const a1 = await req(s1.base, 'POST', '/api/assets', {
      token: admin,
      body: { category_name_or_code: 'MSN', owner_division: 'PIBC', name: 'Aset Uji T2B-1 (explicit)', location: 'RPC', managing_unit_id: 'UNIT-PIBC' },
    });
    const created1 = a1.json?.data;
    rec('A1: create asset dengan managing_unit_id eksplisit', '201 + UNIT-PIBC',
      `${a1.status} + ${created1?.managing_unit_id}`, a1.status === 201 && created1?.managing_unit_id === 'UNIT-PIBC' && created1?.owner_division === 'PIBC');

    // A2: create tanpa field → default dari ownership (bukan lokasi)
    const a2 = await req(s1.base, 'POST', '/api/assets', {
      token: admin,
      body: { category_name_or_code: 'HLT', name: 'Aset Uji T2B-1 (default IT)', location: 'PIBC - Los Kantor' },
    });
    const created2 = a2.json?.data;
    rec('A2: create tanpa field → unit mengikuti owner_division (IT)', 'UNIT-IT-MIS',
      `${created2?.managing_unit_id}`, a2.status === 201 && created2?.managing_unit_id === 'UNIT-IT-MIS' && created2?.owner_division === 'IT');

    // A3: update (PATCH) mengganti managing_unit_id tanpa mengubah asset_number
    const numBeforePatch = created1?.asset_number;
    const a3 = await req(s1.base, 'PATCH', `/api/assets/${created1?.id}`, { token: admin, body: { managing_unit_id: 'UNIT-SC' } });
    rec('A3: PATCH managing_unit_id → 200 + nilai berubah + asset_number tetap',
      '200 + UNIT-SC + number sama',
      `${a3.status} + ${a3.json?.data?.managing_unit_id} + ${a3.json?.data?.asset_number === numBeforePatch ? 'sama' : 'BERUBAH'}`,
      a3.status === 200 && a3.json?.data?.managing_unit_id === 'UNIT-SC' && a3.json?.data?.asset_number === numBeforePatch);

    // A4: PATCH null eksplisit → diterima (nullable)
    const a4 = await req(s1.base, 'PATCH', `/api/assets/${created1?.id}`, { token: admin, body: { managing_unit_id: null } });
    rec('A4: PATCH managing_unit_id=null diterima', '200 + null',
      `${a4.status} + ${a4.json?.data?.managing_unit_id}`, a4.status === 200 && a4.json?.data?.managing_unit_id === null);

    // ---------- Test B: referensi org_units valid ----------
    const b1 = await req(s1.base, 'PATCH', `/api/assets/${created2?.id}`, { token: admin, body: { managing_unit_id: 'UNIT-TIDAK-ADA' } });
    rec('B1: PATCH unit tidak dikenal → 400', '400', `${b1.status}`, b1.status === 400);
    const b2 = await req(s1.base, 'POST', '/api/assets', {
      token: admin,
      body: { category_name_or_code: 'HLT', name: 'Aset Uji T2B-1 (invalid unit)', managing_unit_id: 'UNIT-TIDAK-ADA' },
    });
    rec('B2: create dengan unit tidak dikenal → 400', '400', `${b2.status}`, b2.status === 400);
    // unit nonaktif → ditolak (mengikuti aturan master org_units)
    const tempUnit = (await req(s1.base, 'POST', '/api/master/org-units', { token: admin, body: { name: 'Unit Uji T2B-1', division_code: 'GA' } })).json?.data;
    await req(s1.base, 'PATCH', `/api/master/org-units/${tempUnit?.id}`, { token: admin, body: { is_active: false } });
    const b3 = await req(s1.base, 'PATCH', `/api/assets/${created1?.id}`, { token: admin, body: { managing_unit_id: tempUnit?.id } });
    rec('B3: unit nonaktif → 400', '400', `${b3.status}`, b3.status === 400);
    // integritas referensi: semua aset hanya merujuk unit dikenal atau null
    const known = new Set(units.map(u => u.id));
    const allNow = (await req(s1.base, 'GET', '/api/assets', { token: admin })).json?.data || [];
    const badRefs = allNow.filter(a => a.managing_unit_id !== null && !known.has(a.managing_unit_id));
    rec('B4: semua managing_unit_id ∈ org_units (FK-valid) atau null', '0 referensi asing',
      `${badRefs.length} asing`, badRefs.length === 0);

    // ---------- Test D: lokasi PIBC tidak memindahkan owner/unit ----------
    const itAsset = allNow.find(a => a.owner_division === 'IT' && a.managing_unit_id === 'UNIT-IT-MIS');
    const dNum = itAsset?.asset_number;
    const dUnit = itAsset?.managing_unit_id;
    const mv = await req(s1.base, 'POST', `/api/assets/${itAsset?.id}/move`, { token: admin, body: { newLocation: 'PIBC - Los Kantor Uji' } });
    const dAfter = (await req(s1.base, 'GET', '/api/assets', { token: admin })).json?.data?.find(a => a.id === itAsset?.id);
    rec('D: aset IT dipindah ke lokasi PIBC → owner IT + unit IT + number tetap',
      'IT + UNIT-IT-MIS + number sama',
      `${dAfter?.owner_division} + ${dAfter?.managing_unit_id} + ${dAfter?.asset_number === dNum ? 'sama' : 'BERUBAH'} + loc=${dAfter?.location}`,
      mv.status === 200 && dAfter?.owner_division === 'IT' && dAfter?.managing_unit_id === dUnit && dAfter?.asset_number === dNum && /PIBC/i.test(dAfter?.location || ''));

    // restore nilai A1 asset & state persist untuk F
    await req(s1.base, 'PATCH', `/api/assets/${created1?.id}`, { token: admin, body: { managing_unit_id: 'UNIT-PIBC' } });
    await new Promise(r => setTimeout(r, 400));

    // ---------- Test E/F phase 1: snapshot numbers + baca JSON fallback ----------
    const phase1 = (await req(s1.base, 'GET', '/api/assets', { token: admin })).json?.data || [];
    const num1 = Object.fromEntries(phase1.map(a => [a.id, a.asset_number]));
    const unit1 = Object.fromEntries(phase1.map(a => [a.id, a.managing_unit_id ?? null]));
    let fileAssets = [];
    try { fileAssets = JSON.parse(fs.readFileSync(sf, 'utf8')).assets || []; } catch { }
    const allHaveKey = fileAssets.length > 0 && fileAssets.every(a => Object.prototype.hasOwnProperty.call(a, 'managing_unit_id'));
    const createdInFile = fileAssets.find(a => a.id === created1?.id);
    rec('F1: JSON fallback menyimpan managing_unit_id (semua aset punya key)', 'true + ada',
      `key=${allHaveKey}/${fileAssets.length} + created=${createdInFile?.managing_unit_id}`,
      allHaveKey && createdInFile?.managing_unit_id === 'UNIT-PIBC');

    kill(s1.c); s1 = null;

    // ================= PHASE 2 (restart dengan state phase 1) =================
    s2 = await boot(sp, 39600 + Math.floor(Math.random() * 500), env);
    const admin2 = await login(s2.base, 'admin@foodstation.co.id', env.ap);
    const phase2 = (await req(s2.base, 'GET', '/api/assets', { token: admin2 })).json?.data || [];
    const num2 = Object.fromEntries(phase2.map(a => [a.id, a.asset_number]));
    const unit2 = Object.fromEntries(phase2.map(a => [a.id, a.managing_unit_id ?? null]));

    const numsStable = phase1.length === phase2.length && phase1.every(a => num2[a.id] === num1[a.id]);
    rec('E: asset number identik setelah restart + backfill ulang (idempoten)', 'tidak berubah',
      numsStable ? `${phase1.length} aset identik` : `mismatch ${phase1.length}→${phase2.length}`,
      numsStable);

    const unitsStable = phase1.every(a => unit2[a.id] === unit1[a.id]);
    rec('F2: managing_unit_id selamat lewat hydrate ulang (roundtrip)', 'identik',
      unitsStable ? 'identik' : 'berubah', unitsStable);

    const created2After = phase2.find(a => a.id === created1?.id);
    rec('F3: aset buatan (UNIT-PIBC) tetap setelah restart', 'UNIT-PIBC',
      `${created2After?.managing_unit_id}`, created2After?.managing_unit_id === 'UNIT-PIBC');

    const gaAfter = phase2.find(a => a.id === gaSeed?.id);
    rec('F4: aset GA tetap null (tidak ditebak ulang saat hydrate)', 'null',
      `${gaAfter?.managing_unit_id}`, gaAfter && gaAfter.managing_unit_id === null);

    const itSeedAfter = phase2.filter(a => a.owner_division === 'IT');
    rec('F5: aset IT tetap UNIT-IT-MIS setelah restart', 'semua UNIT-IT-MIS',
      `${itSeedAfter.filter(a => a.managing_unit_id === 'UNIT-IT-MIS').length}/${itSeedAfter.length}`,
      itSeedAfter.length > 0 && itSeedAfter.every(a => a.managing_unit_id === 'UNIT-IT-MIS'));

    kill(s2.c); s2 = null;

    const p = R.filter(x => x.p).length;
    console.log('\n=== T2B-1 MANAGING UNIT VERIFY ===');
    R.forEach(x => console.log(`${x.p ? 'PASS' : 'FAIL'} | ${x.n} | expected: ${x.e} | actual: ${x.a}`));
    console.log(`TOTAL: ${R.length} | PASS: ${p} | FAIL: ${R.length - p}`);
    process.exit(p === R.length ? 0 : 1);
  } catch (e) {
    console.error('Verification error:', e.message);
    if (s1) console.error(s1.log().slice(-2000));
    if (s2) console.error(s2.log().slice(-2000));
    process.exit(1);
  } finally {
    if (s1) kill(s1.c);
    if (s2) kill(s2.c);
  }
}
main();
