import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n';
import Modal from '@/components/Modal';
import { openWhatsApp, DEFAULT_COMPANY_IMAGE_URL } from '@/lib/whatsapp';
import { 
  Users, 
  DollarSign, 
  MessageSquare, 
  Printer, 
  Download, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';

interface Transaction {
  bill_id: string;
  dispatch_no: string;
  dispatch_id: string | null;
  date: string | null;
  payment_method: string;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  running_balance: number;
}

interface CustomerLedgerData {
  customer: {
    id: string;
    name: string;
    phone: string;
    address: string;
  };
  total_billed: number;
  total_paid: number;
  total_balance: number;
  transactions: Transaction[];
}

interface Props {
  customerId: string | null;
  onClose: () => void;
}

export default function CustomerLedgerModal({ customerId, onClose }: Props) {
  const [data, setData] = useState<CustomerLedgerData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const toast = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    async function fetchLedger() {
      if (!customerId) return;
      setLoading(true);
      try {
        const res: any = await api.get(`/customers/${customerId}/ledger`);
        setData(res);
      } catch {
        toast('Failed to load customer statement', 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchLedger();
  }, [customerId, toast]);

  if (!customerId) return null;

  const handleSendReminder = () => {
    if (!data) return;
    const phone = data.customer.phone;
    if (!phone) {
      toast('Customer phone number not available', 'error');
      return;
    }

    const msg = `🏗️ *ANBU TRADERS - Payment Statement & Reminder* 🧾
----------------------------------------
Dear *${data.customer.name}*,
Here is your current statement summary with Anbu Traders:

📦 *Total Purchases Billed:* ₹${data.total_billed.toFixed(2)}
✅ *Total Payments Received:* ₹${data.total_paid.toFixed(2)}
🔴 *Current Outstanding Dues:* *₹${data.total_balance.toFixed(2)}*

🏢 *Company Verification & UPI Payment:*
${DEFAULT_COMPANY_IMAGE_URL}

💳 *GPay / PhonePe / UPI:* 9626325204
📞 *Office Phone:* 0413-2964204

Kindly arrange payment at your earliest convenience.
_Thank you for your business!_`;

    openWhatsApp(phone, msg);
    toast('WhatsApp payment reminder launched', 'success');
  };

  const handleExportCSV = () => {
    if (!data) return;
    const headers = ['Date', 'Dispatch No', 'Payment Mode', 'Billed Amount', 'Paid Amount', 'Pending Amount', 'Running Balance'];
    const rows = data.transactions.map(t => [
      t.date ? new Date(t.date).toLocaleDateString() : '—',
      `"${t.dispatch_no}"`,
      `"${t.payment_method}"`,
      t.total_amount.toFixed(2),
      t.paid_amount.toFixed(2),
      t.pending_amount.toFixed(2),
      t.running_balance.toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Statement_${data.customer.name}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Modal
      open={!!customerId}
      onClose={onClose}
      title={`${data?.customer?.name || 'Customer'} — Account Statement & Dues`}
    >
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading customer ledger...</div>
      ) : !data ? (
        <div className="p-6 text-center text-xs text-rose-500">Failed to load customer records.</div>
      ) : (
        <div className="space-y-5">
          {/* Customer Summary & Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="text-[10px] text-slate-400 font-bold uppercase">{t('total_billed')}</p>
              <p className="text-base font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                ₹{data.total_billed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <p className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold uppercase">{t('total_paid')}</p>
              <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
                ₹{data.total_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className={`p-3 rounded-xl border ${
              data.total_balance > 0
                ? 'bg-rose-50/50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800'
                : 'bg-emerald-50/50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
            }`}>
              <p className={`text-[10px] font-bold uppercase ${data.total_balance > 0 ? 'text-rose-800 dark:text-rose-400' : 'text-emerald-800 dark:text-emerald-400'}`}>
                {t('total_dues')}
              </p>
              <p className={`text-base font-extrabold mt-1 ${data.total_balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                ₹{data.total_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500">
              <span className="font-bold text-slate-700 dark:text-slate-300">{data.transactions.length}</span> Invoices / Transactions
            </div>

            <div className="flex items-center gap-2">
              {data.total_balance > 0 && (
                <button
                  onClick={handleSendReminder}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 shadow-sm transition"
                >
                  <MessageSquare size={14} /> WhatsApp Dues Reminder
                </button>
              )}

              <button
                onClick={handleExportCSV}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <Download size={14} /> CSV
              </button>

              <button
                onClick={() => window.print()}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <Printer size={14} /> Print
              </button>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="max-h-[350px] overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Dispatch Ref</th>
                  <th className="p-2.5">Mode</th>
                  <th className="p-2.5 text-right">Billed (₹)</th>
                  <th className="p-2.5 text-right">Paid (₹)</th>
                  <th className="p-2.5 text-right">Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400">
                      No invoices recorded for this customer yet.
                    </td>
                  </tr>
                ) : (
                  data.transactions.map((tx, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {tx.date ? new Date(tx.date).toLocaleDateString() : '—'}
                      </td>
                      <td className="p-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {tx.dispatch_no}
                      </td>
                      <td className="p-2.5 text-slate-500">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                          {tx.payment_method}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-semibold text-slate-800 dark:text-slate-200">
                        ₹{tx.total_amount.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right font-semibold text-emerald-600">
                        ₹{tx.paid_amount.toFixed(2)}
                      </td>
                      <td className={`p-2.5 text-right font-bold ${
                        tx.pending_amount > 0 ? 'text-rose-600' : 'text-slate-500'
                      }`}>
                        ₹{tx.pending_amount.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
