import type { UserRole } from '../types';

export type AppNavTab =
  | 'dashboard'
  | 'my_assets'
  | 'meeting_rooms'
  | 'assets'
  | 'maintenance'
  | 'loans'
  | 'tickets'
  | 'licenses'
  | 'contracts'
  | 'vendors'
  | 'knowledge'
  | 'reports';

/**
 * Navigation is permission-driven. There is deliberately no fixed role-to-menu
 * matrix: Superadmin and custom job-function roles use the same effective
 * permission contract returned by the backend.
 */
export const CORE_NAVIGATION_TABS: readonly AppNavTab[] = [
  'dashboard', 'my_assets', 'loans', 'tickets', 'knowledge',
];

export function isCoreNavigationTab(tab: AppNavTab): boolean {
  return CORE_NAVIGATION_TABS.includes(tab);
}

const NAV_TAB_PERMISSIONS: Readonly<Record<AppNavTab, readonly string[]>> = {
  dashboard: ['dashboard.read'],
  my_assets: ['assets.read'],
  meeting_rooms: ['meeting_rooms.read', 'room_reservations.read'],
  assets: ['assets.read', 'assets.catalog.read', 'assets.audit.read'],
  maintenance: ['maintenances.read'],
  loans: ['loans.read'],
  tickets: ['tickets.read'],
  licenses: ['licenses.read'],
  contracts: ['contracts.read'],
  vendors: ['vendors.read'],
  knowledge: ['knowledge.read'],
  reports: ['reports.read'],
};

/** Superadmin navigation follows stable server metadata, never a display label. */
export function isSuperadminNavigationAllowed(
  _role: UserRole | null | undefined,
  isSuperadmin: boolean | undefined,
  permissionKeys?: readonly string[],
): boolean {
  if (permissionKeys !== undefined) return isSuperadmin === true || permissionKeys.includes('*');
  // Compatibility only for file-store development before RBAC metadata exists.
  return isSuperadmin === true || _role === 'Admin GABAH';
}


/**
 * Canonical employee profiles are all "Karyawan". Do not use that profile
 * alone to classify an operational user as a staff-only persona: IT/GA/ME
 * operators also have the Karyawan primary profile and must retain operational
 * navigation labels and queue badges.
 */
const OPERATIONAL_NAVIGATION_PERMISSIONS: readonly string[] = [
  'assets.create', 'assets.update', 'assets.bulk_import', 'assets.assign', 'assets.move', 'assets.lifecycle',
  'loans.approve', 'loans.reject', 'loans.handover', 'loans.return',
  'tickets.assign', 'tickets.update',
  'maintenances.create', 'maintenances.update',
  'room_reservations.approve', 'room_reservations.reject',
  'meeting_rooms.update', 'meeting_types.manage', 'meeting_facilities.manage',
  'room_reservations.checkin', 'room_reservations.checkout',
  'licenses.manage', 'knowledge.create', 'knowledge.update',
  'contracts.create', 'contracts.update', 'contracts.documents.upload',
  'vendors.create', 'vendors.update', 'organization.manage', 'master_data.manage',
];

/** True only for employee-facing personas without operational management grants. */
export function isStaffNavigationPersona(
  role: UserRole | null | undefined,
  permissionKeys?: readonly string[],
): boolean {
  if (!role) return false;
  if (permissionKeys !== undefined) {
    if (permissionKeys.includes('*')) return false;
    if (OPERATIONAL_NAVIGATION_PERMISSIONS.some(permission => permissionKeys.includes(permission))) return false;
  }
  // Primary identity is intentionally limited to Karyawan/Admin GABAH.
  // Humas, Sekretariat, RPC/SC and PIBC are capabilities or org/location data,
  // never alternate employee personas.
  return role === 'Karyawan';
}

const DEFAULT_NAV_TAB_ORDER: readonly AppNavTab[] = [
  'dashboard', 'my_assets', 'tickets', 'loans', 'meeting_rooms', 'assets',
  'maintenance', 'contracts', 'vendors', 'licenses', 'knowledge', 'reports',
];

/** Pick the first page the actor can actually read and whose module is active. */
export function getDefaultNavTabForRole(
  role: UserRole | null | undefined,
  permissionKeys?: readonly string[],
  activeModuleKeys?: readonly string[],
): AppNavTab | null {
  const allowedTab = DEFAULT_NAV_TAB_ORDER.find(tab =>
    isNavTabAllowedForRole(role, tab, permissionKeys)
      && (activeModuleKeys === undefined || activeModuleKeys.includes(tab)),
  );
  return allowedTab || (permissionKeys === undefined && activeModuleKeys === undefined ? 'dashboard' : null);
}

/**
 * PostgreSQL effective permission keys are authoritative. In file-store
 * development, only the employee workspace is exposed to non-admin users;
 * privileged modules require an authenticated RBAC permission payload.
 */
export function isNavTabAllowedForRole(
  role: UserRole | null | undefined,
  tab: AppNavTab,
  permissionKeys?: readonly string[],
): boolean {
  if (!role) return false;
  if (permissionKeys !== undefined) {
    if (permissionKeys.includes('*')) return true;
    const required = NAV_TAB_PERMISSIONS[tab];
    if (tab === 'meeting_rooms') {
      return permissionKeys.includes('meeting_rooms.read')
        && permissionKeys.includes('room_reservations.read');
    }
    if (tab === 'assets') {
      return permissionKeys.includes('assets.read')
        && (permissionKeys.includes('assets.catalog.read') || permissionKeys.includes('assets.audit.read'));
    }
    return required.some(key => permissionKeys.includes(key));
  }
  return role === 'Admin GABAH' || isCoreNavigationTab(tab);
}
