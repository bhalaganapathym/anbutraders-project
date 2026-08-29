import { type Dispatch, type Bill, type Customer } from './api';

export const DEFAULT_COMPANY_IMAGE_URL = 'https://raw.githubusercontent.com/bhalaganapathym/anbutraders-project/main/public/pwa-512x512.png';

export const DEFAULT_WHATSAPP_TEMPLATE = `🏗️ *ANBU TRADERS - Order Dispatched* 🚚
────────────────────────────────────────
Dear *{customer_name}*,
Your materials (*{dispatch_no}*) are out for delivery!

🚛 *Vehicle:* {vehicle_number}
👤 *Driver:* {driver_name} ({driver_phone})
📦 *Items:* {items_summary}

💰 *Total Bill:* ₹{total_amount}
✅ *Advance Paid:* ₹{paid_amount}
🔴 *Balance to Pay on Delivery:* ₹{balance_to_collect}

📍 *Delivery Location:* {delivery_address}
────────────────────────────────────────
🔗 *Live Tracking & Digital Receipt:*
{tracking_url}

📞 *Contact Office:* 0413-2964204 / 9626325204
_Thank you for choosing Anbu Traders!_`;

export interface WhatsAppTemplateData {
  customer_name?: string;
  dispatch_no?: string;
  vehicle_number?: string;
  driver_name?: string;
  driver_phone?: string;
  items_summary?: string;
  total_amount?: string | number;
  paid_amount?: string | number;
  balance_to_collect?: string | number;
  delivery_address?: string;
  tracking_url?: string;
  image_url?: string;
  company_name?: string;
  company_phone?: string;
}

export function formatWhatsAppMessage(
  template: string,
  data: WhatsAppTemplateData
): string {
  let msg = template || DEFAULT_WHATSAPP_TEMPLATE;

  const defaultTrackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/#/track/${data.dispatch_no || 'DSP-0001'}`
    : `https://anbutraders.com/#/track/${data.dispatch_no || 'DSP-0001'}`;

  const map: Record<string, string> = {
    '{customer_name}': data.customer_name || 'Valued Customer',
    '{dispatch_no}': data.dispatch_no || '—',
    '{vehicle_number}': data.vehicle_number || 'Assigned Vehicle',
    '{driver_name}': data.driver_name || 'Delivery Driver',
    '{driver_phone}': data.driver_phone || '—',
    '{items_summary}': data.items_summary || 'Steel & Building Materials',
    '{total_amount}': typeof data.total_amount === 'number' ? data.total_amount.toFixed(2) : (data.total_amount || '0.00'),
    '{paid_amount}': typeof data.paid_amount === 'number' ? data.paid_amount.toFixed(2) : (data.paid_amount || '0.00'),
    '{balance_to_collect}': typeof data.balance_to_collect === 'number' ? data.balance_to_collect.toFixed(2) : (data.balance_to_collect || '0.00'),
    '{delivery_address}': data.delivery_address || 'As per order',
    '{tracking_url}': data.tracking_url || defaultTrackUrl,
    '{image_url}': '',
    '{company_name}': data.company_name || 'ANBU TRADERS',
    '{company_phone}': data.company_phone || '0413-2964204 / 9626325204',
  };

  for (const [tag, val] of Object.entries(map)) {
    msg = msg.split(tag).join(val);
  }

  msg = msg.replace(/🖼️\s*\*Company Logo & Order Verification:\*\s*\n?/g, '').trim();

  return msg;
}

