import { useState, useEffect, useRef } from 'react';
import { api, type Dispatch, type Driver } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useRealtime } from '@/lib/useRealtime';
import { compressImage } from '@/lib/imageCompressor';
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
  AlertCircle,
  Mic,
  MicOff,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  SwitchCamera,
  Volume2,
  X,
  Eye
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
  const [savingLocationForDispatchId, setSavingLocationForDispatchId] = useState<string | null>(null);
  const [savedLocationDispatches, setSavedLocationDispatches] = useState<Record<string, boolean>>({});

  // Camera State (Live Camera Viewfinder Only - No Gallery Pickers)
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Voice Note Recording State
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Enlarged Photo Lightbox State
  const [enlargedPhotoUrl, setEnlargedPhotoUrl] = useState<string | null>(null);

  // Bind video stream to video element whenever camera stream changes
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, cameraModalOpen]);

  // Clean up camera & audio on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    };
  }, []);

  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      setCameraStream(stream);
      setFacingMode(mode);
      setCameraModalOpen(true);
    } catch {
      toast('மொபைல் கேமராவை இயக்க முடியவில்லை. கேமரா அனுமதியை சரிபார்க்கவும் (Camera access denied)', 'error');
    }
  };

  const switchCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    startCamera(nextMode);
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setCameraModalOpen(false);
  };

  const capturePhoto = (videoEl: HTMLVideoElement | null) => {
    if (!videoEl) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth || 1280;
    canvas.height = videoEl.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `pod_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const compressed = await compressImage(file);
      setPodPhotoFile(compressed);
      if (podPhotoPreview) URL.revokeObjectURL(podPhotoPreview);
      const preview = URL.createObjectURL(compressed);
      setPodPhotoPreview(preview);
      stopCamera();
      toast('தள புகைப்படம் எடுக்கப்பட்டது! (Photo Captured)', 'success');
    }, 'image/jpeg', 0.85);
  };

  const startVoiceRecording = async () => {
    if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
      toast('மைக்ரோஃபோன் அணுகல் இந்த உலாவியில் இல்லை (Microphone not available)', 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let options: MediaRecorderOptions | undefined = undefined;
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav'];
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
        for (const cand of candidates) {
          if (MediaRecorder.isTypeSupported(cand)) {
            options = { mimeType: cand };
            break;
          }
        }
      }

      const mediaRecorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalType = mediaRecorder.mimeType || options?.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: finalType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioPreviewUrl(url);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsVoiceRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => {
          if (s >= 60) {
            stopVoiceRecording();
            return 60;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      toast('மைக்ரோஃபோன் அணுகல் மறுக்கப்பட்டது. மைக் அனுமதியை சரிபார்க்கவும் (Microphone access denied)', 'error');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.requestData();
      } catch {}
      mediaRecorderRef.current.stop();
    }
    setIsVoiceRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  };

  const resetVoiceRecording = () => {
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioBlob(null);
    setAudioPreviewUrl(null);
    setIsPlayingAudio(false);
    setRecordingSeconds(0);
    if (isVoiceRecording) stopVoiceRecording();
  };

  const togglePlayAudio = () => {
    if (!audioPlayerRef.current) return;
    if (isPlayingAudio) {
      audioPlayerRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const startSpeechDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast('இந்த உலாவியில் வாய்மொழி தட்டச்சு ஆதரிக்கப்படவில்லை (Speech recognition not supported)', 'error');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ta-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    setIsListeningSpeech(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setReceiverNotes((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setIsListeningSpeech(false);
      toast(`பதிவானது: "${transcript}"`, 'success');
    };

    recognition.onerror = () => {
      setIsListeningSpeech(false);
      toast('குரல் அடையாளம் காண முடியவில்லை, தட்டச்சு செய்யவும்', 'error');
    };

    recognition.onend = () => {
      setIsListeningSpeech(false);
    };

    recognition.start();
  };

  const handleSaveSiteLocationToLedger = async (d: Dispatch) => {
    const customerId = d.customer_id || d.customer?.id;
    if (!customerId) {
      toast('வாடிக்கையாளர் விவரம் கிடைக்கவில்லை (Customer not found)', 'error');
      return;
    }

    setSavingLocationForDispatchId(d.id);

    const performSave = async (lat?: number, lng?: number) => {
      try {
        const baseAddress = d.delivery_address || d.customer?.address || 'தள இருப்பிடம் (Site Location)';
        await api.post(`/customers/${customerId}/delivery-addresses`, {
          address: baseAddress,
          latitude: lat ?? null,
          longitude: lng ?? null,
        });

        setSavedLocationDispatches(prev => ({ ...prev, [d.id]: true }));
        toast('📍 தள இருப்பிடம் வாடிக்கையாளர் லெட்ஜரில் சேமிக்கப்பட்டது! அடுத்த முறை பில்லிங்கில் இது பரிந்துரைக்கப்படும்.', 'success');
        loadData();
      } catch (err: any) {
        toast(err?.message || 'தள முகவரியைச் சேமிப்பதில் பிழை ஏற்பட்டது', 'error');
      } finally {
        setSavingLocationForDispatchId(null);
      }
    };

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          performSave(pos.coords.latitude, pos.coords.longitude);
        },
        (_err) => {
          performSave();
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      performSave();
    }
  };

  const isLocationSavedInLedger = (d: Dispatch) => {
    if (savedLocationDispatches[d.id]) return true;
    const addrs = d.customer?.delivery_addresses || [];
    const current = (d.delivery_address || '').trim().toLowerCase();
    if (!current) return false;
    return addrs.some(a => a.toLowerCase().includes(current));
  };

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
    resetVoiceRecording();
    stopCamera();
    setPaymentMode('cash');

    const total = d.bill?.total_amount ?? (d.items?.reduce((s, it) => s + (it.price || 0) * (it.quantity || 1), 0) || 0);
    const paid = d.bill?.paid_amount ?? 0;
    const balance = d.bill?.pending_amount ?? Math.max(0, total - paid);
    setCollectedAmount(balance > 0 ? balance.toString() : '0');
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

      let uploadedVoiceUrl: string | null = null;
      if (audioBlob) {
        try {
          const formData = new FormData();
          const ext = audioBlob.type.includes('mp4') ? 'mp4' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
          formData.append('audio_file', audioBlob, `pod_${completingDispatch.id}.${ext}`);
          const res = await api.postForm(`/dispatches/${completingDispatch.id}/pod-voice-note`, formData);
          if (res?.url) {
            uploadedVoiceUrl = res.url;
          }
        } catch (voiceErr) {
          console.warn('Could not upload voice note file, saving as base64 fallback:', voiceErr);
          uploadedVoiceUrl = await new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result as string);
            reader.onerror = rej;
            reader.readAsDataURL(audioBlob);
          });
        }
      }

      const notesSummary = [
        completingDispatch.notes || '',
        `POD: தளத்தில் பொருட்கள் இறக்கப்பட்டது. வசூலித்த தொகை: ₹${collectedAmount} (${paymentMode.toUpperCase()}).`,
        receiverNotes ? `குறிப்பு: ${receiverNotes}` : '',
        uploadedVoiceUrl ? '[🎙️ குரல் குறிப்பு இணைக்கப்பட்டுள்ளது]' : ''
      ].filter(Boolean).join(' | ');

      await api.put(`/dispatches/${completingDispatch.id}`, {
        ...completingDispatch,
        status: 'completed',
        vehicle_leave_photo_url: photoUrl,
        notes: notesSummary,
        pod_voice_note_url: uploadedVoiceUrl || completingDispatch.pod_voice_note_url || null,
      });

      toast(`டெலிவரி (${completingDispatch.dispatch_no}) வெற்றிகரமாக முடிந்தது! ஓட்டுநர் தயார் நிலைக்கு மாற்றப்பட்டார்.`, 'success');
      setCompletingDispatch(null);
      resetVoiceRecording();
      stopCamera();
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
                  <div className="space-y-2 text-xs bg-blue-50/40 dark:bg-slate-800/40 p-3 rounded-xl border border-blue-100 dark:border-slate-700">
                    <p className="text-slate-700 dark:text-slate-200 font-bold flex items-start gap-1.5">
                      <MapPin size={16} className="text-rose-500 shrink-0 mt-0.5" />
                      <span>{deliveryAddress}</span>
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-blue-100/70 dark:border-slate-700">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deliveryAddress)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-extrabold text-xs hover:underline"
                      >
                        <ExternalLink size={13} /> 🗺️ கூகுள் மேப்ஸில் பார்க்க (Maps)
                      </a>

                      <button
                        type="button"
                        disabled={savingLocationForDispatchId === d.id}
                        onClick={() => handleSaveSiteLocationToLedger(d)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
                          isLocationSavedInLedger(d)
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300'
                            : 'bg-white hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-rose-700 dark:text-rose-300 border border-rose-300'
                        }`}
                        title="தளத்தை அடைந்ததும் இந்த இருப்பிடத்தை வாடிக்கையாளர் லெட்ஜரில் சேமித்து வைக்க"
                      >
                        <MapPin size={13} className={isLocationSavedInLedger(d) ? "text-emerald-600" : "text-rose-600"} />
                        {savingLocationForDispatchId === d.id
                          ? 'சேமிக்கப்படுகிறது...'
                          : isLocationSavedInLedger(d)
                            ? '✓ லெட்ஜரில் சேமிக்கப்பட்டது'
                            : '📍 தளத்தை லெட்ஜரில் சேர்க்க'}
                      </button>
                    </div>
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

                {/* முடிக்கப்பட்ட டெலிவரி சான்று & குரல் குறிப்பு (Completed POD Preview & Audio) */}
                {d.status === 'completed' && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {d.vehicle_leave_photo_url && (
                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <img
                          src={d.vehicle_leave_photo_url}
                          alt="POD Photo"
                          onClick={() => setEnlargedPhotoUrl(d.vehicle_leave_photo_url!)}
                          className="w-16 h-16 object-cover rounded-lg border-2 border-emerald-300 dark:border-emerald-700 cursor-pointer hover:opacity-90 hover:scale-105 transition shadow-sm shrink-0"
                        />
                        <div className="flex-1 min-w-0 text-xs">
                          <p className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <Camera size={14} className="text-emerald-600" />
                            <span>தளத்தில் இறக்கப்பட்ட புகைப்படம் (POD)</span>
                          </p>
                          <button
                            type="button"
                            onClick={() => setEnlargedPhotoUrl(d.vehicle_leave_photo_url!)}
                            className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1 mt-1"
                          >
                            <Eye size={12} /> பெரிதாக்கிப் பார்க்க (View Full)
                          </button>
                        </div>
                      </div>
                    )}

                    {d.pod_voice_note_url && (
                      <div className="p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-black text-indigo-900 dark:text-indigo-300">
                          <Volume2 size={15} className="text-indigo-600 animate-pulse" />
                          <span>குரல் குறிப்பு (POD Voice Note):</span>
                        </div>
                        <audio controls src={d.pod_voice_note_url} className="w-full h-8 rounded" />
                      </div>
                    )}

                    {d.notes && (
                      <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <strong className="text-slate-900 dark:text-slate-100">குறிப்புகள்:</strong> {d.notes}
                      </div>
                    )}
                  </div>
                )}

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
        onClose={() => {
          setCompletingDispatch(null);
          resetVoiceRecording();
          stopCamera();
        }}
        title={`டெலிவரி நிறைவு மற்றும் ரசீது — ${completingDispatch?.dispatch_no}`}
        size="md"
      >
        {completingDispatch && (
          <div className="space-y-4 font-sans">
            <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl text-xs space-y-2 border border-slate-200 dark:border-slate-700">
              <p><strong className="text-slate-900 dark:text-slate-100">வாடிக்கையாளர்:</strong> {completingDispatch.customer?.name}</p>
              <p><strong className="text-slate-900 dark:text-slate-100">முகவரி:</strong> {completingDispatch.delivery_address || completingDispatch.customer?.address || 'தள டெலிவரி'}</p>
              <p><strong className="text-slate-900 dark:text-slate-100">ஓட்டுநர்:</strong> {completingDispatch.driver_name || 'ஓட்டுநர்'}</p>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500">
                  தள இருப்பிடத்தை வாடிக்கையாளர் லெட்ஜரில் சேர்க்க:
                </span>
                <button
                  type="button"
                  disabled={savingLocationForDispatchId === completingDispatch.id}
                  onClick={() => handleSaveSiteLocationToLedger(completingDispatch)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                    isLocationSavedInLedger(completingDispatch)
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  <MapPin size={13} />
                  {savingLocationForDispatchId === completingDispatch.id
                    ? 'சேமிக்கப்படுகிறது...'
                    : isLocationSavedInLedger(completingDispatch)
                      ? '✓ லெட்ஜரில் சேமிக்கப்பட்டது'
                      : '📍 லெட்ஜரில் சேமிக்க'}
                </button>
              </div>
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

            {/* தள டெலிவரி புகைப்படம் (Camera Capture ONLY - No File/Gallery Picker) */}
            <div>
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                <Camera size={16} className="text-amber-600" /> தளத்தில் இறக்கப்பட்ட பொருட்களின் புகைப்படம் (POD Photo)
              </label>

              {podPhotoPreview ? (
                <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500/50 dark:border-emerald-600/50 h-52 bg-slate-950 flex items-center justify-center shadow-md">
                  <img src={podPhotoPreview} alt="POD Preview" className="h-full w-full object-contain" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-3 flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={15} /> புகைப்படம் எடுக்கப்பட்டது
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEnlargedPhotoUrl(podPhotoPreview)}
                        className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 backdrop-blur shadow"
                        title="பெரிதாக்கிப் பார்க்க"
                      >
                        <Eye size={13} /> பெரிதாக்கு
                      </button>
                      <button
                        type="button"
                        onClick={() => startCamera()}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow"
                      >
                        <Camera size={13} /> மீண்டும் எடுக்க
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="w-full h-36 border-2 border-dashed border-amber-400 dark:border-amber-600 hover:border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 rounded-2xl flex flex-col items-center justify-center gap-2 text-amber-900 dark:text-amber-200 transition p-4 shadow-sm group active:scale-[0.99]"
                >
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center group-hover:scale-110 transition">
                    <Camera size={26} className="text-amber-600 dark:text-amber-400 animate-pulse" />
                  </div>
                  <div className="text-center space-y-0.5">
                    <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
                      நேரடி கேமராவில் புகைப்படம் எடுக்கவும் (Take Photo with Camera)
                    </p>
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      கேலரி அனுமதி இல்லை — தளத்தில் கேமரா மூலம் மட்டுமே படம் எடுக்க முடியும்
                    </p>
                  </div>
                </button>
              )}
            </div>

            {/* பெறுநர் பெயர் / குறிப்புகள் & குரல் குறிப்பு (Receiver Notes & Voice Note) */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Mic size={15} className="text-indigo-600" />
                  பொருளைப் பெற்றவர் குறிப்பு & குரல் குறிப்பு (Voice Note)
                </label>
                {recordingSeconds > 0 && !audioBlob && (
                  <span className="text-xs font-mono font-bold text-rose-600 animate-pulse">
                    00:{recordingSeconds.toString().padStart(2, '0')} / 01:00
                  </span>
                )}
              </div>

              {/* Voice Note Recorder Bar */}
              {!audioPreviewUrl ? (
                <div>
                  {isVoiceRecording ? (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 rounded-xl flex items-center justify-between gap-3 shadow-inner">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                        <span className="text-xs font-black text-rose-700 dark:text-rose-300">
                          பதிவாகிறது... 00:{recordingSeconds.toString().padStart(2, '0')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 h-6">
                        <div className="w-1 h-4 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1 h-6 bg-rose-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1 h-3 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        <div className="w-1 h-5 bg-rose-600 rounded-full animate-bounce" style={{ animationDelay: '75ms' }} />
                      </div>
                      <button
                        type="button"
                        onClick={stopVoiceRecording}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow active:scale-95 transition"
                      >
                        <MicOff size={14} /> நிறுத்து (Stop)
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      className="w-full py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center justify-center gap-2 text-indigo-700 dark:text-indigo-300 text-xs font-extrabold shadow-sm transition active:scale-[0.99]"
                    >
                      <Mic size={16} className="text-indigo-600" />
                      <span>🎙️ குரல் குறிப்பு பேசவும் (Record Voice Note)</span>
                    </button>
                  )}
                </div>
              ) : (
                /* Recorded Audio Preview Box */
                <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      குரல் குறிப்பு பதிவானது ({recordingSeconds}s)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={resetVoiceRecording}
                        className="text-[11px] text-slate-600 hover:text-indigo-600 dark:text-slate-400 font-bold flex items-center gap-0.5"
                      >
                        <RotateCcw size={12} /> மீண்டும் பேச
                      </button>
                      <button
                        type="button"
                        onClick={resetVoiceRecording}
                        className="text-[11px] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-0.5"
                      >
                        <Trash2 size={12} /> நீக்கு
                      </button>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-emerald-100 dark:border-slate-700">
                    <audio
                      controls
                      src={audioPreviewUrl}
                      className="w-full h-8 rounded"
                    />
                  </div>
                </div>
              )}

              {/* Text Input with Voice Dictation Mic Button */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  எழுத்து வடிவில் குறிப்பு (அல்லது மைக் அழுத்தி பேசவும்):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={receiverNotes}
                    onChange={(e) => setReceiverNotes(e.target.value)}
                    placeholder="எ.கா. தள மேற்பார்வையாளர் முருகன் பெற்றுக்கொண்டார்"
                    className="input text-xs font-semibold pr-10"
                  />
                  <button
                    type="button"
                    onClick={startSpeechDictation}
                    disabled={isListeningSpeech}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition ${
                      isListeningSpeech
                        ? 'bg-rose-100 text-rose-600 animate-pulse'
                        : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title="மைக்ரோஃபோனில் பேசினால் தானாக தட்டச்சாகும் (Speech to Text)"
                  >
                    <Mic size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* செயல் பொத்தான்கள் (Actions) */}
            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setCompletingDispatch(null);
                  resetVoiceRecording();
                  stopCamera();
                }}
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

      {/* நேரடி கேமரா மாடல் (Live Camera Viewfinder Modal) */}
      {cameraModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 p-3 sm:p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col">
            {/* Top Bar */}
            <div className="p-3.5 bg-gradient-to-b from-black/90 to-transparent flex items-center justify-between text-white z-10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-xs font-extrabold tracking-wide uppercase">தள கேமரா (Live POD Camera)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={switchCamera}
                  className="px-2.5 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-bold flex items-center gap-1.5 transition"
                  title="கேமராவை மாற்று (முன் / பின்)"
                >
                  <SwitchCamera size={14} />
                  <span>{facingMode === 'environment' ? 'முன் கேமரா' : 'பின் கேமரா'}</span>
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="p-1.5 rounded-lg bg-white/20 hover:bg-rose-600 text-white transition"
                  title="ரத்து செய்"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Viewfinder Video */}
            <div className="relative aspect-[4/3] sm:aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Framing Guide */}
              <div className="absolute inset-8 border-2 border-white/30 rounded-2xl pointer-events-none flex items-center justify-center">
                <div className="text-white/60 text-[11px] font-bold text-center px-4 py-2 bg-black/50 rounded-lg backdrop-blur-sm">
                  தளத்தில் இறக்கப்பட்ட பொருட்கள் தெளிவாக தெரியும்படி வைத்து படம் எடுக்கவும்
                </div>
              </div>
            </div>

            {/* Bottom Controls Bar */}
            <div className="p-5 bg-gradient-to-t from-black/95 to-black/70 flex items-center justify-between px-8">
              <button
                type="button"
                onClick={stopCamera}
                className="text-xs font-bold text-slate-300 hover:text-white transition"
              >
                ரத்து (Cancel)
              </button>

              {/* Shutter Button */}
              <button
                type="button"
                onClick={() => capturePhoto(videoRef.current)}
                className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-white/20 border-4 border-white flex items-center justify-center hover:bg-white/40 active:scale-95 transition shadow-2xl cursor-pointer"
                title="புகைப்படம் எடு (Capture Photo)"
              >
                <div className="w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-white flex items-center justify-center">
                  <Camera size={26} className="text-slate-900" />
                </div>
              </button>

              <div className="w-16 text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">நேரடி படம்</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* பெரிய புகைப்பட முன்னோட்டம் (Enlarged Photo Lightbox Modal) */}
      {enlargedPhotoUrl && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setEnlargedPhotoUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={enlargedPhotoUrl}
              alt="Enlarged POD Preview"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setEnlargedPhotoUrl(null)}
              className="absolute -top-3 -right-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-full w-9 h-9 flex items-center justify-center font-black text-lg shadow-2xl hover:bg-rose-600 hover:text-white transition"
              title="மூடு (Close)"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
