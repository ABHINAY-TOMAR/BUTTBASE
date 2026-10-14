'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Trash2 } from 'lucide-react';
import { cx, statusTone } from '@/lib/format';
import { randomLogLine, type LogLine } from '@/lib/mock-data';

const MAX_LINES = 200;

/** Terminal-style live traffic (idea.md §14 view 4) — OmniRoute-style proxy log stream. */
export default function TerminalLog({ initialLines }: { initialLines: LogLine[] }) {
  const [lines, setLines] = useState<LogLine[]>(initialLines);
  const [paused, setPaused] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setLines((prev) => {
        const next = [...prev, randomLogLine()];
        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
      });
    }, 1400);
    return () => clearInterval(id);
  }, [paused]);

  useEffect(() => {
    if (!paused && boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [lines, paused]);

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Logs</h1>
          <p className="mt-0.5 text-xs text-muted">Live edge-gateway traffic — color-coded status, prefix-routed requests.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cx('inline-flex items-center gap-1.5 text-[11px]', paused ? 'text-warn' : 'text-brand')}>
            <span className={cx('h-1.5 w-1.5 rounded-full', paused ? 'bg-warn' : 'animate-pulseDot bg-brand')} aria-hidden="true" />
            {paused ? 'paused' : 'streaming'}
          </span>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:bg-panel2 hover:text-fg"
          >
            {paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
            {paused ? 'Resume stream' : 'Pause stream'}
          </button>
          <button
            type="button"
            onClick={() => setLines([])}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:bg-panel2 hover:text-fg"
            aria-label="Clear log"
          >
            <Trash2 size={13} aria-hidden="true" />
            Clear
          </button>
        </div>
      </div>

      <div
        ref={boxRef}
        role="log"
        aria-live={paused ? 'off' : 'polite'}
        aria-label="Gateway request log"
        className="mt-4 h-[calc(100vh-260px)] min-h-80 overflow-y-auto rounded-md border border-line bg-[#0a0a0a] p-4 font-mono text-xs leading-relaxed"
      >
        {lines.length === 0 ? (
          <p className="text-muted">Waiting for traffic…</p>
        ) : (
          lines.map((l, i) => (
            <div key={l.ts + '-' + i} className="whitespace-nowrap">
              <span className="text-muted">{l.ts.slice(11, 19)} </span>
              <span className="text-fg">[{l.method}]</span>{' '}
              <span className="text-fg/85">{l.path}</span>{' '}
              <span className="text-muted">→ {l.node} </span>
              <span className={statusTone(l.status)}>[{l.status}]</span>{' '}
              <span className="text-muted">({l.ms}ms)</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
