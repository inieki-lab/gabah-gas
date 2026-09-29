import { db, ServerUser, ServerContract, ServerContractDocument, ServerContractMilestone, ServerContractNotificationLog, ContractStatus, RenewalOutcome, ContractReminderConfig } from './db';
import { AssetNumberingEngine } from './numbering';

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
  // Ownership-based creation: any authenticated non-auditor staff may register contracts for their division;
  // Admin GABAH manages all. Auditor is read-only.
  return user.role !== 'Auditor';
}

function canEditContract(user: ServerUser, contract: ServerContract): boolean {
  if (user.role === 'Admin GABAH') return true;
  if (user.role === 'Auditor') return false;
  return contract.pic_user_id === user.id || contract.owner_division === user.division;
}

function recordContractAudit(action: string, details: string, actor: ServerUser, contractId: string) {
  db.auditLogs.unshift({
    id: `AUD-CTR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user_id: actor.id,
    user_name: actor.name,
    role: actor.role as any,
    module: 'Contracts',
    action,
    details,
    timestamp: new Date().toISOString(),
  } as any);
}

/** Queue a contract notification across channels with per-delivery logging. */
function queueNotification(
  contract: ServerContract,
  notificationType: string,
  actor?: ServerUser
): ServerContractNotificationLog[] {
  const now = new Date().toISOString();
  const recipients: string[] = [contract.pic_user_id];
  // Owner department distribution list (division role recipients)
  recipients.push(`division:${contract.owner_division}`);
  // Escalation recipient for urgent/critical thresholds
  if (['EXPIRY_35', 'EXPIRY_7', 'NOTICE_DATE'].includes(notificationType) && contract.escalation_user_id) {
    recipients.push(contract.escalation_user_id);
  }

  const channels: Array<'in_app' | 'email' | 'telegram'> = ['in_app', 'email', 'telegram'];
  const logs: ServerContractNotificationLog[] = [];

  for (const recipient of recipients) {
    for (const channel of channels) {
      let status: 'sent' | 'failed' = 'sent';
      let error: string | null = null;

      if (channel === 'email') {
        // Outbound email transport is pluggable (SMTP provider). Until a provider key
        // is configured, delivery is recorded as skipped rather than silently failing.
        if (!process.env.SMTP_URL && !process.env.EMAIL_API_KEY) {
          status = 'failed';
          error = 'Email provider belum dikonfigurasi (SMTP_URL / EMAIL_API_KEY)';
        }
      }
      if (channel === 'telegram') {
        if (!process.env.TELEGRAM_BOT_TOKEN) {
          status = 'failed';
          error = 'Telegram bot belum dikonfigurasi (TELEGRAM_BOT_TOKEN)';
        }
      }

      const log: ServerContractNotificationLog = {
        id: `CNL-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        contract_id: contract.id,
        notification_type: notificationType,
        channel,
        recipient,
        scheduled_at: now,
        sent_at: status === 'sent' ? now : null,
        status: status === 'sent' ? 'sent' : 'failed',
        error_message: error,
      };
      db.contractNotificationLogs.unshift(log);
      logs.push(log);
    }

    // In-app notification also goes to the user's notification feed
    if (recipient === contract.pic_user_id || recipient.startsWith('division:')) {
      db.notifications.unshift({
        id: `NTF-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        recipient_user_id: recipient === contract.pic_user_id ? contract.pic_user_id : undefined,
        recipient_role: recipient.startsWith('division:') ? recipient.replace('division:', '') : undefined,
        title: `[Kontrak] ${notificationType}: ${contract.contract_number}`,
        message: `${contract.title} (${contract.vendor_name}) — ${getReminderLevel(contract).label}`,
        severity: notificationType === 'EXPIRY_7' || notificationType === 'NOTICE_DATE' ? 'critical' : notificationType === 'EXPIRY_35' ? 'action_required' : 'warning',
        category: 'contract',
        link_type: 'contract',
        link_id: contract.id,
        is_read: false,
        created_at: now,
      } as any);
    }
  }

  recordContractAudit(
    'CONTRACT_REMINDER_QUEUED',
    `Reminder ${notificationType} untuk kontrak ${contract.contract_number} diantrian (${logs.length} antrean kirim)`,
    actor || ({ id: 'SYSTEM', name: 'System Scheduler', role: 'SYSTEM', department: '-' } as unknown as ServerUser),
    contract.id
  );

  return logs;
}

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

    const protectedFields: Array<keyof ServerContract> = ['id', 'contract_number', 'created_by', 'created_at', 'created_by_name'];
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
   * Reminder evaluation pass — called from the API (GET /api/contracts/reminders/run)
   * and intended for a scheduler. Evaluates expiry/notice thresholds and queues
   * notifications once per threshold per contract (idempotent per type+day).
   */
  runReminderSweep(actor?: ServerUser): { evaluated: number; queued: number; logs: ServerContractNotificationLog[] } {
    const logs: ServerContractNotificationLog[] = [];
    let queued = 0;
    const today = new Date().toISOString().slice(0, 10);

    for (const contract of db.contracts) {
      if (['draft', 'terminated', 'renewed'].includes(contract.status)) continue;
      const days = daysUntil(contract.end_date);
      const thresholds: Array<[number, string]> = [
        [contract.reminder_config.reminder3_days, 'EXPIRY_7'],
        [contract.reminder_config.reminder2_days, 'EXPIRY_35'],
        [contract.reminder_config.reminder1_days, 'EXPIRY_60'],
      ];

      for (const [thresholdDays, type] of thresholds) {
        if (days <= thresholdDays && days >= 0) {
          const alreadyQueuedToday = db.contractNotificationLogs.some(
            l => l.contract_id === contract.id && l.notification_type === type && l.scheduled_at.slice(0, 10) === today
          );
          if (!alreadyQueuedToday) {
            const result = queueNotification(contract, type, actor);
            logs.push(...result);
            queued += result.length;
          }
        }
      }

      // Notice-date reminder (distinct from expiry reminder)
      const noticeDays = daysUntil(contract.notice_date);
      if (contract.notice_period_days > 0 && noticeDays <= 0 && noticeDays > -1) {
        const alreadyQueuedToday = db.contractNotificationLogs.some(
          l => l.contract_id === contract.id && l.notification_type === 'NOTICE_DATE' && l.scheduled_at.slice(0, 10) === today
        );
        if (!alreadyQueuedToday) {
          const result = queueNotification(contract, 'NOTICE_DATE', actor);
          logs.push(...result);
          queued += result.length;
        }
      }

      // Keep derived status fresh
      const derived = computeContractStatus(contract);
      if (derived !== contract.status) {
        contract.status = derived;
        contract.updated_at = new Date().toISOString();
      }
    }

    return { evaluated: db.contracts.length, queued, logs };
  },

  getNotificationLogs(user: ServerUser, contractId?: string): ServerContractNotificationLog[] {
    const logs = contractId ? db.contractNotificationLogs.filter(l => l.contract_id === contractId) : db.contractNotificationLogs;
    if (user.role === 'Admin GABAH' || user.role === 'Auditor') return logs;
    const visibleContracts = new Set(this.listContracts(user).map(c => c.id));
    return logs.filter(l => visibleContracts.has(l.contract_id));
  },
};
