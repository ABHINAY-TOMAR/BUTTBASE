'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface Field {
  id: string;
  label: string;
  placeholder: string;
  secret: boolean;
  hint: string;
}

const FIELDS: Field[] = [
  { id: 'url', label: 'Master Supabase URL', placeholder: 'https://master-project.supabase.co', secret: false, hint: 'Control plane: auth + projects_registry + queue.' },
  { id: 'service-key', label: 'Master service key', placeholder: 'eyJ… (service_role)', secret: true, hint: 'Server-side only. Never expose to the client.' },
  { id: 'pat', label: 'Supabase Management PAT', placeholder: 'sbp_…', secret: true, hint: 'Used by the provisioner worker to create orgs/projects.' },
  { id: 'encryption', label: 'Registry encryption key', placeholder: '32-byte base64', secret: true, hint: 'AES-256-GCM key for node service keys at rest.' },
];

function FieldInput({ field }: { field: Field }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div>
      <label htmlFor={field.id} className="block text-xs text-muted">
        {field.label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={field.id}
          type={field.secret && !revealed ? 'password' : 'text'}
          placeholder={field.placeholder}
          readOnly
          className="w-full cursor-default rounded-md border border-line bg-panel2 px-3 py-2 pr-10 font-mono text-xs text-fg/90 placeholder:text-muted/60 focus:border-brand focus:outline-none"
        />
        {field.secret && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-pressed={revealed}
            aria-label={revealed ? 'Hide ' + field.label : 'Reveal ' + field.label}
            className="absolute inset-y-0 right-0 cursor-pointer rounded-r-md px-2.5 text-muted transition-colors hover:text-fg"
          >
            {revealed ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted">{field.hint}</p>
    </div>
  );
}

export default function SettingsForm() {
  const [mode, setMode] = useState<'dev' | 'live'>('dev');

  useEffect(() => {
    fetch('/api/nodes')
      .then((r) => r.json() as Promise<{ mode?: 'dev' | 'live' }>)
      .then((d) => setMode(d.mode ?? 'dev'))
      .catch(() => setMode('dev'));
  }, []);

  return (
    <section className="max-w-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Settings</h1>
          <p className="mt-0.5 text-xs text-muted">Control-plane configuration for this ButtBase deployment.</p>
        </div>
        <span className={mode === 'live' ? 'rounded bg-brand-tint px-2 py-1 text-[11px] text-brand' : 'rounded bg-warn/15 px-2 py-1 text-[11px] text-warn'}>
          {mode === 'live' ? 'LIVE MODE' : 'DEV MODE — mock registry'}
        </span>
      </div>

      <div className="mt-5 space-y-4 rounded-md border border-line bg-panel p-5">
        {FIELDS.map((f) => (
          <FieldInput key={f.id} field={f} />
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted">
        v1 is read-only here: paste values into <span className="font-mono">.env.local</span> and restart the server —
        secrets live in env vars, never in the database or client (idea.md §20).
      </p>
    </section>
  );
}
