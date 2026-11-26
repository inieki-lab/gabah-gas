import type { Asset, Loan, Ticket, UserProfile, UserRole } from '../types';
import { isExactIdentityNameMatch } from '../utils/identityMatching';


export interface DashboardPersona {
  isStaff: boolean;
  isHumas: boolean;
  isSekdir: boolean;
  isIT: boolean;
  isGA: boolean;
  isAuditor: boolean;
  isSuperadmin: boolean;
  isGlobalDashboard: boolean;
  isDivisionDashboard: boolean;
  divisionLabel: string;
  descriptionRole: UserRole;
}

/** Resolve dashboard presentation from primary and additional job-function roles. */
export function resolveDashboardPersona(user: Pick<UserProfile, 'role' | 'role_keys' | 'is_superadmin' | 'permission_keys'>): DashboardPersona {
  const roleKeys = new Set((user.role_keys || []).map(key => String(key).trim().toLowerCase()));
  const has = (key: string, label: UserRole) => user.role === label || roleKeys.has(key);
  const isSuperadmin = Boolean(user.is_superadmin) || has('superadmin', 'Admin GABAH');
  const isAuditor = has('auditor', 'Auditor');
  const isIT = has('it', 'IT');
  const isGA = has('ga', 'GA');
  const isHumas = has('humas', 'Humas');
  const isSekdir = has('sekretaris_direksi', 'Sekretaris Direksi');
  const isGlobalDashboard = isSuperadmin || isAuditor;
  const isDivisionDashboard = !isGlobalDashboard && (isIT || isGA);
  const operationalPermissionKeys = new Set([
    'assets.create', 'assets.update', 'assets.delete', 'assets.assign', 'assets.move', 'assets.lifecycle',
    'loans.approve', 'loans.handover',
    'tickets.update', 'tickets.assign', 'tickets.close',
    'maintenances.create', 'maintenances.update',
    'vendors.create', 'vendors.update',
    'contracts.create', 'contracts.update',
    'licenses.manage', 'knowledge.create', 'knowledge.update',
    'meeting_rooms.update', 'room_reservations.approve', 'room_reservations.reject',
    'reconciliation.link',
  ]);
  const hasOperationalCapability = (user.permission_keys || []).includes('*')
    || (user.permission_keys || []).some(key => operationalPermissionKeys.has(key));
  const isStaff = !isGlobalDashboard && !isDivisionDashboard && !hasOperationalCapability && (
    ['Karyawan', 'Supply Chain', 'PIBC'].includes(user.role) || isHumas || isSekdir
  );
  const descriptionRole: UserRole = isSuperadmin ? 'Admin GABAH'
    : isAuditor ? 'Auditor'
    : isIT ? 'IT'
    : isGA ? 'GA'
    : isHumas ? 'Humas'
    : isSekdir ? 'Sekretaris Direksi'
    : user.role;
  return {
    isStaff, isHumas, isSekdir, isIT, isGA, isAuditor, isSuperadmin,
    isGlobalDashboard, isDivisionDashboard,
    divisionLabel: isIT && isGA ? 'IT / GA' : isIT ? 'IT' : isGA ? 'GA' : 'Unit kerja',
    descriptionRole,
  };
}


/** UI affordances follow effective permissions; backend remains authoritative. */
export function hasEffectivePermission(
  user: Pick<UserProfile, 'role' | 'role_keys' | 'is_superadmin' | 'permission_keys'>,
  permissionKey: string,
  legacyFallback = false,
): boolean {
  if (resolveDashboardPersona(user).isAuditor) return false;
  if (user.permission_keys === undefined) return legacyFallback;
  return user.permission_keys.includes('*') || user.permission_keys.includes(permissionKey);
}

export function canShowDashboardAction(
  user: Pick<UserProfile, 'role' | 'role_keys' | 'is_superadmin' | 'permission_keys'>,
  permissionKey: string,
  legacyFallback: boolean,
): boolean {
  return hasEffectivePermission(user, permissionKey, legacyFallback);
}

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
