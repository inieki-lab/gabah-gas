/**
 * Employee-facing dashboard classification. Legacy Supply Chain/PIBC account
 * labels remain supported for compatibility, but this is presentation only
 * and grants no data scope.
 */
export function isEmployeeFacingDashboardRole(role: string | null | undefined, roleKeys: readonly string[] = []): boolean {
  return ['Karyawan', 'Supply Chain', 'PIBC'].includes(role || '')
    || role === 'Humas' || role === 'Sekretaris Direksi'
    || roleKeys.includes('humas') || roleKeys.includes('sekretaris_direksi');
}
