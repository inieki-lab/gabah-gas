/**
 * Provider fail-path diagnostic (temporary, removed after evidence capture).
 * Run: npx tsx scripts/provider-failpath-check.mts
 */
import { sendEmail, isEmailConfigured } from '../server/notifications/emailProvider';
import { sendTelegram } from '../server/notifications/telegramProvider';

async function main() {
  // Unreachable SMTP endpoint (nothing listens here) → must fail honestly.
  process.env.GABAH_SMTP_HOST = '127.0.0.1';
  process.env.GABAH_SMTP_PORT = '59999';
  process.env.GABAH_SMTP_FROM = 'test@gabah.local';
  console.log('email configured (host+from):', isEmailConfigured());
  const t0 = Date.now();
  const email = await sendEmail({ to: 'pic@gabah.local', subject: 'verify failed-path', text: 'x' });
  console.log('email result:', JSON.stringify(email), `(${Date.now() - t0}ms)`);

  // Invalid bot token → Telegram API returns 401 → must fail honestly.
  process.env.TELEGRAM_BOT_TOKEN = '123:fake-token-for-path-check';
  const tg = await sendTelegram({ chatId: '999999', text: 'verify failed-path' });
  console.log('telegram result:', JSON.stringify(tg));
}

main().catch(err => { console.error('diagnostic crashed:', err); process.exit(1); });