export function buildDispatchWhatsAppMessage(
  dispatch: Dispatch,
  template?: string,
  customer?: Customer | null,
  bill?: Bill | null,
  companyImageUrl?: string
): string {
  const custName = customer?.name || dispatch.customer?.name || 'Customer';
  const itemsStr = dispatch.items?.map(it => `${it.quantity} ${it.unit || 'nos'} ${it.product_name}`).join(', ') || 'Building Materials';
  
  const total = bill?.total_amount ?? (dispatch.items?.reduce((s, it) => s + (it.price || 0) * (it.quantity || 1), 0) || 0);
  const paid = bill?.paid_amount ?? 0;
  const balance = bill?.pending_amount ?? (total - paid);

  const trackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/#/track/${dispatch.dispatch_no || dispatch.id}`
    : `https://anbutraders.com/#/track/${dispatch.dispatch_no || dispatch.id}`;

  const data: WhatsAppTemplateData = {
    customer_name: custName,
    dispatch_no: dispatch.dispatch_no,
    vehicle_number: dispatch.vehicle_number || '—',
    driver_name: dispatch.driver_name || 'Driver',
    driver_phone: dispatch.driver_mobile || '—',
    items_summary: itemsStr,
    total_amount: total,
    paid_amount: paid,
    balance_to_collect: balance,
    delivery_address: dispatch.delivery_address || dispatch.customer?.address || 'Site Delivery',
    tracking_url: trackUrl,
    image_url: companyImageUrl || DEFAULT_COMPANY_IMAGE_URL,
    company_name: 'ANBU TRADERS',
    company_phone: '0413-2964204 / 9626325204',
  };

  return formatWhatsAppMessage(template || DEFAULT_WHATSAPP_TEMPLATE, data);
}

export function buildDriverTamilWhatsAppMessage(
  dispatch: Dispatch,
  driverName?: string,
  customerName?: string,
  customerPhone?: string,
  deliveryAddress?: string,
  pendingAmount?: number
): string {
  const drvName = driverName || dispatch.driver_name || 'ஓட்டுநர்';
  const custName = customerName || dispatch.customer?.name || 'வாடிக்கையாளர்';
  const custPhone = customerPhone || dispatch.customer?.phone || '—';
  const addr = deliveryAddress || dispatch.delivery_address || dispatch.customer?.address || 'முகவரி குறிப்பிடப்படவில்லை';
  const pending = pendingAmount ?? (dispatch.bill?.pending_amount || 0);
  const vehicle = dispatch.vehicle_number || '—';
  const orderRef = dispatch.order?.order_no || dispatch.dispatch_no || '';

  return `🚛 *அன்பு குரூப்ஸ் — டெலிவரி விவரம்*
─────────────────────────────
வணக்கம் ${drvName},

உங்களுக்கு புதிய டெலிவரி பணி ஒதுக்கப்பட்டுள்ளது:
📋 *ஆர்டர் எண்:* ${orderRef}
👤 *வாடிக்கையாளர்:* ${custName}
📞 *தொலைபேசி:* ${custPhone}
📍 *டெலிவரி முகவரி:* ${addr}
💰 *வாடிக்கையாளரிடம் பெற வேண்டிய தொகை:* ₹${Number(pending).toLocaleString('en-IN')}
🚛 *வாகன எண்:* ${vehicle}
─────────────────────────────
அன்பு குரூப்ஸ்`;
}

/**
 * Directly opens WhatsApp chat for target phone with pre-filled message text.
 */
export function openWhatsApp(phone: string, text: string): void {
  let cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }
  
  const encodedText = encodeURIComponent(text);
  const url = cleanPhone 
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;
    
  window.open(url, '_blank');
}

/**
 * Automatically launches WhatsApp to the target customer phone with full message text,
 * and if an image blob/canvas is provided, automatically copies the image to clipboard
 * so the user can paste (Ctrl+V) the photo in chat.
 */
export async function sendWhatsAppMessageWithAttachment(options: {
  phone: string;
  text: string;
  imageBlob?: Blob;
}): Promise<void> {
  // 1. Copy image to clipboard if available
  if (options.imageBlob && typeof navigator !== 'undefined' && navigator.clipboard && (window as any).ClipboardItem) {
    try {
      const pngBlob = options.imageBlob.type === 'image/png' ? options.imageBlob : new Blob([options.imageBlob], { type: 'image/png' });
      await navigator.clipboard.write([
        new (window as any).ClipboardItem({ 'image/png': pngBlob })
      ]);
    } catch (e) {
      console.warn('Could not copy image to clipboard', e);
    }
  }

  // 2. Open WhatsApp chat with pre-filled text
  openWhatsApp(options.phone, options.text);
}

