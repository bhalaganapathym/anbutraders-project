import { useCallback, useEffect, useState } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import { api, type Customer } from '@/lib/api';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n';
import CustomerLedgerModal from '@/components/CustomerLedgerModal';
import { openWhatsApp, shareWhatsAppWithMedia, DEFAULT_COMPANY_IMAGE_URL } from '@/lib/whatsapp';
import { 
  Pencil, 
  Plus, 
  Search, 
  Trash2, 
  Users, 
  Phone, 
  MapPin, 
  FileText, 
  MessageSquare, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

type Form = { name: string; phone: string; address: string };
const empty: Form = { name: '', phone: '', address: '' };

export default function Customers() {
  const toast = useToast();
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'dues' | 'settled'>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/customers');
      setCustomers(data);
    } catch {
      toast('Failed to load customers', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime('customers', load);

  const duesCustomers = customers.filter(c => Number(c.pending_amount || 0) > 0);
  const settledCustomers = customers.filter(c => Number(c.pending_amount || 0) <= 0);

  const filtered = customers
    .filter((c) => {
      if (filterMode === 'dues') return Number(c.pending_amount || 0) > 0;
      if (filterMode === 'settled') return Number(c.pending_amount || 0) <= 0;
      return true;
    })
    .filter((c) =>
      [c.name, c.phone ?? '', c.address ?? ''].join(' ').toLowerCase().includes(query.toLowerCase())
    );

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone ?? '', address: c.address ?? '' });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      toast('Name, phone, and address are all required', 'error');
      return;
    }
    const cleanPhone = form.phone.trim();
    const existingPhone = customers.find(c => c.phone === cleanPhone && c.id !== editing?.id);
    if (existingPhone) {
      toast(`Phone number is already used by ${existingPhone.name}`, 'error');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/customers/${editing.id}`, { name: form.name.trim(), phone: cleanPhone, address: form.address.trim() });
        toast('Customer updated', 'success');
      } else {
        await api.post('/customers', { name: form.name.trim(), phone: cleanPhone, address: form.address.trim() });
        toast('Customer added', 'success');
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast(e.message || 'Failed to save customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Customer) => {
    if (!confirm(`Delete customer "${c.name}"? This also deletes their orders.`)) return;
    try {
      await api.delete(`/customers/${c.id}`);
      toast('Customer deleted', 'success');
      load();
    } catch {
      toast('Failed to delete customer', 'error');
    }
  };

  const sendDirectReminder = (c: Customer) => {
    const pending = Number(c.pending_amount || 0);
    if (!c.phone) {
      toast('Customer phone number not available', 'error');
      return;
    }
    const msg = `🏗️ *ANBU TRADERS - Payment Reminder* 🧾
────────────────────────────────────────
Dear *${c.name}*,
Friendly reminder from Anbu Traders regarding your outstanding dues.

🔴 *Outstanding Balance:* *₹${pending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}*

💳 *UPI / GPay:* 9626325204
📞 *Office Contact:* 0413-2964204 / 9626325204

Kindly settle the balance at your earliest convenience.
_Thank you for choosing Anbu Traders!_`;

    openWhatsApp(c.phone, msg);
    toast(`WhatsApp payment reminder opened for ${c.name}`, 'success');
  };

  const totalOutstandingAll = customers.reduce((s, c) => s + Number(c.pending_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="text-amber-600" size={24} />
            {t('customers')} & {t('customer_ledger')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Total Market Dues Outstanding: <strong className="text-rose-600">₹{totalOutstandingAll.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-1.5 shadow-sm">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterMode('all')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition shadow-sm ${
              filterMode === 'all'
                ? 'bg-amber-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            All ({customers.length})
          </button>
          <button
            onClick={() => setFilterMode('dues')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition shadow-sm ${
              filterMode === 'dues'
                ? 'bg-rose-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            With Dues ({duesCustomers.length})
          </button>
          <button
            onClick={() => setFilterMode('settled')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition shadow-sm ${
              filterMode === 'settled'
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            Settled ({settledCustomers.length})
          </button>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone, address..."
            className="input pl-9 text-xs"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading customers...</p>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <Users size={36} className="text-slate-300" />
          <p className="text-slate-500 dark:text-slate-400">No customers match your filter.</p>
          <button onClick={openNew} className="btn-primary">
            <Plus size={16} /> Add new customer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const pending = Number(c.pending_amount || 0);
            return (
              <div key={c.id} className="card p-5 transition hover:shadow-md border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-slate-800 text-sm font-extrabold text-amber-700 dark:text-amber-400 shadow-inner mt-0.5">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 dark:text-slate-100 break-words leading-snug">{c.name}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Added {new Date(c.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5 ml-1">
                      <button onClick={() => openEdit(c)} className="btn-ghost p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" aria-label="Edit" title="Edit Customer">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => remove(c)} className="btn-ghost p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30" aria-label="Delete" title="Delete Customer">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    {c.phone && (
                      <p className="flex items-center gap-2">
                        <Phone size={13} className="text-slate-400 shrink-0" /> 
                        <a href={`tel:${c.phone}`} className="hover:underline font-mono">{c.phone}</a>
                      </p>
                    )}
                    {c.address && (
                      <p className="flex items-center gap-2">
                        <MapPin size={13} className="text-slate-400 shrink-0" /> 
                        <span className="truncate">{c.address}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Balance Dues:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                      pending > 0 
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' 
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}>
                      ₹{pending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Action Buttons: Statement & WhatsApp Reminder */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => setSelectedLedgerId(c.id)}
                      className="btn-secondary text-[11px] py-1.5 px-2 flex items-center justify-center gap-1 font-bold"
                    >
                      <FileText size={13} /> Statement
                    </button>

                    {pending > 0 ? (
                      <button
                        onClick={() => sendDirectReminder(c)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] py-1.5 px-2 flex items-center justify-center gap-1 font-bold shadow-sm transition"
                        title="Send WhatsApp Dues Reminder"
                      >
                        <MessageSquare size={13} /> Reminder
                      </button>
                    ) : (
                      <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg">
                        <CheckCircle2 size={13} /> Settled
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Customer Add / Edit Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Customer' : 'Add Customer'}>
        <div className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="Customer name"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Phone *</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input"
              placeholder="Phone number"
            />
          </div>
          <div>
            <label className="label">Address *</label>
            <textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="input min-h-[80px]"
              placeholder="Delivery address"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Customer Ledger Statement Modal */}
      <CustomerLedgerModal
        customerId={selectedLedgerId}
        onClose={() => setSelectedLedgerId(null)}
      />
    </div>
  );
}
