import { ArrowRight } from 'lucide-react';
import type { RegistryNode } from '@buttbase/shared-types';

/** Omni-Router rule visual (idea.md §14 view 3) — v1 renders the live routing rules read-only. */
export default function RuleBuilder({ nodes }: { nodes: RegistryNode[] }) {
  const byCategory = new Map<string, string[]>();
  for (const n of nodes) {
    const list = byCategory.get(n.data_type) ?? [];
    list.push(n.node_prefix);
    byCategory.set(n.data_type, list);
  }
  const rules = [...byCategory.entries()];

  if (rules.length === 0) {
    return <p className="text-sm text-muted">No nodes yet — provision one to create routing rules.</p>;
  }

  return (
    <div className="space-y-3">
      {rules.map(([category, prefixes]) => (
        <div key={category} className="rounded-md border border-line bg-panel p-4">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="text-muted">IF</span>
            <span>request.data_type =</span>
            <span className="text-brand">{category}</span>
            <ArrowRight size={13} className="text-muted" aria-hidden="true" />
            <span className="text-muted">ROUTE TO</span>
            {prefixes.map((p, i) => (
              <span key={p} className="text-fg">
                {i > 0 && <span className="text-muted"> | </span>}
                {p}
              </span>
            ))}
          </div>
          <p className="mt-2 font-sans text-[11px] text-muted">
            Writes go to the node with the most free space; reads are Smart-ID prefixed (idea.md §6, §5).
          </p>
        </div>
      ))}
    </div>
  );
}
