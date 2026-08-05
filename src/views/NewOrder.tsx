import { useCallback, useEffect, useState } from 'react';
import { api, type Customer, type Product, type Order } from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  ArrowLeft, Search, Plus, Trash2, CheckCircle2, User, Phone, MapPin, 
  Minus, Plus as PlusIcon, ShoppingBag, MessageCircle, FileText
} from 'lucide-react';

type Line = { product_id: string; quantity: number; unit: string; product: Product };

type NewOrderProps = {
  onBack: () => void;
  orderToEdit?: Order | null;
};

export default function NewOrder({ onBack, orderToEdit }: NewOrderProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [nextOrderId, setNextOrderId] = useState<string>('Loading...');

  // Customer Selection
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerSearchFocused, setIsCustomerSearchFocused] = useState(false);
  
  // Address
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [useCustomerAddress, setUseCustomerAddress] = useState(false);
  
  // Products Section
  const [brandSearch, setBrandSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [itemQty, setItemQty] = useState<number>(1);
  const [itemUnit, setItemUnit] = useState<string>('piece');
  
  const [lines, setLines] = useState<Line[]>([]);
  
  // Notes
  const [notes, setNotes] = useState('');
  
  // Draft Status
  const [draftStatus, setDraftStatus] = useState<'Saved' | 'Saving...' | 'Unsaved'>('Unsaved');
  
  // Effects
  useEffect(() => {
    loadData();
    if (!orderToEdit) {
      fetchNextId();
    } else {
      setNextOrderId(orderToEdit.order_no || 'Unknown');
      setDeliveryAddress(orderToEdit.delivery_address || '');
      setNotes(orderToEdit.notes || '');
    }
  }, [orderToEdit]);

  const loadData = async () => {
    try {
      const [p, c] = await Promise.all([
        api.get('/products'),
        api.get('/customers')
      ]);
      setProducts(p as Product[]);
      setCustomers(c as Customer[]);
      
      if (orderToEdit) {
        if (orderToEdit.customer_id) {
          const cust = (c as Customer[]).find(x => x.id === orderToEdit.customer_id);
          if (cust) setSelectedCustomer(cust);
        }
        if ((orderToEdit as any).items) {
          const mappedLines = (orderToEdit as any).items.map((item: any) => {
            const prod = (p as Product[]).find(x => x.id === item.product_id);
            return prod ? { product_id: item.product_id, quantity: item.quantity, unit: item.unit || prod.unit, product: prod } : null;
          }).filter(Boolean);
          setLines(mappedLines);
        }
      }
    } catch (e) {
      toast('Failed to load initial data', 'error');
    }
  };

  const fetchNextId = async () => {
    try {
      const res = await api.get('/orders/next-id');
      setNextOrderId(res.next_id);
    } catch (e) {
      setNextOrderId('Draft');
    }
  };
  
  useEffect(() => {
    if (lines.length > 0 || selectedCustomer || deliveryAddress || notes) {
      setDraftStatus('Saving...');
      const t = setTimeout(() => setDraftStatus('Saved'), 800);
      return () => clearTimeout(t);
    }
  }, [lines, selectedCustomer, deliveryAddress, notes]);

  // Handlers
  const handleUseCustomerAddress = (checked: boolean) => {
    setUseCustomerAddress(checked);
    if (checked && selectedCustomer?.address) {
      setDeliveryAddress(selectedCustomer.address);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    (c.phone && c.phone.includes(customerSearch))
  ).slice(0, 5);
  
  const brands = Array.from(new Set(products.map(p => p.brand).filter(Boolean))) as string[];
  const filteredProducts = products.filter(p => 
    (!selectedBrand || p.brand === selectedBrand) &&
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 10);

  const handleAddItem = () => {
    if (!selectedProduct) return;
    if (lines.some(l => l.product_id === selectedProduct.id)) {
      toast('Product already added', 'info');
      return;
    }
    setLines([...lines, { 
      product_id: selectedProduct.id, 
      quantity: itemQty, 
      unit: itemUnit || selectedProduct.unit || 'piece',
      product: selectedProduct 
    }]);
    setSelectedProduct(null);
    setProductSearch('');
    setItemQty(1);
  };
  
  const updateLineQty = (pid: string, delta: number) => {
    setLines(lines.map(l => l.product_id === pid ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l));
  };
  
  const removeLine = (pid: string) => {
    setLines(lines.filter(l => l.product_id !== pid));
  };

  // WhatsApp Integration
  const generateWhatsAppMessage = () => {
    let msg = `*Estimate from Anbu Traders*\n`;
    msg += `Order ID: ${nextOrderId}\n`;
    if (selectedCustomer) {
      msg += `Customer: ${selectedCustomer.name}\n`;
    }
    msg += `--------------------------\n`;
    lines.forEach((l, idx) => {
      msg += `${idx + 1}. ${l.product.name}\n`;
      msg += `   ${l.quantity} x ₹${l.product.price} = ₹${(l.quantity * Number(l.product.price)).toLocaleString()}\n`;
    });
    msg += `--------------------------\n`;
    msg += `Total Items: ${lines.length}\n`;
    const estimatedWeight = lines.reduce((acc, l) => acc + (l.quantity * Number(l.product.standard_weight || 0)), 0);
    msg += `Estimated Weight: ${estimatedWeight} kg\n`;
    const subtotal = lines.reduce((acc, l) => acc + (l.quantity * Number(l.product.price || 0)), 0);
    const gst = subtotal * 0.18; 
    msg += `*Grand Total: ₹${(subtotal + gst).toLocaleString()}*\n`;
    
    if (notes) {
      msg += `\nNotes: ${notes}\n`;
    }
    return encodeURIComponent(msg);
  };

  const handleWhatsApp = () => {
    if (!selectedCustomer) {
      toast('Please select a customer first', 'error');
      return;
    }
    if (lines.length === 0) {
      toast('Please add items to send an estimate', 'error');
      return;
    }
    const phone = selectedCustomer.phone?.replace(/\D/g, '') || '';
    if (!phone) {
      toast('Customer has no phone number, opening WhatsApp without recipient', 'info');
      window.open(`https://wa.me/?text=${generateWhatsAppMessage()}`, '_blank');
      return;
    }
    const finalPhone = phone.length === 10 ? `91${phone}` : phone;
    window.open(`https://wa.me/${finalPhone}?text=${generateWhatsAppMessage()}`, '_blank');
  };

  const handleSaveOrder = async () => {
    if (!selectedCustomer) {
      toast('Please select a customer', 'error');
      return;
    }
    if (lines.length === 0) {
      toast('Please add at least one product', 'error');
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        customer_id: selectedCustomer.id,
        delivery_address: deliveryAddress,
        notes,
        items: lines.map(l => ({ product_id: l.product_id, quantity: l.quantity, unit: l.unit }))
      };
      
      if (orderToEdit) {
        await api.put(`/orders/${orderToEdit.id}`, payload);
        toast('Order updated successfully', 'success');
      } else {
        await api.post('/orders', payload);
        toast('Order created successfully', 'success');
      }
      onBack();
    } catch (e: any) {
      toast(e.message || 'Failed to save order', 'error');
    }
    setSaving(false);
  };

  // Calculations
  const totalItems = lines.length;
  const totalQty = lines.reduce((acc, l) => acc + l.quantity, 0);
  const estimatedWeight = lines.reduce((acc, l) => acc + (l.quantity * Number(l.product.standard_weight || 0)), 0);
  const subtotal = lines.reduce((acc, l) => acc + (l.quantity * Number(l.product.price || 0)), 0);
  const gst = subtotal * 0.18; 
  const grandTotal = subtotal + gst;

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-slate-800 pb-32">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-sm">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{orderToEdit ? 'Edit Order' : 'Create Order'}</h1>
              <div className="flex items-center gap-2 mt-0.5 text-xs font-medium text-slate-500">
                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono border border-slate-200">{nextOrderId}</span>
                <span>•</span>
                <span className={draftStatus === 'Saved' ? 'text-emerald-600' : 'text-amber-500'}>{draftStatus}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-100">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div> Online
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          
          {/* Left Column (Forms) */}
          <div className="flex-1 space-y-6">
            
            {/* Customer Section */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <User size={18} className="text-blue-600" /> Customer Information
                </h2>
              </div>
              <div className="p-5">
                {selectedCustomer ? (
                  <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50/30 p-4">
                    <div>
                      <p className="font-semibold text-slate-900 text-lg">{selectedCustomer.name}</p>
                      <p className="flex items-center gap-1.5 text-sm text-slate-600 mt-1">
                        <Phone size={14} className="text-slate-400" /> {selectedCustomer.phone || 'No phone'}
                      </p>
                    </div>
                    <button onClick={() => setSelectedCustomer(null)} className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 shadow-sm hover:bg-blue-50 transition">Change</button>
                  </div>
                ) : (
                  <div className="relative">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Search Customer</label>
                    <div className="relative">
                      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        placeholder="Type name or phone number..."
                        value={customerSearch}
                        onChange={e => setCustomerSearch(e.target.value)}
                        onFocus={() => setIsCustomerSearchFocused(true)}
                        onBlur={() => setTimeout(() => setIsCustomerSearchFocused(false), 200)}
                      />
                    </div>
                    {isCustomerSearchFocused && customerSearch && filteredCustomers.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
                        {filteredCustomers.map(c => (
                          <button
                            key={c.id}
                            className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-50"
                            onClick={() => setSelectedCustomer(c)}
                          >
                            <div>
                              <p className="font-semibold text-slate-900">{c.name}</p>
                              <p className="text-sm text-slate-500">{c.phone}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Address Section */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <MapPin size={18} className="text-blue-600" /> Delivery Address
                </h2>
                {selectedCustomer?.address && (
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900 transition">
                    <input 
                      type="checkbox" 
                      checked={useCustomerAddress} 
                      onChange={e => handleUseCustomerAddress(e.target.checked)} 
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                    />
                    Same as customer address
                  </label>
                )}
              </div>
              <div className="p-5">
                <textarea
                  value={deliveryAddress}
                  onChange={e => {
                    setDeliveryAddress(e.target.value);
                    setUseCustomerAddress(false);
                  }}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-300 p-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  placeholder="Enter full delivery address, plot number, street..."
                />
              </div>
            </div>

            {/* Products Section */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <ShoppingBag size={18} className="text-blue-600" /> Order Items
                </h2>
              </div>
              
              <div className="p-5 border-b border-slate-100 bg-slate-50/30">
                <div className="grid gap-4 md:grid-cols-12">
                  <div className="md:col-span-3">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Brand</label>
                    <select
                      className="w-full rounded-lg border border-slate-300 p-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 bg-white"
                      value={selectedBrand}
                      onChange={e => setSelectedBrand(e.target.value)}
                    >
                      <option value="">All Brands</option>
                      {brands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-6 relative">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Search Product</label>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        placeholder="Type product name..."
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                      />
                    </div>
                    {productSearch && !selectedProduct && filteredProducts.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden">
                        {filteredProducts.map(p => (
                          <button
                            key={p.id}
                            className="flex w-full flex-col px-4 py-2.5 text-left transition hover:bg-slate-50"
                            onClick={() => {
                              setSelectedProduct(p);
                              setProductSearch(p.name);
                              setItemUnit(p.unit);
                            }}
                          >
                            <span className="font-medium text-slate-900">{p.name}</span>
                            <span className="text-xs text-slate-500">{p.brand} • ₹{p.price}/{p.unit}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-3 flex gap-2">
                    <div className="flex-1">
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Qty</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full rounded-lg border border-slate-300 p-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        value={itemQty}
                        onChange={e => setItemQty(Number(e.target.value))}
                      />
                    </div>
                    <div className="flex items-end">
                      <button 
                        onClick={handleAddItem}
                        disabled={!selectedProduct}
                        className="rounded-lg bg-blue-600 p-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:bg-slate-300 shadow-sm"
                        title="Add Product"
                      >
                        <PlusIcon size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Added Lines */}
              <div className="p-0">
                {lines.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">
                    <ShoppingBag size={32} className="mx-auto mb-3 text-slate-200" />
                    No products added yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {lines.map((line, idx) => (
                      <div key={`${line.product_id}-${idx}`} className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 transition hover:bg-slate-50/50">
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{line.product.name}</p>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-slate-500">
                            <span>₹{line.product.price} / {line.product.unit}</span>
                            <span className="text-slate-300">|</span>
                            <span>{line.product.standard_weight} kg</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-sm">
                            <button onClick={() => updateLineQty(line.product_id, -1)} className="rounded-l-lg p-2 hover:bg-slate-100 text-slate-600 transition"><Minus size={14} /></button>
                            <span className="w-12 text-center font-semibold text-slate-900">{line.quantity}</span>
                            <button onClick={() => updateLineQty(line.product_id, 1)} className="rounded-r-lg p-2 hover:bg-slate-100 text-slate-600 transition"><Plus size={14} /></button>
                          </div>
                          <div className="w-24 text-right">
                            <p className="font-bold text-slate-900 text-lg">₹{(line.quantity * Number(line.product.price)).toLocaleString()}</p>
                          </div>
                          <button onClick={() => removeLine(line.product_id)} className="text-slate-400 hover:text-red-600 transition p-2 hover:bg-red-50 rounded-lg">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Notes Section */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <FileText size={18} className="text-blue-600" /> Additional Notes
                </h2>
              </div>
              <div className="p-5">
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-300 p-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  placeholder="Special instructions for delivery or payment..."
                />
              </div>
            </div>
          </div>

          {/* Right Column (Summary) */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="sticky top-24 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">Order Summary</h2>
              
              <div className="space-y-4 text-sm font-medium text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Items</span>
                  <span className="text-slate-900">{totalItems}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Quantity</span>
                  <span className="text-slate-900">{totalQty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Weight</span>
                  <span className="text-slate-900">{estimatedWeight} kg</span>
                </div>
              </div>
              
              <div className="my-5 border-t border-slate-100"></div>
              
              <div className="space-y-4 text-sm font-medium text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-900">₹{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Estimated GST (18%)</span>
                  <span className="text-slate-900">₹{gst.toLocaleString()}</span>
                </div>
              </div>
              
              <div className="my-5 border-t border-slate-200 border-dashed"></div>
              
              <div className="flex justify-between items-center text-slate-900">
                <span className="text-base font-bold">Grand Total</span>
                <span className="text-2xl font-black text-blue-600 tracking-tight">₹{grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
          
        </div>
      </main>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.08)]">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          
          <div className="hidden lg:flex flex-col">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Order Total</p>
            <p className="text-xl font-bold text-slate-900">₹{grandTotal.toLocaleString()}</p>
          </div>

          <div className="flex w-full lg:w-auto items-center justify-between lg:hidden">
             <div className="text-sm font-medium text-slate-600">
               <span className="font-bold text-slate-900">{totalItems} items</span>
             </div>
             <div className="text-lg font-bold text-blue-600">₹{grandTotal.toLocaleString()}</div>
          </div>

          <div className="flex w-full sm:w-auto items-center gap-3">
            <button 
              onClick={handleWhatsApp}
              disabled={!selectedCustomer || lines.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#25D366]/20 bg-[#25D366]/10 px-5 py-3 font-semibold text-[#128C7E] transition hover:bg-[#25D366]/20 disabled:opacity-50 sm:w-auto"
            >
              <MessageCircle size={20} />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
            <button 
              onClick={handleSaveOrder}
              disabled={saving || !selectedCustomer || lines.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-3 font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
            >
              {saving ? 'Saving...' : 'Confirm Order'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
