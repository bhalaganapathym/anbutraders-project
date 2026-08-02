import type { DispatchStatus } from '@/lib/api';

const config: Record<DispatchStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-white/20 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-700' },
  weighed: { label: 'Weighed', className: 'bg-indigo-100/50 dark:bg-indigo-800/40 text-indigo-700 dark:text-indigo-300' },
  loaded: { label: 'Loaded', className: 'bg-violet-100 text-violet-700' },
  completed: { label: 'Completed', className: 'bg-emerald-100/50 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300' },
};

export default function DispatchStatusBadge({ status }: { status: DispatchStatus }) {
  const c = config[status] ?? config.pending;
  return <span className={`badge ${c.className}`}>{c.label}</span>;
}
