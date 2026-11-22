import assert from 'node:assert/strict';
import { db } from '../server/db.ts';
import { GabahDomainService } from '../server/services.ts';

const actor = { id: 'TEST-OVERDUE-BORROWER', name: 'Overdue Return Fixture', role: 'Karyawan' };
const originalRecordAudit = GabahDomainService.recordAudit;
const assetIds = [];
const loanIds = [];

function fixture(suffix, status) {
  const asset = {
    id: `TEST-ASSET-${suffix}`,
    asset_number: `TEST-${suffix}`,
    name: `Overdue return fixture ${suffix}`,
    category_code: 'HLT',
    category_type: 'IT',
    owner_division: 'IT',
    status: 'assigned',
    condition: 'good',
    is_loanable: true,
  };
  const loan = {
    id: `TEST-LOAN-${suffix}`,
    loan_number: `TEST-LOAN-${suffix}`,
    asset_id: asset.id,
    asset_name: asset.name,
    asset_number: asset.asset_number,
    owner_division: 'IT',
    borrower_id: actor.id,
    borrower_name: actor.name,
    borrower_department: 'QA',
    borrower_phone: '-',
    purpose: 'Regression test',
    start_date: '2026-01-01T00:00:00.000Z',
    due_date: '2026-01-02T00:00:00.000Z',
    status,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.assets.push(asset);
  db.loans.push(loan);
  assetIds.push(asset.id);
  loanIds.push(loan.id);
  return { asset, loan };
}

try {
  // Keep this unit test isolated from both file and PostgreSQL persistence.
  GabahDomainService.recordAudit = () => undefined;

  const overdue = fixture('OVERDUE', 'overdue');
  const overdueResult = GabahDomainService.returnLoan(overdue.loan.id, 'poor', 'Perlu pemeriksaan teknisi', actor);
  assert.equal(overdueResult.status, 'returned');
  assert.equal(overdue.asset.status, 'damaged');
  assert.equal(overdue.asset.condition, 'poor');
  assert.ok(overdueResult.actual_returned_at);
  console.log('PASS: overdue loan can be returned and poor condition quarantines asset as damaged');

  const borrowed = fixture('BORROWED', 'borrowed');
  const borrowedResult = GabahDomainService.returnLoan(borrowed.loan.id, 'good', 'Unit lengkap', actor);
  assert.equal(borrowedResult.status, 'returned');
  assert.equal(borrowed.asset.status, 'available');
  assert.equal(borrowed.asset.condition, 'good');
  console.log('PASS: borrowed loan still returns normally and good asset becomes available');

  const approved = fixture('APPROVED', 'approved');
  assert.throws(
    () => GabahDomainService.returnLoan(approved.loan.id, 'good', 'Belum diserahterimakan', actor),
    error => error?.statusCode === 409,
  );
  assert.equal(approved.loan.status, 'approved');
  assert.equal(approved.asset.status, 'assigned');
  console.log('PASS: approved loan cannot be returned before physical handover');
} finally {
  GabahDomainService.recordAudit = originalRecordAudit;
  db.assets = db.assets.filter(asset => !assetIds.includes(asset.id));
  db.loans = db.loans.filter(loan => !loanIds.includes(loan.id));
}
