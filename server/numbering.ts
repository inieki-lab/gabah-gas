/**
 * GABAH Authoritative Numbering Engine
 * Asset: {OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}
 * Asset sequence resets yearly per owner division + asset code.
 */
export interface AssetNumberingRuleConfig {
  id: string;
  owner_division: string;
  asset_code: string;
  separator: string;
  sequence_digits: number;
  is_active: boolean;
  notes?: string;
}

export class AssetNumberingEngine {
  private static rules = new Map<string, AssetNumberingRuleConfig>();
  private static sequenceStore = new Map<string, number>();
  private static ticketSeq = new Map<number, number>();
  private static loanSeq = new Map<number, number>();

  static syncFromExistingAssets(assets: Array<{ asset_number: string }>) {
    this.sequenceStore.clear();
    for (const asset of assets) {
      const number = String(asset.asset_number || '').trim().toUpperCase();
      if (!number) continue;
      let matched = false;

      // A rule may have changed its separator after older numbers were issued.
      // Parse all supported historical separators so a restart never resets
      // the counter merely because the current rule now uses a different one.
      for (const rule of this.rules.values()) {
        for (const separator of ['-', '_', '/']) {
          const prefix = `${rule.owner_division}${separator}${rule.asset_code}${separator}`;
          if (!number.startsWith(prefix)) continue;
          const tail = number.slice(prefix.length).split(separator);
          if (tail.length !== 2) continue;
          const year = Number.parseInt(tail[0], 10);
          const sequence = Number.parseInt(tail[1], 10);
          if (!Number.isInteger(year) || !Number.isInteger(sequence)) continue;
          const key = `${rule.owner_division}:${rule.asset_code}:${year}`;
          this.sequenceStore.set(key, Math.max(this.sequenceStore.get(key) || 0, sequence));
          matched = true;
          break;
        }
        if (matched) break;
      }

      if (matched) continue;
      // Backward compatibility for historical combinations without an
      // explicitly configured rule; canonical legacy format uses hyphens.
      const parts = number.split('-');
      if (parts.length < 4) continue;
      const division = parts[0].toUpperCase();
      const year = Number.parseInt(parts[parts.length - 2], 10);
      const sequence = Number.parseInt(parts[parts.length - 1], 10);
      const code = parts.slice(1, parts.length - 2).join('-').toUpperCase();
      if (Number.isInteger(year) && Number.isInteger(sequence)) {
        const key = `${division}:${code}:${year}`;
        this.sequenceStore.set(key, Math.max(this.sequenceStore.get(key) || 0, sequence));
      }
    }
  }

  static syncFromExistingRecords(records: { tickets?: Array<{ ticket_number: string }>; loans?: Array<{ loan_number: string }>; contracts?: Array<{ contract_number: string }> }) {
    for (const t of records.tickets || []) {
      const m = /^TKT-(\d{4})-(\d+)$/.exec(t.ticket_number || '');
      if (m) this.ticketSeq.set(Number(m[1]), Math.max(this.ticketSeq.get(Number(m[1])) || 0, Number(m[2])));
    }
    for (const l of records.loans || []) {
      const m = /^LOAN-(\d{4})-(\d+)$/.exec(l.loan_number || '');
      if (m) this.loanSeq.set(Number(m[1]), Math.max(this.loanSeq.get(Number(m[1])) || 0, Number(m[2])));
    }
    // Keep the contract sequence consistent with persisted records so a fresh
    // boot never re-issues a CTR number that already exists in the store.
    for (const c of records.contracts || []) {
      const m = /^CTR-(\d{4})-(\d+)$/.exec(c.contract_number || '');
      if (m) this.contractSeq.set(Number(m[1]), Math.max(this.contractSeq.get(Number(m[1])) || 0, Number(m[2])));
    }
  }

  static configureRules(rules: AssetNumberingRuleConfig[]): void {
    this.rules.clear();
    for (const rule of rules) {
      const division = String(rule.owner_division || '').trim().toUpperCase();
      const code = String(rule.asset_code || '').trim().toUpperCase();
      if (!division || !code) continue;
      this.rules.set(`${division}:${code}`, {
        ...rule,
        owner_division: division,
        asset_code: code,
        separator: rule.separator || '-',
        sequence_digits: Math.min(8, Math.max(3, Number(rule.sequence_digits) || 4)),
        is_active: rule.is_active !== false,
      });
    }
  }

