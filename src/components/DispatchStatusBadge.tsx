import type { DispatchStatus } from '@/lib/api';

const config: Record<DispatchStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-slate-100 text-slate-700' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-700' },
  weighed: { label: 'Weighed', className: 'bg-amber-100 text-amber-700' },
  loaded: { label: 'Loaded', className: 'bg-violet-100 text-violet-700' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700' },
};

export default function DispatchStatusBadge({ status }: { status: DispatchStatus }) {
  const c = config[status] ?? config.pending;
  return <span className={`badge ${c.className}`}>{c.label}</span>;
}
