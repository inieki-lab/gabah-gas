export interface SidebarMenuPermissionConfig {
  tab: string;
  required: readonly string[];
  alternative?: readonly string[];
  anyOf?: readonly string[];
  /** Grants removed when disabling this menu; shared prerequisites are retained. */
  revoke?: readonly string[];
}

export interface SidebarMenuPermissionChange {
  missing: string[];
  add: string[];
  remove: string[];
}

export function getMissingSidebarMenuPermissions(
  item: SidebarMenuPermissionConfig,
  catalogKeys: ReadonlySet<string>,
): string[] {
  const missing = item.required.filter(key => !catalogKeys.has(key));
  for (const choiceGroup of [item.alternative, item.anyOf]) {
    if (choiceGroup?.length && !choiceGroup.some(key => catalogKeys.has(key))) {
      missing.push(choiceGroup.join(' atau '));
    }
  }
  return missing;
}

export function isSidebarMenuPermissionEnabled(
  item: SidebarMenuPermissionConfig,
  assignedKeys: readonly string[],
): boolean {
  const assigned = new Set(assignedKeys);
  return item.required.every(key => assigned.has(key))
    && (!item.alternative || item.alternative.some(key => assigned.has(key)))
    && (!item.anyOf || item.anyOf.some(key => assigned.has(key)));
}

export function getSidebarMenuPermissionChange(
  item: SidebarMenuPermissionConfig,
  enabled: boolean,
  catalogKeys: ReadonlySet<string>,
  assignedKeys: readonly string[],
): SidebarMenuPermissionChange {
  if (!enabled) {
    return { missing: [], add: [], remove: [...(item.revoke || item.required)] };
  }

  const missing = getMissingSidebarMenuPermissions(item, catalogKeys);
  if (missing.length) return { missing, add: [], remove: [] };

  const assigned = new Set(assignedKeys);
  const add = item.required.filter(key => !assigned.has(key));
  for (const choiceGroup of [item.alternative, item.anyOf]) {
    if (!choiceGroup?.length || choiceGroup.some(key => assigned.has(key))) continue;
    const choice = choiceGroup.find(key => catalogKeys.has(key));
    if (choice) add.push(choice);
  }

  return { missing: [], add: [...new Set(add)], remove: [] };
}
