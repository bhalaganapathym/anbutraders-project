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
  delete: (endpoint: string) => fetchApi(endpoint, { method: 'DELETE' }),
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
  pending_amount?: number;
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
  created_at: string;
};

export type Order = {
  id: string;
  order_no: string;
  customer_id: string;
  status: 'pending' | 'confirmed';
  delivery_address: string | null;
  notes: string | null;
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
  pending_amount: number;
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
