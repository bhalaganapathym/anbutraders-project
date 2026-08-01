const API_URL = '/api';

async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
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
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
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
  created_at: string;
};

export type Order = {
  id: string;
  customer_id: string;
  status: 'pending' | 'confirmed';
  delivery_address: string | null;
  notes: string | null;
  created_at: string;
  items?: OrderItem[];
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  product?: Product;
};

export type Vehicle = {
  id: string;
  vehicle_number: string;
  driver_name: string;
  driver_mobile: string | null;
  created_at: string;
};

export type DispatchStatus =
  | 'pending'
  | 'confirmed'
  | 'weighed'
  | 'loaded'
  | 'completed';

export type Dispatch = {
  id: string;
  dispatch_no: string;
  order_id: string;
  customer_id: string;
  delivery_address: string | null;
  status: DispatchStatus;
  vehicle_id: string | null;
  vehicle_number: string | null; // Actually this might be joined later or just null
  driver_name: string | null;
  driver_mobile: string | null;
  loading_at: string | null;
  completed_at: string | null;
  dispatch_team: string | null;
  created_at: string;
  items?: DispatchItem[];
  weights?: Weight[];
  photos?: Photo[];
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
  read: boolean;
  created_at: string;
};