  static upsertRule(rule: AssetNumberingRuleConfig): void {
    const division = rule.owner_division.trim().toUpperCase();
    const code = rule.asset_code.trim().toUpperCase();
    this.rules.set(`${division}:${code}`, {
      ...rule,
      owner_division: division,
      asset_code: code,
      sequence_digits: Math.min(8, Math.max(3, Number(rule.sequence_digits) || 4)),
    });
  }

  static removeRule(ownerDivision: string, assetCode: string): void {
    this.rules.delete(`${ownerDivision.trim().toUpperCase()}:${assetCode.trim().toUpperCase()}`);
  }

  static previewAssetNumber(ownerDivision: string, assetCode: string, targetYear?: number, override?: Partial<AssetNumberingRuleConfig>): string {
    const year = targetYear || new Date().getFullYear();
    const div = ownerDivision.trim().toUpperCase();
    const code = assetCode.trim().toUpperCase();
    const key = `${div}:${code}:${year}`;
    const rule = { ...this.rules.get(`${div}:${code}`), ...override };
    const separator = rule.separator || '-';
    const digits = Math.min(8, Math.max(3, Number(rule.sequence_digits) || 4));
    const nextSeq = (this.sequenceStore.get(key) || 0) + 1;
    return [div, code, String(year), String(nextSeq).padStart(digits, '0')].join(separator);
  }

  /**
   * Format a sequence already reserved by PostgreSQL. The database is the
   * authority in PostgreSQL mode; this method only formats and refreshes the
   * local read/preview cache after the atomic reservation succeeds.
   */
  static formatReservedAssetNumber(
    ownerDivision: string,
    assetCode: string,
    targetYear: number,
    sequence: number,
    format?: { separator?: string; sequence_digits?: number },
  ): string {
    const div = String(ownerDivision || '').trim().toUpperCase();
    const code = String(assetCode || '').trim().toUpperCase();
    if (!div || !code || !Number.isInteger(targetYear) || !Number.isSafeInteger(sequence) || sequence < 1) {
      throw new Error('Reservasi sequence nomor aset tidak valid.');
    }
    const rule = this.rules.get(`${div}:${code}`);
    const key = `${div}:${code}:${targetYear}`;
    this.sequenceStore.set(key, Math.max(this.sequenceStore.get(key) || 0, sequence));
    const separator = format?.separator || rule?.separator || '-';
    const digits = format?.sequence_digits || rule?.sequence_digits || 4;
    return [div, code, String(targetYear), String(sequence).padStart(digits, '0')].join(separator);
  }

  /** In-memory fallback is used only when PostgreSQL is not authoritative. */
  static generateAssetNumber(ownerDivision?: string, assetCode?: string, targetYear?: number): string {
    const year = targetYear || new Date().getFullYear();
    const div = (ownerDivision || 'IT').trim().toUpperCase();
    const code = (assetCode || 'GEN').trim().toUpperCase();
    const rule = this.rules.get(`${div}:${code}`);
    if (rule && !rule.is_active) {
      throw new Error(`Aturan penomoran ${div}/${code} sedang nonaktif. Aktifkan kembali melalui Administration Control Panel.`);
    }
    const key = `${div}:${code}:${year}`;
    const nextSeq = (this.sequenceStore.get(key) || 0) + 1;
    return this.formatReservedAssetNumber(div, code, year, nextSeq);
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

  /** Format a sequence already reserved from the durable PostgreSQL counter. */
  static formatReservedContractNumber(targetYear: number, sequence: number): string {
    if (!Number.isInteger(targetYear) || targetYear < 2000 || targetYear > 2100
      || !Number.isSafeInteger(sequence) || sequence < 1) {
      throw new Error('Reservasi sequence nomor kontrak tidak valid.');
    }
    this.contractSeq.set(targetYear, Math.max(this.contractSeq.get(targetYear) || 0, sequence));
    return `CTR-${targetYear}-${String(sequence).padStart(4, '0')}`;
  }

  /** In-memory fallback is used only when PostgreSQL is not authoritative. */
  static generateContractNumber(targetYear?: number): string {
    const year = targetYear || new Date().getFullYear();
    const next = (this.contractSeq.get(year) || 0) + 1;
    return this.formatReservedContractNumber(year, next);
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
    this.rules.clear();
    this.sequenceStore.clear();
    this.ticketSeq.clear();
    this.loanSeq.clear();
  }
}
