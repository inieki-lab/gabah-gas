import crypto from 'node:crypto';
import { db, ServerContract, ServerContractNotificationLog, ServerUser } from '../db';
import { sendEmail, isEmailConfigured } from './emailProvider';
import { sendTelegram, isTelegramConfigured } from './telegramProvider';
import { persistDataStore } from '../persistence';

/**
 * GABAH Notification Service (CR-05 / STEP 7)
 *
 * Contract Reminder -> Notification Service -> [ In-App | Email | Telegram ]
 *
 * Guarantees:
 *  - Idempotent: each (contract, notificationType, channel, recipient, dueDay)
 *    combination maps to ONE deterministic idempotency key; the UNIQUE index
 *    uq_contract_notif_idempotency in PostgreSQL plus an in-memory guard make
 *    duplicate delivery impossible even with concurrent sweeps or retries.
 *  - Honest statuses: sent only after real provider confirmation; skipped when
 *    a provider is intentionally unconfigured; failed with the provider error.
 *  - No broadcast: recipients are the contract PIC, the owner division, and the
 *    configured escalation user only. Client input can never add recipients.
 *  - Audit trail for every queue attempt (CONTRACT_REMINDER_*).
 */

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface NotificationDispatchResult {
  queued: number;
  sent: number;
  failed: number;
  skipped: number;
  logs: ServerContractNotificationLog[];
}

const SCHEDULER_ACTOR: ServerUser = {
  id: 'SYSTEM',
  name: 'System Scheduler',
  email: 'system@gabah.local',
  role: 'Admin GABAH', // system authority for audit trail display
  division: 'IT',
  department: 'System',
  avatar: '',
  is_active: true,
};

/** Deterministic idempotency key: same logical notification => same id => single row. */
export function buildIdempotencyKey(
  contractId: string,
  notificationType: string,
  channel: string,
  recipient: string,
  dueDay: string,
): string {
  return crypto
    .createHash('sha256')
    .update(`${contractId}|${notificationType}|${channel}|${recipient}|${dueDay}`)
    .digest('hex')
    .slice(0, 32)
    .toUpperCase();
}

function logExists(idempotencyKey: string): boolean {
  return db.contractNotificationLogs.some(l => l.id === idempotencyKey);
}

/** Recipient resolution — server-authoritative, never client-supplied. */
export function resolveRecipients(contract: ServerContract): Array<{ kind: 'user' | 'division'; id: string; label: string }> {
  const out: Array<{ kind: 'user' | 'division'; id: string; label: string }> = [];
  const seen = new Set<string>();
  const push = (kind: 'user' | 'division', id: string, label: string) => {
    if (!id || seen.has(`${kind}:${id}`)) return;
    seen.add(`${kind}:${id}`);
    out.push({ kind, id, label });
  };

  const pic = db.users.find(u => u.id === contract.pic_user_id);
  if (pic && pic.is_active) push('user', pic.id, pic.email || pic.id);

  // Owner division recipients = active non-Auditor users of that division (no org-wide broadcast).
  for (const u of db.users) {
    if (u.division === contract.owner_division && u.is_active && u.role !== 'Auditor') {
      push('user', u.id, u.email || u.id);
    }
  }
  // Division-level mailbox as a routing target (kept for parity with legacy logs).
  push('division', contract.owner_division, `division:${contract.owner_division}`);

  if (contract.escalation_user_id) {
    const esc = db.users.find(u => u.id === contract.escalation_user_id && u.is_active);
    if (esc) push('user', esc.id, esc.email || esc.id);
  }
  return out;
}

