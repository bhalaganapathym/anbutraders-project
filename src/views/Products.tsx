import { useCallback, useEffect, useState, useRef } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import { api, type Product } from '@/lib/api';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { Pencil, Plus, Search, Trash2, Package, Layers, IndianRupee, Scale, Box, Upload, TrendingUp } from 'lucide-react';
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
  weight_tolerance: ''
};

const categories = ['Steel', 'Cement', 'TMT Bars', 'Pipes', 'Other'];
const knownBrands = ['Tata Steel', 'iSteel', 'Sumangala', 'Suryadev'];
const knownSizes = ['8mm', '10mm', '12mm', '16mm', '20mm', '25mm', '32mm'];

export default function Products() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canEditTolerance = user?.role === 'admin' || user?.role === 'billing';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);
  const [unitFilter, setUnitFilter] = useState<'all' | 'kg' | 'piece'>('all');

  const [brandAdjustOpen, setBrandAdjustOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState('iSteel');
  const [priceDelta, setPriceDelta] = useState('0');
  const [adjustingBrand, setAdjustingBrand] = useState(false);

  const availableBrands = Array.from(
    new Set([
      ...knownBrands,
      ...products.map(p => p.brand).filter(Boolean) as string[]
    ])
  );

  const brandProducts = products.filter(
    (p) => (p.brand || '').toLowerCase() === selectedBrand.toLowerCase()
  );

  const handleBrandPriceAdjust = async () => {
    const deltaNum = parseFloat(priceDelta);
    if (isNaN(deltaNum) || deltaNum === 0) {
      toast('Please enter a non-zero price difference (e.g. +3 or -3)', 'error');
      return;
    }
    setAdjustingBrand(true);
    try {
      const res = await api.post('/products/adjust-brand-prices', {
        brand: selectedBrand,
        price_delta: deltaNum,
      });
      toast(res.message || `Updated prices for ${selectedBrand}`, 'success');
      setBrandAdjustOpen(false);
      setPriceDelta('0');
      load();
    } catch (err: any) {
      toast(err?.message || 'Failed to update brand prices', 'error');
    } finally {
      setAdjustingBrand(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/products');
      setProducts(data);
    } catch {
      toast('Failed to load products', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime('products', load);

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

  const filtered = products.filter((p) =>
    [p.name, p.brand ?? '', p.size ?? '', p.category].join(' ').toLowerCase().includes(query.toLowerCase())
  );

  const kgProducts = filtered.filter(p => p.unit.toLowerCase() === 'kg');
  const pieceProducts = filtered.filter(p => p.unit.toLowerCase() === 'piece');
  const otherProducts = filtered.filter(p => p.unit.toLowerCase() !== 'kg' && p.unit.toLowerCase() !== 'piece');

  const visible = unitFilter === 'kg' ? kgProducts : unitFilter === 'piece' ? pieceProducts : filtered;

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    const pPrice = Number(p.price ?? 0);
    const pStdWeight = Number(p.standard_weight ?? 0);
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

  const categoryColor: Record<string, string> = {
    Steel: 'bg-white/20 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200',
    Cement: 'bg-blue-100 text-blue-700',
    'TMT Bars': 'bg-indigo-100/50 dark:bg-indigo-800/40 text-indigo-700 dark:text-indigo-300',
    Pipes: 'bg-emerald-100/50 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300',
    Other: 'bg-violet-100 text-violet-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t('products')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('company_tagline')}</p>
        </div>
        <div className="flex gap-2">
          {canEditTolerance && (
            <button onClick={() => setBrandAdjustOpen(true)} className="btn-secondary flex items-center gap-1.5 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50">
              <TrendingUp size={16} /> {t('edit_brand_prices')}
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
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-secondary">
                <Upload size={16} /> {uploading ? t('loading') : t('export_csv')}
              </button>
              <button onClick={openNew} className="btn-primary">
                <Plus size={16} /> {t('add_product')}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search')}
          className="input pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setUnitFilter('all')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            unitFilter === 'all' ? 'bg-indigo-600 dark:bg-indigo-600 text-white' : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <Package size={14} /> {t('all')} ({filtered.length})
        </button>
        <button
          onClick={() => setUnitFilter('kg')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            unitFilter === 'kg' ? 'bg-indigo-600 dark:bg-indigo-600 text-white' : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <Scale size={14} /> Kg ({kgProducts.length})
        </button>
        <button
          onClick={() => setUnitFilter('piece')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            unitFilter === 'piece' ? 'bg-indigo-600 dark:bg-indigo-600 text-white' : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <Box size={14} /> Piece ({pieceProducts.length})
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">{t('loading')}</p>
      ) : visible.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <Package size={36} className="text-slate-300" />
          <p className="text-slate-500 dark:text-slate-400">No {unitFilter === 'kg' ? 'kg' : unitFilter === 'piece' ? 'piece' : ''} products found.</p>
          {isAdmin && (
            <button onClick={openNew} className="btn-primary">
              <Plus size={16} /> Add product
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {unitFilter === 'all' ? (
            <>
              {kgProducts.length > 0 && (
                <div>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    <Scale size={16} className="text-indigo-600 dark:text-indigo-400" /> Kg Products
                    <span className="badge bg-indigo-100 dark:bg-indigo-800/40 text-indigo-700 dark:text-indigo-300">{kgProducts.length}</span>
                  </h2>
                  <ProductTable products={kgProducts} categoryColor={categoryColor} onEdit={openEdit} onRemove={remove} isAdmin={isAdmin} canEditTolerance={canEditTolerance} onUpdateTolerance={updateTolerance} />
                </div>
              )}
              {pieceProducts.length > 0 && (
                <div>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    <Box size={16} className="text-indigo-600 dark:text-indigo-400" /> Piece Products
                    <span className="badge bg-indigo-100 dark:bg-indigo-800/40 text-indigo-700 dark:text-indigo-300">{pieceProducts.length}</span>
                  </h2>
                  <ProductTable products={pieceProducts} categoryColor={categoryColor} onEdit={openEdit} onRemove={remove} isAdmin={isAdmin} canEditTolerance={canEditTolerance} onUpdateTolerance={updateTolerance} />
                </div>
              )}
              {otherProducts.length > 0 && (
                <div>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    <Package size={16} className="text-indigo-600 dark:text-indigo-400" /> Other Products
                    <span className="badge bg-indigo-100 dark:bg-indigo-800/40 text-indigo-700 dark:text-indigo-300">{otherProducts.length}</span>
                  </h2>
                  <ProductTable products={otherProducts} categoryColor={categoryColor} onEdit={openEdit} onRemove={remove} isAdmin={isAdmin} canEditTolerance={canEditTolerance} onUpdateTolerance={updateTolerance} />
                </div>
              )}
            </>
          ) : (
            <ProductTable products={visible} categoryColor={categoryColor} onEdit={openEdit} onRemove={remove} isAdmin={isAdmin} canEditTolerance={canEditTolerance} onUpdateTolerance={updateTolerance} />
          )}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Product' : 'Add Product'} size="md">
        <div className="space-y-4">
          <div>
            <label className="label">Name * (SAVED IN UPPERCASE)</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })}
              className="input font-semibold uppercase"
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
                className="input uppercase font-medium"
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
                className="input uppercase"
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
                placeholder="e.g. TATA STEEL"
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Standard Weight (kg)</label>
              <input
                type="number"
                value={form.standard_weight}
                onChange={(e) => handleStdWeightChange(e.target.value)}
                className="input font-semibold"
                min="0"
                step="0.01"
                placeholder="e.g. 4.7"
              />
            </div>
            <div>
              <label className="label">Difference Tolerance (kg)</label>
              <input
                type="number"
                value={form.weight_tolerance}
                onChange={(e) => setForm({ ...form, weight_tolerance: e.target.value })}
                className="input"
                min="0"
                step="0.1"
                placeholder="e.g. 2.0 (optional)"
              />
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

      {/* Brand Steel Rate Adjuster Modal */}
      <Modal open={brandAdjustOpen} onClose={() => setBrandAdjustOpen(false)} title="Brand Steel Rate Adjuster" size="lg">
        <div className="space-y-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Adjust the rate per kg for all steel products of a brand simultaneously by entering a per-kg price difference (e.g. <strong className="text-emerald-600">+3</strong> or <strong className="text-amber-600">-3</strong> ₹/kg). Unit prices will be updated automatically based on standard weights.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Select Brand *</label>
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

            <div>
              <label className="label">Per-Kg Rate Difference (₹/kg) *</label>
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
          </div>

          <div>
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 mb-2 flex items-center justify-between">
              <span>Affected Products Preview ({brandProducts.length})</span>
              <span className="text-xs font-normal text-slate-400">Brand: <strong>{selectedBrand}</strong></span>
            </h3>
            {brandProducts.length === 0 ? (
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg text-center text-sm text-slate-400">
                No products currently listed under brand "{selectedBrand}".
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {brandProducts.map((p) => {
                  const deltaNum = parseFloat(priceDelta) || 0;
                  const isSteel = (p.category || '').toLowerCase().includes('steel') || (p.category || '').toLowerCase().includes('tmt');
                  const stdWeight = p.standard_weight && p.standard_weight > 0 ? p.standard_weight : 1;
                  const priceChange = isSteel && p.standard_weight && p.standard_weight > 0 ? deltaNum * stdWeight : deltaNum;
                  const newPrice = Math.max(0, (p.price || 0) + priceChange);
                  
                  return (
                    <div key={p.id} className="p-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{p.name}</p>
                        <p className="text-xs text-slate-500">
                          Size: {p.size || 'N/A'} • Unit: {p.unit} • Std Weight: {p.standard_weight || 1} kg
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 line-through mr-2">₹{(p.price || 0).toFixed(2)}</span>
                        <span className={`font-extrabold text-base ${deltaNum > 0 ? 'text-emerald-600 dark:text-emerald-400' : deltaNum < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'}`}>
                          ₹{newPrice.toFixed(2)}
                        </span>
                        {deltaNum !== 0 && (
                          <span className={`text-xs ml-1.5 font-semibold ${deltaNum > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            ({deltaNum > 0 ? `+₹${deltaNum}/kg` : `₹${deltaNum}/kg`})
                          </span>
                        )}
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
              disabled={adjustingBrand || brandProducts.length === 0 || parseFloat(priceDelta) === 0 || isNaN(parseFloat(priceDelta))}
              className="btn-primary flex items-center gap-1.5"
            >
              <TrendingUp size={16} />
              {adjustingBrand ? 'Updating...' : `Apply ${parseFloat(priceDelta) > 0 ? `+₹${priceDelta}/kg` : `₹${priceDelta}/kg`} to ${brandProducts.length} Items`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ProductTable({
  products,
  categoryColor,
  onEdit,
  onRemove,
  isAdmin,
  canEditTolerance,
  onUpdateTolerance,
}: {
  products: Product[];
  categoryColor: Record<string, string>;
  onEdit: (p: Product) => void;
  onRemove: (p: Product) => void;
  isAdmin: boolean;
  canEditTolerance: boolean;
  onUpdateTolerance: (p: Product, newTol: number | null) => void;
}) {
  const [editingTolId, setEditingTolId] = useState<string | null>(null);
  const [tolValue, setTolValue] = useState<string>('');

  const startEditTol = (p: Product) => {
    if (!canEditTolerance) return;
    setEditingTolId(p.id);
    setTolValue(p.weight_tolerance != null ? String(p.weight_tolerance) : '');
  };

  const finishEditTol = (p: Product) => {
    setEditingTolId(null);
    const parsed = tolValue.trim() === '' ? null : parseFloat(tolValue);
    if (parsed !== p.weight_tolerance) {
      onUpdateTolerance(p, isNaN(parsed as number) ? null : parsed);
    }
  };

  return (
    <div className="table-wrap">
      <table className="w-full">
        <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
          <tr>
            <th className="th">Product</th>
            <th className="th">Brand</th>
            <th className="th">Size</th>
            <th className="th">Category</th>
            <th className="th">Unit</th>
            <th className="th">Std Wt (kg)</th>
            <th className="th">Est. Diff (kg)</th>
            <th className="th">Price / Rate</th>
            {isAdmin && <th className="th text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {products.map((p) => {
            const hasWeight = p.standard_weight && p.standard_weight > 0;
            const rateKg = hasWeight ? ((p.price ?? 0) / p.standard_weight!).toFixed(2) : null;

            return (
              <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="td">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-slate-400" />
                    <span className="font-medium text-slate-800 dark:text-slate-100">{p.name}</span>
                  </div>
                </td>
                <td className="td">
                  {p.brand ? <span className="badge bg-indigo-100 dark:bg-indigo-800/40 text-indigo-700 dark:text-indigo-300">{p.brand}</span> : <span className="text-slate-300">—</span>}
                </td>
                <td className="td">
                  {p.size ? <span className="font-medium text-slate-600 dark:text-slate-300">{p.size}</span> : <span className="text-slate-300">—</span>}
                </td>
                <td className="td">
                  <span className={`badge ${categoryColor[p.category] ?? categoryColor.Other}`}>
                    {p.category}
                  </span>
                </td>
                <td className="td">{p.unit}</td>
                <td className="td">
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    {p.standard_weight ? `${p.standard_weight} kg` : '—'}
                  </span>
                </td>
                <td className="td">
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
                      className={`font-medium ${canEditTolerance ? 'cursor-pointer hover:underline text-amber-700 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}`}
                      title={canEditTolerance ? 'Click to edit weight tolerance' : undefined}
                    >
                      {p.weight_tolerance != null ? `±${p.weight_tolerance} kg` : 'Default'}
                    </span>
                  )}
                </td>
                <td className="td">
                  <div>
                    <span className="flex items-center font-bold text-slate-800 dark:text-slate-200">
                      <IndianRupee size={13} className="text-slate-400" />{(p.price ?? 0).toFixed(2)}
                    </span>
                    {rateKg && (
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                        (₹{rateKg}/kg)
                      </span>
                    )}
                  </div>
                </td>
                {isAdmin && (
                  <td className="td text-right">
                    <button onClick={() => onEdit(p)} className="btn-ghost p-1.5" aria-label="Edit">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => onRemove(p)} className="btn-ghost p-1.5 text-rose-500 hover:bg-rose-50" aria-label="Delete">
                      <Trash2 size={15} />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
