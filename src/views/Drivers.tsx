import { useState, useEffect } from 'react';
import { api, type Driver } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Search, Plus, Trash2, Edit2, Phone, RefreshCw } from 'lucide-react';
import Modal from '@/components/Modal';
import { useTranslation } from '@/lib/i18n';

export default function Drivers() {
  const { t } = useTranslation();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [status, setStatus] = useState<string>('free');

  const loadDrivers = async () => {
    try {
      const data = await api.get('/drivers');
      setDrivers(data);
    } catch {
      toast('Failed to load drivers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { name, phone_number: phone, vehicle_number: vehicle || null, status };
      if (editingDriver) {
        await api.put(`/drivers/${editingDriver.id}`, payload);
        toast('Driver updated successfully', 'success');
      } else {
        await api.post('/drivers', payload);
        toast('Driver added successfully', 'success');
      }
      setModalOpen(false);
      loadDrivers();
    } catch {
      toast('Failed to save driver', 'error');
    }
  };

  const toggleStatus = async (driver: Driver) => {
    const newStatus = driver.status === 'engaged' ? 'free' : 'engaged';
    try {
      await api.put(`/drivers/${driver.id}`, {
        name: driver.name,
        phone_number: driver.phone_number,
        vehicle_number: driver.vehicle_number,
        status: newStatus
      });
      toast(`Driver marked as ${newStatus}`, 'success');
      loadDrivers();
    } catch {
      toast('Failed to update driver status', 'error');
    }
  };

  const notifyDriverWhatsApp = (driver: Driver) => {
    const cleanPhone = driver.phone_number.replace(/[^0-9]/g, '');
    const text = 
`🚛 *அன்பு குரூப்ஸ் — டெலிவரி பணி ஒதுக்கீடு*
─────────────────────────────
வணக்கம் ${driver.name},

உங்களுக்கு புதிய டெலிவரி பணி ஒதுக்கப்பட்டுள்ளது.
வாகன எண்: ${driver.vehicle_number || 'N/A'}

பொருட்களை ஏற்றுவதற்கு குடோனுக்கு வரவும்.
─────────────────────────────
அன்பு குரூப்ஸ்`;

    const url = `https://wa.me/${cleanPhone ? (cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone) : ''}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this driver?')) return;
    try {
      await api.delete(`/drivers/${id}`);
      toast('Driver deleted', 'success');
      loadDrivers();
    } catch {
      toast('Failed to delete driver', 'error');
    }
  };

  const openModal = (driver?: Driver) => {
    if (driver) {
      setEditingDriver(driver);
      setName(driver.name);
      setPhone(driver.phone_number);
      setVehicle(driver.vehicle_number || '');
      setStatus(driver.status || 'free');
    } else {
      setEditingDriver(null);
      setName('');
      setPhone('');
      setVehicle('');
      setStatus('free');
    }
    setModalOpen(true);
  };

  const filtered = drivers.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.phone_number.includes(searchTerm) ||
    (d.vehicle_number || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-6">{t('loading')}</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t('drivers')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('company_tagline')}</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> {t('add')} {t('drivers')}
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder={t('search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Phone Number</th>
                <th className="px-6 py-4 font-semibold">Vehicle Number</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((driver) => {
                const isEngaged = driver.status === 'engaged';
                return (
                  <tr key={driver.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{driver.name}</td>
                    <td className="px-6 py-4">{driver.phone_number}</td>
                    <td className="px-6 py-4">
                      {driver.vehicle_number ? (
                        <span className="badge bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold">
                          {driver.vehicle_number}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          isEngaged 
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' 
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                        }`}>
                          {isEngaged ? '🟡 Engaged' : '🟢 Free'}
                        </span>
                        <button
                          onClick={() => toggleStatus(driver)}
                          className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5"
                          title="Toggle Free / Engaged"
                        >
                          <RefreshCw size={12} /> Toggle
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 items-center">
                        <button
                          onClick={() => notifyDriverWhatsApp(driver)}
                          className="btn-ghost p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 flex items-center gap-1 text-xs font-semibold"
                          title="Notify Driver on WhatsApp"
                        >
                          <Phone size={14} /> Notify
                        </button>
                        <button
                          onClick={() => openModal(driver)}
                          className="btn-ghost p-1.5"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(driver.id)}
                          className="btn-ghost p-1.5 text-rose-500 hover:bg-rose-50"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No drivers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingDriver ? "Edit Driver" : "Add Driver"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Driver Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Phone Number *</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Vehicle Number (Optional)</label>
            <input
              type="text"
              value={vehicle}
              onChange={e => setVehicle(e.target.value)}
              placeholder="e.g. TN-01-AB-1234"
              className="input"
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="input"
            >
              <option value="free">🟢 Free</option>
              <option value="engaged">🟡 Engaged</option>
            </select>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              {editingDriver ? 'Save Changes' : 'Add Driver'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