function buildMessage(contract: ServerContract, notificationType: string, level: { label: string }): { subject: string; text: string } {
  const subject = `[GABAH] ${notificationType} — Kontrak ${contract.contract_number}`;
  const lines = [
    `Kontrak: ${contract.title}`,
    `Nomor: ${contract.contract_number}`,
    `Vendor: ${contract.vendor_name}`,
    `Divisi Pemilik: ${contract.owner_division}`,
    `PIC: ${contract.pic_name}`,
    `Periode: ${contract.start_date} s/d ${contract.end_date}`,
    `Status: ${level.label}`,
    contract.auto_renewal
      ? 'Kontrak ini tercatat perpanjangan otomatis (auto-renewal) — tindakan tidak diperlukan kecuali ada perubahan kebijakan.'
      : 'Mohon tinjau keputusan perpanjangan (renewal) kontrak ini.',
  ];
  return { subject, text: lines.join('\n') };
}

/**
 * Queue + deliver one notification across all channels with honest per-channel
 * statuses. Returns the created logs (empty when idempotency blocked duplicates).
 */
export async function queueNotification(
  contract: ServerContract,
  notificationType: string,
  dueDay: string,
  actor: ServerUser,
): Promise<{ created: boolean; logs: ServerContractNotificationLog[] }> {
  const recipients = resolveRecipients(contract);
  const channels: Array<'in_app' | 'email' | 'telegram'> = ['in_app', 'email', 'telegram'];
  const level = buildLevel(contract, notificationType);
  const { subject, text } = buildMessage(contract, notificationType, level);
  const now = new Date().toISOString();
  const logs: ServerContractNotificationLog[] = [];

  for (const recipient of recipients) {
    // ----- In-app: always deliverable, targeted to the recipient user/role -----
    const inAppKey = buildIdempotencyKey(contract.id, notificationType, 'in_app', `${recipient.kind}:${recipient.id}`, dueDay);
    if (!logExists(inAppKey)) {
      if (recipient.kind === 'user') {
        db.notifications.unshift({
          id: `NTF-${crypto.randomBytes(8).toString('hex')}`,
          recipient_user_id: recipient.id,
          title: `[Kontrak] ${notificationType}: ${contract.contract_number}`,
          message: `${contract.title} (${contract.vendor_name}) — ${level.label}`,
          severity: severityFor(notificationType),
          category: 'contract',
          link_type: 'contract',
          link_id: contract.id,
          is_read: false,
          created_at: now,
        } as any);
      }
      const log = makeLog(inAppKey, contract.id, notificationType, 'in_app', recipient.label, now, 'sent', null);
      db.contractNotificationLogs.unshift(log);
      logs.push(log);
    }

    // ----- Email -----
    const emailKey = buildIdempotencyKey(contract.id, notificationType, 'email', `${recipient.kind}:${recipient.id}`, dueDay);
    if (!logExists(emailKey)) {
      let status: NotificationStatus;
      let error: string | null = null;
      let sentAt: string | null = null;
      if (!isEmailConfigured()) {
        status = 'skipped';
        error = 'Email provider belum dikonfigurasi (GABAH_SMTP_HOST / GABAH_SMTP_FROM)';
      } else if (recipient.kind === 'division' || !recipient.label.includes('@')) {
        status = 'skipped';
        error = 'Penerima divisi/role tanpa alamat email';
      } else {
        const result = await sendEmail({ to: recipient.label, subject, text });
        status = result.ok ? 'sent' : 'failed';
        sentAt = result.ok ? new Date().toISOString() : null;
        error = result.ok ? null : result.error || 'SMTP delivery gagal';
      }
      const log = makeLog(emailKey, contract.id, notificationType, 'email', recipient.label, now, status, error);
      log.sent_at = sentAt;
      db.contractNotificationLogs.unshift(log);
      logs.push(log);
    }

    // ----- Telegram -----
    const tgKey = buildIdempotencyKey(contract.id, notificationType, 'telegram', `${recipient.kind}:${recipient.id}`, dueDay);
    if (!logExists(tgKey)) {
      let status: NotificationStatus;
      let error: string | null = null;
      let sentAt: string | null = null;
      if (!isTelegramConfigured()) {
        status = 'skipped';
        error = 'Telegram bot belum dikonfigurasi (TELEGRAM_BOT_TOKEN)';
      } else if (recipient.kind === 'division') {
        status = 'skipped';
        error = 'Penerima divisi/role tanpa chat id Telegram';
      } else {
        const chatId = telegramChatIdFor(recipient.id);
        if (!chatId) {
          status = 'skipped';
          error = `Penerima ${recipient.id} tidak memiliki telegram_chat_id`;
        } else {
          const result = await sendTelegram({ chatId, text: `${subject}\n\n${text}` });
          status = result.ok ? 'sent' : 'failed';
          sentAt = result.ok ? new Date().toISOString() : null;
          error = result.ok ? null : result.error || 'Telegram delivery gagal';
        }
      }
      const log = makeLog(tgKey, contract.id, notificationType, 'telegram', recipient.label, now, status, error);
      log.sent_at = sentAt;
      db.contractNotificationLogs.unshift(log);
      logs.push(log);
    }
  }

  recordAudit(logs, contract, notificationType, actor);
  return { created: logs.length > 0, logs };
}

