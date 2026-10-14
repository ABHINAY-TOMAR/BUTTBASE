import { cx, formatMb } from '@/lib/format';

/** Color never conveys meaning alone — always color + text (docs/DESIGN.md a11y). */
export function StatusDot({ status }: { status: 'active' | 'paused' | 'full' | 'offline' }) {
  const map = {
    active: { dot: 'bg-brand', label: 'Active', pulse: true },
    paused: { dot: 'bg-warn', label: 'Paused', pulse: false },
    full: { dot: 'bg-danger', label: 'Full', pulse: false },
    offline: { dot: 'bg-muted', label: 'Offline', pulse: false },
  }[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={cx('h-2 w-2 rounded-full', map.dot, map.pulse && 'animate-pulseDot')} aria-hidden="true" />
      <span className="text-muted">{map.label}</span>
    </span>
  );
}

export function ProgressBar({ usedMb, limitMb }: { usedMb: number; limitMb: number }) {
  const pct = limitMb > 0 ? Math.min(100, (usedMb / limitMb) * 100) : 0;
  const tone = pct >= 90 ? 'bg-danger' : pct >= 75 ? 'bg-warn' : 'bg-brand';
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="whitespace-nowrap">
          {formatMb(usedMb)} <span className="text-muted">/ {formatMb(limitMb)}</span>
        </span>
        <span className="font-mono text-muted">{Math.round(pct)}%</span>
      </div>
      <div
        className="mt-1 h-1.5 w-40 rounded-full bg-panel2"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Storage used"
      >
        <div className={cx('h-1.5 rounded-full transition-all duration-200', tone)} style={{ width: pct + '%' }} />
      </div>
    </div>
  );
}

export function Badge({ children, tone = 'brand' }: { children: React.ReactNode; tone?: 'brand' | 'warn' }) {
  return (
    <span
      className={cx(
        'rounded px-1.5 py-0.5 font-mono text-[11px]',
        tone === 'brand' ? 'bg-brand-tint text-brand' : 'bg-warn/15 text-warn'
      )}
    >
      {children}
    </span>
  );
}

export function TrendArrow({ delta }: { delta: number }) {
  const up = delta >= 0;
  return (
    <span className={cx('text-xs font-medium', delta >= 0 ? 'text-brand' : 'text-danger')} title={up ? 'up' : 'down'}>
      {up ? '▲' : '▼'} {up ? '+' : ''}
      {delta.toFixed(1)}%
      <span className="sr-only">{up ? 'up' : 'down'}</span>
    </span>
  );
}
