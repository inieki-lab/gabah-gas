import { queryRbac, isPostgresPersistenceActive } from './persistence';

export interface RbacScope {
  module: string | null;
  type: 'all' | 'own' | 'division' | 'division_except' | 'unit' | 'location';
  value: string | null;
}

export interface UserRbacPolicy {
  roleKey: string;
  roleName: string;
  isSuperadmin: boolean;
  permissions: Set<string>;
  scopes: RbacScope[];
}

const policiesByUser = new Map<string, UserRbacPolicy[]>();
let lastLoadedAt: string | null = null;

/**
 * Load the PostgreSQL-backed RBAC policy into a read-only process cache.
 * This is a cache of the database's policy, not an alternate source of truth.
 * Call after persistence initialization and after every RBAC mutation.
 */
export async function refreshRbacPolicy(): Promise<void> {
  policiesByUser.clear();
  lastLoadedAt = null;
  if (!isPostgresPersistenceActive()) return;

  const roles = await queryRbac<any>(
    'SELECT ur.user_id, r.role_key, r.name AS role_name, r.is_superadmin, r.is_active, rp.permission_key ' +
    'FROM gabah_user_roles ur JOIN gabah_roles r ON r.id = ur.role_id ' +
    'LEFT JOIN gabah_role_permissions rp ON rp.role_id = r.id ' +
    'WHERE r.is_active = TRUE ORDER BY ur.user_id, r.role_key, rp.permission_key',
  );
  const scopes = await queryRbac<any>(
    'SELECT s.role_id, r.role_key, s.module, s.scope_type, s.scope_value ' +
    'FROM gabah_role_division_scopes s JOIN gabah_roles r ON r.id = s.role_id ' +
    'WHERE r.is_active = TRUE ORDER BY s.role_id, s.scope_type, s.scope_value',
  );
  const roleScopes = new Map<string, RbacScope[]>();
  for (const scope of scopes.rows) {
    const key = String(scope.role_key);
    const list = roleScopes.get(key) || [];
    list.push({
      module: scope.module == null ? null : String(scope.module),
      type: scope.scope_type,
      value: scope.scope_value == null ? null : String(scope.scope_value),
    });
    roleScopes.set(key, list);
  }

  for (const row of roles.rows) {
    const userId = String(row.user_id);
    const roleKey = String(row.role_key);
    const list = policiesByUser.get(userId) || [];
    let policy = list.find(item => item.roleKey === roleKey);
    if (!policy) {
      policy = {
        roleKey,
        roleName: String(row.role_name),
        isSuperadmin: Boolean(row.is_superadmin),
        permissions: new Set<string>(),
        scopes: roleScopes.get(roleKey) || [],
      };
      list.push(policy);
      policiesByUser.set(userId, list);
    }
    if (row.permission_key) policy.permissions.add(String(row.permission_key));
  }
  lastLoadedAt = new Date().toISOString();
}

export function isRbacSuperadmin(userId: string): boolean {
  return (policiesByUser.get(String(userId)) || []).some(policy => policy.isSuperadmin);
}

/** Active-database role assignment: the superadmin flag (isSuperadmin) read from the
 *  PostgreSQL role catalogue for a given policy. This is the authoritative source for
 *  menu rendering and the authenticated user serializer. */
export function isSuperadminFromAssignment(policy: UserRbacPolicy): boolean {
  return policy.isSuperadmin;
}

/** Resolve the legacy profile-role fallback only in file-store mode.
 * PostgreSQL mode must use the explicit role assignment as the sole authority. */
export function isSuperadminActorForMode(
  actor: { id: string; role?: string },
  postgresActive: boolean,
  hasSuperadminAssignment: boolean,
): boolean {
  return postgresActive
    ? hasSuperadminAssignment
    : actor.role === 'Admin GABAH' || hasSuperadminAssignment;
}

export function isSuperadminActor(actor: { id: string; role?: string }): boolean {
  return isSuperadminActorForMode(actor, isPostgresPersistenceActive(), isRbacSuperadmin(actor.id));
}

/** Shared guard used by profile changes, account deletion, and Dynamic RBAC assignment.
 * otherActiveSuperadmins excludes the target user. */
