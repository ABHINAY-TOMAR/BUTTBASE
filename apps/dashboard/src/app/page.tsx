import MetricCard from '@/components/MetricCard';
import TrafficChart from '@/components/TrafficChart';
import CodeSnippet from '@/components/CodeSnippet';
import { mockMetrics, mockTrafficSeries } from '@/lib/mock-data';

const QUICK_START = [
  '// Any app, any framework — one URL, one key:',
  "await fetch('https://api.buttbase.io/v1/data?type=images&table=profile_pics', {",
  "  method: 'POST',",
  "  headers: { Authorization: 'Bearer ' + MASTER_JWT, 'Content-Type': 'application/json' },",
  "  body: JSON.stringify({ owner: 'user_77', filename: 'me.png' }),",
  '});',
  '// → { "id": "img01_9f8e3c2a-…", "node": "img01" }',
].join('\n');

export default function OverviewPage() {
  const m = mockMetrics();
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Overview</h1>
        <p className="mt-0.5 text-xs text-muted">
          Routing health for the federation — OmniRoute-style analytics (idea.md §14).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Total requests" value={m.totalRequests} unit="24h" trend={m.trends.requests} hint="edge gateway, all nodes" />
        <MetricCard label="Avg latency" value={m.avgLatencyMs} unit="ms" trend={m.trends.latency} hint="prefix parse + cache hit" />
        <MetricCard label="Active nodes" value={m.activeNodes} trend={m.trends.nodes} hint="free-tier projects federated" />
      </div>

      <div className="rounded-md border border-line bg-panel p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Requests</h2>
          <span className="text-[11px] text-muted">last 24 hours</span>
        </div>
        <div className="mt-4">
          <TrafficChart data={mockTrafficSeries()} label="Requests over the last 24 hours" />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Quick integration</h2>
        <CodeSnippet code={QUICK_START} label="universal api" />
      </div>
    </section>
  );
}
