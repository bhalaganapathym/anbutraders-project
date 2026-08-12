import { useState, useEffect, useRef } from 'react';
import { api, type Dispatch, type DispatchItem, type Product } from '@/lib/api';
import { useToast } from '@/components/Toast';
import DispatchStatusBadge from '@/components/DispatchStatusBadge';
import {
  ArrowLeft, CheckCircle2, AlertCircle, Camera, User, Calendar, MapPin, Search, Plus, Truck
} from 'lucide-react';
import Modal from '@/components/Modal';

type DispatchRow = Dispatch & { customer: { name: string; phone: string | null } | null };

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
  photoFile: File | null;
  photoPreview: string | null;
  verified: boolean;
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
  
  // Products lookup to get standard_weight
  const [products, setProducts] = useState<Product[]>([]);
  const [weightThreshold, setWeightThreshold] = useState<number>(3);
  
  useEffect(() => {
    api.get('/products').then(data => setProducts(data)).catch(() => {});
    api.get('/settings/weight_difference_threshold')
       .then(data => { if (data && data.value) setWeightThreshold(Number(data.value)); })
       .catch(() => {});
  }, []);

  const detailItems = (detail.items || []) as DispatchItem[];
  
  // State for item verification
  const [itemVerification, setItemVerification] = useState<Record<string, ItemVerificationState>>({});
  
  // Initialize state
  useEffect(() => {
    if (detail.status === 'completed') return; // Read-only if completed
    const initial: Record<string, ItemVerificationState> = {};
    detailItems.forEach(item => {
      initial[item.id] = { weight: '', weightUnit: 'kg', photoFile: null, photoPreview: null, verified: false };
    });
    setItemVerification(initial);
  }, [detail.id, detailItems]); // Ensure this is stable

  // Camera State
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [activeCameraItemId, setActiveCameraItemId] = useState<string | null>(null);
  const [cameraType, setCameraType] = useState<'item' | 'vehicle' | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Photo of vehicle/goods leaving
  const [vehicleLeavePhotoPreview, setVehicleLeavePhotoPreview] = useState<string|null>(null);
  const [vehicleLeavePhotoFile, setVehicleLeavePhotoFile] = useState<File|null>(null);

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, cameraModalOpen]);

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
      if (blob) {
        if (cameraType === 'item' && activeCameraItemId) {
          const file = new File([blob], `item_${activeCameraItemId}_${Date.now()}.jpg`, { type: 'image/jpeg' });
          const compressed = await compressImage(file);
          const previewUrl = URL.createObjectURL(compressed);
          setItemVerification(prev => ({
            ...prev,
            [activeCameraItemId]: { ...prev[activeCameraItemId], photoFile: compressed, photoPreview: previewUrl }
          }));
        } else if (cameraType === 'vehicle') {
          const file = new File([blob], `goods_${Date.now()}.jpg`, { type: 'image/jpeg' });
          const compressed = await compressImage(file);
          setVehicleLeavePhotoFile(compressed);
          setVehicleLeavePhotoPreview(URL.createObjectURL(compressed));
        }
        
        toast('Photo captured', 'success');
        stopCamera();
      }
    }, 'image/jpeg', 0.85);
  };
  
  // Calculate weights
  let estimatedTotal = 0;
  let actualTotal = 0;
  
  detailItems.forEach(item => {
    const prod = products.find(p => p.id === item.product_id);
    const stdWt = prod?.standard_weight || 0;
    estimatedTotal += stdWt * item.quantity;
    
    // For read-only completed state, use saved weights, else use inputs
    if (detail.status !== 'completed') {
      const iv = itemVerification[item.id];
      if (iv && iv.weight) {
        let wt = Number(iv.weight);
        if (iv.weightUnit === 'g') wt = wt / 1000;
        actualTotal += wt;
      }
    }
  });

  if (detail.status === 'completed') {
    actualTotal = (detail.weights || []).reduce((sum, w) => sum + w.actual_weight, 0);
  }

  const weightDiff = Math.abs(estimatedTotal - actualTotal);
  const isWeightWarning = detail.status === 'pending' && estimatedTotal > 0 && weightDiff > weightThreshold;

  // Vehicle Details State (Pre-filled from billing if ready)
  const [vehicleNo, setVehicleNo] = useState(detail.vehicle_number || '');
  const [driverName, setDriverName] = useState(detail.driver_name || '');
  const [driverMobile, setDriverMobile] = useState(detail.driver_mobile || '');
  const [remarks, setRemarks] = useState('');

  // Completion Logic
  const [isCompletedLocal, setIsCompletedLocal] = useState(false);
  const allVerified = detailItems.every(item => itemVerification[item.id]?.verified);
  
  const canSendToBilling = allVerified && !isWeightWarning && detail.status === 'pending';
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
        if (iv) {
          let wt = Number(iv.weight) || 0;
          if (iv.weightUnit === 'g') wt = wt / 1000;
          if (wt > 0) newWeights.push({ actual_weight: wt, notes: `Verified for ${item.product_name}` });
          
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
        weights: [...(detail.weights || []), ...newWeights],
        photos: [...(detail.photos || []), ...newPhotos]
      });

      const customerName = detail.customer?.name ?? 'Unknown';
      await api.post('/notifications', {
        type: 'billing_alert',
        title: `Dispatch ${detail.dispatch_no} ready for billing`,
        message: `Dispatch ${detail.dispatch_no} for ${customerName} has been verified and is ready for billing.`,
        dispatch_id: detail.id,
        order_id: detail.order_id,
        customer_name: customerName,
      });

      toast('Verified and sent to billing', 'success');
      setConfirmModalOpen(false);
      onRefresh();
      onClose();
    } catch {
      toast('Failed to send to billing', 'error');
    }
    setCompleting(false);
  };

  const handleLoadAndComplete = async () => {
    setCompleting(true);
    try {
      let photoUrl = null;
      if (vehicleLeavePhotoFile) {
         photoUrl = await new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result as string);
            reader.onerror = rej;
            reader.readAsDataURL(vehicleLeavePhotoFile);
         });
      }

      await api.put(`/dispatches/${detail.id}`, {
        ...detail,
        status: 'completed',
        vehicle_leave_photo_url: photoUrl,
        vehicle_number: vehicleNo.trim() || null,
        driver_name: driverName.trim() || null,
        driver_mobile: driverMobile.trim() || null,
        notes: remarks,
      });

      await api.post('/notifications', {
        type: 'dispatch_completed',
        title: `Dispatch ${detail.dispatch_no} completed`,
        message: `Dispatch ${detail.dispatch_no} for ${detail.customer?.name} has been loaded onto vehicle ${vehicleNo.trim()} and completed.`,
        dispatch_id: detail.id,
        order_id: detail.order_id,
        customer_name: detail.customer?.name,
        image_url: photoUrl
      });

      toast('Dispatch loaded and completed', 'success');
      setConfirmModalOpen(false);
      setIsCompletedLocal(true);
      onRefresh();
      // We do NOT close the modal so they can see the WhatsApp buttons
    } catch {
      toast('Failed to complete dispatch', 'error');
    }
    setCompleting(false);
  };

  const isCompleted = detail.status === 'completed' || isCompletedLocal;

  return (
    <div className={`flex flex-col min-h-[85vh] bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm border ${isWeightWarning ? 'border-rose-500 animate-screen-blink' : 'border-slate-200 dark:border-slate-800'}`}>
      
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
        {/* Top Summary Cards (12-column grid inside) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <User size={16} /> <span className="text-sm font-medium">Customer Name</span>
            </div>
            <p className="font-bold text-lg text-slate-800 dark:text-white truncate" title={detail.customer?.name || 'Unknown'}>
              {detail.customer?.name || 'Unknown'}
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
              const isVerificationDone = detail.status !== 'pending';

              // Steel item weight mismatch check
              const catLower = (prod?.category || '').toLowerCase();
              const isSteel = catLower.includes('steel') || catLower.includes('tmt');
              let isSteelMismatch = false;
              if (isSteel && requiresWeight && !isVerificationDone && iv.weight) {
                let actualWt = Number(iv.weight);
                if (iv.weightUnit === 'g') actualWt = actualWt / 1000;
                const expectedWt = (prod?.standard_weight || 0) * item.quantity;
                const tolerance = prod?.weight_tolerance != null ? Number(prod.weight_tolerance) : weightThreshold;
                const itemDiff = Math.abs(expectedWt - actualWt);
                if (itemDiff > tolerance) {
                  isSteelMismatch = true;
                }
              }

              return (
                <div 
                  key={item.id} 
                  className={`grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 rounded-xl border transition ${
                    isSteelMismatch 
                      ? 'border-2 border-rose-500 animate-pulse bg-rose-50/40 dark:bg-rose-950/20' 
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

                  {/* Middle: Weight (4 cols) */}
                  <div className="lg:col-span-4 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-700/50 pt-4 lg:pt-0 lg:pl-4">
                    <p className="text-sm font-medium text-slate-500 mb-2">Weight Verification</p>
                    {requiresWeight ? (
                      !isVerificationDone ? (
                        <div className="flex gap-2 items-center">
                          <input 
                            type="number" 
                            value={iv.weight} 
                            onChange={(e) => setItemVerification(prev => ({...prev, [item.id]: {...prev[item.id], weight: e.target.value}}))}
                            disabled={iv.verified}
                            className={`input w-24 text-center font-bold ${isSteelMismatch ? 'border-rose-500 text-rose-600 bg-rose-50' : ''}`}
                            placeholder="0.0" 
                          />
                          <select 
                            value={iv.weightUnit} 
                            onChange={(e) => setItemVerification(prev => ({...prev, [item.id]: {...prev[item.id], weightUnit: e.target.value as 'kg'|'g'}}))}
                            disabled={iv.verified}
                            className="input w-20 px-2"
                          >
                            <option value="kg">kg</option>
                            <option value="g">g</option>
                          </select>
                          {!iv.verified && iv.weight && !isSteelMismatch && (
                            <div className="text-emerald-600 flex items-center gap-1 text-sm ml-2 font-medium">
                              <CheckCircle2 size={14} /> Recorded
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="font-bold text-slate-700 dark:text-slate-300">
                          {detail.weights?.find(w => w.notes?.includes(item.product_name))?.actual_weight || 'Verified'} {detail.weights?.find(w => w.notes?.includes(item.product_name)) ? 'kg' : ''}
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
                          checked={iv.verified}
                          disabled={requiresWeight && (!iv.weight || isSteelMismatch)}
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

        {/* Lower Section: Weights & Vehicle */}
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
              <div className={`p-4 rounded-lg border flex justify-between items-center ${isWeightWarning ? 'bg-rose-50 border-rose-200 animate-pulse' : weightDiff === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <span className={`font-medium ${isWeightWarning ? 'text-rose-700' : weightDiff === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  Difference
                </span>
                <span className={`text-lg font-bold ${isWeightWarning ? 'text-rose-800' : weightDiff === 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {weightDiff === 0 ? 'Matched' : `${weightDiff.toFixed(2)} kg`}
                </span>
              </div>
              {isWeightWarning && (
                <p className="text-sm text-rose-600 font-bold flex items-center gap-1 mt-[-8px]">
                  <AlertCircle size={14} /> Difference exceeds allowed threshold ({weightThreshold}kg). Dispatch cannot be processed.
                </p>
              )}
            </div>
          </div>

          {/* Vehicle Details & Remarks */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/50 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
              {detail.status === 'ready_for_loading' || detail.status === 'completed' ? 'Vehicle Details & Remarks' : 'Remarks / Notes'}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {(detail.status === 'ready_for_loading' || detail.status === 'completed') && (
                <>
                  <div>
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
                  <div>
                    <label className="label">Transport Company</label>
                    <input type="text" className="input" placeholder="e.g. SR Travels" disabled={isCompleted} />
                  </div>
                  <div>
                    <label className="label">Driver Name</label>
                    <input 
                      type="text" 
                      value={driverName} 
                      onChange={(e) => setDriverName(e.target.value)}
                      disabled={isCompleted}
                      className="input" 
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
                    />
                  </div>
                </>
              )}
              <div className="col-span-2">
                <label className="label">Remarks / Notes</label>
                <textarea 
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  disabled={isCompleted}
                  className="input min-h-[80px]" 
                  placeholder="Any specific instructions..."
                ></textarea>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Completion Action Bar */}
      <div className="sticky bottom-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 p-4 flex justify-between items-center">
        <div>
          {isCompleted && (
            <div className="flex gap-4">
              <a
                href={`https://wa.me/${detail.customer?.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${detail.customer?.name}, your order ${detail.order?.order_no || ''} has been dispatched via vehicle ${detail.vehicle_number || ''}. Driver: ${detail.driver_name || ''} (${detail.driver_mobile || ''}). Pending amount to pay: Rs. ${(detail as any).bill?.pending_amount || 0}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                Message Customer
              </a>
              <a
                href={`https://wa.me/${detail.driver_mobile?.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${detail.driver_name}, you have been assigned to order ${detail.order?.order_no || ''} for ${detail.customer?.name}. Delivery Address: ${detail.delivery_address || ''}. Pending amount to collect from customer: Rs. ${(detail as any).bill?.pending_amount || 0}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                Message Driver
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
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 size={24} /> {completing ? 'Processing...' : 'Verify & Send to Billing'}
            </button>
          )}

          {!isCompleted && detail.status === 'ready_for_loading' && (
            <div className="flex items-center gap-4">
              {/* Optional Photo */}
              <div className="flex items-center gap-2">
                {vehicleLeavePhotoPreview ? (
                  <div className="relative">
                    <img src={vehicleLeavePhotoPreview} alt="Vehicle Preview" className="h-12 w-16 object-cover rounded border border-slate-300" />
                    <button 
                      onClick={() => { setVehicleLeavePhotoFile(null); setVehicleLeavePhotoPreview(null); }}
                      className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-5 h-5 flex justify-center items-center text-xs"
                    >×</button>
                  </div>
                ) : (
                  <button 
                    onClick={() => startVehicleCamera()}
                    className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 text-slate-500"
                  >
                    <Camera size={20} />
                    <span className="text-sm font-medium">Add Goods Photo *</span>
                  </button>
                )}
              </div>
              <button 
                onClick={() => handleLoadAndComplete()}
                disabled={completing || !vehicleLeavePhotoFile}
                className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg transition ${
                  vehicleLeavePhotoFile ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Truck size={24} /> {completing ? 'Processing...' : 'Load & Complete'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Camera Modal */}
      {cameraModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4">
          <div className="relative w-full max-w-lg bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800">
            <video ref={videoRef} autoPlay playsInline className="w-full aspect-video object-cover bg-slate-900" />
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex justify-center items-center gap-6">
              <button onClick={stopCamera} className="text-white hover:text-rose-400 transition font-medium">Cancel</button>
              <button 
                onClick={() => capturePhoto(videoRef.current)}
                className="w-16 h-16 rounded-full bg-white/20 border-4 border-white flex items-center justify-center hover:bg-white/40 transition active:scale-95"
              >
                <Camera size={24} className="text-white" />
              </button>
              <div className="w-12"></div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal open={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} title="Send to Billing">
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-lg">
            Are you sure you want to send this dispatch to billing? All weights and images will be finalized.
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
