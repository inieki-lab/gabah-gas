import { ContractDomainService } from '../contracts';
import { getDbPool } from '../persistence';

/**
 * GABAH Contract Reminder Scheduler (CR-05 / STEP 4)
 *
 * Production-safe internal scheduler:
 *  - Interval-based (default hourly), configurable via GABAH_REMINDER_INTERVAL_MS;
 *     disable entirely with GABAH_REMINDER_SCHEDULER_DISABLED=true.
 *  - Timezone-aware: the reminder "due day" bucket is computed with
 *    GABAH_REMINDER_TIMEZONE (default Asia/Jakarta) inside the reminder engine,
 *    so the schedule itself only needs a stable cadence.
 *  - Multi-instance safe: an advisory leader lock (pg_try_advisory_lock when
 *    PostgreSQL is configured) ensures only ONE instance runs the sweep per
 *    tick. Without PostgreSQL (dev file-store mode) each instance still runs,
 *    but the idempotency keys make duplicate deliveries impossible.
 *  - Never crashes the app: every tick is wrapped in try/catch with structured
 *    logging; unhandled rejections inside a tick cannot escape.
 *  - Testable: `runOnce()` can be triggered manually (admin endpoint) without
 *    waiting for a real reminder date.
 */

const LEADER_LOCK_KEY = 842201; // arbitrary constant for GABAH reminder leader election

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
let lastRun: { at: string; ok: boolean; summary?: string } | null = null;
let leaderLockClient: any = null; // pg client holding the advisory lock

export interface SchedulerStatus {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  timezone: string;
  lastRun: { at: string; ok: boolean; summary?: string } | null;
}

export function getSchedulerStatus(): SchedulerStatus {
  return {
    enabled: timer !== null,
    running,
    intervalMs: intervalMs(),
    timezone: process.env.GABAH_REMINDER_TIMEZONE || 'Asia/Jakarta',
    lastRun,
  };
}

function intervalMs(): number {
  const raw = Number(process.env.GABAH_REMINDER_INTERVAL_MS || 3600000);
  return Number.isFinite(raw) && raw >= 60000 ? raw : 3600000; // minimum 1 minute
}

async function acquireLeaderLock(): Promise<boolean> {
  let client: any = null;
  let acquisitionError: any = null;
  try {
    const pool = getDbPool();
    if (!pool) return true; // dev/file-store mode: proceed (idempotency protects)
    client = await pool.connect();
    const res = await client.query('SELECT pg_try_advisory_lock($1) AS acquired', [LEADER_LOCK_KEY]);
    if (res.rows[0]?.acquired) {
      leaderLockClient = client; // keep the client so the session lock persists
      client = null; // ownership transferred to releaseLeaderLock()
      return true;
    }
    return false;
  } catch (error) {
    acquisitionError = error;
    // In PostgreSQL mode, inability to verify the leader lock must fail
    // closed. Running anyway could let multiple instances send duplicate
    // external notifications before the idempotency row is committed.
    console.warn('[GABAH Reminder] advisory leader lock unavailable; skipping sweep:', error instanceof Error ? error.message : String(error));
    return false;
  } finally {
    // A failed lock query must not leak or recycle a broken pool client.
    if (client) client.release(acquisitionError || undefined);
  }
}

async function releaseLeaderLock(): Promise<void> {
  const client = leaderLockClient;
  leaderLockClient = null;
  if (!client) return;

  // Advisory locks are session-scoped. Await unlock before returning the
  // connection to the pool; releasing it while the query is in flight can
  // expose a still-locked session to another request/instance.
  let unlockError: any = null;
  try {
    await client.query('SELECT pg_advisory_unlock($1)', [LEADER_LOCK_KEY]);
  } catch (error) {
    unlockError = error;
  }
  try {
    client.release(unlockError || undefined);
  } catch {
    // Connection may already have been removed from the pool.
  }
}

/** Execute one reminder sweep pass with full error containment. */
export async function runOnce(trigger: 'scheduler' | 'manual' = 'scheduler'): Promise<{ ok: boolean; summary: string }> {
  if (running) return { ok: false, summary: 'sweep already running' };
  running = true;
  try {
    const result = await ContractDomainService.runReminderSweep();
    const summary = `evaluated=${result.evaluated} queued=${result.queued} sent=${result.sent} failed=${result.failed} skipped=${result.skipped}`;
    lastRun = { at: new Date().toISOString(), ok: true, summary };
    console.log(`[GABAH Reminder] sweep (${trigger}): ${summary}`);
    return { ok: true, summary };
  } catch (err: any) {
    lastRun = { at: new Date().toISOString(), ok: false, summary: err.message || String(err) };
    console.error('[GABAH Reminder] sweep error:', err.message || err);
    return { ok: false, summary: err.message || String(err) };
  } finally {
    running = false;
  }
}

/** Start the interval scheduler (no-op when disabled or already started). */
export function startReminderScheduler(): void {
  if (process.env.GABAH_REMINDER_SCHEDULER_DISABLED === 'true') {
    console.log('[GABAH Reminder] scheduler disabled via GABAH_REMINDER_SCHEDULER_DISABLED');
    return;
  }
  if (timer) return;

  const interval = intervalMs();
  timer = setInterval(() => {
    void (async () => {
      if (!(await acquireLeaderLock())) return; // another instance is the leader
      try {
        await runOnce('scheduler');
      } finally {
        await releaseLeaderLock();
      }
    })();
  }, interval);

  // Do not keep the event loop alive just for the scheduler.
  timer.unref?.();
  console.log(`[GABAH Reminder] scheduler started (every ${Math.round(interval / 60000)} min, tz ${process.env.GABAH_REMINDER_TIMEZONE || 'Asia/Jakarta'})`);

  // Optional catch-up run shortly after boot (configurable, default on).
  if (process.env.GABAH_REMINDER_RUN_ON_BOOT !== 'false') {
    setTimeout(() => {
      void (async () => {
        if (!(await acquireLeaderLock())) return;
        try {
          await runOnce('scheduler');
        } finally {
          await releaseLeaderLock();
        }
      })();
    }, 15000).unref?.();
  }
}

export async function stopReminderScheduler(): Promise<void> {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  await releaseLeaderLock();
}
