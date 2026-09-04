import { useState, useEffect, useRef } from 'react';
import { api, type Dispatch, type DispatchItem, type Product, type Driver } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import DispatchStatusBadge from '@/components/DispatchStatusBadge';
import {
  ArrowLeft, CheckCircle2, AlertCircle, Camera, User, Calendar, MapPin, Search, Plus, Truck, UserCheck,
  Mic, MicOff, Play, Pause, RotateCcw, Volume2, Clock, AlertTriangle, Upload, Eye
} from 'lucide-react';
import Modal from '@/components/Modal';
import { round2 } from '@/lib/pricing';

type DispatchRow = Dispatch & { customer: { name: string; phone: string | null } | null; order?: { confirmed_at?: string; order_no?: string } };

export interface GoodsPhotoItem {
  id: string;
  file: File;
  preview: string;
}

// Utility to compress images
const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_DIM = 600;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round(height * (MAX_DIM / width));
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round(width * (MAX_DIM / height));
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' }));
          } else {
            resolve(file);
          }
        }, 'image/jpeg', 0.5);
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

type ItemVerificationState = {
  weight: string;
  weightUnit: 'kg' | 'g';
  cementText?: string;
  photoFile: File | null;
  photoPreview: string | null;
  verified: boolean;
};

const isCementProduct = (prod: Product | undefined, item: DispatchItem) => {
  const cat = (prod?.category || '').toUpperCase();
  const name = (item.product_name || '').toLowerCase();
  const unit = (item.unit || '').toLowerCase();
  return cat === 'CEMENT' || name.includes('cement');
};

const isCementMatch = (enteredText: string | undefined, expectedQty: number) => {
  if (!enteredText) return false;
  const clean = enteredText.trim().toLowerCase();
  const numOnly = clean.replace(/[^0-9.]/g, '');
  if (numOnly && Number(numOnly) === expectedQty) return true;
  return clean === String(expectedQty) || clean === `${expectedQty} bags` || clean === `${expectedQty} bag`;
};

