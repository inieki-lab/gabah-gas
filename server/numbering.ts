/**
 * GABAH Authoritative Numbering Engine
 * Asset: {OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}
 * Asset sequence resets yearly per owner division + asset code.
 */
export class AssetNumberingEngine {
  private static sequenceStore = new Map<string, number>();
  private static ticketSeq = new Map<number, number>();
  private static loanSeq = new Map<number, number>();

  static syncFromExistingAssets(assets: Array<{ asset_number: string }>) {
    for (const a of assets) {
      if (!a.asset_number) continue;
      const parts = a.asset_number.split('-');
      if (parts.length < 4) continue;
      const division = parts[0].toUpperCase();
      const year = parseInt(parts[parts.length - 2], 10);
      const seq = parseInt(parts[parts.length - 1], 10);
      const code = parts.slice(1, parts.length - 2).join('-').toUpperCase();
      if (!isNaN(year) && !isNaN(seq)) {
        const key = `${division}:${code}:${year}`;
        this.sequenceStore.set(key, Math.max(this.sequenceStore.get(key) || 0, seq));
      }
    }
  }

  static syncFromExistingRecords(records: { tickets?: Array<{ ticket_number: string }>; loans?: Array<{ loan_number: string }> }) {
    for (const t of records.tickets || []) {
      const m = /^TKT-(\d{4})-(\d+)$/.exec(t.ticket_number || '');
      if (m) this.ticketSeq.set(Number(m[1]), Math.max(this.ticketSeq.get(Number(m[1])) || 0, Number(m[2])));
    }
    for (const l of records.loans || []) {
      const m = /^LOAN-(\d{4})-(\d+)$/.exec(l.loan_number || '');
      if (m) this.loanSeq.set(Number(m[1]), Math.max(this.loanSeq.get(Number(m[1])) || 0, Number(m[2])));
    }
  }

  static generateAssetNumber(ownerDivision?: string, assetCode?: string, targetYear?: number): string {
    const year = targetYear || new Date().getFullYear();
    const div = (ownerDivision || 'IT').trim().toUpperCase();
    const code = (assetCode || 'GEN').trim().toUpperCase();
    const key = `${div}:${code}:${year}`;
    const nextSeq = (this.sequenceStore.get(key) || 0) + 1;
    this.sequenceStore.set(key, nextSeq);
    return `${div}-${code}-${year}-${String(nextSeq).padStart(4, '0')}`;
  }

  static generateTicketNumber(targetYear?: number): string {
    const year = targetYear || new Date().getFullYear();
    const next = (this.ticketSeq.get(year) || 0) + 1;
    this.ticketSeq.set(year, next);
    return `TKT-${year}-${String(next).padStart(4, '0')}`;
  }

  static generateLoanNumber(targetYear?: number): string {
    const year = targetYear || new Date().getFullYear();
    const next = (this.loanSeq.get(year) || 0) + 1;
    this.loanSeq.set(year, next);
    return `LOAN-${year}-${String(next).padStart(4, '0')}`;
  }

  static generateContractNumber(targetYear?: number): string {
    const year = targetYear || new Date().getFullYear();
    const next = (this.contractSeq.get(year) || 0) + 1;
    this.contractSeq.set(year, next);
    return `CTR-${year}-${String(next).padStart(4, '0')}`;
  }

  private static contractSeq = new Map<number, number>();

  /**
   * P2#10: read-only snapshot of the live asset sequence store for the admin
   * Asset Numbering panel (previously hardcoded sample values in the UI).
   */
  static getAssetSequenceSnapshot(): Array<{ key: string; division: string; code: string; year: number; current: number }> {
    return Array.from(this.sequenceStore.entries())
      .map(([key, current]) => {
        const [division, code, yearStr] = key.split(':');
        return { key, division, code, year: Number(yearStr) || 0, current };
      })
      .sort((a, b) => b.year - a.year || a.key.localeCompare(b.key));
  }

  static _resetForTesting() {
    this.sequenceStore.clear();
    this.ticketSeq.clear();
    this.loanSeq.clear();
  }
}
