'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function CodeSnippet({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — user can select the text manually */
    }
  }

  return (
    <div className="overflow-hidden rounded-md border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="text-[11px] text-muted">{label ?? 'snippet'}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-[11px] text-muted transition-colors hover:bg-panel2 hover:text-fg"
          aria-label="Copy code to clipboard"
        >
          {copied ? <Check size={13} className="text-brand" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-fg/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}
