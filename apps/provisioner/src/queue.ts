/**
 * Throttled provisioning queue (idea.md §8): hard cap of PROVISION_MAX_PER_DAY
 * projects/day, staggered — burst-creating orgs/projects triggers Supabase anti-abuse.
 */
import { maxPerDay } from './env';
import type { SupabaseManagement } from './management';
import type { MasterDb } from './master';
import { provisionNode } from './provision';

export async function runQueueOnce(mgmt: SupabaseManagement, master: MasterDb): Promise<string> {
  const doneToday = await master.completedTodayCount();
  if (doneToday >= maxPerDay()) {
    return 'throttled: ' + doneToday + '/' + maxPerDay() + ' provisions today (anti-ban pacing — idea.md SS8)';
  }

  const job = await master.nextPendingJob();
  if (!job) return 'queue empty';

  await master.markJob(job.id, { status: 'processing' });
  console.log('[queue] processing job ' + job.id + ' (' + job.requested_data_type + ')');

  try {
    const prefix = await provisionNode(job, mgmt, master);
    await master.markJob(job.id, {
      status: 'completed',
      result_node_prefix: prefix,
      error_message: null,
      processed_at: new Date().toISOString(),
    });
    return 'provisioned ' + prefix;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[queue] job ' + job.id + ' failed: ' + message);
    await master.markJob(job.id, {
      status: 'failed',
      error_message: message.slice(0, 2000),
      processed_at: new Date().toISOString(),
    });
    return 'failed: ' + message.slice(0, 200);
  }
}
