'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { cx } from '@/lib/format';

interface Command {
  id: string;
  title: string;
  hint: string;
  href: string;
}

const COMMANDS: Command[] = [
  { id: 'overview', title: 'Go to Overview', hint: 'page', href: '/' },
  { id: 'databases', title: 'Go to Databases', hint: 'page', href: '/databases' },
  { id: 'router', title: 'Go to Omni-Router', hint: 'page', href: '/router' },
  { id: 'logs', title: 'Go to Logs', hint: 'page', href: '/logs' },
  { id: 'settings', title: 'Go to Settings', hint: 'page', href: '/settings' },
  { id: 'provision', title: 'Provision a new node…', hint: 'action', href: '/databases?provision=1' },
  { id: 'provision-image', title: 'Provision an image storage node', hint: 'action', href: '/databases?provision=1' },
  { id: 'secrets', title: 'Reveal Universal Secrets', hint: 'action', href: '/router' },
];

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? COMMANDS.filter((c) => c.title.toLowerCase().includes(q)) : COMMANDS;
  }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (!open) return;
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && filtered[index]) {
        e.preventDefault();
        run(filtered[index]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  function run(command: Command) {
    setOpen(false);
    router.push(command.href);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-24" onClick={() => setOpen(false)} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-lg overflow-hidden rounded-md border border-line bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search size={15} className="shrink-0 text-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            placeholder="Search nodes or type a command…"
            aria-label="Search commands"
            className="w-full bg-transparent py-3.5 text-sm text-fg placeholder:text-muted/70 focus:outline-none"
          />
        </div>
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted">No matching command.</p>
        ) : (
          <ul role="listbox" aria-label="Commands" className="max-h-72 overflow-y-auto py-1">
            {filtered.map((c, i) => (
              <li key={c.id} role="option" aria-selected={i === index}>
                <button
                  type="button"
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => run(c)}
                  className={cx(
                    'flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left text-sm transition-colors',
                    i === index ? 'bg-brand-tint text-brand' : 'text-fg hover:bg-panel2'
                  )}
                >
                  <span>{c.title}</span>
                  <span className="text-[11px] text-muted">{c.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-line px-4 py-2 text-[11px] text-muted">
          ↑↓ navigate · ↵ run · esc close
        </div>
      </div>
    </div>
  );
}
