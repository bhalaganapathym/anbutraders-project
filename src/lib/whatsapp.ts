import { type Dispatch, type Bill, type Customer } from './api';

export const DEFAULT_COMPANY_IMAGE_URL = 'https://raw.githubusercontent.com/bhalaganapathym/anbutraders-project/main/public/pwa-512x512.png';

export const DEFAULT_WHATSAPP_TEMPLATE = `🏗️ *ANBU TRADERS - Order Dispatched* 🚚
----------------------------------------
Dear *{customer_name}*,
Your materials (*{dispatch_no}*) are out for delivery!

🚛 *Vehicle:* {vehicle_number}
👤 *Driver:* {driver_name} ({driver_phone})
📦 *Items:* {items_summary}

💰 *Total Bill:* ₹{total_amount}
✅ *Advance Paid:* ₹{paid_amount}
🔴 *Balance to Pay on Delivery:* ₹{balance_to_collect}

📍 *Delivery Location:* {delivery_address}
----------------------------------------
🖼️ *Company Logo & Order Verification:*
{image_url}

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
  image_url?: string;
  company_name?: string;
  company_phone?: string;
}

export function formatWhatsAppMessage(
  template: string,
  data: WhatsAppTemplateData
): string {
  let msg = template || DEFAULT_WHATSAPP_TEMPLATE;

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
    '{image_url}': data.image_url || DEFAULT_COMPANY_IMAGE_URL,
    '{company_name}': data.company_name || 'ANBU TRADERS',
    '{company_phone}': data.company_phone || '0413-2964204 / 9626325204',
  };

  for (const [tag, val] of Object.entries(map)) {
    msg = msg.split(tag).join(val);
  }

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
    image_url: companyImageUrl || DEFAULT_COMPANY_IMAGE_URL,
    company_name: 'ANBU TRADERS',
    company_phone: '0413-2964204 / 9626325204',
  };

  return formatWhatsAppMessage(template || DEFAULT_WHATSAPP_TEMPLATE, data);
}

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