export function wouldRemoveLastActiveSuperadmin(
  targetHasSuperadmin: boolean,
  replacementHasSuperadmin: boolean,
  otherActiveSuperadmins: number,
): boolean {
  return targetHasSuperadmin && !replacementHasSuperadmin && otherActiveSuperadmins <= 0;
}

/** Auditor is a deny-write capability: assigning it as an additional role must not bypass read-only enforcement. */
export function isAuditorActor(actor: { id: string; role?: string }): boolean {
  if (isPostgresPersistenceActive()) return getEffectiveRoleKeys(actor.id).includes('auditor');
  return actor.role === 'Auditor';
}

export function countRbacSuperadmins(activeUserIds?: string[]): number {
  const active = activeUserIds ? new Set(activeUserIds.map(String)) : null;
  let count = 0;
  for (const [userId, policies] of policiesByUser.entries()) {
    if (active && !active.has(userId)) continue;
    if (policies.some(policy => policy.isSuperadmin)) count++;
  }
  return count;
}

export function hasRbacPermission(userId: string, permissionKey: string): boolean {
  return isRbacSuperadmin(userId)
    || (policiesByUser.get(String(userId)) || []).some(policy => policy.permissions.has(permissionKey));
}

export function getEffectiveRoleKeys(userId: string): string[] {
  if (isRbacSuperadmin(userId)) return ['superadmin'];
  return [...new Set((policiesByUser.get(String(userId)) || []).map(policy => policy.roleKey))];
}

export function getEffectivePermissionKeys(userId: string): string[] {
  if (isRbacSuperadmin(userId)) return ['*'];
  const keys = new Set<string>();
  for (const policy of policiesByUser.get(String(userId)) || []) {
    for (const key of policy.permissions) keys.add(key);
  }
  return [...keys].sort();
}

export function getUserRbacPolicies(userId: string): UserRbacPolicy[] {
  return (policiesByUser.get(String(userId)) || []).map(policy => ({
    ...policy,
    permissions: new Set(policy.permissions),
    scopes: policy.scopes.map(scope => ({ ...scope })),
  }));
}

export function hasRbacScope(
  userId: string,
  type: RbacScope['type'],
  value?: string | null,
  module?: string | null,
): boolean {
  if (isRbacSuperadmin(userId)) return true;
  const policies = policiesByUser.get(String(userId)) || [];
  const moduleMatches = (scope: RbacScope) =>
    scope.module == null || scope.module === '*' || module == null || scope.module === module;

  // Owner-domain scopes support broad grants with explicit exclusions:
  // "all except IT" must not be mistaken for unrestricted "all".
  if (type === 'division') {
    const owner = value == null ? '' : String(value).trim().toUpperCase();
    const relevant = policies.flatMap(policy => policy.scopes.filter(moduleMatches));
    if (relevant.some(scope => scope.type === 'division' && String(scope.value || '').trim().toUpperCase() === owner)) return true;
    const excluded = relevant.some(scope => scope.type === 'division_except' && String(scope.value || '').trim().toUpperCase() === owner);
    if (excluded) return false;
    return relevant.some(scope => scope.type === 'all'
      || (scope.type === 'division_except' && String(scope.value || '').trim().toUpperCase() !== owner));
  }

  for (const policy of policies) {
    for (const scope of policy.scopes) {
      const scopeMatches = scope.type === 'all'
        || (scope.type === 'own' && type === 'own')
        || (scope.type === type && scope.value === (value == null ? null : String(value)));
      if (moduleMatches(scope) && scopeMatches) return true;
    }
  }
  return false;
}

export function getRbacPolicyStatus(): { source: 'postgresql' | 'unavailable'; loaded_at: string | null; cached_users: number } {
  return {
    source: isPostgresPersistenceActive() ? 'postgresql' : 'unavailable',
    loaded_at: lastLoadedAt,
    cached_users: policiesByUser.size,
  };
}

// Exported for testing purposes only — allows test fixtures to inject a
// simulated policy state without mutating the production database.
export const testablePoliciesByUser = policiesByUser;
