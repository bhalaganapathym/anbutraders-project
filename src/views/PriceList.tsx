import { useCallback, useEffect, useState } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import { api, type Product } from '@/lib/api';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { Search, IndianRupee, Pencil, Layers, TrendingUp } from 'lucide-react';

const categories = ['Steel', 'Cement', 'TMT Bars', 'Pipes', 'Other'];

const categoryColor: Record<string, string> = {
  Steel: 'bg-white/20 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200',
  Cement: 'bg-blue-100 text-blue-700',
  'TMT Bars': 'bg-indigo-100/50 dark:bg-indigo-800/40 text-indigo-700 dark:text-indigo-300',
  Pipes: 'bg-emerald-100/50 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300',
  Other: 'bg-violet-100 text-violet-700',
};

export default function PriceList() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState('All');
  const [editing, setEditing] = useState<Product | null>(null);
  const [price, setPrice] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/products');
      setProducts(data as Product[]);
    } catch (e) {
      toast('Failed to load products', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime('products', load);

  const cats = ['All', ...categories.filter((c) => products.some((p) => p.category === c))];

  const filtered = products
    .filter((p) => activeCat === 'All' || p.category === activeCat)
    .filter((p) => [p.name, p.category].join(' ').toLowerCase().includes(query.toLowerCase()));

  const openEdit = (p: Product) => {
    setEditing(p);
    setPrice(String(p.price ?? 0));
    setOpen(true);
  };

  const save = async () => {
    const val = Number(price) || 0;
    setSaving(true);
    try {
      await api.put(`/products/${editing!.id}`, {
        ...editing,
        price: val
      });
      toast('Price updated', 'success');
    } catch {
      toast('Failed to update price', 'error');
    }
    setSaving(false);
    setOpen(false);
    load();
  };

  const avgPrice =
    products.length > 0
      ? products.reduce((s, p) => s + (p.price ?? 0), 0) / products.length
      : 0;
  const maxPrice = products.reduce((m, p) => Math.max(m, p.price ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Product Price List</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">View and update prices for all products</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50/50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
            <Layers size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{products.length}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">Total Products</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50/50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
            <IndianRupee size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">₹{avgPrice.toFixed(2)}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">Average Price</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">₹{maxPrice.toFixed(2)}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">Highest Price</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products..."
            className="input pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCat(c)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                activeCat === c
                  ? 'bg-indigo-600/80 dark:bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 dark:text-slate-300 border border-white/20 dark:border-slate-700/50 hover:bg-white/20 dark:bg-slate-800/30'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <IndianRupee size={36} className="text-slate-300" />
          <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500">No products found.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead className="border-b border-white/20 dark:border-slate-700/50 bg-white/20 dark:bg-slate-800/30">
              <tr>
                <th className="th">Product</th>
                <th className="th">Brand</th>
                <th className="th">Size</th>
                <th className="th">Category</th>
                <th className="th">Unit</th>
                <th className="th">Price</th>
                <th className="th">Stock</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => (
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
                    <span className="flex items-center text-base font-bold text-indigo-700 dark:text-indigo-300">
                      <IndianRupee size={14} className="text-amber-500" />
                      {(p.price ?? 0).toFixed(2)}
                      <span className="ml-1 text-xs font-normal text-slate-400 dark:text-slate-500">per {p.unit}</span>
                    </span>
                  </td>
                  <td className="td">
                    <span className={`font-semibold ${p.stock_qty <= 0 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-200'}`}>
                      {p.stock_qty}
                    </span>
                  </td>
                  <td className="td text-right">
                    <button onClick={() => openEdit(p)} className="btn-secondary">
                      <Pencil size={14} /> Edit Price
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Update Price" size="sm">
        {editing && (
          <div className="space-y-4">
            <div className="rounded-lg bg-white/20 dark:bg-slate-800/30 p-3">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{editing.name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                {editing.brand && `${editing.brand} `}
                {editing.size && `· ${editing.size} `}
                {editing.category} · per {editing.unit}
              </p>
            </div>
            <div>
              <label className="label">Price per unit (₹)</label>
              <div className="relative">
                <IndianRupee size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="input pl-9"
                  min="0"
                  step="0.01"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : 'Save Price'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
