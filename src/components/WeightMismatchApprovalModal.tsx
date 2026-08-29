import { useState, useRef } from 'react';
import { api, type Dispatch } from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  AlertTriangle, CheckCircle2, XCircle, Mic, Play, Pause, Volume2, Truck, User, Scale, ArrowRight, Clock
} from 'lucide-react';
import Modal from '@/components/Modal';

export default function WeightMismatchApprovalModal({
  isOpen,
  onClose,
  dispatch,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  dispatch: Dispatch | null;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!isOpen || !dispatch) return null;

  const audioUrl = dispatch.mismatch_voice_note_url 
    ? (dispatch.mismatch_voice_note_url.startsWith('http') 
        ? dispatch.mismatch_voice_note_url 
        : `http://localhost:8080${dispatch.mismatch_voice_note_url}`)
    : null;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    if (decision === 'rejected' && !rejecting) {
      setRejecting(true);
      return;
    }

    if (decision === 'rejected' && !rejectionReason.trim()) {
      toast('Please provide a reason for rejecting the mismatch', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/dispatches/${dispatch.id}/mismatch-decision`, {
        decision,
        approved_by: 'Admin',
        rejection_reason: decision === 'rejected' ? rejectionReason.trim() : null
      });

      toast(
        decision === 'approved' 
          ? 'Weight mismatch approved. Dispatch unblocked for billing.' 
          : 'Weight mismatch rejected. Dispatcher notified.',
        decision === 'approved' ? 'success' : 'info'
      );
      
      onSuccess();
      onClose();
    } catch (err: any) {
      toast(err?.message || 'Failed to submit decision', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Weight Mismatch Approval Request" size="lg">
      <div className="space-y-6">
        
        {/* Header Alert Banner */}
        <div className="flex items-start gap-3.5 p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-900 dark:text-amber-200">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-md">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 className="font-bold text-base text-amber-900 dark:text-amber-100">
              Weight Discrepancy Requires Admin Authorization
            </h3>
            <p className="text-xs mt-0.5 text-amber-800 dark:text-amber-300">
              Dispatcher recorded actual weight that differs from standard item tolerance. Listen to the dispatcher's voice explanation below to approve or reject.
            </p>
          </div>
        </div>

        {/* Dispatch & Customer Details */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block font-medium">Dispatch No</span>
            <strong className="text-sm font-bold text-slate-800 dark:text-white font-mono">{dispatch.dispatch_no}</strong>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block font-medium">Customer</span>
            <strong className="text-sm font-bold text-slate-800 dark:text-white truncate block">{dispatch.customer?.name || '—'}</strong>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block font-medium">Driver</span>
            <strong className="text-sm font-bold text-slate-800 dark:text-white truncate block">{dispatch.driver_name || 'Fleet'}</strong>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block font-medium">Vehicle No</span>
            <strong className="text-sm font-bold text-slate-800 dark:text-white font-mono">{dispatch.vehicle_number || '—'}</strong>
          </div>
        </div>

        {/* Voice Note Audio Player */}
        <div className="p-5 rounded-xl border-2 border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/80 to-blue-50/50 dark:from-slate-800 dark:to-indigo-950/40 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
              <Mic size={16} className="text-indigo-600 animate-pulse" /> Dispatcher's Voice Note
            </span>
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <Clock size={12} /> {dispatch.mismatch_requested_at ? new Date(dispatch.mismatch_requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
            </span>
          </div>

          {audioUrl ? (
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-indigo-100 dark:border-slate-800 flex items-center gap-4 shadow-inner">
              <audio 
                ref={audioRef} 
                src={audioUrl} 
                onTimeUpdate={handleTimeUpdate} 
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                preload="metadata"
              />
              <button
                type="button"
                onClick={togglePlay}
                className="h-12 w-12 shrink-0 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
              </button>

              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pos = (e.clientX - rect.left) / rect.width;
                    if (audioRef.current && duration > 0) {
                      audioRef.current.currentTime = pos * duration;
                    }
                  }}
                >
                  <div 
                    className="bg-indigo-600 h-full rounded-full transition-all"
                    style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <Volume2 size={20} className="text-slate-400 shrink-0 hidden sm:block" />
            </div>
          ) : (
            <div className="text-center py-3 text-xs font-bold text-slate-500 italic">
              No audio recording attached (or audio file was purged after previous decision).
            </div>
          )}

          {dispatch.mismatch_reason && (
            <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 border border-indigo-100 dark:border-slate-800">
              <strong className="text-indigo-900 dark:text-indigo-300">Written Note: </strong>
              {dispatch.mismatch_reason}
            </div>
          )}
          
          <p className="text-[11px] text-indigo-700 dark:text-indigo-400 font-medium italic">
            🔒 Note: Voice note is temporary and will be automatically purged from server storage upon your decision to keep disk storage free.
          </p>
        </div>

        {/* Rejection Note Form (Shown when admin clicks Reject) */}
        {rejecting && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-2 animate-fadeIn">
            <label className="block text-xs font-bold text-rose-900 dark:text-rose-200">
              Rejection Reason (Will be sent to dispatcher):
            </label>
            <input
              type="text"
              placeholder="e.g. Weight difference too high. Please re-weigh the bundles on scale 2."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full rounded-lg border border-rose-300 dark:border-rose-800 p-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleDecision('rejected')}
            disabled={submitting}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            <XCircle size={16} />
            {rejecting ? 'Confirm Rejection' : 'Reject Mismatch'}
          </button>

          <button
            type="button"
            onClick={() => handleDecision('approved')}
            disabled={submitting}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
          >
            <CheckCircle2 size={18} />
            {submitting ? 'Processing...' : 'Approve Weight Mismatch'}
          </button>
        </div>

      </div>
    </Modal>
  );
}
