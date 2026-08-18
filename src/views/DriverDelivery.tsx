import { useState, useEffect, useRef } from 'react';
import { api, type Dispatch, type Driver } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useRealtime } from '@/lib/useRealtime';
import {
  Truck,
  Phone,
  MapPin,
  IndianRupee,
  Camera,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Package,
  Clock,
  User,
  Search,
  Upload,
  AlertCircle
} from 'lucide-react';
import Modal from '@/components/Modal';
import { openWhatsApp, buildDispatchWhatsAppMessage } from '@/lib/whatsapp';
import { useTranslation } from '@/lib/i18n';

export default function DriverDelivery() {
  const { t } = useTranslation();
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const toast = useToast();

  // POD Modal state
  const [completingDispatch, setCompletingDispatch] = useState<Dispatch | null>(null);
  const [podPhotoFile, setPodPhotoFile] = useState<File | null>(null);
  const [podPhotoPreview, setPodPhotoPreview] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<string>('cash');
  const [collectedAmount, setCollectedAmount] = useState<string>('');
  const [receiverNotes, setReceiverNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      const [dispData, driverData] = await Promise.all([
        api.get('/dispatches'),
        api.get('/drivers'),
      ]);
      setDispatches(dispData);
      setDrivers(driverData);
    } catch {
      toast('Failed to load delivery assignments', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useRealtime('dispatches', loadData);
  useRealtime('drivers', loadData);

  const filtered = dispatches
    .filter((d) => {
      if (activeTab === 'pending') {
        return d.status !== 'completed';
      }
      return d.status === 'completed';
    })
    .filter((d) => {
      if (selectedDriverId === 'all') return true;
      const drv = drivers.find(dr => dr.id === selectedDriverId);
      if (!drv) return true;
      return d.driver_name === drv.name || d.driver_mobile === drv.phone_number;
    })
    .filter((d) => {
      const q = query.toLowerCase();
      return (
        d.dispatch_no.toLowerCase().includes(q) ||
        (d.customer?.name || '').toLowerCase().includes(q) ||
        (d.customer?.phone || '').includes(q) ||
        (d.vehicle_number || '').toLowerCase().includes(q) ||
        (d.delivery_address || '').toLowerCase().includes(q)
      );
    });

  const openPODModal = (d: Dispatch) => {
    setCompletingDispatch(d);
    setPodPhotoFile(null);
    setPodPhotoPreview(null);
    setReceiverNotes('');
    setPaymentMode('cash');

    const total = d.bill?.total_amount ?? (d.items?.reduce((s, it) => s + (it.price || 0) * (it.quantity || 1), 0) || 0);
    const paid = d.bill?.paid_amount ?? 0;
    const balance = d.bill?.pending_amount ?? Math.max(0, total - paid);
    setCollectedAmount(String(balance));
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPodPhotoFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setPodPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCompleteDelivery = async () => {
    if (!completingDispatch) return;
    setSubmitting(true);

    try {
      let photoUrl = completingDispatch.vehicle_leave_photo_url || null;

      if (podPhotoFile) {
        photoUrl = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(podPhotoFile);
        });
      }

      const notesSummary = [
        completingDispatch.notes || '',
        `POD: Delivered to site. Payment collected: ₹${collectedAmount} via ${paymentMode.toUpperCase()}.`,
        receiverNotes ? `Notes: ${receiverNotes}` : ''
      ].filter(Boolean).join(' | ');

      await api.put(`/dispatches/${completingDispatch.id}`, {
        ...completingDispatch,
        status: 'completed',
        vehicle_leave_photo_url: photoUrl,
        notes: notesSummary,
      });

      toast(`Delivery for ${completingDispatch.dispatch_no} completed! Driver is now Free.`, 'success');
      setCompletingDispatch(null);
      loadData();
    } catch (err: any) {
      toast(err?.message || 'Failed to complete delivery', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6">Loading delivery tasks...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 lg:pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Truck size={26} className="text-amber-600" />
            {t('delivery_pod')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('driver_portal_title')}
          </p>
        </div>
      </div>

      {/* Driver Filter & Search Bar */}
      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border border-slate-200 dark:border-slate-800">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
            <User size={14} /> {t('drivers')}
          </label>
          <select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            className="input text-sm font-semibold"
          >
            <option value="all">🚚 {t('all')} {t('drivers')}</option>
            {drivers.map((drv) => (
              <option key={drv.id} value={drv.id}>
                {drv.name} ({drv.phone_number}) — {drv.status === 'engaged' ? '🟡 On Delivery' : '🟢 Free'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
            <Search size={14} /> {t('search')}
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search')}
            className="input text-sm"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-2.5 px-2 font-bold text-sm border-b-2 transition flex items-center gap-2 ${
            activeTab === 'pending'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <Truck size={16} /> {t('pending_deliveries')} ({dispatches.filter((d) => d.status !== 'completed').length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`pb-2.5 px-2 font-bold text-sm border-b-2 transition flex items-center gap-2 ${
            activeTab === 'completed'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <CheckCircle2 size={16} /> {t('completed_deliveries')} ({dispatches.filter((d) => d.status === 'completed').length})
        </button>
      </div>

      {/* Deliveries List */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-slate-500 space-y-2">
          <Truck size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
          <p className="font-semibold text-base">No {activeTab} deliveries found.</p>
          <p className="text-xs text-slate-400">All assigned truck deliveries will appear here in real time.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((d) => {
            const total = d.bill?.total_amount ?? (d.items?.reduce((s, it) => s + (it.price || 0) * (it.quantity || 1), 0) || 0);
            const paid = d.bill?.paid_amount ?? 0;
            const balance = d.bill?.pending_amount ?? Math.max(0, total - paid);
            const customerPhone = d.customer?.phone || '';
            const deliveryAddress = d.delivery_address || d.customer?.address || '';

            return (
              <div
                key={d.id}
                className="card p-5 border border-slate-200 dark:border-slate-800 space-y-4 hover:shadow-md transition"
              >
                {/* Top header */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded-md">
                      {d.dispatch_no}
                    </span>
                    <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 mt-1">
                      {d.customer?.name || 'Customer'}
                    </h3>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${
                        d.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                      }`}
                    >
                      {d.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Driver & Vehicle Tag */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg text-xs space-y-1 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Truck size={14} className="text-amber-600" />
                      Vehicle: <span className="font-mono">{d.vehicle_number || '—'}</span>
                    </span>
                    <span className="font-medium text-slate-500">
                      Driver: {d.driver_name || 'Unassigned'}
                    </span>
                  </div>
                </div>

                {/* Balance Amount to Collect Callout */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-900 dark:to-slate-900 border-2 border-amber-300/80 dark:border-amber-700/60 p-3 rounded-xl flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-[11px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wide">
                      Cash to Collect on Site
                    </p>
                    <p className="text-xs text-slate-500">
                      Total: ₹{total.toFixed(2)} | Paid: ₹{paid.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                      ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Delivery Address & Quick Navigation */}
                {deliveryAddress && (
                  <div className="space-y-1.5 text-xs">
                    <p className="text-slate-500 font-medium flex items-center gap-1">
                      <MapPin size={14} className="text-slate-400 shrink-0" />
                      {deliveryAddress}
                    </p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deliveryAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                    >
                      <ExternalLink size={12} /> Open in Google Maps
                    </a>
                  </div>
                )}

                {/* Items preview */}
                <div className="text-xs text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-slate-900/30 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  <p className="font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Package size={13} /> Goods Loaded ({d.items?.length || 0} item types):
                  </p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {d.items?.map((it, i) => (
                      <li key={it.id || i} className="truncate">
                        <span className="font-semibold">{it.quantity} {it.unit || 'nos'}</span> {it.product_name}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 1-Tap Action Buttons */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                  {customerPhone && (
                    <>
                      <a
                        href={`tel:${customerPhone}`}
                        className="btn-secondary py-2 px-3 text-xs flex-1 flex items-center justify-center gap-1.5 font-bold"
                      >
                        <Phone size={14} className="text-emerald-600" /> Call ({customerPhone})
                      </a>

                      <button
                        onClick={() => {
                          const msg = buildDispatchWhatsAppMessage(d, undefined, d.customer, d.bill);
                          openWhatsApp(customerPhone, msg);
                        }}
                        className="btn-secondary py-2 px-3 text-xs flex items-center justify-center gap-1.5 text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 font-semibold"
                        title="Send WhatsApp Alert"
                      >
                        <MessageSquare size={14} /> WhatsApp
                      </button>
                    </>
                  )}

                  {d.status !== 'completed' && (
                    <button
                      onClick={() => openPODModal(d)}
                      className="btn-primary py-2 px-4 text-xs font-bold flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                    >
                      <Camera size={14} /> Complete & POD
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PROOF OF DELIVERY (POD) MODAL */}
      <Modal
        open={!!completingDispatch}
        onClose={() => setCompletingDispatch(null)}
        title={`Proof of Delivery - ${completingDispatch?.dispatch_no}`}
        size="md"
      >
        {completingDispatch && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg text-xs space-y-1 border border-slate-200 dark:border-slate-700">
              <p><span className="font-bold text-slate-800 dark:text-slate-200">Customer:</span> {completingDispatch.customer?.name}</p>
              <p><span className="font-bold text-slate-800 dark:text-slate-200">Address:</span> {completingDispatch.delivery_address || completingDispatch.customer?.address || 'Site Delivery'}</p>
              <p><span className="font-bold text-slate-800 dark:text-slate-200">Assigned Driver:</span> {completingDispatch.driver_name || 'Driver'}</p>
            </div>

            {/* Payment Collection Confirmation */}
            <div className="bg-amber-50 dark:bg-slate-900 border border-amber-200 dark:border-slate-700 p-3.5 rounded-xl space-y-3">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <IndianRupee size={14} className="text-amber-600" /> Amount Collected from Customer (₹)
              </label>
              <div className="relative">
                <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  value={collectedAmount}
                  onChange={(e) => setCollectedAmount(e.target.value)}
                  className="input pl-8 text-base font-extrabold text-emerald-700 dark:text-emerald-400"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Received Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="input text-xs font-semibold"
                >
                  <option value="cash">💵 Cash Payment on Site</option>
                  <option value="gpay_upi">📱 GPay / PhonePe / UPI on Site</option>
                  <option value="office_paid">🏢 Already Paid to Office</option>
                  <option value="credit">📒 Customer Account / Credit</option>
                </select>
              </div>
            </div>

            {/* Photo Capture */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                <Camera size={14} /> Site Delivery Photo / Unloaded Materials
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="hidden"
              />

              {podPhotoPreview ? (
                <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 h-44 bg-slate-900 flex items-center justify-center">
                  <img src={podPhotoPreview} alt="POD Preview" className="h-full w-full object-contain" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 backdrop-blur"
                  >
                    <Camera size={13} /> Retake
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-500 hover:border-amber-500 hover:text-amber-600 transition bg-slate-50 dark:bg-slate-900/50"
                >
                  <Camera size={26} />
                  <span className="text-xs font-semibold">Tap to Take Delivery Photo with Phone Camera</span>
                </button>
              )}
            </div>

            {/* Receiver Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Receiver Name / Delivery Notes (Optional)
              </label>
              <input
                type="text"
                value={receiverNotes}
                onChange={(e) => setReceiverNotes(e.target.value)}
                placeholder="e.g. Received by Site Supervisor Murugan"
                className="input text-xs"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setCompletingDispatch(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCompleteDelivery}
                disabled={submitting}
                className="btn-primary bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5 font-bold"
              >
                <CheckCircle2 size={16} /> {submitting ? 'Submitting POD...' : 'Confirm Delivery & Free Driver'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