export default function DispatchDashboard({
  detail,
  onClose,
  onRefresh,
}: {
  detail: DispatchRow;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const { user } = useAuth();
  
  // Products lookup to get standard_weight
  const [products, setProducts] = useState<Product[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [weightThreshold, setWeightThreshold] = useState<number>(3);
  
  useEffect(() => {
    api.get('/products').then(data => setProducts(data)).catch(() => {});
    api.get('/drivers').then(data => setDrivers(data)).catch(() => {});
    api.get('/settings/weight_difference_threshold')
       .then(data => { if (data && data.value) setWeightThreshold(Number(data.value)); })
       .catch(() => {});
  }, []);

  const detailItems = (detail.items || []) as DispatchItem[];
  
  // State for item verification
  const [itemVerification, setItemVerification] = useState<Record<string, ItemVerificationState>>({});
  
  // Vehicle Details State (Phase 1 Driver assignment)
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [vehicleNo, setVehicleNo] = useState(detail.vehicle_number || '');
  const [driverName, setDriverName] = useState(detail.driver_name || '');
  const [driverMobile, setDriverMobile] = useState(detail.driver_mobile || '');
  const [remarks, setRemarks] = useState(detail.notes || '');

  // Initialize state from saved draft (backend + local fallback)
  useEffect(() => {
    if (detail.status === 'completed') return; // Read-only if completed

    // 1. Try to load from detail.phase1_draft first
    let savedDraft = detail.phase1_draft;
    if (!savedDraft) {
      try {
        const local = localStorage.getItem(`dispatch_draft_${detail.id}`);
        if (local) savedDraft = JSON.parse(local);
      } catch (e) {}
    }

    const initial: Record<string, ItemVerificationState> = {};
    detailItems.forEach(item => {
      if (savedDraft?.item_verification && savedDraft.item_verification[item.id]) {
        const savedItem = savedDraft.item_verification[item.id];
        initial[item.id] = {
          weight: savedItem.weight || '',
          weightUnit: savedItem.weightUnit || 'kg',
          photoFile: null,
          photoPreview: savedItem.photoPreview || null,
          verified: Boolean(savedItem.verified)
        };
      } else {
        initial[item.id] = { weight: '', weightUnit: 'kg', photoFile: null, photoPreview: null, verified: false };
      }
    });
    setItemVerification(initial);

    // Restore driver and vehicle info if present in draft
    if (savedDraft) {
      if (savedDraft.driver_id) setSelectedDriverId(savedDraft.driver_id);
      if (savedDraft.driver_name && !detail.driver_name) setDriverName(savedDraft.driver_name);
      if (savedDraft.driver_mobile && !detail.driver_mobile) setDriverMobile(savedDraft.driver_mobile);
      if (savedDraft.vehicle_number && !detail.vehicle_number) setVehicleNo(savedDraft.vehicle_number);
      if (savedDraft.remarks && !detail.notes) setRemarks(savedDraft.remarks);
    }
  }, [detail.id]);

  // Debounced Auto-Save to Backend & localStorage
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (detail.status !== 'pending') return;

    const draftPayload = {
      item_verification: itemVerification,
      driver_id: selectedDriverId,
      driver_name: driverName,
      driver_mobile: driverMobile,
      vehicle_number: vehicleNo,
      remarks: remarks
    };

    // Save to local storage immediately
    try {
      localStorage.setItem(`dispatch_draft_${detail.id}`, JSON.stringify(draftPayload));
    } catch (e) {}

    // Debounce save to backend API
    const timer = setTimeout(async () => {
      try {
        await api.patch(`/dispatches/${detail.id}/draft`, { phase1_draft: draftPayload });
      } catch (err) {
        console.warn('Failed to auto-save dispatch draft:', err);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [itemVerification, selectedDriverId, driverName, driverMobile, vehicleNo, remarks, detail.id, detail.status]);

  // Voice Note Recording State (Visible and accessible for both Dispatch & Admin)
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [mismatchReasonInput, setMismatchReasonInput] = useState('');
  const [submittingVoiceNote, setSubmittingVoiceNote] = useState(false);
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const [adminDeciding, setAdminDeciding] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const startVoiceRecording = async () => {
    if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
      toast('Microphone access not available in this browser. Please ensure HTTPS or localhost.', 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      let options: MediaRecorderOptions | undefined = undefined;
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
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
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => {
          if (s >= 60) {
            stopVoiceRecording();
            return 60;
          }
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      console.error('Microphone error:', e);
      toast('Microphone access denied. Please allow microphone permissions in your browser.', 'error');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.requestData();
      } catch {}
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  };

  const resetVoiceRecording = () => {
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioBlob(null);
    setAudioPreviewUrl(null);
    setIsPlayingAudio(false);
    setRecordingSeconds(0);
    if (isRecording) stopVoiceRecording();
  };

  const startSpeechDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast('Speech recognition not supported in this browser', 'error');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ta-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    setIsListeningSpeech(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setRemarks(prev => (prev ? `${prev} ${transcript}` : transcript));
      setIsListeningSpeech(false);
      toast(`Transcribed: "${transcript}"`, 'success');
    };

    recognition.onerror = () => {
      setIsListeningSpeech(false);
      toast('Could not recognize voice, please try typing', 'error');
    };

    recognition.onend = () => {
      setIsListeningSpeech(false);
    };

    recognition.start();
  };

  const handleAdminMismatchDecision = async (decision: 'approved' | 'rejected', reason?: string) => {
    setAdminDeciding(true);
    try {
      await api.post(`/dispatches/${detail.id}/mismatch-decision`, {
        decision,
        approved_by: user?.name || 'Admin',
        rejection_reason: reason || null,
      });
      toast(`Weight mismatch ${decision === 'approved' ? 'approved' : 'rejected'} successfully`, 'success');
      onRefresh();
    } catch (err: any) {
      toast(err?.message || 'Failed to update decision', 'error');
    } finally {
      setAdminDeciding(false);
    }
  };

  const submitMismatchApproval = async () => {
    if (!audioBlob && !mismatchReasonInput.trim()) {
      toast('Please record a voice note or enter a reason', 'error');
      return;
    }

    setSubmittingVoiceNote(true);
    try {
      const formData = new FormData();
      if (audioBlob) {
        const ext = audioBlob.type.includes('mp4') ? 'mp4' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
        formData.append('audio_file', audioBlob, `voice_note_${detail.id}.${ext}`);
      }
      if (mismatchReasonInput.trim()) {
        formData.append('reason', mismatchReasonInput.trim());
      }

      // If weight warning / mismatch and user is not admin, submit for admin approval
      const isWeightDiff = isWeightWarning || detail.mismatch_approval_status === 'pending' || detailItems.some(item => {
        const ivItem = itemVerification[item.id];
        const prod = products.find(p => p.id === item.product_id);
        if (!prod?.standard_weight || !ivItem?.weight || isNaN(Number(ivItem.weight)) || Number(ivItem.weight) <= 0) return false;
        let actualWt = Number(ivItem.weight);
        if (ivItem.weightUnit === 'g') actualWt /= 1000;
        const q = Number(item.quantity) || 1;
        const nom = Number((prod.standard_weight * q).toFixed(3));
        const plusT = prod.weight_tolerance != null ? Number(prod.weight_tolerance) : (weightThreshold / q);
        const minusT = prod.weight_tolerance_minus != null ? Number(prod.weight_tolerance_minus) : plusT;
        const minW = Number((nom - (minusT * q)).toFixed(3));
        const maxW = Number((nom + (plusT * q)).toFixed(3));
        return actualWt < minW || actualWt > maxW;
      });

      if (isWeightDiff && user?.role !== 'admin') {
        await api.postForm(`/dispatches/${detail.id}/request-mismatch-approval`, formData);
        toast('Voice note saved & delivered to Admin for approval!', 'success');
      } else {
        await api.postForm(`/dispatches/${detail.id}/voice-note`, formData);
        toast('Voice note attached to dispatch successfully!', 'success');
      }

      setVoiceModalOpen(false);
      resetVoiceRecording();
      onRefresh();
    } catch (err: any) {
      toast(err?.message || 'Failed to save voice note', 'error');
    } finally {
      setSubmittingVoiceNote(false);
    }
  };

  // Camera State
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [activeCameraItemId, setActiveCameraItemId] = useState<string | null>(null);
  const [cameraType, setCameraType] = useState<'item' | 'vehicle' | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Multiple Goods / Vehicle Leaving Photos
  const [goodsPhotos, setGoodsPhotos] = useState<GoodsPhotoItem[]>([]);
  const [enlargedPhotoUrl, setEnlargedPhotoUrl] = useState<string | null>(null);
  const goodsFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, cameraModalOpen]);

  const handleGoodsFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const newItems: GoodsPhotoItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const compressed = await compressImage(file);
        const preview = URL.createObjectURL(compressed);
        newItems.push({
          id: `photo_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
          file: compressed,
          preview: preview
        });
      } catch (err) {
        console.warn('Failed to compress selected image:', err);
      }
    }
    if (newItems.length > 0) {
      setGoodsPhotos(prev => [...prev, ...newItems]);
      toast(`Added ${newItems.length} goods photo${newItems.length > 1 ? 's' : ''}`, 'success');
    }
    if (goodsFileInputRef.current) goodsFileInputRef.current.value = '';
  };

  const handleRemoveGoodsPhoto = (id: string) => {
    setGoodsPhotos(prev => {
      const target = prev.find(p => p.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter(p => p.id !== id);
    });
  };

  const startCamera = async (itemId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      setCameraStream(stream);
      setActiveCameraItemId(itemId);
      setCameraType('item');
      setCameraModalOpen(true);
    } catch {
      toast('Could not access camera. Please check permissions.', 'error');
    }
  };
  
  const startVehicleCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: { ideal: 'environment' } } 
      });
      setCameraStream(stream);
      setCameraType('vehicle');
      setCameraModalOpen(true);
    } catch {
      toast('Could not access camera. Please check permissions.', 'error');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setCameraModalOpen(false);
    setActiveCameraItemId(null);
    setCameraType(null);
  };

  const capturePhoto = (videoEl: HTMLVideoElement | null) => {
    if (!videoEl) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth || 640;
    canvas.height = videoEl.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const compressed = await compressImage(file);
      const preview = URL.createObjectURL(compressed);

      if (cameraType === 'item' && activeCameraItemId) {
        setItemVerification(prev => ({
          ...prev,
          [activeCameraItemId]: {
            ...prev[activeCameraItemId],
            photoFile: compressed,
            photoPreview: preview
          }
        }));
        stopCamera();
      } else if (cameraType === 'vehicle') {
        const newItem: GoodsPhotoItem = {
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          file: compressed,
          preview: preview
        };
        setGoodsPhotos(prev => [...prev, newItem]);
        toast(`Goods photo #${goodsPhotos.length + 1} captured!`, 'success');
      }
    }, 'image/jpeg', 0.6);
  };

  // Calculations
  let estimatedTotal = 0;
  let actualTotal = 0;

  detailItems.forEach(item => {
    const prod = products.find(p => p.id === item.product_id);
    if (prod && prod.standard_weight) {
      estimatedTotal += round2(prod.standard_weight * item.quantity);
    }
    
    if (itemVerification[item.id]) {
      const iv = itemVerification[item.id];
      if (iv.weight) {
        let wt = Number(iv.weight);
        if (iv.weightUnit === 'g') wt = wt / 1000;
        actualTotal += round2(wt);
      }
    }
  });

  if (detail.status === 'completed') {
    actualTotal = (detail.weights || []).reduce((sum, w) => sum + round2(w.actual_weight), 0);
  }

  estimatedTotal = round2(estimatedTotal);
  actualTotal = round2(actualTotal);
  const weightDiff = round2(Math.abs(estimatedTotal - actualTotal));
  const isMismatchApproved = detail.mismatch_approval_status === 'approved';
  const isWeightWarning = detail.status === 'pending' && estimatedTotal > 0 && actualTotal > 0 && weightDiff > weightThreshold && !isMismatchApproved;

  const handleSelectDriver = (id: string) => {
    setSelectedDriverId(id);
    const drv = drivers.find(d => d.id === id);
    if (drv) {
      setDriverName(drv.name);
      setDriverMobile(drv.phone_number);
      if (drv.vehicle_number) {
        setVehicleNo(drv.vehicle_number);
      }
    }
  };

  // Completion Logic
  const [isCompletedLocal, setIsCompletedLocal] = useState(false);
  const allVerified = detailItems.every(item => {
    const iv = itemVerification[item.id];
    const prod = products.find(p => p.id === item.product_id);
    const requiresWeight = prod?.standard_weight ? prod.standard_weight > 0 : false;
    const isCement = isCementProduct(prod, item);

    if (requiresWeight) {
      return iv?.verified || (isMismatchApproved && iv?.weight);
    }
    if (isCement) {
      const expectedQty = Math.round(Number(item.quantity) || 1);
      return iv?.verified && isCementMatch(iv?.cementText, expectedQty);
    }
    return iv?.verified;
  });
  
  const canSendToBilling = allVerified && detail.status === 'pending';
  const canLoadAndComplete = detail.status === 'ready_for_loading';
  
  const [completing, setCompleting] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const handleSendToBilling = async () => {
    setCompleting(true);
    try {
      const newWeights = [];
      const newPhotos = [];
      
      for (const item of detailItems) {
        const iv = itemVerification[item.id];
        const prod = products.find(p => p.id === item.product_id);
        const isCement = isCementProduct(prod, item);

        if (iv) {
          let wt = Number(iv.weight) || 0;
          if (iv.weightUnit === 'g') wt = wt / 1000;
          if (wt > 0) {
            newWeights.push({ actual_weight: wt, notes: `Verified for ${item.product_name}` });
          } else if (isCement && iv.cementText) {
            newWeights.push({ actual_weight: Number(item.quantity) || 0, notes: `Verified ${iv.cementText.trim()} for ${item.product_name}` });
          }
          
          if (iv.photoFile) {
            const dataUrl: string = await new Promise((res, rej) => {
              const reader = new FileReader();
              reader.onload = () => res(reader.result as string);
              reader.onerror = rej;
              reader.readAsDataURL(iv.photoFile as File);
            });
            newPhotos.push({ url: dataUrl, caption: `Verified: ${item.product_name}` });
          }
        }
      }

      await api.put(`/dispatches/${detail.id}`, {
        ...detail,
        status: 'sent_to_billing',
        vehicle_number: vehicleNo.trim() || null,
        driver_name: driverName.trim() || null,
        driver_mobile: driverMobile.trim() || null,
        notes: remarks,
        weights: [...(detail.weights || []), ...newWeights],
        photos: [...(detail.photos || []), ...newPhotos]
      });

      toast('Verified and sent to billing', 'success');
      setConfirmModalOpen(false);
      onRefresh();
      onClose();
    } catch (err: any) {
      toast(err?.message || 'Failed to send to billing', 'error');
    }
    setCompleting(false);
  };

  const handleLoadAndComplete = async () => {
    if (goodsPhotos.length === 0) {
      toast('Please add at least one goods photo before loading & completing', 'error');
      return;
    }
    setCompleting(true);
    try {
      const photoUrls: string[] = await Promise.all(
        goodsPhotos.map(p => new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(p.file);
        }))
      );

      const primaryCover = photoUrls[0] || null;
      const goodsPhotoEntries = photoUrls.map((url, idx) => ({
        url,
        caption: `Goods Loaded Photo #${idx + 1}`
      }));

      await api.put(`/dispatches/${detail.id}`, {
        ...detail,
        status: 'completed',
        vehicle_leave_photo_url: primaryCover,
        photos: [...(detail.photos || []), ...goodsPhotoEntries],
        vehicle_number: vehicleNo.trim() || null,
        driver_name: driverName.trim() || null,
        driver_mobile: driverMobile.trim() || null,
        notes: remarks,
      });

      if (detail.order_id) {
        await api.put(`/orders/${detail.order_id}`, { status: 'completed' }).catch(() => {});
      }

      toast(`Dispatch loaded and completed with ${goodsPhotos.length} photo${goodsPhotos.length > 1 ? 's' : ''}`, 'success');
      setConfirmModalOpen(false);
      setIsCompletedLocal(true);
      onRefresh();
    } catch {
      toast('Failed to complete dispatch', 'error');
    }
    setCompleting(false);
  };

  const isCompleted = detail.status === 'completed' || isCompletedLocal;

  // Driver WhatsApp Tamil Message
  const getTamilDriverWhatsAppUrl = () => {
    const phone = (detail.driver_mobile || driverMobile || '').replace(/\D/g, '');
    const finalPhone = phone.length === 10 ? `91${phone}` : phone;
    const pendingAmt = (detail as any).bill?.pending_amount ?? 0;
    const text = 
`🚛 *அன்பு குரூப்ஸ் — டெலிவரி விவரம்*
─────────────────────────────
வணக்கம் ${detail.driver_name || driverName || 'ஓட்டுநர்'},

உங்களுக்கு புதிய டெலிவரி பணி ஒதுக்கப்பட்டுள்ளது:
📋 *ஆர்டர் எண்:* ${detail.order?.order_no || detail.dispatch_no || ''}
👤 *வாடிக்கையாளர்:* ${detail.customer?.name || ''}
📞 *தொலைபேசி:* ${detail.customer?.phone || '—'}
📍 *டெலிவரி முகவரி:* ${detail.delivery_address || detail.customer?.address || 'முகவரி குறிப்பிடப்படவில்லை'}
💰 *வாடிக்கையாளரிடம் பெற வேண்டிய தொகை:* ₹${Number(pendingAmt).toLocaleString('en-IN')}
🚛 *வாகன எண்:* ${detail.vehicle_number || vehicleNo || '—'}
─────────────────────────────
அன்பு குரூப்ஸ்`;

    return `https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="flex flex-col min-h-[85vh] bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
      
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <button onClick={onClose} className="hover:text-indigo-600 transition flex items-center gap-1">
              <ArrowLeft size={14} /> Back to Dispatches
            </button>
            <span>/</span>
            <span>Dispatch</span>
            <span>/</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{detail.dispatch_no}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Dispatch Verification</h1>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-2 text-slate-500 mb-1.5">
              <User size={16} /> <span className="text-sm font-medium">Customer Name</span>
            </div>
            <p className="font-bold text-lg text-slate-800 dark:text-white truncate" title={detail.customer?.name || 'Unknown'}>
              {detail.customer?.name || 'Unknown'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-start gap-1 font-medium" title={detail.delivery_address || (detail.customer as any)?.address || ''}>
              <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{detail.delivery_address || (detail.customer as any)?.address || 'Site delivery address not specified'}</span>
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <Calendar size={16} /> <span className="text-sm font-medium">Date Created</span>
            </div>
            <p className="font-bold text-lg text-slate-800 dark:text-white truncate">
              {new Date(detail.created_at).toLocaleString()}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <Search size={16} /> <span className="text-sm font-medium">Order ID</span>
            </div>
            <p className="font-bold font-mono text-lg text-slate-800 dark:text-white truncate" title={detail.order?.order_no || detail.order_id}>
              {detail.order?.order_no || detail.order_id.split('-')[0].toUpperCase()}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <CheckCircle2 size={16} /> <span className="text-sm font-medium">Status</span>
            </div>
            <DispatchStatusBadge status={detail.status} />
          </div>
        </div>

        {/* Items Verification Section */}
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Items to Verify</h2>
          <div className="space-y-4">
            {detailItems.map((item) => {
              const iv = itemVerification[item.id] || { weight: '', weightUnit: 'kg', photoFile: null, photoPreview: null, verified: false };
              const prod = products.find(p => p.id === item.product_id);
              const requiresWeight = prod?.standard_weight ? prod.standard_weight > 0 : false;
              const isCement = isCementProduct(prod, item);
              const cementQty = Math.round(Number(item.quantity) || 1);
              const isCementCorrect = isCement && isCementMatch(iv.cementText, cementQty);
              const hasEnteredCement = iv.cementText !== undefined && iv.cementText.trim() !== '';
              const isCementMismatch = isCement && hasEnteredCement && !isCementCorrect;
              const isVerificationDone = detail.status !== 'pending';

              // Weight verification calculations & quantity-scaled tolerance range
              const hasWeight = iv.weight !== undefined && iv.weight !== null && iv.weight.toString().trim() !== '';
              const qty = Number(item.quantity) || 1;
              const stdWeight = Number(prod?.standard_weight) || 0;
              const nominalWt = Number((stdWeight * qty).toFixed(3));

              // Quantity-scaled acceptable range
              const plusTolPerUnit = prod?.weight_tolerance != null ? Number(prod.weight_tolerance) : (weightThreshold / qty);
              const minusTolPerUnit = prod?.weight_tolerance_minus != null ? Number(prod.weight_tolerance_minus) : plusTolPerUnit;
              const minAllowedWeight = Number((nominalWt - (minusTolPerUnit * qty)).toFixed(3));
              const maxAllowedWeight = Number((nominalWt + (plusTolPerUnit * qty)).toFixed(3));

              let actualWt = 0;
              let isSteelMismatch = false;
              let isWeightCorrect = false;
              let isBelowMin = false;
              let isAboveMax = false;
              let diffAmount = 0;

              if (requiresWeight && hasWeight && !isNaN(Number(iv.weight)) && Number(iv.weight) > 0) {
                actualWt = Number(iv.weight);
                if (iv.weightUnit === 'g') actualWt = actualWt / 1000;
                actualWt = Number(actualWt.toFixed(3));

                if (actualWt < minAllowedWeight) {
                  isSteelMismatch = true;
                  isBelowMin = true;
                  diffAmount = Number((minAllowedWeight - actualWt).toFixed(3));
                } else if (actualWt > maxAllowedWeight) {
                  isSteelMismatch = true;
                  isAboveMax = true;
                  diffAmount = Number((actualWt - maxAllowedWeight).toFixed(3));
                } else {
                  isWeightCorrect = true;
                }
              }

              return (
                <div 
                  key={item.id} 
                  className={`grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 rounded-xl border transition ${
                    isSteelMismatch || isCementMismatch
                      ? 'border-2 border-rose-500 bg-rose-50/40 dark:bg-rose-950/30' 
                      : isWeightCorrect || isCementCorrect
                        ? 'border-2 border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20'
                        : iv.verified 
                          ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/50' 
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/50'
                  }`}
                >
                  
                  {/* Left: Info (3 cols) */}
                  <div className="lg:col-span-3 flex flex-col justify-center">
                    <p className="font-bold text-slate-800 dark:text-white text-base">{item.product_name}</p>
                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                      <span>Qty: <strong className="text-slate-700 dark:text-slate-300">{item.quantity} {item.unit}</strong></span>
                      {prod?.brand && <span className="badge bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs">{prod.brand}</span>}
                    </div>
                  </div>

                  {/* Middle: Weight / Bags Verification (4 cols) */}
                  <div className="lg:col-span-4 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-700/50 pt-4 lg:pt-0 lg:pl-4">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      {requiresWeight ? 'Weight Verification' : isCement ? 'Cement Count Verification' : 'Verification'}
                    </p>
                    {requiresWeight ? (
                      !isVerificationDone ? (
                        <div>
                          <div className="flex gap-2 items-center">
                            {/* Localized Shake & Vibration Alert on weight box during mismatch */}
                            <div className={isSteelMismatch ? 'animate-shake animate-shake-periodic' : ''}>
                              <input 
                                type="number" 
                                step="any"
                                value={iv.weight} 
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setItemVerification(prev => ({
                                    ...prev, 
                                    [item.id]: {...prev[item.id], weight: val}
                                  }));
                                  if (val && requiresWeight && Number(val) > 0) {
                                    let wt = Number(val);
                                    if (iv.weightUnit === 'g') wt = wt / 1000;
                                    if (wt < minAllowedWeight || wt > maxAllowedWeight) {
                                      if (typeof navigator !== 'undefined' && navigator.vibrate) {
                                        try { navigator.vibrate([150, 50, 150]); } catch {}
                                      }
                                    }
                                  }
                                }}
                                disabled={iv.verified}
                                className={`input w-28 text-center text-base font-black transition-all rounded-xl ${
                                  isSteelMismatch 
                                    ? 'bg-red-600 dark:bg-red-600 border-2 border-red-700 text-white placeholder-white/70 shadow-lg shadow-red-600/30' 
                                    : isWeightCorrect
                                      ? 'bg-emerald-600 dark:bg-emerald-600 border-2 border-emerald-700 text-white placeholder-white/70 shadow-lg shadow-emerald-600/30'
                                      : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-400'
                                }`}
                                placeholder="0.0" 
                              />
                            </div>
                            <select 
                              value={iv.weightUnit} 
                              onChange={(e) => setItemVerification(prev => ({...prev, [item.id]: {...prev[item.id], weightUnit: e.target.value as 'kg'|'g'}}))}
                              disabled={iv.verified}
                              className="input w-20 px-2 font-bold"
                            >
                              <option value="kg">kg</option>
                              <option value="g">g</option>
                            </select>
                            {isWeightCorrect && (
                              <div className="text-emerald-600 flex items-center gap-1 text-xs font-black ml-1">
                                <CheckCircle2 size={16} /> Verified
                              </div>
                            )}
                          </div>
                          
                          {/* Expected & Entered Weight Feedback with Quantity-Scaled Difference */}
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs flex-wrap">
                              <span className="text-slate-500 dark:text-slate-400 font-semibold">Acceptable:</span>
                              <span className="font-mono font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.5 rounded text-[11px]">
                                {minAllowedWeight.toFixed(3)} kg – {maxAllowedWeight.toFixed(3)} kg
                              </span>
                              <span className="text-[11px] text-slate-400">
                                (~{nominalWt.toFixed(2)} kg)
                              </span>
                            </div>

                            {isSteelMismatch ? (
                              <div className="text-[11px] text-rose-600 dark:text-rose-400 font-extrabold flex items-center gap-1">
                                <AlertCircle size={13} className="shrink-0 animate-bounce" />
                                <span>
                                  Mismatch: {actualWt.toFixed(3)} kg ({isBelowMin ? `${diffAmount.toFixed(3)} kg below min` : `${diffAmount.toFixed(3)} kg above max`})
                                </span>
                              </div>
                            ) : isWeightCorrect ? (
                              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                                <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />
                                <span>Match ✓ {actualWt.toFixed(3)} kg within allowed limits</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <p className="font-bold text-slate-700 dark:text-slate-300">
                          {detail.weights?.find(w => w.notes?.includes(item.product_name))?.actual_weight || 'Verified'} {detail.weights?.find(w => w.notes?.includes(item.product_name)) ? 'kg' : ''}
                        </p>
                      )
                    ) : isCement ? (
                      !isVerificationDone ? (
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="relative flex items-center">
                              <input 
                                type="text" 
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={iv.cementText || ''} 
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const matches = isCementMatch(val, cementQty);
                                  setItemVerification(prev => ({
                                    ...prev, 
                                    [item.id]: {
                                      ...prev[item.id], 
                                      cementText: val,
                                      verified: matches ? true : (prev[item.id]?.verified && !matches ? false : prev[item.id]?.verified)
                                    }
                                  }));
                                }}
                                disabled={iv.verified && isCementCorrect}
                                placeholder={`e.g. ${cementQty}`}
                                className={`input w-32 text-center text-base font-black transition-all rounded-xl ${
                                  isCementMismatch 
                                    ? 'bg-red-600 dark:bg-red-600 border-2 border-red-700 text-white placeholder-white/70 shadow-lg shadow-red-600/30' 
                                    : isCementCorrect
                                      ? 'bg-emerald-600 dark:bg-emerald-600 border-2 border-emerald-700 text-white placeholder-white/70 shadow-lg shadow-emerald-600/30'
                                      : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-400'
                                }`}
                              />
                            </div>
                            <span className="text-xs font-black text-slate-500 uppercase">bags</span>
                            {isCementCorrect && (
                              <div className="text-emerald-600 flex items-center gap-1 text-xs font-black ml-1">
                                <CheckCircle2 size={16} /> Verified
                              </div>
                            )}
                          </div>

                          {/* Expected & Entered Text Feedback */}
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs flex-wrap">
                              <span className="text-slate-500 dark:text-slate-400 font-semibold">Requirement:</span>
                              <span className="font-mono font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.5 rounded text-[11px]">
                                Enter "{cementQty}" ({cementQty} bags)
                              </span>
                            </div>

                            {isCementMismatch ? (
                              <div className="text-[11px] text-rose-600 dark:text-rose-400 font-extrabold flex items-center gap-1">
                                <AlertCircle size={13} className="shrink-0 animate-bounce" />
                                <span>Mismatch! Enter "{cementQty}" to confirm {cementQty} bags</span>
                              </div>
                            ) : isCementCorrect ? (
                              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                                <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />
                                <span>Match ✓ {cementQty} bags confirmed</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <p className="font-bold text-slate-700 dark:text-slate-300">
                          {cementQty} bags (Verified)
                        </p>
                      )
                    ) : (
                      <p className="text-sm italic text-slate-400">Not required for this product</p>
                    )}
                  </div>

                  {/* Right: Camera (3 cols) */}
                  <div className="lg:col-span-3 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-700/50 pt-4 lg:pt-0 lg:pl-4">
                    <p className="text-sm font-medium text-slate-500 mb-2">Capture Image <span className="text-xs font-normal italic">(Optional)</span></p>
                    {iv.photoPreview ? (
                      <div className="relative">
                        <img src={iv.photoPreview} alt="Preview" className="h-16 w-24 object-cover rounded-lg border border-slate-200" />
                        {!iv.verified && !isVerificationDone && (
                          <button 
                            onClick={() => setItemVerification(prev => ({...prev, [item.id]: {...prev[item.id], photoFile: null, photoPreview: null}}))}
                            className="text-xs text-rose-500 hover:underline mt-1 block"
                          >
                            Retake
                          </button>
                        )}
                      </div>
                    ) : (
                      !isVerificationDone && (
                        <button 
                          onClick={() => startCamera(item.id)}
                          className="flex items-center justify-center gap-2 w-full py-2 px-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 transition"
                        >
                          <Camera size={18} /> Take Photo
                        </button>
                      )
                    )}
                  </div>

                  {/* Far Right: Verify Checkbox (2 cols) */}
                  <div className="lg:col-span-2 flex items-center justify-end border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-700/50 pt-4 lg:pt-0 lg:pl-4">
                    {!isVerificationDone ? (
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <span className="font-bold text-slate-600 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-white">Verified</span>
                        <input 
                          type="checkbox" 
                          className="w-6 h-6 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          checked={iv.verified || isMismatchApproved}
                          disabled={
                            (requiresWeight && (!iv.weight || (isSteelMismatch && !isMismatchApproved))) ||
                            (isCement && !isCementCorrect)
                          }
                          onChange={(e) => setItemVerification(prev => ({...prev, [item.id]: {...prev[item.id], verified: e.target.checked}}))}
                        />
                      </label>
                    ) : (
                      <div className="flex items-center gap-2 text-emerald-600 font-bold">
                        <CheckCircle2 size={20} /> Verified
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weight Mismatch Status & Admin Approval Banner */}
        {/* Voice Note & Weight Mismatch Alert Section (Visible for both Dispatch & Admin) */}
        <div className="space-y-3">
          {isMismatchApproved ? (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 space-y-2.5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow">
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-emerald-900 dark:text-emerald-100">
                      ✅ Weight Mismatch Approved by Admin
                    </h3>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      Authorized by <strong className="underline">{detail.mismatch_approved_by || 'Admin'}</strong>. Weight difference is accepted and dispatch is unlocked for billing.
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 font-black text-xs rounded-full uppercase tracking-wider">
                  Override Authorized
                </span>
              </div>
              {detail.mismatch_voice_note_url && (
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1 shrink-0">
                    <Volume2 size={14} className="text-emerald-600" />
                    <span>Approved Voice Note:</span>
                  </span>
                  <audio
                    controls
                    src={
                      detail.mismatch_voice_note_url.startsWith('data:')
                        ? detail.mismatch_voice_note_url
                        : `/api/dispatches/${detail.id}/voice-note`
                    }
                    className="flex-1 h-8 rounded"
                  />
                </div>
              )}
            </div>
          ) : detail.mismatch_approval_status === 'pending' ? (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 space-y-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow animate-pulse">
                    <Clock size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-amber-900 dark:text-amber-100 flex items-center gap-2">
                      <span>⏳ Admin Approval Pending (Voice Note Attached)</span>
                    </h3>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      {detail.mismatch_reason ? `Reason: "${detail.mismatch_reason}"` : 'Voice note recorded for Admin review and authorization.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setVoiceModalOpen(true)}
                  className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-bold rounded-lg transition flex items-center gap-1"
                >
                  <Mic size={13} /> Re-record Voice Note
                </button>
              </div>

              {/* Audio Player visible to BOTH Admin & Dispatch */}
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 shrink-0">
                  <Volume2 size={15} className="text-amber-600 animate-pulse" />
                  <span>Listen to Voice Note:</span>
                </div>
                <audio
                  controls
                  src={
                    detail.mismatch_voice_note_url?.startsWith('data:')
                      ? detail.mismatch_voice_note_url
                      : `/api/dispatches/${detail.id}/voice-note`
                  }
                  className="flex-1 h-8 rounded"
                />
                {/* Admin 1-Click Action Controls */}
                {user?.role === 'admin' && (
                  <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => handleAdminMismatchDecision('approved')}
                      disabled={adminDeciding}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg shadow transition flex items-center gap-1 active:scale-95"
                    >
                      <CheckCircle2 size={14} /> Approve Mismatch
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const r = prompt('Enter rejection reason:');
                        if (r) handleAdminMismatchDecision('rejected', r);
                      }}
                      disabled={adminDeciding}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow transition flex items-center gap-1 active:scale-95"
                    >
                      <AlertCircle size={14} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : detail.mismatch_approval_status === 'rejected' ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200 flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow">
                  <AlertCircle size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-rose-900 dark:text-rose-100">
                    ❌ Weight Mismatch Request Rejected by Admin
                  </h3>
                  <p className="text-xs text-rose-700 dark:text-rose-300">
                    Reason: <strong className="underline">{detail.mismatch_rejection_reason || 'Please re-weigh items on scale.'}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVoiceModalOpen(true)}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1.5"
              >
                <Mic size={14} /> Send New Voice Note
              </button>
            </div>
          ) : detail.mismatch_voice_note_url ? (
            <div className="p-4 rounded-xl bg-indigo-50/90 dark:bg-indigo-950/40 border-2 border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200 space-y-2.5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow">
                    <Mic size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-indigo-950 dark:text-indigo-100">
                      🎙️ Dispatch Voice Note Attached
                    </h3>
                    <p className="text-xs text-indigo-700 dark:text-indigo-300">
                      {detail.mismatch_reason ? `Note: "${detail.mismatch_reason}"` : 'Voice note recorded for this dispatch.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setVoiceModalOpen(true)}
                  className="px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 text-xs font-bold rounded-lg transition flex items-center gap-1"
                >
                  <Mic size={13} /> Re-record Voice Note
                </button>
              </div>
              <audio
                controls
                src={
                  detail.mismatch_voice_note_url.startsWith('data:')
                    ? detail.mismatch_voice_note_url
                    : `/api/dispatches/${detail.id}/voice-note`
                }
                className="w-full h-8 rounded"
              />
            </div>
          ) : isWeightWarning || detailItems.some(item => {
            const ivItem = itemVerification[item.id];
            const prod = products.find(p => p.id === item.product_id);
            if (!prod?.standard_weight || !ivItem?.weight || isNaN(Number(ivItem.weight)) || Number(ivItem.weight) <= 0) return false;
            let actualWt = Number(ivItem.weight);
            if (ivItem.weightUnit === 'g') actualWt /= 1000;
            const q = Number(item.quantity) || 1;
            const nom = Number((prod.standard_weight * q).toFixed(3));
            const plusT = prod.weight_tolerance != null ? Number(prod.weight_tolerance) : (weightThreshold / q);
            const minusT = prod.weight_tolerance_minus != null ? Number(prod.weight_tolerance_minus) : plusT;
            const minW = Number((nom - (minusT * q)).toFixed(3));
            const maxW = Number((nom + (plusT * q)).toFixed(3));
            return actualWt < minW || actualWt > maxW;
          }) ? (
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-orange-500/15 border-2 border-amber-400 dark:border-amber-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                    Weight Difference Detected (Above Allowed Tolerance)
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    To proceed with this dispatch, record a voice note for the Admin explaining the difference.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVoiceModalOpen(true)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition active:scale-95"
              >
                <Mic size={16} /> Request Admin Approval (Voice Note)
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 shrink-0 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Mic size={18} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    🎙️ Voice Note / Audio Instructions (Visible to Admin & Dispatch)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Record spoken delivery instructions, item weight explanations, or notes.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVoiceModalOpen(true)}
                className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <Mic size={14} /> Record Voice Note
              </button>
            </div>
          )}

          {/* Driver Proof of Delivery Voice Note (if completed by driver) */}
          {detail.pod_voice_note_url && (
            <div className="p-3.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border-2 border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck size={16} className="text-indigo-600" />
                  <h4 className="font-black text-xs">🚚 Driver Proof of Delivery (POD) Voice Note</h4>
                </div>
                <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900 px-2 py-0.5 rounded-full text-indigo-700 dark:text-indigo-300">
                  On-Site Recording
                </span>
              </div>
              <audio
                controls
                src={
                  detail.pod_voice_note_url.startsWith('data:')
                    ? detail.pod_voice_note_url
                    : `/api/dispatches/${detail.id}/pod-voice-note`
                }
                className="w-full h-8 rounded"
              />
            </div>
          )}
        </div>

        {/* Lower Section: Weights & Phase 1 Driver Assignment */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weight Summary */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/50 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Weight Summary</h2>
            <div className="flex flex-col gap-4">
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span className="font-medium text-slate-500">Estimated Weight</span>
                <span className="text-xl font-bold text-slate-800 dark:text-white">{estimatedTotal.toFixed(2)} kg</span>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800/50 flex justify-between items-center">
                <span className="font-medium text-indigo-700 dark:text-indigo-300">Actual Total Weight</span>
                <span className="text-xl font-bold text-indigo-800 dark:text-indigo-200">{actualTotal.toFixed(2)} kg</span>
              </div>
              
              {/* Validation UI */}
              <div className={`p-4 rounded-lg border flex justify-between items-center ${isWeightWarning ? 'bg-rose-50 border-rose-200' : weightDiff === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <span className={`font-medium ${isWeightWarning ? 'text-rose-700' : weightDiff === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  Total Difference
                </span>
                <span className={`text-lg font-bold ${isWeightWarning ? 'text-rose-800' : weightDiff === 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {actualTotal === 0 ? 'Pending Entry' : weightDiff === 0 ? 'Matched' : `${weightDiff.toFixed(2)} kg`}
                </span>
              </div>
            </div>
          </div>

          {/* Phase 1: Driver Assignment & Vehicle Details */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/50 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center justify-between">
              <span>Driver Assignment & Transport</span>
              <span className="text-xs px-2.5 py-1 rounded bg-amber-100 text-amber-800 font-bold uppercase">Phase 1</span>
            </h2>
            
            <div className="space-y-4">
              {/* Driver Dropdown */}
              {!isCompleted && (
                <div>
                  <label className="label flex items-center gap-1">
                    <UserCheck size={14} className="text-amber-600" /> Select Registered Driver
                  </label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => handleSelectDriver(e.target.value)}
                    disabled={isCompleted}
                    className="input font-medium"
                  >
                    <option value="">Choose driver from fleet...</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.phone_number}) {d.vehicle_number ? `— Vehicle: ${d.vehicle_number}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Driver Name</label>
                  <input 
                    type="text" 
                    value={driverName} 
                    onChange={(e) => setDriverName(e.target.value)}
                    disabled={isCompleted}
                    className="input font-semibold" 
                    placeholder="e.g. Ramesh" 
                  />
                </div>
                <div>
                  <label className="label">Driver Mobile</label>
                  <input 
                    type="text" 
                    value={driverMobile} 
                    onChange={(e) => setDriverMobile(e.target.value)}
                    disabled={isCompleted}
                    className="input" 
                    placeholder="e.g. 9876543210" 
                  />
                </div>
                <div className="col-span-2">
                  <label className="label">Vehicle Number</label>
                  <input 
                    type="text" 
                    value={vehicleNo} 
                    onChange={(e) => setVehicleNo(e.target.value)}
                    disabled={isCompleted}
                    className="input font-semibold" 
                    placeholder="e.g. TN 38 AB 1234" 
                  />
                </div>
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Remarks / Delivery Instructions</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={startSpeechDictation}
                        disabled={isCompleted || isListeningSpeech}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition ${
                          isListeningSpeech
                            ? 'bg-rose-100 text-rose-600 animate-pulse'
                            : 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50'
                        }`}
                        title="Dictate in Tamil or English (Speech to Text)"
                      >
                        <Mic size={13} /> {isListeningSpeech ? 'Listening...' : 'Voice Type'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setVoiceModalOpen(true)}
                        disabled={isCompleted}
                        className="text-xs font-bold px-2.5 py-1 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 flex items-center gap-1 transition"
                        title="Record a voice note"
                      >
                        <Volume2 size={13} /> Voice Note
                      </button>
                    </div>
                  </div>
                  <textarea 
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    disabled={isCompleted}
                    className="input min-h-[60px]" 
                    placeholder="Special instructions for loading or delivery..."
                  ></textarea>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Completion Action Bar */}
      <div className="sticky bottom-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 p-4 flex justify-between items-center">
        <div>
          {isCompleted && (
            <div className="flex gap-3">
              <a
                href={`https://wa.me/${detail.customer?.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${detail.customer?.name}, your order ${detail.order?.order_no || ''} has been dispatched via vehicle ${detail.vehicle_number || ''}. Driver: ${detail.driver_name || ''} (${detail.driver_mobile || ''}). Pending amount to pay: Rs. ${(detail as any).bill?.pending_amount || 0}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                Message Customer
              </a>
              {/* Message Driver in Tamil */}
              <a
                href={getTamilDriverWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 font-bold"
              >
                Message Driver (தமிழ்)
              </a>
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-3">
          {detail.status === 'pending' && (
            <button 
              onClick={() => setConfirmModalOpen(true)}
              disabled={!canSendToBilling || completing}
              className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg transition ${
                canSendToBilling 
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg cursor-pointer' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 size={24} /> {completing ? 'Processing...' : 'Verify & Send to Billing'}
            </button>
          )}

          {!isCompleted && detail.status === 'ready_for_loading' && (
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
              {/* Goods Photos Multi-Thumbnails & Upload */}
              <div className="flex items-center gap-2 flex-wrap">
                {goodsPhotos.map((photo, idx) => (
                  <div key={photo.id} className="relative group">
                    <img 
                      src={photo.preview} 
                      alt={`Goods ${idx + 1}`} 
                      onClick={() => setEnlargedPhotoUrl(photo.preview)}
                      className="h-12 w-14 object-cover rounded-xl border-2 border-indigo-200 dark:border-indigo-800 shadow-sm cursor-pointer hover:opacity-90 hover:scale-105 transition" 
                    />
                    <span className="absolute bottom-1 left-1 bg-black/75 text-white text-[9px] font-mono px-1 rounded font-bold">
                      #{idx + 1}
                    </span>
                    <button 
                      type="button"
                      onClick={() => handleRemoveGoodsPhoto(photo.id)}
                      className="absolute -top-1.5 -right-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full w-5 h-5 flex justify-center items-center text-xs shadow-md transition"
                      title="Remove Photo"
                    >×</button>
                  </div>
                ))}

                {/* Add Photo Actions */}
                <div className="flex items-center gap-1.5">
                  <input
                    ref={goodsFileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleGoodsFilesSelected}
                  />
                  <button 
                    type="button"
                    onClick={() => goodsFileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition shadow-sm"
                    title="Upload goods photos from device gallery"
                  >
                    <Upload size={15} />
                    <span>Upload Photos</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => startVehicleCamera()}
                    className="flex items-center gap-1.5 px-3 py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition shadow-sm"
                    title="Take photo with camera"
                  >
                    <Camera size={15} />
                    <span>Camera</span>
                  </button>
                </div>
              </div>

              <button 
                onClick={() => handleLoadAndComplete()}
                disabled={completing || goodsPhotos.length === 0}
                className={`flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-base transition ${
                  goodsPhotos.length > 0 && !completing
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg cursor-pointer' 
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Truck size={22} /> {completing ? 'Processing...' : `Load & Complete (${goodsPhotos.length} photo${goodsPhotos.length === 1 ? '' : 's'})`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Voice Note Recording Modal */}
      {voiceModalOpen && (
        <Modal open={voiceModalOpen} onClose={() => { if (!submittingVoiceNote) setVoiceModalOpen(false); }} title="Record Voice Note (Admin & Dispatch)">
          <div className="space-y-5">
            <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200">
              Speak to explain weight differences, loading instructions, customer requests, or dispatch notes. Both Admin and Dispatch can listen to this recording.
            </div>

            {/* Recorder Controls */}
            <div className="p-6 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-b from-indigo-50/50 to-white dark:from-slate-800 dark:to-slate-900 text-center space-y-4 shadow-sm">
              {!audioPreviewUrl ? (
                <div>
                  <div className="text-3xl font-black font-mono text-indigo-950 dark:text-indigo-200 mb-4">
                    00:{recordingSeconds.toString().padStart(2, '0')} <span className="text-xs font-normal text-slate-400">/ 01:00</span>
                  </div>

                  {isRecording ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-1.5 h-8">
                        <div className="w-1.5 h-6 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-8 bg-rose-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-5 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        <div className="w-1.5 h-7 bg-rose-600 rounded-full animate-bounce" style={{ animationDelay: '75ms' }} />
                      </div>
                      <button
                        type="button"
                        onClick={stopVoiceRecording}
                        className="px-6 py-3 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-black text-sm flex items-center justify-center gap-2 mx-auto shadow-lg active:scale-95 transition"
                      >
                        <MicOff size={18} /> Stop Recording
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      className="px-6 py-3.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center gap-2 mx-auto shadow-lg hover:shadow-indigo-500/30 active:scale-95 transition"
                    >
                      <Mic size={20} className="animate-pulse" /> Start Recording Voice Note
                    </button>
                  )}
                </div>
              ) : (
                /* Recorded Audio Preview */
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
                    <CheckCircle2 size={16} /> Audio Recorded ({recordingSeconds}s)
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-indigo-200 dark:border-slate-700 flex flex-col gap-2.5">
                    <audio 
                      controls
                      src={audioPreviewUrl} 
                      className="w-full h-9 rounded"
                    />
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={resetVoiceRecording}
                        className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 font-bold"
                      >
                        <RotateCcw size={13} /> Retake Recording
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Text Note */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Optional Written Note (Additional details):
              </label>
              <input
                type="text"
                value={mismatchReasonInput}
                onChange={(e) => setMismatchReasonInput(e.target.value)}
                placeholder="e.g. Bundles weighed with protective straps or loading instructions"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setVoiceModalOpen(false)}
                disabled={submittingVoiceNote}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitMismatchApproval}
                disabled={submittingVoiceNote || (!audioBlob && !mismatchReasonInput.trim())}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                {submittingVoiceNote ? 'Saving...' : '🚀 Save & Attach Voice Note'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Camera Modal */}
      {cameraModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4">
          <div className="relative w-full max-w-lg bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800">
            <video ref={videoRef} autoPlay playsInline className="w-full aspect-video object-cover bg-slate-900" />
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex justify-between items-center px-6">
              <button onClick={stopCamera} className="text-white hover:text-rose-400 transition font-medium">Cancel</button>
              <button 
                onClick={() => capturePhoto(videoRef.current)}
                className="w-16 h-16 rounded-full bg-white/20 border-4 border-white flex items-center justify-center hover:bg-white/40 transition active:scale-95"
                title="Capture Photo"
              >
                <Camera size={24} className="text-white" />
              </button>
              {cameraType === 'vehicle' && goodsPhotos.length > 0 ? (
                <button 
                  onClick={stopCamera} 
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg transition"
                >
                  Done ({goodsPhotos.length})
                </button>
              ) : (
                <div className="w-12"></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enlarged Photo Lightbox Modal */}
      {enlargedPhotoUrl && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4" onClick={() => setEnlargedPhotoUrl(null)}>
          <div className="relative max-w-2xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <img src={enlargedPhotoUrl} alt="Enlarged Goods Preview" className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl" />
            <button 
              type="button"
              onClick={() => setEnlargedPhotoUrl(null)}
              className="absolute -top-3 -right-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg shadow-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Close Preview"
            >×</button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal open={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} title="Send to Billing">
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-lg">
            Are you sure you want to send this dispatch to billing? All weights, photos, and assigned driver details will be finalized.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setConfirmModalOpen(false)} className="btn-secondary" disabled={completing}>Cancel</button>
            <button onClick={handleSendToBilling} className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 font-medium" disabled={completing}>
              {completing ? 'Sending...' : 'Yes, Send to Billing'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
