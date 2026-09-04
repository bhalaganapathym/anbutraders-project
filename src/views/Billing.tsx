import { useState, useEffect, useRef, useCallback } from 'react';
import { api, type Dispatch, type Driver, type Customer, type DispatchItem } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { 
  FileText, Download, CreditCard, IndianRupee, AlertCircle, MessageSquare, Clock, Bell, CheckCircle2, 
  User, MapPin, Phone, Truck, Package, Calendar, Tag, Sparkles, XCircle, ShieldCheck, HelpCircle,
  PlusCircle, ShoppingCart, Tags, Receipt, DollarSign
} from 'lucide-react';
import Modal from '@/components/Modal';
import DiscountApprovalModal from '@/components/DiscountApprovalModal';
import { useRealtime } from '@/lib/useRealtime';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { openWhatsApp, shareWhatsAppWithMedia, buildDispatchWhatsAppMessage, DEFAULT_COMPANY_IMAGE_URL } from '@/lib/whatsapp';
import { useTranslation } from '@/lib/i18n';
import { round2, calculateProductPrice, calculateDiscountedProductPrice } from '@/lib/pricing';

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

function WaitClock({
  timestamp,
  endTime,
  isCompleted = false,
}: {
  timestamp: string | Date;
  endTime?: string | Date | null;
  isCompleted?: boolean;
}) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const update = () => {
      if (!timestamp) {
        setElapsed('—');
        return;
      }
      const start = new Date(timestamp).getTime();
      const end = endTime ? new Date(endTime).getTime() : isCompleted ? start : Date.now();
      const diffMs = (endTime || isCompleted) ? Math.max(0, end - start) : Date.now() - start;
      if (diffMs < 0 || isNaN(diffMs)) {
        setElapsed('0s');
        return;
      }
      const diffSecs = Math.floor(diffMs / 1000);
      const days = Math.floor(diffSecs / 86400);
      const hrs = Math.floor((diffSecs % 86400) / 3600);
      const mins = Math.floor((diffSecs % 3600) / 60);
      const secs = diffSecs % 60;
      
      let timeStr = '';
      if (days > 0) timeStr += `${days}d `;
      if (hrs > 0 || days > 0) timeStr += `${hrs}h `;
      if (mins > 0 || hrs > 0 || days > 0) timeStr += `${mins}m `;
      if (!isCompleted && !endTime) {
        timeStr += `${secs}s`;
      } else if (!timeStr) {
        timeStr = `${secs}s`;
      }
      
      setElapsed(timeStr.trim());
    };
    update();
    if (!isCompleted && !endTime) {
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }
  }, [timestamp, endTime, isCompleted]);

  if (isCompleted || endTime) {
    return (
      <div className="flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-emerald-700 dark:text-emerald-300 tabular-nums bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
        <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
        <span>{elapsed && elapsed !== '0s' ? `Completed in ${elapsed}` : 'Delivered & Completed'}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
      <Clock size={12} className="animate-pulse" /> {elapsed}
    </div>
  );
}

