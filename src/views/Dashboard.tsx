import { useCallback, useEffect, useState } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import {
  api,
  type Customer,
  type Dispatch,
  type DispatchStatus,
} from '@/lib/api';
import DispatchStatusBadge from '@/components/DispatchStatusBadge';
import {
  ShoppingCart,
  Truck,
  Clock,
  CheckCircle2,
  Download,
  Receipt,
  DollarSign,
  PlusCircle,
  Users,
  Tags,
  MapPin,
  CircleDot,
  Minus,
  Sparkles,
  Calendar,
  Tag,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

type TodayStats = {
  dispatches: {
    total: number;
    all_time_total: number;
    ongoing: number;
    closed: number;
  };
  estimates: {
    total: number;
    all_time_total: number;
    pending_to_start: number;
    ongoing: number;
    closed: number;
  };
};

type DispatchWithTimeline = Dispatch & {
  customers: { name: string; phone?: string } | null;
  order?: { order_no?: string; created_at?: string; confirmed_at?: string } | null;
  sent_to_billing_at?: string | null;
  ready_for_loading_at?: string | null;
  loading_at?: string | null;
  completed_at?: string | null;
};

function LiveTimer({ start, end }: { start: string; end?: string | null }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const calc = () => {
      const startTime = new Date(start).getTime();
      const endTime = end ? new Date(end).getTime() : Date.now();
      const diffMs = endTime - startTime;
      if (diffMs < 0) {
        setElapsed('0m');
        return;
      }
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 60) {
        setElapsed(`${diffMins}m`);
      } else {
        const hrs = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        setElapsed(`${hrs}h ${mins}m`);
      }
    };
    calc();
    if (!end) {
      const interval = setInterval(calc, 60000);
      return () => clearInterval(interval);
    }
  }, [start, end]);

  return (
    <span className="flex items-center gap-1 text-xs font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">
      <Clock size={12} className="animate-pulse" /> {elapsed}
    </span>
  );
}

function formatTime(isoString?: string | null): string {
  if (!isoString) return 'Not processed';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Not processed';
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return 'Not processed';
  }
}

