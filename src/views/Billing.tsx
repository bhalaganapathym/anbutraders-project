import { useState, useEffect, useRef, useCallback } from 'react';
import { api, type Dispatch, type Driver, type Customer } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { FileText, Download, CreditCard, IndianRupee, AlertCircle, MessageSquare, Clock, Bell, CheckCircle2, User, MapPin, Phone, Truck } from 'lucide-react';
import Modal from '@/components/Modal';
import { useRealtime } from '@/lib/useRealtime';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { openWhatsApp, shareWhatsAppWithMedia, buildDispatchWhatsAppMessage, DEFAULT_COMPANY_IMAGE_URL } from '@/lib/whatsapp';
import { useTranslation } from '@/lib/i18n';

function numberToWords(num: number): string {
  if (num === 0) return 'INR Zero Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '');
  };
  const intPart = Math.floor(num);
  return `INR ${inWords(intPart)} Only`;
}

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

export default function Billing() {
  const { t } = useTranslation();
  const [allDispatches, setAllDispatches] = useState<Dispatch[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const toast = useToast();

  const [selectedDispatch, setSelectedDispatch] = useState<Dispatch | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('full payment done');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [toCollectAmount, setToCollectAmount] = useState<string>('');
  const [creatingBill, setCreatingBill] = useState(false);
  const [notifyingDispatch, setNotifyingDispatch] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  
  const paymentMethods = [
    'full payment done',
    'partial payment done',
    'full payment on site',
    'partial payment on site',
    'credit'
  ];

  const loadData = useCallback(async () => {
    try {
      const [dispData, driverData, custData] = await Promise.all([
        api.get('/dispatches'),
        api.get('/drivers'),
        api.get('/customers')
      ]);
      setAllDispatches(dispData as Dispatch[]);
      setDrivers(driverData);
      setCustomers(custData);
    } catch {
      toast('Failed to load billing data', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtime('dispatches', loadData);
  useRealtime('bills', loadData);

  const pendingBills = allDispatches.filter((d: Dispatch) => d.status === 'sent_to_billing');
  const completedBills = allDispatches.filter((d: Dispatch) => d.status === 'ready_for_loading' || d.status === 'completed' || !!d.bill);

  const selectedCustomer = customers.find(c => c.id === selectedDispatch?.customer_id);

  // Auto-calculate amounts when selectedDispatch or paymentMethod changes
  useEffect(() => {
    if (!selectedDispatch) return;
    const total = selectedDispatch.items?.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0) || 0;
    
    if (paymentMethod === 'full payment done') {
      setPaidAmount(String(total));
      setToCollectAmount('0');
    } else if (paymentMethod === 'full payment on site' || paymentMethod === 'credit') {
      setPaidAmount('0');
      setToCollectAmount(String(total));
    } else if (paymentMethod.includes('partial')) {
      const currentPaid = Number(paidAmount) || 0;
      if (currentPaid > 0 && currentPaid < total) {
        setToCollectAmount(String(Math.max(0, total - currentPaid)));
      } else {
        setPaidAmount('0');
        setToCollectAmount(String(total));
      }
    }
  }, [selectedDispatch, paymentMethod]);

  const handlePaidAmountChange = (val: string) => {
    setPaidAmount(val);
    const total = selectedDispatch?.items?.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0) || 0;
    const p = parseFloat(val) || 0;
    const remaining = Math.max(0, total - p);
    setToCollectAmount(String(remaining));
  };

  const handleToCollectAmountChange = (val: string) => {
    setToCollectAmount(val);
    const total = selectedDispatch?.items?.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0) || 0;
    const toCol = parseFloat(val) || 0;
    const p = Math.max(0, total - toCol);
    setPaidAmount(String(p));
  };

  const sendDispatchNotification = async (disp: Dispatch) => {
    const cust = customers.find(c => c.id === disp.customer_id) || disp.customer;
    const custName = cust?.name || 'Customer';
    const custPhone = cust?.phone || 'Not provided';
    const deliveryAddr = disp.delivery_address || cust?.address || 'Site Delivery';

    await api.post('/notifications', {
      type: 'bill_generated',
      title: `Bill Generated - ${disp.dispatch_no}`,
      message: `Bill generated for ${custName}. Phone: ${custPhone}. Address: ${deliveryAddr}. Assigned Vehicle: ${disp.vehicle_number || 'N/A'}. Ready for loading.`,
      dispatch_id: disp.id,
      order_id: disp.order_id,
      customer_name: custName,
    });
  };

  const handleNotifyDispatchTeam = async (disp: Dispatch) => {
    setNotifyingDispatch(true);
    try {
      await sendDispatchNotification(disp);
      toast('Dispatch team notified successfully with customer details', 'success');
    } catch {
      toast('Failed to notify dispatch team', 'error');
    } finally {
      setNotifyingDispatch(false);
    }
  };

  const handleCreateBill = async () => {
    if (!selectedDispatch) return;
    if (creatingBill) return;
    setCreatingBill(true);
    
    let totalAmount = 0;
    selectedDispatch.items?.forEach(item => {
      totalAmount += (item.price || 0) * (item.quantity || 1);
    });

    const paidVal = parseFloat(paidAmount) || 0;
    const toCollectVal = parseFloat(toCollectAmount) || 0;

    try {
      await api.post('/bills', {
        dispatch_id: selectedDispatch.id,
        order_id: selectedDispatch.order_id,
        customer_id: selectedDispatch.customer_id,
        driver_id: null,
        payment_method: paymentMethod,
        total_amount: totalAmount,
        paid_amount: paidVal,
        pending_amount: toCollectVal,
      });

      // Notify dispatch team automatically with customer name, phone, address
      await sendDispatchNotification(selectedDispatch);

      toast('Bill generated & dispatch team notified with customer details!', 'success');
      setSelectedDispatch(null);
      loadData();
    } catch (err: any) {
      toast(err?.message || 'Failed to create bill', 'error');
    } finally {
      setCreatingBill(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setDownloadingPdf(true);
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Estimate_${selectedDispatch?.dispatch_no || 'Bill'}.pdf`);
      toast('PDF downloaded', 'success');
    } catch {
      toast('Failed to generate PDF', 'error');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const [downloadingImage, setDownloadingImage] = useState(false);

  const handleDownloadInvoiceImage = async () => {
    if (!printRef.current) return;
    setDownloadingImage(true);
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `Estimate_${selectedDispatch?.dispatch_no || 'Bill'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast('Invoice image downloaded', 'success');
    } catch {
      toast('Failed to download invoice image', 'error');
    } finally {
      setDownloadingImage(false);
    }
  };

  const handleWhatsAppAlert = async () => {
    if (!selectedDispatch) return;
    const customer = customers.find(c => c.id === selectedDispatch.customer_id) || selectedDispatch.customer;
    const phone = customer?.phone || '';
    if (!phone) {
      toast('Customer phone number not found', 'error');
      return;
    }
    const billData = {
      total_amount: (parseFloat(paidAmount) || 0) + (parseFloat(toCollectAmount) || 0),
      paid_amount: parseFloat(paidAmount) || 0,
      pending_amount: parseFloat(toCollectAmount) || 0,
    } as any;
    const msg = buildDispatchWhatsAppMessage(selectedDispatch, undefined, customer, billData);

    // Try copying invoice image to clipboard so user can press Ctrl+V to attach photo
    if (printRef.current) {
      try {
        const canvas = await html2canvas(printRef.current, { scale: 2 });
        canvas.toBlob(async (blob) => {
          if (blob && navigator.clipboard && (window as any).ClipboardItem) {
            await navigator.clipboard.write([
              new (window as any).ClipboardItem({ 'image/png': blob })
            ]);
            toast('WhatsApp opened! Invoice image copied to clipboard — press Paste (Ctrl+V) in chat.', 'success');
          }
        }, 'image/png');
      } catch (e) {
        console.warn('Canvas render error', e);
      }
    }

    openWhatsApp(phone, msg);
  };

  if (loading) return <div className="p-6">Loading billing...</div>;

  let totalAmount = 0;
  selectedDispatch?.items?.forEach(item => {
    totalAmount += (item.price || 0) * (item.quantity || 1);
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t('billing_title')}</h1>
          <p className="text-slate-500 dark:text-slate-400">{t('company_tagline')}</p>
        </div>
      </div>

      {/* Two Panes Navigation */}
      <div className="flex gap-4 sm:gap-6 border-b border-slate-200 dark:border-slate-700">
        <button 
          className={`pb-2.5 px-2 border-b-2 font-bold text-sm transition-colors flex items-center gap-2 ${
            activeTab === 'pending' 
              ? 'border-amber-500 text-amber-600 dark:text-amber-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
          onClick={() => setActiveTab('pending')}
        >
          <span>Pending Bills</span>
          <span className="badge bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-xs">
            {pendingBills.length}
          </span>
        </button>

        <button 
          className={`pb-2.5 px-2 border-b-2 font-bold text-sm transition-colors flex items-center gap-2 ${
            activeTab === 'completed' 
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
          onClick={() => setActiveTab('completed')}
        >
          <span>Completed Bills</span>
          <span className="badge bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs">
            {completedBills.length}
          </span>
        </button>
      </div>

      {/* Grid of Bills */}
      {activeTab === 'pending' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pendingBills.map(dispatch => {
            const billTotal = dispatch.items?.reduce((s, it) => s + (it.price || 0) * (it.quantity || 1), 0) || 0;
            return (
              <div key={dispatch.id} className="card p-5 transition hover:shadow-md border-2 border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-white to-amber-50/20 dark:from-slate-900 dark:to-amber-950/10">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-extrabold uppercase text-xs">
                      Ready for Billing
                    </span>
                    <h3 className="font-mono font-bold text-lg mt-1 text-slate-800 dark:text-slate-100">{dispatch.dispatch_no}</h3>
                  </div>
                  <WaitClock timestamp={dispatch.sent_to_billing_at || dispatch.created_at} />
                </div>
                
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300 py-3 border-y border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <User size={15} className="text-amber-600 shrink-0" />
                    <span className="font-bold text-slate-800 dark:text-slate-100">{dispatch.customer?.name}</span>
                  </div>
                  {dispatch.customer?.phone && (
                    <p className="text-xs text-slate-500 pl-6">📞 {dispatch.customer?.phone}</p>
                  )}
                  {dispatch.delivery_address && (
                    <p className="text-xs text-slate-500 pl-6 line-clamp-1">📍 {dispatch.delivery_address}</p>
                  )}
                  {dispatch.driver_name && (
                    <div className="text-xs text-slate-600 dark:text-slate-400 pl-6 flex items-center gap-1 font-medium">
                      <Truck size={13} className="text-amber-600" /> Driver: {dispatch.driver_name} ({dispatch.vehicle_number || 'Vehicle not set'})
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center my-3 text-sm font-bold">
                  <span className="text-slate-500">Bill Value:</span>
                  <span className="text-xl font-black text-blue-600 dark:text-blue-400">₹{billTotal.toLocaleString('en-IN')}</span>
                </div>
                
                <button
                  onClick={() => setSelectedDispatch(dispatch)}
                  className="btn-primary w-full bg-blue-600 hover:bg-blue-700 font-bold py-2.5 shadow-sm"
                >
                  Generate Bill & Settle
                </button>
              </div>
            );
          })}

          {pendingBills.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-500 card">
              <FileText size={40} className="mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">No dispatches waiting for billing.</p>
              <p className="text-xs text-slate-400 mt-1">Dispatches sent from the verification step will appear here with live wait times.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {completedBills.map(dispatch => {
            const billTotal = dispatch.bill?.total_amount ?? (dispatch.items?.reduce((s, it) => s + (it.price || 0) * (it.quantity || 1), 0) || 0);
            return (
              <div key={dispatch.id} className="card p-5 transition hover:shadow-md border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-slate-900">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold uppercase text-xs">
                      {dispatch.status === 'completed' ? 'Delivered & Billed' : 'Bill Generated'}
                    </span>
                    <h3 className="font-mono font-bold text-lg mt-1 text-slate-800 dark:text-slate-100">{dispatch.dispatch_no}</h3>
                  </div>
                  <WaitClock timestamp={dispatch.ready_for_loading_at || dispatch.created_at} />
                </div>
                
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300 py-3 border-y border-slate-100 dark:border-slate-800">
                  <p><span className="font-medium text-slate-900 dark:text-slate-100">Customer:</span> {dispatch.customer?.name}</p>
                  <p><span className="font-medium text-slate-900 dark:text-slate-100">Phone:</span> {dispatch.customer?.phone}</p>
                  <p><span className="font-medium text-slate-900 dark:text-slate-100">Total Billed:</span> <strong className="text-emerald-600">₹{billTotal.toLocaleString('en-IN')}</strong></p>
                  {dispatch.bill && (
                    <div className="text-xs space-y-0.5 text-slate-500 pt-1">
                      <p>Paid: ₹{Number(dispatch.bill.paid_amount || 0).toLocaleString('en-IN')} • To Collect: ₹{Number(dispatch.bill.pending_amount || 0).toLocaleString('en-IN')}</p>
                      <p>Mode: <span className="font-semibold uppercase text-slate-700 dark:text-slate-300">{dispatch.bill.payment_method}</span></p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setSelectedDispatch(dispatch)}
                    className="btn-secondary flex-1 text-xs py-2"
                  >
                    View / Print
                  </button>
                  <button
                    onClick={() => handleNotifyDispatchTeam(dispatch)}
                    disabled={notifyingDispatch}
                    className="btn-primary text-xs py-2 flex items-center gap-1 bg-amber-600 hover:bg-amber-700"
                    title="Send alert to Dispatch team with customer name, phone, address"
                  >
                    <Bell size={13} /> Notify Dispatch
                  </button>
                </div>
              </div>
            );
          })}

          {completedBills.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-500 card">
              <CheckCircle2 size={40} className="mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">No completed bills yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Generate / View Bill Modal */}
      <Modal open={!!selectedDispatch} onClose={() => setSelectedDispatch(null)} title="Generate Bill / Estimate" size="lg">
        {selectedDispatch && (
          <div className="space-y-6">
            
            {/* Prominent Total Bill Display at the Top (Bold & Big) */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-blue-100">Total Bill Amount</span>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-0.5">
                  ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
              </div>
              <div className="text-right">
                <span className="badge bg-white/20 text-white text-xs font-bold uppercase">{selectedDispatch.dispatch_no}</span>
                <p className="text-sm font-semibold text-blue-100 mt-1">{selectedDispatch.customer?.name}</p>
              </div>
            </div>

            {/* Customer & Dispatch Details Card */}
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg flex flex-wrap gap-4 justify-between border border-slate-200 dark:border-slate-700 text-sm">
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Customer Name</p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{selectedDispatch.customer?.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Phone Number</p>
                <p className="font-medium text-slate-800 dark:text-slate-100">{selectedDispatch.customer?.phone || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Pending Ledger Dues</p>
                <p className="font-bold text-amber-600">₹{Number(selectedCustomer?.pending_amount || 0).toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Assigned Transport</p>
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {selectedDispatch.vehicle_number ? `${selectedDispatch.vehicle_number} (${selectedDispatch.driver_name || 'Driver'})` : 'Assigned in Dispatch'}
                </p>
              </div>
            </div>

            {/* Order Items Table */}
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3">Order Items</h3>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Item Name</th>
                      <th className="px-4 py-3 font-semibold text-right">No. of Items</th>
                      <th className="px-4 py-3 font-semibold text-right">Recorded Weight</th>
                      <th className="px-4 py-3 font-semibold text-right">Total Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedDispatch.items?.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{item.product_name}</td>
                        <td className="px-4 py-3 text-right">{item.quantity} {item.unit}</td>
                        <td className="px-4 py-3 text-right text-slate-500">
                          {selectedDispatch.weights?.find(w => w.notes?.includes(item.product_name))?.actual_weight 
                            ? `${selectedDispatch.weights.find(w => w.notes?.includes(item.product_name))?.actual_weight} kg` 
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">₹{((item.price || 0) * item.quantity).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <CreditCard size={16} /> Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="input font-semibold"
              >
                {paymentMethods.map(pm => (
                  <option key={pm} value={pm}>{pm.toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* Payment Details / Amount Paid & To Collect Breakdown */}
            <div className="bg-amber-50/50 dark:bg-slate-900 border border-amber-200/80 dark:border-slate-700 p-4 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <IndianRupee size={14} className="text-amber-600" />
                  Payment & Collection Breakdown
                </span>
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  Total Bill: ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Amount Paid / Advance Received (₹)
                  </label>
                  <div className="relative">
                    <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => handlePaidAmountChange(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="any"
                      className="input pl-8 font-bold text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Amount received by cashier / advance</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-rose-500"></span> Amount to Collect on Site / Balance (₹)
                  </label>
                  <div className="relative">
                    <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      value={toCollectAmount}
                      onChange={(e) => handleToCollectAmountChange(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="any"
                      className="input pl-8 font-bold text-rose-700 dark:text-rose-400 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Amount driver must collect upon delivery</p>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap justify-between items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleDownloadPDF}
                  disabled={downloadingPdf}
                  className="btn-secondary flex items-center gap-1.5 text-xs"
                >
                  <Download size={15} /> {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadInvoiceImage}
                  disabled={downloadingImage}
                  className="btn-secondary text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 text-xs font-semibold"
                  title="Download invoice as photo image"
                >
                  <Download size={15} /> {downloadingImage ? 'Generating Image...' : 'Download Image'}
                </button>
                <button
                  type="button"
                  onClick={handleWhatsAppAlert}
                  className="btn-secondary text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 flex items-center gap-1.5 text-xs font-bold"
                >
                  <MessageSquare size={15} /> WhatsApp Alert
                </button>
                <button
                  type="button"
                  onClick={() => handleNotifyDispatchTeam(selectedDispatch)}
                  disabled={notifyingDispatch}
                  className="btn-secondary text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 hover:bg-amber-100 flex items-center gap-1.5 text-xs font-bold"
                  title="Notify dispatch team of customer name, phone, address"
                >
                  <Bell size={15} /> {notifyingDispatch ? 'Notifying...' : 'Notify Dispatch'}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedDispatch(null)}
                  className="btn-secondary text-xs"
                >
                  Close
                </button>
                {selectedDispatch.status === 'sent_to_billing' && (
                  <button
                    onClick={handleCreateBill}
                    disabled={creatingBill}
                    className="btn-primary bg-blue-600 hover:bg-blue-700 text-xs font-bold"
                  >
                    {creatingBill ? 'Confirming...' : 'Confirm & Send to Dispatch'}
                  </button>
                )}
              </div>
            </div>

            {/* Hidden Printable Bill Element matching Anbu Groups photo */}
            <div className="fixed top-[-9999px] left-[-9999px]">
              <div ref={printRef} className="w-[794px] bg-white text-black p-8 text-xs font-sans border border-black space-y-4">
                <div className="flex justify-between items-start border-b border-black pb-2">
                  <div>
                    <h1 className="text-xl font-extrabold tracking-wide">ANBU GROUPS</h1>
                    <p className="text-[11px]">No.4/5 Pondy Mailam Road T.C Kootroad</p>
                    <p className="text-[11px]">Vanur T.K 605 111 | Ph: 0413-2964204, 9626325204</p>
                    <p className="text-[11px]">State Name : Tamil Nadu, Code : 33</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-lg font-bold border border-black px-2 py-0.5 inline-block">ESTIMATE</h2>
                    <p className="text-[10px] italic mt-1">(TRIPLICATE FOR SUPPLIER)</p>
                    <p className="text-[11px] mt-2"><strong>Invoice No:</strong> {selectedDispatch.dispatch_no}</p>
                    <p className="text-[11px]"><strong>Date:</strong> {new Date().toLocaleDateString('en-IN')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-b border-black pb-3 text-[11px]">
                  <div>
                    <p className="font-bold border-b border-gray-300 pb-1 mb-1">Consignee (Ship to)</p>
                    <p className="font-bold text-sm">{selectedDispatch.customer?.name}</p>
                    <p>{selectedDispatch.delivery_address || selectedDispatch.customer?.address}</p>
                    <p>Ph: {selectedDispatch.customer?.phone}</p>
                  </div>
                  <div>
                    <p className="font-bold border-b border-gray-300 pb-1 mb-1">Buyer (Bill to)</p>
                    <p className="font-bold text-sm">{selectedDispatch.customer?.name}</p>
                    <p>{selectedDispatch.customer?.address || selectedDispatch.delivery_address}</p>
                    <p>Ph: {selectedDispatch.customer?.phone}</p>
                  </div>
                </div>

                <table className="w-full border-collapse border border-black text-[11px]">
                  <thead>
                    <tr className="bg-gray-100 border-b border-black">
                      <th className="border border-black p-1 text-center">SI</th>
                      <th className="border border-black p-1 text-left">Description of Goods</th>
                      <th className="border border-black p-1 text-center">Nos / Quantity</th>
                      <th className="border border-black p-1 text-right">Rate</th>
                      <th className="border border-black p-1 text-center">per</th>
                      <th className="border border-black p-1 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDispatch.items?.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td className="border border-black p-1 text-center">{idx + 1}</td>
                        <td className="border border-black p-1 font-bold">{it.product_name}</td>
                        <td className="border border-black p-1 text-center">{it.quantity}</td>
                        <td className="border border-black p-1 text-right">{(it.price || 0).toFixed(2)}</td>
                        <td className="border border-black p-1 text-center">{it.unit}</td>
                        <td className="border border-black p-1 text-right font-bold">{((it.price || 0) * it.quantity).toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold border-t border-black bg-gray-50">
                      <td colSpan={5} className="border border-black p-1 text-right">Total</td>
                      <td className="border border-black p-1 text-right">₹{totalAmount.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="space-y-1 pt-1 text-[11px]">
                  <p><strong>Amount Chargeable (in words):</strong> {numberToWords(totalAmount)}</p>

                  <div className="grid grid-cols-3 gap-2 border border-black p-2 my-2 bg-gray-50 text-[11px]">
                    <div>
                      <p className="text-[10px] text-gray-600">Total Invoice Amount</p>
                      <p className="font-bold text-sm">₹{totalAmount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-600">Amount Paid / Received</p>
                      <p className="font-bold text-sm text-green-800">₹{(parseFloat(paidAmount) || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-600">Balance to Collect on Site</p>
                      <p className="font-bold text-sm text-red-800">₹{(parseFloat(toCollectAmount) || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  <p className="text-amber-800 font-bold"><strong>Customer Prior Pending Dues:</strong> ₹{Number(selectedCustomer?.pending_amount || 0).toLocaleString('en-IN')}</p>
                  <p><strong>Payment Mode:</strong> {paymentMethod.toUpperCase()}</p>
                  {selectedDispatch.vehicle_number && (
                    <p><strong>Transport:</strong> Vehicle {selectedDispatch.vehicle_number} {selectedDispatch.driver_name ? `(${selectedDispatch.driver_name})` : ''}</p>
                  )}
                </div>

                <div className="border-t border-black pt-4 flex justify-between items-end text-[10px]">
                  <div>
                    <p>Declaration:</p>
                    <p className="italic">We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
                    <p className="mt-2 font-bold">This is a Computer Generated Invoice</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-xs">for ANBU GROUPS</p>
                    <div className="h-10"></div>
                    <p className="font-bold">Authorised Signatory</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
