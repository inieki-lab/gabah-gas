import 'dotenv/config';
import { getDbPool } from '../server/persistence';

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function recordTest(suite: string, name: string, passed: boolean, error?: string, details?: any) {
  results.push({ suite, name, passed, error, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${suite}] ${name}${error ? ` -> ${error}` : ''}`);
}

async function api(path: string, options: RequestInit = {}, token?: string, customIp: string = '10.10.10.10') {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Forwarded-For': customIp,
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
  let body: any = null;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, headers: res.headers, body };
}

async function runAllTests() {
  console.log('\n==================================================');
  console.log('🚀 GABAH-GAS ENTERPRISE CORE MODULE VERIFICATION');
  console.log('==================================================\n');

  // ==========================================
  // 1. AUTHENTICATION & SESSION TESTS
  // ==========================================
  console.log('--- 1. Authentication & Session Module ---');
  let adminToken = '';
  let itToken = '';
  let gaToken = '';
  let scToken = '';
  let pibcToken = '';
  let karyawanToken = '';
  let auditorToken = '';

  // 1.1 Login with valid Admin GABAH credentials
  {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin.gabah@foodstation.co.id', password: 'AdminGabah#2026' }),
    });
    const token = res.body?.data?.token;
    const ok = res.status === 200 && res.body?.success && token && res.body?.data?.user?.role === 'Admin GABAH';
    if (ok) adminToken = token;
    recordTest('Auth', 'Valid Admin GABAH Login & Token Generation', ok, ok ? undefined : JSON.stringify(res.body));
  }

  // 1.2 Access /api/auth/me with valid Bearer token
  {
    const res = await api('/api/auth/me', { method: 'GET' }, adminToken);
    const ok = res.status === 200 && res.body?.data?.email === 'admin.gabah@foodstation.co.id';
    recordTest('Auth', 'Access /api/auth/me with valid Bearer token', ok, ok ? undefined : `Status: ${res.status}, Body: ${JSON.stringify(res.body)}`);
  }

  // 1.3 Access /api/auth/me without token or with invalid token
  {
    const resNoToken = await api('/api/auth/me', { method: 'GET' });
    const resBadToken = await api('/api/auth/me', { method: 'GET' }, 'invalid-fake-session-token');
    const ok = resNoToken.status === 401 && resBadToken.status === 401;
    recordTest('Auth', 'Reject unauthenticated /api/auth/me with 401', ok, ok ? undefined : `resNoToken: ${resNoToken.status}, resBadToken: ${resBadToken.status}`);
  }

  // 1.4 Login with invalid password
  {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin.gabah@foodstation.co.id', password: 'WrongPassword123!' }),
    });
    const ok = res.status === 401 && !res.body?.success;
    recordTest('Auth', 'Reject invalid password with 401', ok, ok ? undefined : `Status: ${res.status}`);
  }

  // 1.5 Account lockout on repeated failures using isolated test IP
  {
    const lockoutTestIp = '198.51.100.77';
    let locked = false;
    for (let i = 0; i < 6; i++) {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin.gabah@foodstation.co.id', password: 'WrongPassword!' }),
      }, undefined, lockoutTestIp);
      if (res.status === 429) {
        locked = true;
        break;
      }
    }
    recordTest('Auth', 'Account lockout triggers (429) after 5 consecutive failures', locked, locked ? undefined : 'Lockout not triggered');
  }

  // 1.6 Login for other canonical roles
  {
    const itRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'faisal.it@foodstation.co.id', password: 'ItStaff#2026' }),
    });
    if (itRes.status === 200) itToken = itRes.body?.data?.token;
    recordTest('Auth', 'IT Login', itRes.status === 200 && itRes.body?.data?.user?.role === 'IT', itRes.status === 200 ? undefined : JSON.stringify(itRes.body));

    const gaRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'siti.ga@foodstation.co.id', password: 'GaStaff#2026' }),
    });
    if (gaRes.status === 200) gaToken = gaRes.body?.data?.token;
    recordTest('Auth', 'GA Login', gaRes.status === 200 && gaRes.body?.data?.user?.role === 'GA', gaRes.status === 200 ? undefined : JSON.stringify(gaRes.body));

    const scRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'bambang.sc@foodstation.co.id', password: 'ScStaff#2026' }),
    });
    if (scRes.status === 200) scToken = scRes.body?.data?.token;
    recordTest('Auth', 'Supply Chain Login', scRes.status === 200 && scRes.body?.data?.user?.role === 'Supply Chain', scRes.status === 200 ? undefined : JSON.stringify(scRes.body));

    const pibcRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'joko.pibc@foodstation.co.id', password: 'PibcStaff#2026' }),
    });
    if (pibcRes.status === 200) pibcToken = pibcRes.body?.data?.token;
    recordTest('Auth', 'PIBC Login', pibcRes.status === 200 && pibcRes.body?.data?.user?.role === 'PIBC', pibcRes.status === 200 ? undefined : JSON.stringify(pibcRes.body));

    const kryRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'dewi.lestari@foodstation.co.id', password: 'Karyawan#2026' }),
    });
    if (kryRes.status === 200) karyawanToken = kryRes.body?.data?.token;
    recordTest('Auth', 'Karyawan Login', kryRes.status === 200 && kryRes.body?.data?.user?.role === 'Karyawan', kryRes.status === 200 ? undefined : JSON.stringify(kryRes.body));

    const audRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'hendro.auditor@foodstation.co.id', password: 'Auditor#2026' }),
    });
    if (audRes.status === 200) auditorToken = audRes.body?.data?.token;
    recordTest('Auth', 'Auditor Login', audRes.status === 200 && audRes.body?.data?.user?.role === 'Auditor', audRes.status === 200 ? undefined : JSON.stringify(audRes.body));
  }

  // 1.7 Logout test
  {
    const tempLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin.gabah@foodstation.co.id', password: 'AdminGabah#2026' }),
    });
    const tempToken = tempLogin.body?.data?.token;
    const logoutRes = await api('/api/auth/logout', { method: 'POST' }, tempToken);
    const afterLogout = await api('/api/auth/me', { method: 'GET' }, tempToken);
    const ok = logoutRes.status === 200 && afterLogout.status === 401;
    recordTest('Auth', 'Logout invalidates session token', ok, ok ? undefined : `Logout status: ${logoutRes.status}, Me after: ${afterLogout.status}`);
  }

  // ==========================================
  // 2. RBAC & ROLE AUTHORIZATION TESTS
  // ==========================================
  console.log('\n--- 2. RBAC & Role Authorization Module ---');

  // 2.1 Auditor Read-Only Enforcement
  {
    // Auditor creates asset -> MUST 403
    const resCreate = await api('/api/assets', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Auditor Forbidden Asset',
        category_code: 'HLT',
        owner_division: 'IT',
        brand: 'Apple',
        model: 'MacBook Pro',
        location: 'Lt. 3',
      }),
    }, auditorToken);
    const okCreate = resCreate.status === 403;
    recordTest('RBAC', 'Auditor blocked from creating assets (403)', okCreate, okCreate ? undefined : `Status: ${resCreate.status}`);

    // Auditor updates ticket status -> MUST 403
    const resTicket = await api('/api/tickets/TKT-001/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'resolved' }),
    }, auditorToken);
    const okTicket = resTicket.status === 403;
    recordTest('RBAC', 'Auditor blocked from mutating tickets (403)', okTicket, okTicket ? undefined : `Status: ${resTicket.status}`);

    // Auditor creates maintenance schedule -> MUST 403
    const resMnt = await api('/api/maintenances', {
      method: 'POST',
      body: JSON.stringify({
        asset_id: 'AST-HSV-001',
        title: 'Auditor Forbidden Maintenance',
      }),
    }, auditorToken);
    const okMnt = resMnt.status === 403;
    recordTest('RBAC', 'Auditor blocked from scheduling maintenance (403)', okMnt, okMnt ? undefined : `Status: ${resMnt.status}`);

    // Auditor reads assets -> MUST 200
    const resRead = await api('/api/assets', { method: 'GET' }, auditorToken);
    const okRead = resRead.status === 200 && Array.isArray(resRead.body?.data);
    recordTest('RBAC', 'Auditor permitted to read assets (200)', okRead, okRead ? undefined : `Status: ${resRead.status}`);
  }

  // 2.2 Karyawan Self-Service Scoping
  {
    // Karyawan creates asset -> MUST 403
    const resCreate = await api('/api/assets', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Karyawan Forbidden Asset',
        category_code: 'HLT',
        owner_division: 'IT',
        brand: 'Apple',
        model: 'MacBook Pro',
        location: 'Lt. 3',
      }),
    }, karyawanToken);
    const ok = resCreate.status === 403;
    recordTest('RBAC', 'Karyawan blocked from registering assets (403)', ok, ok ? undefined : `Status: ${resCreate.status}`);

    // Karyawan updates asset -> MUST 403
    const resPatch = await api('/api/assets/AST-HLT-001', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Hacked Asset Name' }),
    }, karyawanToken);
    const okPatch = resPatch.status === 403;
    recordTest('RBAC', 'Karyawan blocked from updating assets (403)', okPatch, okPatch ? undefined : `Status: ${resPatch.status}`);
  }

  // 2.3 Division Scoping (IT cannot mutate GA asset, GA cannot mutate IT asset)
  {
    // IT staff updates GA asset (AST-KDR-001) -> MUST 403
    const itOnGa = await api('/api/assets/AST-KDR-001', {
      method: 'PATCH',
      body: JSON.stringify({ notes: 'IT modifying GA car' }),
    }, itToken);
    const okItOnGa = itOnGa.status === 403;
    recordTest('RBAC', 'IT staff blocked from modifying GA assets (403)', okItOnGa, okItOnGa ? undefined : `Status: ${itOnGa.status}`);

    // GA staff updates IT asset (AST-HLT-001) -> MUST 403
    const gaOnIt = await api('/api/assets/AST-HLT-001', {
      method: 'PATCH',
      body: JSON.stringify({ notes: 'GA modifying IT laptop' }),
    }, gaToken);
    const okGaOnIt = gaOnIt.status === 403;
    recordTest('RBAC', 'GA staff blocked from modifying IT assets (403)', okGaOnIt, okGaOnIt ? undefined : `Status: ${gaOnIt.status}`);

    // Admin GABAH updates IT asset -> MUST 200
    const adminOnIt = await api('/api/assets/AST-HLT-001', {
      method: 'PATCH',
      body: JSON.stringify({ notes: 'Admin GABAH verified asset' }),
    }, adminToken);
    const okAdmin = adminOnIt.status === 200;
    recordTest('RBAC', 'Admin GABAH can modify assets across all divisions (200)', okAdmin, okAdmin ? undefined : `Status: ${adminOnIt.status}`);
  }

  // ==========================================
  // 3. ASSET MANAGEMENT & NUMBERING TESTS
  // ==========================================
  console.log('\n--- 3. Asset Management & Numbering Module ---');
  let createdAssetId = '';
  let createdAssetNumber = '';

  // 3.1 Create IT asset and verify numbering format {OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}
  {
    const uniqueSerial = `SN-IT-${Date.now()}`;
    const uniqueCorpNo = `ERP-${Date.now()}`;
    const res = await api('/api/assets', {
      method: 'POST',
      body: JSON.stringify({
        name: 'ThinkPad X1 Carbon Gen 11 IT QA Test',
        category_code: 'HLT',
        category_name: 'Hardware Laptop',
        category_type: 'IT',
        owner_division: 'IT',
        brand: 'Lenovo',
        model: 'ThinkPad X1 Carbon',
        serial_number: uniqueSerial,
        corporate_asset_number: uniqueCorpNo,
        specifications: 'Intel Core i7, 32GB RAM, 1TB SSD',
        location: 'Gedung Induk Lt. 2 - Ruang IT',
        condition: 'good',
        status: 'active',
        is_loanable: true,
        purchase_price: 28500000,
        purchase_date: '2026-01-15',
      }),
    }, itToken);

    const asset = res.body?.data;
    const ok = res.status === 201 && asset && /^IT-HLT-2026-\d{4}$/.test(asset.asset_number);
    if (ok) {
      createdAssetId = asset.id;
      createdAssetNumber = asset.asset_number;
    }
    recordTest('Asset & Numbering', `IT Asset Creation & Numbering Format (${asset?.asset_number})`, ok, ok ? undefined : `Status: ${res.status}, Body: ${JSON.stringify(res.body)}`);
  }

  // 3.2 Create GA asset and verify numbering format {GA}-{KDR}-{YEAR}-{SEQUENCE}
  {
    const uniqueSerial = `SN-GA-${Date.now()}`;
    const res = await api('/api/assets', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Mitsubishi L300 Box Operasional QA',
        category_code: 'KDR',
        category_name: 'Kendaraan Operasional',
        category_type: 'GA',
        owner_division: 'GA',
        brand: 'Mitsubishi',
        model: 'L300 Box',
        serial_number: uniqueSerial,
        specifications: 'Diesel 2500cc',
        location: 'Pool Kendaraan Cipinang',
        condition: 'good',
        status: 'active',
        is_loanable: true,
        purchase_price: 240000000,
        purchase_date: '2026-02-10',
      }),
    }, gaToken);

    const asset = res.body?.data;
    const ok = res.status === 201 && asset && /^GA-KDR-2026-\d{4}$/.test(asset.asset_number);
    recordTest('Asset & Numbering', `GA Asset Creation & Numbering Format (${asset?.asset_number})`, ok, ok ? undefined : `Status: ${res.status}, Body: ${JSON.stringify(res.body)}`);
  }

  // 3.3 Reject duplicate serial number
  {
    const res = await api('/api/assets', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Duplicate Serial Asset',
        category_code: 'HLT',
        category_name: 'Hardware Laptop',
        category_type: 'IT',
        owner_division: 'IT',
        brand: 'Lenovo',
        model: 'ThinkPad',
        serial_number: 'PF-4X89K2', // Existing from seed AST-HLT-001
        location: 'Ruang IT',
      }),
    }, itToken);
    const ok = res.status === 400 && res.body?.message?.includes('Nomor Seri');
    recordTest('Asset & Numbering', 'Duplicate Serial Number Rejection (400)', ok, ok ? undefined : `Status: ${res.status}, Msg: ${res.body?.message}`);
  }

  // 3.4 Reject duplicate corporate asset number (Accurate / ERP)
  {
    const res = await api('/api/assets', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Duplicate Corp Asset',
        category_code: 'HLT',
        category_name: 'Hardware Laptop',
        category_type: 'IT',
        owner_division: 'IT',
        brand: 'Lenovo',
        model: 'ThinkPad',
        serial_number: `SN-UNIQUE-${Date.now()}`,
        corporate_asset_number: 'FST-24-0012', // Existing from seed AST-HLT-001
        location: 'Ruang IT',
      }),
    }, itToken);
    const ok = res.status === 400 && res.body?.message?.includes('Accurate/ERP');
    recordTest('Asset & Numbering', 'Duplicate Corporate ERP Number Rejection (400)', ok, ok ? undefined : `Status: ${res.status}, Msg: ${res.body?.message}`);
  }

  // 3.5 Reject duplicate serial on PATCH
  {
    const res = await api(`/api/assets/${createdAssetId}`, {
      method: 'PATCH',
      body: JSON.stringify({ serial_number: 'PF-4X89K2' }),
    }, itToken);
    const ok = res.status === 400;
    recordTest('Asset & Numbering', 'Update Asset with duplicate Serial Number Rejection (400)', ok, ok ? undefined : `Status: ${res.status}`);
  }

  // ==========================================
  // 4. LOAN ANTI-COLLISION & TRIGGER TESTS
  // ==========================================
  console.log('\n--- 4. Loan Anti-Collision & Database Trigger Module ---');

  // 4.1 Create initial loan on loanable asset (using fresh createdAssetId)
  let testLoanAssetId = createdAssetId || 'AST-HLT-002';
  const nowMs = Date.now();
  const startMs = nowMs + 100 * 86400000;
  const dueMs = startMs + 4 * 86400000;
  const overlapStartMs = startMs + 2 * 86400000;
  const overlapDueMs = dueMs + 2 * 86400000;
  const testStartDate = new Date(startMs).toISOString();
  const testDueDate = new Date(dueMs).toISOString();
  const testOverlapStart = new Date(overlapStartMs).toISOString();
  const testOverlapDue = new Date(overlapDueMs).toISOString();

  {
    const resLoan1 = await api('/api/loans', {
      method: 'POST',
      body: JSON.stringify({
        asset_id: testLoanAssetId,
        purpose: 'UAT Testing Slot A',
        start_date: testStartDate,
        due_date: testDueDate,
      }),
    }, karyawanToken);
    const okLoan1 = resLoan1.status === 201 && resLoan1.body?.data?.loan_number;
    recordTest('Loan Collision', 'Create valid first loan reservation (201)', okLoan1, okLoan1 ? undefined : `Status: ${resLoan1.status}, Msg: ${resLoan1.body?.message}`);

    // 4.2 Overlapping loan reservation MUST be blocked by domain engine / trigger
    const resLoanCollision = await api('/api/loans', {
      method: 'POST',
      body: JSON.stringify({
        asset_id: testLoanAssetId,
        purpose: 'UAT Overlapping Slot B Collision Test',
        start_date: testOverlapStart,
        due_date: testOverlapDue,
      }),
    }, karyawanToken);
    const okCollision = resLoanCollision.status === 400 && (
      resLoanCollision.body?.message?.includes('Tabrakan') ||
      resLoanCollision.body?.message?.includes('direservasi') ||
      resLoanCollision.body?.message?.includes('bertubrukan')
    );
    recordTest('Loan Collision', 'Overlapping Loan Reservation Blocked (400 anti-collision)', okCollision, okCollision ? undefined : `Status: ${resLoanCollision.status}, Msg: ${resLoanCollision.body?.message}`);
  }

  // 4.3 Direct PostgreSQL Database Trigger Verification for trg_check_loan_schedule_collision
  {
    const pool = getDbPool();
    let triggerCaught = false;
    try {
      await pool.query(
        `INSERT INTO loans (id, loan_number, asset_id, borrower_id, purpose, start_date, due_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          `LOAN-SQL-COLLISION-${Date.now()}`,
          `LOAN-2026-9999`,
          testLoanAssetId,
          'USR-06',
          'SQL Injection Collision Test',
          testOverlapStart,
          testOverlapDue,
          'approved'
        ]
      );
    } catch (err: any) {
      if (err.message?.includes('Tabrakan Jadwal') || err.message?.includes('Jadwal peminjaman bertubrukan') || err.code === 'P0001') {
        triggerCaught = true;
      }
    }
    recordTest('Loan Collision', 'PostgreSQL DB-Level Trigger trg_check_loan_schedule_collision Enforced', triggerCaught, triggerCaught ? undefined : 'DB trigger did not throw exception on overlapping reservation');
  }

  // ==========================================
  // 5. HELPDESK & SLA ENGINE TESTS
  // ==========================================
  console.log('\n--- 5. Helpdesk & SLA Engine Module ---');
  let createdTicketId = '';

  // 5.1 Ticket creation and SLA calculation
  {
    // Urgent priority -> SLA 4 hours
    const urgentRes = await api('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Core Switch Lt. 2 Down',
        description: 'Jaringan gudang terputus',
        category: 'IT',
        priority: 'urgent',
        related_asset_id: 'AST-HSV-001',
      }),
    }, karyawanToken);
    const urgentTkt = urgentRes.body?.data;
    const okUrgent = urgentRes.status === 201 && urgentTkt?.sla_hours === 4 && /^TKT-2026-\d{4}$/.test(urgentTkt?.ticket_number);
    recordTest('Helpdesk SLA', `Ticket 'urgent' priority assigns 4 hours SLA (${urgentTkt?.ticket_number})`, okUrgent, okUrgent ? undefined : `SLA Hours: ${urgentTkt?.sla_hours}`);

    // High priority -> SLA 8 hours
    const highRes = await api('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Printer Barcode Cipinang Rusak',
        description: 'Label beras tidak dapat dicetak',
        category: 'IT',
        priority: 'high',
      }),
    }, karyawanToken);
    const okHigh = highRes.status === 201 && highRes.body?.data?.sla_hours === 8;
    recordTest('Helpdesk SLA', "Ticket 'high' priority assigns 8 hours SLA", okHigh);

    // Medium priority -> SLA 24 hours
    const medRes = await api('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Instalasi Driver Scanner Baru',
        description: 'Mohon instalasi scanner',
        category: 'IT',
        priority: 'medium',
      }),
    }, karyawanToken);
    const okMed = medRes.status === 201 && medRes.body?.data?.sla_hours === 24;
    recordTest('Helpdesk SLA', "Ticket 'medium' priority assigns 24 hours SLA", okMed);

    // Low priority -> SLA 48 hours
    const lowRes = await api('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Penggantian Mouse Pad',
        description: 'Mouse pad usang',
        category: 'General',
        priority: 'low',
      }),
    }, karyawanToken);
    const okLow = lowRes.status === 201 && lowRes.body?.data?.sla_hours === 48;
    recordTest('Helpdesk SLA', "Ticket 'low' priority assigns 48 hours SLA", okLow);

    createdTicketId = urgentTkt?.id;
  }

  // 5.2 Ticket lifecycle transitions (in_progress -> resolved)
  {
    const inProgRes = await api(`/api/tickets/${createdTicketId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'in_progress' }),
    }, itToken);
    const okInProg = inProgRes.status === 200 && inProgRes.body?.data?.status === 'in_progress';

    const resResolved = await api(`/api/tickets/${createdTicketId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'resolved', resolutionNotes: 'SFP Module diganti baru.' }),
    }, itToken);
    const okResolved = resResolved.status === 200 && resResolved.body?.data?.status === 'resolved' && !!resResolved.body?.data?.resolved_at;
    recordTest('Helpdesk SLA', 'Ticket lifecycle transitions (open -> in_progress -> resolved)', okInProg && okResolved);
  }

  // ==========================================
  // 6. MAINTENANCE SCHEDULING TESTS
  // ==========================================
  console.log('\n--- 6. Maintenance Scheduling Module ---');
  let createdMntId = '';

  // 6.1 Create valid maintenance schedule linked to asset
  {
    const res = await api('/api/maintenances', {
      method: 'POST',
      body: JSON.stringify({
        asset_id: 'AST-HSV-001',
        title: 'Servis Berkala & Pembersihan Fan Server Dell PowerEdge',
        scheduled_date: '2026-10-15',
        frequency: 'quarterly',
        technician_name: 'Vendor Dell ProSupport',
        estimated_cost: 3500000,
      }),
    }, itToken);
    const mnt = res.body?.data;
    const ok = res.status === 201 && mnt && mnt.asset_id === 'AST-HSV-001' && /^MNT-2026-\d{3}$/.test(mnt.schedule_code);
    if (ok) createdMntId = mnt.id;
    recordTest('Maintenance', `Schedule maintenance with asset link (${mnt?.schedule_code})`, ok, ok ? undefined : `Status: ${res.status}, Body: ${JSON.stringify(res.body)}`);
  }

  // 6.2 Maintenance schedule creation without asset_id must be rejected (400)
  {
    const res = await api('/api/maintenances', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Orphan Maintenance Schedule',
        scheduled_date: '2026-10-15',
      }),
    }, itToken);
    const ok = res.status === 400;
    recordTest('Maintenance', 'Reject maintenance without asset_id (400)', ok, ok ? undefined : `Status: ${res.status}`);
  }

  // 6.3 Maintenance schedule creation on non-existent asset must be rejected (400)
  {
    const res = await api('/api/maintenances', {
      method: 'POST',
      body: JSON.stringify({
        asset_id: 'NON-EXISTENT-AST-ID',
        title: 'Phantom Asset Maintenance',
      }),
    }, itToken);
    const ok = res.status === 400;
    recordTest('Maintenance', 'Reject maintenance for non-existent asset (400)', ok, ok ? undefined : `Status: ${res.status}`);
  }

  // 6.4 Update maintenance status to completed
  {
    const res = await api(`/api/maintenances/${createdMntId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed', actual_cost: 3200000 }),
    }, itToken);
    const ok = res.status === 200 && res.body?.data?.status === 'completed' && !!res.body?.data?.last_completed_at;
    recordTest('Maintenance', 'Complete maintenance schedule with timestamp & cost update', ok, ok ? undefined : `Status: ${res.status}`);
  }

  // ==========================================
  // 7. AUDIT LOG & POSTGRESQL PERSISTENCE TESTS
  // ==========================================
  console.log('\n--- 7. Audit Trail & PostgreSQL Persistence Module ---');

  // 7.1 Verify audit logs via API
  {
    const res = await api('/api/audit-logs', { method: 'GET' }, adminToken);
    const logs = res.body?.data;
    const hasAssetUpdated = logs?.some((l: any) => l.action === 'ASSET_UPDATED');
    const hasMaintenance = logs?.some((l: any) => l.action === 'MAINTENANCE_SCHEDULED');
    const hasTicketStatus = logs?.some((l: any) => l.action === 'TICKET_STATUS_UPDATED');
    const ok = res.status === 200 && Array.isArray(logs) && hasAssetUpdated && hasMaintenance && hasTicketStatus;
    recordTest('Audit & Persistence', 'Critical events logged in Audit Trail API', ok, ok ? undefined : `Logs count: ${logs?.length}`);
  }

  // 7.2 Verify PostgreSQL normalized tables & persistence
  {
    const pool = getDbPool();
    // Wait a brief moment for async pg queue
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check asset in PostgreSQL
    const astQuery = await pool.query("SELECT * FROM assets WHERE id = $1", [createdAssetId]);
    const okAst = astQuery.rows.length > 0 && astQuery.rows[0].asset_number === createdAssetNumber;
    recordTest('Audit & Persistence', 'Created asset persisted to PostgreSQL normalized assets table', okAst, okAst ? undefined : 'Asset not found in pg');

    // Check audit_logs in PostgreSQL
    const auditQuery = await pool.query("SELECT * FROM audit_logs WHERE action = 'MAINTENANCE_SCHEDULED' LIMIT 1");
    const okAudit = auditQuery.rows.length > 0;
    recordTest('Audit & Persistence', 'Audit logs persisted to PostgreSQL audit_logs table', okAudit, okAudit ? undefined : 'No audit in pg');

    // Check state payload
    const stateQuery = await pool.query("SELECT payload FROM gabah_state WHERE id = 1");
    const okState = stateQuery.rows.length > 0 && stateQuery.rows[0].payload?.assets?.length > 0;
    recordTest('Audit & Persistence', 'Complete state payload stored in gabah_state table', okState);
  }

  // ==========================================
  // SUMMARY REPORT
  // ==========================================
  console.log('\n==================================================');
  console.log('📊 TEST EXECUTION SUMMARY');
  console.log('==================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`TOTAL TESTS: ${total}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${failed}`);
  console.log('==================================================\n');

  if (failed > 0) {
    console.error('❌ SOME TESTS FAILED:');
    results.filter(r => !r.passed).forEach(r => {
      console.error(`- [${r.suite}] ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('🎉 ALL CORE MODULE TESTS PASSED GREEN WITH 100% SUCCESS!');
    process.exit(0);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
