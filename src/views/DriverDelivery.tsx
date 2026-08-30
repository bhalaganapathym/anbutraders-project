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

export default function DriverDelivery() {
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
      toast('டெலிவரி பணிகளை ஏற்றுவதில் பிழை ஏற்பட்டது', 'error');
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
    setCollectedAmount(balance > 0 ? balance.toString() : '0');
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
        `POD: தளத்தில் பொருட்கள் இறக்கப்பட்டது. வசூலித்த தொகை: ₹${collectedAmount} (${paymentMode.toUpperCase()}).`,
        receiverNotes ? `குறிப்பு: ${receiverNotes}` : ''
      ].filter(Boolean).join(' | ');

      await api.put(`/dispatches/${completingDispatch.id}`, {
        ...completingDispatch,
        status: 'completed',
        vehicle_leave_photo_url: photoUrl,
        notes: notesSummary,
      });

      toast(`டெலிவரி (${completingDispatch.dispatch_no}) வெற்றிகரமாக முடிந்தது! ஓட்டுநர் தயார் நிலைக்கு மாற்றப்பட்டார்.`, 'success');
      setCompletingDispatch(null);
      loadData();
    } catch (err: any) {
      toast(err?.message || 'டெலிவரி முடிப்பதில் பிழை ஏற்பட்டது', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6 font-bold text-center">டெலிவரி பணிகள் ஏற்றப்படுகின்றன...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 lg:pb-8 font-sans">
      {/* தலைப்பு (Header) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Truck size={30} className="text-amber-600 animate-pulse" />
            ஓட்டுநர் டெலிவரி மற்றும் ரசீது தளம்
          </h1>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
            அன்பு டிரேடர்ஸ் — நேரடி வாகன டெலிவரி மற்றும் கட்டண வசூல் மேலாண்மை
          </p>
        </div>
      </div>

      {/* ஓட்டுநர் தேர்வு மற்றும் தேடல் (Driver Filter & Search Bar) */}
      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5 border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div>
          <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
            <User size={15} className="text-amber-600" /> ஓட்டுநர் தேர்வு (Driver)
          </label>
          <select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            className="input text-sm font-bold bg-slate-50 dark:bg-slate-800"
          >
            <option value="all">🚚 அனைத்து ஓட்டுநர்கள் (All Drivers)</option>
            {drivers.map((drv) => (
              <option key={drv.id} value={drv.id}>
                {drv.name} ({drv.phone_number}) — {drv.status === 'engaged' ? '🟡 பணியில் உள்ளார்' : '🟢 தயார் நிலை'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
            <Search size={15} className="text-amber-600" /> தேடல் (Search)
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="டெலிவரி எண், வாடிக்கையாளர் பெயர், வாகனம்..."
            className="input text-sm font-semibold bg-slate-50 dark:bg-slate-800"
          />
        </div>
      </div>

      {/* பிரிவுகள் (Tabs) */}
      <div className="flex gap-4 border-b-2 border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-3 px-3 font-extrabold text-sm sm:text-base border-b-4 transition flex items-center gap-2 ${
            activeTab === 'pending'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <Truck size={18} /> இன்றைய டெலிவரி பணிகள் ({dispatches.filter((d) => d.status !== 'completed').length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`pb-3 px-3 font-extrabold text-sm sm:text-base border-b-4 transition flex items-center gap-2 ${
            activeTab === 'completed'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <CheckCircle2 size={18} /> முடிக்கப்பட்டவை ({dispatches.filter((d) => d.status === 'completed').length})
        </button>
      </div>

      {/* டெலிவரி கார்டுகள் பட்டியல் (Deliveries List) */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-slate-500 space-y-2">
          <Truck size={40} className="mx-auto text-slate-300 dark:text-slate-600" />
          <p className="font-bold text-base text-slate-700 dark:text-slate-300">
            {activeTab === 'pending' ? 'தற்போது நிலுவையில் டெலிவரிகள் இல்லை.' : 'இன்று முடிக்கப்பட்ட டெலிவரிகள் இல்லை.'}
          </p>
          <p className="text-xs text-slate-400">வாகனத்தில் ஏற்றப்படும் அனைத்து ஆர்டர்களும் உடனுக்குடன் இங்கு காண்பிக்கப்படும்.</p>
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
                className="card p-5 border-2 border-slate-200 dark:border-slate-800 space-y-4 hover:shadow-md transition bg-white dark:bg-slate-900 rounded-2xl"
              >
                {/* மேல் பகுதி (Header) */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-mono font-black bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-2.5 py-1 rounded-md shadow-sm">
                      {d.dispatch_no}
                    </span>
                    <h3 className="font-black text-lg text-slate-900 dark:text-slate-100 mt-1.5">
                      {d.customer?.name || 'வாடிக்கையாளர்'}
                    </h3>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-xs font-extrabold px-3 py-1 rounded-full uppercase shadow-sm ${
                        d.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 animate-pulse'
                      }`}
                    >
                      {d.status === 'completed' ? 'டெலிவரி முடிந்தது' : d.status === 'ready_for_loading' ? 'ஏற்றுமதிக்கு தயார்' : 'வழியில் உள்ளது'}
                    </span>
                  </div>
                </div>

                {/* வாகனம் மற்றும் ஓட்டுநர் விவரம் (Driver & Vehicle Tag) */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100 font-extrabold">
                    <Truck size={16} className="text-amber-600" />
                    வாகனம்: <span className="font-mono text-sm bg-white dark:bg-slate-900 px-2 py-0.5 rounded border">{d.vehicle_number || 'குறிப்பிடப்படவில்லை'}</span>
                  </span>
                  <span className="text-slate-600 dark:text-slate-300">
                    ஓட்டுநர்: {d.driver_name || 'நியமிக்கப்படவில்லை'}
                  </span>
                </div>

                {/* தளத்தில் வசூலிக்க வேண்டிய தொகை (Cash to Collect on Site Callout) */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-900 dark:to-amber-950/30 border-2 border-amber-300 dark:border-amber-700/80 p-3.5 rounded-2xl flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
                      <IndianRupee size={14} /> தளத்தில் வசூலிக்க வேண்டிய தொகை
                    </p>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      மொத்தம்: ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | செலுத்தியது: ₹{paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
                      ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* தள முகவரி மற்றும் கூகுள் மேப்ஸ் (Delivery Address & Quick Navigation) */}
                {deliveryAddress && (
                  <div className="space-y-1.5 text-xs bg-blue-50/40 dark:bg-slate-800/40 p-3 rounded-xl border border-blue-100 dark:border-slate-700">
                    <p className="text-slate-700 dark:text-slate-200 font-bold flex items-start gap-1.5">
                      <MapPin size={16} className="text-rose-500 shrink-0 mt-0.5" />
                      <span>{deliveryAddress}</span>
                    </p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deliveryAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-extrabold text-xs pl-5 hover:underline"
                    >
                      <ExternalLink size={13} /> 🗺️ கூகுள் மேப்ஸில் வழியைப் பார்க்க (Google Maps)
                    </a>
                  </div>
                )}

                {/* ஏற்றிய பொருட்கள் பட்டியல் (Items preview) */}
                <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700">
                  <p className="font-extrabold text-slate-900 dark:text-slate-100 mb-1.5 flex items-center gap-1.5">
                    <Package size={15} className="text-amber-600" /> ஏற்றிய பொருட்கள் ({d.items?.length || 0} வகைகள்):
                  </p>
                  <ul className="list-disc list-inside space-y-1 font-medium">
                    {d.items?.map((it, i) => (
                      <li key={it.id || i} className="truncate">
                        <strong className="text-slate-900 dark:text-slate-100">{it.quantity} {it.unit || 'எண்ணிக்கை'}</strong> — {it.product_name}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* நேரடி செயல் பொத்தான்கள் (1-Tap Action Buttons) */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2.5">
                  {customerPhone && (
                    <>
                      <a
                        href={`tel:${customerPhone}`}
                        className="btn-secondary py-2.5 px-3 text-xs flex-1 flex items-center justify-center gap-1.5 font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200"
                      >
                        <Phone size={15} className="text-emerald-600" /> அழைக்க ({customerPhone})
                      </a>

                      <button
                        onClick={() => {
                          const msg = buildDispatchWhatsAppMessage(d, undefined, d.customer, d.bill);
                          openWhatsApp(customerPhone, msg);
                        }}
                        className="btn-secondary py-2.5 px-3 text-xs flex items-center justify-center gap-1.5 text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 font-extrabold"
                        title="வாட்ஸ்அப்பில் தகவல் அனுப்ப"
                      >
                        <MessageSquare size={15} /> வாட்ஸ்அப்
                      </button>
                    </>
                  )}

                  {d.status !== 'completed' && (
                    <button
                      onClick={() => openPODModal(d)}
                      className="btn-primary py-2.5 px-4 text-xs font-black flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md rounded-xl"
                    >
                      <Camera size={16} /> 📸 டெலிவரி முடிந்தது (POD)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* டெலிவரி நிறைவு மற்றும் ரசீது உறுதிப்படுத்தல் (PROOF OF DELIVERY MODAL) */}
      <Modal
        open={!!completingDispatch}
        onClose={() => setCompletingDispatch(null)}
        title={`டெலிவரி நிறைவு மற்றும் ரசீது — ${completingDispatch?.dispatch_no}`}
        size="md"
      >
        {completingDispatch && (
          <div className="space-y-4 font-sans">
            <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl text-xs space-y-1.5 border border-slate-200 dark:border-slate-700">
              <p><strong className="text-slate-900 dark:text-slate-100">வாடிக்கையாளர்:</strong> {completingDispatch.customer?.name}</p>
              <p><strong className="text-slate-900 dark:text-slate-100">முகவரி:</strong> {completingDispatch.delivery_address || completingDispatch.customer?.address || 'தள டெலிவரி'}</p>
              <p><strong className="text-slate-900 dark:text-slate-100">ஓட்டுநர்:</strong> {completingDispatch.driver_name || 'ஓட்டுநர்'}</p>
            </div>

            {/* வசூலித்த தொகை (Payment Collection Confirmation) */}
            <div className="bg-amber-50 dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-800/60 p-4 rounded-2xl space-y-3 shadow-sm">
              <label className="block text-xs font-black text-amber-950 dark:text-amber-200 flex items-center gap-1.5 uppercase tracking-wide">
                <IndianRupee size={16} className="text-amber-600" /> வாடிக்கையாளரிடம் வசூலித்த தொகை (₹)
              </label>
              <div className="relative">
                <IndianRupee size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  value={collectedAmount}
                  onChange={(e) => setCollectedAmount(e.target.value)}
                  className="input pl-9 text-lg font-black text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-800"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  கட்டணம் செலுத்திய முறை (Payment Mode)
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="input text-xs font-bold bg-white dark:bg-slate-800"
                >
                  <option value="cash">💵 ரொக்கப் பணம் (Cash on Site)</option>
                  <option value="gpay_upi">📱 கூகுள் பே / ஃபோன்பே / UPI</option>
                  <option value="office_paid">🏢 அலுவலகத்தில் ஏற்கனவே செலுத்தப்பட்டது</option>
                  <option value="credit">📒 வாடிக்கையாளர் கடன் கணக்கு (Credit)</option>
                </select>
              </div>
            </div>

            {/* தள டெலிவரி புகைப்படம் (Photo Capture) */}
            <div>
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                <Camera size={16} className="text-amber-600" /> தளத்தில் இறக்கப்பட்ட பொருட்களின் புகைப்படம் (POD Photo)
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
                <div className="relative rounded-xl overflow-hidden border-2 border-slate-300 dark:border-slate-700 h-48 bg-slate-900 flex items-center justify-center shadow">
                  <img src={podPhotoPreview} alt="POD Preview" className="h-full w-full object-contain" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-3 right-3 bg-black/80 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 backdrop-blur shadow"
                  >
                    <Camera size={14} /> மீண்டும் புகைப்படம் எடுக்க
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-36 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-600 dark:text-slate-400 hover:border-amber-500 hover:text-amber-600 transition bg-slate-50 dark:bg-slate-800/40 p-4"
                >
                  <Camera size={32} className="text-amber-600 animate-bounce" />
                  <span className="text-xs font-extrabold text-center">மொபைல் கேமராவில் புகைப்படம் எடுக்க இங்கே தொடவும் (Tap to Take Photo)</span>
                </button>
              )}
            </div>

            {/* பெறுநர் பெயர் / குறிப்புகள் (Receiver Notes) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                பொருளைப் பெற்றவர் பெயர் / குறிப்புகள் (விருப்பத்தேர்வு)
              </label>
              <input
                type="text"
                value={receiverNotes}
                onChange={(e) => setReceiverNotes(e.target.value)}
                placeholder="எ.கா. தள மேற்பார்வையாளர் முருகன் பெற்றுக்கொண்டார்"
                className="input text-xs font-semibold"
              />
            </div>

            {/* செயல் பொத்தான்கள் (Actions) */}
            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setCompletingDispatch(null)}
                className="btn-secondary font-bold text-xs"
              >
                ரத்து செய் (Cancel)
              </button>
              <button
                type="button"
                onClick={handleCompleteDelivery}
                disabled={submitting}
                className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 font-black text-xs sm:text-sm py-2.5 px-4 shadow-md rounded-xl"
              >
                <CheckCircle2 size={18} /> {submitting ? 'பதிவேற்றப்படுகிறது...' : '✅ டெலிவரியை உறுதிப்படுத்து'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
