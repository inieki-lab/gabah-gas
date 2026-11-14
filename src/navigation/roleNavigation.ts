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
    'dashboard', 'my_assets', 'meeting_rooms', 'loans', 'tickets', 'knowledge',
  ],
  // Legacy labels retained for account compatibility only. These are
  // locations, not application roles or asset-owner domains.
  'Supply Chain': [
    'dashboard', 'my_assets', 'meeting_rooms', 'loans', 'tickets', 'knowledge',
  ],
  PIBC: [
    'dashboard', 'my_assets', 'meeting_rooms', 'loans', 'tickets', 'knowledge',
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
  // A visible page must be readable. Create/update-only grants belong to
  // actions inside a page and must never expose a page whose GET endpoint denies access.
  meeting_rooms: ['meeting_rooms.read', 'room_reservations.read'],
  assets: ['assets.read'],
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
const DEFAULT_NAV_TAB_ORDER: readonly AppNavTab[] = [
  'dashboard', 'my_assets', 'tickets', 'loans', 'meeting_rooms', 'assets',
  'maintenance', 'contracts', 'vendors', 'licenses', 'knowledge', 'reports',
];

/** Pick an authorized landing page when a user's current tab is no longer allowed. */
export function getDefaultNavTabForRole(
  role: UserRole | null | undefined,
  permissionKeys?: readonly string[],
): AppNavTab {
  return DEFAULT_NAV_TAB_ORDER.find(tab => isNavTabAllowedForRole(role, tab, permissionKeys)) || 'dashboard';
}

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
