import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';

/**
 * GABAH Email Provider (CR-05 / STEP 5)
 *
 * Real outbound delivery over SMTP. Credentials and transport settings come
 * exclusively from environment variables — never hardcoded:
 *
 *   GABAH_SMTP_HOST      SMTP server hostname (required to enable email)
 *   GABAH_SMTP_PORT      SMTP port (587 STARTTLS default, 465 implicit TLS)
 *   GABAH_SMTP_SECURE    "true" for implicit TLS on connect (port 465 style)
 *   GABAH_SMTP_USER      SMTP auth username (optional; PLAIN/LOGIN auth)
 *   GABAH_SMTP_PASSWORD  SMTP auth password (optional)
 *   GABAH_SMTP_FROM      Sender address, e.g. "GABAH <no-reply@foodstation.co.id>"
 *   GABAH_SMTP_TLS_REJECT_UNAUTHORIZED  "false" only for self-signed lab relays (default: reject invalid certs)
 *
 * Design rules (per requirement):
 *  - No fake success: a send either really completes the SMTP dialogue or it
 *    returns { ok: false, error } with the reason.
 *  - When the provider is not configured, `isConfigured()` is false and the
 *    notification service records status=skipped with a clear reason.
 *  - Bounded timeout and a small bounded retry for transient failures.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

const SMTP_TIMEOUT_MS = 15_000;
const RETRYABLE_CODES = new Set(['421', '450', '451', '452']);

export function isEmailConfigured(): boolean {
  return Boolean(process.env.GABAH_SMTP_HOST && process.env.GABAH_SMTP_FROM);
}

function smtpEscape(text: string): string {
  // RFC 5321 dot-stuffing is applied at DATA frame level; this escapes lead dots in lines.
  return text.replace(/(^|\r\n)\./g, '$1..');
}

function buildMime(msg: EmailMessage, from: string): string {
  const boundary = `=_gabah_${crypto.randomBytes(8).toString('hex')}`;
  const headers = [
    `From: ${from}`,
    `To: ${msg.to}`,
    `Subject: ${msg.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: text/plain; charset=UTF-8; boundary="${boundary}"`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${crypto.randomBytes(6).toString('hex')}@gabah.local>`,
  ];
  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    msg.text,
    `--${boundary}--`,
  ].join('\r\n');
  return `${headers.join('\r\n')}\r\n\r\n${body}`;
}

/** Single SMTP conversation. Returns the server greeting/completion or throws with reason. */
function smtpConversation(
  host: string,
  port: number,
  secure: boolean,
  from: string,
  to: string,
  mime: string,
  credentials: { user?: string; pass?: string } | null,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let stage = 0; // 0 greeting, 1 ehlo, 2 starttls/ehlo2, 3 auth, 4 mail, 5 rcpt, 6 data, 7 dot
    let lastCode = '000';
    const steps: string[] = ['greeting', 'ehlo', 'ready', 'auth', 'mail-from', 'rcpt-to', 'data', 'dot'];
    let socket: net.Socket | tls.TLSSocket;

    const fail = (err: Error) => {
      socket?.destroy();
      reject(err);
    };

    const timeout = setTimeout(() => fail(new Error(`SMTP timeout setelah stage: ${steps[stage] || 'unknown'}`)), SMTP_TIMEOUT_MS);

    const finish = (messageId: string) => {
      clearTimeout(timeout);
      socket.end();
      resolve(messageId);
    };

    const onLine = (line: string) => {
      buffer += line;
    };

    const handleData = () => {
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        const codeMatch = /^(\d{3})([ -])?/.exec(line);
        if (!codeMatch) continue;
        lastCode = codeMatch[1];
        const continuation = codeMatch[2] === '-';
        if (continuation) continue; // multi-line reply: wait for final line

        // Final reply for current stage
        const code = lastCode;
        buffer = '';
        if (code[0] === '5' || (code[0] === '4' && stage !== 0)) {
          fail(new Error(`SMTP error ${code} pada stage ${steps[stage] || 'unknown'}`));
          return;
        }
        advance(code);
        return;
      }
    };

    const advance = (code: string) => {
      switch (stage) {
        case 0: // greeting 220
          if (code !== '220') return fail(new Error(`SMTP greeting tidak sesuai (${code})`));
          stage = 1;
          socket.write(`EHLO gabah.local\r\n`);
          return;
        case 1: { // ehlo 250
          if (code !== '250') return fail(new Error(`EHLO ditolak (${code})`));
          if (!secure && supportsStarttls) {
            stage = 2;
            socket.write('STARTTLS\r\n');
            return;
          }
          beginTransaction();
          return;
        }
        case 2: // STARTTLS 220 -> wrap and EHLO again
          if (code !== '220') return fail(new Error(`STARTTLS ditolak (${code})`));
          try {
            const raw = socket as net.Socket;
            socket = new tls.TLSSocket(raw, {
              rejectUnauthorized: process.env.GABAH_SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
            });
            wire(socket);
            stage = 1; // EHLO again over TLS (then proceed without STARTTLS)
            supportsStarttls = false;
            socket.write('EHLO gabah.local\r\n');
          } catch (err: any) {
            fail(new Error(`TLS upgrade gagal: ${err.message}`));
          }
          return;
        case 3: { // auth accepted 235 / or mail-from path after ehlo2
          if (credentials && code !== '235') return fail(new Error(`SMTP auth ditolak (${code})`));
          stage = 4;
          socket.write(`MAIL FROM:<${from.replace(/^[^<]*</, '').replace(/>.*$/, '')}>\r\n`);
          return;
        }
        case 4:
          if (code !== '250') return fail(new Error(`MAIL FROM ditolak (${code})`));
          stage = 5;
          socket.write(`RCPT TO:<${to}>\r\n`);
          return;
        case 5:
          if (code !== '250' && code !== '251') return fail(new Error(`RCPT TO ditolak (${code})`));
          stage = 6;
          socket.write('DATA\r\n');
          return;
        case 6:
          if (code !== '354') return fail(new Error(`DATA tidak diterima (${code})`));
          stage = 7;
          socket.write(`${smtpEscape(mime)}\r\n.\r\n`);
          return;
        case 7:
          if (code !== '250') return fail(new Error(`Pengiriman ditolak server (${code})`));
          finish(`<gabah-${Date.now()}-${lastCode}@${host}>`);
          return;
      }
    };

    let supportsStarttls = true;
    const beginTransaction = () => {
      if (credentials) {
        stage = 3;
        socket.write('AUTH PLAIN ' + Buffer.from(`\u0000${credentials.user}\u0000${credentials.pass}`).toString('base64') + '\r\n');
      } else {
        stage = 3;
        // No credentials: jump straight to MAIL FROM by simulating advance path
        stage = 4;
        socket.write(`MAIL FROM:<${from.replace(/^[^<]*</, '').replace(/>.*$/, '')}>\r\n`);
      }
    };

    const wire = (s: net.Socket | tls.TLSSocket) => {
      s.on('data', (chunk: Buffer) => {
        onLine(chunk.toString('utf8'));
        handleData();
      });
      s.on('error', fail);
    };

    try {
      socket = secure
        ? tls.connect({ host, port, servername: host, rejectUnauthorized: process.env.GABAH_SMTP_TLS_REJECT_UNAUTHORIZED !== 'false' })
        : net.connect({ host, port });
      wire(socket);
      socket.on('connect', () => { /* wait for 220 greeting */ });
      socket.on('secureConnect', () => { /* implicit TLS: wait for 220 */ });
    } catch (err: any) {
      clearTimeout(timeout);
      reject(err);
    }
  });
}

