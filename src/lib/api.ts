import { compressImage } from './imageCompressor';

const API_URL = import.meta.env.VITE_API_URL || '/api';

async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'API Error');
  }
  return res.json();
}

export const api = {
  get: (endpoint: string) => fetchApi(endpoint),
  post: (endpoint: string, data: any) => fetchApi(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: (endpoint: string, data: any) => fetchApi(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  patch: (endpoint: string, data: any) => fetchApi(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (endpoint: string) => fetchApi(endpoint, { method: 'DELETE' }),
  postForm: async (endpoint: string, formData: FormData) => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(err.detail || 'Request failed');
    }
    return res.json();
  },
  upload: async (endpoint: string, file: File) => {
    // Compress image automatically before sending over network to save Supabase storage & Render memory
    const optimizedFile = await compressImage(file);
    const formData = new FormData();
    formData.append('file', optimizedFile);
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  }
};

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  delivery_addresses?: string[] | null;
  pending_amount?: number;
  credit_due_date?: string | null;
  credit_days?: number | null;
  credit_days_remaining?: number | null;
  credit_status?: 'overdue' | 'due_today' | 'active' | 'clear' | 'dues_no_date' | string;
  default_unloading_charge?: number | null;
  default_transport_charge?: number | null;
  default_transport_charge_type?: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  stock_qty: number;
  brand: string | null;
  size: string | null;
  standard_weight?: number;
  weight_tolerance?: number | null;
  weight_tolerance_minus?: number | null;
  bundle_conversion_qty?: number | null;
  is_aac_block?: boolean | null;
  piece_weight_kg?: number | null;
  created_at: string;
};

export type Order = {
  id: string;
  order_no: string;
  customer_id: string;
  status: 'pending' | 'confirmed';
  delivery_address: string | null;
  notes: string | null;
  is_advance_order?: boolean;
  scheduled_delivery_date?: string | null;
  advance_paid_amount?: number;
  advance_payment_method?: string | null;
  advance_notes?: string | null;
  advance_status?: 'pending' | 'ready_for_dispatch' | 'dispatched' | string;
  unloading_charge?: number | null;
  transport_charge?: number | null;
  transport_charge_type?: string | null;
  total_weight_kg?: number | null;
  created_at: string;
  confirmed_at?: string | null;
  items?: OrderItem[];
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit?: string | null;
  product?: Product | null;
};

export type Vehicle = {
  id: string;
  vehicle_number: string;
  driver_name: string;
  driver_mobile: string | null;
  created_at: string;
};

export type Driver = {
  id: string;
  name: string;
  phone_number: string;
  vehicle_number: string | null;
  status?: 'free' | 'engaged' | string;
};

export type Bill = {
  id: string;
  dispatch_id: string;
  order_id: string;
  customer_id: string;
  driver_id: string | null;
  payment_method: string;
  total_amount: number;
  discount_amount?: number;
  paid_amount: number;
  pending_amount: number;
  credit_due_date?: string | null;
  credit_days?: number | null;
  is_today_payment_overdue?: boolean;
  notes?: string | null;
  created_at: string;
  driver?: Driver | null;
};

export type DispatchStatus =
  | 'pending'
  | 'sent_to_billing'
  | 'ready_for_loading'
  | 'completed';

export type Dispatch = {
  id: string;
  dispatch_no: string;
  order_id: string;
  customer_id: string;
  delivery_address: string | null;
  status: DispatchStatus;
  vehicle_id: string | null;
  vehicle_number: string | null;
  driver_name: string | null;
  driver_mobile: string | null;
  sent_to_billing_at?: string | null;
  ready_for_loading_at?: string | null;
  loading_at?: string | null;
  completed_at?: string | null;
  vehicle_leave_photo_url?: string | null;
  dispatch_team: string | null;
  phase1_draft?: any;
  mismatch_approval_status?: 'pending' | 'approved' | 'rejected' | null;
  mismatch_voice_note_url?: string | null;
  mismatch_voice_note_path?: string | null;
  mismatch_reason?: string | null;
  mismatch_requested_at?: string | null;
  mismatch_approved_by?: string | null;
  mismatch_approved_at?: string | null;
  mismatch_rejection_reason?: string | null;
  discount_amount?: number;
  discount_reason?: string | null;
  discount_approval_status?: 'none' | 'pending' | 'approved' | 'rejected' | null;
  discount_requested_by?: string | null;
  discount_approved_by?: string | null;
  discount_requested_at?: string | null;
  discount_approved_at?: string | null;
  discount_rejection_reason?: string | null;
  discount_details?: any;
  notes?: string | null;
  pod_voice_note_url?: string | null;
  pod_voice_note_path?: string | null;
  created_at: string;
  
  order?: Order | null;
  customer?: Customer | null;
  items?: DispatchItem[];
  weights?: DispatchWeight[];
  photos?: DispatchPhoto[];
  bill?: Bill | null;
};

export type DispatchItem = {
  id: string;
  dispatch_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  price?: number;
  discount_per_kg?: number;
  discount_per_unit?: number;
  discount_amount?: number;
  original_price?: number | null;
};

export type Weight = {
  id: string;
  dispatch_id: string;
  actual_weight: number;
  weighed_at: string;
  notes: string | null;
};

export type Photo = {
  id: string;
  dispatch_id: string;
  url: string;
  caption: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  dispatch_id: string | null;
  order_id: string | null;
  customer_name: string | null;
  image_url?: string | null;
  read: boolean;
  created_at: string;
};
