import crypto from 'node:crypto';

/**
 * GABAH Telegram Provider (CR-05 / STEP 6)
 *
 * Real outbound delivery via the Telegram Bot API (sendMessage).
 *
 *   TELEGRAM_BOT_TOKEN           Bot token from @BotFather (required to enable)
 *   GABAH_TELEGRAM_TIMEOUT_MS    Per-request timeout (default 10000)
 *   GABAH_TELEGRAM_API_BASE      Optional override (default https://api.telegram.org)
 *
 * Recipient chat IDs are resolved by the notification service (user profile
 * telegram_chat_id / division list) — the client never supplies them.
 *
 * Design rules:
 *  - No fake success: HTTP 200 with ok:true from Telegram is the only "sent".
 *  - Unconfigured provider => isTelegramConfigured() false => service records
 *    status=skipped with a clear reason (never 'sent').
 *  - Bounded timeout + bounded retry on transient errors (429/5xx/network).
 */

export interface TelegramMessage {
  chatId: string;
  text: string;
  parseMode?: 'HTML';
  disableNotification?: boolean;
}

export interface TelegramSendResult {
  ok: boolean;
  messageId?: number;
  error?: string;
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

function apiBase(): string {
  return (process.env.GABAH_TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/+$/, '');
}

async function postJson(url: string, body: unknown, timeoutMs: number): Promise<{ status: number; json: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let json: any = {};
    try { json = await res.json(); } catch { /* non-JSON body */ }
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendTelegram(msg: TelegramMessage): Promise<TelegramSendResult> {
  if (!isTelegramConfigured()) {
    return { ok: false, error: 'Telegram bot belum dikonfigurasi (TELEGRAM_BOT_TOKEN)' };
  }
  const token = process.env.TELEGRAM_BOT_TOKEN as string;
  const timeoutMs = Number(process.env.GABAH_TELEGRAM_TIMEOUT_MS || 10000);
  const url = `${apiBase()}/bot${token}/sendMessage`;
  const payload: Record<string, unknown> = {
    chat_id: msg.chatId,
    text: msg.text,
    disable_notification: Boolean(msg.disableNotification),
  };
  if (msg.parseMode) payload.parse_mode = msg.parseMode;

  const maxAttempts = 3;
  let lastError = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { status, json } = await postJson(url, payload, timeoutMs);
      if (status === 200 && json?.ok === true) {
        return { ok: true, messageId: json?.result?.message_id };
      }
      // 429 = rate limited (transient, honor retry_after), 5xx = transient.
      const retryAfter = Number(json?.parameters?.retry_after || 0);
      const transient = status === 429 || status >= 500;
      lastError = `Telegram API HTTP ${status}${json?.description ? `: ${json.description}` : ''}`;
      if (!transient || attempt === maxAttempts) break;
      await new Promise(r => setTimeout(r, retryAfter > 0 ? Math.min(retryAfter, 5) * 1000 : 750 * attempt));
    } catch (err: any) {
      lastError = err?.name === 'AbortError' ? `Telegram timeout setelah ${timeoutMs}ms` : (err.message || String(err));
      if (attempt === maxAttempts) break;
      await new Promise(r => setTimeout(r, 750 * attempt));
    }
  }
  return { ok: false, error: lastError };
}

/** Diagnostic helper: validate the bot token once (used by tests / health check). */
export async function telegramGetMe(): Promise<{ ok: boolean; botUsername?: string; error?: string }> {
  if (!isTelegramConfigured()) return { ok: false, error: 'TELEGRAM_BOT_TOKEN tidak diset' };
  try {
    const { status, json } = await postJson(`${apiBase()}/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`, {}, 8000);
    if (status === 200 && json?.ok) return { ok: true, botUsername: json.result?.username };
    return { ok: false, error: `HTTP ${status}` };
  } catch (err: any) {
    return { ok: false, error: err.message || String(err) };
  }
}

// Keep crypto import used intentionally for future webhook secret verification.
export function newWebhookSecret(): string {
  return crypto.randomBytes(24).toString('hex');
}
