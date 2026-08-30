import { useState, useRef, useEffect } from 'react';
import { api, type Dispatch } from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  AlertTriangle, CheckCircle2, XCircle, Mic, Play, Pause, Volume2, VolumeX, Truck, User, Scale, ArrowRight, Clock, RefreshCw
} from 'lucide-react';
import Modal from '@/components/Modal';

export default function WeightMismatchApprovalModal({
  open,
  isOpen,
  onClose,
  dispatch,
  onSuccess
}: {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  dispatch: Dispatch | null;
  onSuccess: () => void;
}) {
  const isModalOpen = open ?? isOpen ?? false;
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Reset player state when dispatch changes
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setAudioError(false);
  }, [dispatch?.id]);

  if (!isModalOpen || !dispatch) return null;

  // Resolve audio streaming endpoint
  const apiBase = import.meta.env.VITE_API_URL || '/api/v1';
  const audioUrl = `${apiBase.replace(/\/$/, '')}/dispatches/${dispatch.id}/voice-note`;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setAudioError(false);
      }).catch((e) => {
        console.error('Audio play error:', e);
        setAudioError(true);
        setIsPlaying(false);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
      setAudioError(false);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
      audioRef.current.muted = newVol === 0;
      setIsMuted(newVol === 0);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs)) return '00:00';
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
    <Modal open={isModalOpen} onClose={onClose} title="Weight Mismatch Approval Request" size="lg">
      <div className="space-y-5">
        
        {/* Header Alert Banner */}
        <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 shadow-sm">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md">
            <AlertTriangle size={22} className="animate-pulse" />
          </div>
          <div className="flex-1">
            <h3 className="font-extrabold text-sm sm:text-base text-amber-900 dark:text-amber-100">
              Weight Discrepancy Awaiting Admin Review
            </h3>
            <p className="text-xs text-amber-800/90 dark:text-amber-300">
              Dispatcher noted variance exceeding standard item tolerances. Review the comparison below and listen to the voice note.
            </p>
          </div>
        </div>

        {/* 4 Metadata Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Dispatch No</span>
            <span className="text-sm font-black font-mono text-slate-800 dark:text-slate-100">{dispatch.dispatch_no}</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Customer</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate block" title={dispatch.customer?.name || '—'}>
              {dispatch.customer?.name || '—'}
            </span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Driver</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate block">
              {dispatch.driver_name || 'Fleet'}
            </span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Vehicle No</span>
            <span className="text-sm font-black font-mono text-slate-800 dark:text-slate-100">
              {dispatch.vehicle_number || '—'}
            </span>
          </div>
        </div>

        {/* Item Weights Breakdown Table */}
        {dispatch.items && dispatch.items.length > 0 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="bg-slate-100/90 dark:bg-slate-800 px-4 py-2.5 font-extrabold text-xs text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
              <span className="flex items-center gap-1.5">
                <Scale size={14} className="text-indigo-600" /> Item Weights Comparison
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                {dispatch.items.length} items
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/60 max-h-48 overflow-y-auto">
              {dispatch.items.map((it) => {
                const itemDraft = dispatch.phase1_draft?.item_verification?.[it.id];
                const enteredWeight = itemDraft?.weight ? `${itemDraft.weight} ${itemDraft.weightUnit || 'kg'}` : null;

                return (
                  <div key={it.id} className="p-3 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                    <div className="min-w-[180px] flex-1">
                      <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {it.product_name}
                      </p>
                      <span className="text-xs text-slate-500">
                        Qty: <strong className="text-slate-700 dark:text-slate-300">{it.quantity} {it.unit || 'nos'}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {enteredWeight ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 px-2.5 py-1 rounded-lg shadow-sm">
                            Entered: {enteredWeight}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg">
                          Standard Verified
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dispatcher's Voice Note Player */}
        <div className="p-4 sm:p-5 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/90 to-blue-50/60 dark:from-slate-800/90 dark:to-indigo-950/40 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
              <Mic size={16} className="text-indigo-600 animate-pulse" /> Dispatcher's Voice Explanation
            </span>
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <Clock size={12} /> {dispatch.mismatch_requested_at ? new Date(dispatch.mismatch_requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-indigo-100 dark:border-slate-800 shadow-sm flex flex-col gap-3">
            <audio 
              ref={audioRef} 
              src={audioUrl} 
              onTimeUpdate={handleTimeUpdate} 
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              onError={() => setAudioError(true)}
              preload="auto"
            />

            <div className="flex items-center gap-3">
              {/* Big Play / Pause Button */}
              <button
                type="button"
                onClick={togglePlay}
                className="h-12 w-12 shrink-0 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 transition-transform active:scale-95"
                title={isPlaying ? 'Pause' : 'Play Voice Note'}
              >
                {isPlaying ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
              </button>

              {/* Progress & Waveform */}
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-extrabold text-slate-600 dark:text-slate-300">
                  <span className="tabular-nums">{formatTime(currentTime)}</span>
                  {/* Dynamic Sound Wave Bars */}
                  <div className="flex items-center gap-0.5 px-2">
                    {[40, 75, 55, 90, 60, 85, 45, 95, 70, 50].map((h, i) => (
                      <span
                        key={i}
                        className={`w-1 rounded-full transition-all duration-150 ${
                          isPlaying 
                            ? 'bg-indigo-600 dark:bg-indigo-400' 
                            : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                        style={{
                          height: isPlaying ? `${Math.max(6, (h * Math.random()).toFixed(0))}px` : '6px'
                        }}
                      />
                    ))}
                  </div>
                  <span className="tabular-nums">{formatTime(duration)}</span>
                </div>

                {/* Seeker Bar */}
                <div 
                  className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden cursor-pointer relative"
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

              {/* Volume Slider & Mute Toggle */}
              <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer accent-indigo-600"
                />
              </div>
            </div>

            {audioError && (
              <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200 dark:border-amber-800">
                <span>Audio stream loading... If playback doesn't start, click retry.</span>
                <button
                  type="button"
                  onClick={togglePlay}
                  className="font-bold underline flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            )}
          </div>

          {dispatch.mismatch_reason && (
            <div className="bg-white/95 dark:bg-slate-900/95 p-3 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 border border-indigo-100 dark:border-slate-800 shadow-sm">
              <strong className="text-indigo-900 dark:text-indigo-300">Written Note from Dispatcher: </strong>
              "{dispatch.mismatch_reason}"
            </div>
          )}
          
          <p className="text-[11px] text-indigo-700 dark:text-indigo-400 font-semibold italic">
            🔒 Voice note is automatically purged from disk storage once approved or rejected to conserve storage.
          </p>
        </div>

        {/* Rejection Note Input */}
        {rejecting && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-300 dark:border-rose-900/60 space-y-2 animate-fade-in">
            <label className="block text-xs font-black text-rose-900 dark:text-rose-200 uppercase tracking-wider">
              Rejection Reason (Will be sent to Dispatcher):
            </label>
            <input
              type="text"
              placeholder="e.g. Weight difference too high. Please re-weigh bundles on scale 2."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full rounded-xl border border-rose-300 dark:border-rose-800 p-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
              autoFocus
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
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
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition flex items-center justify-center gap-2 shadow-md hover:shadow-rose-600/20 disabled:opacity-50"
          >
            <XCircle size={17} />
            {rejecting ? 'Confirm Rejection' : 'Reject Mismatch'}
          </button>

          <button
            type="button"
            onClick={() => handleDecision('approved')}
            disabled={submitting}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/40 disabled:opacity-50 active:scale-95"
          >
            <CheckCircle2 size={18} />
            {submitting ? 'Processing...' : 'Approve Weight Mismatch'}
          </button>
        </div>

      </div>
    </Modal>
  );
}
