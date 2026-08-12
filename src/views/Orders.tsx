import { useCallback, useEffect, useState } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import { api, type Customer, type Order, type OrderItem, type Product } from '@/lib/api';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import {
  Pencil, Plus, Search, Trash2, ShoppingCart, CheckCircle2, Truck, X, Minus, Phone, User, MapPin, UserPlus, Tag, Clock
} from 'lucide-react';

type OrderWithCustomer = Order & { customer: Pick<Customer, 'name' | 'phone'> | null };
type OrderItemWithProduct = OrderItem & { product: Product | null };

type Line = { product_id: string; quantity: number; unit: string };

function WaitClock({ timestamp }: { timestamp: string | Date }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date().getTime();
      const start = new Date(timestamp).getTime();
      const diffMs = now - start;
      if (diffMs < 0) {
        setElapsed('0s');
        return;
      }
      const diffSecs = Math.floor(diffMs / 1000);
      const days = Math.floor(diffSecs / 86400);
      const hours = Math.floor((diffSecs % 86400) / 3600);
      const mins = Math.floor((diffSecs % 3600) / 60);
      const secs = diffSecs % 60;
      
      let timeStr = '';
      if (days > 0) timeStr += `${days}d `;
      if (hours > 0 || days > 0) timeStr += `${hours}h `;
      timeStr += `${mins}m ${secs}s`;
      
      setElapsed(timeStr.trim());
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return (
    <div className="mt-1.5 flex items-center gap-1 whitespace-nowrap text-[11.5px] font-semibold text-amber-600 dark:text-amber-500 tabular-nums">
      <Clock size={12} className="animate-pulse" /> {elapsed}
    </div>
  );
}

