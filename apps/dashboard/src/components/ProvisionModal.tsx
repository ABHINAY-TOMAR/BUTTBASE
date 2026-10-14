'use client';

import { useEffect, useRef, useState } from 'react';
import { NODE_CATEGORIES, type NodeCategory } from '@buttbase/shared-types';

export default function ProvisionModal({
  open,
  onClose,
  onQueued,
}: {
  open: boolean;
  onClose: () => void;
  onQueued: (message: string) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<NodeCategory>('images');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setBusy(false);
      setName('');
      setType('images');
      nameRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/provision', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || undefined, type }),
      });
      const data = (await res.json()) as { queued?: boolean; mode?: string; error?: string };
      if (!res.ok || !data.queued) throw new Error(data.error ?? 'queue request failed');
      onQueued(
        data.mode === 'dev'
          ? 'Queued — dev-mode simulation. Run the live provisioner (pnpm dev:provisioner) with real credentials to actually create projects.'
          : 'Queued — the provisioner worker will pick it up within its throttle window.'
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/60 pt-24" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="provision-title"
        className="w-full max-w-md rounded-md border border-line bg-panel p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="provision-title" className="text-sm font-semibold">
          Provision a new node
        </h2>
        <p className="mt-1 text-xs text-muted">
          You only ever type a name and a category — the provisioner does the rest (idea.md §8).
        </p>

        <label htmlFor="node-name" className="mt-4 block text-xs text-muted">
          Node name
        </label>
        <input
          id="node-name"
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Image Storage Node 3"
          className="mt-1 w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-fg placeholder:text-muted/60 focus:border-brand focus:outline-none"
        />

        <label htmlFor="node-type" className="mt-4 block text-xs text-muted">
          Data category
        </label>
        <select
          id="node-type"
          value={type}
          onChange={(e) => setType(e.target.value as NodeCategory)}
          className="mt-1 w-full cursor-pointer rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none"
        >
          {NODE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {error && <p role="alert" className="mt-3 text-xs text-danger">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:bg-panel2 hover:text-fg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="cursor-pointer rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-oktext transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Queuing…' : 'Deploy'}
          </button>
        </div>
      </div>
    </div>
  );
}
