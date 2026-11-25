const PENDING_LOAN_STATUSES = new Set(['pending', 'pending_approval']);
const ACTIVE_LOAN_STATUSES = new Set(['active', 'approved', 'borrowed', 'overdue']);

export function isPendingLoanStatus(status: unknown): boolean {
  return PENDING_LOAN_STATUSES.has(String(status || '').trim().toLowerCase());
}

export function isActiveLoanStatus(status: unknown): boolean {
  return ACTIVE_LOAN_STATUSES.has(String(status || '').trim().toLowerCase());
}
