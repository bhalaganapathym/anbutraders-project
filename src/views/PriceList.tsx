import { useCallback, useEffect, useState } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import { api, type Product } from '@/lib/api';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { Search, IndianRupee, Pencil, Layers, TrendingUp, Scale } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

const categories = ['Steel', 'Cement', 'TMT Bars', 'Pipes', 'Other'];

const categoryColor: Record<string, string> = {
  Steel: 'bg-white/20 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200',
  Cement: 'bg-blue-100 text-blue-700',
  'TMT Bars': 'bg-indigo-100/50 dark:bg-indigo-800/40 text-indigo-700 dark:text-indigo-300',
  Pipes: 'bg-emerald-100/50 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300',
  Other: 'bg-violet-100 text-violet-700',
};

export default function PriceList() {
  const { t } = useTranslation();
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState('All');
  const [editing, setEditing] = useState<Product | null>(null);
  const [price, setPrice] = useState('');
  const [ratePerKg, setRatePerKg] = useState('');
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
    .filter((p) => [p.name, p.category, p.brand ?? ''].join(' ').toLowerCase().includes(query.toLowerCase()));

  const openEdit = (p: Product) => {
    setEditing(p);
    const pPrice = Number(p.price ?? 0);
    setPrice(String(pPrice));
    if (p.standard_weight && p.standard_weight > 0) {
      setRatePerKg((pPrice / p.standard_weight).toFixed(2));
    } else {
      setRatePerKg('');
    }
    setOpen(true);
  };

  const handlePriceChange = (val: string) => {
    setPrice(val);
    if (editing?.standard_weight && editing.standard_weight > 0) {
      const pNum = parseFloat(val) || 0;
      setRatePerKg((pNum / editing.standard_weight).toFixed(2));
    }
  };

  const handleRatePerKgChange = (val: string) => {
    setRatePerKg(val);
    if (editing?.standard_weight && editing.standard_weight > 0) {
      const rNum = parseFloat(val) || 0;
      setPrice((rNum * editing.standard_weight).toFixed(2));
    }
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
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t('price_list')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('company_tagline')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50/50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
            <Layers size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{products.length}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('products')}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50/50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
            <IndianRupee size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">₹{avgPrice.toFixed(2)}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('price')}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">₹{maxPrice.toFixed(2)}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('price')}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search')}
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
          <p className="text-slate-500 dark:text-slate-400">No products found.</p>
        </div>
      ) : (
        <>
          {/* MOBILE CARD VIEW (< 768px) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filtered.map((p) => {
              const hasWeight = p.standard_weight && p.standard_weight > 0;
              const rateKg = hasWeight ? ((p.price ?? 0) / p.standard_weight!).toFixed(2) : null;

              return (
                <div key={p.id} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
                  {/* Header: Product Name & Price */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wide truncate">
                        {p.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`badge text-[10px] font-bold ${categoryColor[p.category] ?? categoryColor.Other}`}>
                          {p.category}
                        </span>
                        {p.brand && (
                          <span className="badge bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                            {p.brand}
                          </span>
                        )}
                        {p.size && (
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
                            {p.size}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-black text-amber-600 dark:text-amber-400">
                        ₹{(p.price ?? 0).toFixed(2)}
                      </span>
                      <p className="text-[10px] font-medium text-slate-400">per {p.unit}</p>
                    </div>
                  </div>

                  {/* Micro-metrics: Rate/kg & Standard weight */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Std Weight</span>
                      <p className="font-bold text-slate-700 dark:text-slate-200">
                        {hasWeight ? `${p.standard_weight} kg` : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Rate / Kg</span>
                      <p className="font-extrabold text-indigo-600 dark:text-indigo-400">
                        {rateKg ? `₹${rateKg} / kg` : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => openEdit(p)}
                    className="btn-secondary w-full py-2 text-xs flex items-center justify-center gap-1.5 font-bold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <Pencil size={13} className="text-indigo-600" /> Edit Price
                  </button>
                </div>
              );
            })}
          </div>

          {/* DESKTOP TABLE VIEW (>= 768px) */}
          <div className="hidden md:block table-wrap">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50/75">
                <tr>
                  <th className="th">Product</th>
                  <th className="th">Brand</th>
                  <th className="th">Size</th>
                  <th className="th">Category</th>
                  <th className="th">Unit</th>
                  <th className="th">Std Weight</th>
                  <th className="th">Price / Rate</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => {
                  const hasWeight = p.standard_weight && p.standard_weight > 0;
                  const rateKg = hasWeight ? ((p.price ?? 0) / p.standard_weight!).toFixed(2) : null;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition">
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <Layers size={16} className="text-slate-400" />
                          <span className="font-medium text-slate-800">{p.name}</span>
                        </div>
                      </td>
                      <td className="td">
                        {p.brand ? <span className="badge bg-indigo-50 text-indigo-700">{p.brand}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="td">
                        {p.size ? <span className="font-medium text-slate-600">{p.size}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="td">
                        <span className={`badge ${categoryColor[p.category] ?? categoryColor.Other}`}>
                          {p.category}
                        </span>
                      </td>
                      <td className="td">{p.unit}</td>
                      <td className="td">
                        {hasWeight ? <span className="font-medium text-slate-600">{p.standard_weight} kg</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="td">
                        <div>
                          <span className="flex items-center text-base font-bold text-slate-800">
                            ₹{(p.price ?? 0).toFixed(2)}
                            <span className="ml-1 text-xs font-normal text-slate-400">per {p.unit}</span>
                          </span>
                          {rateKg && (
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                              ₹{rateKg} / kg
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="td text-right">
                        <button onClick={() => openEdit(p)} className="btn-secondary py-1.5 px-3 text-xs">
                          <Pencil size={14} /> Edit Price
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Edit Price Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Update Price" size="md">
        {editing && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 border border-slate-200 dark:border-slate-700">
              <p className="font-bold text-slate-800 dark:text-slate-100">{editing.name}</p>
              <div className="flex gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                {editing.brand && <span>Brand: <strong>{editing.brand}</strong></span>}
                {editing.size && <span>• Size: <strong>{editing.size}</strong></span>}
                <span>• Unit: <strong>{editing.unit}</strong></span>
                {editing.standard_weight ? <span>• Std Weight: <strong>{editing.standard_weight} kg</strong></span> : null}
              </div>
            </div>

            {/* Steel / Product Pricing Linkage */}
            {editing.standard_weight && editing.standard_weight > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                <div>
                  <label className="label flex items-center gap-1">
                    <Scale size={13} className="text-indigo-600" /> Rate per kg (₹/kg)
                  </label>
                  <div className="relative">
                    <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      value={ratePerKg}
                      onChange={(e) => handleRatePerKgChange(e.target.value)}
                      className="input pl-8 font-bold text-indigo-700 dark:text-indigo-300"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Price per {editing.unit} (₹)</label>
                  <div className="relative">
                    <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => handlePriceChange(e.target.value)}
                      className="input pl-8 font-bold text-slate-800 dark:text-slate-100"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="col-span-full text-xs text-indigo-700 dark:text-indigo-300 bg-white/70 dark:bg-slate-800/70 p-2 rounded-lg border border-indigo-200/60 dark:border-indigo-800">
                  💡 1 {editing.unit} ({editing.standard_weight} kg) × ₹{parseFloat(ratePerKg) || 0}/kg = <strong>₹{parseFloat(price) || 0} / {editing.unit}</strong>
                </div>
              </div>
            ) : (
              <div>
                <label className="label">Price per {editing.unit} (₹)</label>
                <div className="relative">
                  <IndianRupee size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="input pl-9 font-bold"
                    min="0"
                    step="0.01"
                    autoFocus
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
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
