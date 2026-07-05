import { useEffect, useMemo, useState, FormEvent } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  Loader2,
  AlertCircle,
  Tag,
  Boxes,
  Filter,
  ArrowUpDown,
  Barcode as BarcodeIcon,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Product } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatMoney, classNames } from '../../lib/utils';
import { PageContainer, PageHeader, Card, Button, Spinner, EmptyState, Modal, ConfirmDialog, Badge } from '../ui/Shared';
import Barcode from '../barcode/Barcode';
import ImageDropzone from '../ui/ImageDropzone';

type SortKey = 'name' | 'price' | 'stock' | 'created_at';
type SortDir = 'asc' | 'desc';

const RESTAURANT_PRODUCT_CATEGORIES = ['Beverage', 'Meal', 'Dessert', 'Fast Food', 'Starter', 'Snack', 'Combo', 'Breakfast', 'Lunch', 'Dinner'];

export default function Products() {
  const { business } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [barcodeTarget, setBarcodeTarget] = useState<Product | null>(null);

  const currency = business?.currency ?? 'BDT';

  const load = async () => {
    if (!business) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
    } else {
      setProducts(data as Product[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [business]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.category) set.add(p.category); });
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = products.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (stockFilter === 'in' && p.stock <= 5) return false;
      if (stockFilter === 'low' && (p.stock === 0 || p.stock > 5)) return false;
      if (stockFilter === 'out' && p.stock > 0) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.sku?.toLowerCase().includes(q) ?? false) || (p.category?.toLowerCase().includes(q) ?? false);
    });
    out.sort((a, b) => {
      let av: string | number = a[sortKey] as string | number;
      let bv: string | number = b[sortKey] as string | number;
      if (sortKey === 'price' || sortKey === 'stock') {
        av = Number(av); bv = Number(bv);
      } else {
        av = String(av).toLowerCase(); bv = String(bv).toLowerCase();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return out;
  }, [products, search, categoryFilter, stockFilter, sortKey, sortDir]);

  const stats = useMemo(() => ({
    total: products.length,
    active: products.filter((p) => p.is_active).length,
    lowStock: products.filter((p) => p.is_active && p.stock > 0 && p.stock <= 5).length,
    outStock: products.filter((p) => p.is_active && p.stock === 0).length,
    inventoryValue: products.filter((p) => p.is_active).reduce((acc, p) => acc + Number(p.cost) * p.stock, 0),
  }), [products]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('products').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      console.error(error);
      return;
    }
    setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setShowForm(true);
  };

  const openNew = () => {
    setEditing(null);
    setShowForm(true);
  };

  const generateBarcodeValue = () => {
    // Generate a unique numeric code suitable for CODE128 / EAN-13-ish display
    const ts = Date.now().toString().slice(-8);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${ts}${rand}`;
  };

  const assignBarcode = async (p: Product) => {
    const code = generateBarcodeValue();
    const { data, error } = await supabase
      .from('products')
      .update({ sku: code, updated_at: new Date().toISOString() })
      .eq('id', p.id)
      .select()
      .single();
    if (error) {
      console.error(error);
      return;
    }
    const updated = data as Product;
    setProducts((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    setBarcodeTarget(updated);
  };

  const printBarcode = (p: Product) => {
    const svgEl = document.getElementById(`barcode-print-${p.id}`);
    if (!svgEl) return;
    const name = p.name;
    const price = formatMoney(Number(p.price), currency);
    const w = window.open('', '_blank', 'width=400,height=320');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Barcode - ${name}</title>
      <style>
        @page { size: 100mm 60mm; margin: 0; }
        body { margin:0; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; padding:8px; box-sizing:border-box; }
        .label { text-align:center; }
        .name { font-size:13px; font-weight:700; color:#0f172a; margin-bottom:2px; max-width:80mm; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .price { font-size:15px; font-weight:800; color:#0f172a; margin-bottom:4px; }
        .code { font-size:11px; color:#64748b; font-family: monospace; margin-top:2px; }
        svg { max-width:80mm; height:auto; }
      </style></head><body>
      <div class="label">
        <div class="name">${name.replace(/</g, '&lt;')}</div>
        <div class="price">${price}</div>
        ${svgEl.outerHTML}
        <div class="code">${p.sku ?? ''}</div>
      </div>
      <script>window.onload=function(){setTimeout(function(){window.print();},200);};</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <PageContainer>
      <PageHeader
        title="Products"
        subtitle="Manage your inventory, pricing, and stock levels."
        action={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" />
            Add product
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MiniStat label="Total products" value={String(stats.total)} icon={Package} tint="bg-brand-50 text-brand-600" />
        <MiniStat label="Active" value={String(stats.active)} icon={Tag} tint="bg-emerald-50 text-emerald-600" />
        <MiniStat label="Low stock" value={String(stats.lowStock)} icon={Boxes} tint="bg-amber-50 text-amber-600" />
        <MiniStat label="Out of stock" value={String(stats.outStock)} icon={AlertCircle} tint="bg-rose-50 text-rose-600" />
      </div>

      {/* Toolbar */}
      <Card className="p-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-8 py-2 text-sm outline-none focus:border-brand-400 cursor-pointer"
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as 'all' | 'in' | 'low' | 'out')}
              className="appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-2 text-sm outline-none focus:border-brand-400 cursor-pointer"
            >
              <option value="all">All stock</option>
              <option value="in">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <Spinner label="Loading products…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title={products.length === 0 ? 'No products yet' : 'No products match your filters'}
            description={products.length === 0 ? 'Add your first product to start selling.' : 'Try adjusting your search or filters.'}
            action={products.length === 0 ? (
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" />
                Add product
              </Button>
            ) : undefined}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-xs text-slate-500 uppercase tracking-wide">
                    <th className="text-left font-semibold px-4 py-3">
                      <SortButton label="Name" active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
                    </th>
                    <th className="text-left font-semibold px-4 py-3">Category</th>
                    <th className="text-right font-semibold px-4 py-3">
                      <SortButton label="Price" active={sortKey === 'price'} dir={sortDir} onClick={() => toggleSort('price')} align="right" />
                    </th>
                    <th className="text-right font-semibold px-4 py-3">Cost</th>
                    <th className="text-right font-semibold px-4 py-3">
                      <SortButton label="Stock" active={sortKey === 'stock'} dir={sortDir} onClick={() => toggleSort('stock')} align="right" />
                    </th>
                    <th className="text-left font-semibold px-4 py-3">Barcode</th>
                    <th className="text-right font-semibold px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-slate-100 grid place-items-center overflow-hidden shrink-0">
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                            ) : (
                              <Tag className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                            {p.sku && <p className="text-xs text-slate-500">SKU: {p.sku}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.category ? <Badge>{p.category}</Badge> : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatMoney(Number(p.price), currency)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{formatMoney(Number(p.cost), currency)}</td>
                      <td className="px-4 py-3 text-right">
                        <StockBadge stock={p.stock} />
                      </td>
                      <td className="px-4 py-3">
                        {p.sku ? (
                          <button
                            onClick={() => setBarcodeTarget(p)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 hover:bg-slate-200 px-2 py-1 text-xs font-mono text-slate-700 transition-colors"
                            title="View / print barcode"
                          >
                            <BarcodeIcon className="h-3.5 w-3.5" />
                            {p.sku.length > 12 ? `${p.sku.slice(0, 12)}…` : p.sku}
                          </button>
                        ) : (
                          <button
                            onClick={() => assignBarcode(p)}
                            className="inline-flex items-center gap-1 rounded-md bg-brand-50 hover:bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-700 transition-colors"
                            title="Generate barcode"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Generate
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50" title="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map((p) => (
                <div key={p.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-lg bg-slate-100 grid place-items-center overflow-hidden shrink-0">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <Tag className="h-6 w-6 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                          {p.category && <p className="text-xs text-slate-500 truncate">{p.category}</p>}
                        </div>
                        <p className="font-bold text-slate-900 shrink-0">{formatMoney(Number(p.price), currency)}</p>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <StockBadge stock={p.stock} />
                        <div className="flex items-center gap-1">
                          {p.sku ? (
                            <button onClick={() => setBarcodeTarget(p)} className="p-1.5 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50" title="Barcode">
                              <BarcodeIcon className="h-4 w-4" />
                            </button>
                          ) : (
                            <button onClick={() => assignBarcode(p)} className="p-1.5 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50" title="Generate barcode">
                              <RefreshCw className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {showForm && (
        <ProductForm
          open={showForm}
          onClose={() => setShowForm(false)}
          product={editing}
          categories={categories}
          currency={currency}
          onSaved={(p, isNew) => {
            if (isNew) {
              setProducts((prev) => [p, ...prev]);
            } else {
              setProducts((prev) => prev.map((x) => (x.id === p.id ? p : x)));
            }
            setShowForm(false);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        busy={deleting}
      />

      {barcodeTarget && (
        <BarcodeModal
          product={barcodeTarget}
          currency={currency}
          onClose={() => setBarcodeTarget(null)}
          onPrint={printBarcode}
          onRegenerate={() => assignBarcode(barcodeTarget)}
        />
      )}
    </PageContainer>
  );
}

function MiniStat({ label, value, icon: Icon, tint }: { label: string; value: string; icon: typeof Package; tint: string }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={classNames('h-10 w-10 rounded-xl grid place-items-center shrink-0', tint)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 truncate">{label}</p>
        <p className="text-lg font-extrabold text-slate-900">{value}</p>
      </div>
    </Card>
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <Badge color="red">Out of stock</Badge>;
  if (stock <= 5) return <Badge color="amber">{stock} left</Badge>;
  return <Badge color="green">{stock} in stock</Badge>;
}

function SortButton({ label, active, dir, onClick, align = 'left' }: { label: string; active: boolean; dir: SortDir; onClick: () => void; align?: 'left' | 'right' }) {
  return (
    <button onClick={onClick} className={classNames('inline-flex items-center gap-1 hover:text-slate-700', align === 'right' && 'flex-row-reverse')}>
      {label}
      <ArrowUpDown className={classNames('h-3 w-3', active ? 'text-brand-600' : 'text-slate-300')} />
      {active && <span className="text-[10px] text-brand-600">{dir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  );
}

function ProductForm({
  open,
  onClose,
  product,
  categories,
  currency,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  categories: string[];
  currency: string;
  onSaved: (p: Product, isNew: boolean) => void;
}) {
  const { business } = useAuth();
  const [form, setForm] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    category: product?.category ?? '',
    price: product ? String(product.price) : '',
    cost: product ? String(product.cost) : '',
    stock: product ? String(product.stock) : '0',
    sku: product?.sku ?? '',
    image_url: product?.image_url ?? '',
    is_active: product?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!business) return;
    setError(null);
    if (!form.name.trim()) {
      setError('Product name is required.');
      return;
    }
    if (form.price === '' || Number(form.price) < 0) {
      setError('Please enter a valid price.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        business_id: business.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        price: Number(form.price),
        cost: Number(form.cost) || 0,
        stock: Number(form.stock) || 0,
        sku: form.sku.trim() || null,
        image_url: form.image_url.trim() || null,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };
      if (product) {
        const { data, error } = await supabase.from('products').update(payload).eq('id', product.id).select().single();
        if (error) throw error;
        onSaved(data as Product, false);
      } else {
        const { data, error } = await supabase.from('products').insert(payload).select().single();
        if (error) throw error;
        onSaved(data as Product, true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={product ? 'Edit product' : 'Add product'} size="lg">
      <form onSubmit={submit} className="p-5 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Product name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="e.g. Margherita Pizza"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Optional description"
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Category</label>
            {business?.category === 'restaurant' ? (
              <select
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              >
                <option value="">Select category</option>
                {[...new Set([...RESTAURANT_PRODUCT_CATEGORIES, ...categories])].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => update('category', e.target.value)}
                  list="product-categories"
                  placeholder="e.g. Beverages"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
                <datalist id="product-categories">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">SKU / Barcode</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.sku}
                onChange={(e) => update('sku', e.target.value)}
                placeholder="Optional"
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
              <button
                type="button"
                onClick={() => {
                  const ts = Date.now().toString().slice(-8);
                  const rand = Math.floor(1000 + Math.random() * 9000);
                  update('sku', `${ts}${rand}`);
                }}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-slate-100 hover:bg-slate-200 px-3 text-xs font-semibold text-slate-700 transition-colors"
                title="Generate barcode"
              >
                <BarcodeIcon className="h-3.5 w-3.5" />
                Generate
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Price ({currency}) *</label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => update('price', e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cost ({currency})</label>
            <input
              type="number"
              value={form.cost}
              onChange={(e) => update('cost', e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Stock</label>
            <input
              type="number"
              value={form.stock}
              onChange={(e) => update('stock', e.target.value)}
              placeholder="0"
              min="0"
              step="1"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>

        <ImageDropzone
          value={form.image_url || null}
          onChange={(url) => update('image_url', url ?? '')}
          label="Product photo"
          accent="fuchsia"
        />

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => update('is_active', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
          />
          <span className="text-sm text-slate-700">Active (available for sale)</span>
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {product ? 'Save changes' : 'Add product'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function BarcodeModal({
  product,
  currency,
  onClose,
  onPrint,
  onRegenerate,
}: {
  product: Product;
  currency: string;
  onClose: () => void;
  onPrint: (p: Product) => void;
  onRegenerate: (p: Product) => void;
}) {
  return (
    <Modal open onClose={onClose} title="Barcode" size="sm">
      <div className="p-5">
        <div className="text-center mb-4">
          <p className="font-bold text-slate-900">{product.name}</p>
          <p className="text-sm text-slate-500">{formatMoney(Number(product.price), currency)}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-center">
          {product.sku ? (
            <Barcode value={product.sku} height={70} />
          ) : (
            <p className="text-sm text-slate-500">No barcode assigned.</p>
          )}
        </div>

        {product.sku && (
          <p className="mt-2 text-center text-xs font-mono text-slate-500">{product.sku}</p>
        )}

        {/* Hidden render for print capture */}
        <div className="hidden">
          {product.sku && <div id={`barcode-print-${product.id}`}><Barcode value={product.sku} height={50} displayValue={false} /></div>}
        </div>

        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => onRegenerate(product)}>
            <RefreshCw className="h-4 w-4" />
            Regenerate
          </Button>
          <Button className="flex-1" onClick={() => onPrint(product)} disabled={!product.sku}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
        <div className="mt-2 flex justify-center">
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
