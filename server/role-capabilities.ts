import { getEffectiveRoleKeys } from './rbac-policy';
import { isPostgresPersistenceActive } from './persistence';

export interface RoleCapabilityUser {
  id: string | number;
  role?: string | null;
  role_label?: string | null;
}

/**
 * Capability lookup for function roles that are no longer primary employee
 * profiles. PostgreSQL Dynamic RBAC is authoritative in production. The
 * role_label fallback exists only for the development file-store fixture,
 * where Dynamic RBAC is intentionally unavailable.
 */
export function hasRoleCapability(user: RoleCapabilityUser, roleKey: 'humas' | 'sekretaris_direksi'): boolean {
  if (isPostgresPersistenceActive()) {
    return getEffectiveRoleKeys(String(user.id)).includes(roleKey);
  }

  const role = String(user.role || '');
  const label = String(user.role_label || '').toLowerCase();
  if (roleKey === 'humas') {
    return role === 'Humas' || label.includes('humas');
  }
  return role === 'Sekretaris Direksi' || label.includes('sekretariat');
}
