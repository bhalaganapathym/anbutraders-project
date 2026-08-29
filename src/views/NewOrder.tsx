import { useCallback, useEffect, useState } from 'react';
import { api, type Customer, type Product, type Order } from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  ArrowLeft, Search, Plus, Trash2, CheckCircle2, User, Phone, MapPin, 
  Minus, Plus as PlusIcon, ShoppingBag, MessageCircle, FileText, Mic, MicOff, Zap,
  Calendar, DollarSign, Clock, Sparkles, Navigation
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { calculateProductPrice } from '@/lib/pricing';

type Line = { product_id: string; quantity: number; unit: string; product: Product };

type NewOrderProps = {
  onBack: () => void;
  orderToEdit?: Order | null;
};

export default function NewOrder({ onBack, orderToEdit }: NewOrderProps) {
  const { t } = useTranslation();
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
  
  // New Customer State
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  
  // Address
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [useCustomerAddress, setUseCustomerAddress] = useState(false);
  
  // Product Search / Brand Filter
  const [selectedBrand, setSelectedBrand] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [itemQty, setItemQty] = useState(1);
  const [itemUnit, setItemUnit] = useState('nos');
  const [targetWeightInput, setTargetWeightInput] = useState('');

  // Advance Order State
  const getTomorrowDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const [isAdvanceOrder, setIsAdvanceOrder] = useState<boolean>(orderToEdit?.is_advance_order || false);
  const [scheduledDeliveryDate, setScheduledDeliveryDate] = useState<string>(
    orderToEdit?.scheduled_delivery_date ? orderToEdit.scheduled_delivery_date.split('T')[0] : getTomorrowDateStr()
  );
  const [advancePaidAmount, setAdvancePaidAmount] = useState<string>(
    orderToEdit?.advance_paid_amount ? String(orderToEdit.advance_paid_amount) : ''
  );
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<string>(
    orderToEdit?.advance_payment_method || 'cash'
  );
  const [advanceNotes, setAdvanceNotes] = useState<string>(
    orderToEdit?.advance_notes || ''
  );
  
  // Order Items
  const [lines, setLines] = useState<Line[]>([]);
  const [draftStatus, setDraftStatus] = useState<'Saved' | 'Saving...'>('Saved');

  // Load Initial Data
  useEffect(() => {
    loadData();
    fetchNextId();
  }, []);

  const loadData = async () => {
    try {
      const [c, p] = await Promise.all([
        api.get('/customers'),
        api.get('/products')
      ]);
      setCustomers(c as Customer[]);
      setProducts(p as Product[]);
      
      if (orderToEdit) {
        if (orderToEdit.customer_id) {
          const cust = (c as Customer[]).find(x => x.id === orderToEdit.customer_id);
          if (cust) setSelectedCustomer(cust);
        }
        if (orderToEdit.delivery_address) {
          setDeliveryAddress(orderToEdit.delivery_address);
        }
        if (orderToEdit.is_advance_order) {
          setIsAdvanceOrder(true);
          if (orderToEdit.scheduled_delivery_date) {
            setScheduledDeliveryDate(orderToEdit.scheduled_delivery_date.split('T')[0]);
          }
          if (orderToEdit.advance_paid_amount) {
            setAdvancePaidAmount(String(orderToEdit.advance_paid_amount));
          }
          if (orderToEdit.advance_payment_method) {
            setAdvancePaymentMethod(orderToEdit.advance_payment_method);
          }
          if (orderToEdit.advance_notes) {
            setAdvanceNotes(orderToEdit.advance_notes);
          }
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
    if (lines.length > 0 || selectedCustomer || deliveryAddress) {
      setDraftStatus('Saving...');
      const t = setTimeout(() => setDraftStatus('Saved'), 800);
      return () => clearTimeout(t);
    }
  }, [lines, selectedCustomer, deliveryAddress]);

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

  const handleSelectProduct = (p: Product) => {
    setSelectedProduct(p);
    setProductSearch(p.name);
    setItemUnit(p.unit || 'nos');
    setItemQty(1);
    const stdWeight = Number(p.standard_weight || 0);
    if (stdWeight > 0) {
      setTargetWeightInput(String(stdWeight));
    } else {
      setTargetWeightInput('');
    }
  };

  const handleQtyChange = (val: number) => {
    const qty = Math.max(1, val);
    setItemQty(qty);
    const stdWeight = Number(selectedProduct?.standard_weight || 0);
    if (stdWeight > 0) {
      setTargetWeightInput((qty * stdWeight).toFixed(2));
    }
  };

  const handleTargetWeightChange = (wtVal: string) => {
    setTargetWeightInput(wtVal);
    const stdWeight = Number(selectedProduct?.standard_weight || 0);
    const targetWt = parseFloat(wtVal);
    if (stdWeight > 0 && !isNaN(targetWt) && targetWt > 0) {
      const calculatedNos = Math.max(1, Math.round(targetWt / stdWeight));
      setItemQty(calculatedNos);
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct) return;
    if (lines.some(l => l.product_id === selectedProduct.id)) {
      toast('Product already added', 'info');
      return;
    }
    setLines([...lines, { 
      product_id: selectedProduct.id, 
      quantity: itemQty, 
      unit: itemUnit || selectedProduct.unit || 'nos',
      product: selectedProduct 
    }]);
    setSelectedProduct(null);
    setProductSearch('');
    setItemQty(1);
    setTargetWeightInput('');
  };

  const [quickText, setQuickText] = useState('');
  const [isListening, setIsListening] = useState(false);

  const handleQuickAdd = (input: string) => {
    const raw = input.trim();
    if (!raw) return;

    const isKgQuery = /\b(kg|kgs|kilo|kilos|kilogram|kilograms)\b/i.test(raw);
    const numberMatch = raw.match(/\b(\d+(\.\d+)?)\b/);
    const numValue = numberMatch ? parseFloat(numberMatch[1]) : 1;
    const textQuery = raw.replace(/\b\d+(\.\d+)?\b/g, '').replace(/\b(kg|kgs|kilo|kilos|kilogram|kilograms|nos|rods|units|pieces)\b/gi, '').trim().toLowerCase();

    const words = textQuery.split(/\s+/).filter(w => w.length > 1);

    const matched = products.find(p => {
      const pFull = `${p.brand || ''} ${p.name || ''} ${p.size || ''}`.toLowerCase();
      return words.every(w => pFull.includes(w));
    }) || products.find(p => {
      const pFull = `${p.brand || ''} ${p.name || ''}`.toLowerCase();
      return words.some(w => pFull.includes(w));
    });

    if (matched) {
      const stdWeight = Number(matched.standard_weight || 0);
      let qty = Math.max(1, Math.round(numValue));
      let weightMessage = '';

      if (isKgQuery && stdWeight > 0) {
        qty = Math.max(1, Math.round(numValue / stdWeight));
        const actualWeight = (qty * stdWeight).toFixed(2);
        weightMessage = ` (~${actualWeight} kg for ${numValue} kg request)`;
      }

      if (lines.some(l => l.product_id === matched.id)) {
        setLines(lines.map(l => l.product_id === matched.id ? { ...l, quantity: l.quantity + qty } : l));
        toast(`Updated ${matched.name} (+${qty} nos${weightMessage})`, 'success');
      } else {
        setLines([...lines, {
          product_id: matched.id,
          quantity: qty,
          unit: matched.unit || 'nos',
          product: matched
        }]);
        toast(`Added ${qty} ${matched.unit || 'nos'}${weightMessage} of ${matched.name}`, 'success');
      }
      setQuickText('');
    } else {
      toast(`No product matching "${raw}"`, 'error');
    }
  };

  const startVoiceDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast('Speech recognition not supported in this browser', 'error');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    setIsListening(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuickText(transcript);
      handleQuickAdd(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
      toast('Could not recognize voice, please try typing', 'error');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };
  
  const updateLineQty = (pid: string, delta: number) => {
    setLines(lines.map(l => l.product_id === pid ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l));
  };
  
  const removeLine = (pid: string) => {
    setLines(lines.filter(l => l.product_id !== pid));
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerName || !newCustomerPhone) {
      toast('Name and phone are required', 'error');
      return;
    }
    try {
      const cust: any = await api.post('/customers', {
        name: newCustomerName,
        phone: newCustomerPhone,
        address: newCustomerAddress
      });
      setCustomers([cust, ...customers]);
      setSelectedCustomer(cust);
      setIsCreatingCustomer(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerAddress('');
      toast('Customer created successfully', 'success');
    } catch (e: any) {
      toast(e.message || 'Failed to create customer', 'error');
    }
  };

  // Calculations
  const totalItems = lines.length;
  const totalQty = lines.reduce((acc, l) => acc + l.quantity, 0);
  const estimatedWeight = lines.reduce((acc, l) => {
    const p = calculateProductPrice(l.product, l.quantity);
    return acc + p.totalWeight;
  }, 0);
  const grandTotal = lines.reduce((acc, l) => {
    const p = calculateProductPrice(l.product, l.quantity);
    return acc + p.totalPrice;
  }, 0);

  // WhatsApp Integration
  const generateWhatsAppMessage = () => {
    let msg = `🏗️ *ANBU TRADERS — ESTIMATE* 🧾\n`;
    msg += `No.4/5 Pondy Mailam Road, T.C.Kootroad, Vanur T.K 605 111\n`;
    msg += `Ph: 0413-2964204, 9626325204\n`;
    msg += `─────────────────────────────\n`;
    msg += `*Estimate No:* ${nextOrderId}\n`;
    if (selectedCustomer) {
      msg += `*Customer:* ${selectedCustomer.name}\n`;
      if (selectedCustomer.phone) msg += `*Phone:* ${selectedCustomer.phone}\n`;
    }
    if (deliveryAddress) {
      msg += `*Delivery Site:* ${deliveryAddress}\n`;
    }
    msg += `─────────────────────────────\n`;
    msg += `*ITEMS:*\n\n`;
    lines.forEach((l, idx) => {
      const p = calculateProductPrice(l.product, l.quantity);
      msg += `${idx + 1}. *${l.product.name}*\n`;
      if (p.isSteel) {
        msg += `   ${l.quantity} nos × ${p.standardWeight} kg = *${p.totalWeight.toFixed(2)} kg* @ ₹${p.ratePerKg.toFixed(2)}/kg = *₹${p.totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}*\n`;
      } else {
        msg += `   ${l.quantity} ${l.unit || l.product.unit} × ₹${p.unitPrice.toFixed(2)} = *₹${p.totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}*\n`;
      }
    });
    if (isAdvanceOrder) {
      const advNum = parseFloat(advancePaidAmount) || 0;
      const balNum = Math.max(0, grandTotal - advNum);
      msg += `─────────────────────────────\n`;
      msg += `📦 *ADVANCE ORDER BOOKING CONFIRMED:*\n`;
      msg += `📅 *Scheduled Delivery Date:* ${scheduledDeliveryDate ? new Date(scheduledDeliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}\n`;
      msg += `💵 *Advance Paid:* ₹${advNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${advancePaymentMethod.toUpperCase()})\n`;
      msg += `🔴 *Balance Due on Delivery:* ₹${balNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
      if (advanceNotes) msg += `📝 *Delivery Remarks:* ${advanceNotes}\n`;
    }
    msg += `─────────────────────────────\n`;
    msg += `_Thank you for choosing Anbu Traders!_`;
    
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
        notes: '',
        status: 'pending',
        is_advance_order: isAdvanceOrder,
        scheduled_delivery_date: isAdvanceOrder && scheduledDeliveryDate ? new Date(scheduledDeliveryDate).toISOString() : null,
        advance_paid_amount: isAdvanceOrder ? (parseFloat(advancePaidAmount) || 0) : 0,
        advance_payment_method: isAdvanceOrder ? advancePaymentMethod : null,
        advance_notes: isAdvanceOrder ? advanceNotes : null,
        advance_status: isAdvanceOrder ? 'pending' : null,
        items: lines.map(l => ({ product_id: l.product_id, quantity: l.quantity, unit: l.unit }))
      };
      
      if (orderToEdit) {
        await api.put(`/orders/${orderToEdit.id}`, payload);
        toast('Order updated successfully', 'success');
      } else {
        await api.post('/orders', payload);
        toast(isAdvanceOrder ? 'Advance Order booked successfully!' : 'Order created successfully', 'success');
      }
      onBack();
    } catch (e: any) {
      toast(e.message || 'Failed to save order', 'error');
    }
    setSaving(false);
  };

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

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* Left Column (Inputs) */}
          <div className="flex-1 w-full space-y-6">
            
            {/* Customer Section */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="rounded-t-xl border-b border-slate-100 bg-slate-50/50 px-5 py-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <User size={18} className="text-blue-600" /> Customer Information
                </h2>
                {!selectedCustomer && !isCreatingCustomer && (
                  <button 
                    onClick={() => setIsCreatingCustomer(true)} 
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Plus size={14} /> New Customer
                  </button>
                )}
              </div>

              <div className="p-5">
                {selectedCustomer ? (
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                    <div>
                      <h3 className="font-semibold text-slate-900">{selectedCustomer.name}</h3>
                      <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <Phone size={13} /> {selectedCustomer.phone || 'No phone provided'}
                      </p>
                      {selectedCustomer.address && (
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                          <MapPin size={13} /> {selectedCustomer.address}
                        </p>
                      )}
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedCustomer(null);
                        setUseCustomerAddress(false);
                      }} 
                      className="text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      Change
                    </button>
                  </div>
                ) : isCreatingCustomer ? (
                  <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">Add New Customer</h3>
                      <button 
                        onClick={() => setIsCreatingCustomer(false)}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium text-slate-700">Full Name *</label>
                        <input 
                          type="text" 
                          className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-blue-500"
                          value={newCustomerName}
                          onChange={e => setNewCustomerName(e.target.value)}
                          placeholder="e.g. John Doe"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-700">Phone Number *</label>
                        <input 
                          type="text" 
                          className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-blue-500"
                          value={newCustomerPhone}
                          onChange={e => setNewCustomerPhone(e.target.value)}
                          placeholder="10-digit number"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-slate-700">Address</label>
                        <input 
                          type="text" 
                          className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-blue-500"
                          value={newCustomerAddress}
                          onChange={e => setNewCustomerAddress(e.target.value)}
                          placeholder="Street, City, Area"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={handleCreateCustomer}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-blue-700"
                    >
                      Save & Select Customer
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      placeholder="Search customer by name or phone..."
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      onFocus={() => setIsCustomerSearchFocused(true)}
                    />
                    {isCustomerSearchFocused && customerSearch && (
                      <div className="absolute z-10 mt-1 w-full divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
                        {filteredCustomers.map(c => (
                          <button
                            key={c.id}
                            className="flex w-full items-center justify-between p-3 text-left transition hover:bg-slate-50"
                            onClick={() => {
                              setSelectedCustomer(c);
                              setCustomerSearch('');
                              setIsCustomerSearchFocused(false);
                            }}
                          >
                            <div>
                              <p className="text-sm font-medium text-slate-900">{c.name}</p>
                              <p className="text-xs text-slate-500">{c.phone || 'No phone'}</p>
                            </div>
                            <span className="text-xs text-blue-600 font-medium">Select</span>
                          </button>
                        ))}
                        {filteredCustomers.length === 0 && (
                          <div className="p-3 text-center text-xs text-slate-400">
                            No customers found. Click 'New Customer' above to add.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Address Section */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="rounded-t-xl border-b border-slate-100 bg-slate-50/50 px-5 py-4 flex items-center justify-between">
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
                    Same as primary address
                  </label>
                )}
              </div>
              <div className="p-5 space-y-3">
                {selectedCustomer && (() => {
                  const savedAddrs = Array.from(new Set([
                    selectedCustomer.address,
                    ...(selectedCustomer.delivery_addresses || [])
                  ].filter(Boolean) as string[]));

                  return savedAddrs.length > 0 ? (
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                        <Navigation size={12} className="text-blue-500" /> Recommended Saved Addresses:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {savedAddrs.map((addr, idx) => {
                          const isSelected = deliveryAddress.trim().toLowerCase() === addr.trim().toLowerCase();
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setDeliveryAddress(addr);
                                setUseCustomerAddress(addr === selectedCustomer.address);
                              }}
                              className={`text-xs px-3 py-1.5 rounded-lg transition text-left flex items-center gap-1.5 border ${
                                isSelected
                                  ? 'bg-blue-50 border-blue-500 text-blue-800 font-bold shadow-sm ring-2 ring-blue-500/20'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 font-medium'
                              }`}
                            >
                              <span>📍</span>
                              <span className="truncate max-w-[260px]">{addr}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null;
                })()}

                <textarea
                  value={deliveryAddress}
                  onChange={e => {
                    setDeliveryAddress(e.target.value);
                    setUseCustomerAddress(false);
                  }}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-slate-300 p-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-sm"
                  placeholder="Enter full delivery address, plot number, landmark (auto-saved to customer profile for future use)..."
                />
              </div>
            </div>

            {/* Advance Order Booking Section */}
            <div className={`rounded-xl border-2 transition-all shadow-sm ${
              isAdvanceOrder 
                ? 'border-indigo-500 bg-indigo-50/20' 
                : 'border-slate-200 bg-white'
            }`}>
              <div className="rounded-t-xl border-b border-slate-100 bg-slate-50/50 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${isAdvanceOrder ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Calendar size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      Advance Order Booking
                      {isAdvanceOrder && (
                        <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                          Active Booking
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-500">Book materials with token advance & schedule future delivery</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAdvanceOrder}
                    onChange={(e) => setIsAdvanceOrder(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {isAdvanceOrder && (
                <div className="p-5 space-y-4 bg-white/60">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Scheduled Delivery Date */}
                    <div className="space-y-2">
                      <label className="block text-xs font-extrabold text-slate-700">
                        Scheduled Delivery Date *
                      </label>
                      <input
                        type="date"
                        value={scheduledDeliveryDate}
                        onChange={(e) => setScheduledDeliveryDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 p-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                      />
                      
                      {/* Quick Date Presets */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {[
                          { label: 'Tomorrow', days: 1 },
                          { label: 'In 2 Days', days: 2 },
                          { label: 'In 4 Days', days: 4 },
                          { label: 'In 1 Week', days: 7 },
                        ].map((btn) => {
                          const dt = new Date();
                          dt.setDate(dt.getDate() + btn.days);
                          const dateStr = dt.toISOString().split('T')[0];
                          const isActive = scheduledDeliveryDate === dateStr;
                          return (
                            <button
                              key={btn.label}
                              type="button"
                              onClick={() => setScheduledDeliveryDate(dateStr)}
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition border ${
                                isActive
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              {btn.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Advance Money Paid & Payment Mode */}
                    <div className="space-y-2">
                      <label className="block text-xs font-extrabold text-slate-700">
                        Advance Amount Received (₹)
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="e.g. 5000"
                            value={advancePaidAmount}
                            onChange={(e) => setAdvancePaidAmount(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 p-2.5 pl-8 text-sm font-black text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                          />
                        </div>
                        <select
                          value={advancePaymentMethod}
                          onChange={(e) => setAdvancePaymentMethod(e.target.value)}
                          className="rounded-lg border border-slate-300 p-2.5 text-xs font-bold text-slate-700 bg-white outline-none focus:border-indigo-500"
                        >
                          <option value="cash">💵 Cash</option>
                          <option value="upi">📱 GPay / UPI</option>
                          <option value="bank">🏦 Bank Transfer</option>
                          <option value="cheque">📄 Cheque</option>
                        </select>
                      </div>

                      {/* Advance Breakdown Card */}
                      <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                        <div>
                          <span className="text-slate-500 block">Advance Paid:</span>
                          <span className="font-extrabold text-emerald-600">
                            ₹{(parseFloat(advancePaidAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Balance on Delivery:</span>
                          <span className="font-extrabold text-rose-600">
                            ₹{Math.max(0, grandTotal - (parseFloat(advancePaidAmount) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Advance Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Advance Booking / Unloading Instructions
                    </label>
                    <input
                      type="text"
                      value={advanceNotes}
                      onChange={(e) => setAdvanceNotes(e.target.value)}
                      placeholder="e.g. Unload at 7:30 AM before site work starts, call contractor on arrival..."
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Products Section */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="rounded-t-xl border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <ShoppingBag size={18} className="text-blue-600" /> Order Items
                </h2>
              </div>
              
              <div className="p-5 border-b border-slate-100 bg-slate-50/30 space-y-4">
                {/* 1-Tap Quick-Add Omnibar with Voice Dictation */}
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex items-center gap-2 text-amber-800 text-xs font-bold shrink-0">
                    <Zap size={15} className="text-amber-600 fill-amber-500" />
                    <span>Quick-Add / Voice:</span>
                  </div>
                  <div className="relative flex-1 flex items-center gap-1.5">
                    <input
                      type="text"
                      value={quickText}
                      onChange={e => setQuickText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleQuickAdd(quickText);
                        }
                      }}
                      placeholder='e.g. "50 kg sumangala 8mm" or "10 rods tata steel" & press Enter...'
                      className="w-full rounded-lg border border-amber-300 bg-white py-1.5 pl-3 pr-20 text-xs outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20"
                    />
                    <div className="absolute right-1.5 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={startVoiceDictation}
                        className={`p-1 rounded-md transition ${
                          isListening
                            ? 'bg-rose-500 text-white animate-pulse'
                            : 'text-slate-500 hover:text-amber-700 hover:bg-amber-100'
                        }`}
                        title={isListening ? 'Listening...' : 'Voice Dictation'}
                      >
                        {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAdd(quickText)}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold px-2 py-0.5 rounded shadow-sm"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

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
                  <div className="md:col-span-9 relative">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Search Product</label>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        placeholder="Type product name (e.g. Sumangala 8mm, Ramco Cement)..."
                        value={productSearch}
                        onChange={e => {
                          setProductSearch(e.target.value);
                          if (selectedProduct && e.target.value !== selectedProduct.name) {
                            setSelectedProduct(null);
                          }
                        }}
                      />
                    </div>
                    {productSearch && !selectedProduct && filteredProducts.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden">
                        {filteredProducts.map(p => {
                          const pr = calculateProductPrice(p, 1);
                          return (
                            <button
                              key={p.id}
                              className="flex w-full flex-col px-4 py-2.5 text-left transition hover:bg-slate-50"
                              onClick={() => handleSelectProduct(p)}
                            >
                              <span className="font-medium text-slate-900">{p.name}</span>
                              <span className="text-xs text-slate-500">
                                {p.brand} • {pr.isSteel ? `₹${pr.ratePerKg.toFixed(2)}/kg (Std: ${pr.standardWeight} kg/no)` : `₹${pr.unitPrice}/${p.unit}`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected Product Configuration & Dual Steel Input */}
                {selectedProduct && (
                  <div className="bg-blue-50/50 border-2 border-blue-200 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 pb-2">
                      <div>
                        <span className="text-sm font-black text-slate-900">
                          {selectedProduct.name}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 ml-2">
                          Brand: <strong className="text-blue-700">{selectedProduct.brand || 'General'}</strong>
                          {Number(selectedProduct.standard_weight || 0) > 0 && ` • Std Weight: ${selectedProduct.standard_weight} kg/no`}
                        </span>
                      </div>
                      <button
                        onClick={handleAddItem}
                        className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 shadow-sm transition flex items-center gap-1.5"
                      >
                        <PlusIcon size={16} /> Add to Order
                      </button>
                    </div>

                    {Number(selectedProduct.standard_weight || 0) > 0 ? (
                      /* Steel Dual Input Box: Nos ⇄ Kg Live Conversion */
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-extrabold text-blue-900">
                          <span className="flex items-center gap-1">
                            <Sparkles size={13} className="text-amber-500" /> Steel Dual-Unit Converter:
                          </span>
                          <span className="text-blue-600 font-semibold">
                            Enter either <strong className="underline">Nos</strong> or <strong className="underline">Kgs</strong> (auto-syncs)
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="bg-white p-3 rounded-lg border border-blue-200 shadow-sm">
                            <label className="block text-xs font-extrabold text-slate-800 mb-1">
                              Quantity in Nos (Rods / Pieces)
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                value={itemQty}
                                onChange={e => handleQtyChange(Number(e.target.value))}
                                className="w-full rounded-md border border-slate-300 p-2 text-sm font-black text-slate-900 outline-none focus:border-blue-500"
                              />
                              <span className="text-xs font-bold text-slate-500">nos</span>
                            </div>
                            <p className="text-[11px] font-medium text-slate-500 mt-1">
                              Weight: <strong>{(itemQty * Number(selectedProduct.standard_weight || 0)).toFixed(2)} kg</strong>
                            </p>
                          </div>

                          <div className="bg-white p-3 rounded-lg border border-blue-200 shadow-sm">
                            <label className="block text-xs font-extrabold text-blue-900 mb-1 flex items-center justify-between">
                              <span>Target Weight in Kgs</span>
                              <span className="text-[10px] font-bold text-amber-600">Calculates Nos</span>
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="any"
                                placeholder="e.g. 50 kg"
                                value={targetWeightInput}
                                onChange={e => handleTargetWeightChange(e.target.value)}
                                className="w-full rounded-md border border-blue-300 p-2 text-sm font-black text-blue-900 outline-none focus:border-blue-500"
                              />
                              <span className="text-xs font-bold text-blue-700">kg</span>
                            </div>
                            <p className="text-[11px] font-bold text-blue-700 mt-1">
                              ➔ Converts to ~{itemQty} nos ({(itemQty * Number(selectedProduct.standard_weight || 0)).toFixed(2)} kg actual)
                            </p>
                          </div>
                        </div>

                        {(() => {
                          const pr = calculateProductPrice(selectedProduct, itemQty);
                          return (
                            <div className="p-2.5 bg-blue-100/60 rounded-lg text-xs font-bold text-blue-950 flex flex-wrap items-center justify-between">
                              <span>Formula: {itemQty} nos × {pr.standardWeight} kg = {pr.totalWeight.toFixed(2)} kg @ ₹{pr.ratePerKg.toFixed(2)}/kg</span>
                              <span className="text-sm font-black text-blue-700">Line Total: ₹{pr.totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      /* Non-steel product input */
                      <div className="flex items-center gap-4">
                        <div className="w-40">
                          <label className="block text-xs font-bold text-slate-700 mb-1">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={itemQty}
                            onChange={e => setItemQty(Number(e.target.value))}
                            className="w-full rounded-lg border border-slate-300 p-2 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 bg-white"
                          />
                        </div>
                        {(() => {
                          const pr = calculateProductPrice(selectedProduct, itemQty);
                          return (
                            <div className="pt-5 text-sm font-bold text-slate-700">
                              {itemQty} {selectedProduct.unit || 'nos'} × ₹{pr.unitPrice.toFixed(2)} = <span className="font-black text-blue-600">₹{pr.totalPrice.toFixed(2)}</span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
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
                    {lines.map((line, idx) => {
                      const pricing = calculateProductPrice(line.product, line.quantity);
                      return (
                        <div key={`${line.product_id}-${idx}`} className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 transition hover:bg-slate-50/50">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">{line.product.name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm font-medium text-slate-500">
                              {pricing.isSteel ? (
                                <>
                                  <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                    ₹{pricing.ratePerKg.toFixed(2)} / kg
                                  </span>
                                  <span className="text-slate-300">•</span>
                                  <span>{pricing.standardWeight} kg / nos</span>
                                  <span className="text-slate-300">•</span>
                                  <span className="text-slate-600 font-semibold">(₹{pricing.unitPrice.toFixed(2)} / nos)</span>
                                  <span className="text-slate-300">•</span>
                                  <span className="text-blue-700 font-medium">{line.quantity} nos × {pricing.standardWeight} kg = <strong>{pricing.totalWeight.toFixed(2)} kg</strong></span>
                                </>
                              ) : (
                                <>
                                  <span>₹{pricing.unitPrice} / {line.product.unit}</span>
                                  {pricing.standardWeight > 0 && (
                                    <>
                                      <span className="text-slate-300">|</span>
                                      <span>{pricing.standardWeight} kg</span>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6">
                            <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-sm">
                              <button onClick={() => updateLineQty(line.product_id, -1)} className="rounded-l-lg p-2 hover:bg-slate-100 text-slate-600 transition"><Minus size={14} /></button>
                              <span className="w-12 text-center font-semibold text-slate-900">{line.quantity}</span>
                              <button onClick={() => updateLineQty(line.product_id, 1)} className="rounded-r-lg p-2 hover:bg-slate-100 text-slate-600 transition"><Plus size={14} /></button>
                            </div>
                            <div className="w-28 text-right">
                              <p className="font-bold text-slate-900 text-lg">₹{pricing.totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                              {pricing.isSteel && (
                                <p className="text-[11px] text-slate-400">{pricing.totalWeight.toFixed(1)} kg @ ₹{pricing.ratePerKg}/kg</p>
                              )}
                            </div>
                            <button onClick={() => removeLine(line.product_id)} className="text-slate-400 hover:text-red-600 transition p-2 hover:bg-red-50 rounded-lg">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column (Summary) */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="sticky top-24 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Order Summary</h2>
              
              <div className="space-y-3 text-sm font-medium text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Items</span>
                  <span className="text-slate-900 font-bold">{totalItems}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Quantity</span>
                  <span className="text-slate-900 font-bold">{totalQty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Weight</span>
                  <span className="text-slate-900 font-bold">{estimatedWeight.toFixed(2)} kg</span>
                </div>
              </div>
              
              <div className="border-t border-slate-200 border-dashed pt-3">
                <div className="flex justify-between items-center text-slate-900">
                  <span className="text-sm font-bold">Total Estimate</span>
                  <span className="text-xl font-black text-blue-600 tracking-tight">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Advance Booking Details in Summary */}
              {isAdvanceOrder && (
                <div className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-black text-indigo-900">
                    <span className="flex items-center gap-1">
                      <Calendar size={13} className="text-indigo-600" /> Advance Booking
                    </span>
                    <span>{scheduledDeliveryDate ? new Date(scheduledDeliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Advance Received:</span>
                    <span className="font-extrabold text-emerald-600">
                      ₹{(parseFloat(advancePaidAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold border-t border-indigo-200/60 pt-1.5">
                    <span>Due on Delivery:</span>
                    <span className="font-black text-rose-600">
                      ₹{Math.max(0, grandTotal - (parseFloat(advancePaidAmount) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-slate-400 text-right">Tax inclusive pricing</p>
            </div>
          </div>
          
        </div>
      </main>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.08)]">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          
          <div className="hidden lg:flex flex-col">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Order Total</p>
            <p className="text-xl font-bold text-slate-900">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>

          <div className="flex w-full lg:w-auto items-center justify-between lg:hidden">
             <div className="text-sm font-medium text-slate-600">
               <span className="font-bold text-slate-900">{totalItems} items</span>
             </div>
             <div className="text-lg font-bold text-blue-600">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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
              {saving ? 'Saving...' : 'Save Order'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
