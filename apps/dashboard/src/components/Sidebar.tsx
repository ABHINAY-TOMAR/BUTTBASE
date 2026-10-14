'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Database, LayoutDashboard, Settings, Terminal, Waypoints } from 'lucide-react';
import { cx } from '@/lib/format';

const NAV = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/databases', label: 'Databases', icon: Database },
  { href: '/router', label: 'Omni-Router', icon: Waypoints },
  { href: '/logs', label: 'Logs', icon: Terminal },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-tint text-brand" aria-hidden="true">
          <Database size={18} />
        </span>
        <div>
          <div className="text-sm font-semibold leading-tight">ButtBase</div>
          <div className="text-[11px] text-muted">supabase federation</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3" aria-label="Primary">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                active ? 'bg-brand-tint text-brand' : 'text-muted hover:bg-panel2 hover:text-fg'
              )}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-line px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-panel2 text-xs font-medium text-fg" aria-hidden="true">
            AT
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-medium">ABHINAY-TOMAR</div>
            <div className="text-[11px] text-muted">free plan · $0.00</div>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted">
          <kbd className="rounded border border-line px-1.5 py-0.5 font-mono">⌘K</kbd> command palette
        </p>
      </div>
    </aside>
  );
}
