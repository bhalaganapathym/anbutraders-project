import { useCallback, useEffect, useState, useRef } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import { api, type Product } from '@/lib/api';
import { round2 } from '@/lib/pricing';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import {
  Pencil, Plus, Search, Trash2, Package, Layers, IndianRupee,
  Scale, Box, Upload, TrendingUp, Sparkles, X, Check, Filter
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/i18n';

type Form = {
  name: string;
  category: string;
  unit: string;
  price: string;
  rate_per_kg: string;
  stock_qty: string;
  brand: string;
  size: string;
  standard_weight: string;
  weight_tolerance: string;
  weight_tolerance_minus: string;
  bundle_conversion_qty: string;
  is_aac_block: boolean;
  piece_weight_kg: string;
};

const empty: Form = {
  name: '',
  category: 'Steel',
  unit: 'piece',
  price: '0',
  rate_per_kg: '0',
  stock_qty: '0',
  brand: '',
  size: '',
  standard_weight: '0',
  weight_tolerance: '',
  weight_tolerance_minus: '',
  bundle_conversion_qty: '',
  is_aac_block: false,
  piece_weight_kg: ''
};

const categories = ['Steel', 'Cement', 'TMT Bars', 'AAC Blocks', 'Pipes', 'Other'];
const knownBrands = ['Tata Steel', 'iSteel', 'Sumangala', 'Suryadev', 'Ultratech', 'Dalmia', 'Chettinad'];
const knownSizes = ['8mm', '10mm', '12mm', '16mm', '20mm', '25mm', '32mm', '4 inch', '6 inch', '8 inch', '9 inch'];

const categoryColor: Record<string, string> = {
  Steel: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
  Cement: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  'TMT Bars': 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  'AAC Blocks': 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  Pipes: 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  Other: 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
};

export default function Products() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canEditTolerance = user?.role === 'admin' || user?.role === 'billing';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [unitFilter, setUnitFilter] = useState<'all' | 'kg' | 'piece'>('all');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);

  // Brand Price Adjuster State
  const [brandAdjustOpen, setBrandAdjustOpen] = useState(false);
  const [adjustMode, setAdjustMode] = useState<'rate' | 'delta'>('rate');
  const [selectedBrand, setSelectedBrand] = useState('iSteel');
  const [todaysRateInput, setTodaysRateInput] = useState('62');
  const [priceDelta, setPriceDelta] = useState('0');
  const [adjustingBrand, setAdjustingBrand] = useState(false);

  // Tolerance Inline Editing
  const [editingTolId, setEditingTolId] = useState<string | null>(null);
  const [tolValue, setTolValue] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/products');
      setProducts(data as Product[]);
    } catch {
      toast('Failed to load products', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime('products', load);

  const availableBrands = Array.from(
    new Set([
      ...knownBrands,
      ...(products.map(p => p.brand).filter(Boolean) as string[])
    ])
  );

  const availableCategories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const brandProducts = products.filter(
    (p) => (p.brand || '').toLowerCase() === selectedBrand.toLowerCase()
  );

  const handleBrandPriceAdjust = async () => {
    setAdjustingBrand(true);
    try {
      if (adjustMode === 'rate') {
        const rateNum = parseFloat(todaysRateInput);
        if (isNaN(rateNum) || rateNum <= 0) {
          toast("Please enter a valid today's rate (e.g. 62)", 'error');
          setAdjustingBrand(false);
          return;
        }
        const res = await api.post('/products/adjust-brand-prices', {
          brand: selectedBrand,
          todays_rate_per_kg: rateNum,
        });
        toast(res.message || `Updated today's rate to ₹${rateNum}/kg for ${selectedBrand}`, 'success');
      } else {
        const deltaNum = parseFloat(priceDelta);
        if (isNaN(deltaNum) || deltaNum === 0) {
          toast('Please enter a non-zero price difference (e.g. +3 or -3)', 'error');
          setAdjustingBrand(false);
          return;
        }
        const res = await api.post('/products/adjust-brand-prices', {
          brand: selectedBrand,
          price_delta: deltaNum,
        });
        toast(res.message || `Updated prices for ${selectedBrand}`, 'success');
      }
      setBrandAdjustOpen(false);
      load();
    } catch (err: any) {
      toast(err?.message || 'Failed to update brand prices', 'error');
    } finally {
      setAdjustingBrand(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 2) throw new Error('CSV is empty or missing headers');
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const nameIdx = headers.indexOf('name');
        if (nameIdx === -1) throw new Error('CSV must contain a "name" column');
        
        const catIdx = headers.indexOf('category');
        const unitIdx = headers.indexOf('unit');
        const priceIdx = headers.indexOf('price');
        const qtyIdx = headers.indexOf('stock_qty');
        const brandIdx = headers.indexOf('brand');
        const sizeIdx = headers.indexOf('size');
        const weightIdx = headers.indexOf('standard_weight');
        const tolIdx = headers.indexOf('weight_tolerance');

        const productsToUpload = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim());
          if (!cols[nameIdx]) continue;
          
          productsToUpload.push({
            name: cols[nameIdx].toUpperCase(),
            category: (catIdx !== -1 && cols[catIdx]) ? cols[catIdx].toUpperCase() : 'OTHER',
            unit: (unitIdx !== -1 && cols[unitIdx]) ? cols[unitIdx].toUpperCase() : 'PIECE',
            price: (priceIdx !== -1 && !isNaN(Number(cols[priceIdx]))) ? Number(cols[priceIdx]) : 0,
            stock_qty: (qtyIdx !== -1 && !isNaN(Number(cols[qtyIdx]))) ? Number(cols[qtyIdx]) : 0,
            brand: (brandIdx !== -1 && cols[brandIdx]) ? cols[brandIdx].toUpperCase() : null,
            size: (sizeIdx !== -1 && cols[sizeIdx]) ? cols[sizeIdx].toUpperCase() : null,
            standard_weight: (weightIdx !== -1 && !isNaN(Number(cols[weightIdx]))) ? Number(cols[weightIdx]) : 0,
            weight_tolerance: (tolIdx !== -1 && !isNaN(Number(cols[tolIdx]))) ? Number(cols[tolIdx]) : null,
          });
        }
        
        if (productsToUpload.length === 0) throw new Error('No valid products found to upload');
        
        await api.post('/products/bulk', productsToUpload);
        toast(`Successfully imported ${productsToUpload.length} products`, 'success');
        load();
      } catch (err: any) {
        toast(err.message || 'Failed to upload CSV', 'error');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      toast('Failed to read file', 'error');
      setUploading(false);
    };
    reader.readAsText(file);
  };

  const filtered = products.filter((p) => {
    const matchesQuery = [p.name, p.brand ?? '', p.size ?? '', p.category].join(' ').toLowerCase().includes(query.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category?.toUpperCase() === selectedCategory.toUpperCase();
    const matchesUnit = unitFilter === 'all' ? true : unitFilter === 'kg' ? p.unit?.toLowerCase() === 'kg' : p.unit?.toLowerCase() === 'piece';
    return matchesQuery && matchesCategory && matchesUnit;
  });

  const kgCount = products.filter(p => p.unit?.toLowerCase() === 'kg').length;
  const pieceCount = products.filter(p => p.unit?.toLowerCase() === 'piece').length;

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    const pPrice = Number(p.price ?? 0);
    const pStdWeight = Number(p.standard_weight ?? p.piece_weight_kg ?? 0);
    setForm({
      name: p.name.toUpperCase(),
      category: p.category.toUpperCase(),
      unit: p.unit.toUpperCase(),
      price: String(pPrice),
      rate_per_kg: pStdWeight > 0 ? (pPrice / pStdWeight).toFixed(2) : '0',
      stock_qty: String(p.stock_qty ?? 0),
      brand: (p.brand ?? '').toUpperCase(),
      size: (p.size ?? '').toUpperCase(),
      standard_weight: String(pStdWeight),
      weight_tolerance: p.weight_tolerance != null ? String(p.weight_tolerance) : '',
      weight_tolerance_minus: p.weight_tolerance_minus != null ? String(p.weight_tolerance_minus) : '',
      bundle_conversion_qty: p.bundle_conversion_qty != null ? String(p.bundle_conversion_qty) : '',
      is_aac_block: !!p.is_aac_block,
      piece_weight_kg: p.piece_weight_kg != null ? String(p.piece_weight_kg) : '',
    });
    setOpen(true);
  };

  const handleRatePerKgChange = (val: string) => {
    const rNum = parseFloat(val) || 0;
    const wNum = parseFloat(form.standard_weight) || 0;
    const newPrice = wNum > 0 ? (rNum * wNum).toFixed(2) : form.price;
    setForm(prev => ({ ...prev, rate_per_kg: val, price: newPrice }));
  };

  const handlePriceChange = (val: string) => {
    const pNum = parseFloat(val) || 0;
    const wNum = parseFloat(form.standard_weight) || 0;
    const newRate = wNum > 0 ? (pNum / wNum).toFixed(2) : form.rate_per_kg;
    setForm(prev => ({ ...prev, price: val, rate_per_kg: newRate }));
  };

  const handleStdWeightChange = (val: string) => {
    const wNum = parseFloat(val) || 0;
    const rNum = parseFloat(form.rate_per_kg) || 0;
    const newPrice = (rNum > 0 && wNum > 0) ? (rNum * wNum).toFixed(2) : form.price;
    setForm(prev => ({ ...prev, standard_weight: val, price: newPrice }));
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast('Product name is required', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim().toUpperCase(),
      category: form.category.trim().toUpperCase(),
      unit: (form.unit.trim() || 'piece').toUpperCase(),
      price: parseFloat(form.price) || 0,
      stock_qty: parseFloat(form.stock_qty) || 0,
      brand: form.brand.trim() ? form.brand.trim().toUpperCase() : null,
      size: form.size.trim() ? form.size.trim().toUpperCase() : null,
      standard_weight: parseFloat(form.standard_weight) || 0,
      weight_tolerance: form.weight_tolerance !== '' ? parseFloat(form.weight_tolerance) : null,
      weight_tolerance_minus: form.weight_tolerance_minus !== '' ? parseFloat(form.weight_tolerance_minus) : null,
      bundle_conversion_qty: form.bundle_conversion_qty !== '' ? parseInt(form.bundle_conversion_qty, 10) : null,
      is_aac_block: form.is_aac_block,
      piece_weight_kg: form.piece_weight_kg !== '' ? parseFloat(form.piece_weight_kg) : (form.is_aac_block && form.standard_weight ? parseFloat(form.standard_weight) : null),
    };
    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, payload);
        toast('Product updated', 'success');
      } else {
        await api.post('/products', payload);
        toast('Product added', 'success');
      }
      setOpen(false);
      load();
    } catch {
      toast('Failed to save product', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateTolerance = async (p: Product, newTol: number | null) => {
    try {
      await api.put(`/products/${p.id}`, {
        ...p,
        weight_tolerance: newTol
      });
      toast(`Tolerance updated for ${p.name}`, 'success');
      load();
    } catch {
      toast('Failed to update tolerance', 'error');
    }
  };

  const remove = async (p: Product) => {
    if (!confirm(`Delete product "${p.name}"?`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      toast('Product deleted', 'success');
      load();
    } catch {
      toast('Failed to delete product', 'error');
    }
  };

  const startEditTol = (p: Product) => {
    if (!canEditTolerance) return;
    setEditingTolId(p.id);
    setTolValue(p.weight_tolerance != null ? String(p.weight_tolerance) : '');
  };

  const finishEditTol = (p: Product) => {
    setEditingTolId(null);
    const parsed = tolValue.trim() === '' ? null : parseFloat(tolValue);
    if (parsed !== p.weight_tolerance) {
      updateTolerance(p, isNaN(parsed as number) ? null : parsed);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            {t('products')}
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            {t('company_tagline')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEditTolerance && (
            <button
              onClick={() => setBrandAdjustOpen(true)}
              className="btn-secondary text-xs sm:text-sm font-bold border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl"
            >
              <TrendingUp size={16} className="text-indigo-600" /> {t('edit_brand_prices')}
            </button>
          )}

          {isAdmin && (
            <>
              <input 
                type="file" 
                accept=".csv" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-secondary text-xs sm:text-sm font-bold rounded-xl"
              >
                <Upload size={16} /> {uploading ? t('loading') : t('export_csv')}
              </button>
              <button
                onClick={openNew}
                className="btn-primary text-xs sm:text-sm font-bold rounded-xl shadow-md"
              >
                <Plus size={16} /> {t('add_product')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Unified Search & Multi-Filter Control Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search product, brand, size or category..."
              className="input pl-10 pr-8 py-2 font-medium"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Unit Filter Segmented Control */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start md:self-auto text-xs font-bold">
            <button
              onClick={() => setUnitFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                unitFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              All ({products.length})
            </button>
            <button
              onClick={() => setUnitFilter('kg')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                unitFilter === 'kg'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Scale size={12} /> Kg ({kgCount})
            </button>
            <button
              onClick={() => setUnitFilter('piece')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                unitFilter === 'piece'
                  ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Box size={12} /> Piece ({pieceCount})
            </button>
          </div>
        </div>

        {/* Category Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 text-xs">
          {availableCategories.map((c) => {
            const count = c === 'All' ? products.length : products.filter(p => p.category?.toUpperCase() === c.toUpperCase()).length;
            const isActive = selectedCategory.toUpperCase() === c.toUpperCase();
            return (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                className={`rounded-xl px-3 py-1.5 font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{c}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-slate-700 dark:bg-slate-300 text-white dark:text-slate-900' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm font-semibold text-slate-400">Loading products...</div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <Package size={24} />
          </div>
          <p className="text-base font-bold text-slate-700 dark:text-slate-200">No products found</p>
          <p className="text-xs text-slate-400">No items match your active filters.</p>
          {isAdmin && (
            <button onClick={openNew} className="btn-primary text-xs mt-1">
              <Plus size={14} /> Add First Product
            </button>
          )}
        </div>
      ) : (
        <>
          {/* MOBILE CARDS VIEW (< 768px) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filtered.map((p) => {
              const stdWt = Number(p.standard_weight || p.piece_weight_kg || 0);
              const hasWeight = stdWt > 0;
              const rateKg = hasWeight ? ((p.price ?? 0) / stdWt).toFixed(2) : null;
              const catClass = categoryColor[p.category] || categoryColor.Other;

              return (
                <div
                  key={p.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3"
                >
                  {/* Card Header: Product Name & Category */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wide">
                        {p.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className={`badge text-[10px] font-bold border ${catClass}`}>
                          {p.category}
                        </span>
                        {p.brand && (
                          <span className="badge bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold border border-indigo-200 dark:border-indigo-800">
                            {p.brand}
                          </span>
                        )}
                        {p.size && (
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            {p.size}
                          </span>
                        )}
                        {p.bundle_conversion_qty && p.bundle_conversion_qty > 1 && (
                          <span className="badge bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-200 dark:border-amber-800">
                            📦 1 Bdl = {p.bundle_conversion_qty} nos
                          </span>
                        )}
                        {p.is_aac_block && (
                          <span className="badge bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                            🧱 AAC Block
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price Tag */}
                    <div className="text-right shrink-0">
                      <span className="text-base font-black text-amber-600 dark:text-amber-400 block leading-tight">
                        ₹{(p.price ?? 0).toFixed(2)}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">
                        per {p.unit}
                      </span>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Std Weight</span>
                      <p className="font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                        {hasWeight ? `${stdWt} kg` : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tolerance</span>
                      <p className="font-bold text-amber-600 dark:text-amber-400 mt-0.5 truncate">
                        {p.weight_tolerance != null ? (
                          p.weight_tolerance_minus != null && Number(p.weight_tolerance_minus) !== Number(p.weight_tolerance) ? (
                            `+${p.weight_tolerance}/-${p.weight_tolerance_minus}`
                          ) : (
                            `±${p.weight_tolerance}kg`
                          )
                        ) : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rate / Kg</span>
                      <p className="font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {rateKg ? `₹${rateKg}` : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons for Mobile */}
                  {isAdmin && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="btn-secondary flex-1 py-2 text-xs flex items-center justify-center gap-1.5 font-bold rounded-xl"
                      >
                        <Pencil size={13} className="text-indigo-600" /> Edit
                      </button>
                      <button
                        onClick={() => remove(p)}
                        className="btn-secondary px-3 py-2 text-xs flex items-center justify-center text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl"
                        title="Delete Product"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* DESKTOP TABLE VIEW (>= 768px) */}
          <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
                <tr>
                  <th className="th py-3.5">Product & Details</th>
                  <th className="th py-3.5">Brand</th>
                  <th className="th py-3.5">Category</th>
                  <th className="th py-3.5">Unit</th>
                  <th className="th py-3.5">Std Wt</th>
                  <th className="th py-3.5">Tolerance</th>
                  <th className="th py-3.5">Price & Rate</th>
                  {isAdmin && <th className="th py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                {filtered.map((p) => {
                  const stdWt = Number(p.standard_weight || p.piece_weight_kg || 0);
                  const hasWeight = stdWt > 0;
                  const rateKg = hasWeight ? ((p.price ?? 0) / stdWt).toFixed(2) : null;
                  const catClass = categoryColor[p.category] || categoryColor.Other;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      <td className="td py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
                            <Layers size={16} />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                              {p.name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {p.size && (
                                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                                  {p.size}
                                </span>
                              )}
                              {p.bundle_conversion_qty && p.bundle_conversion_qty > 1 && (
                                <span className="badge bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-200 dark:border-amber-800">
                                  📦 1 Bdl = {p.bundle_conversion_qty} nos
                                </span>
                              )}
                              {p.is_aac_block && (
                                <span className="badge bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                                  🧱 AAC Block
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="td py-3.5">
                        {p.brand ? (
                          <span className="badge bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                            {p.brand}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="td py-3.5">
                        <span className={`badge border font-bold ${catClass}`}>
                          {p.category}
                        </span>
                      </td>
                      <td className="td py-3.5 font-bold text-slate-600 dark:text-slate-400 uppercase text-xs">
                        {p.unit}
                      </td>
                      <td className="td py-3.5">
                        {hasWeight ? (
                          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <Scale size={13} className="text-slate-400" />
                            {stdWt} kg
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="td py-3.5">
                        {editingTolId === p.id ? (
                          <input
                            type="number"
                            step="0.1"
                            value={tolValue}
                            onChange={(e) => setTolValue(e.target.value)}
                            onBlur={() => finishEditTol(p)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') finishEditTol(p);
                              if (e.key === 'Escape') setEditingTolId(null);
                            }}
                            className="input py-0.5 px-2 w-20 text-xs font-bold text-amber-600 border-amber-400"
                            autoFocus
                          />
                        ) : (
                          <span 
                            onClick={() => startEditTol(p)}
                            className={`font-semibold text-xs ${canEditTolerance ? 'cursor-pointer hover:underline text-amber-700 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}`}
                            title={canEditTolerance ? 'Click to edit weight tolerance' : undefined}
                          >
                            {p.weight_tolerance != null ? (
                              p.weight_tolerance_minus != null && Number(p.weight_tolerance_minus) !== Number(p.weight_tolerance) ? (
                                `+${p.weight_tolerance}/-${p.weight_tolerance_minus} kg`
                              ) : (
                                `±${p.weight_tolerance} kg`
                              )
                            ) : (
                              <span className="text-slate-400">Default</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="td py-3.5">
                        <div>
                          <div className="flex items-center gap-1.5 font-black text-base text-slate-900 dark:text-slate-100">
                            <span>₹{(p.price ?? 0).toFixed(2)}</span>
                            <span className="text-[11px] font-normal text-slate-400">/ {p.unit}</span>
                          </div>
                          {rateKg && (
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                              ₹{rateKg} / kg
                            </span>
                          )}
                        </div>
                      </td>
                      {isAdmin && (
                        <td className="td py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEdit(p)}
                              className="btn-ghost p-1.5 text-slate-600 hover:text-indigo-600 rounded-lg"
                              title="Edit Product"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => remove(p)}
                              className="btn-ghost p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                              title="Delete Product"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add / Edit Product Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Product' : 'Add New Product'} size="md">
        <div className="space-y-4">
          <div>
            <label className="label">Product Name * (SAVED IN UPPERCASE)</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })}
              className="input font-bold uppercase"
              placeholder="e.g. TMT STEEL BAR 12MM"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value.toUpperCase() })}
                className="input uppercase font-semibold"
              >
                {categories.map((c) => (
                  <option key={c} value={c.toUpperCase()}>{c.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Unit</label>
              <input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value.toUpperCase() })}
                className="input uppercase font-semibold"
                placeholder="PIECE, KG, BAG..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Brand</label>
              <input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value.toUpperCase() })}
                className="input uppercase"
                placeholder="e.g. ISTEEL"
                list="brand-list"
              />
              <datalist id="brand-list">
                {knownBrands.map((b) => <option key={b} value={b.toUpperCase()} />)}
              </datalist>
            </div>
            <div>
              <label className="label">Size</label>
              <input
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value.toUpperCase() })}
                className="input uppercase"
                placeholder="e.g. 12MM"
                list="size-list"
              />
              <datalist id="size-list">
                {knownSizes.map((s) => <option key={s} value={s.toUpperCase()} />)}
              </datalist>
            </div>
          </div>

          {/* Standard Weight & Tolerances */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="label">Std Weight (kg)</label>
              <input
                type="number"
                value={form.standard_weight}
                onChange={(e) => handleStdWeightChange(e.target.value)}
                className="input font-bold"
                min="0"
                step="0.001"
                placeholder="e.g. 7.3"
              />
            </div>
            <div>
              <label className="label">Plus Tol (+kg)</label>
              <input
                type="number"
                value={form.weight_tolerance}
                onChange={(e) => setForm({ ...form, weight_tolerance: e.target.value })}
                className="input"
                min="0"
                step="0.001"
                placeholder="e.g. 0.3"
              />
            </div>
            <div>
              <label className="label">Minus Tol (-kg)</label>
              <input
                type="number"
                value={form.weight_tolerance_minus}
                onChange={(e) => setForm({ ...form, weight_tolerance_minus: e.target.value })}
                className="input"
                min="0"
                step="0.001"
                placeholder="e.g. 0.2"
              />
            </div>
            <p className="col-span-full text-[10.5px] text-slate-500 dark:text-slate-400">
              💡 If Minus Tol is left blank, Plus Tol applies symmetrically (±).
            </p>
          </div>

          {/* Bundle Conversion & AAC Block Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="label flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                <Box size={14} className="text-amber-600" /> Steel Bundle Conversion
              </label>
              <input
                type="number"
                min="1"
                value={form.bundle_conversion_qty}
                onChange={(e) => setForm({ ...form, bundle_conversion_qty: e.target.value })}
                className="input font-semibold"
                placeholder="e.g. 7 (for 8mm)"
              />
              <p className="text-[10px] text-slate-500 mt-1">1 bundle = {form.bundle_conversion_qty || '7'} pieces for dispatchers</p>
            </div>

            <div className="space-y-2">
              <label className="label font-bold text-slate-800 dark:text-slate-200">AAC Block Settings</label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.is_aac_block}
                  onChange={(e) => setForm({ ...form, is_aac_block: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span>🧱 This product is an AAC Block</span>
              </label>
              {form.is_aac_block && (
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Piece Weight (kg)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.piece_weight_kg}
                    onChange={(e) => setForm({ ...form, piece_weight_kg: e.target.value, standard_weight: e.target.value })}
                    className="input font-semibold text-xs py-1.5"
                    placeholder="e.g. 12.5"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Linked Rate per kg & Unit Price */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label flex items-center gap-1">
                  <Scale size={13} className="text-indigo-600" /> Rate per kg (₹/kg)
                </label>
                <div className="relative">
                  <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    value={form.rate_per_kg}
                    onChange={(e) => handleRatePerKgChange(e.target.value)}
                    className="input pl-8 font-bold text-indigo-700 dark:text-indigo-300"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="label">Price per {form.unit || 'unit'} (₹)</label>
                <div className="relative">
                  <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    className="input pl-8 font-bold text-slate-800 dark:text-slate-100"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            {parseFloat(form.standard_weight) > 0 && (
              <div className="text-xs text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-indigo-200/80 dark:border-indigo-800 font-medium">
                💡 1 {form.unit || 'piece'} ({form.standard_weight} kg) × ₹{parseFloat(form.rate_per_kg) || 0}/kg = <strong>₹{parseFloat(form.price) || 0} / {form.unit || 'piece'}</strong>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Brand Steel Rate Adjuster / Today's Rate Modal */}
      <Modal open={brandAdjustOpen} onClose={() => setBrandAdjustOpen(false)} title="Today's Brand Rate & Price Adjuster" size="lg">
        <div className="space-y-5">
          {/* Mode Switcher */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setAdjustMode('rate')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                adjustMode === 'rate'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              🎯 Set Today's Base Rate (₹/kg)
            </button>
            <button
              type="button"
              onClick={() => setAdjustMode('delta')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                adjustMode === 'delta'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              📈 +/- Price Difference (₹/kg)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label font-bold">Select Brand *</label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="input font-semibold"
              >
                {availableBrands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {adjustMode === 'rate' ? (
              <div>
                <label className="label font-bold">Today's Rate per kg (₹/kg) *</label>
                <div className="relative">
                  <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    step="0.5"
                    value={todaysRateInput}
                    onChange={(e) => setTodaysRateInput(e.target.value)}
                    placeholder="e.g. 62.00"
                    className="input pl-8 font-extrabold text-lg text-indigo-700 dark:text-indigo-300"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    ₹/kg
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <label className="label font-bold">Per-Kg Rate Difference (₹/kg) *</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    value={priceDelta}
                    onChange={(e) => setPriceDelta(e.target.value)}
                    placeholder="e.g. +3 or -3"
                    className="input font-bold text-lg text-indigo-700 dark:text-indigo-300"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    {parseFloat(priceDelta) > 0 ? 'Increase (+)' : parseFloat(priceDelta) < 0 ? 'Decrease (-)' : 'No change'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 mb-2 flex items-center justify-between">
              <span>Affected Products Preview ({brandProducts.length})</span>
              <span className="text-xs font-normal text-slate-400">Brand: <strong>{selectedBrand}</strong></span>
            </h3>
            {brandProducts.length === 0 ? (
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl text-center text-sm text-slate-400 border border-slate-200 dark:border-slate-800">
                No products currently listed under brand "{selectedBrand}".
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {brandProducts.map((p) => {
                  const isSteel = (p.category || '').toLowerCase().includes('steel') || (p.category || '').toLowerCase().includes('tmt');
                  const stdWeight = p.standard_weight && p.standard_weight > 0 ? p.standard_weight : 1;
                  
                  let newPrice = 0;
                  let rateDisplay = '';

                  if (adjustMode === 'rate') {
                    const rateNum = parseFloat(todaysRateInput) || 0;
                    newPrice = isSteel && p.standard_weight && p.standard_weight > 0 ? round2(rateNum * stdWeight) : rateNum;
                    rateDisplay = `@ ₹${rateNum}/kg`;
                  } else {
                    const deltaNum = parseFloat(priceDelta) || 0;
                    const priceChange = isSteel && p.standard_weight && p.standard_weight > 0 ? deltaNum * stdWeight : deltaNum;
                    newPrice = Math.max(0, (p.price || 0) + priceChange);
                    rateDisplay = deltaNum > 0 ? `(+₹${deltaNum}/kg)` : `(₹${deltaNum}/kg)`;
                  }
                  
                  return (
                    <div key={p.id} className="p-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{p.name}</p>
                        <p className="text-xs text-slate-500">
                          Size: {p.size || 'N/A'} • Unit: {p.unit} • Std Weight: {p.standard_weight || 1} kg
                          {p.bundle_conversion_qty && p.bundle_conversion_qty > 1 && (
                            <span className="ml-2 font-semibold text-amber-600">({p.bundle_conversion_qty} nos/bdl)</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 line-through mr-2">₹{(p.price || 0).toFixed(2)}</span>
                        <span className="font-extrabold text-base text-indigo-700 dark:text-indigo-300">
                          ₹{newPrice.toFixed(2)}
                        </span>
                        <span className="text-xs ml-1.5 font-semibold text-emerald-600">
                          {rateDisplay}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button onClick={() => setBrandAdjustOpen(false)} className="btn-secondary">Cancel</button>
            <button
              onClick={handleBrandPriceAdjust}
              disabled={adjustingBrand || brandProducts.length === 0}
              className="btn-primary flex items-center gap-1.5"
            >
              <TrendingUp size={16} />
              {adjustingBrand ? 'Updating...' : `Apply Today's Rate to ${brandProducts.length} Items`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
