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
    'dashboard', 'meeting_rooms', 'loans', 'knowledge',
  ],
  Humas: [
    'dashboard', 'meeting_rooms', 'knowledge',
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

export function isNavTabAllowedForRole(role: UserRole | null | undefined, tab: AppNavTab): boolean {
  return Boolean(role && ROLE_NAVIGATION[role]?.includes(tab));
}

export function getDefaultNavTabForRole(_role: UserRole): AppNavTab {
  return 'dashboard';
}
