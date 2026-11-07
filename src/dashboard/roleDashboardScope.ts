import type { Asset, Loan, Ticket, UserRole } from '../types';

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
