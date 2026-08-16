import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n';
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
  Receipt
} from 'lucide-react';

interface DriverSummary {
  driver_id: string;
  driver_name: string;
  vehicle_number: string;
  trips: number;
  cash_collected: number;
  upi_collected: number;
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
  payment_modes: Record<string, number>;
  drivers_summary: DriverSummary[];
}

export default function DailyReconciliation() {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);
  const [verifiedDrivers, setVerifiedDrivers] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`verified_settlement_${selectedDate}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

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
    try {
      const saved = localStorage.getItem(`verified_settlement_${selectedDate}`);
      setVerifiedDrivers(saved ? new Set(JSON.parse(saved)) : new Set());
    } catch {
      setVerifiedDrivers(new Set());
    }
  }, [selectedDate, loadData]);

  const toggleDriverHandover = (driverId: string) => {
    const next = new Set(verifiedDrivers);
    if (next.has(driverId)) {
      next.delete(driverId);
    } else {
      next.add(driverId);
    }
    setVerifiedDrivers(next);
    localStorage.setItem(`verified_settlement_${selectedDate}`, JSON.stringify(Array.from(next)));
    toast(next.has(driverId) ? 'Cash handover marked as received' : 'Handover unmarked', 'success');
  };

  const handleExportCSV = () => {
    if (!data) return;
    const headers = ['Driver Name', 'Vehicle No', 'Trips', 'Cash Collected', 'UPI Collected', 'Status'];
    const rows = data.drivers_summary.map(d => [
      `"${d.driver_name}"`,
      `"${d.vehicle_number}"`,
      d.trips,
      d.cash_collected.toFixed(2),
      d.upi_collected.toFixed(2),
      verifiedDrivers.has(d.driver_id) ? 'Received' : 'Pending'
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
  const totalUpi = (data?.payment_modes['UPI / GPay'] || data?.payment_modes['UPI'] || 0) + (data?.drivers_summary.reduce((s, d) => s + d.upi_collected, 0) || 0);

  return (
    <div className="space-y-6">
      {/* Header & Date Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <DollarSign className="text-emerald-600" size={24} />
            {t('daily_collection_title')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Reconcile site cash collected by drivers, UPI payments, and end-of-day balances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Date Switchers */}
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
            onClick={handleExportCSV}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
            title="Export CSV"
          >
            <Download size={14} /> Export CSV
          </button>

          <button
            onClick={() => window.print()}
            className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 print:hidden shadow-sm"
          >
            <Printer size={14} /> Print Day Sheet
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4 border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-emerald-50/50 to-white dark:from-slate-900 dark:to-slate-800">
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

        <div className="card p-4 border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-amber-50/50 to-white dark:from-slate-900 dark:to-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
              {t('driver_cash_collected')}
            </span>
            <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Truck size={18} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 mt-2">
            ₹{totalDriverCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Cash in Hand with Drivers
          </p>
        </div>

        <div className="card p-4 border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-blue-50/50 to-white dark:from-slate-900 dark:to-slate-800">
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

        <div className="card p-4 border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-rose-50/50 to-white dark:from-slate-900 dark:to-slate-800">
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
            Added to Customer Dues
          </p>
        </div>
      </div>

      {/* Driver Collection Handover Table */}
      <div className="card overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Truck size={18} className="text-amber-600" />
            {t('driver_settlement_table')}
          </h2>
          <span className="text-xs font-semibold text-slate-500">
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
              const isReceived = verifiedDrivers.has(d.driver_id);
              const isExpanded = expandedDriver === d.driver_id;

              return (
                <div key={d.driver_id} className="p-4 transition hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                        <Truck size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{d.driver_name}</p>
                          <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400 font-bold">
                            {d.vehicle_number}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {d.trips} {d.trips === 1 ? 'Trip' : 'Trips'} Completed Today
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-6">
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Cash to Deposit</p>
                        <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                          ₹{d.cash_collected.toFixed(2)}
                        </p>
                      </div>

                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">UPI on Site</p>
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                          ₹{d.upi_collected.toFixed(2)}
                        </p>
                      </div>

                      {/* Handover Checkoff Button */}
                      <button
                        onClick={() => toggleDriverHandover(d.driver_id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
                          isReceived
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : 'bg-amber-50 text-amber-700 dark:bg-slate-800 dark:text-amber-400 border border-amber-200 dark:border-slate-700 hover:bg-amber-100'
                        }`}
                      >
                        {isReceived ? (
                          <>
                            <CheckCircle2 size={14} className="text-emerald-600" />
                            {t('verified_by_office')}
                          </>
                        ) : (
                          <>
                            <Clock size={14} className="text-amber-600" />
                            {t('pending_handover')}
                          </>
                        )}
                      </button>

                      {/* Expand Trip Details */}
                      <button
                        onClick={() => setExpandedDriver(isExpanded ? null : d.driver_id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Show trips"
                      >
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Trip Details Sub-list */}
                  {isExpanded && d.bills.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 rounded-xl p-3 space-y-2">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Trip Invoices Breakdown</p>
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
    </div>
  );
}
