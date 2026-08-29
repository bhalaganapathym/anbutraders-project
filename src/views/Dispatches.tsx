import { useCallback, useEffect, useState } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import {
  api,
  type Dispatch,
  type Order,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import DispatchStatusBadge from '@/components/DispatchStatusBadge';
import { useToast } from '@/components/Toast';
import {
  Plus, Search, Truck, Trash2, Package, AlertCircle, Clock, MessageSquare, Play, MapPin, User, Mic, CheckCircle2
} from 'lucide-react';
import Modal from '@/components/Modal';
import DispatchDashboard from './DispatchDashboard';
import WeightMismatchApprovalModal from '@/components/WeightMismatchApprovalModal';
import { openWhatsApp, buildDispatchWhatsAppMessage } from '@/lib/whatsapp';
import { useTranslation } from '@/lib/i18n';
import { calculateProductPrice, round2 } from '@/lib/pricing';

type DispatchRow = Dispatch & { customer: { name: string; phone: string | null } | null; order?: { confirmed_at?: string; order_no?: string } };
type ConfirmedOrder = Order & { customer: { name: string; phone: string | null; address?: string | null } | null };

function WaitClock({ timestamp }: { timestamp: string | Date }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date().getTime();
      const start = new Date(timestamp).getTime();
      const diffMs = now - start;
      if (diffMs < 0) {
        setElapsed('0s');
        return;
      }
      const diffSecs = Math.floor(diffMs / 1000);
      const days = Math.floor(diffSecs / 86400);
      const hours = Math.floor((diffSecs % 86400) / 3600);
      const mins = Math.floor((diffSecs % 3600) / 60);
      const secs = diffSecs % 60;
      
      let timeStr = '';
      if (days > 0) timeStr += `${days}d `;
      if (hours > 0 || days > 0) timeStr += `${hours}h `;
      timeStr += `${mins}m ${secs}s`;
      
      setElapsed(timeStr.trim());
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return (
    <div className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
      <Clock size={12} className="animate-pulse" /> {elapsed}
    </div>
  );
}

export default function Dispatches() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const [dispatches, setDispatches] = useState<DispatchRow[]>([]);
  const [confirmedOrders, setConfirmedOrders] = useState<ConfirmedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'new' | 'active' | 'completed'>('new');
  
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState('');
  const [creating, setCreating] = useState(false);

  const [detail, setDetail] = useState<DispatchRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Mismatch Approval Modal State
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [selectedMismatchDispatch, setSelectedMismatchDispatch] = useState<DispatchRow | null>(null);

  const handleOpenApprovalModal = (d: DispatchRow) => {
    setSelectedMismatchDispatch(d);
    setApprovalModalOpen(true);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (items: (DispatchRow | ConfirmedOrder)[]) => {
    if (selectedIds.size === items.length && items.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected dispatch(es)?`)) return;
    try {
      await api.post('/dispatches/bulk-delete', { ids: Array.from(selectedIds) });
      toast(`Deleted ${selectedIds.size} dispatch(es)`, 'success');
      setSelectedIds(new Set());
      load();
    } catch (e: any) {
      toast(e?.message || 'Failed to delete dispatches', 'error');
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allOrders, allDispatches]: [ConfirmedOrder[], DispatchRow[]] = await Promise.all([
        api.get('/orders'),
        api.get('/dispatches')
      ]);
      const existingDispatchOrderIds = new Set(allDispatches.map(d => d.order_id));
      const freshConfirmed = allOrders.filter(o => o.status === 'confirmed' && !existingDispatchOrderIds.has(o.id));
      setConfirmedOrders(freshConfirmed);
      setDispatches(allDispatches);
    } catch {
      toast('Failed to load dispatches', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime('dispatches', load);
  useRealtime('orders', load);

  const handleStartDispatch = async (order: ConfirmedOrder) => {
    setCreating(true);
    try {
      const orderItems = order.items || [];
      if (orderItems.length === 0) {
        toast('This estimate has no items', 'error');
        setCreating(false);
        return;
      }
      const num = dispatches.length + 1;
      const dispatchNo = `DSP-${String(num).padStart(4, '0')}`;
      
      const payload = {
        dispatch_no: dispatchNo,
        order_id: order.id,
        customer_id: order.customer_id,
        delivery_address: order.delivery_address || order.customer?.address || null,
        status: 'pending',
        items: orderItems.map((it) => {
          const pricing = calculateProductPrice(it.product, it.quantity);
          return {
            product_id: it.product_id,
            product_name: it.product?.name ?? 'Unknown',
            quantity: it.quantity,
            unit: it.unit || it.product?.unit || 'piece',
            price: pricing.unitPrice,
          };
        })
      };
      
      const created: any = await api.post('/dispatches', payload);
      toast('Dispatch started - Opening verification', 'success');
      await load();
      setDetail({ 
        ...created, 
        customer: order.customer ? { name: order.customer.name, phone: order.customer.phone || null } : null,
        order: { confirmed_at: order.confirmed_at, order_no: order.order_no }
      });
    } catch {
      toast('Failed to start dispatch', 'error');
    } finally {
      setCreating(false);
    }
  };

  const openCreate = () => {
    setSelectedOrder('');
    setCreateOpen(true);
  };

  const filteredDispatches = dispatches.filter((d) => {
    const isCompleted = d.status === 'completed';
    const matchesTab = activeTab === 'completed' ? isCompleted : !isCompleted;
    const matchesQuery = [d.dispatch_no, d.customer?.name ?? '', d.delivery_address ?? '', d.vehicle_number ?? ''].join(' ').toLowerCase().includes(query.toLowerCase());
    return matchesTab && matchesQuery;
  });

  const filteredNewDeliveries = confirmedOrders.filter((o) => {
    return [o.order_no ?? '', o.customer?.name ?? '', o.delivery_address ?? '', o.customer?.phone ?? ''].join(' ').toLowerCase().includes(query.toLowerCase());
  });

  const createDispatch = async () => {
    if (!selectedOrder) {
      toast('Select a confirmed estimate', 'error');
      return;
    }
    const order = confirmedOrders.find((o) => o.id === selectedOrder);
    if (order) {
      await handleStartDispatch(order);
      setCreateOpen(false);
    }
  };

  const handleWhatsAppAlert = (d: DispatchRow) => {
    const phone = d.customer?.phone || '';
    if (!phone) {
      toast('Customer phone number not available', 'error');
      return;
    }
    const msg = buildDispatchWhatsAppMessage(d, undefined, d.customer, d.bill);
    openWhatsApp(phone, msg);
  };

  const removeDispatch = async (d: DispatchRow) => {
    if (!confirm(`Delete dispatch ${d.dispatch_no}?`)) return;
    try {
      await api.delete(`/dispatches/${d.id}`);
      if (d.order_id) {
        await api.delete(`/orders/${d.order_id}`).catch(() => {});
      }
      toast('Dispatch and order deleted', 'success');
      load();
    } catch {
      toast('Failed to delete dispatch', 'error');
    }
  };

  const removeNewOrder = async (order: ConfirmedOrder) => {
    if (!confirm(`Delete/Cancel estimate ${order.order_no || 'ORD-' + order.id.slice(0, 6)}?`)) return;
    try {
      await api.delete(`/orders/${order.id}`);
      toast('Estimate deleted from new deliveries', 'success');
      load();
    } catch {
      toast('Failed to delete estimate', 'error');
    }
  };

  if (detail) {
    return <DispatchDashboard detail={detail} onClose={() => setDetail(null)} onRefresh={load} />;
  }

  const newDeliveriesCount = confirmedOrders.length;
  const activeDeliveriesCount = dispatches.filter(d => d.status !== 'completed').length;
  const completedDeliveriesCount = dispatches.filter(d => d.status === 'completed').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t('dispatches')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('company_tagline')}</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={16} /> {t('new_dispatch')}
        </button>
      </div>

      {/* 3-Tab Navigation */}
      <div className="flex gap-2 sm:gap-6 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        <button 
          className={`pb-2.5 px-2 border-b-2 font-bold text-sm transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'new' 
              ? 'border-amber-500 text-amber-600 dark:text-amber-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
          onClick={() => setActiveTab('new')}
        >
          <span>New Deliveries</span>
          {newDeliveriesCount > 0 ? (
            <span className="badge bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-xs px-2 py-0.5 animate-pulse">
              {newDeliveriesCount} New
            </span>
          ) : (
            <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs">0</span>
          )}
        </button>

        <button 
          className={`pb-2.5 px-2 border-b-2 font-bold text-sm transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'active' 
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
          onClick={() => setActiveTab('active')}
        >
          <span>Active Deliveries</span>
          <span className="badge bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 text-xs">
            {activeDeliveriesCount}
          </span>
        </button>

        <button 
          className={`pb-2.5 px-2 border-b-2 font-bold text-sm transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'completed' 
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
          onClick={() => setActiveTab('completed')}
        >
          <span>Completed Deliveries</span>
          <span className="badge bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs">
            {completedDeliveriesCount}
          </span>
        </button>
      </div>

      {/* Search & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={activeTab === 'new' ? "Search estimate, customer, phone..." : t('search')}
            className="input pl-9"
          />
        </div>

        {activeTab !== 'new' && filteredDispatches.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleSelectAll(filteredDispatches)}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              {selectedIds.size === filteredDispatches.length ? 'Deselect All' : `Select All (${filteredDispatches.length})`}
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="btn-danger text-xs py-1.5 px-3 flex items-center gap-1"
              >
                <Trash2 size={14} /> Delete Selected ({selectedIds.size})
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading deliveries...</p>
      ) : activeTab === 'new' ? (
        /* TAB 1: NEW DELIVERIES (Confirmed estimates awaiting dispatch start) */
        filteredNewDeliveries.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 p-12 text-center">
            <Package size={40} className="text-slate-300 dark:text-slate-600" />
            <p className="text-slate-600 dark:text-slate-400 font-medium">No new confirmed estimates waiting for dispatch.</p>
            <p className="text-xs text-slate-400">When an estimate is confirmed in the Estimate page, it will immediately appear here with full details.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNewDeliveries.map((order) => {
              const totalItemsCount = order.items?.length || 0;
              const estWeight = round2((order.items || []).reduce((acc, it) => acc + round2(calculateProductPrice(it.product, it.quantity || 1).totalWeight), 0));
              const totalAmt = round2((order.items || []).reduce((acc, it) => acc + round2(calculateProductPrice(it.product, it.quantity || 1).totalPrice), 0));
              
              return (
                <div key={order.id} className="card p-5 border-2 border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-white to-amber-50/20 dark:from-slate-900 dark:to-amber-950/10 shadow-sm hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-extrabold uppercase text-[11px] px-2 py-0.5">
                        New Confirmed Estimate
                      </span>
                      <h3 className="font-mono font-bold text-lg text-slate-800 dark:text-slate-100 mt-1">
                        {order.order_no || `ORD-${order.id.slice(0, 6).toUpperCase()}`}
                      </h3>
                    </div>
                    <WaitClock timestamp={order.confirmed_at || order.created_at} />
                  </div>

                  <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300 py-2 border-y border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <User size={15} className="text-amber-600 shrink-0" />
                      <span className="font-bold text-slate-800 dark:text-slate-100">{order.customer?.name || 'Unknown Customer'}</span>
                    </div>
                    {order.customer?.phone && (
                      <p className="text-xs text-slate-500 pl-6">📞 {order.customer.phone}</p>
                    )}
                    <div className="flex items-start gap-2 text-xs text-slate-500">
                      <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{order.delivery_address || order.customer?.address || 'Site delivery'}</span>
                    </div>
                  </div>

                  {/* Order Items Preview */}
                  <div className="mt-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 text-xs space-y-1">
                    <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300">
                      <span>Items: {totalItemsCount}</span>
                      <span>Weight: {estWeight.toFixed(1)} kg</span>
                    </div>
                    <p className="text-slate-500 line-clamp-2 pt-1 border-t border-slate-200/60 dark:border-slate-700">
                      {order.items?.map(it => `${it.quantity} ${it.unit || 'nos'} ${it.product?.name || 'Item'}`).join(', ')}
                    </p>
                    <div className="pt-1.5 flex justify-between items-center text-slate-700 dark:text-slate-300 font-bold">
                      <span>Order Value:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">₹{totalAmt.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 mt-4">
                    <button
                      onClick={() => handleStartDispatch(order)}
                      disabled={creating}
                      className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 font-bold shadow-md bg-amber-600 hover:bg-amber-700"
                    >
                      <Play size={16} /> Start Verification & Dispatch
                    </button>
                    <button
                      onClick={() => removeNewOrder(order)}
                      className="btn-ghost p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                      title="Delete / Cancel Estimate"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : filteredDispatches.length === 0 ? (
        /* TAB 2 & 3: EMPTY STATE */
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <Truck size={36} className="text-slate-300" />
          <p className="text-slate-500 dark:text-slate-400">No {activeTab} dispatches found.</p>
          {activeTab === 'active' && (
            <button onClick={openCreate} className="btn-primary">
              <Plus size={16} /> Create dispatch
            </button>
          )}
        </div>
      ) : (
        /* TAB 2 & 3: ACTIVE & COMPLETED DISPATCHES */
        <>
          {/* MOBILE CARD VIEW (< 768px) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredDispatches.map((d) => {
              const isSelected = selectedIds.has(d.id);
              return (
                <div
                  key={d.id}
                  className={`card p-4 transition-all duration-150 relative ${
                    isSelected ? 'ring-2 ring-amber-500 bg-amber-50/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(d.id)}
                        className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <div>
                        <button
                          onClick={() => setDetail(d)}
                          className="font-mono font-bold text-slate-800 dark:text-slate-100 text-sm hover:text-amber-600 underline-offset-2 hover:underline"
                        >
                          {d.dispatch_no}
                        </button>
                        <p className="text-xs text-slate-400">
                          {new Date(d.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1">
                      <DispatchStatusBadge status={d.status} />
                      {d.mismatch_approval_status === 'pending' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                          <Mic size={11} className="animate-pulse text-amber-600" /> Mismatch Pending
                        </span>
                      )}
                      {d.mismatch_approval_status === 'approved' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                          <CheckCircle2 size={11} className="text-emerald-600" /> Mismatch Approved
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="py-2.5 space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{d.customer?.name ?? 'Unknown Customer'}</span>
                      {d.customer?.phone && (
                        <span className="text-xs text-slate-500">{d.customer.phone}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-lg px-2.5 py-2">
                      <div className="flex items-center gap-1.5">
                        <Truck size={14} className="text-amber-600 shrink-0" />
                        <span className="font-semibold">{d.vehicle_number || 'Vehicle not set'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <WaitClock timestamp={d.order?.confirmed_at || d.created_at} />
                      </div>
                    </div>

                    {d.delivery_address && (
                      <p className="text-xs text-slate-500 line-clamp-1 pt-0.5">
                        📍 {d.delivery_address}
                      </p>
                    )}

                    {d.mismatch_approval_status === 'pending' && user?.role === 'admin' && (
                      <div className="mt-2 p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg border border-indigo-200 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1">
                          <Mic size={13} className="text-indigo-600 animate-pulse" /> Voice Note Awaiting Review
                        </span>
                        <button
                          onClick={() => handleOpenApprovalModal(d)}
                          className="text-[11px] font-black text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded shadow"
                        >
                          Review Voice Note
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Touch Action Bar */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => setDetail(d)}
                      className="btn-secondary flex-1 py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Package size={14} /> Open Verification
                    </button>

                    {d.customer?.phone && (
                      <button
                        onClick={() => handleWhatsAppAlert(d)}
                        className="btn-ghost p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg"
                        title="Send WhatsApp Update"
                      >
                        <MessageSquare size={16} />
                      </button>
                    )}

                    <button
                      onClick={() => removeDispatch(d)}
                      className="btn-ghost p-2 text-rose-500 hover:bg-rose-50 rounded-lg"
                      title="Delete Dispatch"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP TABLE VIEW (>= 768px) */}
          <div className="hidden md:block table-wrap">
            <table className="w-full">
              <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/75 dark:bg-slate-800/75">
                <tr>
                  <th className="th w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredDispatches.length && filteredDispatches.length > 0}
                      onChange={() => toggleSelectAll(filteredDispatches)}
                      className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                  </th>
                  <th className="th">Dispatch No</th>
                  <th className="th">Customer</th>
                  <th className="th">Vehicle / Driver</th>
                  <th className="th">Status</th>
                  <th className="th">Time Elapsed</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDispatches.map((d) => {
                  const isSelected = selectedIds.has(d.id);
                  return (
                    <tr
                      key={d.id}
                      className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition ${isSelected ? 'bg-amber-50/30' : ''}`}
                    >
                      <td className="td">
                        <input
                           type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(d.id)}
                          className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>
                      <td className="td">
                        <button onClick={() => setDetail(d)} className="font-semibold text-slate-800 dark:text-slate-100 hover:underline">
                          {d.dispatch_no}
                        </button>
                      </td>
                      <td className="td font-medium">{d.customer?.name ?? 'Unknown'}</td>
                      <td className="td">
                        {d.vehicle_number || d.driver_name ? (
                          <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                            <Truck size={14} className="text-amber-600" /> {d.vehicle_number || ''} {d.driver_name ? `(${d.driver_name})` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not set</span>
                        )}
                      </td>
                      <td className="td">
                        <div className="flex flex-col gap-1 items-start">
                          <DispatchStatusBadge status={d.status} />
                          {d.mismatch_approval_status === 'pending' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                              <Mic size={10} className="animate-pulse text-amber-600" /> Mismatch Pending
                            </span>
                          )}
                          {d.mismatch_approval_status === 'approved' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                              <CheckCircle2 size={10} className="text-emerald-600" /> Mismatch Approved
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="td">
                        <WaitClock timestamp={d.order?.confirmed_at || d.created_at} />
                      </td>
                      <td className="td text-right">
                        <div className="flex justify-end items-center gap-1">
                          {user?.role === 'admin' && d.mismatch_approval_status === 'pending' && (
                            <button
                              onClick={() => handleOpenApprovalModal(d)}
                              className="btn-ghost px-2 py-1 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 font-bold text-xs flex items-center gap-1 rounded-md"
                              title="Review Dispatcher Voice Note"
                            >
                              <Mic size={13} /> Review Voice Note
                            </button>
                          )}
                          {d.customer?.phone && (
                            <button
                              onClick={() => handleWhatsAppAlert(d)}
                              className="btn-ghost p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                              title="Send WhatsApp Update"
                            >
                              <MessageSquare size={15} />
                            </button>
                          )}
                          <button onClick={() => setDetail(d)} className="btn-ghost p-1.5 text-blue-600 hover:bg-blue-50" title="Verify / View">
                            <Package size={15} />
                          </button>
                          <button onClick={() => removeDispatch(d)} className="btn-ghost p-1.5 text-rose-500 hover:bg-rose-50" title="Delete">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Floating Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in border border-slate-700">
              <span className="text-xs font-semibold">
                {selectedIds.size} {selectedIds.size === 1 ? 'dispatch' : 'dispatches'} selected
              </span>
              <button
                onClick={handleBulkDelete}
                className="btn-danger py-1 px-3 text-xs flex items-center gap-1 rounded-lg"
              >
                <Trash2 size={13} /> Delete Selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-slate-400 hover:text-white underline ml-1"
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}

      {/* Manual New Dispatch Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Dispatch" size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select a confirmed estimate to generate a dispatch list.
          </p>
          {confirmedOrders.length === 0 ? (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/30 p-4 text-sm text-amber-700 dark:text-amber-300">
              <AlertCircle size={16} className="mr-1 inline" />
              No fresh confirmed estimates available. Confirm an estimate first in the Estimate page.
            </div>
          ) : (
            <div>
              <label className="label">Fresh Confirmed Estimate * ({confirmedOrders.length} available)</label>
              <select value={selectedOrder} onChange={(e) => setSelectedOrder(e.target.value)} className="input">
                <option value="">Select a confirmed estimate...</option>
                {confirmedOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.order_no || o.id.split('-')[0].toUpperCase()} — {o.customer?.name ?? 'Unknown'}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={createDispatch} disabled={creating || !selectedOrder} className="btn-primary">
              {creating ? 'Creating...' : 'Start Dispatch'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Admin Weight Mismatch Approval Modal */}
      <WeightMismatchApprovalModal
        isOpen={approvalModalOpen}
        onClose={() => setApprovalModalOpen(false)}
        dispatch={selectedMismatchDispatch}
        onSuccess={load}
      />
    </div>
  );
}
