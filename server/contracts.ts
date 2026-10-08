import { db, ServerUser, ServerContract, ServerContractDocument, ServerContractMilestone, ServerContractNotificationLog, ContractStatus, RenewalOutcome, ContractReminderConfig } from './db';
import { AssetNumberingEngine } from './numbering';
import { queueNotification, summarize, SCHEDULER_ACTOR } from './notifications/notificationService';
import { persistDataStore } from './persistence';

/**
 * CONTRACT MANAGEMENT — separate business domain.
 * Contract = business record; Notification = reminder; Ticket = linked work/action.
 * Contract is NOT a helpdesk ticket category.
 */

const DEFAULT_REMINDER_CONFIG: ContractReminderConfig = {
  reminder1_days: 60,
  reminder2_days: 35,
  reminder3_days: 7,
};

function daysUntil(dateIso: string): number {
  const target = new Date(dateIso).getTime();
  if (isNaN(target)) return Number.POSITIVE_INFINITY;
  return Math.ceil((target - Date.now()) / (24 * 3600 * 1000));
}

function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Reminder "due day" bucket (Asia/Jakarta by default, CR-05 STEP 4).
 * All reminders evaluated on the same calendar day share one idempotency
 * bucket, so re-running the sweep during the day never duplicates deliveries.
 */
