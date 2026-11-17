import type { UserRole } from '../types';

export type AppNavTab =
  | 'dashboard' | 'my_assets' | 'meeting_rooms' | 'assets' | 'maintenance'
  | 'loans' | 'tickets' | 'licenses' | 'contracts' | 'vendors' | 'knowledge' | 'reports';

/**
 * Legacy file-store navigation only. PostgreSQL mode is permission-first and
 * does not require a primary role, job title, division, or office location.
 */
export const ROLE_NAVIGATION: Readonly<Record<UserRole, readonly AppNavTab[]>> = {
  'Admin GABAH': ['dashboard', 'my_assets', 'meeting_rooms', 'assets', 'maintenance', 'loans', 'tickets', 'licenses', 'contracts', 'vendors', 'knowledge', 'reports'],
  IT: ['dashboard', 'my_assets', 'meeting_rooms', 'assets', 'maintenance', 'loans', 'tickets', 'licenses', 'contracts', 'vendors', 'knowledge', 'reports'],
  GA: ['dashboard', 'my_assets', 'meeting_rooms', 'assets', 'maintenance', 'loans', 'tickets', 'contracts', 'vendors', 'knowledge', 'reports'],
  'Sekretaris Direksi': ['dashboard', 'my_assets', 'meeting_rooms', 'loans', 'tickets', 'knowledge'],
  Humas: ['dashboard', 'my_assets', 'meeting_rooms', 'loans', 'tickets', 'knowledge'],
  // Legacy labels retained only for file-store compatibility.
  'Supply Chain': ['dashboard', 'my_assets', 'meeting_rooms', 'loans', 'tickets', 'knowledge'],
  PIBC: ['dashboard', 'my_assets', 'meeting_rooms', 'loans', 'tickets', 'knowledge'],
  Karyawan: ['dashboard', 'my_assets', 'loans', 'tickets', 'knowledge'],
  Auditor: ['dashboard', 'assets', 'maintenance', 'loans', 'tickets', 'licenses', 'contracts', 'vendors', 'knowledge', 'reports'],
};

const NAV_TAB_PERMISSIONS: Readonly<Record<AppNavTab, readonly string[]>> = {
  dashboard: ['dashboard.read'],
  my_assets: ['assets.read'],
  meeting_rooms: ['meeting_rooms.read'],
  assets: ['assets.catalog.read'],
  maintenance: ['maintenances.read'],
  loans: ['loans.read'],
  tickets: ['tickets.read'],
  licenses: ['licenses.read'],
  contracts: ['contracts.read'],
  vendors: ['vendors.read'],
  knowledge: ['knowledge.read'],
  reports: ['reports.read'],
};

export function isSuperadminNavigationAllowed(
  role: UserRole | null | undefined,
  isSuperadmin: boolean | undefined,
  permissionKeys?: readonly string[],
): boolean {
  if (permissionKeys !== undefined) return isSuperadmin === true || permissionKeys.includes('*');
  return isSuperadmin === true || role === 'Admin GABAH';
}

const DEFAULT_NAV_TAB_ORDER: readonly AppNavTab[] = [
  'dashboard', 'my_assets', 'tickets', 'loans', 'meeting_rooms', 'assets',
  'maintenance', 'contracts', 'vendors', 'licenses', 'knowledge', 'reports',
];

export function getDefaultNavTabForRole(
  role: UserRole | null | undefined,
  permissionKeys?: readonly string[],
): AppNavTab | null {
  const allowedTab = DEFAULT_NAV_TAB_ORDER.find(tab => isNavTabAllowedForRole(role, tab, permissionKeys));
  return allowedTab || (permissionKeys === undefined ? 'dashboard' : null);
}

/** PostgreSQL effective permissions are authoritative, independent of legacy role labels. */
export function isNavTabAllowedForRole(
  role: UserRole | null | undefined,
  tab: AppNavTab,
  permissionKeys?: readonly string[],
): boolean {
  if (permissionKeys !== undefined) {
    if (permissionKeys.includes('*')) return true;
    if (tab === 'meeting_rooms') return permissionKeys.includes('meeting_rooms.read')
      && permissionKeys.includes('room_reservations.read');
    if (tab === 'assets') return permissionKeys.includes('assets.audit.read')
      || (permissionKeys.includes('assets.read') && permissionKeys.includes('assets.catalog.read'));
    return NAV_TAB_PERMISSIONS[tab].some(key => permissionKeys.includes(key));
  }
  if (!role) return false;
  return ROLE_NAVIGATION[role]?.includes(tab) ?? false;
}
