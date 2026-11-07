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
      return items.filter(item =>
        item.owner_division === 'IT' || item.category_type === 'IT' || item.category_type === 'License'
      );
    case 'GA':
      return items.filter(item => item.owner_division === 'GA' || item.category_type === 'GA');
    case 'Supply Chain':
      return items.filter(item => item.owner_division === 'SC');
    case 'PIBC':
      return items.filter(item => item.owner_division === 'PIBC');
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
      return items.filter(item => item.owner_division === 'IT' || item.category_type === 'IT');
    case 'GA':
      return items.filter(item => item.owner_division === 'GA' || item.category_type === 'GA');
    case 'Supply Chain':
      return items.filter(item => item.owner_division === 'SC');
    case 'PIBC':
      return items.filter(item => item.owner_division === 'PIBC');
    default:
      return [];
  }
}

export function filterDashboardTickets(items: Ticket[], role: UserRole): Ticket[] {
  switch (role) {
    case 'Admin GABAH':
    case 'IT':
    case 'Auditor':
      // IT is the enterprise helpdesk queue; Auditor is read-only.
      return items;
    case 'GA':
    case 'Supply Chain':
    case 'PIBC':
      // gabahService already applies each division's visibility rule,
      // including tickets reported by the current user.
      return items;
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
  const division = role === 'Supply Chain' ? 'SC' : role;
  if (['IT', 'GA', 'SC', 'PIBC'].includes(division)) {
    return items.filter(item => item.owner_division === division);
  }
  return [];
}

export function filterContractsForRole<T extends { owner_division?: string; pic_user_id?: string }>(
  items: T[],
  user: UserProfile
): T[] {
  if (user.role === 'Admin GABAH' || user.role === 'Auditor') return items;
  const division = user.role === 'Supply Chain' ? 'SC' : user.role;
  return items.filter(item =>
    item.owner_division === division || item.pic_user_id === user.id
  );
}
