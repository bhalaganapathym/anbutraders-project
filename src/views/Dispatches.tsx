import { useCallback, useEffect, useState } from 'react';
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
  Trash2, X, Package, User, MapPin, Calendar, IndianRupee, Phone, MessageCircle, Send,
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
        const MAX_DIM = 1000;
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
        }, 'image/jpeg', 0.6); // 60% quality jpeg
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

  const [weightValue, setWeightValue] = useState('');
  const [weightNotes, setWeightNotes] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

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
    setCreateOpen(true);
  };

  const filtered = dispatches.filter((d) =>
    [d.dispatch_no, d.customer?.name ?? '', d.delivery_address ?? ''].join(' ').toLowerCase().includes(query.toLowerCase())
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
      const num = dispatches.length + 1; // Simplistic ID generation based on count
      const dispatchNo = `DSP-${String(num).padStart(4, '0')}`;
      
      const payload = {
        dispatch_no: dispatchNo,
        order_id: selectedOrder,
        customer_id: order.customer_id,
        delivery_address: order.delivery_address,
        status: 'confirmed',
        items: orderItems.map((it) => ({
          product_id: it.product_id,
          product_name: it.product?.name ?? 'Unknown',
          quantity: it.quantity,
          unit: it.product?.unit ?? 'piece',
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
    setWeightValue('');
    setWeightNotes('');
    setPhotoCaption('');
    setPhotoFiles([]);
    setPhotoPreviews([]);

    
    // Dispatches API already includes these via joinedload
    const di = (d.items ?? []) as DispatchItem[];
    setDetailItems(di);
    const prices: Record<string, string> = {};
    di.forEach((it) => { prices[it.id] = String(it.price ?? 0); });
    setItemPrices(prices);
    setDetailWeights((d.weights ?? []) as Weight[]);
    setDetailPhotos((d.photos ?? []) as Photo[]);
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

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    if (imgs.length === 0) {
      toast('Please select image files only', 'error');
      return;
    }
    
    setUploading(true);
    try {
      const compressedImgs = await Promise.all(imgs.map(compressImage));
      setPhotoFiles((prev) => [...prev, ...compressedImgs]);
      setPhotoPreviews((prev) => [...prev, ...compressedImgs.map((f) => URL.createObjectURL(f))]);
    } catch (err) {
      toast('Failed to compress images', 'error');
    }
    setUploading(false);
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
      toast('Please select at least one photo', 'error');
      return;
    }
    setUploading(true);
    const caption = photoCaption.trim() || null;
    let ok = 0;
    let fail = 0;
    const newPhotos = [];
    for (const f of photoFiles) {
      try {
        const res = await api.upload('/storage/upload', f);
        newPhotos.push({
          url: res.url,
          caption,
        });
        ok++;
      } catch {
        fail++;
      }
    }
    if (newPhotos.length > 0) {
      try {
        await api.put(`/dispatches/${detail!.id}`, {
          ...detail,
          photos: [...(detail?.photos || []), ...newPhotos]
        });
      } catch (e) {
        toast('Failed to save photo records', 'error');
      }
    }
    setUploading(false);
    photoPreviews.forEach((p) => URL.revokeObjectURL(p));
    setPhotoFiles([]);
    setPhotoPreviews([]);
    setPhotoCaption('');
    if (fail === 0) toast(`${ok} photo${ok === 1 ? '' : 's'} uploaded`, 'success');
    else if (ok === 0) toast('Failed to upload photos', 'error');
    else toast(`${ok} uploaded, ${fail} failed`, 'error');
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
          <h1 className="text-2xl font-bold text-slate-800">Dispatches</h1>
          <p className="text-sm text-slate-500">Weight verification, prices, photos, vehicle loading and completion</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={16} /> Create Dispatch
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search dispatches..."
          className="input pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <Truck size={36} className="text-slate-300" />
          <p className="text-slate-500">No dispatches yet.</p>
          <button onClick={openCreate} className="btn-primary">
            <Plus size={16} /> Create your first dispatch
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Dispatch No</th>
                <th className="th">Customer</th>
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
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="td">
                      <button onClick={() => openDetail(d)} className="font-semibold text-amber-700 hover:underline">
                        {d.dispatch_no}
                      </button>
                    </td>
                    <td className="td">{d.customer?.name ?? 'Unknown'}</td>
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
          <p className="text-sm text-slate-500">
            Select a confirmed customer order to generate a dispatch list.
          </p>
          {confirmedOrders.length === 0 ? (
            <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">
              <AlertCircle size={16} className="mr-1 inline" />
              No confirmed orders available. Confirm an order first.
            </div>
          ) : (
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
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <p className="label">Customer</p>
                  <p className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <User size={13} className="text-slate-400" /> {detail.customer?.name ?? 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="label">Status</p>
                  <DispatchStatusBadge status={detail.status} />
                </div>
                <div>
                  <p className="label">Created</p>
                  <p className="flex items-center gap-1.5 text-slate-600">
                    <Calendar size={13} className="text-slate-400" /> {new Date(detail.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="label">Delivery Address</p>
                  <p className="flex items-center gap-1.5 text-slate-600">
                    <MapPin size={13} className="text-slate-400" /> {detail.delivery_address ?? '—'}
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
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
                <CheckCircle2 size={16} /> Dispatch completed on {new Date(detail.completed_at ?? '').toLocaleString()}
              </div>
            )}

            <div>
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Package size={16} className="text-amber-600" /> Items & Prices
                  </h3>
                  <div className="space-y-2">
                    {detailItems.map((it) => {
                      const lineTotal = (it.price ?? 0) * it.quantity;
                      return (
                        <div key={it.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
                          <span className="flex-1 text-sm font-medium text-slate-700">{it.product_name}</span>
                          <span className="text-sm text-slate-500">{it.quantity} {it.unit}</span>
                          {detail.status !== 'completed' ? (
                            <div className="flex items-center gap-1">
                              <IndianRupee size={13} className="text-slate-400" />
                              <input
                                type="number"
                                value={itemPrices[it.id] ?? '0'}
                                onChange={(e) => setItemPrices({ ...itemPrices, [it.id]: e.target.value })}
                                onBlur={() => updateItemPrice(it.id)}
                                className="w-24 rounded border border-slate-300 px-2 py-1 text-center text-sm"
                                min="0"
                                step="0.01"
                                placeholder="Price"
                              />
                              <span className="text-xs text-slate-400">per {it.unit}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-600">₹{(it.price ?? 0).toFixed(2)} per {it.unit}</span>
                          )}
                          <span className="w-24 text-right text-sm font-semibold text-slate-800">₹{lineTotal.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-50 px-4 py-2.5">
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
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Camera size={16} className="text-amber-600" /> Dispatch Photos ({detailPhotos.length})
                  </h3>
                  {detail.status !== 'completed' && (
                    <div className="mb-3 space-y-3 rounded-lg border border-slate-200 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="flex-1">
                          <label className="label">Take Photo</label>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={onPickFile}
                            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-amber-700 hover:file:bg-amber-200"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="label">Caption (applies to all)</label>
                          <input
                            value={photoCaption}
                            onChange={(e) => setPhotoCaption(e.target.value)}
                            className="input"
                            placeholder="Optional"
                          />
                        </div>
                        <button onClick={addPhoto} disabled={uploading || photoFiles.length === 0} className="btn-primary whitespace-nowrap">
                          <Camera size={15} /> {uploading ? 'Uploading...' : `Upload${photoFiles.length > 0 ? ` (${photoFiles.length})` : ''}`}
                        </button>
                      </div>
                      {photoPreviews.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {photoPreviews.map((src, idx) => (
                            <div key={idx} className="relative overflow-hidden rounded-lg border border-slate-200">
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
                    <p className="text-sm text-slate-400">No photos attached yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {detailPhotos.map((ph) => (
                        <div key={ph.id} className="group relative overflow-hidden rounded-lg border border-slate-200">
                          <img src={ph.url} alt={ph.caption ?? 'Dispatch photo'} className="h-32 w-full object-cover" />
                          {ph.caption && (
                            <p className="absolute bottom-0 left-0 right-0 bg-slate-900/60 px-2 py-1 text-xs text-white">{ph.caption}</p>
                          )}
                          {detail.status !== 'completed' && (
                            <button
                              onClick={() => deletePhoto(ph.id, ph.url)}
                              className="absolute right-1 top-1 rounded-full bg-rose-600 p-1 text-white opacity-0 transition group-hover:opacity-100"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                </div>

                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                    <WeightIcon size={16} className="text-amber-600" /> Weight Verification
                    {detailWeights.length > 0 && (
                      <span className="badge bg-amber-100 text-amber-700">Total: {totalWeight} kg</span>
                    )}
                  </h3>
                  {detail.status !== 'completed' && (
                    <div className="mb-3 flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-end">
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
                    <p className="text-sm text-slate-400">No weight records yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {detailWeights.map((w) => (
                        <div key={w.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                          <div>
                            <span className="text-sm font-semibold text-slate-700">{w.actual_weight} kg</span>
                            {w.notes && <span className="ml-2 text-xs text-slate-500">{w.notes}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">{new Date(w.weighed_at).toLocaleString()}</span>
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
          <p className="text-sm text-slate-500">Add multiple products to this dispatch. Each row becomes a dispatch item.</p>
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
    </div>
  );
}
