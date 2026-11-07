/**
 * Identity fallback matching for legacy records without stable user IDs.
 * Name fallback must be exact after normalization; substring matching can
 * accidentally expose another employee's records with a similar name.
 */
export function normalizeIdentityName(value?: string | null): string {
  return (value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('id');
}

export function isExactIdentityNameMatch(left?: string | null, right?: string | null): boolean {
  const normalizedLeft = normalizeIdentityName(left);
  const normalizedRight = normalizeIdentityName(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}
