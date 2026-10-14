import { TrendArrow } from '@/components/primitives';
import { thousands } from '@/lib/format';

export default function MetricCard({
  label,
  value,
  unit,
  trend,
  hint,
}: {
  label: string;
  value: number | string;
  unit?: string;
  trend?: number;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-line bg-panel p-5 transition-colors hover:border-line/80">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight">
          {typeof value === 'number' ? thousands(value) : value}
        </span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
        {typeof trend === 'number' && <TrendArrow delta={trend} />}
      </div>
      {hint && <div className="mt-1 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}
