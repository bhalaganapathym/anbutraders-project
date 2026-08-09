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
  
  // Vehicle Details State (Pre-filled from billing if ready)
  const [vehicleNo, setVehicleNo] = useState(detail.vehicle_number || '');
  const [driverName, setDriverName] = useState(detail.driver_name || '');
  const [driverMobile, setDriverMobile] = useState(detail.driver_mobile || '');
  const [remarks, setRemarks] = useState('');

  const canSendToBilling = !!vehicleNo && !!driverName && !!driverMobile && detail.status === 'pending';
  const canLoadAndComplete = detail.status === 'ready_for_loading';
  
  const [completing, setCompleting] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // New: Photo of vehicle leaving
  const [vehicleLeavePhotoPreview, setVehicleLeavePhotoPreview] = useState<string|null>(null);
  const [vehicleLeavePhotoFile, setVehicleLeavePhotoFile] = useState<File|null>(null);

  const startVehicleCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraModalOpen(true);
      // Wait, we need to distinguish between item camera and vehicle camera
      // For simplicity, we can override the camera logic or just use file input
    } catch {
      toast('Camera not available', 'error');
    }
  };

  const handleSendToBilling = async () => {
    setCompleting(true);
    try {
      await api.put(`/dispatches/${detail.id}`, {
        ...detail,
        status: 'ready_for_loading',
        vehicle_number: vehicleNo,
        driver_name: driverName,
        driver_mobile: driverMobile,
        remarks: remarks || null
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

      toast('Dispatch loaded and completed', 'success');
      setConfirmModalOpen(false);
      onRefresh();
      // We do NOT close the modal so they can see the WhatsApp buttons
    } catch {
      toast('Failed to complete dispatch', 'error');
    }
    setCompleting(false);
  };

  const isCompleted = detail.status === 'completed';

  return (
    <div className={`flex flex-col min-h-[85vh] bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800`}>
      
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

        {/* Lower Section: Vehicle Details */}
        <div className="grid grid-cols-1 gap-6">

          {/* Vehicle Details & Remarks */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/50 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
              {detail.status !== 'pending' ? 'Vehicle Details & Remarks' : 'Remarks / Notes'}
            </h2>
            <div className="grid grid-cols-2 gap-4">
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
          {detail.status !== 'pending' && (
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
              <CheckCircle2 size={24} /> {completing ? 'Processing...' : 'Assign Driver & Mark Ready'}
            </button>
          )}

          {detail.status === 'ready_for_loading' && (
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
                  <label className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 text-slate-500">
                    <Camera size={20} />
                    <span className="text-sm font-medium">Add Vehicle Photo (Optional)</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setVehicleLeavePhotoFile(file);
                          setVehicleLeavePhotoPreview(URL.createObjectURL(file));
                        }
                      }} 
                    />
                  </label>
                )}
              </div>
              <button 
                onClick={() => handleLoadAndComplete()}
                disabled={completing}
                className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition"
              >
                <Truck size={24} /> {completing ? 'Processing...' : 'Load & Complete'}
              </button>
            </div>
          )}
        </div>
      </div>



      {/* Confirmation Modal */}
      <Modal open={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} title="Confirm Driver Assignment">
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-lg">
            <p className="text-slate-600 dark:text-slate-300">Are you sure you want to assign driver <strong>{driverName}</strong> (Vehicle: {vehicleNo}) for this dispatch?</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setConfirmModalOpen(false)} className="btn-secondary" disabled={completing}>Cancel</button>
            <button onClick={handleSendToBilling} className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 font-medium" disabled={completing}>
              {completing ? 'Assigning...' : 'Assign Driver & Mark Ready'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
