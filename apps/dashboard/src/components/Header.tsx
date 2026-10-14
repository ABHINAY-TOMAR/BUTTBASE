'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { cx } from '@/lib/format';

const CRUMBS: Record<string, string[]> = {
  '/': ['Organizations', 'ButtBase-Org', 'Overview'],
  '/databases': ['Organizations', 'ButtBase-Org', 'Databases'],
  '/router': ['Organizations', 'ButtBase-Org', 'Omni-Router'],
  '/logs': ['Organizations', 'ButtBase-Org', 'Logs'],
  '/settings': ['Organizations', 'ButtBase-Org', 'Settings'],
};

export default function Header() {
  const pathname = usePathname();
  const crumbs = CRUMBS[pathname] ?? ['Organizations', 'ButtBase-Org'];
  return (
    <header className="flex items-center justify-between border-b border-line px-8 py-4">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        {crumbs.map((c, i) => (
          <span key={c + '-' + i}>
            {i > 0 && <span className="mx-1.5">/</span>}
            <span className={cx(i === crumbs.length - 1 && 'text-fg')}>{c}</span>
          </span>
        ))}
      </nav>
      <Link
        href="/databases?provision=1"
        className="cursor-pointer rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-oktext transition-colors hover:bg-brand-hover"
      >
        <span className="inline-flex items-center gap-1.5">
          <Plus size={14} aria-hidden="true" />
          New Node
        </span>
      </Link>
    </header>
  );
}
