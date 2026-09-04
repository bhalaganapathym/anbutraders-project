import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n';
import Modal from '@/components/Modal';
import { openWhatsApp, DEFAULT_COMPANY_IMAGE_URL } from '@/lib/whatsapp';
import html2canvas from 'html2canvas';
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
  ExternalLink,
  Image as ImageIcon,
  Share2,
  MapPin
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
  credit_due_date?: string | null;
  credit_days?: number | null;
  running_balance: number;
}

interface CustomerLedgerData {
  customer: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    delivery_addresses?: string[] | null;
    credit_due_date?: string | null;
    pending_amount: number;
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
  const [exportingImage, setExportingImage] = useState(false);
  const statementCardRef = useRef<HTMLDivElement>(null);
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

  const generateStatementImageBlob = async (): Promise<Blob | null> => {
    if (!statementCardRef.current) return null;
    try {
      const canvas = await html2canvas(statementCardRef.current, { scale: 2 });
      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      });
    } catch {
      return null;
    }
  };

  const handleSendReminder = async () => {
    if (!data) return;
    const phone = data.customer.phone;
    if (!phone) {
      toast('Customer phone number not available', 'error');
      return;
    }

    const agreedDueDate = data.customer.credit_due_date
      ? new Date(data.customer.credit_due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : null;

    let dueDateClause = '';
    if (agreedDueDate) {
      dueDateClause = `\n📅 *Agreed Payment Due Date:* ${agreedDueDate}\n`;
    }

    const msg = `🏗️ *ANBU TRADERS - Payment Statement & Reminder* 🧾
────────────────────────────────────────
Dear *${data.customer.name}*,
Here is your current statement summary with Anbu Traders:

📦 *Total Purchases Billed:* ₹${data.total_billed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
✅ *Total Payments Received:* ₹${data.total_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
🔴 *Current Outstanding Dues:* *₹${data.total_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}*
${dueDateClause}
💳 *GPay / PhonePe / UPI:* 9626325204
📞 *Office Phone:* 0413-2964204 / 9626325204

Kindly arrange payment at your earliest convenience.
_Thank you for your business!_`;

    // Try copying statement image to clipboard
    try {
      const blob = await generateStatementImageBlob();
      if (blob && navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({ 'image/png': blob })
        ]);
        toast('WhatsApp opened! Statement Image copied to clipboard — press Paste (Ctrl+V) in chat to attach.', 'success');
      } else {
        toast('WhatsApp reminder opened with prefilled message', 'success');
      }
    } catch {
      toast('WhatsApp reminder opened', 'success');
    }

    openWhatsApp(phone, msg);
  };

  const handleShareNativeImage = async () => {
    if (!data) return;
    setExportingImage(true);
    try {
      const blob = await generateStatementImageBlob();
      if (!blob) {
        toast('Could not generate image', 'error');
        return;
      }
      const file = new File([blob], `Statement_${data.customer.name.replace(/\s+/g, '_')}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Anbu Traders - Statement for ${data.customer.name}`,
          text: `Payment Statement for ${data.customer.name} - Outstanding: ₹${data.total_balance.toFixed(2)}`,
          files: [file]
        });
        toast('Shared statement image', 'success');
      } else {
        // Download as fallback
        handleDownloadImage();
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') toast('Share failed', 'error');
    } finally {
      setExportingImage(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!data) return;
    setExportingImage(true);
    try {
      const blob = await generateStatementImageBlob();
      if (!blob) throw new Error('Render error');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Statement_${data.customer.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast('Statement image downloaded', 'success');
    } catch {
      toast('Failed to download image', 'error');
    } finally {
      setExportingImage(false);
    }
  };

  const handleExportCSV = () => {
    if (!data) return;
    const headers = ['Date', 'Dispatch No', 'Payment Mode', 'Credit Due Date', 'Billed Amount', 'Paid Amount', 'Pending Amount', 'Running Balance'];
    const rows = data.transactions.map(t => [
      t.date ? new Date(t.date).toLocaleDateString() : '—',
      `"${t.dispatch_no}"`,
      `"${t.payment_method}"`,
      t.credit_due_date ? new Date(t.credit_due_date).toLocaleDateString() : '—',
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
      size="lg"
    >
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading customer ledger...</div>
      ) : !data ? (
        <div className="p-6 text-center text-xs text-rose-500">Failed to load customer records.</div>
      ) : (
        <div className="space-y-5">
          {/* Customer Summary Cards */}
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

          {/* Saved Delivery & Site Locations stored in Ledger */}
          {data.customer.delivery_addresses && data.customer.delivery_addresses.length > 0 && (
            <div className="p-3 bg-blue-50/60 dark:bg-slate-800/60 rounded-xl border border-blue-200 dark:border-slate-700 space-y-2">
              <p className="text-xs font-black text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <MapPin size={14} className="text-rose-500" />
                லெட்ஜரில் சேமிக்கப்பட்ட தள முகவரிகள் (Saved Site Locations in Ledger):
              </p>
              <div className="flex flex-wrap gap-2">
                {data.customer.delivery_addresses.map((addr, i) => (
                  <div 
                    key={i} 
                    className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 shadow-sm"
                  >
                    <span className="text-rose-500">📍</span>
                    <span>{addr}</span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr.replace(/\(GPS:.*?\)/, '').trim() || addr)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-[10px] font-bold underline ml-1"
                    >
                      Maps
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500">
              <span className="font-bold text-slate-700 dark:text-slate-300">{data.transactions.length}</span> Invoices / Transactions
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {data.total_balance > 0 && (
                <button
                  onClick={handleSendReminder}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 shadow-sm transition"
                  title="Opens WhatsApp with pre-filled message & copies statement image to clipboard (Ctrl+V)"
                >
                  <MessageSquare size={14} /> WhatsApp Dues Reminder
                </button>
              )}

              <button
                onClick={handleDownloadImage}
                disabled={exportingImage}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300"
                title="Download statement image to send as photo"
              >
                <ImageIcon size={14} /> {exportingImage ? 'Generating...' : 'Download Image'}
              </button>

              <button
                onClick={handleShareNativeImage}
                disabled={exportingImage}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                title="Share statement image directly via mobile share"
              >
                <Share2 size={14} /> Share Photo
              </button>

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
                  <th className="p-2.5">Due Date</th>
                  <th className="p-2.5 text-right">Billed (₹)</th>
                  <th className="p-2.5 text-right">Paid (₹)</th>
                  <th className="p-2.5 text-right">Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
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
                      <td className="p-2.5 text-slate-500 whitespace-nowrap">
                        {tx.credit_due_date ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            {new Date(tx.credit_due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            {tx.credit_days ? ` (${tx.credit_days}d)` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
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

          {/* Hidden Statement Card for High-Res Image Generation */}
          <div className="fixed top-[-9999px] left-[-9999px]">
            <div ref={statementCardRef} className="w-[650px] bg-white text-slate-900 p-6 rounded-2xl shadow-xl font-sans space-y-4 border border-slate-200">
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-wide">ANBU TRADERS</h1>
                  <p className="text-xs text-slate-500">Building Materials, Steel & Cement</p>
                  <p className="text-xs text-slate-500">Ph: 0413-2964204 / 9626325204</p>
                </div>
                <div className="text-right">
                  <span className="bg-amber-100 text-amber-900 font-bold px-3 py-1 rounded-full text-xs uppercase">Statement of Account</span>
                  <p className="text-xs text-slate-400 mt-1">Date: {new Date().toLocaleDateString('en-IN')}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Customer</span>
                  <p className="text-base font-bold text-slate-900">{data.customer.name}</p>
                  <p className="text-xs text-slate-500">Ph: {data.customer.phone || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-rose-500 uppercase">Total Outstanding Dues</span>
                  <p className="text-2xl font-black text-rose-600">₹{data.total_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-slate-500">Total Billed:</span>
                  <p className="text-sm font-bold text-slate-800">₹{data.total_billed.toFixed(2)}</p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <span className="text-emerald-700">Total Paid:</span>
                  <p className="text-sm font-bold text-emerald-800">₹{data.total_paid.toFixed(2)}</p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-xs text-slate-500">
                <p>UPI / GPay: <strong>9626325204</strong></p>
                <p className="italic">Thank you for choosing Anbu Traders!</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