/**
 * Directly opens default SMS / Messaging app for target phone with pre-filled message text.
 */
export function openSMSMessage(phone: string, text: string): void {
  let cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '+91' + cleanPhone;
  }
  
  const encodedText = encodeURIComponent(text);
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const url = `sms:${cleanPhone}${isIOS ? '&' : '?'}body=${encodedText}`;
  
  window.location.href = url;
}

/**
 * Native mobile / desktop sharing sheet (SMS, WhatsApp, Messages, Email, etc.)
 */
export async function shareViaNative(title: string, text: string, url?: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title,
        text,
        url: url || window.location.href,
      });
      return true;
    } catch (err) {
      if ((err as any)?.name !== 'AbortError') {
        console.warn('Native share failed:', err);
      }
    }
  }
  return false;
}

/**
 * Builds clean plain-text estimate breakdown for SMS / WhatsApp / Share
 */
export function buildEstimateTextMessage(order: any, customer?: any): string {
  const custName = customer?.name || order.customer?.name || 'Customer';
  const orderRef = order.order_no || (order.id ? order.id.substring(0, 8).toUpperCase() : 'EST-NEW');
  const dateStr = order.created_at
    ? new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  let totalAmount = 0;
  let totalWeight = 0;
  
  const itemsText = (order.items || []).map((it: any, idx: number) => {
    const name = it.product?.name || it.product_name || 'Item';
    const qty = it.quantity || 1;
    const unit = it.unit || it.product?.unit || 'nos';
    const price = Number(it.price || 0);
    const weight = Number(it.weight || it.product?.standard_weight || 0);
    
    const lineTotal = price * qty;
    totalAmount += lineTotal;
    if (weight > 0) {
      totalWeight += weight * qty;
      return `${idx + 1}. ${name}\n   ${qty} ${unit} × ${weight}kg = ${(weight * qty).toFixed(2)}kg @ ₹${price.toFixed(2)} = ₹${lineTotal.toFixed(2)}`;
    }
    return `${idx + 1}. ${name}\n   ${qty} ${unit} @ ₹${price.toFixed(2)} = ₹${lineTotal.toFixed(2)}`;
  }).join('\n\n');

  let advanceBlock = '';
  if (order.is_advance_order) {
    const advPaid = Number(order.advance_paid_amount || 0);
    const balDue = Math.max(0, (Number(order.total_amount) || totalAmount) - advPaid);
    const schedDate = order.scheduled_delivery_date
      ? new Date(order.scheduled_delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';
    advanceBlock = `─────────────────────────────\n📦 ADVANCE BOOKING:\n📅 Delivery Date: ${schedDate}\n💵 Paid: ₹${advPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n🔴 Balance Due: ₹${balDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
  }

  return `🏗️ ANBU TRADERS — ESTIMATE 🧾
No.4/5 Pondy Mailam Road, T.C.Kootroad, Vanur
Ph: 0413-2964204, 9626325204
─────────────────────────────
Estimate: ${orderRef}
Date: ${dateStr}
Customer: ${custName}
Phone: ${customer?.phone || order.customer?.phone || '—'}
Site: ${order.delivery_address || customer?.address || '—'}
─────────────────────────────
ITEMS:

${itemsText}

─────────────────────────────
${totalWeight > 0 ? `Total Weight: ${totalWeight.toFixed(2)} kg\n` : ''}Total Amount: ₹${(Number(order.total_amount) || totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
${advanceBlock}─────────────────────────────
Thank you for choosing Anbu Traders!`;
}

