import { useCallback, useEffect, useState, useRef } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import { api, type Product } from '@/lib/api';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { Pencil, Plus, Search, Trash2, Package, Layers, IndianRupee, Scale, Box, Upload } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';

type Form = { name: string; category: string; unit: string; price: string; stock_qty: string; brand: string; size: string; standard_weight: string };
const empty: Form = { name: '', category: 'Steel', unit: 'piece', price: '0', stock_qty: '0', brand: '', size: '', standard_weight: '0' };

const categories = ['Steel', 'Cement', 'TMT Bars', 'Pipes', 'Other'];
const knownBrands = ['Tata Steel', 'iSteel', 'Sumangala', 'Suryadev'];
const knownSizes = ['8mm', '10mm', '12mm', '16mm', '20mm', '25mm', '32mm'];

export default function Products() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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

        const productsToUpload = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim());
          if (!cols[nameIdx]) continue;
          
          productsToUpload.push({
            name: cols[nameIdx],
            category: (catIdx !== -1 && cols[catIdx]) ? cols[catIdx] : 'Other',
            unit: (unitIdx !== -1 && cols[unitIdx]) ? cols[unitIdx] : 'piece',
            price: (priceIdx !== -1 && !isNaN(Number(cols[priceIdx]))) ? Number(cols[priceIdx]) : 0,
            stock_qty: (qtyIdx !== -1 && !isNaN(Number(cols[qtyIdx]))) ? Number(cols[qtyIdx]) : 0,
            brand: (brandIdx !== -1 && cols[brandIdx]) ? cols[brandIdx] : null,
            size: (sizeIdx !== -1 && cols[sizeIdx]) ? cols[sizeIdx] : null,
            standard_weight: (weightIdx !== -1 && !isNaN(Number(cols[weightIdx]))) ? Number(cols[weightIdx]) : 0,
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/products');
      setProducts(data);
    } catch (e) {
      toast('Failed to load products', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime('products', load);

  const [unitFilter, setUnitFilter] = useState<'all' | 'kg' | 'piece'>('all');

  const filtered = products.filter((p) =>
    [p.name, p.category].join(' ').toLowerCase().includes(query.toLowerCase())
  );

  const byUnit = (unit: string) => filtered.filter((p) => p.unit.toLowerCase() === unit);
  const kgProducts = byUnit('kg');
  const pieceProducts = byUnit('piece');
  const otherProducts = filtered.filter(
    (p) => p.unit.toLowerCase() !== 'kg' && p.unit.toLowerCase() !== 'piece'
  );

  const visible = unitFilter === 'all' ? filtered : unitFilter === 'kg' ? kgProducts : pieceProducts;

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, category: p.category, unit: p.unit, price: String(p.price ?? 0), stock_qty: String(p.stock_qty), brand: p.brand ?? '', size: p.size ?? '', standard_weight: String(p.standard_weight ?? 0) });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast('Product name is required', 'error');
      return;
    }
    const qty = Number(form.stock_qty) || 0;
    const price = Number(form.price) || 0;
    const stdWt = Number(form.standard_weight) || 0;
    setSaving(true);
    const payload = { name: form.name.trim(), category: form.category, unit: form.unit, price, stock_qty: qty, brand: form.brand.trim() || null, size: form.size.trim() || null, standard_weight: stdWt };
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
    } catch (e) {
      toast('Failed to save product', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Product) => {
    if (!confirm(`Delete product "${p.name}"?`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      toast('Product deleted', 'success');
      load();
    } catch (e) {
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
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Products</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">Manage your product catalog</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
            />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-secondary">
              <Upload size={16} /> {uploading ? 'Importing...' : 'Import CSV'}
            </button>
            <button onClick={openNew} className="btn-primary">
              <Plus size={16} /> Add Product
            </button>
          </div>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products..."
          className="input pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setUnitFilter('all')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            unitFilter === 'all' ? 'bg-indigo-600/80 dark:bg-indigo-600 text-white' : 'border border-white/20 dark:border-slate-700/50 bg-white text-slate-600 dark:text-slate-300 hover:bg-white/20 dark:bg-slate-800/30'
          }`}
        >
          <Package size={14} /> All ({filtered.length})
        </button>
        <button
          onClick={() => setUnitFilter('kg')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            unitFilter === 'kg' ? 'bg-indigo-600/80 dark:bg-indigo-600 text-white' : 'border border-white/20 dark:border-slate-700/50 bg-white text-slate-600 dark:text-slate-300 hover:bg-white/20 dark:bg-slate-800/30'
          }`}
        >
          <Scale size={14} /> Kg Products ({kgProducts.length})
        </button>
        <button
          onClick={() => setUnitFilter('piece')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            unitFilter === 'piece' ? 'bg-indigo-600/80 dark:bg-indigo-600 text-white' : 'border border-white/20 dark:border-slate-700/50 bg-white text-slate-600 dark:text-slate-300 hover:bg-white/20 dark:bg-slate-800/30'
          }`}
        >
          <Box size={14} /> Piece Products ({pieceProducts.length})
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>
      ) : visible.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <Package size={36} className="text-slate-300" />
          <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500">No {unitFilter === 'kg' ? 'kg' : unitFilter === 'piece' ? 'piece' : ''} products found.</p>
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
                    <span className="badge bg-indigo-100/50 dark:bg-indigo-800/40 text-indigo-700 dark:text-indigo-300">{kgProducts.length}</span>
                  </h2>
                  <ProductTable products={kgProducts} categoryColor={categoryColor} onEdit={openEdit} onRemove={remove} isAdmin={isAdmin} />
                </div>
              )}
              {pieceProducts.length > 0 && (
                <div>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    <Box size={16} className="text-indigo-600 dark:text-indigo-400" /> Piece Products
                    <span className="badge bg-indigo-100/50 dark:bg-indigo-800/40 text-indigo-700 dark:text-indigo-300">{pieceProducts.length}</span>
                  </h2>
                  <ProductTable products={pieceProducts} categoryColor={categoryColor} onEdit={openEdit} onRemove={remove} isAdmin={isAdmin} />
                </div>
              )}
              {otherProducts.length > 0 && (
                <div>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    <Package size={16} className="text-indigo-600 dark:text-indigo-400" /> Other Products
                    <span className="badge bg-indigo-100/50 dark:bg-indigo-800/40 text-indigo-700 dark:text-indigo-300">{otherProducts.length}</span>
                  </h2>
                  <ProductTable products={otherProducts} categoryColor={categoryColor} onEdit={openEdit} onRemove={remove} isAdmin={isAdmin} />
                </div>
              )}
            </>
          ) : (
            <ProductTable products={visible} categoryColor={categoryColor} onEdit={openEdit} onRemove={remove} isAdmin={isAdmin} />
          )}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Product' : 'Add Product'}>
        <div className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="e.g. TMT Steel Bar 12mm"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Unit</label>
              <input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="input"
                placeholder="piece, kg, bag..."
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Brand</label>
              <input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="input"
                placeholder="e.g. Tata Steel"
                list="brand-list"
              />
              <datalist id="brand-list">
                {knownBrands.map((b) => <option key={b} value={b} />)}
              </datalist>
            </div>
            <div>
              <label className="label">Size</label>
              <input
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
                className="input"
                placeholder="e.g. 12mm"
                list="size-list"
              />
              <datalist id="size-list">
                {knownSizes.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Standard Weight (kg)</label>
              <input
                type="number"
                value={form.standard_weight}
                onChange={(e) => setForm({ ...form, standard_weight: e.target.value })}
                className="input"
                min="0"
                step="0.01"
              />
            </div>
            <div className="hidden"></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price per unit (₹)</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="input"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="label">Stock Quantity</label>
              <input
                type="number"
                value={form.stock_qty}
                onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
                className="input"
                min="0"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save'}
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
}: {
  products: Product[];
  categoryColor: Record<string, string>;
  onEdit: (p: Product) => void;
  onRemove: (p: Product) => void;
  isAdmin: boolean;
}) {
  return (
    <div className="table-wrap">
      <table className="w-full">
        <thead className="border-b border-white/20 dark:border-slate-700/50 bg-white/20 dark:bg-slate-800/30">
          <tr>
            <th className="th">Product</th>
            <th className="th">Brand</th>
            <th className="th">Size</th>
            <th className="th">Category</th>
            <th className="th">Unit</th>
            <th className="th">Std Wt (kg)</th>
            <th className="th">Price</th>
            <th className="th">Stock</th>
            {isAdmin && <th className="th text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {products.map((p) => (
            <tr key={p.id} className="hover:bg-white/20 dark:bg-slate-800/30">
              <td className="td">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-slate-400 dark:text-slate-500" />
                  <span className="font-medium text-slate-800 dark:text-slate-100">{p.name}</span>
                </div>
              </td>
              <td className="td">
                {p.brand ? <span className="badge bg-indigo-100/50 dark:bg-indigo-800/40 text-indigo-700 dark:text-indigo-300">{p.brand}</span> : <span className="text-slate-300">—</span>}
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
                <span className="flex items-center font-semibold text-slate-700 dark:text-slate-200">
                  <IndianRupee size={13} className="text-slate-400 dark:text-slate-500" />{(p.price ?? 0).toFixed(2)}
                </span>
              </td>
              <td className="td">
                <span className={`font-semibold ${p.stock_qty <= 0 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-200'}`}>
                  {p.stock_qty}
                </span>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
