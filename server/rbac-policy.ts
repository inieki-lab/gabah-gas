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

let policiesByUser = new Map<string, UserRbacPolicy[]>();
let lastLoadedAt: string | null = null;
let refreshInFlight: Promise<void> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Load the PostgreSQL-backed RBAC policy into a read-only process cache.
 * This is a cache of the database's policy, not an alternate source of truth.
 * Call after persistence initialization and after every RBAC mutation.
 */
export async function refreshRbacPolicy(): Promise<void> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      if (!isPostgresPersistenceActive()) {
        policiesByUser = new Map();
        lastLoadedAt = null;
        return;
      }

      const roles = await queryRbac<any>(
        'SELECT ur.user_id, r.role_key, r.name AS role_name, r.is_superadmin, r.is_active, p.permission_key ' +
        'FROM gabah_user_roles ur JOIN gabah_roles r ON r.id = ur.role_id ' +
        'LEFT JOIN gabah_role_permissions rp ON rp.role_id = r.id ' +
        'LEFT JOIN gabah_permissions p ON p.permission_key = rp.permission_key AND p.is_active = TRUE ' +
        'WHERE r.is_active = TRUE ORDER BY ur.user_id, r.role_key, p.permission_key',
      );
      const scopes = await queryRbac<any>(
        'SELECT s.role_id, r.role_key, s.module, s.scope_type, s.scope_value ' +
        'FROM gabah_role_division_scopes s JOIN gabah_roles r ON r.id = s.role_id ' +
        'WHERE r.is_active = TRUE ORDER BY s.role_id, s.scope_type, s.scope_value',
      );

      // Build a complete replacement off to the side, then atomically publish it.
      // Requests continue using the last known-good cache during a healthy refresh.
      const nextPoliciesByUser = new Map<string, UserRbacPolicy[]>();
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
        const list = nextPoliciesByUser.get(userId) || [];
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
          nextPoliciesByUser.set(userId, list);
        }
        if (row.permission_key) policy.permissions.add(String(row.permission_key));
      }

      policiesByUser = nextPoliciesByUser;
      lastLoadedAt = new Date().toISOString();
    } catch (error) {
      // A failed refresh must never leave stale grants active on this node.
      policiesByUser = new Map();
      lastLoadedAt = null;
      throw error;
    }
  })();
  try {
    await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

/**
 * Keep process-local policy caches convergent when another application node
 * changes a role, permission, or scope in PostgreSQL. Local mutation handlers
 * still refresh immediately; this bounded poll covers changes made on peers.
 */
export function startRbacPolicyRefresh(intervalMs = 5000): void {
  if (refreshTimer || !isPostgresPersistenceActive()) return;
  const safeInterval = Math.max(1000, Math.min(60000, Math.floor(intervalMs) || 5000));
  refreshTimer = setInterval(() => {
    void refreshRbacPolicy().catch(error => {
      // refreshRbacPolicy clears the cache before querying, so errors fail closed.
      console.error('[GABAH RBAC] Scheduled policy refresh failed; this node is default-deny until recovery:', error?.message || error);
    });
  }, safeInterval);
  refreshTimer.unref?.();
}

const READ_ONLY_POLICY_PERMISSION = 'security.read_only';

function isAuditorUserId(userId: string): boolean {
  return (policiesByUser.get(String(userId)) || []).some(policy => policy.roleKey === 'auditor');
}

function isReadOnlyUserId(userId: string): boolean {
  return (policiesByUser.get(String(userId)) || []).some(policy =>
    policy.roleKey === 'auditor' || policy.permissions.has(READ_ONLY_POLICY_PERMISSION)
  );
}

/**
 * Auditors may receive explicitly assigned read capabilities, but any other
 * permission is denied even when another assigned role (including Superadmin)
 * also carries it. New permission keys default to deny for Auditor.
 */
export function isReadOnlyPermissionKey(permissionKey: string): boolean {
  const key = String(permissionKey || '').trim().toLowerCase();
  const segments = key.split('.');
  return key === READ_ONLY_POLICY_PERMISSION || segments.some(segment =>
    segment === 'read' || segment.startsWith('read_') || segment === 'view' || segment === 'list'
  ) || key === 'reports.export' || key === 'tickets.queue.me';
}

/** Backward-compatible name retained for existing Auditor policy callers/tests. */
export const isAuditorReadPermissionKey = isReadOnlyPermissionKey;

export function isRbacSuperadmin(userId: string): boolean {
  const policies = policiesByUser.get(String(userId)) || [];
  return !isReadOnlyUserId(userId)
    && policies.some(policy => policy.isSuperadmin);
}

/** Preserve local file-store development while making PostgreSQL role identity authoritative. */
export function isSuperadminActor(actor: { id: string; role?: string; role_keys?: string[]; permission_keys?: string[] }): boolean {
  if (isPostgresPersistenceActive()) return isRbacSuperadmin(actor.id);
  return !isReadOnlyActor(actor)
    && (actor.role === 'Admin GABAH' || actor.role_keys?.includes('superadmin') === true);
}

/** Generic read-only policy; the legacy Auditor role remains a compatible source of this policy. */
export function isReadOnlyActor(actor: { id: string; role?: string; role_keys?: string[]; permission_keys?: string[] }): boolean {
  if (isPostgresPersistenceActive()) return isReadOnlyUserId(actor.id);
  return actor.role === 'Auditor'
    || actor.role_keys?.includes('auditor') === true
    || actor.permission_keys?.includes(READ_ONLY_POLICY_PERMISSION) === true;
}

/** Auditor identity remains distinct because its read visibility is broader than a generic scoped read-only role. */
export function isAuditorActor(actor: { id: string; role?: string; role_keys?: string[] }): boolean {
  if (isPostgresPersistenceActive()) return isAuditorUserId(actor.id);
  return actor.role === 'Auditor' || actor.role_keys?.includes('auditor') === true;
}

export function countRbacSuperadmins(activeUserIds?: string[]): number {
  const active = activeUserIds ? new Set(activeUserIds.map(String)) : null;
  let count = 0;
  for (const [userId, policies] of policiesByUser.entries()) {
    if (active && !active.has(userId)) continue;
    if (!policies.some(policy => policy.isSuperadmin)) continue;
    if (isReadOnlyUserId(userId)) continue;
    count++;
  }
  return count;
}

export function hasRbacPermission(userId: string, permissionKey: string): boolean {
  const policies = policiesByUser.get(String(userId)) || [];
  if (isReadOnlyUserId(userId)) {
    return isReadOnlyPermissionKey(permissionKey)
      && policies.some(policy => policy.permissions.has(permissionKey));
  }
  return isRbacSuperadmin(userId) || policies.some(policy => policy.permissions.has(permissionKey));
}

export function getEffectiveRoleKeys(userId: string): string[] {
  const policies = policiesByUser.get(String(userId)) || [];
  if (isReadOnlyUserId(userId)) {
    // A read-only policy suppresses Superadmin elevation but preserves other
    // assigned function-role labels for scoped, read-only presentation.
    return [...new Set(policies.filter(policy => !policy.isSuperadmin).map(policy => policy.roleKey))];
  }
  if (isRbacSuperadmin(userId)) return ['superadmin'];
  return [...new Set(policies.map(policy => policy.roleKey))];
}

export function getEffectivePermissionKeys(userId: string): string[] {
  const policies = policiesByUser.get(String(userId)) || [];
  if (isRbacSuperadmin(userId)) return ['*'];
  const readOnly = isReadOnlyUserId(userId);
  const keys = new Set<string>();
  for (const policy of policies) {
    for (const key of policy.permissions) {
      if (!readOnly || isReadOnlyPermissionKey(key)) keys.add(key);
    }
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
  // A module-specific grant must never become global merely because a caller
  // omitted the module argument. Null means only unscoped/'*' grants match.
  const moduleMatches = (scope: RbacScope) =>
    scope.module == null || scope.module === '*' || (module != null && scope.module === module);

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