export async function sendEmail(msg: EmailMessage): Promise<EmailSendResult> {
  if (!isEmailConfigured()) {
    return { ok: false, error: 'Email provider belum dikonfigurasi (GABAH_SMTP_HOST / GABAH_SMTP_FROM)' };
  }
  const host = process.env.GABAH_SMTP_HOST as string;
  const port = Number(process.env.GABAH_SMTP_PORT || (process.env.GABAH_SMTP_SECURE === 'true' ? 465 : 587));
  const secure = process.env.GABAH_SMTP_SECURE === 'true';
  const from = process.env.GABAH_SMTP_FROM as string;
  const credentials = process.env.GABAH_SMTP_USER
    ? { user: process.env.GABAH_SMTP_USER, pass: process.env.GABAH_SMTP_PASSWORD || '' }
    : null;

  const mime = buildMime(msg, from);
  const maxAttempts = 2;
  let lastError = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const messageId = await smtpConversation(host, port, secure, from, msg.to, mime, credentials);
      return { ok: true, messageId };
    } catch (err: any) {
      lastError = err.message || String(err);
      const transient = RETRYABLE_CODES.has((lastCodeOf(lastError)));
      if (!transient || attempt === maxAttempts) break;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return { ok: false, error: lastError };
}

function lastCodeOf(message: string): string {
  const m = /SMTP error (\d{3})/.exec(message);
  return m ? m[1] : '';
}