export default function Billing({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const { t } = useTranslation();
  const [allDispatches, setAllDispatches] = useState<Dispatch[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const toast = useToast();

  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.username?.toLowerCase() === 'admin';

  const [selectedDispatch, setSelectedDispatch] = useState<Dispatch | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('full payment done');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [toCollectAmount, setToCollectAmount] = useState<string>('');
  const [priorPendingPaid, setPriorPendingPaid] = useState<string>('');
  const [unloadingCharge, setUnloadingCharge] = useState<string>('');
  const [deliveryCharge, setDeliveryCharge] = useState<string>('');
  const [creditDays, setCreditDays] = useState<number | ''>(7);
  const [creditDueDate, setCreditDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [creatingBill, setCreatingBill] = useState(false);
  const [notifyingDispatch, setNotifyingDispatch] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Discount States
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [itemDiscounts, setItemDiscounts] = useState<Record<string, { type: 'per_kg' | 'per_unit' | 'flat'; value: number }>>({});
  const [discountReason, setDiscountReason] = useState('');
  const [requestingDiscount, setRequestingDiscount] = useState(false);
  const [discountApprovalModalOpen, setDiscountApprovalModalOpen] = useState(false);
  
  const paymentMethods = [
    'full payment done',
    'partial payment done',
    'full payment on site',
    'partial payment on site',
    'today payment',
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

  const selectedCustomer = customers.find(c => c.id === selectedDispatch?.customer_id) || selectedDispatch?.customer;

  const isDiscountApproved =
    selectedDispatch?.discount_approval_status === 'approved' &&
    Number(selectedDispatch?.discount_amount || 0) > 0;

  // Auto-calculate amounts when selectedDispatch or paymentMethod changes
  useEffect(() => {
    if (!selectedDispatch) return;
    const isApproved = selectedDispatch.discount_approval_status === 'approved' && Number(selectedDispatch.discount_amount || 0) > 0;
    const total = round2(
      selectedDispatch.items?.reduce((sum, item) => {
        const p = isApproved ? (item.price ?? (item.original_price ?? 0)) : (item.original_price ?? (item.price ?? 0));
        return sum + round2(p * (item.quantity || 1));
      }, 0) || 0
    );
    
    if (paymentMethod === 'full payment done') {
      setPaidAmount(total.toFixed(2));
      setToCollectAmount('0.00');
    } else if (paymentMethod === 'full payment on site' || paymentMethod === 'credit') {
      setPaidAmount('0.00');
      setToCollectAmount(total.toFixed(2));
    } else if (paymentMethod === 'today payment') {
      setPaidAmount('0.00');
      setToCollectAmount(total.toFixed(2));
      const todayStr = new Date().toISOString().split('T')[0];
      setCreditDueDate(todayStr);
      setCreditDays(0);
    } else if (paymentMethod.includes('partial')) {
      const currentPaid = round2(paidAmount);
      if (currentPaid > 0 && currentPaid < total) {
        setToCollectAmount(round2(Math.max(0, total - currentPaid)).toFixed(2));
      } else {
        setPaidAmount('0.00');
        setToCollectAmount(total.toFixed(2));
      }
    }
  }, [selectedDispatch, paymentMethod]);

  const handlePaidAmountChange = (val: string) => {
    setPaidAmount(val);
    const isApproved = selectedDispatch?.discount_approval_status === 'approved' && Number(selectedDispatch?.discount_amount || 0) > 0;
    const total = round2(
      selectedDispatch?.items?.reduce((sum, item) => {
        const p = isApproved ? (item.price ?? (item.original_price ?? 0)) : (item.original_price ?? (item.price ?? 0));
        return sum + round2(p * (item.quantity || 1));
      }, 0) || 0
    );
    const p = parseFloat(val) || 0;
    const remaining = round2(Math.max(0, total - round2(p)));
    setToCollectAmount(remaining.toFixed(2));
  };

  const handleToCollectAmountChange = (val: string) => {
    setToCollectAmount(val);
    const isApproved = selectedDispatch?.discount_approval_status === 'approved' && Number(selectedDispatch?.discount_amount || 0) > 0;
    const total = round2(
      selectedDispatch?.items?.reduce((sum, item) => {
        const p = isApproved ? (item.price ?? (item.original_price ?? 0)) : (item.original_price ?? (item.price ?? 0));
        return sum + round2(p * (item.quantity || 1));
      }, 0) || 0
    );
    const toCol = parseFloat(val) || 0;
    const p = round2(Math.max(0, total - round2(toCol)));
    setPaidAmount(p.toFixed(2));
  };

  const openDiscountEditor = () => {
    if (!selectedDispatch) return;
    const initialDiscounts: Record<string, { type: 'per_kg' | 'per_unit' | 'flat'; value: number }> = {};
    if (Array.isArray(selectedDispatch.discount_details)) {
      selectedDispatch.discount_details.forEach((d: any) => {
        initialDiscounts[d.item_id] = {
          type: d.discount_type || 'per_kg',
          value: Number(d.discount_value) || 0
        };
      });
    } else {
      (selectedDispatch.items || []).forEach(item => {
        if (item.discount_per_kg && item.discount_per_kg > 0) {
          initialDiscounts[item.id] = { type: 'per_kg', value: Number(item.discount_per_kg) };
        } else if (item.discount_per_unit && item.discount_per_unit > 0) {
          initialDiscounts[item.id] = { type: 'per_unit', value: Number(item.discount_per_unit) };
        } else {
          initialDiscounts[item.id] = { type: 'per_kg', value: 0 };
        }
      });
    }
    setItemDiscounts(initialDiscounts);
    setDiscountReason(selectedDispatch.discount_reason || '');
    setIsDiscountModalOpen(true);
  };

  const handleSaveDiscount = async (asAdminApproval: boolean = false) => {
    if (!selectedDispatch) return;
    setRequestingDiscount(true);
    try {
      const discountItemsPayload = (selectedDispatch.items || []).map(item => {
        const disc = itemDiscounts[item.id] || { type: 'per_kg', value: 0 };
        const val = Number(disc.value) || 0;
        const origPrice = round2(item.original_price ?? item.price ?? 0);
        const origTotal = round2(origPrice * item.quantity);
        
        let itemDiscountAmt = 0;
        let newLinePrice = origPrice;

        if (val > 0) {
          if (disc.type === 'per_kg') {
            const recordedWt = selectedDispatch.weights?.find(w => w.notes?.includes(item.product_name))?.actual_weight;
            const weight = recordedWt || (item.quantity * 1);
            itemDiscountAmt = round2(weight * val);
            newLinePrice = round2(Math.max(0, (origTotal - itemDiscountAmt) / item.quantity));
          } else if (disc.type === 'per_unit') {
            itemDiscountAmt = round2(item.quantity * val);
            newLinePrice = round2(Math.max(0, origPrice - val));
          } else {
            itemDiscountAmt = round2(Math.min(origTotal, val));
            newLinePrice = round2(Math.max(0, (origTotal - itemDiscountAmt) / item.quantity));
          }
        }

        return {
          item_id: item.id,
          product_name: item.product_name,
          discount_type: disc.type,
          discount_value: val,
          discount_amount: itemDiscountAmt,
          original_price: origPrice,
          new_price: newLinePrice
        };
      });

      const totalDiscountAmt = round2(discountItemsPayload.reduce((s, it) => s + it.discount_amount, 0));

      if (totalDiscountAmt <= 0) {
        toast('Please enter a discount value greater than 0', 'error');
        setRequestingDiscount(false);
        return;
      }

      // Submit request
      const updatedDisp: any = await api.post(`/dispatches/${selectedDispatch.id}/request-discount-approval`, {
        items: discountItemsPayload,
        total_discount: totalDiscountAmt,
        reason: discountReason || 'Customer requested discount',
        requested_by: user?.username || 'Cashier'
      });

      if (asAdminApproval && isAdmin) {
        const approvedDisp: any = await api.post(`/dispatches/${selectedDispatch.id}/discount-decision`, {
          decision: 'approved',
          approved_by: user?.username || 'Admin',
          rejection_reason: null
        });
        setSelectedDispatch(approvedDisp);
        toast(`Discount of ₹${totalDiscountAmt.toFixed(2)} applied and approved!`, 'success');
      } else {
        setSelectedDispatch(updatedDisp);
        toast(`Discount request for ₹${totalDiscountAmt.toFixed(2)} submitted for Admin approval`, 'success');
      }

      setIsDiscountModalOpen(false);
      loadData();
    } catch (err: any) {
      toast(err.message || 'Failed to submit discount', 'error');
    } finally {
      setRequestingDiscount(false);
    }
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

  const setQuickCreditDays = (days: number) => {
    setCreditDays(days);
    const d = new Date();
    d.setDate(d.getDate() + days);
    setCreditDueDate(d.toISOString().split('T')[0]);
  };

  const handleCustomCreditDateChange = (dateStr: string) => {
    setCreditDueDate(dateStr);
    if (dateStr) {
      const target = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      target.setHours(0, 0, 0, 0);
      const diffTime = target.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setCreditDays(diffDays > 0 ? diffDays : 0);
    }
  };

  const handleCreateBill = async () => {
    if (!selectedDispatch) return;
    if (creatingBill) return;
    setCreatingBill(true);
    
    let totalAmount = 0;
    selectedDispatch.items?.forEach(item => {
      totalAmount += round2((item.price || 0) * (item.quantity || 1));
    });
    const uChargeVal = parseFloat(unloadingCharge) || 0;
    const dChargeVal = parseFloat(deliveryCharge) || 0;
    totalAmount = round2(totalAmount + uChargeVal + dChargeVal);

    const paidVal = round2(parseFloat(paidAmount) || 0);
    const toCollectVal = round2(parseFloat(toCollectAmount) || 0);
    const priorPaidVal = round2(parseFloat(priorPendingPaid) || 0);
    const isCredit = paymentMethod === 'credit' || paymentMethod === 'today payment' || toCollectVal > 0;

    try {
      await api.post('/bills', {
        dispatch_id: selectedDispatch.id,
        order_id: selectedDispatch.order_id,
        customer_id: selectedDispatch.customer_id,
        driver_id: null,
        payment_method: paymentMethod,
        total_amount: round2(totalAmount),
        discount_amount: round2(selectedDispatch.discount_amount || 0),
        paid_amount: round2(paidVal),
        pending_amount: round2(toCollectVal),
        prior_pending_paid: priorPaidVal,
        unloading_charge: round2(uChargeVal),
        delivery_charge: round2(dChargeVal),
        credit_due_date: isCredit && creditDueDate ? new Date(creditDueDate).toISOString() : null,
        credit_days: isCredit && creditDays !== '' ? Number(creditDays) : null,
      });

      toast('Bill generated & dispatch team notified with customer details!', 'success');
      setSelectedDispatch(null);
      setPriorPendingPaid('');
      setUnloadingCharge('');
      setDeliveryCharge('');
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

  const isSelectedDispatchDiscountApproved =
    selectedDispatch?.discount_approval_status === 'approved' &&
    Number(selectedDispatch?.discount_amount || 0) > 0;

  let totalAmount = 0;
  selectedDispatch?.items?.forEach(item => {
    const unitPrice = isSelectedDispatchDiscountApproved
      ? (item.price || 0)
      : (item.original_price ?? item.price ?? 0);
    totalAmount += unitPrice * (item.quantity || 1);
  });
  totalAmount = round2(totalAmount);
  const uCharge = parseFloat(unloadingCharge) || 0;
  const dCharge = parseFloat(deliveryCharge) || 0;
  const grandTotalAmount = round2(totalAmount + uCharge + dCharge);

  const customerPriorDues = round2(Number(selectedCustomer?.pending_amount || 0));
  const priorPaidVal = round2(parseFloat(priorPendingPaid) || 0);
  const remainingPriorDues = round2(Math.max(0, customerPriorDues - priorPaidVal));
  const paidVal = round2(parseFloat(paidAmount) || 0);
  const toCollectVal = round2(parseFloat(toCollectAmount) || 0);
  const totalReceivedInTransaction = round2(paidVal + priorPaidVal);
  const totalCustomerNetOutstanding = round2(toCollectVal + remainingPriorDues);

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
            const isApproved = dispatch.discount_approval_status === 'approved' && Number(dispatch.discount_amount || 0) > 0;
            const billTotal = dispatch.items?.reduce((s, it) => {
              const p = isApproved ? (it.price || 0) : (it.original_price ?? it.price ?? 0);
              return s + p * (it.quantity || 1);
            }, 0) || 0;
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
                  <WaitClock
                    timestamp={dispatch.sent_to_billing_at || dispatch.created_at}
                    endTime={dispatch.completed_at || dispatch.bill?.created_at}
                    isCompleted={true}
                  />
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
                    <Bell size={13} /> Bill Ready
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
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-4 border-2 border-slate-200 dark:border-slate-700 text-sm">
              <div className="space-y-0.5">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-extrabold tracking-wide">Customer Name</p>
                <p className="font-black text-slate-900 dark:text-slate-100 text-sm sm:text-base">{selectedDispatch.customer?.name}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-extrabold tracking-wide">Phone Number</p>
                <p className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">{selectedDispatch.customer?.phone || '—'}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-extrabold tracking-wide">Pending Dues</p>
                <p className="font-black text-amber-600 dark:text-amber-400 text-sm sm:text-base">₹{Number(selectedCustomer?.pending_amount || 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-extrabold tracking-wide">Transport</p>
                <p className="font-extrabold text-slate-800 dark:text-slate-200 text-xs sm:text-sm line-clamp-2">
                  {selectedDispatch.vehicle_number ? `${selectedDispatch.vehicle_number} (${selectedDispatch.driver_name || 'Driver'})` : 'Assigned in Dispatch'}
                </p>
              </div>
            </div>

            {/* Discount Alert & Actions Banner */}
            {selectedDispatch.discount_approval_status === 'pending' && (
              <div className="p-3.5 bg-amber-500/10 border-2 border-amber-400 dark:border-amber-600/60 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Clock size={18} className="text-amber-600 animate-pulse shrink-0" />
                  <div>
                    <span className="font-extrabold text-amber-900 dark:text-amber-200 text-sm">
                      Discount Approval Pending (-₹{round2(selectedDispatch.discount_amount || 0).toFixed(2)})
                    </span>
                    <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                      Requested by {selectedDispatch.discount_requested_by || 'Cashier'} · Remarks: {selectedDispatch.discount_reason || 'Customer discount requested'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => setDiscountApprovalModalOpen(true)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shrink-0 shadow-sm flex items-center gap-1"
                    >
                      <ShieldCheck size={14} /> Review & Approve
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-bold rounded-lg">
                      Waiting for Admin
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={openDiscountEditor}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-50"
                  >
                    Edit
                  </button>
                </div>
              </div>
            )}

            {selectedDispatch.discount_approval_status === 'approved' && (
              <div className="p-3.5 bg-emerald-500/10 border-2 border-emerald-400 dark:border-emerald-600/60 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-extrabold text-emerald-900 dark:text-emerald-200 text-sm">
                      Discount of ₹{round2(selectedDispatch.discount_amount || 0).toFixed(2)} Approved & Active
                    </span>
                    <p className="text-emerald-700 dark:text-emerald-400 text-xs mt-0.5">
                      Approved by {selectedDispatch.discount_approved_by || 'Admin'}. Discounted rates have updated all totals.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openDiscountEditor}
                  className="px-3 py-1.5 bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 font-bold rounded-lg hover:bg-emerald-600/30 transition"
                >
                  Adjust Discount
                </button>
              </div>
            )}

            {selectedDispatch.discount_approval_status === 'rejected' && (
              <div className="p-3.5 bg-rose-500/10 border-2 border-rose-400 dark:border-rose-600/60 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <XCircle size={18} className="text-rose-600 shrink-0" />
                  <div>
                    <span className="font-extrabold text-rose-900 dark:text-rose-200 text-sm">
                      Discount Request Rejected
                    </span>
                    <p className="text-rose-700 dark:text-rose-400 text-xs mt-0.5">
                      {selectedDispatch.discount_rejection_reason || 'Standard catalog rates active.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openDiscountEditor}
                  className="px-3 py-1.5 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition"
                >
                  Re-apply Discount
                </button>
              </div>
            )}

            {/* Order Items Section - High Contrast, Bold & Mobile-Optimized */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Package size={18} className="text-blue-600 dark:text-blue-400" />
                    Order Items ({selectedDispatch.items?.length || 0})
                  </h3>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                    Tax Inclusive
                  </span>
                </div>
                
                {/* Apply / Edit Discount Button - Clean and only shows active tag when approved */}
                <button
                  type="button"
                  onClick={openDiscountEditor}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 ${
                    isDiscountApproved
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-black'
                      : selectedDispatch.discount_approval_status === 'pending'
                      ? 'bg-amber-600 hover:bg-amber-700 text-white font-black'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Tag size={13} />
                  {isDiscountApproved
                    ? `Discount Active (-₹${round2(selectedDispatch.discount_amount).toFixed(2)})`
                    : selectedDispatch.discount_approval_status === 'pending'
                    ? 'Discount Pending Approval'
                    : '+ Add Discount'}
                </button>
              </div>

              {/* Mobile View (< 768px): Bold, Non-Scrollable Cards */}
              <div className="md:hidden space-y-3">
                {selectedDispatch.items?.map((item, idx) => {
                  const recordedWt = selectedDispatch.weights?.find(w => w.notes?.includes(item.product_name))?.actual_weight;
                  const unitPrice = isDiscountApproved ? (item.price || 0) : (item.original_price ?? item.price ?? 0);
                  const lineTotal = round2(unitPrice * item.quantity);

                  return (
                    <div 
                      key={item.id || idx} 
                      className="rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                              Item #{idx + 1}
                            </span>
                            {isDiscountApproved && (item.discount_amount || 0) > 0 && (
                              <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                                {item.discount_per_kg ? `-₹${item.discount_per_kg.toFixed(2)}/kg` : `-₹${item.discount_amount?.toFixed(2)}`}
                              </span>
                            )}
                          </div>
                          <h4 className="text-base font-black text-slate-900 dark:text-slate-100 mt-1.5 leading-snug">
                            {item.product_name}
                          </h4>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Price</span>
                          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                            ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-700">
                          <span className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 block tracking-wide">
                            Quantity / Nos
                          </span>
                          <span className="text-base font-black text-slate-900 dark:text-slate-100 mt-0.5 block">
                            {item.quantity} <span className="text-xs font-bold text-slate-500">{item.unit}</span>
                          </span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-700">
                          <span className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 block tracking-wide">
                            Recorded Weight
                          </span>
                          <span className={`text-base font-black mt-0.5 block ${recordedWt ? 'text-blue-700 dark:text-blue-400' : 'text-slate-400'}`}>
                            {recordedWt ? `${recordedWt} kg` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop / Tablet View (>= 768px): High-Contrast, Clean Standard 4-Column Table */}
              <div className="hidden md:block border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-5 py-3.5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Item Name</th>
                      <th className="px-5 py-3.5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-right">No. of Items</th>
                      <th className="px-5 py-3.5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-right">Recorded Weight</th>
                      <th className="px-5 py-3.5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-right">Total Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
                    {selectedDispatch.items?.map((item, idx) => {
                      const recordedWt = selectedDispatch.weights?.find(w => w.notes?.includes(item.product_name))?.actual_weight;
                      const unitPrice = isDiscountApproved ? (item.price || 0) : (item.original_price ?? item.price ?? 0);
                      const lineTotal = round2(unitPrice * item.quantity);

                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          <td className="px-5 py-4 font-black text-slate-900 dark:text-slate-100 text-sm">
                            {item.product_name}
                          </td>
                          <td className="px-5 py-4 text-right font-black text-slate-900 dark:text-slate-100 text-sm">
                            {item.quantity} <span className="font-bold text-xs text-slate-500">{item.unit}</span>
                          </td>
                          <td className="px-5 py-4 text-right font-bold text-sm">
                            <span className={recordedWt ? 'text-blue-700 dark:text-blue-400 font-extrabold' : 'text-slate-400'}>
                              {recordedWt ? `${recordedWt} kg` : '—'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-base">
                            ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
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

            {/* Today Payment Specific Info Banner */}
            {paymentMethod === 'today payment' && (
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-300 dark:border-amber-700 p-4 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-extrabold text-sm">
                  <Clock size={16} className="text-amber-600 animate-pulse" />
                  <span>Today Evening Payment (Pay Before 6:00 PM)</span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  Customer agreed to clear the full bill amount before <strong>6:00 PM today</strong>.
                  If the bill remains unpaid after the evening cutoff, the remaining balance will automatically transfer to active <strong>Customer Credit Due</strong> and send high-priority alert notifications to Admin & Billing.
                </p>
              </div>
            )}

            {/* Payment Details / Amount Paid & To Collect Breakdown */}
            {/* Optional Charges: Unloading & Delivery Charge */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-850 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Unloading Charge (₹) <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="number"
                  value={unloadingCharge}
                  onChange={(e) => setUnloadingCharge(e.target.value)}
                  placeholder="e.g. 150.00"
                  min="0"
                  step="any"
                  className="input text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Delivery Charge (₹) <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="number"
                  value={deliveryCharge}
                  onChange={(e) => setDeliveryCharge(e.target.value)}
                  placeholder="e.g. 300.00"
                  min="0"
                  step="any"
                  className="input text-xs font-semibold"
                />
              </div>
            </div>

            {/* Customer Prior Pending Dues & Payment Section */}
            <div className="bg-orange-50/70 dark:bg-slate-900 border border-orange-200/90 dark:border-orange-950 p-4 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-orange-900 dark:text-orange-300 flex items-center gap-1.5">
                  <Clock size={14} className="text-orange-600" />
                  Customer Prior Pending Dues
                </span>
                <span className="text-xs font-black px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-950/80 text-orange-900 dark:text-orange-200 border border-orange-300 dark:border-orange-800">
                  Old Outstanding: ₹{customerPriorDues.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Prior Dues Paid in this Bill (₹) <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      value={priorPendingPaid}
                      onChange={(e) => setPriorPendingPaid(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="any"
                      className="input pl-8 font-bold text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Amount paying toward old pending dues</p>
                </div>

                <div className="flex flex-col justify-center bg-white/80 dark:bg-slate-800/80 p-3 rounded-xl border border-orange-100 dark:border-slate-700 text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Remaining Prior Dues:</span>
                    <strong className="text-orange-700 dark:text-orange-400 font-bold">
                      ₹{remainingPriorDues.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-700">
                    <span className="text-slate-700 dark:text-slate-200 font-extrabold">Total Collected in Hand:</span>
                    <strong className="text-emerald-700 dark:text-emerald-400 font-black text-sm">
                      ₹{totalReceivedInTransaction.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment & Collection Breakdown Box */}
            <div className="bg-amber-50/50 dark:bg-slate-900 border border-amber-200/80 dark:border-slate-700 p-4 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <IndianRupee size={14} className="text-amber-600" />
                  Payment & Collection Breakdown
                </span>
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  Total Bill: ₹{grandTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

            {/* Credit Timeline & Agreed Due Date Box */}
            {(paymentMethod === 'credit' || parseFloat(toCollectAmount) > 0) && (
              <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/50 dark:from-slate-900 dark:to-indigo-950/40 border-2 border-indigo-200 dark:border-indigo-800 p-4 rounded-xl space-y-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                    <Calendar size={15} className="text-indigo-600 dark:text-indigo-400" />
                    Credit Timeline & Promised Payment Date
                  </span>
                  <span className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                    {creditDays !== '' ? `${creditDays} Days Credit` : 'Custom Date'}
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Quick Days:</span>
                  {[3, 7, 15, 30, 45].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setQuickCreditDays(d)}
                      className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                        creditDays === d
                          ? 'bg-indigo-600 text-white shadow-md scale-105'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {d} Days
                    </button>
                  ))}
                </div>

                {/* Date Picker Input */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                      Promised Settlement Date *
                    </label>
                    <input
                      type="date"
                      value={creditDueDate}
                      onChange={(e) => handleCustomCreditDateChange(e.target.value)}
                      className="input font-bold text-indigo-900 dark:text-indigo-200 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-900 leading-relaxed">
                      🔔 Automated alert will notify Admin & Billing team on{' '}
                      <strong className="text-indigo-700 dark:text-indigo-400 font-black">
                        {creditDueDate ? new Date(creditDueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </strong>{' '}
                      if credit is unpaid.
                    </p>
                  </div>
                </div>
              </div>
            )}

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

            {/* Hidden Printable Bill Element matching Anbu Traders official image */}
            <div className="fixed top-[-9999px] left-[-9999px]">
              <div ref={printRef} className="w-[794px] bg-white text-black p-8 text-xs font-sans border-2 border-black space-y-4">
                <div className="flex justify-between items-start border-b-2 border-black pb-3">
                  <div className="flex items-center gap-3.5">
                    <img
                      src="/pwa-192x192.png"
                      alt="Anbu Traders Logo"
                      className="h-16 w-16 object-contain rounded-lg border border-black/20 p-0.5"
                      crossOrigin="anonymous"
                    />
                    <div>
                      <h1 className="text-2xl font-black tracking-wide text-black uppercase">ANBU TRADERS</h1>
                      <p className="text-[11px] font-semibold text-gray-800">No.4/5 Pondy Mailam Road T.C Kootroad</p>
                      <p className="text-[11px] font-semibold text-gray-800">Vanur T.K 605 111 | Ph: 0413-2964204, 9626325204</p>
                      <p className="text-[11px] font-semibold text-gray-800">State Name : Tamil Nadu, Code : 33</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h2 className="text-lg font-black border-2 border-black px-3 py-0.5 inline-block uppercase">ESTIMATE</h2>
                    <p className="text-[10px] italic mt-1 text-gray-700">(TRIPLICATE FOR SUPPLIER)</p>
                    <p className="text-[11px] mt-2 font-bold"><strong>Invoice No:</strong> {selectedDispatch.dispatch_no}</p>
                    <p className="text-[11px] font-bold"><strong>Date:</strong> {new Date().toLocaleDateString('en-IN')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-b-2 border-black pb-3 text-[11px]">
                  <div className="pr-2 border-r border-gray-400">
                    <p className="font-bold uppercase tracking-wider text-[10px] border-b border-gray-300 pb-1 mb-1 text-gray-700">Consignee (Ship to)</p>
                    <p className="font-extrabold text-sm text-black">{selectedDispatch.customer?.name}</p>
                    <p className="font-semibold">{selectedDispatch.delivery_address || selectedDispatch.customer?.address || 'Site Delivery'}</p>
                    <p className="font-semibold">Ph: {selectedDispatch.customer?.phone || '—'}</p>
                  </div>
                  <div className="pl-2">
                    <p className="font-bold uppercase tracking-wider text-[10px] border-b border-gray-300 pb-1 mb-1 text-gray-700">Buyer (Bill to)</p>
                    <p className="font-extrabold text-sm text-black">{selectedDispatch.customer?.name}</p>
                    <p className="font-semibold">{selectedDispatch.customer?.address || selectedDispatch.delivery_address || 'Billing Address'}</p>
                    <p className="font-semibold">Ph: {selectedDispatch.customer?.phone || '—'}</p>
                  </div>
                </div>

                <table className="w-full border-collapse border-2 border-black text-[11px]">
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-black font-extrabold">
                      <th className="border border-black p-1.5 text-center w-10">SI</th>
                      <th className="border border-black p-1.5 text-left">Description of Goods</th>
                      <th className="border border-black p-1.5 text-center w-28">Nos / Quantity</th>
                      <th className="border border-black p-1.5 text-right w-20">Rate</th>
                      <th className="border border-black p-1.5 text-center w-16">per</th>
                      <th className="border border-black p-1.5 text-right w-28">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDispatch.items?.map((it, idx) => {
                      const unitPrice = isSelectedDispatchDiscountApproved ? (it.price || 0) : (it.original_price ?? it.price ?? 0);
                      const lineTotal = round2(unitPrice * it.quantity);
                      return (
                        <tr key={it.id || idx}>
                          <td className="border border-black p-1.5 text-center font-medium">{idx + 1}</td>
                          <td className="border border-black p-1.5 font-bold uppercase">{it.product_name}</td>
                          <td className="border border-black p-1.5 text-center font-semibold">{it.quantity}</td>
                          <td className="border border-black p-1.5 text-right font-medium">{unitPrice.toFixed(2)}</td>
                          <td className="border border-black p-1.5 text-center uppercase font-medium">{it.unit}</td>
                          <td className="border border-black p-1.5 text-right font-black">{lineTotal.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    {/* Unloading Charge Row */}
                    <tr className="bg-slate-50/50">
                      <td className="border border-black p-1.5 text-center font-medium">—</td>
                      <td className="border border-black p-1.5 font-bold uppercase text-slate-800">Unloading Charge</td>
                      <td className="border border-black p-1.5 text-center text-gray-400">—</td>
                      <td className="border border-black p-1.5 text-right text-gray-400">—</td>
                      <td className="border border-black p-1.5 text-center text-gray-400">—</td>
                      <td className="border border-black p-1.5 text-right font-black">
                        {uCharge > 0 ? uCharge.toFixed(2) : ''}
                      </td>
                    </tr>
                    {/* Delivery Charge Row */}
                    <tr className="bg-slate-50/50">
                      <td className="border border-black p-1.5 text-center font-medium">—</td>
                      <td className="border border-black p-1.5 font-bold uppercase text-slate-800">Delivery Charge</td>
                      <td className="border border-black p-1.5 text-center text-gray-400">—</td>
                      <td className="border border-black p-1.5 text-right text-gray-400">—</td>
                      <td className="border border-black p-1.5 text-center text-gray-400">—</td>
                      <td className="border border-black p-1.5 text-right font-black">
                        {dCharge > 0 ? dCharge.toFixed(2) : ''}
                      </td>
                    </tr>
                    <tr className="font-extrabold border-t-2 border-black bg-gray-100">
                      <td colSpan={5} className="border border-black p-2 text-right uppercase text-xs">Total</td>
                      <td className="border border-black p-2 text-right text-sm font-black">₹{grandTotalAmount.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="space-y-1.5 pt-1 text-[11px]">
                  <p className="font-semibold"><strong>Amount Chargeable (in words):</strong> {numberToWords(grandTotalAmount)}</p>

                  <div className="grid grid-cols-3 gap-2 border-2 border-black p-2.5 my-2 bg-gray-50 text-[11px]">
                    <div>
                      <p className="text-[10px] font-bold text-gray-600 uppercase">Current Invoice Amount</p>
                      <p className="font-black text-sm text-black">₹{grandTotalAmount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-600 uppercase">Current Bill Paid</p>
                      <p className="font-black text-sm text-emerald-800">₹{paidVal.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-600 uppercase">Current Bill Balance</p>
                      <p className="font-black text-sm text-rose-800">₹{toCollectVal.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Customer Prior Dues & Comprehensive Ledger Breakdown */}
                  <div className="border border-black p-2.5 bg-gray-50/80 space-y-1 text-[11px] my-2">
                    <div className="flex justify-between">
                      <span><strong>Customer Prior Pending Dues:</strong></span>
                      <span className="font-bold">₹{customerPriorDues.toFixed(2)}</span>
                    </div>
                    {priorPaidVal > 0 && (
                      <>
                        <div className="flex justify-between text-emerald-800 font-bold">
                          <span>Prior Dues Paid in this Bill:</span>
                          <span>(-) ₹{priorPaidVal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-amber-900 font-semibold">
                          <span>Remaining Prior Pending Dues:</span>
                          <span>₹{remainingPriorDues.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between pt-1 border-t border-black font-black text-xs">
                      <span>Total Cash/Payment Received in this Transaction:</span>
                      <span className="text-emerald-900">₹{totalReceivedInTransaction.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-black text-xs text-rose-900">
                      <span>Total Customer Net Outstanding Balance:</span>
                      <span>₹{totalCustomerNetOutstanding.toFixed(2)}</span>
                    </div>
                  </div>

                  <p><strong>Payment Mode:</strong> {paymentMethod.toUpperCase()}</p>
                  {selectedDispatch.vehicle_number && (
                    <p><strong>Transport:</strong> Vehicle {selectedDispatch.vehicle_number} {selectedDispatch.driver_name ? `(${selectedDispatch.driver_name})` : ''}</p>
                  )}
                </div>

                <div className="border-t-2 border-black pt-4 flex justify-between items-end text-[10px]">
                  <div>
                    <p className="font-bold">Declaration:</p>
                    <p className="italic text-gray-700">We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
                    <p className="mt-2 font-black text-black">This is a Computer Generated Invoice</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-xs uppercase">for ANBU TRADERS</p>
                    <div className="h-10"></div>
                    <p className="font-bold border-t border-black pt-0.5">Authorised Signatory</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Item Discount Editor Modal */}
      <Modal open={isDiscountModalOpen} onClose={() => setIsDiscountModalOpen(false)} title="🎁 Apply / Edit Item Discounts" size="lg">
        {selectedDispatch && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span className="text-amber-900 dark:text-amber-300">
                  {selectedDispatch.dispatch_no} — {selectedDispatch.customer?.name}
                </span>
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  {isAdmin ? 'Admin Direct Edit & Approval' : 'Subject to Admin Approval'}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                Enter price discount per kg (e.g. 0.50 for ₹0.50 off/kg on steel), per unit, or flat reduction for each line item below.
              </p>
            </div>

            {/* List of items with discount controls */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {(selectedDispatch.items || []).map((item: DispatchItem, idx: number) => {
                const disc = itemDiscounts[item.id] || { type: 'per_kg', value: 0 };
                const val = Number(disc.value) || 0;
                const origPrice = round2(item.original_price ?? item.price ?? 0);
                const origTotal = round2(origPrice * item.quantity);
                const recordedWt = selectedDispatch.weights?.find(w => w.notes?.includes(item.product_name))?.actual_weight;
                const weight = recordedWt || (item.quantity * 1);

                let itemDiscountAmt = 0;
                let newLinePrice = origPrice;

                if (val > 0) {
                  if (disc.type === 'per_kg') {
                    itemDiscountAmt = round2(weight * val);
                    newLinePrice = round2(Math.max(0, (origTotal - itemDiscountAmt) / item.quantity));
                  } else if (disc.type === 'per_unit') {
                    itemDiscountAmt = round2(item.quantity * val);
                    newLinePrice = round2(Math.max(0, origPrice - val));
                  } else {
                    itemDiscountAmt = round2(Math.min(origTotal, val));
                    newLinePrice = round2(Math.max(0, (origTotal - itemDiscountAmt) / item.quantity));
                  }
                }

                const finalLineTotal = round2(Math.max(0, origTotal - itemDiscountAmt));

                return (
                  <div
                    key={item.id || idx}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
                          {item.product_name}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {item.quantity} {item.unit} {recordedWt ? `· Recorded Wt: ${recordedWt} kg` : ''} · Catalog Rate: ₹{origPrice.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Line Total</span>
                        <p className="text-xs font-black font-mono text-slate-800 dark:text-slate-200">
                          ₹{finalLineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 items-end">
                      <div>
                        <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                          Discount Mode
                        </label>
                        <select
                          value={disc.type}
                          onChange={(e) =>
                            setItemDiscounts({
                              ...itemDiscounts,
                              [item.id]: { ...disc, type: e.target.value as any }
                            })
                          }
                          className="input py-1 text-xs font-semibold"
                        >
                          <option value="per_kg">₹ / kg reduction</option>
                          <option value="per_unit">₹ / unit reduction</option>
                          <option value="flat">₹ flat reduction</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                          Discount Value ({disc.type === 'per_kg' ? '₹/kg' : disc.type === 'per_unit' ? '₹/unit' : '₹ flat'})
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={disc.value || ''}
                            onChange={(e) =>
                              setItemDiscounts({
                                ...itemDiscounts,
                                [item.id]: { ...disc, value: parseFloat(e.target.value) || 0 }
                              })
                            }
                            placeholder="0.50"
                            className="input pl-6 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                          />
                        </div>
                      </div>

                      <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800 text-right">
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block">
                          Savings on Line
                        </span>
                        <span className="text-xs font-black font-mono text-emerald-800 dark:text-emerald-300">
                          -₹{itemDiscountAmt.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Remarks / Reason input */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Discount Reason / Remarks:
              </label>
              <input
                type="text"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="e.g. Regular bulk customer discount request / 50p per kg off..."
                className="input text-xs"
              />
            </div>

            {/* Total Discount Summary Box */}
            {(() => {
              let sumOriginal = 0;
              let sumDiscount = 0;

              (selectedDispatch.items || []).forEach(item => {
                const disc = itemDiscounts[item.id] || { type: 'per_kg', value: 0 };
                const val = Number(disc.value) || 0;
                const origPrice = round2(item.original_price ?? item.price ?? 0);
                const origTotal = round2(origPrice * item.quantity);
                const recordedWt = selectedDispatch.weights?.find(w => w.notes?.includes(item.product_name))?.actual_weight;
                const weight = recordedWt || (item.quantity * 1);

                sumOriginal += origTotal;

                if (val > 0) {
                  if (disc.type === 'per_kg') {
                    sumDiscount += round2(weight * val);
                  } else if (disc.type === 'per_unit') {
                    sumDiscount += round2(item.quantity * val);
                  } else {
                    sumDiscount += round2(Math.min(origTotal, val));
                  }
                }
              });

              sumOriginal = round2(sumOriginal);
              sumDiscount = round2(sumDiscount);
              const sumFinal = round2(Math.max(0, sumOriginal - sumDiscount));

              return (
                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Original Total</span>
                    <p className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300">
                      ₹{sumOriginal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Total Discount</span>
                    <p className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                      -₹{sumDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase">Revised Bill</span>
                    <p className="text-sm font-black font-mono text-indigo-600 dark:text-indigo-400">
                      ₹{sumFinal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsDiscountModalOpen(false)}
                className="btn-secondary text-xs px-4 py-2"
                disabled={requestingDiscount}
              >
                Cancel
              </button>

              {isAdmin ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveDiscount(false)}
                    disabled={requestingDiscount}
                    className="btn-secondary text-xs px-3 py-2 font-bold"
                  >
                    Save as Pending
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveDiscount(true)}
                    disabled={requestingDiscount}
                    className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2 flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <ShieldCheck size={14} /> {requestingDiscount ? 'Applying...' : 'Apply & Approve (Admin)'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSaveDiscount(false)}
                  disabled={requestingDiscount}
                  className="btn-primary bg-amber-600 hover:bg-amber-700 text-white text-xs px-4 py-2 flex items-center gap-1.5 shadow-md shadow-amber-600/20"
                >
                  <Tag size={14} /> {requestingDiscount ? 'Submitting...' : 'Submit for Admin Approval'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Admin Discount Approval Review Modal */}
      <DiscountApprovalModal
        open={discountApprovalModalOpen}
        onClose={() => setDiscountApprovalModalOpen(false)}
        dispatch={selectedDispatch}
        onDecisionSubmitted={() => {
          loadData();
          setSelectedDispatch(null);
        }}
      />
    </div>
  );
}
