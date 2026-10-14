'use client';

import { useCallback, useEffect, useState } from 'react';
import { CAPACITY_FULL_PCT, storagePct, type RegistryNode } from '@buttbase/shared-types';
import { Badge, ProgressBar, StatusDot } from '@/components/primitives';
import ProvisionModal from '@/components/ProvisionModal';
import { cx, relTime } from '@/lib/format';
import { mockNodes } from '@/lib/mock-data';
import { Copy, KeyRound, MoreHorizontal, Plus, RefreshCw, Ban } from 'lucide-react';

function statusOf(n: RegistryNode): 'active' | 'paused' | 'full' {
  if (n.is_paused) return 'paused';
  if (storagePct(n) >= CAPACITY_FULL_PCT) return 'full';
  return 'active';
}

export default function NodeTable({ autoProvision = false }: { autoProvision?: boolean }) {
  const [nodes, setNodes] = useState<RegistryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(autoProvision);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/nodes');
      const data = (await res.json()) as { nodes?: RegistryNode[] };
      setNodes(data.nodes ?? []);
    } catch {
      setNodes(mockNodes());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function flash(message: string) {
    setNotice(message);
    setTimeout(() => setNotice(null), 2600);
  }

  function egressTone(n: RegistryNode): string {
    const pct = n.egress_limit_gb > 0 ? (n.egress_used_gb / n.egress_limit_gb) * 100 : 0;
    return pct >= 75 ? 'text-warn' : 'text-fg';
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Databases</h1>
          <p className="mt-0.5 text-xs text-muted">
            Every connected free-tier Supabase project is a node in the federation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:bg-panel2 hover:text-fg"
            aria-label="Refresh nodes"
          >
            <RefreshCw size={13} aria-hidden="true" className={loading ? 'animate-spin' : undefined} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-oktext transition-colors hover:bg-brand-hover"
          >
            <Plus size={13} aria-hidden="true" />
            Provision node
          </button>
        </div>
      </div>

      {notice && (
        <p role="status" className="mt-3 rounded-md border border-line bg-panel px-3 py-2 text-xs text-muted">
          {notice}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-md border border-line bg-panel">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-3 font-medium">Name</th>
              <th scope="col" className="px-4 py-3 font-medium">Node ID</th>
              <th scope="col" className="px-4 py-3 font-medium">Type</th>
              <th scope="col" className="px-4 py-3 font-medium">Storage</th>
              <th scope="col" className="px-4 py-3 font-medium">Egress</th>
              <th scope="col" className="px-4 py-3 font-medium">Region</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium">Keep-alive</th>
              <th scope="col" className="px-4 py-3 text-right font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {loading && nodes.length === 0 ? (
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={i} className="border-b border-line/60">
                  <td colSpan={9} className="px-4 py-3.5">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-panel2" />
                  </td>
                </tr>
              ))
            ) : nodes.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted">
                  No nodes yet — provision your first one.
                </td>
              </tr>
            ) : (
              nodes.map((n) => (
                <tr key={n.id} className="border-b border-line/60 transition-colors last:border-0 hover:bg-hoverline">
                  <td className="whitespace-nowrap px-4 py-3">{n.node_name}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-brand">{n.node_prefix}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge>{n.data_type}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <ProgressBar usedMb={Number(n.storage_used_mb)} limitMb={Number(n.storage_limit_mb)} />
                  </td>
                  <td className={cx('whitespace-nowrap px-4 py-3 font-mono text-xs', egressTone(n))}>
                    {Number(n.egress_used_gb).toFixed(1)} / {Number(n.egress_limit_gb).toFixed(0)} GB
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{n.region ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusDot status={statusOf(n)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{relTime(n.last_keepalive_at)}</td>
                  <td className="relative px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setMenuFor(menuFor === n.id ? null : n.id)}
                      className="cursor-pointer rounded p-1.5 text-muted transition-colors hover:bg-panel2 hover:text-fg"
                      aria-label={'Actions for ' + n.node_prefix}
                      aria-haspopup="menu"
                      aria-expanded={menuFor === n.id}
                    >
                      <MoreHorizontal size={16} aria-hidden="true" />
                    </button>
                    {menuFor === n.id && (
                      <div role="menu" className="absolute right-4 top-11 z-10 w-44 overflow-hidden rounded-md border border-line bg-panel text-left text-xs shadow-xl">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuFor(null);
                            flash('Service key copied — masked value in dev mode; live keys never leave the server.');
                          }}
                          className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-fg transition-colors hover:bg-panel2"
                        >
                          <KeyRound size={13} aria-hidden="true" /> Copy service key
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuFor(null);
                            flash('Copy URL: ' + n.supabase_url.replace(/^https:\/\//, ''));
                          }}
                          className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-fg transition-colors hover:bg-panel2"
                        >
                          <Copy size={13} aria-hidden="true" /> Copy node URL
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuFor(null);
                            flash('Revoke needs the live Master registry — wire credentials in .env (v1 stub).');
                          }}
                          className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-danger transition-colors hover:bg-panel2"
                        >
                          <Ban size={13} aria-hidden="true" /> Revoke node
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ProvisionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onQueued={(message) => {
          flash(message);
          void load();
        }}
      />
    </section>
  );
}
