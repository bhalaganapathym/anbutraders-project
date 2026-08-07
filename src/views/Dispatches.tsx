import { useCallback, useEffect, useState } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import {
  api,
  type Customer,
  type Dispatch,
  type Order,
} from '@/lib/api';
import Modal from '@/components/Modal';
import DispatchStatusBadge from '@/components/DispatchStatusBadge';
import { useToast } from '@/components/Toast';
import {
  Plus, Search, Truck, Trash2, Package, AlertCircle
} from 'lucide-react';
import DispatchDashboard from './DispatchDashboard';

type DispatchRow = Dispatch & { customer: { name: string; phone: string | null } | null };
type ConfirmedOrder = Order & { customer: { name: string } | null };

export default function Dispatches() {
  const toast = useToast();
  const [dispatches, setDispatches] = useState<DispatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmedOrders, setConfirmedOrders] = useState<ConfirmedOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState('');
  const [creating, setCreating] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverMobile, setDriverMobile] = useState('');

  const [detail, setDetail] = useState<DispatchRow | null>(null);

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
      const data: ConfirmedOrder[] = await api.get('/orders');
      const confirmed = data.filter(o => o.status === 'confirmed');
      setConfirmedOrders(confirmed);
    } catch {
      toast('Failed to load confirmed orders', 'error');
    }
  }, [toast]);

  const openCreate = () => {
    loadConfirmedOrders();
    setSelectedOrder('');
    setCreateOpen(true);
  };

  const filtered = dispatches.filter((d) =>
    [d.dispatch_no, d.customer?.name ?? '', d.delivery_address ?? '', d.vehicle_number ?? ''].join(' ').toLowerCase().includes(query.toLowerCase())
  );

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

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search dispatches..."
          className="input pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <Truck size={36} className="text-slate-300" />
          <p className="text-slate-500 dark:text-slate-400">No dispatches yet.</p>
          <button onClick={openCreate} className="btn-primary">
            <Plus size={16} /> Create your first dispatch
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead className="border-b border-white/20 dark:border-slate-700/50 bg-white/20 dark:bg-slate-800/30">
              <tr>
                <th className="th">Dispatch No</th>
                <th className="th">Customer</th>
                <th className="th">Vehicle</th>
                <th className="th">Status</th>
                <th className="th">Created</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-white/20 dark:bg-slate-800/30">
                  <td className="td">
                    <button onClick={() => setDetail(d)} className="font-semibold text-indigo-700 dark:text-indigo-300 hover:underline">
                      {d.dispatch_no}
                    </button>
                  </td>
                  <td className="td">{d.customer?.name ?? 'Unknown'}</td>
                  <td className="td">
                    {d.vehicle_number ? (
                      <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
                        <Truck size={14} className="text-indigo-600 dark:text-indigo-400" /> {d.vehicle_number}
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 italic">Not set</span>
                    )}
                  </td>
                  <td className="td"><DispatchStatusBadge status={d.status} /></td>
                  <td className="td">{new Date(d.created_at).toLocaleDateString()}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Dispatch" size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select a confirmed customer order to generate a dispatch list.
          </p>
          {confirmedOrders.length === 0 ? (
            <div className="rounded-lg bg-indigo-50/50 dark:bg-indigo-900/30 p-4 text-sm text-indigo-700 dark:text-indigo-300">
              <AlertCircle size={16} className="mr-1 inline" />
              No confirmed orders available. Confirm an order first.
            </div>
          ) : (
            <div>
              <label className="label">Confirmed Order *</label>
              <select value={selectedOrder} onChange={(e) => setSelectedOrder(e.target.value)} className="input">
                <option value="">Select an order...</option>
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
