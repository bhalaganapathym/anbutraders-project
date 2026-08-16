import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { DEFAULT_COMPANY_IMAGE_URL } from '@/lib/whatsapp';
import { 
  Truck, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Printer, 
  Globe, 
  Scale, 
  Receipt, 
  HardHat, 
  ShieldCheck, 
  Camera, 
  ExternalLink 
} from 'lucide-react';

interface PublicTrackingData {
  dispatch_id: string;
  dispatch_no: string;
  status: string;
  created_at: string | null;
  customer: {
    name: string;
    phone: string;
    address: string;
  };
  transport: {
    vehicle_number: string;
    driver_name: string;
    driver_mobile: string;
  };
  weights: {
    gross_weight: number | null;
    tare_weight: number | null;
    net_weight: number | null;
  };
  items: Array<{
    product_name: string;
    quantity: number;
    unit: string;
    price: number;
  }>;
  financials: {
    total_amount: number;
    paid_amount: number;
    pending_amount: number;
    payment_method: string;
  };
  pod_photo: string | null;
}

export default function PublicReceipt() {
  const [data, setData] = useState<PublicTrackingData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState<boolean>(false);
  const { t, lang, changeLanguage } = useTranslation();

  const getTrackingId = () => {
    const parts = window.location.hash.split('/');
    return parts.length >= 3 ? parts[2] : 'DSP-0001';
  };

  useEffect(() => {
    async function loadData() {
      const id = getTrackingId();
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const res: any = await api.get(`/public/track/${id}`);
        setData(res);
      } catch (err: any) {
        setError(err?.response?.data?.detail || 'Unable to locate dispatch reference');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-lg space-y-4">
          <div className="h-12 w-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto animate-pulse">
            <Truck size={28} />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Fetching Anbu Traders Live Tracking...</h2>
          <p className="text-xs text-slate-500">Connecting to weighbridge & dispatch records...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-lg space-y-4">
          <div className="h-12 w-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <Receipt size={28} />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Dispatch Not Found</h2>
          <p className="text-xs text-slate-500">{error || 'The requested order reference does not exist.'}</p>
          <div className="pt-2">
            <a
              href="tel:04132964204"
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow transition"
            >
              <Phone size={14} /> Call Office (0413-2964204)
            </a>
          </div>
        </div>
      </div>
    );
  }

  const isCompleted = data.status === 'completed';
  const isDelivering = data.status === 'pending' || data.status === 'in_progress';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 pb-12">
      {/* Top Header Navigation */}
      <header className="bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img 
              src={DEFAULT_COMPANY_IMAGE_URL} 
              alt="Anbu Traders" 
              className="h-9 w-9 rounded-full bg-white p-0.5 shadow object-contain" 
            />
            <div>
              <h1 className="text-sm font-extrabold tracking-wide uppercase">{t('company_name')}</h1>
              <p className="text-[10px] text-amber-100 font-medium">{t('company_tagline')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tamil / English Toggle */}
            <button
              onClick={() => changeLanguage(lang === 'en' ? 'ta' : 'en')}
              className="flex items-center gap-1 text-[11px] font-bold bg-amber-800/60 hover:bg-amber-800 text-white px-2.5 py-1.5 rounded-lg border border-amber-400/40 shadow-sm transition"
            >
              <Globe size={13} /> {lang === 'en' ? 'தமிழ்' : 'English'}
            </button>

            <button
              onClick={() => window.print()}
              className="p-1.5 bg-amber-800/60 hover:bg-amber-800 text-white rounded-lg border border-amber-400/40 transition print:hidden"
              title={t('print')}
            >
              <Printer size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Status Tracker Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t('dispatch_ref')}: <span className="text-slate-800">{data.dispatch_no}</span>
              </span>
              <h2 className="text-base font-extrabold text-slate-800 mt-0.5">
                {isCompleted ? t('status_delivered') : t('status_out_for_delivery')}
              </h2>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
              isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700 animate-pulse'
            }`}>
              {isCompleted ? <CheckCircle2 size={14} /> : <Truck size={14} />}
              {isCompleted ? 'Delivered' : 'On The Way'}
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-slate-500 pt-2 pb-1 border-t border-slate-100">
            <div className="flex flex-col items-center gap-1 text-emerald-600">
              <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 size={14} />
              </div>
              <span>Confirmed</span>
            </div>
            <div className="flex flex-col items-center gap-1 text-emerald-600">
              <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center">
                <Scale size={14} />
              </div>
              <span>Weighed & Loaded</span>
            </div>
            <div className={`flex flex-col items-center gap-1 ${isCompleted ? 'text-emerald-600' : 'text-amber-600'}`}>
              <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                isCompleted ? 'bg-emerald-100' : 'bg-amber-100'
              }`}>
                {isCompleted ? <CheckCircle2 size={14} /> : <Truck size={14} />}
              </div>
              <span>{isCompleted ? 'Delivered' : 'In Transit'}</span>
            </div>
          </div>
        </div>

        {/* Driver & Delivery Information */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
            {t('vehicle_info')} & {t('driver_info')}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">{t('vehicle_info')}</p>
                <p className="text-sm font-extrabold text-slate-800 font-mono mt-0.5">{data.transport.vehicle_number}</p>
              </div>
              <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                <Truck size={18} />
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">{t('driver_info')}</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{data.transport.driver_name}</p>
              </div>
              {data.transport.driver_mobile && data.transport.driver_mobile !== '—' && (
                <a
                  href={`tel:${data.transport.driver_mobile}`}
                  className="h-8 w-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow transition"
                  title={t('call_driver')}
                >
                  <Phone size={16} />
                </a>
              )}
            </div>
          </div>

          <div className="bg-amber-50/60 rounded-xl p-3 border border-amber-200/60 flex items-start gap-2.5">
            <MapPin size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-amber-800 font-bold uppercase">{t('delivery_location')}</p>
              <p className="text-xs font-semibold text-slate-800 mt-0.5">{data.customer.address || 'Site Delivery'}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Recipient: {data.customer.name}</p>
            </div>
          </div>
        </div>

        {/* Materials Loaded & Verified Weights */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              {t('items_loaded')}
            </h3>
            {data.weights.net_weight && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                ⚖️ Net: {data.weights.net_weight} kg
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {data.items.map((it, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-800">{it.product_name}</p>
                  <p className="text-[11px] text-slate-400">
                    {it.quantity} {it.unit}
                  </p>
                </div>
                <div className="text-right font-bold text-slate-700">
                  ₹{(it.price * it.quantity).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          {/* Scale Weight Details */}
          {(data.weights.gross_weight || data.weights.tare_weight) && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 grid grid-cols-3 gap-2 text-center text-xs mt-2">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">{t('gross_wt')}</p>
                <p className="font-bold text-slate-700">{data.weights.gross_weight ?? '—'} kg</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">{t('tare_wt')}</p>
                <p className="font-bold text-slate-700">{data.weights.tare_weight ?? '—'} kg</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">{t('net_wt')}</p>
                <p className="font-extrabold text-emerald-700">{data.weights.net_weight ?? '—'} kg</p>
              </div>
            </div>
          )}
        </div>

        {/* Financial & Payment Summary */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
            {t('financial_breakdown')}
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>{t('total_bill')}</span>
              <span className="font-bold text-slate-800">₹{data.financials.total_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>{t('advance_paid')}</span>
              <span className="font-bold">₹{data.financials.paid_amount.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
              <span className="font-bold text-slate-800 text-sm">{t('balance_to_collect')}</span>
              <span className={`text-base font-extrabold ${
                data.financials.pending_amount > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}>
                ₹{data.financials.pending_amount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Proof of Delivery (POD) Photo */}
        {data.pod_photo && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Camera size={14} className="text-emerald-600" /> {t('pod_photo')}
            </h3>
            <div 
              onClick={() => setShowPhotoModal(true)} 
              className="cursor-pointer rounded-xl overflow-hidden border border-slate-200 max-h-56 relative group shadow-inner"
            >
              <img src={data.pod_photo} alt="POD Proof" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white font-bold text-xs gap-1">
                <ExternalLink size={14} /> Click to Expand
              </div>
            </div>
          </div>
        )}

        {/* Office Contact Footer */}
        <div className="text-center pt-4 space-y-2 text-xs text-slate-500">
          <p className="font-bold text-slate-700">{t('need_help')}</p>
          <div className="flex justify-center gap-3">
            <a
              href="tel:04132964204"
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg shadow-sm font-semibold hover:bg-slate-50 transition"
            >
              <Phone size={13} /> 0413-2964204
            </a>
            <a
              href="tel:9626325204"
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg shadow-sm font-semibold hover:bg-slate-50 transition"
            >
              <Phone size={13} /> 9626325204
            </a>
          </div>
          <p className="text-[11px] text-slate-400 pt-2">
            ANBU TRADERS • No.4/5 Pondy Mailam Road, Sedarapet/Vanur • GST Registered
          </p>
        </div>
      </main>

      {/* Photo Expansion Modal */}
      {showPhotoModal && data.pod_photo && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShowPhotoModal(false)}>
          <div className="max-w-xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl p-2 relative" onClick={e => e.stopPropagation()}>
            <img src={data.pod_photo} alt="POD Large" className="w-full h-auto rounded-xl object-contain max-h-[80vh]" />
            <button
              onClick={() => setShowPhotoModal(false)}
              className="mt-3 w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-xl text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
