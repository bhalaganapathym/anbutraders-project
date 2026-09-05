import React, { forwardRef } from 'react';
import { calculateProductPrice, round2 } from '@/lib/pricing';
import type { Product, Customer } from '@/lib/api';

export function numberToWords(num: number): string {
  if (!num || num === 0) return 'INR Zero Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '');
  };
  const intPart = Math.floor(num);
  return `INR ${inWords(intPart)} Only`;
}

export interface EstimateItemData {
  id?: string;
  product_id?: string;
  product?: Product | null;
  quantity: number;
  unit?: string | null;
  price?: number | null;
}

export interface EstimateOrderData {
  id?: string;
  order_no?: string | null;
  created_at?: string | null;
  customer?: Customer | { name: string; phone?: string | null; address?: string | null } | null;
  delivery_address?: string | null;
  notes?: string | null;
  unloading_charge?: number | null;
  transport_charge?: number | null;
  transport_charge_type?: string | null;
  is_advance_order?: boolean | null;
  advance_paid_amount?: number | null;
  advance_payment_method?: string | null;
  scheduled_delivery_date?: string | null;
  advance_notes?: string | null;
}

interface EstimateBillImageProps {
  order: EstimateOrderData | null;
  items: EstimateItemData[];
  products?: Product[];
}

export const EstimateBillImage = forwardRef<HTMLDivElement, EstimateBillImageProps>(
  ({ order, items, products = [] }, ref) => {
    if (!order) return null;

    let itemsSubtotal = 0;
    let totalWeight = 0;

    const computedItems = items.map((it, idx) => {
      const prod = it.product || products.find(p => p.id === it.product_id);
      const pricing = calculateProductPrice(prod, it.quantity || 1);
      itemsSubtotal += pricing.totalPrice;
      totalWeight += pricing.totalWeight;
      return {
        si: idx + 1,
        name: prod?.name || 'Item',
        brand: prod?.brand || '',
        size: prod?.size || '',
        qty: it.quantity,
        unit: it.unit || prod?.unit || 'nos',
        isSteel: pricing.isSteel,
        weightKg: pricing.isSteel && pricing.totalWeight > 0 ? pricing.totalWeight : 0,
        rateText: pricing.isSteel ? `₹${pricing.ratePerKg.toFixed(2)}/kg` : `₹${pricing.unitPrice.toFixed(2)}`,
        amount: pricing.totalPrice
      };
    });

    itemsSubtotal = round2(itemsSubtotal);
    totalWeight = round2(totalWeight);
    const unloadingNum = round2(Number(order.unloading_charge || 0));
    const transportNum = round2(Number(order.transport_charge || 0));
    const grandTotal = round2(itemsSubtotal + unloadingNum + transportNum);

    const estNo = order.order_no || (order.id ? order.id.substring(0, 8).toUpperCase() : 'EST');
    const dateStr = order.created_at
      ? new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const advPaid = round2(Number(order.advance_paid_amount || 0));
    const balDue = round2(Math.max(0, grandTotal - advPaid));

    return (
      <div
        ref={ref}
        className="w-[794px] bg-white text-slate-900 p-8 text-xs font-sans border-2 border-slate-800 space-y-4 shadow-none select-none"
        style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
      >
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3">
          <div className="flex items-center gap-3.5">
            <img
              src="/pwa-192x192.png"
              alt="Anbu Traders"
              className="h-16 w-16 object-contain rounded-lg border border-slate-300 p-0.5"
              crossOrigin="anonymous"
            />
            <div>
              <h1 className="text-2xl font-black tracking-wide text-slate-900 uppercase">ANBU TRADERS</h1>
              <p className="text-[11px] font-semibold text-slate-700">No.4/5 Pondy Mailam Road, T.C.Kootroad, Vanur T.K 605 111</p>
              <p className="text-[11px] font-semibold text-slate-700">Phone: 0413-2964204, 9626325204 | State: Tamil Nadu (Code: 33)</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-base font-black border-2 border-slate-900 px-3 py-0.5 inline-block uppercase tracking-wider bg-slate-100">
              ESTIMATE BILL
            </h2>
            <p className="text-[10px] italic mt-1 text-slate-500">(CUSTOMER ESTIMATE COPY)</p>
            <p className="text-[11px] mt-1.5 font-bold">
              <span className="text-slate-600">Estimate No:</span> <strong className="text-slate-900">{estNo}</strong>
            </p>
            <p className="text-[11px] font-bold">
              <span className="text-slate-600">Date:</span> <strong className="text-slate-900">{dateStr}</strong>
            </p>
          </div>
        </div>

        {/* Customer & Delivery Site Info */}
        <div className="grid grid-cols-2 gap-4 border-b-2 border-slate-800 pb-3 text-[11px]">
          <div className="pr-3 border-r border-slate-300 space-y-1">
            <p className="font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200 pb-0.5">
              Buyer (Bill To)
            </p>
            <p className="font-extrabold text-sm text-slate-900">{order.customer?.name || 'Customer'}</p>
            <p className="font-medium text-slate-700">{order.customer?.address || '—'}</p>
            <p className="font-semibold text-slate-800">Phone: {order.customer?.phone || '—'}</p>
          </div>
          <div className="pl-1 space-y-1">
            <p className="font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200 pb-0.5">
              Delivery & Site Info
            </p>
            <p className="font-semibold text-slate-800">
              <span className="text-slate-500">Site Address:</span> {order.delivery_address || order.customer?.address || 'Site Delivery'}
            </p>
            {order.notes && (
              <p className="text-slate-600 italic">
                <span className="font-semibold not-italic">Note:</span> {order.notes}
              </p>
            )}
            {order.is_advance_order && (
              <div className="mt-1 bg-indigo-50 border border-indigo-200 rounded p-1.5 text-[10.5px] text-indigo-900 font-bold">
                📅 Advance Booking — Scheduled Delivery: {order.scheduled_delivery_date ? new Date(order.scheduled_delivery_date).toLocaleDateString('en-IN') : '—'}
              </div>
            )}
          </div>
        </div>

        {/* Items Table (Strictly NO Bundles, Simple & Clean) */}
        <table className="w-full border-collapse border-2 border-slate-800 text-[11px]">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-800 font-black text-slate-900">
              <th className="border border-slate-800 p-1.5 text-center w-10">SI</th>
              <th className="border border-slate-800 p-1.5 text-left">Description of Goods</th>
              <th className="border border-slate-800 p-1.5 text-center w-28">Quantity</th>
              <th className="border border-slate-800 p-1.5 text-center w-24">Weight (kg)</th>
              <th className="border border-slate-800 p-1.5 text-right w-24">Rate (₹)</th>
              <th className="border border-slate-800 p-1.5 text-right w-28">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {computedItems.map((it) => (
              <tr key={it.si} className="border-b border-slate-300">
                <td className="border border-slate-800 p-1.5 text-center font-semibold text-slate-600">{it.si}</td>
                <td className="border border-slate-800 p-1.5 font-bold uppercase text-slate-900">
                  {it.name} {it.brand ? `(${it.brand})` : ''}
                </td>
                <td className="border border-slate-800 p-1.5 text-center font-bold text-slate-800">
                  {it.qty} {it.unit}
                </td>
                <td className="border border-slate-800 p-1.5 text-center font-semibold text-slate-700">
                  {it.weightKg > 0 ? `${it.weightKg.toFixed(2)} kg` : '—'}
                </td>
                <td className="border border-slate-800 p-1.5 text-right font-medium text-slate-800">
                  {it.rateText}
                </td>
                <td className="border border-slate-800 p-1.5 text-right font-extrabold text-slate-900">
                  ₹{it.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}

            {/* Subtotal Row */}
            <tr className="font-bold border-t-2 border-slate-800 bg-slate-50">
              <td colSpan={3} className="border border-slate-800 p-1.5 text-right uppercase text-[11px] text-slate-700">
                Items Subtotal:
              </td>
              <td className="border border-slate-800 p-1.5 text-center font-bold text-slate-800">
                {totalWeight > 0 ? `${totalWeight.toFixed(2)} kg` : '—'}
              </td>
              <td className="border border-slate-800 p-1.5 text-right text-slate-700">
                Subtotal:
              </td>
              <td className="border border-slate-800 p-1.5 text-right font-black text-slate-900">
                ₹{itemsSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
            </tr>

            {/* Additional Charges if applicable */}
            {unloadingNum > 0 && (
              <tr className="border-b border-slate-300">
                <td colSpan={4} className="border border-slate-800 p-1 text-right text-slate-600 font-medium">
                  Unloading Charges:
                </td>
                <td className="border border-slate-800 p-1 text-right text-slate-600">—</td>
                <td className="border border-slate-800 p-1 text-right font-bold text-slate-800">
                  ₹{unloadingNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            )}

            {transportNum > 0 && (
              <tr className="border-b border-slate-300">
                <td colSpan={4} className="border border-slate-800 p-1 text-right text-slate-600 font-medium">
                  Transport Charges:
                </td>
                <td className="border border-slate-800 p-1 text-right text-slate-600">—</td>
                <td className="border border-slate-800 p-1 text-right font-bold text-slate-800">
                  ₹{transportNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            )}

            {/* Grand Total Row */}
            <tr className="font-black border-t-2 border-slate-900 bg-slate-100">
              <td colSpan={4} className="border border-slate-800 p-2 text-right uppercase text-xs tracking-wider">
                Grand Total:
              </td>
              <td colSpan={2} className="border border-slate-800 p-2 text-right text-base font-black text-slate-900">
                ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Amount in Words & Advance Booking Summary */}
        <div className="space-y-2 pt-1 text-[11px]">
          <p className="font-semibold text-slate-800">
            <strong>Amount Chargeable (in words):</strong> {numberToWords(grandTotal)}
          </p>

          {order.is_advance_order && (
            <div className="grid grid-cols-3 gap-2 border-2 border-slate-800 p-2.5 my-2 bg-slate-50 text-[11px] rounded">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Estimated Total</p>
                <p className="font-black text-sm text-slate-900">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Advance Received ({order.advance_payment_method?.toUpperCase() || 'PAID'})</p>
                <p className="font-black text-sm text-emerald-700">₹{advPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Balance on Delivery</p>
                <p className="font-black text-sm text-rose-700">₹{balDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          )}

          {/* Declaration & Signatory */}
          <div className="flex justify-between items-end pt-4 border-t border-slate-800 text-[10px]">
            <div>
              <p className="italic text-slate-600">Declaration: We declare that this estimate shows the actual estimated price of</p>
              <p className="italic text-slate-600">the goods described and that all particulars are true and correct.</p>
            </div>
            <div className="text-center font-bold">
              <p className="uppercase text-slate-900">for ANBU TRADERS</p>
              <div className="h-10"></div>
              <p className="border-t border-slate-800 pt-1">Authorised Signatory</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
