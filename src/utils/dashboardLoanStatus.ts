const PENDING_LOAN_STATUSES = new Set(['pending', 'pending_approval']);
const ACTIVE_LOAN_STATUSES = new Set(['active', 'approved', 'borrowed', 'overdue']);

export function isPendingLoanStatus(status: unknown): boolean {
  return PENDING_LOAN_STATUSES.has(String(status || '').trim().toLowerCase());
}

export function isActiveLoanStatus(status: unknown): boolean {
  return ACTIVE_LOAN_STATUSES.has(String(status || '').trim().toLowerCase());
}

export function getDashboardLoanStatusLabel(status: unknown): string {
  const normalized = String(status || '').trim().toLowerCase();
  const labels: Record<string, string> = {
    pending: 'Menunggu Persetujuan',
    pending_approval: 'Menunggu Persetujuan',
    approved: 'Disetujui',
    active: 'Dipinjam',
    borrowed: 'Dipinjam',
    overdue: 'Terlambat',
    returned: 'Dikembalikan',
    rejected: 'Ditolak',
    closed: 'Ditutup',
    cancelled: 'Dibatalkan',
  };
  return labels[normalized] || (normalized || 'Tidak diketahui');
}
