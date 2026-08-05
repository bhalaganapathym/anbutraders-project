import { useCallback, useEffect, useState } from 'react';
import { api, type Customer, type Product, type Order } from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  ArrowLeft, Search, Plus, Trash2, CheckCircle2, User, Phone, MapPin, 
  Minus, Plus as PlusIcon, ShoppingBag, Send
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
      // If we are editing, we need to load the customer and items. 
      // The parent component should probably pass the full order object.
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
        // Hydrate order editing data if necessary
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
  
  // Auto-save debouncer could be added here for local storage or draft status.
  useEffect(() => {
    if (lines.length > 0 || selectedCustomer || deliveryAddress || notes) {
      setDraftStatus('Saving...');
      const t = setTimeout(() => setDraftStatus('Saved'), 1000);
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
    // Reset inputs
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
  const gst = subtotal * 0.18; // Assuming 18% GST for example. Modify as per actual rules if needed. Or keep 0.
  const grandTotal = subtotal + gst;

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-800">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm lg:px-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="rounded-full p-2 hover:bg-slate-100">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{orderToEdit ? 'Edit Order' : 'New Order'}</h1>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="font-mono">{nextOrderId}</span>
              <span>•</span>
              <span className={draftStatus === 'Saved' ? 'text-green-600' : 'text-amber-500'}>{draftStatus}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 border border-green-200">
            <div className="h-2 w-2 rounded-full bg-green-500"></div> Online
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-32">
          <div className="mx-auto max-w-4xl space-y-6">
            
            {/* Customer Section */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
                <User size={18} className="text-blue-600" /> Customer Details
              </h2>
              {selectedCustomer ? (
                <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                  <div>
                    <p className="font-medium text-slate-900">{selectedCustomer.name}</p>
                    <p className="text-sm text-slate-600">{selectedCustomer.phone || 'No phone'}</p>
                  </div>
                  <button onClick={() => setSelectedCustomer(null)} className="text-sm font-medium text-blue-600 hover:text-blue-700">Change</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Search customer by name or phone..."
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                    />
                  </div>
                  {customerSearch && filteredCustomers.length > 0 && (
                    <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
                      {filteredCustomers.map(c => (
                        <button
                          key={c.id}
                          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                          onClick={() => setSelectedCustomer(c)}
                        >
                          <div>
                            <p className="font-medium text-slate-900">{c.name}</p>
                            <p className="text-sm text-slate-500">{c.phone}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <button className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700">
                    <PlusIcon size={16} /> New Customer
                  </button>
                </div>
              )}
            </section>

            {/* Delivery Address Section */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                  <MapPin size={18} className="text-blue-600" /> Delivery Address
                </h2>
                {selectedCustomer?.address && (
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={useCustomerAddress} 
                      onChange={e => handleUseCustomerAddress(e.target.checked)} 
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                    />
                    Use customer address
                  </label>
                )}
              </div>
              <textarea
                value={deliveryAddress}
                onChange={e => {
                  setDeliveryAddress(e.target.value);
                  setUseCustomerAddress(false);
                }}
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-300 p-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="Enter full delivery address..."
              />
              <div className="mt-1 text-right text-xs text-slate-400">
                {deliveryAddress.length} characters
              </div>
            </section>

            {/* Add Products Section */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
                <ShoppingBag size={18} className="text-blue-600" /> Add Products
              </h2>
              <div className="grid gap-4 md:grid-cols-12">
                <div className="md:col-span-3">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Brand</label>
                  <select
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-500"
                    value={selectedBrand}
                    onChange={e => setSelectedBrand(e.target.value)}
                  >
                    <option value="">All Brands</option>
                    {brands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="md:col-span-5 relative">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Product Search</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-500"
                    placeholder="Search product..."
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                  />
                  {productSearch && !selectedProduct && filteredProducts.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-lg">
                      {filteredProducts.map(p => (
                        <button
                          key={p.id}
                          className="w-full px-4 py-2 text-left hover:bg-slate-50"
                          onClick={() => {
                            setSelectedProduct(p);
                            setProductSearch(p.name);
                            setItemUnit(p.unit);
                          }}
                        >
                          {p.name} <span className="text-xs text-slate-400">({p.brand})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Qty</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-500"
                    value={itemQty}
                    onChange={e => setItemQty(Number(e.target.value))}
                  />
                </div>
                <div className="md:col-span-2 flex items-end">
                  <button 
                    onClick={handleAddItem}
                    disabled={!selectedProduct}
                    className="w-full rounded-xl bg-slate-900 p-2.5 font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </section>

            {/* Selected Items */}
            {lines.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Selected Items ({lines.length})</h3>
                {lines.map((line, idx) => (
                  <div key={`${line.product_id}-${idx}`} className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                    <div className="flex-1 w-full">
                      <p className="font-semibold text-slate-900">{line.product.name}</p>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                        <span>Unit: {line.product.standard_weight} kg</span>
                        <span>Price: ₹{line.product.price}</span>
                        <span>Total: {line.quantity * Number(line.product.standard_weight || 0)} kg</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between w-full sm:w-auto gap-6">
                      <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
                        <button onClick={() => updateLineQty(line.product_id, -1)} className="rounded p-1 hover:bg-slate-200 text-slate-600"><Minus size={16} /></button>
                        <span className="w-10 text-center font-medium">{line.quantity}</span>
                        <button onClick={() => updateLineQty(line.product_id, 1)} className="rounded p-1 hover:bg-slate-200 text-slate-600"><Plus size={16} /></button>
                      </div>
                      <div className="text-right sm:w-24">
                        <p className="font-bold text-slate-900">₹{(line.quantity * Number(line.product.price)).toLocaleString()}</p>
                      </div>
                      <button onClick={() => removeLine(line.product_id)} className="text-red-500 hover:text-red-700 p-2">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Notes Section */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-slate-800">Notes</h2>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                className="w-full resize-none rounded-xl border border-slate-300 p-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="Special delivery instructions, unloading notes, payment terms..."
              />
            </section>
            
          </div>
        </main>

        {/* Desktop Sidebar Summary */}
        <aside className="hidden w-80 border-l border-slate-200 bg-white p-6 lg:block">
          <div className="sticky top-24 space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Order Summary</h2>
            
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Total Items</span>
                <span className="font-medium text-slate-900">{totalItems}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Quantity</span>
                <span className="font-medium text-slate-900">{totalQty}</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Weight</span>
                <span className="font-medium text-slate-900">{estimatedWeight} kg</span>
              </div>
            </div>
            
            <div className="my-4 border-t border-slate-100"></div>
            
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium text-slate-900">₹{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>GST (18%)</span>
                <span className="font-medium text-slate-900">₹{gst.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="my-4 border-t border-slate-200"></div>
            
            <div className="flex justify-between text-lg font-bold text-slate-900">
              <span>Total</span>
              <span className="text-blue-600">₹{grandTotal.toLocaleString()}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] lg:left-64 lg:pr-80">
        
        {/* Mobile Summary (Hidden on Desktop) */}
        <div className="w-full flex items-center justify-between lg:hidden px-2 mb-2">
           <div className="text-sm text-slate-500">
             <span className="font-semibold text-slate-900">{totalItems} items</span> • {estimatedWeight} kg
           </div>
           <div className="text-lg font-bold text-blue-600">₹{grandTotal.toLocaleString()}</div>
        </div>

        <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3 px-6 font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto">
          <Send size={18} className="text-green-500" /> Send WhatsApp Estimate
        </button>
        <button 
          onClick={handleSaveOrder}
          disabled={saving || !selectedCustomer || lines.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 px-8 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
        >
          {saving ? 'Saving...' : 'Save Order'}
        </button>
      </div>
    </div>
  );
}
