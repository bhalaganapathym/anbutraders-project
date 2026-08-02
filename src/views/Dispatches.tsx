import { useCallback, useEffect, useState, useRef } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import {
  api,
  type Customer,
  type Dispatch,
  type DispatchItem,
  type Order,
  type Photo,
  type Product,
  type Weight,
} from '@/lib/api';
import Modal from '@/components/Modal';
import DispatchStatusBadge from '@/components/DispatchStatusBadge';
import { useToast } from '@/components/Toast';
import {
  Plus, Search, Truck, Weight as WeightIcon, Camera, CheckCircle2, AlertCircle,
  Trash2, X, Package, User, MapPin, Calendar, IndianRupee, Phone, MessageCircle, Send, Download,
} from 'lucide-react';

type DispatchRow = Dispatch & { customer: Pick<Customer, 'name' | 'phone'> | null };
type ConfirmedOrder = Order & { customer: Pick<Customer, 'name'> | null };

type OrderItemWithProduct = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  product: { name: string; unit: string } | null;
};

const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
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
            resolve(file); // fallback
          }
        }, 'image/jpeg', 0.5); // 50% quality jpeg
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

export default function Dispatches() {
  const toast = useToast();
  const [dispatches, setDispatches] = useState<DispatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmedOrders, setConfirmedOrders] = useState<ConfirmedOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState('');
  const [creating, setCreating] = useState(false);

  const [detail, setDetail] = useState<DispatchRow | null>(null);
  const [detailItems, setDetailItems] = useState<DispatchItem[]>([]);
  const [detailWeights, setDetailWeights] = useState<Weight[]>([]);
  const [detailPhotos, setDetailPhotos] = useState<Photo[]>([]);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  const [weightValue, setWeightValue] = useState('');
  const [weightNotes, setWeightNotes] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverMobile, setDriverMobile] = useState('');
  const [editVehicleNo, setEditVehicleNo] = useState('');
  const [editDriverName, setEditDriverName] = useState('');
  const [editDriverMobile, setEditDriverMobile] = useState('');

  // Per-item prices
  const [itemPrices, setItemPrices] = useState<Record<string, string>>({});

  // Add products to an existing dispatch
  const [addOpen, setAddOpen] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [addRows, setAddRows] = useState<{ product: Product | null; qty: string }[]>([{ product: null, qty: '1' }]);
  const [addingItems, setAddingItems] = useState(false);



  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/dispatches');
      setDispatches(data as DispatchRow[]);
    } catch (e) {
      toast('Failed to load dispatches', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime('dispatches', load);
  useRealtime('dispatch_items', () => { load(); if (detail) refreshDetail(); });
  useRealtime('weights', () => { load(); if (detail) refreshDetail(); });
  useRealtime('photos', () => { load(); if (detail) refreshDetail(); });

  const loadConfirmedOrders = useCallback(async () => {
    try {
      const data: ConfirmedOrder[] = await api.get('/orders');
      const confirmed = data.filter(o => o.status === 'confirmed');
      setConfirmedOrders(confirmed);
    } catch (e) {
      toast('Failed to load confirmed orders', 'error');
    }
  }, [toast]);

  const openCreate = () => {
    loadConfirmedOrders();
    setSelectedOrder('');
    setVehicleNumber('');
    setCreateOpen(true);
  };

  const filtered = dispatches.filter((d) =>
    [d.dispatch_no, d.customer?.name ?? '', d.delivery_address ?? '', d.vehicle_number ?? ''].join(' ').toLowerCase().includes(query.toLowerCase())
  );

  const createDispatch = async () => {
    if (!selectedOrder) {
      toast('Select a confirmed order', 'error');
      return;
    }
    setCreating(true);
    try {
      const order = confirmedOrders.find((o) => o.id === selectedOrder);
      if (!order) throw new Error();
      
      const orderItems = order.items || [];
      if (orderItems.length === 0) {
        toast('This order has no products', 'error');
        setCreating(false);
        return;
      }
      const num = dispatches.length + 1;
      const dispatchNo = `DSP-${String(num).padStart(4, '0')}`;
      
      const payload = {
        dispatch_no: dispatchNo,
        order_id: selectedOrder,
        customer_id: order.customer_id,
        delivery_address: order.delivery_address,
        vehicle_number: vehicleNumber.trim() || null,
        driver_name: driverName.trim() || null,
        driver_mobile: driverMobile.trim() || null,
        status: 'confirmed',
        items: orderItems.map((it) => ({
          product_id: it.product_id,
          product_name: it.product?.name ?? 'Unknown',
          quantity: it.quantity,
          unit: it.product?.unit ?? 'piece',
          price: Number(it.product?.price ?? 0),
        }))
      };
      
      await api.post('/dispatches', payload);
      toast('Dispatch list created', 'success');
      setCreateOpen(false);
      load();
    } catch {
      toast('Failed to create dispatch', 'error');
    }
    setCreating(false);
  };

  const openDetail = async (d: DispatchRow) => {
    setDetail(d);
    setEditVehicleNo(d.vehicle_number ?? '');
    setEditDriverName(d.driver_name ?? '');
    setEditDriverMobile(d.driver_mobile ?? '');
    setWeightValue('');
    setWeightNotes('');
    setPhotoCaption('');
    setPhotoFiles([]);
    setPhotoPreviews([]);

    const di = (d.items ?? []) as DispatchItem[];
    setDetailItems(di);
    const prices: Record<string, string> = {};
    di.forEach((it) => { prices[it.id] = String(it.price ?? 0); });
    setItemPrices(prices);
    setDetailWeights((d.weights ?? []) as Weight[]);
    setDetailPhotos((d.photos ?? []) as Photo[]);
  };

  const updateVehicleNumber = async () => {
    if (!detail) return;
    try {
      await api.put(`/dispatches/${detail.id}`, {
        ...detail,
        vehicle_number: editVehicleNo.trim() || null,
        driver_name: editDriverName.trim() || null,
        driver_mobile: editDriverMobile.trim() || null,
      });
      toast('Vehicle details updated', 'success');
      refreshDetail();
    } catch {
      toast('Failed to update vehicle details', 'error');
    }
  };

  const refreshDetail = async () => {
    if (detail) {
      try {
        const freshDetail = await api.get(`/dispatches/${detail.id}`);
        await openDetail(freshDetail as DispatchRow);
      } catch (e) {
        console.error("Failed to refresh detail");
      }
    }
  };

  const addWeight = async () => {
    const w = Number(weightValue);
    if (!w || w <= 0) {
      toast('Enter a valid weight in kg', 'error');
      return;
    }
    try {
      const payload = {
        ...detail,
        weights: [
          ...(detail?.weights || []),
          { actual_weight: w, notes: weightNotes.trim() || null }
        ]
      };
      await api.put(`/dispatches/${detail!.id}`, payload);
      toast('Weight recorded', 'success');
      setWeightValue('');
      setWeightNotes('');
      refreshDetail();
    } catch {
      toast('Failed to record weight', 'error');
    }
  };

  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      setCameraStream(stream);
      setCameraModalOpen(true);
    } catch (e) {
      toast('Could not access camera. Please check permissions.', 'error');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setCameraModalOpen(false);
  };

  const capturePhotoFromCamera = (videoEl: HTMLVideoElement | null) => {
    if (!videoEl) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth || 640;
    canvas.height = videoEl.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], `dispatch_camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const compressed = await compressImage(file);
        setPhotoFiles((prev) => [...prev, compressed]);
        setPhotoPreviews((prev) => [...prev, URL.createObjectURL(compressed)]);
        toast('Photo captured from camera', 'success');
        stopCamera();
      }
    }, 'image/jpeg', 0.85);
  };

  const removeQueuedPhoto = (idx: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviews((prev) => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const addPhoto = async () => {
    if (photoFiles.length === 0) {
      toast('Please capture at least one photo first', 'error');
      return;
    }
    setUploading(true);
    const caption = photoCaption.trim() || null;
    const newPhotos: { url: string; caption: string | null }[] = [];

    for (const f of photoFiles) {
      try {
        // Convert file to base64 data URL — works without any cloud storage
        const dataUrl: string = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(f);
        });
        newPhotos.push({ url: dataUrl, caption });
      } catch {
        // skip failed conversions
      }
    }

    if (newPhotos.length > 0) {
      try {
        await api.put(`/dispatches/${detail!.id}`, {
          ...detail,
          photos: [...(detail?.photos || []), ...newPhotos]
        });
        for (const p of newPhotos) {
          await api.post('/notifications', {
            title: 'New Dispatch Photo',
            message: `A new photo was uploaded for dispatch ${detail!.dispatch_no}.`,
            type: 'photo_uploaded',
            dispatch_id: detail!.id,
            order_id: detail!.order_id,
            customer_name: detail!.customer?.name ?? 'Unknown',
            image_url: p.url,
          });
        }
        toast(`${newPhotos.length} photo${newPhotos.length === 1 ? '' : 's'} saved`, 'success');
      } catch (e) {
        toast('Failed to save photos', 'error');
      }
    } else {
      toast('No photos could be processed', 'error');
    }

    setUploading(false);
    photoPreviews.forEach((p) => URL.revokeObjectURL(p));
    setPhotoFiles([]);
    setPhotoPreviews([]);
    setPhotoCaption('');
    refreshDetail();
  };

  const deletePhoto = async (id: string, url: string) => {
    try {
      await api.put(`/dispatches/${detail!.id}`, {
        ...detail,
        photos: detail?.photos?.filter((p) => p.id !== id) || []
      });
      refreshDetail();
    } catch {
      toast('Failed to delete photo', 'error');
    }
  };

  const deleteWeight = async (id: string) => {
    try {
      await api.put(`/dispatches/${detail!.id}`, {
        ...detail,
        weights: detail?.weights?.filter((w) => w.id !== id) || []
      });
      refreshDetail();
    } catch {
      toast('Failed to delete weight record', 'error');
    }
  };

  const updateItemPrice = async (itemId: string) => {
    // We'd have to find the item in detail and update its price
    // Since we only save items on dispatch put:
    const price = Number(itemPrices[itemId] ?? 0) || 0;
    try {
      const updatedItems = detailItems.map(it => it.id === itemId ? { ...it, price } : it);
      await api.put(`/dispatches/${detail!.id}`, {
        ...detail,
        items: updatedItems
      });
      toast('Price updated', 'success');
      refreshDetail();
    } catch {
      toast('Failed to update price', 'error');
    }
  };

  const openAddProducts = async () => {
    if (allProducts.length === 0) {
      const data = await api.get('/products');
      setAllProducts(data);
    }
    setAddRows([{ product: null, qty: '1' }]);
    setAddOpen(true);
  };

  const setRowProduct = (idx: number, productId: string) => {
    const p = allProducts.find((x) => x.id === productId) ?? null;
    setAddRows((prev) => prev.map((r, i) => (i === idx ? { ...r, product: p } : r)));
  };

  const setRowQty = (idx: number, qty: string) => {
    setAddRows((prev) => prev.map((r, i) => (i === idx ? { ...r, qty } : r)));
  };

  const addRow = () => setAddRows((prev) => [...prev, { product: null, qty: '1' }]);

  const removeRow = (idx: number) => setAddRows((prev) => prev.filter((_, i) => i !== idx));

  const addProductsToDispatch = async () => {
    const valid = addRows.filter((r) => r.product && Number(r.qty) > 0);
    if (valid.length === 0) {
      toast('Select at least one product with a valid quantity', 'error');
      return;
    }
    setAddingItems(true);
    try {
      const newItems = valid.map((r) => ({
        product_id: r.product!.id,
        product_name: r.product!.name,
        quantity: Number(r.qty),
        unit: r.product!.unit,
        price: r.product!.price,
      }));
      await api.put(`/dispatches/${detail!.id}`, {
        ...detail,
        items: [...(detail?.items || []), ...newItems]
      });
      toast(`${valid.length} product${valid.length === 1 ? '' : 's'} added`, 'success');
      setAddOpen(false);
      refreshDetail();
    } catch {
      toast('Failed to add products', 'error');
    }
    setAddingItems(false);
  };

  const completeDispatch = async () => {
    if (!detail) return;
    try {
      await api.put(`/dispatches/${detail.id}`, {
        ...detail,
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
      // Send billing-team notification
      const customerName = detail.customer?.name ?? 'Unknown';
      try {
        await api.post('/notifications', {
          type: 'billing_alert',
          title: `Dispatch ${detail.dispatch_no} completed`,
          message: `Dispatch ${detail.dispatch_no} for ${customerName} is ready for billing. Grand total: ₹${grandTotal.toFixed(2)}.`,
          dispatch_id: detail.id,
          order_id: detail.order_id,
          customer_name: customerName,
        });
      } catch (e) {
        toast('Dispatch completed, but billing notification failed to send', 'error');
      }
      toast('Dispatch completed — billing team notified', 'success');
      await refreshDetail();
      load();
    } catch {
      toast('Failed to complete dispatch', 'error');
    }
  };

  const removeDispatch = async (d: DispatchRow) => {
    if (!confirm(`Delete dispatch ${d.dispatch_no}?`)) return;
    try {
      await api.delete(`/dispatches/${d.id}`);
      toast('Dispatch deleted', 'success');
      load();
    } catch {
      toast('Failed to delete dispatch', 'error');
    }
  };

  const totalWeight = detailWeights.reduce((s, w) => s + w.actual_weight, 0);
  const grandTotal = detailItems.reduce((s, it) => s + (it.price ?? 0) * it.quantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Dispatches</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">Weight verification, prices, photos, vehicle loading and completion</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={16} /> Create Dispatch
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search dispatches..."
          className="input pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <Truck size={36} className="text-slate-300" />
          <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500">No dispatches yet.</p>
          <button onClick={openCreate} className="btn-primary">
            <Plus size={16} /> Create your first dispatch
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead className="border-b border-white/20 dark:border-slate-700/50 bg-white/20 dark:bg-slate-800/30">
              <tr>
                <th className="th">Dispatch No</th>
                <th className="th">Customer</th>
                <th className="th">Vehicle</th>
                <th className="th">Total</th>
                <th className="th">Status</th>
                <th className="th">Created</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((d) => {
                const itemTotal = detailItems && d.id === detail?.id ? grandTotal : null;
                return (
                  <tr key={d.id} className="hover:bg-white/20 dark:bg-slate-800/30">
                    <td className="td">
                      <button onClick={() => openDetail(d)} className="font-semibold text-indigo-700 dark:text-indigo-300 hover:underline">
                        {d.dispatch_no}
                      </button>
                    </td>
                    <td className="td">{d.customer?.name ?? 'Unknown'}</td>
                    <td className="td">
                      {d.vehicle_number ? (
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
                          <Truck size={14} className="text-indigo-600 dark:text-indigo-400" /> {d.vehicle_number}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 italic">Not set</span>
                      )}
                    </td>
                    <td className="td">{itemTotal != null ? `₹${itemTotal.toFixed(2)}` : '—'}</td>
                    <td className="td"><DispatchStatusBadge status={d.status} /></td>
                    <td className="td">{new Date(d.created_at).toLocaleDateString()}</td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openDetail(d)} className="btn-ghost p-1.5" title="Open">
                          <Package size={15} />
                        </button>
                        <button onClick={() => removeDispatch(d)} className="btn-ghost p-1.5 text-rose-500 hover:bg-rose-50" title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Dispatch" size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
            Select a confirmed customer order to generate a dispatch list.
          </p>
          {confirmedOrders.length === 0 ? (
            <div className="rounded-lg bg-indigo-50/50 dark:bg-indigo-900/30 p-4 text-sm text-indigo-700 dark:text-indigo-300">
              <AlertCircle size={16} className="mr-1 inline" />
              No confirmed orders available. Confirm an order first.
            </div>
          ) : (
            <>
              <div>
                <label className="label">Confirmed Order *</label>
                <select value={selectedOrder} onChange={(e) => setSelectedOrder(e.target.value)} className="input">
                  <option value="">Select an order...</option>
                  {confirmedOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.customer?.name ?? 'Unknown'} — {new Date(o.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label flex items-center gap-1">
                  <Truck size={14} className="text-indigo-600 dark:text-indigo-400" /> Vehicle Details / Number
                </label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder="e.g. TN 38 AB 1234"
                  className="input mb-3"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs">Driver Name</label>
                    <input
                      type="text"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="e.g. Ramesh"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Driver Mobile</label>
                    <input
                      type="text"
                      value={driverMobile}
                      onChange={(e) => setDriverMobile(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="input"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={createDispatch} disabled={creating || !selectedOrder} className="btn-primary">
              {creating ? 'Creating...' : 'Create Dispatch'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Dispatch ${detail.dispatch_no}` : ''} size="xl">
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/20 dark:bg-slate-800/30 p-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-5">
                <div>
                  <p className="label">Customer</p>
                  <p className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
                    <User size={13} className="text-slate-400 dark:text-slate-500" /> {detail.customer?.name ?? 'Unknown'}
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="label">Vehicle & Driver</p>
                  {detail.status !== 'completed' ? (
                    <div className="flex flex-col gap-1.5 mt-1">
                      <input
                        type="text"
                        value={editVehicleNo}
                        onChange={(e) => setEditVehicleNo(e.target.value)}
                        onBlur={updateVehicleNumber}
                        className="w-full rounded border border-white/30 dark:border-slate-600/50 px-2 py-0.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
                        placeholder="Vehicle No"
                      />
                      <input
                        type="text"
                        value={editDriverName}
                        onChange={(e) => setEditDriverName(e.target.value)}
                        onBlur={updateVehicleNumber}
                        className="w-full rounded border border-white/30 dark:border-slate-600/50 px-2 py-0.5 text-xs text-slate-800 dark:text-slate-100"
                        placeholder="Driver Name"
                      />
                      <input
                        type="text"
                        value={editDriverMobile}
                        onChange={(e) => setEditDriverMobile(e.target.value)}
                        onBlur={updateVehicleNumber}
                        className="w-full rounded border border-white/30 dark:border-slate-600/50 px-2 py-0.5 text-xs text-slate-800 dark:text-slate-100"
                        placeholder="Mobile"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <p className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-100">
                        <Truck size={13} className="text-slate-400 dark:text-slate-500" /> {detail.vehicle_number || 'None'}
                      </p>
                      {detail.driver_name && <p className="text-xs text-slate-600 dark:text-slate-300">{detail.driver_name}</p>}
                      {detail.driver_mobile && <p className="text-xs text-slate-600 dark:text-slate-300">{detail.driver_mobile}</p>}
                    </div>
                  )}
                </div>
                <div>
                  <p className="label">Status</p>
                  <DispatchStatusBadge status={detail.status} />
                </div>
                <div>
                  <p className="label">Created</p>
                  <p className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <Calendar size={13} className="text-slate-400 dark:text-slate-500" /> {new Date(detail.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="label">Delivery Address</p>
                  <p className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <MapPin size={13} className="text-slate-400 dark:text-slate-500" /> {detail.delivery_address ?? '—'}
                  </p>
                </div>
              </div>
              {detail.status !== 'completed' && (
                <button onClick={completeDispatch} className="btn-primary">
                  <CheckCircle2 size={16} /> Complete Dispatch
                </button>
              )}
            </div>

            {detail.status === 'completed' && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/30 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 size={16} /> Dispatch completed on {new Date(detail.completed_at ?? '').toLocaleString()}
              </div>
            )}

            <div>
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    <Package size={16} className="text-indigo-600 dark:text-indigo-400" /> Items & Prices
                  </h3>
                  <div className="space-y-2">
                    {detailItems.map((it) => {
                      const lineTotal = (it.price ?? 0) * it.quantity;
                      return (
                        <div key={it.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-white/20 dark:border-slate-700/50 px-3 py-2.5">
                          <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{it.product_name}</span>
                          <span className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">{it.quantity} {it.unit}</span>
                          <span className="text-sm text-slate-600 dark:text-slate-300">₹{(it.price ?? 0).toFixed(2)} per {it.unit}</span>
                          <span className="w-24 text-right text-sm font-semibold text-slate-800 dark:text-slate-100">₹{lineTotal.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-indigo-50/50 dark:bg-indigo-900/30 px-4 py-2.5">
                    <span className="text-sm font-bold text-amber-800">Grand Total</span>
                    <span className="text-lg font-bold text-amber-800">₹{grandTotal.toFixed(2)}</span>
                  </div>
                  {detail.status !== 'completed' && (
                    <button onClick={openAddProducts} className="btn-secondary mt-3 w-full">
                      <Plus size={15} /> Add Products
                    </button>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    <Camera size={16} className="text-indigo-600 dark:text-indigo-400" /> Dispatch Photos ({detailPhotos.length})
                  </h3>
                  {detail.status !== 'completed' && (
                    <div className="mb-3 space-y-3 rounded-lg border border-white/20 dark:border-slate-700/50 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="flex-1">
                          <label className="label">Take Photo</label>
                          <button onClick={startCamera} className="btn-primary flex items-center justify-center gap-2 w-full">
                            <Camera size={16} /> Open Camera (Live Only)
                          </button>
                        </div>
                        <div className="flex-1">
                          <label className="label">Caption (applies to all)</label>
                          <input
                            value={photoCaption}
                            onChange={(e) => setPhotoCaption(e.target.value)}
                            className="input"
                            placeholder="Optional caption"
                          />
                        </div>
                        <button onClick={addPhoto} disabled={uploading || photoFiles.length === 0} className="btn-primary whitespace-nowrap">
                          <Camera size={15} /> {uploading ? 'Uploading...' : `Upload${photoFiles.length > 0 ? ` (${photoFiles.length})` : ''}`}
                        </button>
                      </div>
                      {photoPreviews.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {photoPreviews.map((src, idx) => (
                            <div key={idx} className="relative overflow-hidden rounded-lg border border-white/20 dark:border-slate-700/50">
                              <img src={src} alt={`Selected ${idx + 1}`} className="h-20 w-28 object-cover" />
                              <button
                                onClick={() => removeQueuedPhoto(idx)}
                                className="absolute right-1 top-1 rounded-full bg-rose-600 p-1 text-white"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {detailPhotos.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500">No photos attached yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {detailPhotos.map((ph) => (
                        <div 
                          key={ph.id} 
                          className="group relative overflow-hidden rounded-lg border border-white/20 dark:border-slate-700/50 cursor-pointer hover:opacity-80 transition"
                          onClick={() => setViewingPhoto(ph)}
                        >
                          <img src={ph.url} alt={ph.caption ?? 'Dispatch photo'} className="h-32 w-full object-cover" />
                          {ph.caption && (
                            <p className="absolute bottom-0 left-0 right-0 bg-slate-900/60 px-2 py-1 text-xs text-white truncate">{ph.caption}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                </div>

                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    <WeightIcon size={16} className="text-indigo-600 dark:text-indigo-400" /> Weight Verification
                    {detailWeights.length > 0 && (
                      <span className="badge bg-indigo-100/50 dark:bg-indigo-800/40 text-indigo-700 dark:text-indigo-300">Total: {totalWeight} kg</span>
                    )}
                  </h3>
                  {detail.status !== 'completed' && (
                    <div className="mb-3 flex flex-col gap-2 rounded-lg border border-white/20 dark:border-slate-700/50 p-3 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <label className="label">Actual Weight (kg)</label>
                        <input
                          type="number"
                          value={weightValue}
                          onChange={(e) => setWeightValue(e.target.value)}
                          className="input"
                          placeholder="0"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="label">Notes</label>
                        <input
                          value={weightNotes}
                          onChange={(e) => setWeightNotes(e.target.value)}
                          className="input"
                          placeholder="Optional"
                        />
                      </div>
                      <button onClick={addWeight} className="btn-primary">
                        <WeightIcon size={15} /> Record
                      </button>
                    </div>
                  )}
                  {detailWeights.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500">No weight records yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {detailWeights.map((w) => (
                        <div key={w.id} className="flex items-center justify-between rounded-lg border border-white/20 dark:border-slate-700/50 px-3 py-2">
                          <div>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{w.actual_weight} kg</span>
                            {w.notes && <span className="ml-2 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">{w.notes}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 dark:text-slate-500">{new Date(w.weighed_at).toLocaleString()}</span>
                            {detail.status !== 'completed' && (
                              <button onClick={() => deleteWeight(w.id)} className="btn-ghost p-1 text-rose-500 hover:bg-rose-50">
                                <X size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>


              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Products to Dispatch" size="md">
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">Add multiple products to this dispatch. Each row becomes a dispatch item.</p>
          {addRows.map((row, idx) => (
            <div key={idx} className="flex items-end gap-2">
              <div className="flex-1">
                <label className="label">Product</label>
                <select
                  value={row.product?.id ?? ''}
                  onChange={(e) => setRowProduct(idx, e.target.value)}
                  className="input"
                >
                  <option value="">Select a product</option>
                  {allProducts.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="label">Qty</label>
                <input
                  type="number"
                  value={row.qty}
                  onChange={(e) => setRowQty(idx, e.target.value)}
                  className="input"
                  min="1"
                  step="1"
                />
              </div>
              {addRows.length > 1 && (
                <button onClick={() => removeRow(idx)} className="btn-ghost p-2 text-rose-500 hover:bg-rose-50">
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          <button onClick={addRow} className="btn-secondary w-full">
            <Plus size={15} /> Add Another Product
          </button>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setAddOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={addProductsToDispatch} disabled={addingItems} className="btn-primary">
              {addingItems ? 'Adding...' : `Add ${addRows.filter((r) => r.product && Number(r.qty) > 0).length} Item${addRows.filter((r) => r.product && Number(r.qty) > 0).length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!viewingPhoto} onClose={() => setViewingPhoto(null)} title="View Photo" size="lg">
        {viewingPhoto && (
          <div className="space-y-4">
            <div className="flex justify-center bg-white/20 dark:bg-slate-800/40 rounded-lg p-2">
              <img 
                src={viewingPhoto.url} 
                alt={viewingPhoto.caption || ''} 
                className="max-w-full rounded-lg max-h-[60vh] object-contain" 
              />
            </div>
            {viewingPhoto.caption && (
              <p className="text-center text-sm font-medium text-slate-700 dark:text-slate-200">{viewingPhoto.caption}</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <a
                href={viewingPhoto.url}
                download={`dispatch_${detail?.dispatch_no}_${viewingPhoto.id}.jpg`}
                className="btn-secondary flex items-center gap-2"
              >
                <Download size={16} /> Download
              </a>
              {detail?.status !== 'completed' && (
                <button
                  onClick={() => {
                    deletePhoto(viewingPhoto.id, viewingPhoto.url);
                    setViewingPhoto(null);
                  }}
                  className="btn-primary bg-rose-600 hover:bg-rose-700 focus:ring-rose-200 border-none flex items-center gap-2"
                >
                  <Trash2 size={16} /> Delete from Server
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <LiveCameraModal
        open={cameraModalOpen}
        stream={cameraStream}
        onClose={stopCamera}
        onCapture={capturePhotoFromCamera}
      />
    </div>
  );
}

function LiveCameraModal({
  open,
  stream,
  onClose,
  onCapture,
}: {
  open: boolean;
  stream: MediaStream | null;
  onClose: () => void;
  onCapture: (video: HTMLVideoElement | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Live Camera Photo Capture" size="md">
      <div className="space-y-4 text-center">
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-64 object-cover"
          />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium">Position camera over dispatch item and tap Snap Photo.</p>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => onCapture(videoRef.current)} className="btn-primary flex items-center gap-2">
            <Camera size={16} /> Snap Photo
          </button>
        </div>
      </div>
    </Modal>
  );
}
