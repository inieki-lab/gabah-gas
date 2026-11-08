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
 * Product navigation policy.
 *
 * This controls presentation only. Every API and business operation must
 * continue to enforce authorization on the server.
 */
export const ROLE_NAVIGATION: Readonly<Record<UserRole, readonly AppNavTab[]>> = {
  'Admin GABAH': [
    'dashboard', 'my_assets', 'meeting_rooms', 'assets', 'maintenance',
    'loans', 'tickets', 'licenses', 'contracts', 'vendors', 'knowledge', 'reports',
  ],
  IT: [
    'dashboard', 'my_assets', 'meeting_rooms', 'assets', 'maintenance',
    'loans', 'tickets', 'licenses', 'contracts', 'vendors', 'knowledge', 'reports',
  ],
  GA: [
    'dashboard', 'my_assets', 'meeting_rooms', 'assets', 'maintenance',
    'loans', 'tickets', 'contracts', 'vendors', 'knowledge', 'reports',
  ],
  'Sekretaris Direksi': [
    'dashboard', 'my_assets', 'meeting_rooms', 'loans', 'tickets', 'knowledge',
  ],
  Humas: [
    'dashboard', 'meeting_rooms', 'loans', 'tickets', 'knowledge',
  ],
  'Supply Chain': [
    'dashboard', 'my_assets', 'assets', 'maintenance', 'loans',
    'tickets', 'contracts', 'vendors', 'knowledge', 'reports',
  ],
  PIBC: [
    'dashboard', 'my_assets', 'assets', 'maintenance', 'loans',
    'tickets', 'contracts', 'vendors', 'knowledge', 'reports',
  ],
  Karyawan: [
    'dashboard', 'my_assets', 'meeting_rooms', 'loans', 'tickets', 'knowledge',
  ],
  Auditor: [
    'dashboard', 'assets', 'maintenance', 'loans', 'tickets', 'licenses',
    'contracts', 'vendors', 'knowledge', 'reports',
  ],
};

const NAV_TAB_PERMISSIONS: Readonly<Record<AppNavTab, readonly string[]>> = {
  dashboard: ['dashboard.read'],
  my_assets: ['assets.read'],
  meeting_rooms: ['meeting_rooms.read', 'room_reservations.read', 'room_reservations.create'],
  assets: ['assets.audit.read', 'assets.create', 'assets.update', 'assets.delete', 'assets.assign', 'assets.move', 'assets.lifecycle'],
  maintenance: ['maintenances.read'],
  loans: ['loans.read'],
  tickets: ['tickets.read'],
  licenses: ['licenses.read'],
  contracts: ['contracts.read'],
  vendors: ['vendors.read'],
  knowledge: ['knowledge.read'],
  reports: ['reports.read'],
};

/**
 * PostgreSQL RBAC permissions are authoritative for the visible menu.
 * The role map is retained only for the file-store compatibility mode where
 * effective permission keys are intentionally not emitted by the API.
 */
export function isNavTabAllowedForRole(
  role: UserRole | null | undefined,
  tab: AppNavTab,
  permissionKeys?: readonly string[],
): boolean {
  if (!role) return false;
  if (permissionKeys !== undefined) {
    if (permissionKeys.includes('*')) return true;
    return NAV_TAB_PERMISSIONS[tab].some(key => permissionKeys.includes(key));
  }
  return ROLE_NAVIGATION[role]?.includes(tab) ?? false;
}