function reminderDueDay(): string {
  const tz = process.env.GABAH_REMINDER_TIMEZONE || 'Asia/Jakarta';
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Compute derived contract status from end date + reminder thresholds. */
export function computeContractStatus(contract: ServerContract): ContractStatus {
  if (['draft', 'terminated', 'renewed'].includes(contract.status)) return contract.status;
  const days = daysUntil(contract.end_date);
  if (days < 0) return 'expired';
  if (days <= contract.reminder_config.reminder3_days) return 'expiring';
  if (days <= contract.reminder_config.reminder1_days) return 'expiring';
  return contract.status === 'renewal_in_progress' ? 'renewal_in_progress' : 'active';
}

/** Visual + textual reminder level for accessibility (not color-only). */
export function getReminderLevel(contract: ServerContract): { level: 'normal' | 'warning' | 'urgent' | 'critical' | 'expired'; label: string; daysLeft: number } {
  const daysLeft = daysUntil(contract.end_date);
  if (daysLeft < 0) return { level: 'expired', label: `Kedaluwarsa (${Math.abs(daysLeft)} hari lalu)`, daysLeft };
  if (daysLeft <= contract.reminder_config.reminder3_days) return { level: 'critical', label: `KRITIS — sisa ${daysLeft} hari`, daysLeft };
  if (daysLeft <= contract.reminder_config.reminder2_days) return { level: 'urgent', label: `SEGERA — sisa ${daysLeft} hari`, daysLeft };
  if (daysLeft <= contract.reminder_config.reminder1_days) return { level: 'warning', label: `Peringatan — sisa ${daysLeft} hari`, daysLeft };
  return { level: 'normal', label: `Normal — sisa ${daysLeft} hari`, daysLeft };
}

export function canSeeContract(user: ServerUser, contract: ServerContract): boolean {
  if (user.role === 'Admin GABAH') return true;
  // Auditor: full read authority over governance records
  if (user.role === 'Auditor') return true;
  if (contract.pic_user_id === user.id) return true;
  if (contract.owner_division === user.division) return true;
  // Non-restricted contracts are visible org-wide read-only for transparency
  return !contract.restricted;
}

export function canManageContracts(user: ServerUser): boolean {
  // Contract management is limited to the operational owner roles.
  return ['Admin GABAH', 'IT', 'GA', 'Supply Chain', 'PIBC'].includes(user.role);
}

function canEditContract(user: ServerUser, contract: ServerContract): boolean {
  // RBAC: management kontrak hanya untuk peran operasional pemilik
  // (Admin GABAH, IT, GA, Supply Chain, PIBC). Peran request/read-only
  // (Sekretaris Direksi, Humas, Karyawan, Auditor) tidak boleh edit.
  if (!canManageContracts(user)) return false;
  if (user.role === 'Admin GABAH') return true;
  return contract.pic_user_id === user.id || contract.owner_division === user.division;
}

function recordContractAudit(action: string, details: string, actor: ServerUser, contractId: string) {
  // Shape MUST match the canonical ServerAuditLog (recordAudit in services.ts):
  // the PostgreSQL audit_logs table enforces entity/user_name/user_role NOT NULL,
  // and a deviating shape silently breaks the authoritative persistence sync.
  db.auditLogs.unshift({
    id: `LOG-CTR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    action,
    entity: 'Contracts',
    entity_id: contractId,
    user_name: actor.name || 'System',
    user_role: actor.role,
    details,
    timestamp: new Date().toISOString(),
  } as any);
}

// NOTE (CR-05): queueing/delivery moved to server/notifications/notificationService.ts —
// real email (SMTP) + Telegram providers, deterministic idempotency keys, honest
// sent/failed/skipped statuses, targeted recipients only (PIC + owner division +
// escalation), audit trail per queue attempt.

export const ContractDomainService = {
  DEFAULT_REMINDER_CONFIG,

  listContracts(user: ServerUser): ServerContract[] {
    return db.contracts.filter(c => canSeeContract(user, c));
  },

  getContract(user: ServerUser, contractId: string): ServerContract {
    const contract = db.contracts.find(c => c.id === contractId);
    if (!contract) throw new Error('Kontrak tidak ditemukan');
    if (!canSeeContract(user, contract)) throw new Error('Akses ditolak: kontrak terbatas (restricted).');
    return contract;
  },

  createContract(payload: Partial<ServerContract> & { end_date: string; start_date: string; title: string; vendor_name: string; owner_division: string; pic_user_id: string }, actor: ServerUser): ServerContract {
    if (!canManageContracts(actor)) {
      throw new Error('Akses ditolak: Auditor bersifat read-only.');
    }
    const ownerDivision = (payload.owner_division || actor.division).toString().trim().toUpperCase();
    const pic = db.users.find(u => u.id === payload.pic_user_id) || actor;
    // Division ownership authorization: creators may only register contracts for their own division unless Admin
    if (actor.role !== 'Admin GABAH' && ownerDivision !== actor.division) {
      throw new Error(`Akses ditolak: hanya Admin GABAH yang dapat mendaftarkan kontrak untuk divisi lain (${ownerDivision}).`);
    }

    const reminderConfig: ContractReminderConfig = {
      reminder1_days: payload.reminder_config?.reminder1_days ?? DEFAULT_REMINDER_CONFIG.reminder1_days,
      reminder2_days: payload.reminder_config?.reminder2_days ?? DEFAULT_REMINDER_CONFIG.reminder2_days,
      reminder3_days: payload.reminder_config?.reminder3_days ?? DEFAULT_REMINDER_CONFIG.reminder3_days,
    };

    const nowIso = new Date().toISOString();
    const contract: ServerContract = {
      id: `CTR-${Date.now()}`,
      contract_number: AssetNumberingEngine.generateContractNumber(),
      contract_type: (payload.contract_type || 'Umum').trim(),
      title: payload.title.trim(),
      vendor_name: payload.vendor_name.trim(),
      owner_division: ownerDivision,
      owner_division_label: payload.owner_division_label,
      pic_user_id: pic.id,
      pic_name: pic.name,
      start_date: payload.start_date,
      end_date: payload.end_date,
      notice_period_days: payload.notice_period_days ?? 0,
      notice_date: (payload.notice_period_days ?? 0) > 0 ? addDays(payload.end_date, -(payload.notice_period_days ?? 0)) : payload.end_date,
      contract_value: payload.contract_value || 0,
      auto_renewal: Boolean(payload.auto_renewal),
      status: payload.status === 'draft' ? 'draft' : 'active',
      renewal_outcome: 'pending_decision',
      renewal_notes: payload.renewal_notes || null,
      replaced_by_contract_id: null,
      parent_contract_id: payload.parent_contract_id || null,
      documents: Array.isArray(payload.documents) ? payload.documents : [],
      milestones: Array.isArray(payload.milestones) ? payload.milestones : [],
      reminder_config: reminderConfig,
      escalation_user_id: payload.escalation_user_id || null,
      restricted: Boolean(payload.restricted),
      notes: payload.notes || null,
      created_by: actor.id,
      created_by_name: actor.name,
      created_at: nowIso,
      updated_at: nowIso,
    };

    db.contracts.unshift(contract);
    recordContractAudit('CONTRACT_CREATED', `Mendaftarkan kontrak ${contract.contract_number}: ${contract.title} (${contract.vendor_name}) — divisi pemilik ${contract.owner_division}`, actor, contract.id);
    return contract;
  },

  updateContract(contractId: string, updates: Partial<ServerContract>, actor: ServerUser): ServerContract {
    const contract = db.contracts.find(c => c.id === contractId);
    if (!contract) throw new Error('Kontrak tidak ditemukan');
    if (!canEditContract(actor, contract)) throw new Error('Akses ditolak: bukan PIC/divisi pemilik kontrak.');

    // SECURITY (CR-06): protected fields — these govern identity, ownership,
    // governance flags, and the authoritative lifecycle of the contract and can
    // only change through their dedicated, authorized endpoints (create with
    // division check, addDocument, addMilestone, decideRenewal, reminder sweep).
    const protectedFields: Array<keyof ServerContract> = [
      'id',
      'contract_number',
      'created_by',
      'created_by_name',
      'created_at',
      'owner_division',
      'owner_division_label',
      'pic_user_id',
      'pic_name',
      'restricted',
      'status',
      'renewal_outcome',
      'replaced_by_contract_id',
      'parent_contract_id',
      'documents',
      'milestones',
    ];
    for (const key of Object.keys(updates) as Array<keyof ServerContract>) {
      if (protectedFields.includes(key)) continue;
      if (updates[key] !== undefined) (contract as any)[key] = updates[key];
    }

    // Recompute notice_date when end_date or notice period changes
    if (updates.end_date || updates.notice_period_days !== undefined) {
      contract.notice_date = contract.notice_period_days > 0 ? addDays(contract.end_date, -contract.notice_period_days) : contract.end_date;
    }

    contract.status = computeContractStatus(contract);
    contract.updated_at = new Date().toISOString();

    recordContractAudit('CONTRACT_UPDATED', `Memperbarui kontrak ${contract.contract_number}`, actor, contract.id);
    return contract;
  },

  addDocument(contractId: string, doc: { kind: ServerContractDocument['kind']; file_name: string; file_ref: string }, actor: ServerUser): ServerContract {
    const contract = db.contracts.find(c => c.id === contractId);
    if (!contract) throw new Error('Kontrak tidak ditemukan');
    if (!canEditContract(actor, contract)) throw new Error('Akses ditolak: bukan PIC/divisi pemilik kontrak.');

    // Versioning-ready: documents are appended, never overwritten
    contract.documents.push({
      id: `CDoc-${Date.now()}`,
      kind: doc.kind,
      file_name: doc.file_name,
      file_ref: doc.file_ref,
      uploaded_by: actor.id,
      uploaded_by_name: actor.name,
      uploaded_at: new Date().toISOString(),
    });
    contract.updated_at = new Date().toISOString();
    recordContractAudit('CONTRACT_DOCUMENT_ADDED', `Dokumen '${doc.kind}' ditambahkan pada kontrak ${contract.contract_number}: ${doc.file_name}`, actor, contract.id);
    return contract;
  },

  addMilestone(contractId: string, milestone: Omit<ServerContractMilestone, 'id' | 'status'>, actor: ServerUser): ServerContract {
    const contract = db.contracts.find(c => c.id === contractId);
    if (!contract) throw new Error('Kontrak tidak ditemukan');
    if (!canEditContract(actor, contract)) throw new Error('Akses ditolak: bukan PIC/divisi pemilik kontrak.');

    contract.milestones.push({ ...milestone, id: `CMS-${Date.now()}`, status: 'pending' });
    contract.updated_at = new Date().toISOString();
    recordContractAudit('CONTRACT_MILESTONE_ADDED', `Milestone '${milestone.type}' ditambahkan pada kontrak ${contract.contract_number}: ${milestone.title}`, actor, contract.id);
    return contract;
  },

  decideRenewal(contractId: string, outcome: RenewalOutcome, notes: string, replacementContractId: string | null, actor: ServerUser): ServerContract {
    const contract = db.contracts.find(c => c.id === contractId);
    if (!contract) throw new Error('Kontrak tidak ditemukan');
    if (!canEditContract(actor, contract)) throw new Error('Akses ditolak: bukan PIC/divisi pemilik kontrak.');

    contract.renewal_outcome = outcome;
    contract.renewal_notes = notes || null;
    contract.replaced_by_contract_id = replacementContractId;
    if (outcome === 'renewed' || outcome === 'replaced_by_new_contract') {
      contract.status = 'renewed';
    } else if (outcome === 'terminated') {
      contract.status = 'terminated';
    } else if (outcome === 'not_renewed') {
      contract.status = 'expired';
    }
    contract.updated_at = new Date().toISOString();

    recordContractAudit('CONTRACT_RENEWAL_DECISION', `Keputusan renewal kontrak ${contract.contract_number}: ${outcome}. Catatan: ${notes || '-'}`, actor, contract.id);
    return contract;
  },

  /**
   * Reminder evaluation pass — called from the API (POST /api/contracts/reminders/run)
   * and from the internal scheduler. Evaluates expiry/notice thresholds and
   * queues notifications once per (contract, threshold, due day).
   *
   * CR-05 hardening on top of the original engine:
   *  - Idempotency via deterministic key (contract, type, channel, recipient, due day);
   *    a UNIQUE index in PostgreSQL backs the in-memory guard.
   *  - Auto-renewal contracts keep receiving reminders until their (future) end date,
   *    but the message states that renewal is automatic (no false urgency).
   *  - Notice-date reminder uses a bounded evaluation window, not a single-day check.
   *  - Restricted contracts follow the exact same engine — recipients are resolved
   *    server-side from PIC/division/escalation, never from client input.
   */
  async runReminderSweep(actor?: ServerUser): Promise<{ evaluated: number; queued: number; sent: number; failed: number; skipped: number; logs: ServerContractNotificationLog[] }> {
    const dueDay = reminderDueDay();
    let queued = 0, sent = 0, failed = 0, skipped = 0;
    const logs: ServerContractNotificationLog[] = [];

    for (const contract of db.contracts) {
      if (['draft', 'terminated', 'renewed'].includes(contract.status)) continue;
      const days = daysUntil(contract.end_date);
      const thresholds: Array<[number, string]> = [
        [contract.reminder_config.reminder3_days, 'EXPIRY_7'],
        [contract.reminder_config.reminder2_days, 'EXPIRY_35'],
        [contract.reminder_config.reminder1_days, 'EXPIRY_60'],
      ];

      const dueTypes: string[] = [];
      for (const [thresholdDays, type] of thresholds) {
        if (days <= thresholdDays && days >= 0) dueTypes.push(type);
      }

      // Notice-date reminder: bounded window (today or up to 1 day missed),
      // distinct from the expiry reminders.
      if (contract.notice_period_days > 0) {
        const noticeDays = daysUntil(contract.notice_date);
        if (noticeDays <= 0 && noticeDays >= -1) dueTypes.push('NOTICE_DATE');
      }

      for (const type of dueTypes) {
        const result = await queueNotification(contract, type, dueDay, actor || SCHEDULER_ACTOR);
        for (const log of result.logs) {
          logs.push(log);
          if (log.status === 'sent') sent++;
          else if (log.status === 'failed') failed++;
          else if (log.status === 'skipped') skipped++;
        }
        if (result.created) queued += result.logs.length;
      }

      // Keep derived status fresh
      const derived = computeContractStatus(contract);
      if (derived !== contract.status) {
        contract.status = derived;
        contract.updated_at = new Date().toISOString();
      }
    }

    if (queued > 0) {
      // Await (not fire-and-forget): the idempotency ledger must reach the
      // authoritative store before the sweep returns, otherwise a process kill
      // right after a sweep could re-queue and re-deliver the same reminders.
      try { await persistDataStore(); } catch { /* persistence failures are non-fatal for the sweep */ }
    }

    return { evaluated: db.contracts.length, queued, sent, failed, skipped, logs };
  },

  getNotificationLogs(user: ServerUser, contractId?: string): ServerContractNotificationLog[] {
    const logs = contractId ? db.contractNotificationLogs.filter(l => l.contract_id === contractId) : db.contractNotificationLogs;
    if (user.role === 'Admin GABAH' || user.role === 'Auditor') return logs;
    const visibleContracts = new Set(this.listContracts(user).map(c => c.id));
    return logs.filter(l => visibleContracts.has(l.contract_id));
  },
};
