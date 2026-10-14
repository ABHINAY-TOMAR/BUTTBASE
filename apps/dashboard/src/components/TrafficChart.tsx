/** Hand-rolled SVG area chart — no chart dependency, deterministic server render. */
const W = 720;
const H = 180;
const PAD = 8;

export default function TrafficChart({ data, label }: { data: number[]; label: string }) {
  const max = Math.max(...data, 1);
  const step = data.length > 1 ? (W - PAD * 2) / (data.length - 1) : 0;
  const pts = data.map((v, i) => {
    const x = PAD + i * step;
    const y = H - PAD - (v / max) * (H - PAD * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
  const area = line + ' L' + (W - PAD) + ' ' + (H - PAD) + ' L' + PAD + ' ' + (H - PAD) + ' Z';
  const last = pts[pts.length - 1];

  return (
    <svg
      viewBox={'0 0 ' + W + ' ' + H}
      className="h-44 w-full"
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={PAD} x2={W - PAD} y1={H * f} y2={H * f} stroke="#2e2e2e" strokeWidth="1" />
      ))}
      <path d={area} fill="rgba(62,207,142,0.12)" />
      <path d={line} fill="none" stroke="#3ECF8E" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="#3ECF8E" />
    </svg>
  );
}
