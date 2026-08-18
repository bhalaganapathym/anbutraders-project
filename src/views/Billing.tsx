import { useState, useEffect, useRef } from 'react';
import { api, type Dispatch, type Driver, type Customer } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { FileText, Download, CreditCard, User as UserIcon, IndianRupee, AlertCircle, MessageSquare } from 'lucide-react';
import Modal from '@/components/Modal';
import { useRealtime } from '@/lib/useRealtime';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { openWhatsApp, buildDispatchWhatsAppMessage } from '@/lib/whatsapp';
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

export default function Billing() {
  const { t } = useTranslation();
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const [selectedDispatch, setSelectedDispatch] = useState<Dispatch | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('full payment done');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [toCollectAmount, setToCollectAmount] = useState<string>('');
  const [creatingBill, setCreatingBill] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  
  const paymentMethods = [
    'full payment done',
    'partial payment done',
    'full payment on site',
    'partial payment on site',
    'credit'
  ];

  const loadData = async () => {
    try {
      const [dispData, driverData, custData] = await Promise.all([
        api.get('/dispatches'),
        api.get('/drivers'),
        api.get('/customers')
      ]);
      setDispatches(dispData.filter((d: Dispatch) => d.status === 'sent_to_billing'));
      setDrivers(driverData);
      setCustomers(custData);
    } catch {
      toast('Failed to load billing data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useRealtime('dispatches', loadData);

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
      // Partial payment default (if empty or previously equal to total)
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

  const handleCreateBill = async () => {
    if (!selectedDispatch) return;
    if (!selectedDriver) {
      toast('Please select a driver', 'error');
      return;
    }
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
        driver_id: selectedDriver || null,
        payment_method: paymentMethod,
        total_amount: totalAmount,
        paid_amount: paidVal,
        pending_amount: toCollectVal,
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

  const handleWhatsAppAlert = () => {
    if (!selectedDispatch) return;
    const customer = customers.find(c => c.id === selectedDispatch.customer_id) || selectedDispatch.customer;
    const phone = customer?.phone || '';
    if (!phone) {
      toast('Customer phone number not found', 'error');
      return;
    }
    const driver = drivers.find(d => d.id === selectedDriver);
    const dispatchWithDriver = {
      ...selectedDispatch,
      driver_name: driver?.name || selectedDispatch.driver_name,
      driver_mobile: driver?.phone_number || selectedDispatch.driver_mobile,
      vehicle_number: driver?.vehicle_number || selectedDispatch.vehicle_number,
    };
    const billData = {
      total_amount: (parseFloat(paidAmount) || 0) + (parseFloat(toCollectAmount) || 0),
      paid_amount: parseFloat(paidAmount) || 0,
      pending_amount: parseFloat(toCollectAmount) || 0,
    } as any;
    const msg = buildDispatchWhatsAppMessage(dispatchWithDriver, undefined, customer, billData);
    openWhatsApp(phone, msg);
  };

  if (loading) return <div className="p-6">Loading billing...</div>;

  let totalAmount = 0;
  selectedDispatch?.items?.forEach(item => {
    totalAmount += (item.price || 0) * (item.quantity || 1);
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t('billing_title')}</h1>
        <p className="text-slate-500 dark:text-slate-400">{t('company_tagline')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dispatches.map(dispatch => (
          <div key={dispatch.id} className="card p-5 transition hover:shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="badge bg-blue-100 text-blue-800 font-bold uppercase">
                  {t('new_dispatch')}
                </span>
                <h3 className="font-bold text-lg mt-2 text-slate-800 dark:text-slate-100">{dispatch.dispatch_no}</h3>
              </div>
              <FileText className="text-slate-400" />
            </div>
            
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300 mb-4">
              <p><span className="font-medium text-slate-900 dark:text-slate-100">{t('customer_name')}:</span> {dispatch.customer?.name}</p>
              <p><span className="font-medium text-slate-900 dark:text-slate-100">{t('customer_phone')}:</span> {dispatch.customer?.phone}</p>
              <p><span className="font-medium text-slate-900 dark:text-slate-100">{t('order_no')}:</span> {dispatch.order?.order_no}</p>
            </div>
            
            <button
              onClick={() => setSelectedDispatch(dispatch)}
              className="btn-primary w-full"
            >
              {t('record_payment')}
            </button>
          </div>
        ))}

        {dispatches.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 card">
            No dispatches waiting for billing.
          </div>
        )}
      </div>

      <Modal open={!!selectedDispatch} onClose={() => setSelectedDispatch(null)} title="Generate Bill / Estimate" size="lg">
        {selectedDispatch && (
          <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg flex flex-wrap gap-4 justify-between border border-slate-200 dark:border-slate-700">
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Customer Name</p>
                <p className="font-medium text-slate-800 dark:text-slate-100">{selectedDispatch.customer?.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Phone Number</p>
                <p className="font-medium text-slate-800 dark:text-slate-100">{selectedDispatch.customer?.phone}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Customer Pending Dues</p>
                <p className="font-bold text-amber-600">₹{Number(selectedCustomer?.pending_amount || 0).toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold">Dispatch Ref</p>
                <p className="font-medium text-slate-800 dark:text-slate-100">{selectedDispatch.dispatch_no}</p>
              </div>
            </div>

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <UserIcon size={16} /> Assign Driver *
                </label>
                <select
                  value={selectedDriver}
                  onChange={(e) => setSelectedDriver(e.target.value)}
                  className="input"
                >
                  <option value="">Select a driver...</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.status === 'engaged' ? '🟡 Engaged' : '🟢 Free'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <CreditCard size={16} /> Payment Method *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="input"
                >
                  {paymentMethods.map(pm => (
                    <option key={pm} value={pm}>{pm.toUpperCase()}</option>
                  ))}
                </select>
              </div>
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
                  onClick={handleWhatsAppAlert}
                  className="btn-secondary text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 flex items-center gap-1.5 text-xs font-bold"
                >
                  <MessageSquare size={15} /> WhatsApp Alert
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedDispatch(null)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBill}
                  disabled={creatingBill}
                  className="btn-primary bg-blue-600 hover:bg-blue-700 text-xs font-bold"
                >
                  {creatingBill ? 'Creating...' : 'Confirm & Send to Dispatch'}
                </button>
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
