'use client';

import { useState } from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';

interface SecretRow {
  label: string;
  value: string;
  masked?: boolean;
}

const ROWS: SecretRow[] = [
  { label: 'Universal URL', value: 'https://api.buttbase.io/v1' },
  { label: 'Master JWT (demo token)', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.bb-dev-token', masked: true },
  { label: 'Registry encryption key', value: 'managed via REGISTRY_ENCRYPTION_KEY in .env — never displayed', masked: true },
];

function Row({ row }: { row: SecretRow }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const hidden = Boolean(row.masked) && !revealed;

  async function copy() {
    try {
      await navigator.clipboard.writeText(row.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-panel px-4 py-3">
      <div className="min-w-0">
        <div className="text-xs text-muted">{row.label}</div>
        <div className="mt-0.5 truncate font-mono text-xs text-fg/90">
          {hidden ? '•'.repeat(Math.min(row.value.length, 36)) : row.value}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {row.masked && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="cursor-pointer rounded p-1.5 text-muted transition-colors hover:bg-panel2 hover:text-fg"
            aria-label={revealed ? 'Hide value' : 'Reveal value'}
            aria-pressed={revealed}
          >
            {revealed ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => void copy()}
          className="cursor-pointer rounded p-1.5 text-muted transition-colors hover:bg-panel2 hover:text-fg"
          aria-label="Copy value"
        >
          {copied ? <Check size={15} className="text-brand" aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

export default function SecretsPanel() {
  return (
    <div className="space-y-2">
      {ROWS.map((row) => (
        <Row key={row.label} row={row} />
      ))}
      <p className="pt-1 text-[11px] text-muted">
        The client only ever sees the gateway domain — node URLs and service keys never leave the server (idea.md §18).
      </p>
    </div>
  );
}
