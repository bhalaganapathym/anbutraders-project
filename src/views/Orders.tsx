import { useCallback, useEffect, useState } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import { api, type Customer, type Order, type OrderItem, type Product } from '@/lib/api';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import {
  Pencil, Plus, Search, Trash2, ShoppingCart, CheckCircle2, Truck, X, Minus, Phone, User, MapPin, UserPlus, IndianRupee, Tag,
} from 'lucide-react';

type OrderWithCustomer = Order & { customer: Pick<Customer, 'name' | 'phone'> | null };
type OrderItemWithProduct = OrderItem & { product: Product | null };

type Line = { product_id: string; quantity: number };

export default function Orders() {
  const toast = useToast();
  const [orders, setOrders] = useState<OrderWithCustomer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [detailOrder, setDetailOrder] = useState<OrderWithCustomer | null>(null);
  const [detailItems, setDetailItems] = useState<OrderItemWithProduct[]>([]);

  // Customer mode: 'search' = find existing by phone, 'new' = enter details inline
  const [customerMode, setCustomerMode] = useState<'search' | 'new'>('search');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');

  // Brand → size product picker
  const [selBrand, setSelBrand] = useState('');
  const [selSize, setSelSize] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, p] = await Promise.all([
        api.get('/orders'),
        api.get('/products'),
      ]);
      setOrders(o as OrderWithCustomer[]);
      setProducts(p as Product[]);
    } catch (e) {
      toast('Failed to load orders', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime('orders', load);
  useRealtime('order_items', load);
  useRealtime('customers', load);
  useRealtime('products', load);

  const filtered = orders.filter((o) =>
    [o.customer?.name ?? '', o.customer?.phone ?? '', o.delivery_address ?? ''].join(' ').toLowerCase().includes(query.toLowerCase())
  );

  const searchByPhone = async () => {
    if (phoneSearch.trim().length < 3) {
      toast('Enter at least 3 digits', 'error');
      return;
    }
    setSearching(true);
    try {
      const data: Customer[] = await api.get('/customers');
      const results = data.filter(c => c.phone?.toLowerCase().includes(phoneSearch.trim().toLowerCase()));
      setSearchResults(results.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      toast('Search failed', 'error');
    }
    setSearching(false);
  };

  const openNew = () => {
    setEditing(null);
    setCustomerMode('search');
    setPhoneSearch('');
    setSearchResults([]);
    setSelectedCustomer(null);
    setNewName('');
    setNewPhone('');
    setNewAddress('');
    setDeliveryAddress('');
    setNotes('');
    setLines([]);
    setOpen(true);
  };

  const openEdit = async (o: OrderWithCustomer) => {
    setEditing(o);
    setDeliveryAddress(o.delivery_address ?? '');
    setNotes(o.notes ?? '');
    // Items are included in the OrderResponse
    const data = o.items || [];
    setLines(data.map((x: any) => ({ product_id: x.product_id, quantity: x.quantity })));
    // Load the existing customer for editing
    if (o.customer) {
      setSelectedCustomer(o.customer as Customer);
      setCustomerMode('search');
    }
    setOpen(true);
  };

  const addLine = (pid: string) => {
    if (lines.some((l) => l.product_id === pid)) {
      toast('Product already added', 'info');
      return;
    }
    setLines([...lines, { product_id: pid, quantity: 1 }]);
  };

  const updateQty = (pid: string, delta: number) => {
    setLines(lines.map((l) => (l.product_id === pid ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l)));
  };

  const setQty = (pid: string, qty: number) => {
    setLines(lines.map((l) => (l.product_id === pid ? { ...l, quantity: Math.max(1, qty) } : l)));
  };

  const removeLine = (pid: string) => setLines(lines.filter((l) => l.product_id !== pid));

  const resolveCustomer = async (): Promise<string | null> => {
    if (editing && selectedCustomer) return selectedCustomer.id;
    if (customerMode === 'search') {
      if (!selectedCustomer) {
        toast('Please select a customer from search results', 'error');
        return null;
      }
      return selectedCustomer.id;
    }
    // new customer mode
    if (!newName.trim() || !newPhone.trim() || !newAddress.trim()) {
      toast('Name, phone, and address are all required for new customer', 'error');
      return null;
    }
    // Check if phone already exists
    try {
      const custs: Customer[] = await api.get('/customers');
      const existing = custs.find(c => c.phone === newPhone.trim());
      if (existing) return existing.id;
      
      const newCust = await api.post('/customers', { name: newName.trim(), phone: newPhone.trim(), address: newAddress.trim() });
      return newCust.id;
    } catch (e) {
      toast('Failed to create customer', 'error');
      return null;
    }
  };

  const save = async () => {
    const custId = await resolveCustomer();
    if (!custId) return;
    if (lines.length === 0) {
      toast('Add at least one product', 'error');
      return;
    }
    setSaving(true);
    try {
      const addr = deliveryAddress.trim() || (customerMode === 'new' ? newAddress.trim() : selectedCustomer?.address ?? '') || null;
      const payload = {
        customer_id: custId,
        delivery_address: addr,
        notes: notes.trim() || null,
        items: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity }))
      };
      if (editing) {
        await api.put(`/orders/${editing.id}`, payload);
        toast('Order updated', 'success');
      } else {
        await api.post('/orders', payload);
        toast('Order created', 'success');
      }
      setOpen(false);
      load();
    } catch (err: any) {
      const msg = err?.message || 'Failed to save order';
      toast(msg.includes('Internal Server Error') ? 'Server error — please try again' : msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmOrder = async (o: OrderWithCustomer) => {
    try {
      await api.put(`/orders/${o.id}`, {
        customer_id: o.customer_id,
        delivery_address: o.delivery_address,
        notes: o.notes,
        status: 'confirmed',
        items: o.items?.map(i => ({ product_id: i.product_id, quantity: i.quantity })) || []
      });
      toast('Order confirmed', 'success');
      load();
    } catch (e) {
      toast('Failed to confirm order', 'error');
    }
  };

  const remove = async (o: OrderWithCustomer) => {
    if (!confirm('Delete this order and its items?')) return;
    try {
      await api.delete(`/orders/${o.id}`);
      toast('Order deleted', 'success');
      load();
    } catch (e) {
      toast('Failed to delete order', 'error');
    }
  };

  const openDetail = async (o: OrderWithCustomer) => {
    setDetailOrder(o);
    setDetailItems((o.items ?? []) as OrderItemWithProduct[]);
  };

  const productName = (pid: string) => products.find((p) => p.id === pid)?.name ?? 'Unknown';
  const productPrice = (pid: string) => products.find((p) => p.id === pid)?.price ?? 0;

  // Brands with multiple size variants (steels, etc.)
  const brandedProducts = products.filter((p) => p.brand && p.brand.trim() !== '');
  const unbrandedProducts = products.filter((p) => !p.brand || p.brand.trim() === '');
  const allBrands = Array.from(new Set(brandedProducts.map((p) => p.brand!).filter(Boolean))).sort();
  const sizesForBrand = (brand: string) =>
    brandedProducts.filter((p) => p.brand === brand).sort((a, b) =>
      (a.size ?? '').localeCompare(b.size ?? '', undefined, { numeric: true })
    );
  // Brands that have size variants (steel etc.)
  const brandsWithSizes = allBrands.filter((b) => sizesForBrand(b).some((p) => p.size && p.size.trim() !== '' && p.size.toLowerCase() !== 'n/a'));
  // Brands that have NO size variants — can be added directly by brand selection
  const brandsWithoutSizes = allBrands.filter((b) => !brandsWithSizes.includes(b));
  const selectedProduct = sizesForBrand(selBrand).find((p) => p.size === selSize);
  // For no-size brands, the product is just the first (and only) one for that brand
  const noSizeBrandProduct = (brand: string) => sizesForBrand(brand)[0] ?? null;

  const orderTotal = lines.reduce((sum, l) => sum + productPrice(l.product_id) * l.quantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Orders</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">Create orders with new or existing customers</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus size={16} /> New Order
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by customer or phone..."
          className="input pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <ShoppingCart size={36} className="text-slate-300" />
          <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500">No orders yet.</p>
          <button onClick={openNew} className="btn-primary">
            <Plus size={16} /> Create your first order
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead className="border-b border-white/20 dark:border-slate-700/50 bg-white/20 dark:bg-slate-800/30">
              <tr>
                <th className="th">Customer</th>
                <th className="th">Phone</th>
                <th className="th">Items</th>
                <th className="th">Delivery Address</th>
                <th className="th">Status</th>
                <th className="th">Created</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-white/20 dark:bg-slate-800/30">
                  <td className="td">
                    <button onClick={() => openDetail(o)} className="font-medium text-indigo-700 dark:text-indigo-300 hover:underline">
                      {o.customer?.name ?? 'Unknown'}
                    </button>
                  </td>
                  <td className="td text-slate-500 dark:text-slate-400 dark:text-slate-500">{o.customer?.phone ?? '—'}</td>
                  <td className="td text-slate-500 dark:text-slate-400 dark:text-slate-500">—</td>
                  <td className="td max-w-[200px] truncate">{o.delivery_address ?? '—'}</td>
                  <td className="td">
                    {o.status === 'confirmed' ? (
                      <span className="badge bg-emerald-100/50 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300">Confirmed</span>
                    ) : (
                      <span className="badge bg-white/20 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200">Pending</span>
                    )}
                  </td>
                  <td className="td">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="td text-right">
                    <div className="flex justify-end gap-1">
                      {o.status === 'pending' && (
                        <button
                          onClick={() => confirmOrder(o)}
                          className="btn-ghost p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50/50 dark:bg-emerald-900/30"
                          title="Confirm order"
                        >
                          <CheckCircle2 size={15} />
                        </button>
                      )}
                      <button onClick={() => openEdit(o)} className="btn-ghost p-1.5" title="Edit">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => remove(o)} className="btn-ghost p-1.5 text-rose-500 hover:bg-rose-50" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Order' : 'New Order'} size="lg">
        <div className="space-y-4">
          {/* Customer section */}
          {!editing && (
            <div className="rounded-lg border border-white/20 dark:border-slate-700/50">
              <div className="flex border-b border-white/20 dark:border-slate-700/50">
                <button
                  onClick={() => { setCustomerMode('search'); setSelectedCustomer(null); }}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium transition ${
                    customerMode === 'search' ? 'bg-indigo-50/50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:bg-white/20 dark:bg-slate-800/30'
                  }`}
                >
                  <Phone size={14} className="mr-1.5 inline" /> Search Existing Customer
                </button>
                <button
                  onClick={() => { setCustomerMode('new'); setSelectedCustomer(null); }}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium transition ${
                    customerMode === 'new' ? 'bg-indigo-50/50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:bg-white/20 dark:bg-slate-800/30'
                  }`}
                >
                  <UserPlus size={14} className="mr-1.5 inline" /> New Customer
                </button>
              </div>

              {customerMode === 'search' ? (
                <div className="space-y-3 p-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input
                        value={phoneSearch}
                        onChange={(e) => setPhoneSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && searchByPhone()}
                        className="input pl-9"
                        placeholder="Enter phone number to search..."
                      />
                    </div>
                    <button onClick={searchByPhone} disabled={searching} className="btn-primary whitespace-nowrap">
                      {searching ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">Select a customer:</p>
                      {searchResults.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomer(c);
                            setDeliveryAddress(c.address ?? '');
                          }}
                          className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                            selectedCustomer?.id === c.id
                              ? 'border-amber-400 bg-indigo-50/50 dark:bg-indigo-900/30'
                              : 'border-white/20 dark:border-slate-700/50 hover:bg-white/20 dark:bg-slate-800/30'
                          }`}
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 dark:bg-slate-800/40">
                            <User size={16} className="text-slate-500 dark:text-slate-400 dark:text-slate-500" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-800 dark:text-slate-100">{c.name}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">{c.phone}</p>
                          </div>
                          {selectedCustomer?.id === c.id && <CheckCircle2 size={18} className="text-indigo-600 dark:text-indigo-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.length === 0 && phoneSearch && !searching && (
                    <p className="text-sm text-slate-400 dark:text-slate-500">No customers found. Try a different number or switch to New Customer.</p>
                  )}
                  {selectedCustomer && (
                    <div className="rounded-lg bg-emerald-50/50 dark:bg-emerald-900/30 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 size={14} className="mr-1 inline" />
                      Selected: <strong>{selectedCustomer.name}</strong> — {selectedCustomer.phone}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 p-4">
                  <div>
                    <label className="label">Customer Name *</label>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="input"
                      placeholder="Enter customer name"
                    />
                  </div>
                  <div>
                    <label className="label">Phone Number *</label>
                    <input
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="input"
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div>
                    <label className="label">Address *</label>
                    <textarea
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      className="input min-h-[70px]"
                      placeholder="Enter delivery address"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {editing && selectedCustomer && (
            <div className="rounded-lg bg-white/20 dark:bg-slate-800/30 p-3 text-sm">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{selectedCustomer.name}</p>
              <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500">{selectedCustomer.phone}</p>
            </div>
          )}

          <div>
            <label className="label">Delivery Address</label>
            <textarea
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="input min-h-[60px]"
              placeholder="Delivery address (defaults to customer address if empty)"
            />
          </div>

          <div>
            <label className="label">Add Products by Name</label>
            <div className="rounded-lg border border-white/20 dark:border-slate-700/50 bg-white/20 dark:bg-slate-800/30 p-3 space-y-4">
              {allBrands.length === 0 && unbrandedProducts.length === 0 && (
                <p className="text-sm text-slate-400 dark:text-slate-500">No products available. Add products from the Products page first.</p>
              )}

              {/* Steel / size-based brands */}
              {brandsWithSizes.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-wide">By Brand &amp; Size (Steel, etc.)</p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <label className="label">Brand</label>
                      <select
                        value={selBrand}
                        onChange={(e) => { setSelBrand(e.target.value); setSelSize(''); }}
                        className="input"
                      >
                        <option value="">Select brand…</option>
                        {brandsWithSizes.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="label">Size</label>
                      <select
                        value={selSize}
                        onChange={(e) => setSelSize(e.target.value)}
                        className="input"
                        disabled={!selBrand}
                      >
                        <option value="">Select size…</option>
                        {sizesForBrand(selBrand)
                          .filter((p) => p.size && p.size.trim() !== '' && p.size.toLowerCase() !== 'n/a')
                          .map((p) => (
                            <option key={p.id} value={p.size ?? ''}>
                              {p.size} — ₹{(p.price ?? 0).toFixed(2)}/{p.unit}
                            </option>
                          ))}
                      </select>
                    </div>
                    <button
                      onClick={() => {
                        if (selectedProduct) {
                          addLine(selectedProduct.id);
                          setSelBrand('');
                          setSelSize('');
                        } else {
                          toast('Select a brand and size first', 'error');
                        }
                      }}
                      disabled={!selectedProduct}
                      className="btn-primary whitespace-nowrap"
                    >
                      <Plus size={16} /> Add
                    </button>
                  </div>
                </div>
              )}

              {/* Non-size brands (cement, paint, etc.) — click to add directly */}
              {brandsWithoutSizes.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-wide">By Brand (Cement, etc.)</p>
                  <div className="flex flex-wrap gap-2">
                    {brandsWithoutSizes.map((b) => {
                      const prod = noSizeBrandProduct(b);
                      if (!prod) return null;
                      return (
                        <button
                          key={b}
                          onClick={() => addLine(prod.id)}
                          className="rounded-lg border border-white/20 dark:border-slate-700/50 bg-white px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 transition hover:border-amber-400 hover:bg-indigo-50/50 dark:bg-indigo-900/30"
                        >
                          <Plus size={12} className="mr-1 inline" />
                          {b} — ₹{(prod.price ?? 0).toFixed(2)}/{prod.unit}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Completely unbranded products */}
              {unbrandedProducts.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-wide">Other Products</p>
                  <div className="flex flex-wrap gap-2">
                    {unbrandedProducts.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => addLine(p.id)}
                        className="rounded-lg border border-white/20 dark:border-slate-700/50 bg-white px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 transition hover:border-amber-400 hover:bg-indigo-50/50 dark:bg-indigo-900/30"
                      >
                        <Plus size={12} className="mr-1 inline" />
                        {p.name} — ₹{(p.price ?? 0).toFixed(2)}/{p.unit}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="label">Selected Products ({lines.length})</label>
            {lines.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/20 dark:border-slate-700/50 p-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No products selected yet. Pick a brand and size above to add.
              </p>
            ) : (
              <div className="space-y-2">
                {lines.map((l) => {
                  const p = products.find((x) => x.id === l.product_id);
                  const lineTotal = (p?.price ?? 0) * l.quantity;
                  return (
                    <div key={l.product_id} className="flex items-center gap-3 rounded-lg border border-white/20 dark:border-slate-700/50 p-3">
                      <div className="flex-1">
                        <p className="font-medium text-slate-700 dark:text-slate-200">{productName(l.product_id)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                          {p?.brand && p.brand} {p?.size && `· ${p.size}`}
                          {p && ` · ₹${(p.price ?? 0).toFixed(2)}/${p.unit}`}
                        </p>
                      </div>
                      <span className="hidden text-sm font-semibold text-slate-600 dark:text-slate-300 sm:inline">
                        ₹{lineTotal.toFixed(2)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(l.product_id, -1)} className="btn-ghost p-1" aria-label="Decrease">
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          value={l.quantity}
                          onChange={(e) => setQty(l.product_id, Number(e.target.value))}
                          className="w-16 rounded border border-white/30 dark:border-slate-600/50 px-2 py-1 text-center text-sm"
                          min="1"
                        />
                        <button onClick={() => updateQty(l.product_id, 1)} className="btn-ghost p-1" aria-label="Increase">
                          <Plus size={14} />
                        </button>
                      </div>
                      <button onClick={() => removeLine(l.product_id)} className="btn-ghost p-1.5 text-rose-500 hover:bg-rose-50" aria-label="Remove">
                        <X size={15} />
                      </button>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between rounded-lg bg-indigo-50/50 dark:bg-indigo-900/30 px-4 py-2.5">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-amber-800">
                    <IndianRupee size={15} /> Order Total
                  </span>
                  <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300">₹{orderTotal.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input min-h-[60px]"
              placeholder="Optional notes"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save Order'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detailOrder} onClose={() => setDetailOrder(null)} title="Order Details" size="md">
        {detailOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="label">Customer</p>
                <p className="font-semibold text-slate-800 dark:text-slate-100">{detailOrder.customer?.name ?? 'Unknown'}</p>
              </div>
              <div>
                <p className="label">Phone</p>
                <p className="text-slate-700 dark:text-slate-200">{detailOrder.customer?.phone ?? '—'}</p>
              </div>
              <div>
                <p className="label">Status</p>
                {detailOrder.status === 'confirmed' ? (
                  <span className="badge bg-emerald-100/50 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300">Confirmed</span>
                ) : (
                  <span className="badge bg-white/20 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200">Pending</span>
                )}
              </div>
              <div className="col-span-2">
                <p className="label">Delivery Address</p>
                <p className="text-slate-700 dark:text-slate-200">{detailOrder.delivery_address ?? '—'}</p>
              </div>
            </div>
            <div>
              <p className="label">Products</p>
              <div className="space-y-2">
                {detailItems.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No items.</p>}
                {detailItems.map((it) => (
                  <div key={it.id} className="flex items-center justify-between rounded-lg border border-white/20 dark:border-slate-700/50 px-3 py-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{it.product?.name ?? 'Unknown'}</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">Qty: {it.quantity} {it.product?.unit}</span>
                  </div>
                ))}
              </div>
            </div>
            {detailOrder.status === 'confirmed' && (
              <div className="rounded-lg bg-emerald-50/50 dark:bg-emerald-900/30 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                <Truck size={14} className="mr-1 inline" />
                This order is confirmed and ready for dispatch creation.
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
