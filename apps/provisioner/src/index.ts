/**
 * B.U.T.T. Base provisioner — CLI entry.
 *   tsx src/index.ts worker          queue polling + keep-alive loop (default)
 *   tsx src/index.ts queue-once      process one provisioning job
 *   tsx src/index.ts keepalive-once  one keep-alive sweep
 * Live-only: needs MASTER_SUPABASE_URL, MASTER_SERVICE_ROLE_KEY,
 * SUPABASE_MANAGEMENT_PAT, REGISTRY_ENCRYPTION_KEY.
 */
import * as env from './env';
import { SupabaseManagement } from './management';
import { MasterDb } from './master';
import { runKeepAlive } from './keepalive';
import { runQueueOnce } from './queue';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function liveEnvOrExit(): { mgmt: SupabaseManagement; master: MasterDb } | null {
  try {
    const mgmt = new SupabaseManagement(env.pat());
    const master = new MasterDb(env.masterUrl(), env.masterKey());
    return { mgmt, master };
  } catch (e) {
    console.error(String(e instanceof Error ? e.message : e));
    console.error('The provisioner has no dev mode — configure live credentials in .env (see .env.example).');
    return null;
  }
}

async function worker(): Promise<void> {
  const ctx = liveEnvOrExit();
  if (!ctx) process.exit(1);
  console.log('[worker] queue polling + keep-alive loop started (throttle: ' + env.maxPerDay() + '/day, keep-alive every ' + Math.round(env.keepaliveEveryMs() / 3_600_000) + 'h)');

  let lastKeepalive = 0;
  for (;;) {
    try {
      const msg = await runQueueOnce(ctx.mgmt, ctx.master);
      if (msg !== 'queue empty' && !msg.startsWith('throttled')) console.log('[worker] ' + msg);
    } catch (e) {
      console.error('[worker] loop error: ' + (e instanceof Error ? e.message : String(e)));
    }

    if (Date.now() - lastKeepalive > env.keepaliveEveryMs()) {
      lastKeepalive = Date.now();
      try {
        console.log('[worker] ' + (await runKeepAlive(ctx.mgmt, ctx.master)));
      } catch (e) {
        console.error('[worker] keepalive error: ' + (e instanceof Error ? e.message : String(e)));
      }
    }
    await sleep(env.pollIntervalMs());
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? 'worker';
  const ctx = liveEnvOrExit();
  if (!ctx) process.exit(1);

  if (mode === 'queue-once') {
    console.log(await runQueueOnce(ctx.mgmt, ctx.master));
  } else if (mode === 'keepalive-once') {
    console.log(await runKeepAlive(ctx.mgmt, ctx.master));
  } else if (mode === 'worker') {
    await worker();
  } else {
    console.error('unknown mode: ' + mode + ' (use worker | queue-once | keepalive-once)');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[fatal] ' + (e instanceof Error ? e.stack : String(e)));
  process.exit(1);
});
