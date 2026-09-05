import { useCallback, useEffect, useState } from 'react';
import { useRealtime } from '@/lib/useRealtime';
import { api, type Product } from '@/lib/api';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { Search, IndianRupee, Pencil, Layers, Scale, Box, Check, Sparkles, X } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

const categories = ['Steel', 'Cement', 'TMT Bars', 'AAC Blocks', 'Pipes', 'Other'];

const categoryColor: Record<string, string> = {
  Steel: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
  Cement: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  'TMT Bars': 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  'AAC Blocks': 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  Pipes: 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  Other: 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
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

  const availableCategories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const filtered = products
    .filter((p) => activeCat === 'All' || p.category?.toUpperCase() === activeCat.toUpperCase())
    .filter((p) => [p.name, p.category, p.brand ?? '', p.size ?? ''].join(' ').toLowerCase().includes(query.toLowerCase()));

  const openEdit = (p: Product) => {
    setEditing(p);
    const pPrice = Number(p.price ?? 0);
    const stdWt = Number(p.standard_weight || p.piece_weight_kg || 0);
    setPrice(String(pPrice));
    if (stdWt > 0) {
      setRatePerKg((pPrice / stdWt).toFixed(2));
    } else {
      setRatePerKg('');
    }
    setOpen(true);
  };

  const handlePriceChange = (val: string) => {
    setPrice(val);
    const stdWt = Number(editing?.standard_weight || editing?.piece_weight_kg || 0);
    if (stdWt > 0) {
      const pNum = parseFloat(val) || 0;
      setRatePerKg((pNum / stdWt).toFixed(2));
    }
  };

  const handleRatePerKgChange = (val: string) => {
    setRatePerKg(val);
    const stdWt = Number(editing?.standard_weight || editing?.piece_weight_kg || 0);
    if (stdWt > 0) {
      const rNum = parseFloat(val) || 0;
      setPrice((rNum * stdWt).toFixed(2));
    }
  };

  const save = async () => {
    if (!editing) return;
    const val = Number(price) || 0;
    setSaving(true);
    try {
      await api.put(`/products/${editing.id}`, {
        ...editing,
        price: val
      });
      toast(`Price updated for ${editing.name}`, 'success');
      setOpen(false);
      load();
    } catch {
      toast('Failed to update price', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Single Statistics Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            {t('price_list')}
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            {t('company_tagline')}
          </p>
        </div>

        {/* Product Count Metric Card (Single card kept as requested) */}
        <div className="flex items-center gap-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-2xl shadow-sm self-start sm:self-auto">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Layers size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100 leading-none">
              {products.length}
            </p>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              {t('products')} Listed
            </p>
          </div>
        </div>
      </div>

      {/* Search & Category Filter Toolbar */}
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

          {/* Result Count Indicator */}
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-1">
            Showing <strong className="text-slate-800 dark:text-slate-200">{filtered.length}</strong> of {products.length} items
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 text-xs">
          {availableCategories.map((c) => {
            const count = c === 'All' ? products.length : products.filter(p => p.category?.toUpperCase() === c.toUpperCase()).length;
            const isActive = activeCat.toUpperCase() === c.toUpperCase();
            return (
              <button
                key={c}
                onClick={() => setActiveCat(c)}
                className={`rounded-xl px-3.5 py-1.5 font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-500/30'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{c}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-amber-700/80 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm font-semibold text-slate-400">Loading price list...</div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <Search size={24} />
          </div>
          <p className="text-base font-bold text-slate-700 dark:text-slate-200">No products match your search</p>
          <p className="text-xs text-slate-400">Try changing your search terms or category filter.</p>
          <button onClick={() => { setQuery(''); setActiveCat('All'); }} className="btn-secondary text-xs mt-1">
            Clear Filters
          </button>
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

                  {/* Micro-metrics: Rate/kg & Std Weight */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Std Weight</span>
                      <p className="font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                        {hasWeight ? `${stdWt} kg` : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rate / Kg</span>
                      <p className="font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {rateKg ? `₹${rateKg} / kg` : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => openEdit(p)}
                    className="btn-secondary w-full py-2 text-xs flex items-center justify-center gap-1.5 font-bold bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl transition"
                  >
                    <Pencil size={13} className="text-amber-600" /> Edit Price
                  </button>
                </div>
              );
            })}
          </div>

          {/* DESKTOP TABLE VIEW (>= 768px) */}
          <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
                <tr>
                  <th className="th py-3.5">Product & Specifications</th>
                  <th className="th py-3.5">Brand</th>
                  <th className="th py-3.5">Category</th>
                  <th className="th py-3.5">Unit</th>
                  <th className="th py-3.5">Std Weight</th>
                  <th className="th py-3.5">Price & Rate</th>
                  <th className="th py-3.5 text-right">Actions</th>
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
                      <td className="td py-3.5 text-right">
                        <button
                          onClick={() => openEdit(p)}
                          className="btn-secondary py-1.5 px-3 text-xs font-bold rounded-xl hover:border-amber-400 hover:text-amber-700 transition inline-flex items-center gap-1.5"
                        >
                          <Pencil size={13} className="text-amber-600" /> Edit Price
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
      <Modal open={open} onClose={() => setOpen(false)} title="Update Product Price" size="md">
        {editing && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3.5 border border-slate-200 dark:border-slate-700">
              <p className="font-black text-base text-slate-900 dark:text-slate-100 uppercase">{editing.name}</p>
              <div className="flex gap-2 text-xs text-slate-500 mt-1.5 flex-wrap">
                {editing.brand && <span>Brand: <strong className="text-slate-700 dark:text-slate-300">{editing.brand}</strong></span>}
                {editing.size && <span>• Size: <strong className="text-slate-700 dark:text-slate-300">{editing.size}</strong></span>}
                <span>• Unit: <strong className="text-slate-700 dark:text-slate-300">{editing.unit}</strong></span>
                {(editing.standard_weight || editing.piece_weight_kg) ? (
                  <span>• Std Weight: <strong className="text-slate-700 dark:text-slate-300">{editing.standard_weight || editing.piece_weight_kg} kg</strong></span>
                ) : null}
              </div>
            </div>

            {/* Steel / Product Pricing Linkage */}
            {(editing.standard_weight && editing.standard_weight > 0) || (editing.piece_weight_kg && editing.piece_weight_kg > 0) ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                <div>
                  <label className="label flex items-center gap-1 font-bold">
                    <Scale size={13} className="text-indigo-600" /> Rate per kg (₹/kg)
                  </label>
                  <div className="relative">
                    <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      value={ratePerKg}
                      onChange={(e) => handleRatePerKgChange(e.target.value)}
                      className="input pl-8 font-bold text-indigo-700 dark:text-indigo-300 text-base"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="label font-bold">Price per {editing.unit} (₹)</label>
                  <div className="relative">
                    <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => handlePriceChange(e.target.value)}
                      className="input pl-8 font-black text-slate-900 dark:text-slate-100 text-base"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="col-span-full text-xs text-indigo-800 dark:text-indigo-300 bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-indigo-200/60 dark:border-indigo-800 font-medium">
                  💡 1 {editing.unit} ({editing.standard_weight || editing.piece_weight_kg} kg) × ₹{parseFloat(ratePerKg) || 0}/kg = <strong>₹{parseFloat(price) || 0} / {editing.unit}</strong>
                </div>
              </div>
            ) : (
              <div>
                <label className="label font-bold">Price per {editing.unit} (₹)</label>
                <div className="relative">
                  <IndianRupee size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="input pl-9 font-black text-lg"
                    min="0"
                    step="0.01"
                    autoFocus
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
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
