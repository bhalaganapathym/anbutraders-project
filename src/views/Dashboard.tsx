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
    { label: 'Customers', value: stats?.customers ?? 0, icon: Users, view: 'customers', color: 'text-blue-600 bg-blue-50' },
    { label: 'Products', value: stats?.products ?? 0, icon: Package, view: 'products', color: 'text-amber-600 bg-amber-50' },
    { label: 'Orders', value: stats?.orders ?? 0, icon: ShoppingCart, view: 'orders', color: 'text-violet-600 bg-violet-50' },
    { label: 'Dispatches', value: stats?.dispatches ?? 0, icon: Truck, view: 'dispatches', color: 'text-emerald-600 bg-emerald-50' },
    { label: 'In Progress', value: stats?.pendingDispatches ?? 0, icon: Clock, view: 'dispatches', color: 'text-amber-600 bg-amber-50' },
    { label: 'Completed', value: stats?.completedDispatches ?? 0, icon: CheckCircle2, view: 'dispatches', color: 'text-emerald-600 bg-emerald-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500">Overview of orders and dispatch operations</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <button
            key={card.label}
            onClick={() => onNavigate(card.view)}
            className="card flex flex-col items-start gap-3 p-4 text-left transition hover:shadow-md hover:-translate-y-0.5"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.color}`}>
              <card.icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {loading ? '—' : card.value}
              </p>
              <p className="text-xs font-medium text-slate-500">{card.label}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-amber-600" />
            <h2 className="font-bold text-slate-800">Dispatch Status Breakdown</h2>
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
                    <span className="font-semibold text-slate-700">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {loading && <p className="text-sm text-slate-400">Loading...</p>}
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Truck size={18} className="text-emerald-600" />
            <h2 className="font-bold text-slate-800">Recent Dispatches</h2>
          </div>
          {recentDispatches.length === 0 && !loading ? (
            <p className="text-sm text-slate-400">No dispatches yet.</p>
          ) : (
            <div className="space-y-2">
              {recentDispatches.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{d.dispatch_no}</p>
                    <p className="text-xs text-slate-500">
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
