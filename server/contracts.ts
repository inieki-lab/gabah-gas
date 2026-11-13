import { db, ServerUser, ServerContract, ServerContractDocument, ServerContractMilestone, ServerContractNotificationLog, ContractStatus, RenewalOutcome, ContractReminderConfig } from './db';
import { AssetNumberingEngine } from './numbering';
import { queueNotification, summarize, SCHEDULER_ACTOR } from './notifications/notificationService';
import { persistDataStore } from './persistence';
import { isPostgresPersistenceActive } from './persistence';
import { hasRbacPermission, hasRbacScope, isSuperadminActor, isAuditorActor } from './rbac-policy';

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
  if (isSuperadminActor(user) || isAuditorActor(user)) return true;
  if (contract.pic_user_id === user.id) return true;
  const owner = String(contract.owner_division || '').trim().toUpperCase();
  if (!owner) return false;

  if (isPostgresPersistenceActive()) {
    return hasRbacPermission(String(user.id), 'contracts.read')
      && hasRbacScope(String(user.id), 'division', owner, 'contracts');
  }

  return user.role === owner;
}

export function canManageContracts(user: ServerUser): boolean {
  if (isSuperadminActor(user)) return true;
  if (isPostgresPersistenceActive()) {
    return hasRbacPermission(String(user.id), 'contracts.create')
      || hasRbacPermission(String(user.id), 'contracts.update');
  }
  return user.role === 'IT' || user.role === 'GA';
}