function numberToWords(num: number): string {
  if (num === 0) return 'INR Zero Only';
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

const sendEstimateWhatsApp = (o: OrderWithCustomer) => {
  const phone = o.customer?.phone ? o.customer.phone.replace(/[^0-9]/g, '') : '';
  const dateStr = new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  
  let totalAmount = 0;
  const itemLines = (o.items || []).map((it) => {
    const prName = it.product?.name ?? 'Item';
    const price = it.product?.price ?? 0;
    const subtotal = price * (it.quantity || 1);
    totalAmount += subtotal;
    return `• *${prName}*\n  Nos/Qty: ${it.quantity} ${it.unit ?? it.product?.unit ?? ''}\n  Rate: ₹${price}\n  Amount: ₹${subtotal.toLocaleString('en-IN')}`;
  }).join('\n\n');

  const words = numberToWords(totalAmount);

  const text = 
`🧾 *ANBU GROUPS — ESTIMATE*
No.4/5 Pondy Mailam Road, T.C.Kootroad, Vanur T.K 605 111
Ph: 0413-2964204, 9626325204
─────────────────────────────
*Estimate No:* ${o.order_no || o.id.substring(0, 8).toUpperCase()}
*Date:* ${dateStr}

*Buyer (Bill to):* ${o.customer?.name ?? 'Customer'}
*Address:* ${o.delivery_address ?? '—'}
*Phone:* ${o.customer?.phone ?? '—'}
─────────────────────────────
*ITEMS:*

${itemLines}

─────────────────────────────
*Total Amount:* ₹${totalAmount.toLocaleString('en-IN')}
*Amount in words:* ${words}
─────────────────────────────
_We declare that this invoice/estimate shows the actual price of the goods described and that all particulars are true and correct._

*for ANBU GROUPS*
_Authorised Signatory_`;

  const url = `https://wa.me/${phone ? (phone.length === 10 ? '91' + phone : phone) : ''}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
};

export default function Orders({ onNewOrder, onEditOrder }: { onNewOrder?: () => void; onEditOrder?: (o: OrderWithCustomer) => void } = {}) {
  const toast = useToast();
  const [orders, setOrders] = useState<OrderWithCustomer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [detailOrder, setDetailOrder] = useState<OrderWithCustomer | null>(null);
  const [detailItems, setDetailItems] = useState<OrderItemWithProduct[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'confirmed'>('pending');

  const [customerMode, setCustomerMode] = useState<'search' | 'new'>('search');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [lines, setLines] = useState<Line[]>([]);

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
      toast('Failed to load estimates', 'error');
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
    o.status === activeTab &&
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
    if (onNewOrder) {
      onNewOrder();
      return;
    }
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
    if (onEditOrder) {
      onEditOrder(o);
      return;
    }
    setEditing(o);
    setDeliveryAddress(o.delivery_address ?? '');
    setNotes(o.notes ?? '');
    const data = o.items || [];
    setLines(data.map((x: any) => ({ product_id: x.product_id, quantity: x.quantity, unit: x.unit ?? products.find(p => p.id === x.product_id)?.unit ?? 'piece' })));
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
    setLines([...lines, { product_id: pid, quantity: 1, unit: products.find(p => p.id === pid)?.unit ?? 'piece' }]);
  };

  const updateQty = (pid: string, delta: number) => {
    setLines(lines.map((l) => (l.product_id === pid ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l)));
  };

  const setQty = (pid: string, qty: number) => {
    setLines(lines.map((l) => (l.product_id === pid ? { ...l, quantity: Math.max(1, qty) } : l)));
  };

  const removeLine = (pid: string) => setLines(lines.filter((l) => l.product_id !== pid));

  const setUnit = (pid: string, unit: string) => {
    setLines(lines.map((l) => (l.product_id === pid ? { ...l, unit } : l)));
  };

  const resolveCustomer = async (): Promise<string | null> => {
    if (editing && selectedCustomer) return selectedCustomer.id;
    if (customerMode === 'search') {
      if (!selectedCustomer) {
        toast('Please select a customer from search results', 'error');
        return null;
      }
      return selectedCustomer.id;
    }
    if (!newName.trim() || !newPhone.trim() || !newAddress.trim()) {
      toast('Name, phone, and address are all required for new customer', 'error');
      return null;
    }
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

    for (const line of lines) {
      const product = products.find(p => p.id === line.product_id);
      if (product) {
        const originalLine = editing?.items?.find(i => i.product_id === line.product_id);
        const originalQty = originalLine ? Number(originalLine.quantity) : 0;
        const availableStock = Number(product.stock_qty) + originalQty;
        
        if (line.quantity > availableStock) {
          toast(`Quantity for ${product.name} exceeds available stock (${availableStock})`, 'error');
          return;
        }
      }
    }

    setSaving(true);
    try {
      const addr = deliveryAddress.trim() || (customerMode === 'new' ? newAddress.trim() : selectedCustomer?.address ?? '') || null;
      const payload = {
        customer_id: custId,
        delivery_address: addr,
        notes: notes.trim() || null,
        status: 'pending',
        items: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity, unit: l.unit }))
      };
      if (editing) {
        await api.put(`/orders/${editing.id}`, payload);
        toast('Estimate updated', 'success');
      } else {
        await api.post('/orders', payload);
        toast('Estimate created', 'success');
      }
      setOpen(false);
      load();
    } catch (err: any) {
      const msg = err?.message || 'Failed to save estimate';
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
        items: o.items?.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit: i.unit })) || []
      });
      toast('Estimate confirmed', 'success');
      load();
    } catch (e) {
      toast('Failed to confirm estimate', 'error');
    }
  };

  const remove = async (o: OrderWithCustomer) => {
    if (!confirm('Delete this estimate and its items?')) return;
    try {
      await api.delete(`/orders/${o.id}`);
      toast('Estimate deleted', 'success');
      load();
    } catch (e) {
      toast('Failed to delete estimate', 'error');
    }
  };

  const openDetail = async (o: OrderWithCustomer) => {
    setDetailOrder(o);
    setDetailItems((o.items ?? []) as OrderItemWithProduct[]);
  };

  const productName = (pid: string) => products.find((p) => p.id === pid)?.name ?? 'Unknown';


  const brandedProducts = products.filter((p) => p.brand && p.brand.trim() !== '');
  const unbrandedProducts = products.filter((p) => !p.brand || p.brand.trim() === '');
  const allBrands = Array.from(new Set(brandedProducts.map((p) => p.brand!).filter(Boolean))).sort();
  const sizesForBrand = (brand: string) =>
    brandedProducts.filter((p) => p.brand === brand).sort((a, b) =>
      (a.size ?? '').localeCompare(b.size ?? '', undefined, { numeric: true })
    );
  const brandsWithSizes = allBrands.filter((b) => sizesForBrand(b).some((p) => p.size && p.size.trim() !== '' && p.size.toLowerCase() !== 'n/a'));
  const brandsWithoutSizes = allBrands.filter((b) => !brandsWithSizes.includes(b));
  const selectedProduct = sizesForBrand(selBrand).find((p) => p.size === selSize);
  const noSizeBrandProduct = (brand: string) => sizesForBrand(brand)[0] ?? null;



  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Estimates</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Create estimates with new or existing customers</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus size={16} /> New Estimate
        </button>
      </div>

      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700">
        <button 
          className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'pending' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending
        </button>
        <button 
          className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'confirmed' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
          onClick={() => setActiveTab('confirmed')}
        >
          Completed
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
          <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500">No estimates found.</p>
          <button onClick={openNew} className="btn-primary">
            <Plus size={16} /> Create your first estimate
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead className="border-b border-white/20 dark:border-slate-700/50 bg-white/20 dark:bg-slate-800/30">
              <tr>
                <th className="th">Estimate No</th>
                <th className="th">Customer</th>
                <th className="th">Status</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-white/20 dark:bg-slate-800/30">
                  <td className="td font-mono font-medium text-slate-800 dark:text-slate-200">
                    <button onClick={() => openDetail(o)} className="hover:underline">
                      {o.order_no || o.id.split('-')[0].toUpperCase()}
                    </button>
                  </td>
                  <td className="td">
                    <div className="font-medium text-indigo-700 dark:text-indigo-300">
                      {o.customer?.name ?? 'Unknown'}
                    </div>
                  </td>
                  <td className="td">
                    {o.status === 'confirmed' ? (
                      <span className="badge bg-emerald-100/50 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300">Completed</span>
                    ) : (
                      <div>
                        <span className="badge bg-white/20 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200">Pending</span>
                        <WaitClock timestamp={o.created_at} />
                      </div>
                    )}
                  </td>
                  <td className="td text-right">
                    <div className="flex justify-end gap-1 items-center">
                      <button
                        onClick={() => sendEstimateWhatsApp(o)}
                        className="btn-ghost p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50/50 dark:bg-emerald-900/30 flex items-center gap-1 text-xs font-semibold"
                        title="Send Estimate via WhatsApp"
                      >
                        <Phone size={14} /> Send
                      </button>
                      {o.status === 'pending' && (
                        <button
                          onClick={() => confirmOrder(o)}
                          className="btn-ghost p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50/50 dark:bg-emerald-900/30"
                          title="Confirm estimate"
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Estimate' : 'New Estimate'} size="lg">
        <div className="space-y-4">
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
                              {p.size}
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
                          {b}
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
                        {p.name}
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
                  return (
                    <div key={l.product_id} className="flex items-center gap-3 rounded-lg border border-white/20 dark:border-slate-700/50 p-3">
                      <div className="flex-1">
                        <p className="font-medium text-slate-700 dark:text-slate-200">{productName(l.product_id)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                          {p?.brand && p.brand} {p?.size && `· ${p.size}`}
                        </p>
                      </div>
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
                        <input
                          type="text"
                          value={l.unit}
                          onChange={(e) => setUnit(l.product_id, e.target.value)}
                          className="w-16 rounded border border-white/30 dark:border-slate-600/50 px-2 py-1 text-center text-sm"
                          placeholder="Unit"
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
              {saving ? 'Saving...' : 'Save Estimate'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detailOrder} onClose={() => setDetailOrder(null)} title="Estimate Details" size="md">
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
                  <span className="badge bg-emerald-100/50 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300">Completed</span>
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
                {detailItems.length === 0 && <p className="text-sm text-slate-400">No items.</p>}
                {detailItems.map((it) => (
                  <div key={it.id} className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{it.product?.name ?? 'Unknown'}</span>
                    <span className="text-sm text-slate-500">Qty: {it.quantity} {it.unit ?? it.product?.unit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-2 flex justify-between items-center">
              <button
                onClick={() => sendEstimateWhatsApp(detailOrder)}
                className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
              >
                <Phone size={16} /> Send Estimate via WhatsApp
              </button>
              <button onClick={() => setDetailOrder(null)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
