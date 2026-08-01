import { useCallback, useEffect, useState } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import { api, type Customer } from '@/lib/api';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { Pencil, Plus, Search, Trash2, Users, Phone, MapPin } from 'lucide-react';

type Form = { name: string; phone: string; address: string };
const empty: Form = { name: '', phone: '', address: '' };

export default function Customers() {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/customers');
      setCustomers(data);
    } catch (e) {
      toast('Failed to load customers', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime('customers', load);

  const filtered = customers.filter((c) =>
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
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/customers/${editing.id}`, { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() });
        toast('Customer updated', 'success');
      } else {
        await api.post('/customers', { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() });
        toast('Customer added', 'success');
      }
      setOpen(false);
      load();
    } catch (e) {
      toast('Failed to save customer', 'error');
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
    } catch (e) {
      toast('Failed to delete customer', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
          <p className="text-sm text-slate-500">Manage your shop customers</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customers..."
          className="input pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <Users size={36} className="text-slate-300" />
          <p className="text-slate-500">No customers found.</p>
          <button onClick={openNew} className="btn-primary">
            <Plus size={16} /> Add your first customer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <div key={c.id} className="card p-5 transition hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(c.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="btn-ghost p-1.5" aria-label="Edit">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => remove(c)} className="btn-ghost p-1.5 text-rose-500 hover:bg-rose-50" aria-label="Delete">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-slate-600">
                {c.phone && (
                  <p className="flex items-center gap-2">
                    <Phone size={14} className="text-slate-400" /> {c.phone}
                  </p>
                )}
                {c.address && (
                  <p className="flex items-center gap-2">
                    <MapPin size={14} className="text-slate-400" /> {c.address}
                  </p>
                )}
                {!c.phone && !c.address && <p className="text-slate-400">No contact details</p>}
              </div>
            </div>
          ))}
        </div>
      )}

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
    </div>
  );
}
