import { useState } from 'react';
import Modal from '@/components/Modal';
import { api, type Dispatch, type DispatchItem } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { CheckCircle2, XCircle, Tag } from 'lucide-react';
import { round2 } from '@/lib/pricing';

interface DiscountApprovalModalProps {
  open: boolean;
  onClose: () => void;
  dispatch: Dispatch | null;
  onDecisionSubmitted?: () => void;
}

export default function DiscountApprovalModal({
  open,
  onClose,
  dispatch,
  onDecisionSubmitted
}: DiscountApprovalModalProps) {
  const toast = useToast();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  if (!dispatch) return null;

  const discountDetails: any[] = Array.isArray(dispatch.discount_details) ? dispatch.discount_details : [];
  const totalDiscount = round2(dispatch.discount_amount || 0);

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    if (decision === 'rejected' && !showRejectInput) {
      setShowRejectInput(true);
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/dispatches/${dispatch.id}/discount-decision`, {
        decision,
        approved_by: user?.username || 'Admin',
        rejection_reason: decision === 'rejected' ? (rejectionReason || 'Discount rejected by admin.') : null
      });

      toast(
        decision === 'approved'
          ? `Discount of ₹${totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} approved!`
          : 'Discount request rejected.',
        decision === 'approved' ? 'success' : 'info'
      );

      onClose();
      if (onDecisionSubmitted) onDecisionSubmitted();
    } catch (err: any) {
      toast(err.message || 'Failed to submit discount decision', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const originalTotal = round2(
    (dispatch.items || []).reduce((acc, item) => {
      const itOrig = item.original_price ?? item.price ?? 0;
      return acc + itOrig * (item.quantity || 1);
    }, 0)
  );

  const discountedTotal = round2(Math.max(0, originalTotal - totalDiscount));

  return (
    <Modal open={open} onClose={onClose} title="🎁 Review Discount Approval Request">
      <div className="space-y-4">
        {/* Header summary banner */}
        <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300 dark:border-amber-700/60 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold text-amber-900 dark:text-amber-300 text-sm">
              {dispatch.dispatch_no}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
              Pending Admin Review
            </span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300">
            <strong>Customer:</strong> {dispatch.customer?.name || 'Customer'}
            {dispatch.discount_requested_by && ` · Requested by: ${dispatch.discount_requested_by}`}
          </p>
          {dispatch.discount_reason && (
            <p className="text-xs text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-slate-800/70 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Remarks:</span> {dispatch.discount_reason}
            </p>
          )}
        </div>

        {/* Item-level discount breakdown table */}
        <div className="space-y-2">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Tag size={13} /> Item Discount Breakdown
          </h4>
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="py-2 px-3 text-left font-bold">Product</th>
                  <th className="py-2 px-2 text-right font-bold">Qty / Wt</th>
                  <th className="py-2 px-2 text-right font-bold">Discount</th>
                  <th className="py-2 px-3 text-right font-bold">Revised Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(dispatch.items || []).map((item: DispatchItem) => {
                  const dItem = discountDetails.find((d: any) => String(d.item_id) === String(item.id));
                  const discType = dItem?.discount_type || (item.discount_per_kg ? 'per_kg' : 'none');
                  const discVal = dItem?.discount_value || item.discount_per_kg || item.discount_per_unit || 0;
                  const itemSaving = dItem?.discount_amount || item.discount_amount || 0;
                  const finalLine = round2((item.price || 0) * (item.quantity || 1));

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        {item.product_name}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-500 dark:text-slate-400">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2 px-2 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                        {discVal > 0 ? (
                          <span>
                            {discType === 'per_kg' ? `-₹${discVal.toFixed(2)}/kg` : `-₹${discVal.toFixed(2)}`}
                            <br />
                            <span className="text-[10px] font-normal text-emerald-700 dark:text-emerald-500">
                              (-₹{itemSaving.toFixed(2)})
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        ₹{finalLine.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Comparison Box */}
        <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Original Bill</span>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono">
              ₹{originalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-emerald-600 uppercase">Total Discount</span>
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
              -₹{totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-indigo-600 uppercase">Revised Bill</span>
            <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono">
              ₹{discountedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Reject reason input */}
        {showRejectInput && (
          <div className="space-y-1.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
            <label className="text-xs font-bold text-rose-700 dark:text-rose-400">
              Reason for Rejection:
            </label>
            <input
              type="text"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Below minimum profit margin..."
              className="input w-full text-xs"
              autoFocus
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs px-4 py-2"
            disabled={submitting}
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={() => handleDecision('rejected')}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1.5 transition"
            disabled={submitting}
          >
            <XCircle size={14} /> {showRejectInput ? 'Confirm Reject' : 'Reject'}
          </button>

          <button
            type="button"
            onClick={() => handleDecision('approved')}
            className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-md shadow-emerald-600/20 bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={submitting}
          >
            <CheckCircle2 size={14} /> {submitting ? 'Approving...' : 'Approve Discount'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
