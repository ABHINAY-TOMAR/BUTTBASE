import RuleBuilder from '@/components/RuleBuilder';
import SecretsPanel from '@/components/SecretsPanel';
import { mockNodes } from '@/lib/mock-data';

export default function RouterPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Omni-Router</h1>
        <p className="mt-0.5 text-xs text-muted">
          How requests split across the federation — by data category and free capacity.
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Routing rules</h2>
        <RuleBuilder nodes={mockNodes()} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Universal Secrets</h2>
        <SecretsPanel />
      </div>
    </section>
  );
}
