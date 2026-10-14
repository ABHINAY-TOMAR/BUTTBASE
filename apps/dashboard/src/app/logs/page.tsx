import TerminalLog from '@/components/TerminalLog';
import { mockLogs } from '@/lib/mock-data';

/** Dynamic so initial log lines render fresh per request (not frozen at build time). */
export const dynamic = 'force-dynamic';

export default function LogsPage() {
  return <TerminalLog initialLines={mockLogs(18)} />;
}
