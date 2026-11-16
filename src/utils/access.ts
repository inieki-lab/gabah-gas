import type { UserProfile } from '../types';

type AccessUser = Partial<UserProfile> | null | undefined;

export function isSuperAdmin(user: AccessUser): boolean {
  if (!user) return false;
  // PostgreSQL-backed identities are authoritative: a legacy profile label
  // must never override an explicit false/absent Superadmin assignment.
  if (Array.isArray(user.permission_keys)) {
    return user.is_superadmin === true || user.permission_keys.includes('*');
  }
  // Preserve role-label compatibility only for legacy file-store sessions.
  return user.is_superadmin === true || user.role === 'Admin GABAH';
}

/**
 * Use effective permissions returned by the backend whenever present.
 * Legacy role fallbacks are intentionally limited to file-store mode, where
 * permission_keys is undefined. An empty permission array means deny.
 */
export function hasPermission(
  user: AccessUser,
  permission: string,
  legacyRoles: string[] = [],
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (Array.isArray(user.permission_keys)) {
    return user.permission_keys.includes('*') || user.permission_keys.includes(permission);
  }
  return legacyRoles.includes(String(user.role || ''));
}

/**
 * Multi-role identities use role_keys. Primary role labels are only a
 * compatibility fallback for file-store sessions without dynamic RBAC data.
 */
export function hasRole(
  user: AccessUser,
  roleKey: string,
  legacyLabels: string[] = [],
): boolean {
  if (!user) return false;
  if (Array.isArray(user.role_keys)) return user.role_keys.includes(roleKey);
  // Presence of effective permissions signals PostgreSQL RBAC mode. Missing
  // role assignments must deny rather than fall back to a profile label.
  if (Array.isArray(user.permission_keys)) return false;
  return legacyLabels.includes(String(user.role || ''));
}

export function isAuditor(user: AccessUser): boolean {
  return hasRole(user, 'auditor', ['Auditor']);
}