export default function Dashboard({ onNavigate }: { onNavigate: (view: string) => void }) {
  const { t } = useTranslation();
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null);
  const [advanceMetrics, setAdvanceMetrics] = useState<{
    today_pending: number;
    tomorrow_orders: number;
    total_pending: number;
    total_advance_amount: number;
  }>({ today_pending: 0, tomorrow_orders: 0, total_pending: 0, total_advance_amount: 0 });
  const [recentDispatches, setRecentDispatches] = useState<DispatchWithTimeline[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [data, adv] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/orders/advance-metrics').catch(() => null),
      ]);

      if (adv) setAdvanceMetrics(adv);
      
      const dispatches = (data.dispatches || []) as DispatchWithTimeline[];
      setRecentDispatches(dispatches);

      if (data.today_stats) {
        setTodayStats(data.today_stats);
      } else {
        // Fallback calculation if today_stats not directly returned
        const ongoingDisp = dispatches.filter((x) => x.status !== 'completed').length;
        const closedDisp = dispatches.filter((x) => x.status === 'completed').length;
        const ordersCount = Number(data.orders || 0);

        setTodayStats({
          dispatches: {
            total: dispatches.length,
            all_time_total: dispatches.length,
            ongoing: ongoingDisp,
            closed: closedDisp,
          },
          estimates: {
            total: ordersCount,
            all_time_total: ordersCount,
            pending_to_start: ordersCount - closedDisp,
            ongoing: ongoingDisp,
            closed: closedDisp,
          }
        });
      }
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

  const quickAccessItems = [
    {
      name: 'Dispatches',
      icon: Truck,
      view: 'dispatches',
      color: 'bg-emerald-500 text-white shadow-emerald-500/20',
      border: 'hover:border-emerald-500',
    },
    {
      name: 'Billing',
      icon: Receipt,
      view: 'billing',
      color: 'bg-blue-600 text-white shadow-blue-600/20',
      border: 'hover:border-blue-500',
    },
    {
      name: 'New Estimate',
      icon: PlusCircle,
      view: 'new_order',
      color: 'bg-amber-500 text-white shadow-amber-500/20',
      border: 'hover:border-amber-500',
    },
    {
      name: 'Estimates',
      icon: ShoppingCart,
      view: 'orders',
      color: 'bg-violet-600 text-white shadow-violet-600/20',
      border: 'hover:border-violet-500',
    },
    {
      name: 'Customer Ledger',
      icon: Users,
      view: 'customers',
      color: 'bg-sky-600 text-white shadow-sky-600/20',
      border: 'hover:border-sky-500',
    },
    {
      name: 'Price List',
      icon: Tags,
      view: 'pricelist',
      color: 'bg-slate-700 text-white shadow-slate-700/20',
      border: 'hover:border-slate-500',
    },
    {
      name: 'Reconciliation',
      icon: DollarSign,
      view: 'reconciliation',
      color: 'bg-purple-600 text-white shadow-purple-600/20',
      border: 'hover:border-purple-500',
    },
    {
      name: 'Delivery / POD',
      icon: MapPin,
      view: 'delivery',
      color: 'bg-rose-500 text-white shadow-rose-500/20',
      border: 'hover:border-rose-500',
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Header with Export Orders */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            {t('company_tagline')}
          </p>
        </div>
        <button
          onClick={() => {
            window.location.href = `${
              import.meta.env.VITE_API_URL ||
              (window.location.protocol === 'https:' ? 'https:' : 'http:') +
                '//' +
                window.location.hostname +
                ':8000/api/v1'
            }/orders/export`;
          }}
          className="btn-primary bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-xs sm:text-sm font-bold flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-sm transition"
        >
          <Download size={16} /> Export Orders
        </button>
      </div>

      {/* 2. Quick Access Grid (8 App-Style Rounded Cards) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-amber-500" />
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Quick Access
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
          {quickAccessItems.map((item) => (
            <button
              key={item.name}
              onClick={() => onNavigate(item.view)}
              className={`group flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-2xl border-2 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all text-center ${item.border}`}
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-md transition-transform group-hover:scale-110 mb-2.5 ${item.color}`}
              >
                <item.icon size={24} />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-1">
                {item.name}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 3. Activities Today (3 Metric Cards: Dispatches, Estimates, Advance Orders) */}
      <section className="space-y-3">
        <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
          Activities Today
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* DISPATCHES Today Card */}
          <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck size={18} className="text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-black text-sm uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Dispatches
                </h3>
              </div>
              <div className="text-right">
                <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase mr-1">
                  Today:
                </span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  {loading ? '—' : todayStats?.dispatches.total ?? 0}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800 p-4">
              <div className="text-center sm:text-left pr-2">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Ongoing
                </p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {loading ? '—' : todayStats?.dispatches.ongoing ?? 0}
                </p>
                <p className="text-[10px] font-medium text-slate-400 mt-0.5">Active pipeline</p>
              </div>
              <div className="text-center sm:text-left pl-4">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Closed
                </p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {loading ? '—' : todayStats?.dispatches.closed ?? 0}
                </p>
                <p className="text-[10px] font-medium text-slate-400 mt-0.5">Delivered</p>
              </div>
            </div>
          </div>

          {/* ESTIMATES Today Card */}
          <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-violet-600 dark:text-violet-400" />
                <h3 className="font-black text-sm uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Estimates
                </h3>
              </div>
              <div className="text-right">
                <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase mr-1">
                  Today:
                </span>
                <span className="text-base font-black text-violet-600 dark:text-violet-400">
                  {loading ? '—' : todayStats?.estimates.total ?? 0}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 p-4">
              <div className="text-center sm:text-left pr-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Pending
                </p>
                <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {loading ? '—' : todayStats?.estimates.pending_to_start ?? 0}
                </p>
              </div>
              <div className="text-center sm:text-left px-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Ongoing
                </p>
                <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {loading ? '—' : todayStats?.estimates.ongoing ?? 0}
                </p>
              </div>
              <div className="text-center sm:text-left pl-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Closed
                </p>
                <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {loading ? '—' : todayStats?.estimates.closed ?? 0}
                </p>
              </div>
            </div>
          </div>

          {/* ADVANCE ORDERS Card */}
          <div 
            onClick={() => onNavigate('orders')}
            className="rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-slate-900 overflow-hidden shadow-sm cursor-pointer hover:border-indigo-500 transition-all"
          >
            <div className="bg-indigo-50/80 dark:bg-indigo-950/60 px-4 py-3 border-b border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-black text-sm uppercase tracking-wider text-indigo-950 dark:text-indigo-200">
                  Advance Orders
                </h3>
              </div>
              <div className="text-right">
                <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 uppercase mr-1">
                  Total:
                </span>
                <span className="text-base font-black text-indigo-700 dark:text-indigo-300">
                  {loading ? '—' : advanceMetrics.total_pending}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 p-4">
              <div className="text-center sm:text-left pr-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Due Today
                </p>
                <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {loading ? '—' : advanceMetrics.today_pending}
                </p>
              </div>
              <div className="text-center sm:text-left px-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Tomorrow
                </p>
                <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {loading ? '—' : advanceMetrics.tomorrow_orders}
                </p>
              </div>
              <div className="text-center sm:text-left pl-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Booked
                </p>
                <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
                  {loading ? '—' : advanceMetrics.total_pending}
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 4. Recent Dispatches (Scrollable Feed with 5-Step Stepper Timeline) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Recent Dispatches
          </h2>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {recentDispatches.length} recent orders
          </span>
        </div>

        {recentDispatches.length === 0 && !loading ? (
          <div className="card p-12 text-center text-slate-400">
            <Truck size={36} className="mx-auto mb-2 opacity-50" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">No dispatches yet today.</p>
          </div>
        ) : (
          <div className="max-h-[750px] overflow-y-auto space-y-4 pr-1 sm:pr-2">
            {recentDispatches.map((d) => {
              // 5 Stepper Stage Evaluations
              const estimatedDone = true;
              const estimatedTime = formatTime(d.order?.created_at || d.created_at);

              const dispatchP1Done = Boolean(
                d.sent_to_billing_at ||
                d.ready_for_loading_at ||
                d.loading_at ||
                d.completed_at ||
                d.status === 'sent_to_billing' ||
                d.status === 'ready_for_loading' ||
                d.status === 'completed'
              );
              const dispatchP1Active = d.status === 'pending';
              const dispatchP1Time = d.sent_to_billing_at
                ? formatTime(d.sent_to_billing_at)
                : dispatchP1Done
                ? formatTime(d.created_at)
                : 'Pending';

              const billingDone = Boolean(
                d.ready_for_loading_at ||
                d.loading_at ||
                d.completed_at ||
                d.status === 'ready_for_loading' ||
                d.status === 'completed'
              );
              const billingActive = d.status === 'sent_to_billing';
              const billingTime = d.ready_for_loading_at
                ? formatTime(d.ready_for_loading_at)
                : billingDone
                ? formatTime(d.sent_to_billing_at)
                : 'Not processed';

              const dispatchP2Done = Boolean(d.loading_at || d.completed_at || d.status === 'completed');
              const dispatchP2Active = d.status === 'ready_for_loading';
              const dispatchP2Time = d.loading_at
                ? formatTime(d.loading_at)
                : d.completed_at
                ? formatTime(d.completed_at)
                : 'Not processed';

              const deliveredDone = Boolean(d.completed_at || d.status === 'completed');
              const deliveredActive = d.status === 'ready_for_loading';
              const deliveredTime = d.completed_at ? formatTime(d.completed_at) : 'Not processed';

              const steps = [
                {
                  name: 'Estimated',
                  done: estimatedDone,
                  active: false,
                  time: estimatedTime,
                },
                {
                  name: 'Dispatch P-I',
                  done: dispatchP1Done,
                  active: dispatchP1Active,
                  time: dispatchP1Time,
                },
                {
                  name: 'Billing',
                  done: billingDone,
                  active: billingActive,
                  time: billingTime,
                },
                {
                  name: 'Dispatch P-II',
                  done: dispatchP2Done,
                  active: dispatchP2Active,
                  time: dispatchP2Time,
                },
                {
                  name: 'Delivered',
                  done: deliveredDone,
                  active: deliveredActive,
                  time: deliveredTime,
                },
              ];

              return (
                <div
                  key={d.id}
                  className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm hover:shadow-md transition space-y-4 sm:space-y-6"
                >
                  {/* Top Row: DispatchID, Customer Name, Live Timer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3.5">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs sm:text-sm font-black bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-3 py-1 rounded-xl shadow-sm tracking-wider">
                        {d.dispatch_no}
                      </span>
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                          {d.customers?.name || 'Customer'}
                        </h3>
                        {d.vehicle_number && (
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            🚚 {d.vehicle_number} {d.driver_name ? `(${d.driver_name})` : ''}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <DispatchStatusBadge status={d.status} />
                      <LiveTimer start={d.created_at} end={d.completed_at} />
                    </div>
                  </div>

                  {/* Horizontal 5-Step Stepper Timeline (Responsive) */}
                  <div className="pt-1">
                    <div className="relative flex items-start justify-between">
                      
                      {/* Background Connecting Line */}
                      <div className="absolute top-4 left-4 right-4 h-1 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 z-0" />

                      {steps.map((step, sIdx) => {
                        return (
                          <div
                            key={step.name}
                            className="relative z-10 flex flex-col items-center flex-1 text-center"
                          >
                            {/* Step Node Icon */}
                            <div
                              className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border-2 transition-all shadow-sm ${
                                step.done
                                  ? 'bg-emerald-500 border-emerald-600 text-white'
                                  : step.active
                                  ? 'bg-blue-600 border-blue-700 text-white animate-pulse'
                                  : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400'
                              }`}
                            >
                              {step.done ? (
                                <CheckCircle2 size={18} className="stroke-[2.5]" />
                              ) : step.active ? (
                                <CircleDot size={18} className="animate-spin" />
                              ) : (
                                <Minus size={14} className="stroke-[2.5]" />
                              )}
                            </div>

                            {/* Step Label */}
                            <p
                              className={`text-[11px] sm:text-xs font-extrabold mt-2 leading-tight ${
                                step.done || step.active
                                  ? 'text-slate-900 dark:text-slate-100'
                                  : 'text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              {step.name}
                            </p>

                            {/* Step Timestamp */}
                            <p
                              className={`text-[10px] sm:text-[11px] font-bold mt-0.5 ${
                                step.done
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : step.active
                                  ? 'text-blue-600 dark:text-blue-400 font-extrabold'
                                  : 'text-slate-400 dark:text-slate-600'
                              }`}
                            >
                              {step.time}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
