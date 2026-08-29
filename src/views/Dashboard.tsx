import { useCallback, useEffect, useState } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import {
  api,
  type Customer,
  type Dispatch,
  type DispatchStatus,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import DispatchStatusBadge from '@/components/DispatchStatusBadge';
import WeightMismatchApprovalModal from '@/components/WeightMismatchApprovalModal';
import DiscountApprovalModal from '@/components/DiscountApprovalModal';
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
  Mic,
  AlertTriangle,
  ShieldCheck,
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

function parseDateSafe(isoString?: string | null): Date | null {
  if (!isoString) return null;
  let str = String(isoString).trim();
  // If no timezone offset is provided, assume UTC ('Z')
  if (!str.endsWith('Z') && !str.includes('+') && !str.match(/-\d{2}:\d{2}$/)) {
    str = str.replace(' ', 'T') + 'Z';
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function LiveTimer({ start, end }: { start: string; end?: string | null }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const calc = () => {
      const startDate = parseDateSafe(start);
      const endDate = end ? parseDateSafe(end) : new Date();
      if (!startDate) {
        setElapsed('0m');
        return;
      }
      const startTime = startDate.getTime();
      const endTime = endDate ? endDate.getTime() : Date.now();
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
    const d = parseDateSafe(isoString);
    if (!d) return 'Not processed';
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return 'Not processed';
  }
}

export default function Dashboard({ onNavigate }: { onNavigate: (view: string) => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null);
  const [advanceMetrics, setAdvanceMetrics] = useState<{
    today_pending: number;
    tomorrow_orders: number;
    total_pending: number;
    total_advance_amount: number;
  }>({ today_pending: 0, tomorrow_orders: 0, total_pending: 0, total_advance_amount: 0 });
  const [recentDispatches, setRecentDispatches] = useState<DispatchWithTimeline[]>([]);
  const [loading, setLoading] = useState(true);

  // Weight Mismatch Approval Modal State
  const [selectedMismatchDispatch, setSelectedMismatchDispatch] = useState<Dispatch | null>(null);
  const [mismatchModalOpen, setMismatchModalOpen] = useState(false);

  // Discount Approval Modal State
  const [selectedDiscountDispatch, setSelectedDiscountDispatch] = useState<Dispatch | null>(null);
  const [discountModalOpen, setDiscountModalOpen] = useState(false);

  const pendingMismatchDispatches = recentDispatches.filter(
    (d) => d.mismatch_approval_status === 'pending'
  );

  const pendingDiscountDispatches = recentDispatches.filter(
    (d) => d.discount_approval_status === 'pending'
  );

  const load = useCallback(async () => {
    try {
      const [data, adv] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/orders/advance-metrics').catch(() => null),
        api.post('/bills/check-today-payments').catch(() => null),
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
  useRealtime('bills', load);
  useRealtime('products', load);

  // Role-specific Quick Access Tools
  const allQuickAccessMap = {
    new_order: {
      name: 'New Estimate',
      icon: PlusCircle,
      view: 'new_order',
      color: 'bg-amber-500 text-white shadow-amber-500/20',
      border: 'hover:border-amber-500',
    },
    orders: {
      name: 'Estimates',
      icon: ShoppingCart,
      view: 'orders',
      color: 'bg-violet-600 text-white shadow-violet-600/20',
      border: 'hover:border-violet-500',
    },
    pricelist: {
      name: 'Price List',
      icon: Tags,
      view: 'pricelist',
      color: 'bg-slate-700 text-white shadow-slate-700/20',
      border: 'hover:border-slate-500',
    },
    dispatches: {
      name: 'Dispatches',
      icon: Truck,
      view: 'dispatches',
      color: 'bg-emerald-500 text-white shadow-emerald-500/20',
      border: 'hover:border-emerald-500',
    },
    billing: {
      name: 'Billing',
      icon: Receipt,
      view: 'billing',
      color: 'bg-blue-600 text-white shadow-blue-600/20',
      border: 'hover:border-blue-500',
    },
    reconciliation: {
      name: 'Reconciliation',
      icon: DollarSign,
      view: 'reconciliation',
      color: 'bg-purple-600 text-white shadow-purple-600/20',
      border: 'hover:border-purple-500',
    },
    customers: {
      name: 'Customer Ledger',
      icon: Users,
      view: 'customers',
      color: 'bg-sky-600 text-white shadow-sky-600/20',
      border: 'hover:border-sky-500',
    },
    delivery: {
      name: 'Delivery / POD',
      icon: MapPin,
      view: 'delivery',
      color: 'bg-rose-500 text-white shadow-rose-500/20',
      border: 'hover:border-rose-500',
    },
  };

  const getQuickAccessItems = () => {
    const role = user?.role;
    if (role === 'dispatch') {
      return [
        allQuickAccessMap.dispatches,
        allQuickAccessMap.delivery,
      ];
    }
    if (role === 'billing' || role === 'cashier') {
      return [
        allQuickAccessMap.new_order,
        allQuickAccessMap.orders,
        allQuickAccessMap.pricelist,
        allQuickAccessMap.billing,
        allQuickAccessMap.reconciliation,
      ];
    }
    // Admin & other roles: Full 8 tools pipeline
    return [
      allQuickAccessMap.new_order,
      allQuickAccessMap.orders,
      allQuickAccessMap.pricelist,
      allQuickAccessMap.dispatches,
      allQuickAccessMap.billing,
      allQuickAccessMap.reconciliation,
      allQuickAccessMap.customers,
      allQuickAccessMap.delivery,
    ];
  };

  const quickAccessItems = getQuickAccessItems();

  const getGridColsClass = (count: number) => {
    if (count <= 2) return 'grid grid-cols-2 max-w-md gap-3 sm:gap-4';
    if (count <= 4) return 'grid grid-cols-2 sm:grid-cols-4 max-w-3xl gap-3 sm:gap-4';
    if (count === 5) return 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4';
    return 'grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4';
  };

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
        {user?.role !== 'dispatch' && (
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
        )}
      </div>

      {/* 1.5. Pending Weight Mismatch Approvals (Prominent Admin Alert Card) */}
      {pendingMismatchDispatches.length > 0 && (
        <section className="rounded-2xl border-2 border-amber-500/80 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900 p-5 shadow-lg relative overflow-hidden animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-amber-300/60 dark:border-amber-900/60">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md animate-pulse">
                <Mic size={22} />
              </div>
              <div>
                <h2 className="text-base font-black text-amber-950 dark:text-amber-100 flex items-center gap-2">
                  Weight Mismatch Approval Requested
                  <span className="badge bg-amber-600 text-white text-xs font-black px-2 py-0.5 shadow-sm">
                    {pendingMismatchDispatches.length} PENDING
                  </span>
                </h2>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                  The dispatcher recorded actual weights exceeding standard tolerance. Listen to the voice note to approve.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {pendingMismatchDispatches.map((d) => (
              <div
                key={d.id}
                className="rounded-xl border border-amber-300 dark:border-amber-800/80 bg-white dark:bg-slate-800 p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-sm text-slate-800 dark:text-white">
                      {d.dispatch_no}
                    </span>
                    <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Clock size={11} /> {d.mismatch_requested_at ? new Date(d.mismatch_requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <p>
                      <strong className="text-slate-800 dark:text-white">Customer: </strong>
                      {d.customers?.name || (d as any).customer?.name || 'Customer'}
                    </p>
                    <p>
                      <strong className="text-slate-800 dark:text-white">Vehicle / Driver: </strong>
                      {d.vehicle_number || d.driver_name || 'Fleet'}
                    </p>
                    {d.mismatch_reason && (
                      <p className="text-[11px] text-indigo-900 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/40 p-2 rounded-lg border border-indigo-200 dark:border-indigo-900/60 line-clamp-2">
                        📝 "{d.mismatch_reason}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-700/60">
                  <button
                    onClick={() => {
                      setSelectedMismatchDispatch(d);
                      setMismatchModalOpen(true);
                    }}
                    className="w-full btn-primary py-2.5 px-3 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md flex items-center justify-center gap-1.5 transition active:scale-95"
                  >
                    <Mic size={15} className="animate-pulse" /> Listen Voice Note & Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 1.6. Pending Discount Approvals (Prominent Admin Alert Card) */}
      {pendingDiscountDispatches.length > 0 && (
        <section className="rounded-2xl border-2 border-emerald-500/80 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 p-5 shadow-lg relative overflow-hidden animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-emerald-300/60 dark:border-emerald-900/60">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md animate-pulse">
                <Tag size={22} />
              </div>
              <div>
                <h2 className="text-base font-black text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
                  Item Discount Approvals Requested
                  <span className="badge bg-emerald-600 text-white text-xs font-black px-2 py-0.5 shadow-sm">
                    {pendingDiscountDispatches.length} PENDING
                  </span>
                </h2>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                  Billing staff requested item rate discounts for customers. Review item breakdown and approve or reject.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {pendingDiscountDispatches.map((d) => (
              <div
                key={d.id}
                className="rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-white dark:bg-slate-800 p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-sm text-slate-800 dark:text-white">
                      {d.dispatch_no}
                    </span>
                    <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                      -₹{(d.discount_amount || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <p>
                      <strong className="text-slate-800 dark:text-white">Customer: </strong>
                      {d.customers?.name || (d as any).customer?.name || 'Customer'}
                    </p>
                    {d.discount_requested_by && (
                      <p>
                        <strong className="text-slate-800 dark:text-white">Requested by: </strong>
                        {d.discount_requested_by}
                      </p>
                    )}
                    {d.discount_reason && (
                      <p className="text-[11px] text-emerald-900 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-900/60 line-clamp-2">
                        💬 "{d.discount_reason}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-700/60">
                  <button
                    onClick={() => {
                      setSelectedDiscountDispatch(d);
                      setDiscountModalOpen(true);
                    }}
                    className="w-full btn-primary py-2.5 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center justify-center gap-1.5 transition active:scale-95"
                  >
                    <ShieldCheck size={15} /> Review & Decide Discount
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2. Activities Today (3 Metric Cards: Dispatches, Estimates, Advance Orders) */}
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

      {/* 3. Quick Access Grid (8 App-Style Rounded Cards - Placed Below Activities Today) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-amber-500" />
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Quick Access
          </h2>
        </div>
        <div className={getGridColsClass(quickAccessItems.length)}>
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

      {/* 4. Recent Dispatches (Scrollable Feed with 5-Step Stepper Timeline - Admin Only) */}
      {user?.role !== 'dispatch' && user?.role !== 'billing' && user?.role !== 'cashier' && (
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

                      {/* Mismatch Approval Banner in Timeline Card */}
                      {d.mismatch_approval_status === 'pending' && (
                        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-300 dark:border-amber-900/60 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Mic size={16} className="text-amber-600 animate-pulse" />
                            <div>
                              <strong className="text-xs font-bold text-amber-950 dark:text-amber-200">Weight Mismatch Approval Pending</strong>
                              {d.mismatch_reason && <p className="text-[11px] text-amber-800 dark:text-amber-300 italic">"{d.mismatch_reason}"</p>}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedMismatchDispatch(d);
                              setMismatchModalOpen(true);
                            }}
                            className="btn-primary py-1.5 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 font-bold text-white flex items-center gap-1.5 shadow"
                          >
                            <Mic size={13} /> Listen & Approve
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Admin Weight Mismatch Approval Modal */}
      <WeightMismatchApprovalModal
        open={mismatchModalOpen}
        onClose={() => setMismatchModalOpen(false)}
        dispatch={selectedMismatchDispatch}
        onSuccess={load}
      />

      {/* Admin Discount Approval Modal */}
      <DiscountApprovalModal
        open={discountModalOpen}
        onClose={() => setDiscountModalOpen(false)}
        dispatch={selectedDiscountDispatch}
        onDecisionSubmitted={load}
      />
    </div>
  );
}
