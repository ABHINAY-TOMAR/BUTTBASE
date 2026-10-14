/**
 * Log feed. v1 serves dev fixtures — the live edge-log drain (Master writes from the
 * gateway's structured logs) is Phase 5 (idea.md §19). Kept as a route so the client
 * contract does not change when the live source lands.
 */
import { NextResponse } from 'next/server';
import { mockLogs } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const live = process.env.BB_DEV_MODE === '0';
  return NextResponse.json({ logs: mockLogs(40), mode: live ? 'live' : 'dev', note: live ? 'live drain ships in Phase 5' : undefined });
}
