/**
 * GABAH LOAN HANDOVER/RETURN — AUTHORIZATION & STATE TRANSITION VERIFICATION
 *
 * Self-terminating: boots the compiled server bundle on a random isolated port,
 * runs the loan handover/return authorization + state-machine acceptance matrix
 * via real HTTP calls, prints a PASS/FAIL table, exits (0 = all pass).
 *
 * Covers:
 *  1. authorized handover            -> 200
 *  2. unauthorized handover          -> 403
 *  3. authorized return              -> 200 (borrower + custodian + admin)
 *  4. unauthorized return            -> 403
 *  5. invalid status transitions     -> 409 (handover from pending, double
 *                                       handover, return before handover,
 *                                       double return)
 *  6. user A cannot modify user B's loan (only by knowing the ID) -> 403
 *  7. existing valid loan workflow   -> still passes end-to-end
 *  + condition payload validation (400), denied attempts audited via the
 *    existing audit log, denied attempts never mutate the loan.
 *
 * Credentials are random, generated in-process, and never printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const results = [];
function record(test, expected, actual, pass) {
  results.push({ test, expected, actual, pass: Boolean(pass) });
}

async function req(base, method, urlPath, { token, body, headers = {} } = {}) {
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = {};
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, json };
}

async function waitForServer(base, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

function isoDatePlus(days) {
  const d = new Date(Date.now() + days * 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const serverPath = path.resolve(process.cwd(), 'dist/server.cjs');
  if (!fs.existsSync(serverPath)) {
    console.error('dist/server.cjs not found — run `npm run build` first.');
    process.exit(1);
  }

  // Isolated runtime state dir so tests never touch the repo snapshot.
  const dataDir = path.resolve(process.cwd(), 'server/data');
  const stateFile = path.join(dataDir, 'gabah_state.json');
  let backupState = null;
  if (fs.existsSync(stateFile)) {
    backupState = fs.readFileSync(stateFile, 'utf8');
    fs.rmSync(stateFile);
  }

  const PORT = 39000 + Math.floor(Math.random() * 2000);
  const base = `http://127.0.0.1:${PORT}`;
  const adminPass = crypto.randomBytes(12).toString('base64url');
  const userPass = crypto.randomBytes(12).toString('base64url');
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'development',
      GABAH_INITIAL_ADMIN_PASSWORD: adminPass,
      GABAH_INITIAL_USER_PASSWORD: userPass,
      // Neutralize inherited workspace GABAH_TEST_PASSWORD (see .env.local)
      GABAH_TEST_PASSWORD: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  child.stdout.on('data', d => { serverLog += d.toString(); });
  child.stderr.on('data', d => { serverLog += d.toString(); });

  const cleanup = () => {
    try { child.kill('SIGKILL'); } catch { /* already dead */ }
    if (backupState !== null) fs.writeFileSync(stateFile, backupState);
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });

  try {
    const up = await waitForServer(base);
    if (!up) {
      console.error('Server failed to start. Log tail:\n' + serverLog.slice(-2000));
      process.exit(1);
    }
    record('Server boots on isolated port', 'health 200', 'health 200', true);

    // ---------- Logins (canonical accounts provisioned from random env) ----------
    const login = async (email, password) => {
      const r = await req(base, 'POST', '/api/auth/login', { body: { email, password } });
      const token = r.json?.data?.token || r.json?.token || '';
      return { token, status: r.status };
    };

    const admin = await login('admin@foodstation.co.id', adminPass);
    record('Setup: admin login', 'token issued', admin.token ? 'token issued' : `HTTP ${admin.status}`, Boolean(admin.token));
    const it = await login('it.support@foodstation.co.id', userPass);
    const ga = await login('ga@foodstation.co.id', userPass);
    const karyawan = await login('hendra.w@foodstation.co.id', userPass);
    const humas = await login('humas@foodstation.co.id', userPass);
    record('Setup: custodian & staff logins (IT/GA/Karyawan/Humas)', '4 tokens', [it, ga, karyawan, humas].filter(x => x.token).length + ' tokens',
      [it, ga, karyawan, humas].every(x => x.token));
    if (!admin.token || !it.token || !ga.token || !karyawan.token || !humas.token) {
      throw new Error('Missing sessions — cannot continue.');
    }

    // User IDs (server-side directory; used for borrower scoping checks)
    const usersRes = await req(base, 'GET', '/api/users', { token: admin.token });
    const users = usersRes.json?.data || [];
    const userIdByEmail = (email) => (users.find(u => u.email === email) || {}).id || '';
    const karyawanId = userIdByEmail('hendra.w@foodstation.co.id');
    const gaId = userIdByEmail('ga@foodstation.co.id');
    record('Setup: user directory resolvable', 'ids found', `karyawan=${Boolean(karyawanId)} ga=${Boolean(gaId)}`, Boolean(karyawanId && gaId));

    // ---------- Fixtures: loanable assets for each division (admin = full access) ----------
    const mkAsset = async (category, division, name) => {
      const r = await req(base, 'POST', '/api/assets', {
        token: admin.token,
        body: { category_name_or_code: category, name, owner_division: division, is_loanable: true },
      });
      return { id: r.json?.data?.id, status: r.status };
    };
    const itAsset1 = await mkAsset('HLT', 'IT', 'LoanAuthz IT Laptop 1');
    const itAsset2 = await mkAsset('HLT', 'IT', 'LoanAuthz IT Laptop 2');
    const itAsset3 = await mkAsset('HLT', 'IT', 'LoanAuthz IT Laptop 3');
    const itAsset4 = await mkAsset('HLT', 'IT', 'LoanAuthz IT Laptop 4');
    const gaAsset1 = await mkAsset('KDR', 'GA', 'LoanAuthz GA Vehicle 1');
    const gaAsset2 = await mkAsset('KDR', 'GA', 'LoanAuthz GA Vehicle 2');
    const itAsset5 = await mkAsset('HLT', 'IT', 'LoanAuthz unavailable request fixture');
    const itAsset6 = await mkAsset('HLT', 'IT', 'LoanAuthz approval recheck fixture');
    record('Setup: 8 loanable fixtures created (6 IT + 2 GA)', 'ids issued',
      [itAsset1, itAsset2, itAsset3, itAsset4, gaAsset1, gaAsset2, itAsset5, itAsset6].filter(a => a.id).length + ' ids',
      [itAsset1, itAsset2, itAsset3, itAsset4, gaAsset1, gaAsset2, itAsset5, itAsset6].every(a => a.id));

    const patchAsset = (assetId, body) => req(base, 'PATCH', `/api/assets/${assetId}`, { token: admin.token, body });
    const setAssetStatus = (assetId, status) => patchAsset(assetId, { status });
    const invalidAssetStatus = await setAssetStatus(itAsset5.id, 'not-a-real-status');
    record('Asset update rejects unknown status values', '400', `HTTP ${invalidAssetStatus.status}`, invalidAssetStatus.status === 400);
    const invalidLoanableType = await patchAsset(itAsset5.id, { is_loanable: 'false' });
    record('Asset update requires boolean is_loanable', '400', `HTTP ${invalidLoanableType.status}`, invalidLoanableType.status === 400);
    await setAssetStatus(itAsset5.id, 'damaged');
    const unavailableRequest = await req(base, 'POST', '/api/loans', { token: karyawan.token, body: {
      asset_id: itAsset5.id, purpose: 'Unavailable asset must be rejected', start_date: isoDatePlus(1), due_date: isoDatePlus(7),
    } });
    record('Request rejects loanable asset that is not available', '409', `HTTP ${unavailableRequest.status}`, unavailableRequest.status === 409);

    const approvalRecheck = await req(base, 'POST', '/api/loans', { token: karyawan.token, body: {
      asset_id: itAsset6.id, purpose: 'Asset status recheck at approval', start_date: isoDatePlus(1), due_date: isoDatePlus(7),
    } });
    const approvalLoanId = approvalRecheck.json?.data?.id;
    await setAssetStatus(itAsset6.id, 'damaged');
    const unavailableApproval = approvalLoanId
      ? await req(base, 'POST', `/api/loans/${approvalLoanId}/approve`, { token: it.token, body: {} })
      : { status: 0 };
    const approvalLoanStatus = approvalLoanId
      ? (((await req(base, 'GET', '/api/loans', { token: admin.token })).json?.data || []).find(l => l.id === approvalLoanId) || {}).status || '(missing)'
      : '(missing)';
    record('Approval rechecks asset availability and preserves pending loan', '409 + pending_approval',
      `HTTP ${unavailableApproval.status} + ${approvalLoanStatus}`,
      unavailableApproval.status === 409 && approvalLoanStatus === 'pending_approval');
    await setAssetStatus(itAsset6.id, 'available');
    const approvalAfterRestore = approvalLoanId
      ? await req(base, 'POST', `/api/loans/${approvalLoanId}/approve`, { token: it.token, body: {} })
      : { status: 0 };
    record('Approval succeeds after asset is restored to available', '200', `HTTP ${approvalAfterRestore.status}`, approvalAfterRestore.status === 200);
    const statusEditApproved = await setAssetStatus(itAsset6.id, 'damaged');
    record('Manual status change is blocked while loan is approved', '409', `HTTP ${statusEditApproved.status}`, statusEditApproved.status === 409);
    const handoverRechecked = approvalLoanId
      ? await req(base, 'POST', `/api/loans/${approvalLoanId}/handover`, { token: it.token, body: { handoverNotes: 'Unit diserahkan setelah approval' } })
      : { status: 0 };
    record('Handover succeeds only after valid approval and reserved asset', '200 + borrowed',
      `HTTP ${handoverRechecked.status} + ${handoverRechecked.json?.data?.status}`,
      handoverRechecked.status === 200 && handoverRechecked.json?.data?.status === 'borrowed');
    const statusEditBorrowed = await setAssetStatus(itAsset6.id, 'damaged');
    record('Manual status change is blocked while loan is borrowed', '409', `HTTP ${statusEditBorrowed.status}`, statusEditBorrowed.status === 409);
    const returnRechecked = approvalLoanId
      ? await req(base, 'POST', `/api/loans/${approvalLoanId}/return`, { token: karyawan.token, body: { condition: 'good', returnNotes: 'Returned after lifecycle test' } })
      : { status: 0 };
    record('Borrower can return after handover; asset returns to available', '200 + returned',
      `HTTP ${returnRechecked.status} + ${returnRechecked.json?.data?.status}`,
      returnRechecked.status === 200 && returnRechecked.json?.data?.status === 'returned');

    const initialLoans = (await req(base, 'GET', '/api/loans', { token: admin.token })).json?.data || [];
    const invalidLoanDate = await req(base, 'POST', '/api/loans', {
      token: admin.token,
      body: { asset_id: gaAsset2.id, purpose: 'Impossible date fixture', start_date: '2026-02-31', due_date: '2026-03-07' },
    });
    const afterInvalidLoanDate = (await req(base, 'GET', '/api/loans', { token: admin.token })).json?.data || [];
    record('Impossible calendar date rejected without creating loan', '400 + no new loan',
      `HTTP ${invalidLoanDate.status} + delta ${afterInvalidLoanDate.length - initialLoans.length}`,
      invalidLoanDate.status === 400 && afterInvalidLoanDate.length === initialLoans.length);
    const invalidBorrower = await req(base, 'POST', '/api/loans', {
      token: admin.token,
      body: { asset_id: itAsset1.id, borrower_id: 'USR-NOT-FOUND', purpose: 'Invalid borrower fixture', start_date: isoDatePlus(1), due_date: isoDatePlus(7) },
    });
    const afterInvalidBorrower = (await req(base, 'GET', '/api/loans', { token: admin.token })).json?.data || [];
    record('Invalid borrower ID is rejected without fallback to admin', '404 + no new loan',
      `HTTP ${invalidBorrower.status} + delta ${afterInvalidBorrower.length - initialLoans.length}`,
      invalidBorrower.status === 404 && afterInvalidBorrower.length === initialLoans.length);

    const bulkPartial = await req(base, 'POST', '/api/loans', {
      token: admin.token,
      body: { asset_ids: [itAsset1.id, 'AST-NOT-FOUND'], borrower_id: 'USR-01', purpose: 'Atomic bulk fixture', start_date: isoDatePlus(1), due_date: isoDatePlus(7) },
    });
    const afterBulkFailure = (await req(base, 'GET', '/api/loans', { token: admin.token })).json?.data || [];
    record('Bulk request rolls back earlier valid items when a later asset is invalid', '404 + no new loans',
      `HTTP ${bulkPartial.status} + delta ${afterBulkFailure.length - initialLoans.length}`,
      bulkPartial.status === 404 && afterBulkFailure.length === initialLoans.length);

    const duplicateBulk = await req(base, 'POST', '/api/loans', {
      token: admin.token,
      body: { asset_ids: [itAsset1.id, itAsset1.id], borrower_id: 'USR-01', purpose: 'Duplicate bulk fixture', start_date: isoDatePlus(1), due_date: isoDatePlus(7) },
    });
    record('Bulk request rejects duplicate asset IDs', '400', `HTTP ${duplicateBulk.status}`, duplicateBulk.status === 400);

    const mkLoan = async (token, assetId, borrowerId) => {
      const r = await req(base, 'POST', '/api/loans', {
        token,
        body: {
          asset_id: assetId,
          ...(borrowerId ? { borrower_id: borrowerId } : {}),
          purpose: 'Regression test pinjaman',
          start_date: isoDatePlus(1),
          due_date: isoDatePlus(7),
        },
      });
      return { id: r.json?.data?.id, status: r.status };
    };
    const loanStatus = async (loanId) => {
      const r = await req(base, 'GET', '/api/loans', { token: admin.token });
      return ((r.json?.data || []).find(l => l.id === loanId) || {}).status || '(missing)';
    };

    // L1 (IT, borrower Karyawan): happy-path workflow, then double-return guard
    const L1 = await mkLoan(karyawan.token, itAsset1.id);
    // L2 (IT, borrower Karyawan): handover authorization matrix + double handover
    const L2 = await mkLoan(karyawan.token, itAsset2.id);
    // L3 (IT, borrower Karyawan): handover from pending_approval must be 409
    const L3 = await mkLoan(karyawan.token, itAsset3.id);
    // L4 (GA, borrower Karyawan): admin handover + custodian return + guards
    const L4 = await mkLoan(karyawan.token, gaAsset1.id);
    // L5 (IT, borrower GA user): cross-user protection (user A vs user B)
    const L5 = await mkLoan(ga.token, itAsset4.id, gaId);
    record('Setup: 5 loans requested', 'ids issued',
      [L1, L2, L3, L4, L5].filter(l => l.id).length + ' ids',
      [L1, L2, L3, L4, L5].every(l => l.id));

    // Approve: IT approves IT loans, GA approves GA loan
    const appr = async (loanId, token) => req(base, 'POST', `/api/loans/${loanId}/approve`, { token, body: {} });
    const aL1 = await appr(L1.id, it.token);
    const aL2 = await appr(L2.id, it.token);
    const aL4 = await appr(L4.id, ga.token);
    const aL5 = await appr(L5.id, it.token);
    record('Setup: loans approved by owner-division custodians', '200', [aL1, aL2, aL4, aL5].map(r => r.status).join(','), [aL1, aL2, aL4, aL5].every(r => r.status === 200));

    // ===================== 5. Invalid transitions (before any handover) =====================
    // Handover from pending_approval is not a valid transition.
    const hPending = await req(base, 'POST', `/api/loans/${L3.id}/handover`, { token: it.token, body: { handoverNotes: 'x' } });
    record('Invalid transition: handover on pending_approval', '409', `HTTP ${hPending.status}`, hPending.status === 409);

    // Return of a not-yet-handed-over (approved) loan is not a valid transition.
    const rApproved = await req(base, 'POST', `/api/loans/${L4.id}/return`, { token: ga.token, body: { condition: 'good', returnNotes: 'x' } });
    record('Invalid transition: return on approved (never handed over)', '409', `HTTP ${rApproved.status}`, rApproved.status === 409);

    // ===================== 2. Unauthorized handover =====================
    // Borrower (Karyawan) has no custody authority.
    const hByBorrower = await req(base, 'POST', `/api/loans/${L1.id}/handover`, { token: karyawan.token, body: { handoverNotes: 'x' } });
    record('Unauthorized handover: borrower (Karyawan) on approved IT loan', '403', `HTTP ${hByBorrower.status}`, hByBorrower.status === 403);
    // Custodian of the WRONG division (GA on an IT loan).
    const hWrongDivision = await req(base, 'POST', `/api/loans/${L1.id}/handover`, { token: ga.token, body: { handoverNotes: 'x' } });
    record('Unauthorized handover: GA custodian on IT loan', '403', `HTTP ${hWrongDivision.status}`, hWrongDivision.status === 403);
    // Plain staff (Humas) who merely knows the loan ID.
    const hHumas = await req(base, 'POST', `/api/loans/${L1.id}/handover`, { token: humas.token, body: { handoverNotes: 'x' } });
    record('Unauthorized handover: Humas (knows loan ID only)', '403', `HTTP ${hHumas.status}`, hHumas.status === 403);
    // Unauthenticated caller.
    const hAnon = await req(base, 'POST', `/api/loans/${L1.id}/handover`, { body: { handoverNotes: 'x' } });
    record('Unauthorized handover: anonymous', '401', `HTTP ${hAnon.status}`, hAnon.status === 401);

    // ===================== 1. Authorized handover =====================
    const hOk = await req(base, 'POST', `/api/loans/${L1.id}/handover`, { token: it.token, body: { handoverNotes: 'Unit diserahkan' } });
    record('Authorized handover: IT custodian on approved IT loan', '200 + borrowed',
      `HTTP ${hOk.status} + ${hOk.json?.data?.status}`, hOk.status === 200 && hOk.json?.data?.status === 'borrowed');

    // ===================== 5b. Double handover =====================
    const hDouble = await req(base, 'POST', `/api/loans/${L1.id}/handover`, { token: it.token, body: { handoverNotes: 'again' } });
    record('Invalid transition: double handover on borrowed loan', '409', `HTTP ${hDouble.status}`, hDouble.status === 409);

    // L2: authorization matrix holds for every non-custodian; then custodian succeeds.
    const h2Wrong = await req(base, 'POST', `/api/loans/${L2.id}/handover`, { token: ga.token, body: { handoverNotes: 'x' } });
    record('Unauthorized handover: GA on second IT loan (L2)', '403', `HTTP ${h2Wrong.status}`, h2Wrong.status === 403);
    const h2Ok = await req(base, 'POST', `/api/loans/${L2.id}/handover`, { token: it.token, body: { handoverNotes: 'Unit diserahkan' } });
    record('Authorized handover: IT custodian on L2', '200 + borrowed', `HTTP ${h2Ok.status} + ${h2Ok.json?.data?.status}`, h2Ok.status === 200 && h2Ok.json?.data?.status === 'borrowed');
    const statusEditBorrowedL2 = await setAssetStatus(itAsset2.id, 'damaged');
    const loanAfterStatusEditL2 = await loanStatus(L2.id);
    record('Manual asset status edit is blocked during borrowed loan L2', '409 + borrowed',
      `HTTP ${statusEditBorrowedL2.status} + ${loanAfterStatusEditL2}`,
      statusEditBorrowedL2.status === 409 && loanAfterStatusEditL2 === 'borrowed');
    const setSerial = await patchAsset(itAsset2.id, { serial_number: 'LOAN-AUTHZ-BULK-LOCK-IT2' });
    const bulkStatusBypass = await req(base, 'POST', '/api/assets/bulk-import', {
      token: admin.token,
      body: {
        allow_update: true,
        assets: [{ name: 'LoanAuthz IT Laptop 2', serial_number: 'LOAN-AUTHZ-BULK-LOCK-IT2', status: 'damaged' }],
      },
    });
    const assetAfterBulkBypass = ((await req(base, 'GET', '/api/assets', { token: admin.token })).json?.data || []).find(a => a.id === itAsset2.id);
    record('Bulk import cannot bypass active-loan asset status lock', 'failed row + remains assigned',
      `serial ${setSerial.status}, failed ${bulkStatusBypass.json?.data?.failed}, status ${assetAfterBulkBypass?.status}`,
      setSerial.status === 200 && bulkStatusBypass.status === 200
        && bulkStatusBypass.json?.data?.failed === 1 && assetAfterBulkBypass?.status === 'assigned');
    const invalidBulkStatus = await req(base, 'POST', '/api/assets/bulk-import', {
      token: admin.token,
      body: { allow_update: true, assets: [{ name: 'Invalid status fixture', serial_number: 'LOAN-AUTHZ-BULK-LOCK-IT2', status: 'not-a-status' }] },
    });
    record('Bulk import rejects unknown asset status values', 'failed row',
      `failed ${invalidBulkStatus.json?.data?.failed}`,
      invalidBulkStatus.status === 200 && invalidBulkStatus.json?.data?.failed === 1);
    const h2Double = await req(base, 'POST', `/api/loans/${L2.id}/handover`, { token: it.token, body: {} });
    record('Invalid transition: double handover on L2', '409', `HTTP ${h2Double.status}`, h2Double.status === 409);

    // ===================== 6. User A cannot modify user B's loan =====================
    // L5 is borrowed by the GA user. Hand it over first via the IT custodian
    // (valid flow), then verify Karyawan (user A) cannot hand over or return
    // it even though they know the loan ID.
    const hL5 = await req(base, 'POST', `/api/loans/${L5.id}/handover`, { token: it.token, body: { handoverNotes: 'Unit diserahkan' } });
    record('Setup: IT custodian handover on L5 (borrowed by GA user)', '200 + borrowed', `HTTP ${hL5.status} + ${hL5.json?.data?.status}`, hL5.status === 200 && hL5.json?.data?.status === 'borrowed');
    const aL5cross = await req(base, 'POST', `/api/loans/${L5.id}/handover`, { token: karyawan.token, body: { handoverNotes: 'x' } });
    record('User A cannot handover user B loan (L5)', '403', `HTTP ${aL5cross.status}`, aL5cross.status === 403);
    const rCross = await req(base, 'POST', `/api/loans/${L5.id}/return`, { token: karyawan.token, body: { condition: 'good', returnNotes: 'x' } });
    record('User A cannot return user B loan (L5)', '403', `HTTP ${rCross.status}`, rCross.status === 403);
    const rCross2 = await req(base, 'POST', `/api/loans/${L5.id}/return`, { token: humas.token, body: { condition: 'good', returnNotes: 'x' } });
    record('Unauthorized return: Humas on user B loan (L5)', '403', `HTTP ${rCross2.status}`, rCross2.status === 403);
    const l5StatusAfterDenied = await loanStatus(L5.id);
    record('Denied attempts never mutate the loan (L5 still borrowed)', 'borrowed', l5StatusAfterDenied, l5StatusAfterDenied === 'borrowed');

    // ===================== 4. Unauthorized return + 3. Authorized return =====================
    // L4 (GA loan, approved): admin handover, then custodian GA returns it.
    const hAdmin = await req(base, 'POST', `/api/loans/${L4.id}/handover`, { token: admin.token, body: { handoverNotes: 'Admin handover' } });
    record('Authorized handover: Admin GABAH on approved GA loan (L4)', '200 + borrowed', `HTTP ${hAdmin.status} + ${hAdmin.json?.data?.status}`, hAdmin.status === 200 && hAdmin.json?.data?.status === 'borrowed');

    const rGa = await req(base, 'POST', `/api/loans/${L4.id}/return`, { token: ga.token, body: { condition: 'good', returnNotes: 'Kendaraan kembali normal' } });
    record('Authorized return: GA custodian on borrowed GA loan (L4)', '200 + returned', `HTTP ${rGa.status} + ${rGa.json?.data?.status}`, rGa.status === 200 && rGa.json?.data?.status === 'returned');
    const rGaDouble = await req(base, 'POST', `/api/loans/${L4.id}/return`, { token: ga.token, body: { condition: 'good', returnNotes: 'again' } });
    record('Invalid transition: double return on returned loan (L4)', '409', `HTTP ${rGaDouble.status}`, rGaDouble.status === 409);

    // L5: the borrower (GA user) returns their OWN borrowed IT loan.
    const rBorrowerOwn = await req(base, 'POST', `/api/loans/${L5.id}/return`, { token: ga.token, body: { condition: 'good', returnNotes: 'Portal Aset Saya' } });
    record('Authorized return: borrower returns own borrowed loan (L5)', '200 + returned', `HTTP ${rBorrowerOwn.status} + ${rBorrowerOwn.json?.data?.status}`, rBorrowerOwn.status === 200 && rBorrowerOwn.json?.data?.status === 'returned');

    // ===================== 7. Existing valid workflow + condition validation =====================
    // L1 full lifecycle: request -> approve -> handover -> (bad condition 400) -> return.
    const rBadCond = await req(base, 'POST', `/api/loans/${L1.id}/return`, { token: karyawan.token, body: { condition: 'hacked', returnNotes: 'x' } });
    record('Invalid condition payload rejected', '400', `HTTP ${rBadCond.status}`, rBadCond.status === 400);
    const rBorrower = await req(base, 'POST', `/api/loans/${L1.id}/return`, { token: karyawan.token, body: { condition: 'good', returnNotes: 'Lengkap' } });
    record('Authorized return: borrower returns own loan (L1)', '200 + returned', `HTTP ${rBorrower.status} + ${rBorrower.json?.data?.status}`, rBorrower.status === 200 && rBorrower.json?.data?.status === 'returned');
    const rDouble = await req(base, 'POST', `/api/loans/${L1.id}/return`, { token: karyawan.token, body: { condition: 'good', returnNotes: 'again' } });
    record('Invalid transition: double return on L1', '409', `HTTP ${rDouble.status}`, rDouble.status === 409);

    // Final lifecycle states for L1/L4/L5 must be 'returned'; L2 stays 'borrowed'.
    const l1 = await loanStatus(L1.id);
    const l2 = await loanStatus(L2.id);
    const l4 = await loanStatus(L4.id);
    const l5 = await loanStatus(L5.id);
    record('Existing valid loan workflow end-to-end', 'returned/borrowed/returned/returned', `${l1}/${l2}/${l4}/${l5}`,
      l1 === 'returned' && l2 === 'borrowed' && l4 === 'returned' && l5 === 'returned');

    // ===================== 10. Audit trail (existing mechanism) =====================
    const logs = await req(base, 'GET', '/api/audit-logs', { token: admin.token });
    const entries = logs.json?.data || [];
    const has = (action, entityId) => entries.some(e => e.action === action && (!entityId || e.entity_id === entityId));
    record('Audit: LOAN_HANDOVER success recorded', 'logged', has('LOAN_HANDOVER', L1.id) ? 'logged' : 'missing', has('LOAN_HANDOVER', L1.id));
    record('Audit: LOAN_RETURNED success recorded', 'logged', has('LOAN_RETURNED', L4.id) ? 'logged' : 'missing', has('LOAN_RETURNED', L4.id));
    record('Audit: LOAN_HANDOVER_DENIED recorded', 'logged', has('LOAN_HANDOVER_DENIED', L1.id) ? 'logged' : 'missing', has('LOAN_HANDOVER_DENIED', L1.id));
    record('Audit: LOAN_HANDOVER_INVALID_STATE recorded', 'logged', has('LOAN_HANDOVER_INVALID_STATE', L3.id) ? 'logged' : 'missing', has('LOAN_HANDOVER_INVALID_STATE', L3.id));
    record('Audit: LOAN_RETURN_DENIED recorded', 'logged', has('LOAN_RETURN_DENIED', L5.id) ? 'logged' : 'missing', has('LOAN_RETURN_DENIED', L5.id));
    record('Audit: LOAN_RETURN_INVALID_STATE recorded', 'logged', has('LOAN_RETURN_INVALID_STATE', L4.id) ? 'logged' : 'missing', has('LOAN_RETURN_INVALID_STATE', L4.id));

    // ===================== Borrower deletion integrity =====================
    const deletionTarget = await req(base, 'POST', '/api/users', {
      token: admin.token,
      body: {
        name: 'Loan Deletion Integrity Fixture',
        email: `loan-delete-${Date.now()}@example.test`,
        role: 'Karyawan',
        division: 'Umum',
        department: 'QA Fixture',
      },
    });
    const deletionTargetId = deletionTarget.json?.data?.id;
    record('Setup: temporary borrower for deletion test', '201 + user ID',
      `HTTP ${deletionTarget.status} + ${Boolean(deletionTargetId)}`,
      deletionTarget.status === 201 && Boolean(deletionTargetId));

    const deletionLoan = deletionTargetId
      ? await req(base, 'POST', '/api/loans', {
          token: admin.token,
          body: {
            asset_id: gaAsset2.id,
            borrower_id: deletionTargetId,
            purpose: 'Deletion must not fabricate a physical return',
            start_date: isoDatePlus(1),
            due_date: isoDatePlus(7),
          },
        })
      : { status: 0, json: {} };
    const deletionLoanId = deletionLoan.json?.data?.id;
    const deletionApproved = deletionLoanId
      ? await req(base, 'POST', `/api/loans/${deletionLoanId}/approve`, { token: ga.token, body: {} })
      : { status: 0 };
    const deletionHandedOver = deletionLoanId
      ? await req(base, 'POST', `/api/loans/${deletionLoanId}/handover`, { token: ga.token, body: { handoverNotes: 'Physical handover fixture' } })
      : { status: 0 };
    record('Setup: deletion fixture loan reaches borrowed state', '201/200/200',
      `request ${deletionLoan.status}, approve ${deletionApproved.status}, handover ${deletionHandedOver.status}`,
      deletionLoan.status === 201 && deletionApproved.status === 200 && deletionHandedOver.status === 200);

    const deletionAttempt = deletionTargetId
      ? await req(base, 'DELETE', `/api/users/${deletionTargetId}`, { token: admin.token })
      : { status: 0 };
    const userAfterDeleteAttempt = (await req(base, 'GET', '/api/users', { token: admin.token })).json?.data || [];
    const loansAfterDeleteAttempt = (await req(base, 'GET', '/api/loans', { token: admin.token })).json?.data || [];
    const assetsAfterDeleteAttempt = (await req(base, 'GET', '/api/assets', { token: admin.token })).json?.data || [];
    const preservedLoan = loansAfterDeleteAttempt.find(l => l.id === deletionLoanId);
    const preservedAsset = assetsAfterDeleteAttempt.find(a => a.id === gaAsset2.id);
    record('Delete user with borrowed loan is blocked without mutating loan or asset', '409 + user retained + borrowed + assigned',
      `HTTP ${deletionAttempt.status}, user ${userAfterDeleteAttempt.some(u => u.id === deletionTargetId)}, loan ${preservedLoan?.status}, asset ${preservedAsset?.status}`,
      deletionAttempt.status === 409
        && userAfterDeleteAttempt.some(u => u.id === deletionTargetId)
        && preservedLoan?.status === 'borrowed'
        && preservedAsset?.status === 'assigned');

    // A separate employee with assigned custody but no active loan must
    // also complete an audited transfer before deactivation/deletion.
    const custodyTarget = await req(base, 'POST', '/api/users', {
      token: admin.token,
      body: {
        name: 'Asset Custody Deletion Fixture',
        email: `asset-custody-delete-${Date.now()}@example.test`,
        role: 'Karyawan',
        division: 'Umum',
        department: 'QA Fixture',
      },
    });
    const custodyUserId = custodyTarget.json?.data?.id;
    const custodyAssign = custodyUserId
      ? await req(base, 'POST', `/api/assets/${itAsset4.id}/assign`, {
          token: admin.token,
          body: { targetUserId: custodyUserId, reason: 'Custody deletion regression fixture' },
        })
      : { status: 0 };
    const deactivateCustody = custodyUserId
      ? await req(base, 'PATCH', `/api/users/${custodyUserId}`, { token: admin.token, body: { is_active: false } })
      : { status: 0 };
    const deleteCustody = custodyUserId
      ? await req(base, 'DELETE', `/api/users/${custodyUserId}`, { token: admin.token })
      : { status: 0 };
    const custodyUsers = (await req(base, 'GET', '/api/users', { token: admin.token })).json?.data || [];
    const custodyAssets = (await req(base, 'GET', '/api/assets', { token: admin.token })).json?.data || [];
    const custodyAssetAfter = custodyAssets.find(a => a.id === itAsset4.id);
    record('Assigned asset blocks deactivation and deletion without custody transfer', '409 + assigned user retained',
      `assign ${custodyAssign.status}, deactivate ${deactivateCustody.status}, delete ${deleteCustody.status}, custodian ${custodyAssetAfter?.assigned_to?.id}`,
      custodyAssign.status === 200 && deactivateCustody.status === 409 && deleteCustody.status === 409
        && custodyUsers.some(u => u.id === custodyUserId)
        && custodyAssetAfter?.assigned_to?.id === custodyUserId);

    // ---------- Summary ----------
    const total = results.length;
    const passed = results.filter(r => r.pass).length;
    console.log('\n=== LOAN AUTHORIZATION & STATE TRANSITION VERIFY ===');
    for (const r of results) {
      console.log(`${r.pass ? 'PASS' : 'FAIL'} | ${r.test} | expected: ${r.expected} | actual: ${r.actual}`);
    }
    console.log(`TOTAL: ${total} | PASS: ${passed} | FAIL: ${total - passed}`);
    process.exit(total === passed ? 0 : 1);
  } catch (err) {
    console.error('Verification error:', err.message);
    console.error('Server log tail:\n' + serverLog.slice(-1500));
    process.exit(1);
  }
}

main();
