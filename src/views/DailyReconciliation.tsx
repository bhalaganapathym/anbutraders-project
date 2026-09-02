import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n';
import Modal from '@/components/Modal';
import { useAuth } from '@/lib/auth';
import { 
  Calendar, 
  DollarSign, 
  Truck, 
  Smartphone, 
  CreditCard, 
  Printer, 
  Download, 
  CheckCircle2, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  RefreshCw,
  HardHat,
  Receipt,
  Plus,
  IndianRupee,
  UserCheck,
  FileText
} from 'lucide-react';

interface DriverHandoverItem {
  id?: string;
  driver_id?: string;
  driver_name: string;
  vehicle_number?: string;
  settlement_date: string;
  amount_in_hand: number;
  expected_amount: number;
  payment_mode: string;
  received_by?: string;
  notes?: string;
  created_at?: string;
}

interface DriverSummary {
  driver_id: string;
  driver_name: string;
  vehicle_number: string;
  trips: number;
  cash_collected: number;
  upi_collected: number;
  handover?: DriverHandoverItem | null;
  bills: Array<{
    bill_id: string;
    dispatch_no: string;
    customer_name: string;
    total_amount: number;
    paid_amount: number;
    pending_amount: number;
    payment_method: string;
  }>;
}

interface ReconciliationData {
  date: string;
  total_bills_count: number;
  total_billed: number;
  total_paid: number;
  total_pending: number;
  total_handover_received?: number;
  payment_modes: Record<string, number>;
  drivers_summary: DriverSummary[];
  handovers?: DriverHandoverItem[];
}

