import { useCallback, useEffect, useState } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import {
  api,
  type Customer,
  type Dispatch,
  type DispatchStatus,
  type Order,
  type Product,
} from '@/lib/api';
import DispatchStatusBadge from '@/components/DispatchStatusBadge';
import {
  Package,
  Users,
  ShoppingCart,
  Truck,
  TrendingUp,
  Clock,
  CheckCircle2,
  Download,
} from 'lucide-react';

type Stats = {
  customers: number;
  products: number;
  orders: number;
  dispatches: number;
  pendingDispatches: number;
  completedDispatches: number;
};

const statusOrder: DispatchStatus[] = ['pending', 'confirmed', 'weighed', 'loaded', 'completed'];

export default function Dashboard({ onNavigate }: { onNavigate: (view: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [recentDispatches, setRecentDispatches] = useState<
    (Dispatch & { customers: Pick<Customer, 'name'> | null })[]
  >([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/dashboard/stats');
      
      const dispatches = data.dispatches as (Dispatch & { customers: { name: string } | null })[];
      const counts: Record<string, number> = {};
      dispatches.forEach((x) => {
        counts[x.status] = (counts[x.status] ?? 0) + 1;
      });

      setStats({
        customers: data.customers ?? 0,
        products: data.products ?? 0,
        orders: data.orders ?? 0,
        dispatches: dispatches.length,
        pendingDispatches: dispatches.filter((x) => x.status !== 'completed').length,
        completedDispatches: dispatches.filter((x) => x.status === 'completed').length,
      });
      setStatusCounts(counts);

      const recent = dispatches
        .slice()
        .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
        .slice(0, 6);
      
      setRecentDispatches(recent);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime('dispatches', load);
  useRealtime('customers', load);
  useRealtime('orders', load);
  useRealtime('products', load);

  const cards = [
    { label: 'Customers', value: stats?.customers ?? 0, icon: Users, view: 'customers', color: 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/30' },
    { label: 'Products', value: stats?.products ?? 0, icon: Package, view: 'products', color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/30' },
    { label: 'Orders', value: stats?.orders ?? 0, icon: ShoppingCart, view: 'orders', color: 'text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-900/30' },
    { label: 'Dispatches', value: stats?.dispatches ?? 0, icon: Truck, view: 'dispatches', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/30' },
    { label: 'In Progress', value: stats?.pendingDispatches ?? 0, icon: Clock, view: 'dispatches', color: 'text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/30' },
    { label: 'Completed', value: stats?.completedDispatches ?? 0, icon: CheckCircle2, view: 'dispatches', color: 'text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-900/30' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 drop-shadow-sm">Dashboard</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Overview of orders and dispatch operations</p>
        </div>
        <button
          onClick={() => {
            window.location.href = `${import.meta.env.VITE_API_URL || (window.location.protocol === 'https:' ? 'https:' : 'http:') + '//' + window.location.hostname + ':8000/api/v1'}/orders/export`;
          }}
          className="btn-secondary flex items-center gap-2"
        >
          <Download size={16} /> Export Orders (CSV)
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <button
            key={card.label}
            onClick={() => onNavigate(card.view)}
            className="card flex flex-col items-start gap-3 p-4 text-left hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/10 dark:hover:shadow-indigo-500/5"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-inner ${card.color}`}>
              <card.icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {loading ? '—' : card.value}
              </p>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{card.label}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-bold text-slate-800 dark:text-slate-100">Dispatch Status Breakdown</h2>
          </div>
          <div className="space-y-3">
            {statusOrder.map((s) => {
              const count = statusCounts[s] ?? 0;
              const total = stats?.dispatches ?? 0;
              const pct = total ? (count / total) * 100 : 0;
              return (
                <div key={s}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <DispatchStatusBadge status={s} />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/50 dark:bg-slate-800/50 shadow-inner">
                    <div
                      className="h-full rounded-full bg-indigo-500/80 dark:bg-indigo-500 transition-all duration-500 shadow-sm"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {loading && <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>}
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Truck size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-bold text-slate-800 dark:text-slate-100">Recent Dispatches</h2>
          </div>
          {recentDispatches.length === 0 && !loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No dispatches yet.</p>
          ) : (
            <div className="space-y-2">
              {recentDispatches.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-xl bg-white/20 dark:bg-slate-800/30 border border-white/30 dark:border-slate-700/50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{d.dispatch_no}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {d.customers?.name ?? 'Unknown customer'}
                    </p>
                  </div>
                  <DispatchStatusBadge status={d.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
