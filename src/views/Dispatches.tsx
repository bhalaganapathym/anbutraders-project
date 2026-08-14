import { useCallback, useEffect, useState } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import {
  api,
  type Dispatch,
  type Order,
} from '@/lib/api';
import DispatchStatusBadge from '@/components/DispatchStatusBadge';
import { useToast } from '@/components/Toast';
import {
  Plus, Search, Truck, Trash2, Package, AlertCircle, Clock
} from 'lucide-react';
import Modal from '@/components/Modal';
import DispatchDashboard from './DispatchDashboard';

type DispatchRow = Dispatch & { customer: { name: string; phone: string | null } | null; order?: { confirmed_at?: string } };
type ConfirmedOrder = Order & { customer: { name: string } | null };

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
  const toast = useToast();
  const [dispatches, setDispatches] = useState<DispatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmedOrders, setConfirmedOrders] = useState<ConfirmedOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState('');
  const [creating, setCreating] = useState(false);

  const [detail, setDetail] = useState<DispatchRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (items: DispatchRow[]) => {
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
      const data = await api.get('/dispatches');
      setDispatches(data as DispatchRow[]);
    } catch {
      toast('Failed to load dispatches', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime('dispatches', load);

  const loadConfirmedOrders = useCallback(async () => {
    try {
      const [allOrders, allDispatches]: [ConfirmedOrder[], DispatchRow[]] = await Promise.all([
        api.get('/orders'),
        api.get('/dispatches')
      ]);
      const existingDispatchOrderIds = new Set(allDispatches.map(d => d.order_id));
      const freshConfirmed = allOrders.filter(o => o.status === 'confirmed' && !existingDispatchOrderIds.has(o.id));
      setConfirmedOrders(freshConfirmed);
    } catch {
      toast('Failed to load confirmed orders', 'error');
    }
  }, [toast]);

  const openCreate = () => {
    loadConfirmedOrders();
    setSelectedOrder('');
    setCreateOpen(true);
  };

  const filtered = dispatches.filter((d) => {
    const isCompleted = d.status === 'completed';
    const matchesTab = activeTab === 'completed' ? isCompleted : !isCompleted;
    const matchesQuery = [d.dispatch_no, d.customer?.name ?? '', d.delivery_address ?? '', d.vehicle_number ?? ''].join(' ').toLowerCase().includes(query.toLowerCase());
    return matchesTab && matchesQuery;
  });

  const createDispatch = async () => {
    if (!selectedOrder) {
      toast('Select a confirmed order', 'error');
      return;
    }
    setCreating(true);
    try {
      const order = confirmedOrders.find((o) => o.id === selectedOrder);
      if (!order) throw new Error();
      
      const orderItems = order.items || [];
      if (orderItems.length === 0) {
        toast('This order has no products', 'error');
        setCreating(false);
        return;
      }
      const num = dispatches.length + 1;
      const dispatchNo = `DSP-${String(num).padStart(4, '0')}`;
      
      const payload = {
        dispatch_no: dispatchNo,
        order_id: selectedOrder,
        customer_id: order.customer_id,
        delivery_address: order.delivery_address,
        status: 'pending',
        items: orderItems.map((it) => ({
          product_id: it.product_id,
          product_name: it.product?.name ?? 'Unknown',
          quantity: it.quantity,
          unit: it.product?.unit ?? 'piece',
          price: Number(it.product?.price ?? 0),
        }))
      };
      
      await api.post('/dispatches', payload);
      toast('Dispatch list created', 'success');
      setCreateOpen(false);
      load();
    } catch {
      toast('Failed to create dispatch', 'error');
    }
    setCreating(false);
  };

  const removeDispatch = async (d: DispatchRow) => {
    if (!confirm(`Delete dispatch ${d.dispatch_no}?`)) return;
    try {
      await api.delete(`/dispatches/${d.id}`);
      toast('Dispatch deleted', 'success');
      load();
    } catch {
      toast('Failed to delete dispatch', 'error');
    }
  };

  if (detail) {
    return <DispatchDashboard detail={detail} onClose={() => setDetail(null)} onRefresh={load} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Dispatches</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Weight verification, photos, vehicle loading and completion</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={16} /> Create Dispatch
        </button>
      </div>

      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700">
        <button 
          className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'active' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
          onClick={() => setActiveTab('active')}
        >
          Active Dispatches ({dispatches.filter(d => d.status !== 'completed').length})
        </button>
        <button 
          className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'completed' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed Tab ({dispatches.filter(d => d.status === 'completed').length})
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dispatches or vehicle..."
            className="input pl-9"
          />
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleSelectAll(filtered)}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              {selectedIds.size === filtered.length ? 'Deselect All' : `Select All (${filtered.length})`}
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
        <p className="text-sm text-slate-400">Loading...</p>
      ) : filtered.length === 0 ? (
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
        <>
          {/* MOBILE CARD VIEW (< 768px) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filtered.map((d) => {
              const isSelected = selectedIds.has(d.id);
              return (
                <div
                  key={d.id}
                  className={`card p-4 transition-all duration-150 relative ${
                    isSelected ? 'ring-2 ring-amber-500 bg-amber-50/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
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
                          className="font-mono font-bold text-slate-800 text-sm hover:text-amber-600 underline-offset-2 hover:underline"
                        >
                          {d.dispatch_no}
                        </button>
                        <p className="text-xs text-slate-400">
                          {new Date(d.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <DispatchStatusBadge status={d.status} />
                    </div>
                  </div>

                  <div className="py-2.5 space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{d.customer?.name ?? 'Unknown Customer'}</span>
                      {d.customer?.phone && (
                        <span className="text-xs text-slate-500">{d.customer.phone}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 text-slate-600 bg-slate-50 rounded-lg px-2.5 py-2">
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
                  </div>

                  {/* Touch Action Bar */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setDetail(d)}
                      className="btn-secondary flex-1 py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Package size={14} /> Open Verification
                    </button>

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
              <thead className="border-b border-slate-200 bg-slate-50/75">
                <tr>
                  <th className="th w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={() => toggleSelectAll(filtered)}
                      className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                  </th>
                  <th className="th">Dispatch No</th>
                  <th className="th">Customer</th>
                  <th className="th">Vehicle</th>
                  <th className="th">Status</th>
                  <th className="th">Time Elapsed</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((d) => {
                  const isSelected = selectedIds.has(d.id);
                  return (
                    <tr
                      key={d.id}
                      className={`hover:bg-slate-50/60 transition ${isSelected ? 'bg-amber-50/30' : ''}`}
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
                        <button onClick={() => setDetail(d)} className="font-semibold text-slate-800 hover:underline">
                          {d.dispatch_no}
                        </button>
                      </td>
                      <td className="td">{d.customer?.name ?? 'Unknown'}</td>
                      <td className="td">
                        {d.vehicle_number ? (
                          <span className="flex items-center gap-1 font-semibold text-slate-700">
                            <Truck size={14} className="text-amber-600" /> {d.vehicle_number}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not set</span>
                        )}
                      </td>
                      <td className="td"><DispatchStatusBadge status={d.status} /></td>
                      <td className="td">
                        <WaitClock timestamp={d.order?.confirmed_at || d.created_at} />
                      </td>
                      <td className="td text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setDetail(d)} className="btn-ghost p-1.5" title="Verify / Complete">
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Dispatch" size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select a fresh pending confirmed estimate to generate a dispatch list.
          </p>
          {confirmedOrders.length === 0 ? (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/30 p-4 text-sm text-amber-700 dark:text-amber-300">
              <AlertCircle size={16} className="mr-1 inline" />
              No fresh confirmed estimates available. Confirm an estimate first or check if a dispatch already exists.
            </div>
          ) : (
            <div>
              <label className="label">Fresh Confirmed Estimate * ({confirmedOrders.length} available)</label>
              <select value={selectedOrder} onChange={(e) => setSelectedOrder(e.target.value)} className="input">
                <option value="">Select a fresh estimate...</option>
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
              {creating ? 'Creating...' : 'Create Dispatch'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