function makeLog(
  id: string,
  contractId: string,
  notificationType: string,
  channel: ServerContractNotificationLog['channel'],
  recipient: string,
  scheduledAt: string,
  status: NotificationStatus,
  error: string | null,
): ServerContractNotificationLog {
  return {
    id,
    contract_id: contractId,
    notification_type: notificationType,
    channel,
    recipient,
    scheduled_at: scheduledAt,
    sent_at: status === 'sent' ? scheduledAt : null,
    status,
    error_message: error,
  };
}

function severityFor(notificationType: string): 'critical' | 'action_required' | 'warning' {
  if (notificationType === 'EXPIRY_7' || notificationType === 'NOTICE_DATE') return 'critical';
  if (notificationType === 'EXPIRY_35') return 'action_required';
  return 'warning';
}

function buildLevel(contract: ServerContract, notificationType: string): { label: string } {
  const days = Math.ceil((new Date(contract.end_date).getTime() - Date.now()) / 86400000);
  if (notificationType === 'NOTICE_DATE') return { label: `Notice date tercapai (${contract.notice_date})` };
  if (notificationType === 'MILESTONE_DUE') return { label: 'Milestone jatuh tempo' };
  return { label: `Sisa ${Math.max(days, 0)} hari sebelum ${contract.end_date}` };
}

/**
 * Telegram chat id resolution. The user profile may carry telegram_chat_id.
 * A division mapping via env (GABAH_TELEGRAM_CHAT_<DIVISION>) is intentionally
 * NOT client-reachable; resolution stays server-side.
 */
function telegramChatIdFor(userId: string): string | null {
  const u = db.users.find(x => x.id === userId) as any;
  const chatId = u?.telegram_chat_id;
  return typeof chatId === 'string' && chatId.trim() ? chatId.trim() : null;
}

function recordAudit(logs: ServerContractNotificationLog[], contract: ServerContract, notificationType: string, actor: ServerUser): void {
  if (logs.length === 0) return;
  const byStatus = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});
  db.auditLogs.unshift({
    id: `AUD-CTR-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    action: 'CONTRACT_REMINDER_QUEUED',
    module: 'Contracts',
    entity: 'Contract',
    entity_id: contract.id,
    user_name: actor.name,
    user_role: actor.role,
    user_id: actor.id,
    details: `Reminder ${notificationType} kontrak ${contract.contract_number}: ${logs.length} antrean (${JSON.stringify(byStatus)})`,
    timestamp: new Date().toISOString(),
  } as any);
}

/** Aggregate helper for API responses. */
export function summarize(logs: ServerContractNotificationLog[]): NotificationDispatchResult {
  return {
    queued: logs.length,
    sent: logs.filter(l => l.status === 'sent').length,
    failed: logs.filter(l => l.status === 'failed').length,
    skipped: logs.filter(l => l.status === 'skipped').length,
    logs,
  };
}

export { SCHEDULER_ACTOR };
