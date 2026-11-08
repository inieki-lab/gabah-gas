import type { Asset, Loan, Ticket, UserProfile, UserRole } from '../types';
import { isExactIdentityNameMatch } from '../utils/identityMatching';

/**
 * Presentation scope for operational dashboards.
 * This is not an authorization boundary; API authorization remains server-side.
 */
export function filterDashboardAssets(items: Asset[], role: UserRole): Asset[] {
  switch (role) {
    case 'Admin GABAH':
    case 'Auditor':
      return items;
    case 'IT':
      return items.filter(item => item.owner_division === 'IT');
    case 'GA':
      return items.filter(item => item.owner_division === 'GA');
    default:
      return [];
  }
}

export function filterDashboardLoans(items: Loan[], role: UserRole): Loan[] {
  switch (role) {
    case 'Admin GABAH':
    case 'Auditor':
      return items;
    case 'IT':
      return items.filter(item => item.owner_division === 'IT');
    case 'GA':
      return items.filter(item => item.owner_division === 'GA');
    default:
      return [];
  }
}

export function filterDashboardTickets(items: Ticket[], role: UserRole): Ticket[] {
  switch (role) {
    case 'Admin GABAH':
    case 'Auditor':
      return items;
    case 'IT':
      return items.filter(item => item.category === 'IT');
    case 'GA':
      return items.filter(item => item.category === 'GA');
    default:
      return [];
  }
}

export function filterPersonalLoans(items: Loan[], user: UserProfile): Loan[] {
  return items.filter(item =>
    item.borrower_id === user.id || isExactIdentityNameMatch(item.borrower_name, user.name)
  );
}

export function filterPersonalAssets(items: Asset[], loans: Loan[], user: UserProfile): Asset[] {
  const assigned = items.filter(asset =>
    asset.assigned_to?.id === user.id ||
    Boolean(asset.assigned_to?.email && user.email && asset.assigned_to.email.toLowerCase() === user.email.toLowerCase()) ||
    isExactIdentityNameMatch(asset.assigned_to?.name, user.name)
  );
  const activeLoanAssetIds = new Set(
    filterPersonalLoans(loans, user)
      .filter(loan => ['approved', 'active', 'overdue'].includes(loan.status))
      .map(loan => loan.asset_id)
  );
  const visibleIds = new Set([...assigned.map(asset => asset.id), ...activeLoanAssetIds]);
  return items.filter(asset => visibleIds.has(asset.id));
}

export function filterMaintenanceForRole<T extends { owner_division?: string }>(
  items: T[],
  role: UserRole
): T[] {
  if (role === 'Admin GABAH' || role === 'Auditor') return items;
  if (role === 'IT' || role === 'GA') {
    return items.filter(item => item.owner_division === role);
  }
  return [];
}

export function filterContractsForRole<T extends { owner_division?: string; pic_user_id?: string }>(
  items: T[],
  user: UserProfile
): T[] {
  if (user.role === 'Admin GABAH' || user.role === 'Auditor') return items;
  if (user.role === 'IT' || user.role === 'GA') {
    return items.filter(item => item.owner_division === user.role || item.pic_user_id === user.id);
  }
  return items.filter(item => item.pic_user_id === user.id);
}
