import { useState, useEffect } from 'react';
import { api, type Dispatch, type Driver } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { FileText, Search, CreditCard, User as UserIcon } from 'lucide-react';
import Modal from '@/components/Modal';
import { useRealtime } from '@/lib/useRealtime';

export default function Billing() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const [selectedDispatch, setSelectedDispatch] = useState<Dispatch | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('full payment done');
  const [creatingBill, setCreatingBill] = useState(false);
  
  const paymentMethods = [
    'full payment done',
    'partial payment done',
    'full payment on site',
    'partial payment on site',
    'credit'
  ];

  const loadData = async () => {
    try {
      const [dispData, driverData] = await Promise.all([
        api.get('/dispatches'),
        api.get('/drivers')
      ]);
      setDispatches(dispData.filter((d: Dispatch) => d.status === 'sent_to_billing'));
      setDrivers(driverData);
    } catch (err) {
      toast('Failed to load billing data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useRealtime('dispatches', loadData);

const handleCreateBill = async () => {
    if (!selectedDispatch) return;
    if (!selectedDriver) {
      toast('Please select a driver', 'error');
      return;
    }
    if (creatingBill) return;
    setCreatingBill(true);
    
    // Calculate total
    let totalAmount = 0;
    selectedDispatch.items?.forEach(item => {
      // If we have price and quantity, use it. If not, default 0
      totalAmount += (item.price || 0) * (item.quantity || 1);
    });

    try {
      await api.post('/bills', {
        dispatch_id: selectedDispatch.id,
        order_id: selectedDispatch.order_id,
        customer_id: selectedDispatch.customer_id,
        driver_id: selectedDriver || null,
        payment_method: paymentMethod,
        total_amount: totalAmount,
        pending_amount: paymentMethod.includes('partial') || paymentMethod.includes('credit') ? totalAmount : 0, // rough logic
      });
      toast('Bill created successfully. Sent back to dispatch!', 'success');
      setSelectedDispatch(null);
      loadData();
    } catch (err: any) {
      toast(err?.message || 'Failed to create bill', 'error');
    } finally {
      setCreatingBill(false);
    }
  };

  if (loading) return <div className="p-6">Loading billing...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Billing Team</h1>
        <p className="text-gray-500">Review dispatches and assign drivers for loading.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dispatches.map(dispatch => (
          <div key={dispatch.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded capitalize">
                  New Dispatch
                </span>
                <h3 className="font-bold text-lg mt-2">{dispatch.dispatch_no}</h3>
              </div>
              <FileText className="text-gray-400" />
            </div>
            
            <div className="space-y-2 text-sm text-gray-600 mb-4">
              <p><span className="font-medium text-gray-900">Customer:</span> {dispatch.customer?.name}</p>
              <p><span className="font-medium text-gray-900">Phone:</span> {dispatch.customer?.phone}</p>
              <p><span className="font-medium text-gray-900">Order Ref:</span> {dispatch.order?.order_no}</p>
            </div>
            
            <button
              onClick={() => setSelectedDispatch(dispatch)}
              className="w-full py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
            >
              Review & Bill
            </button>
          </div>
        ))}

        {dispatches.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
            No dispatches waiting for billing.
          </div>
        )}
      </div>

      <Modal open={!!selectedDispatch} onClose={() => setSelectedDispatch(null)} title="Generate Bill" size="lg">
        {selectedDispatch && (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg flex flex-wrap gap-4 justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Customer Name</p>
                <p className="font-medium">{selectedDispatch.customer?.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Phone Number</p>
                <p className="font-medium">{selectedDispatch.customer?.phone}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Order ID</p>
                <p className="font-medium">{selectedDispatch.order?.order_no}</p>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-3">Order Items</h3>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Item Name</th>
                      <th className="px-4 py-3 font-semibold text-right">No. of Items</th>
                      <th className="px-4 py-3 font-semibold text-right">Total Weight</th>
                      <th className="px-4 py-3 font-semibold text-right">Total Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedDispatch.items?.map((item, idx) => {
                      // Try to match the weight if any, assuming 1 weight per dispatch or match by product somehow.
                      // Since dispatch weights are recorded per dispatch generally, we'll just show the quantity.
                      return (
                        <tr key={item.id || idx}>
                          <td className="px-4 py-3">{item.product_name}</td>
                          <td className="px-4 py-3 text-right">{item.quantity} {item.unit}</td>
                          <td className="px-4 py-3 text-right text-gray-500">-</td>
                          <td className="px-4 py-3 text-right font-medium">₹{(item.price || 0) * item.quantity}</td>
                        </tr>
                      );
                    })}
                    {selectedDispatch.weights && selectedDispatch.weights.length > 0 && (
                      <tr className="bg-blue-50/50">
                        <td colSpan={2} className="px-4 py-3 font-medium text-blue-800">Recorded Weights:</td>
                        <td className="px-4 py-3 text-right font-bold text-blue-800">
                          {selectedDispatch.weights.reduce((sum, w) => sum + Number(w.actual_weight), 0)} kg
                        </td>
                        <td className="px-4 py-3"></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <UserIcon size={16} /> Assign Driver
                </label>
                <select
                  value={selectedDriver}
                  onChange={(e) => setSelectedDriver(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a driver...</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.vehicle_number || 'No Vehicle'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <CreditCard size={16} /> Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {paymentMethods.map(pm => (
                    <option key={pm} value={pm}>{pm.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setSelectedDispatch(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBill}
                disabled={creatingBill}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingBill ? 'Creating...' : 'Confirm & Send to Dispatch'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