// SEC-08: Expose canEditContract for server.ts file upload validation
export function canEditContract(user: ServerUser, contract: ServerContract): boolean {
  if (isSuperadminActor(user)) return true;
  const owner = String(contract.owner_division || '').trim().toUpperCase();
  if (!owner) return false;
  if (contract.pic_user_id === user.id) {
    return isPostgresPersistenceActive()
      ? hasRbacPermission(String(user.id), 'contracts.update')
      : user.role === owner;
  }
  if (isPostgresPersistenceActive()) {
    return hasRbacPermission(String(user.id), 'contracts.update')
      && hasRbacScope(String(user.id), 'division', owner, 'contracts');
  }
  return user.role === owner;
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
      throw new Error('Akses ditolak: permission contracts.create tidak diberikan.');
    }
    if (typeof payload.title !== 'string' || !payload.title.trim()
      || typeof payload.vendor_name !== 'string' || !payload.vendor_name.trim()) {
      throw new Error('Judul kontrak dan nama vendor wajib diisi.');
    }
    const startDate = new Date(payload.start_date);
    const endDate = new Date(payload.end_date);
    if (!payload.start_date || !payload.end_date
      || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())
      || startDate > endDate) {
      throw new Error('Periode kontrak tidak valid: tanggal mulai harus valid dan tidak melewati tanggal berakhir.');
    }

    const ownerDivision = (payload.owner_division || actor.division || '').toString().trim().toUpperCase();
    const ownerExists = (db.divisions || []).some(d =>
      String(d.code).trim().toUpperCase() === ownerDivision && d.is_active !== false
    );
    const ownerScopeAllowed = ownerExists
      && (isSuperadminActor(actor) || (isPostgresPersistenceActive()
        ? hasRbacScope(String(actor.id), 'division', ownerDivision, 'contracts')
        : actor.role === ownerDivision));
    if (!ownerScopeAllowed) {
      throw new Error(`Akses ditolak: scope pengguna tidak mencakup owner kontrak ${ownerDivision}.`);
    }

    // PIC is an explicit business relationship. Never silently replace an
    // invalid/inactive requested user with the actor creating the contract.
    const pic = db.users.find(u => u.id === payload.pic_user_id && u.is_active);
    if (!pic) throw new Error('PIC kontrak tidak ditemukan atau akun sudah nonaktif.');

    const escalationUserId = payload.escalation_user_id ? String(payload.escalation_user_id).trim() : '';
    if (escalationUserId && !db.users.some(u => u.id === escalationUserId && u.is_active)) {
      throw new Error('Pengguna eskalasi tidak ditemukan atau akun sudah nonaktif.');
    }

    const parentContractId = payload.parent_contract_id ? String(payload.parent_contract_id).trim() : '';
    if (parentContractId) {
      const parent = db.contracts.find(item => item.id === parentContractId);
      if (!parent) throw new Error('Kontrak induk tidak ditemukan.');
      if (String(parent.owner_division || '').trim().toUpperCase() !== ownerDivision) {
        throw new Error('Kontrak induk harus berasal dari divisi pemilik yang sama.');
      }
      if (!canSeeContract(actor, parent)) {
        throw new Error('Akses ditolak: kontrak induk berada di luar scope pengguna.');
      }
    }

    const reminderConfig: ContractReminderConfig = {
      reminder1_days: payload.reminder_config?.reminder1_days ?? DEFAULT_REMINDER_CONFIG.reminder1_days,
      reminder2_days: payload.reminder_config?.reminder2_days ?? DEFAULT_REMINDER_CONFIG.reminder2_days,
      reminder3_days: payload.reminder_config?.reminder3_days ?? DEFAULT_REMINDER_CONFIG.reminder3_days,
    };
    const reminderValues = [reminderConfig.reminder1_days, reminderConfig.reminder2_days, reminderConfig.reminder3_days];
    if (reminderValues.some(value => !Number.isInteger(value) || value < 0)
      || reminderConfig.reminder1_days < reminderConfig.reminder2_days
      || reminderConfig.reminder2_days < reminderConfig.reminder3_days) {
      throw new Error('Konfigurasi reminder harus berupa bilangan bulat non-negatif dengan urutan 1 ≥ 2 ≥ 3.');
    }

    const noticePeriodDays = Number(payload.notice_period_days ?? 0);
    const contractValue = Number(payload.contract_value ?? 0);
    if (!Number.isInteger(noticePeriodDays) || noticePeriodDays < 0
      || !Number.isFinite(contractValue) || contractValue < 0) {
      throw new Error('Notice period dan nilai kontrak harus berupa angka non-negatif yang valid.');
    }

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
      notice_period_days: noticePeriodDays,
      notice_date: (payload.notice_period_days ?? 0) > 0 ? addDays(payload.end_date, -(payload.notice_period_days ?? 0)) : payload.end_date,
      contract_value: contractValue,
      auto_renewal: Boolean(payload.auto_renewal),
      status: payload.status === 'draft' ? 'draft' : 'active',
      renewal_outcome: 'pending_decision',
      renewal_notes: payload.renewal_notes || null,
      replaced_by_contract_id: null,
      parent_contract_id: parentContractId || null,
      documents: [],
      milestones: [],
      reminder_config: reminderConfig,
      escalation_user_id: escalationUserId || null,
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

    // SECURITY (CR-06): allowlist editable business fields. A denylist can
    // accidentally admit newly-added identity or workflow fields in the future.
    const editableFields: Array<keyof ServerContract> = [
      'contract_type',
      'title',
      'vendor_name',
      'start_date',
      'end_date',
      'notice_period_days',
      'contract_value',
      'auto_renewal',
      'renewal_notes',
      'reminder_config',
      'escalation_user_id',
      'notes',
    ];
    const unknownFields = Object.keys(updates).filter(key => !editableFields.includes(key as keyof ServerContract));
    if (unknownFields.length) throw new Error(`Field kontrak tidak dapat diubah melalui endpoint ini: ${unknownFields.join(', ')}.`);

    const nextStartDate = updates.start_date ?? contract.start_date;
    const nextEndDate = updates.end_date ?? contract.end_date;
    const parsedStartDate = new Date(nextStartDate);
    const parsedEndDate = new Date(nextEndDate);
    if (Number.isNaN(parsedStartDate.getTime()) || Number.isNaN(parsedEndDate.getTime()) || parsedStartDate > parsedEndDate) {
      throw new Error('Periode kontrak tidak valid: tanggal mulai harus valid dan tidak melewati tanggal berakhir.');
    }
    if (updates.title !== undefined && (typeof updates.title !== 'string' || !updates.title.trim())) {
      throw new Error('Judul kontrak wajib diisi.');
    }
    if (updates.vendor_name !== undefined && (typeof updates.vendor_name !== 'string' || !updates.vendor_name.trim())) {
      throw new Error('Nama vendor wajib diisi.');
    }
    if (updates.contract_type !== undefined && (typeof updates.contract_type !== 'string' || !updates.contract_type.trim())) {
      throw new Error('Tipe kontrak wajib diisi.');
    }
    if (updates.notice_period_days !== undefined
      && (!Number.isInteger(updates.notice_period_days) || updates.notice_period_days < 0)) {
      throw new Error('Notice period harus berupa bilangan bulat non-negatif.');
    }
    if (updates.contract_value !== undefined
      && (!Number.isFinite(updates.contract_value) || updates.contract_value < 0)) {
      throw new Error('Nilai kontrak harus berupa angka non-negatif yang valid.');
    }
    if (updates.reminder_config !== undefined) {
      const reminder = updates.reminder_config;
      const values = [reminder?.reminder1_days, reminder?.reminder2_days, reminder?.reminder3_days];
      if (values.some(value => !Number.isInteger(value) || Number(value) < 0)
        || reminder.reminder1_days < reminder.reminder2_days
        || reminder.reminder2_days < reminder.reminder3_days) {
        throw new Error('Konfigurasi reminder harus berupa bilangan bulat non-negatif dengan urutan 1 ≥ 2 ≥ 3.');
      }
    }
    if (updates.escalation_user_id) {
      const escalationId = String(updates.escalation_user_id).trim();
      if (!db.users.some(user => user.id === escalationId && user.is_active)) {
        throw new Error('Pengguna eskalasi tidak ditemukan atau akun sudah nonaktif.');
      }
      updates = { ...updates, escalation_user_id: escalationId };
    } else if (updates.escalation_user_id === '') {
      updates = { ...updates, escalation_user_id: null };
    }

    for (const key of editableFields) {
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

    const allowedKinds: ServerContractDocument['kind'][] = ['original_contract', 'amendment', 'renewal', 'supporting_document'];
    if (!doc || !allowedKinds.includes(doc.kind)
      || typeof doc.file_name !== 'string' || !doc.file_name.trim() || doc.file_name.length > 180
      || typeof doc.file_ref !== 'string' || !doc.file_ref.trim() || doc.file_ref.length > 512) {
      throw new Error('Metadata dokumen kontrak tidak valid.');
    }

    // Versioning-ready: documents are appended, never overwritten.
    // The caller identity is always taken from the authenticated session.
    contract.documents.push({
      id: `CDoc-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      kind: doc.kind,
      file_name: doc.file_name.trim(),
      file_ref: doc.file_ref.trim(),
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

    const allowedTypes: ServerContractMilestone['type'][] = ['payment', 'service_maintenance', 'evaluation', 'other_obligation'];
    const dueDate = new Date(milestone?.due_date);
    if (!milestone || !allowedTypes.includes(milestone.type)
      || typeof milestone.title !== 'string' || !milestone.title.trim() || milestone.title.length > 180
      || typeof milestone.due_date !== 'string' || Number.isNaN(dueDate.getTime())
      || (milestone.amount !== undefined && (!Number.isFinite(milestone.amount) || milestone.amount < 0))
      || (milestone.notes !== undefined && (typeof milestone.notes !== 'string' || milestone.notes.length > 2000))) {
      throw new Error('Data milestone kontrak tidak valid.');
    }
    contract.milestones.push({
      type: milestone.type,
      title: milestone.title.trim(),
      due_date: milestone.due_date,
      ...(milestone.amount !== undefined ? { amount: milestone.amount } : {}),
      ...(milestone.notes !== undefined ? { notes: milestone.notes } : {}),
      id: `CMS-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      status: 'pending',
    });
    contract.updated_at = new Date().toISOString();
    recordContractAudit('CONTRACT_MILESTONE_ADDED', `Milestone '${milestone.type}' ditambahkan pada kontrak ${contract.contract_number}: ${milestone.title}`, actor, contract.id);
    return contract;
  },

  decideRenewal(contractId: string, outcome: RenewalOutcome, notes: string, replacementContractId: string | null, actor: ServerUser): ServerContract {
    const contract = db.contracts.find(c => c.id === contractId);
    if (!contract) throw new Error('Kontrak tidak ditemukan');
    if (!canEditContract(actor, contract)) throw new Error('Akses ditolak: bukan PIC/divisi pemilik kontrak.');

    const allowedOutcomes: RenewalOutcome[] = [
      'pending_decision',
      'renewed',
      'not_renewed',
      'terminated',
      'replaced_by_new_contract',
    ];
    if (!allowedOutcomes.includes(outcome)) {
      throw new Error('Keputusan renewal tidak valid.');
    }

    if (outcome === 'replaced_by_new_contract') {
      if (!replacementContractId) {
        throw new Error('Kontrak pengganti wajib dipilih untuk keputusan replaced_by_new_contract.');
      }
      const replacement = db.contracts.find(item => item.id === replacementContractId);
      if (!replacement) throw new Error('Kontrak pengganti tidak ditemukan.');
      if (!canSeeContract(actor, replacement)) throw new Error('Akses ditolak: kontrak pengganti berada di luar scope pengguna.');
      if (replacement.id === contract.id) throw new Error('Kontrak tidak dapat menggantikan dirinya sendiri.');
      const sourceOwner = String(contract.owner_division || '').trim().toUpperCase();
      const replacementOwner = String(replacement.owner_division || '').trim().toUpperCase();
      if (!sourceOwner || replacementOwner !== sourceOwner) {
        throw new Error('Kontrak pengganti harus berasal dari divisi pemilik yang sama.');
      }
    } else if (replacementContractId) {
      throw new Error('ID kontrak pengganti hanya boleh diisi untuk keputusan replaced_by_new_contract.');
    }

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
    if (user.role === 'Admin GABAH' || isAuditorActor(user)) return logs;
    const visibleContracts = new Set(this.listContracts(user).map(c => c.id));
    return logs.filter(l => visibleContracts.has(l.contract_id));
  },
};