export default function DailyReconciliation() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);

  // Handover Entry Modal State
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);
  const [savingHandover, setSavingHandover] = useState(false);
  const [selectedDriverSummary, setSelectedDriverSummary] = useState<DriverSummary | null>(null);
  const [driverNameInput, setDriverNameInput] = useState('');
  const [vehicleNoInput, setVehicleNoInput] = useState('');
  const [amountInHandInput, setAmountInHandInput] = useState('');
  const [expectedAmountInput, setExpectedAmountInput] = useState('');
  const [paymentModeInput, setPaymentModeInput] = useState('cash');
  const [receivedByInput, setReceivedByInput] = useState('');
  const [notesInput, setNotesInput] = useState('');

  const toast = useToast();
  const { t } = useTranslation();

  const loadData = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res: any = await api.get(`/reports/daily-reconciliation?date=${date}`);
      setData(res);
    } catch {
      toast('Failed to load reconciliation data', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate, loadData]);

  const openDriverHandover = (d: DriverSummary) => {
    setSelectedDriverSummary(d);
    setDriverNameInput(d.driver_name);
    setVehicleNoInput(d.vehicle_number === '—' ? '' : d.vehicle_number);
    setExpectedAmountInput(String(d.cash_collected));
    setAmountInHandInput(d.handover ? String(d.handover.amount_in_hand) : String(d.cash_collected));
    setPaymentModeInput(d.handover?.payment_mode || 'cash');
    setReceivedByInput(d.handover?.received_by || user?.username || 'Office Cashier');
    setNotesInput(d.handover?.notes || '');
    setHandoverModalOpen(true);
  };

  const openGeneralHandover = () => {
    setSelectedDriverSummary(null);
    setDriverNameInput('');
    setVehicleNoInput('');
    setExpectedAmountInput('0');
    setAmountInHandInput('');
    setPaymentModeInput('cash');
    setReceivedByInput(user?.username || 'Office Cashier');
    setNotesInput('');
    setHandoverModalOpen(true);
  };

  const handleSaveHandover = async () => {
    if (!driverNameInput.trim()) {
      toast('Driver name is required', 'error');
      return;
    }
    const val = parseFloat(amountInHandInput);
    if (isNaN(val) || val < 0) {
      toast('Please enter a valid amount given in hand', 'error');
      return;
    }

    setSavingHandover(true);
    try {
      await api.post('/reports/driver-handovers', {
        driver_id: selectedDriverSummary?.driver_id && selectedDriverSummary.driver_id !== selectedDriverSummary.driver_name ? selectedDriverSummary.driver_id : null,
        driver_name: driverNameInput.trim(),
        vehicle_number: vehicleNoInput.trim() || null,
        settlement_date: selectedDate,
        amount_in_hand: val,
        expected_amount: parseFloat(expectedAmountInput) || 0,
        payment_mode: paymentModeInput,
        received_by: receivedByInput.trim() || 'Office Cashier',
        notes: notesInput.trim() || null
      });

      toast(`Cash handover of ₹${val.toFixed(2)} recorded for ${driverNameInput}`, 'success');
      setHandoverModalOpen(false);
      loadData(selectedDate);
    } catch (err: any) {
      toast(err?.message || 'Failed to save driver handover', 'error');
    } finally {
      setSavingHandover(false);
    }
  };

  const handleDeleteHandover = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recorded handover?')) return;
    try {
      await api.delete(`/reports/driver-handovers/${id}`);
      toast('Driver handover record removed', 'success');
      setHandoverModalOpen(false);
      loadData(selectedDate);
    } catch {
      toast('Failed to delete handover', 'error');
    }
  };

  const handleExportCSV = () => {
    if (!data) return;
    const headers = ['Driver Name', 'Vehicle No', 'Trips', 'Cash to Collect', 'Amount Given in Hand', 'UPI on Site', 'Status', 'Received By'];
    const rows = data.drivers_summary.map(d => [
      `"${d.driver_name}"`,
      `"${d.vehicle_number}"`,
      d.trips,
      d.cash_collected.toFixed(2),
      (d.handover?.amount_in_hand ?? 0).toFixed(2),
      d.upi_collected.toFixed(2),
      d.handover ? 'Received in Office' : 'Pending Handover',
      `"${d.handover?.received_by || '—'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Anbu_Traders_Settlement_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalDriverCash = data?.drivers_summary.reduce((s, d) => s + d.cash_collected, 0) || 0;
  const totalHandoverInHand = data?.total_handover_received || 0;
  const totalUpi = (data?.payment_modes['UPI / GPay'] || data?.payment_modes['UPI'] || 0) + (data?.drivers_summary.reduce((s, d) => s + d.upi_collected, 0) || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <DollarSign className="text-emerald-600" size={24} />
            {t('daily_collection_title')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Reconcile physical cash given in hand by delivery drivers, on-site UPI payments, and customer dues.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-1 shadow-sm">
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                selectedDate === new Date().toISOString().split('T')[0]
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 1);
                setSelectedDate(d.toISOString().split('T')[0]);
              }}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition"
            >
              Yesterday
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-bold bg-transparent px-2 py-1 outline-none text-slate-700 dark:text-slate-200"
            />
          </div>

          <button
            onClick={() => loadData(selectedDate)}
            className="p-2 text-slate-500 hover:text-amber-600 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={openGeneralHandover}
            className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            title="Record Driver Cash Handover"
          >
            <Plus size={15} /> Record Driver Handover
          </button>

          <button
            onClick={handleExportCSV}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
            title="Export CSV"
          >
            <Download size={14} /> Export CSV
          </button>

          <button
            onClick={() => window.print()}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 print:hidden shadow-sm"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-emerald-50/60 to-white dark:from-slate-900 dark:to-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
              {t('total_collected_today')}
            </span>
            <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign size={18} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 mt-2">
            ₹{(data?.total_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            {data?.total_bills_count || 0} Bills Settled
          </p>
        </div>

        <div className="card p-4 border-2 border-emerald-300 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/80 to-teal-50/40 dark:from-slate-900 dark:to-emerald-950/40 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">
              💵 Handed In Office
            </span>
            <div className="h-8 w-8 rounded-lg bg-emerald-200 dark:bg-emerald-900/70 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold">
              <UserCheck size={18} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-800 dark:text-emerald-300 mt-2">
            ₹{totalHandoverInHand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-0.5">
            Given in hand to office / Expected: ₹{totalDriverCash.toLocaleString('en-IN')}
          </p>
        </div>

        <div className="card p-4 border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-blue-50/50 to-white dark:from-slate-900 dark:to-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-800 dark:text-blue-400 uppercase tracking-wider">
              {t('upi_collected')}
            </span>
            <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Smartphone size={18} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 mt-2">
            ₹{totalUpi.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            GPay / PhonePe / Online Direct
          </p>
        </div>

        <div className="card p-4 border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-rose-50/50 to-white dark:from-slate-900 dark:to-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-800 dark:text-rose-400 uppercase tracking-wider">
              {t('credit_extended')}
            </span>
            <div className="h-8 w-8 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <CreditCard size={18} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
            ₹{(data?.total_pending || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Added to Customer Credit Dues
          </p>
        </div>
      </div>

      <div className="card overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Truck size={18} className="text-amber-600" />
              {t('driver_settlement_table')}
            </h2>
            <p className="text-xs text-slate-500">Record and track actual cash handed in hand to the office by delivery drivers</p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
            {data?.drivers_summary.length || 0} Drivers Active Today
          </span>
        </div>

        {data?.drivers_summary.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No driver deliveries recorded for {selectedDate}.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data?.drivers_summary.map((d) => {
              const handover = d.handover;
              const hasHandover = !!handover;
              const inHandAmt = handover?.amount_in_hand ?? 0;
              const diff = inHandAmt - d.cash_collected;
              const isExpanded = expandedDriver === d.driver_id;

              return (
                <div key={d.driver_id} className="p-4 transition hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
                        <Truck size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-black text-slate-800 dark:text-slate-100">{d.driver_name}</p>
                          <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400 font-bold">
                            {d.vehicle_number}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {d.trips} {d.trips === 1 ? 'Trip' : 'Trips'} Completed Today
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Expected Cash</p>
                        <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                          ₹{d.cash_collected.toFixed(2)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Given in Hand</p>
                        {hasHandover ? (
                          <div>
                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                              ₹{inHandAmt.toFixed(2)}
                            </p>
                            {diff !== 0 && (
                              <p className={`text-[10px] font-bold ${diff < 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                                {diff < 0 ? `Shortage: -₹${Math.abs(diff).toFixed(2)}` : `Excess: +₹${diff.toFixed(2)}`}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 italic">
                            Not Handed Over
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => openDriverHandover(d)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
                          hasHandover
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-200'
                            : 'bg-amber-50 text-amber-800 dark:bg-slate-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-100'
                        }`}
                      >
                        {hasHandover ? (
                          <>
                            <CheckCircle2 size={14} className="text-emerald-600" />
                            Edit Handover
                          </>
                        ) : (
                          <>
                            <IndianRupee size={14} className="text-amber-600" />
                            Enter Amount in Hand
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => setExpandedDriver(isExpanded ? null : d.driver_id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Show trips"
                      >
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && d.bills.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 rounded-xl p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Trip Invoices Breakdown</p>
                        {handover?.received_by && (
                          <span className="text-[11px] text-slate-500">
                            Cashier: <strong>{handover.received_by}</strong> {handover.notes ? `• Note: "${handover.notes}"` : ''}
                          </span>
                        )}
                      </div>
                      <div className="divide-y divide-slate-200/60 dark:divide-slate-800">
                        {d.bills.map((b) => (
                          <div key={b.bill_id} className="py-2 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono mr-2">{b.dispatch_no}</span>
                              <span className="text-slate-600 dark:text-slate-400">{b.customer_name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500">
                                {b.payment_method}
                              </span>
                              <span className="font-bold text-slate-800 dark:text-slate-100">
                                Paid: ₹{b.paid_amount.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={handoverModalOpen}
        onClose={() => setHandoverModalOpen(false)}
        title="💵 Record Driver Cash Handover to Office"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter the exact physical cash amount handed in hand to the office by the delivery driver for <strong>{selectedDate}</strong>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Driver Name *</label>
              <input
                type="text"
                value={driverNameInput}
                onChange={(e) => setDriverNameInput(e.target.value)}
                placeholder="e.g. Ramesh"
                className="input font-semibold"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Vehicle Number</label>
              <input
                type="text"
                value={vehicleNoInput}
                onChange={(e) => setVehicleNoInput(e.target.value.toUpperCase())}
                placeholder="e.g. TN 32 AB 1234"
                className="input uppercase font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-emerald-50/50 dark:bg-slate-900 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-950">
            <div>
              <label className="label text-emerald-900 dark:text-emerald-300">Expected Delivery Cash (₹)</label>
              <div className="relative">
                <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  value={expectedAmountInput}
                  onChange={(e) => setExpectedAmountInput(e.target.value)}
                  placeholder="0.00"
                  className="input pl-8 font-bold bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="label text-emerald-900 dark:text-emerald-300">Amount Given in Hand (₹) *</label>
              <div className="relative">
                <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  value={amountInHandInput}
                  onChange={(e) => setAmountInHandInput(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="any"
                  className="input pl-8 font-black text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-800 text-base"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Payment Mode</label>
              <select
                value={paymentModeInput}
                onChange={(e) => setPaymentModeInput(e.target.value)}
                className="input font-semibold"
              >
                <option value="cash">Cash (In Hand)</option>
                <option value="upi">UPI / Online Direct</option>
                <option value="cheque">Cheque Handover</option>
              </select>
            </div>
            <div>
              <label className="label">Received By (Office Staff / Cashier)</label>
              <input
                type="text"
                value={receivedByInput}
                onChange={(e) => setReceivedByInput(e.target.value)}
                placeholder="Cashier Name"
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">Notes / Remarks (Optional)</label>
            <input
              type="text"
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder="e.g. ₹200 fuel deduction or full settlement"
              className="input"
            />
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-700">
            {selectedDriverSummary?.handover?.id ? (
              <button
                type="button"
                onClick={() => handleDeleteHandover(selectedDriverSummary.handover!.id!)}
                className="btn-secondary text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs"
              >
                Delete Record
              </button>
            ) : <div />}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setHandoverModalOpen(false)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveHandover}
                disabled={savingHandover}
                className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700 font-bold text-white shadow-sm"
              >
                {savingHandover ? 'Saving...' : 'Save Handover'}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
