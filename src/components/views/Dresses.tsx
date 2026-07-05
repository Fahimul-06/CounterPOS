import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Shirt,
  AlertCircle,
  Tag,
  Filter,
  ArrowUpDown,
  Barcode as BarcodeIcon,
  Printer,
  RefreshCw,
  ExternalLink,
  Boxes,
  Palette,
  Ruler,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Dress } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatMoney, classNames } from '../../lib/utils';
import {
  PageContainer,
  PageHeader,
  Card,
  Button,
  Spinner,
  EmptyState,
  Modal,
  ConfirmDialog,
  Badge,
} from '../ui/Shared';
import Barcode from '../barcode/Barcode';
import DressForm from './DressForm';

type SortKey = 'name' | 'price' | 'stock' | 'created_at';
type SortDir = 'asc' | 'desc';
type StockFilter = 'all' | 'in' | 'low' | 'out';

export const DRESS_CATEGORIES = [
  'Shirt',
  'T-Shirt',
  'Dress',
  'Pants',
  'Jeans',
  'Jacket',
  'Coat',
  'Saree',
  'Kurta',
  'Skirt',
  'Top',
  'Hoodie',
  'Sweater',
  'Shorts',
  'Other',
];

export const DRESS_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free Size', '28', '30', '32', '34', '36', '38', '40', '42'];

export const GENDERS = ['Men', 'Women', 'Kids', 'Unisex'];

export default function Dresses() {
  const { business } = useAuth();
  const [dresses, setDresses] = useState<Dress[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [editing, setEditing] = useState<Dress | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Dress | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [barcodeTarget, setBarcodeTarget] = useState<Dress | null>(null);

  const currency = business?.currency ?? 'BDT';

  const load = async () => {
    if (!business) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('dresses')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
    } else {
      setDresses(data as Dress[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    dresses.forEach((d) => {
      if (d.category) set.add(d.category);
    });
    return Array.from(set).sort();
  }, [dresses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = dresses.filter((d) => {
      if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;
      if (genderFilter !== 'all' && d.gender !== genderFilter) return false;
      const isLow = d.stock > 0 && d.stock <= d.low_stock_threshold;
      if (stockFilter === 'in' && (d.stock === 0 || isLow)) return false;
      if (stockFilter === 'low' && (d.stock === 0 || d.stock > d.low_stock_threshold)) return false;
      if (stockFilter === 'out' && d.stock > 0) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        (d.brand?.toLowerCase().includes(q) ?? false) ||
        (d.color?.toLowerCase().includes(q) ?? false) ||
        (d.size?.toLowerCase().includes(q) ?? false) ||
        (d.material?.toLowerCase().includes(q) ?? false) ||
        (d.category?.toLowerCase().includes(q) ?? false) ||
        (d.barcode?.toLowerCase().includes(q) ?? false)
      );
    });
    out.sort((a, b) => {
      let av: string | number = a[sortKey] as string | number;
      let bv: string | number = b[sortKey] as string | number;
      if (sortKey === 'price' || sortKey === 'stock') {
        av = Number(av);
        bv = Number(bv);
      } else {
        av = String(av).toLowerCase();
        bv = String(bv).toLowerCase();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return out;
  }, [dresses, search, categoryFilter, genderFilter, stockFilter, sortKey, sortDir]);

  const stats = useMemo(() => {
    const active = dresses.filter((d) => d.is_active);
    return {
      total: dresses.length,
      active: active.length,
      lowStock: active.filter((d) => d.stock > 0 && d.stock <= d.low_stock_threshold).length,
      outStock: active.filter((d) => d.stock === 0).length,
      inventoryValue: active.reduce((acc, d) => acc + Number(d.cost) * d.stock, 0),
    };
  }, [dresses]);

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
    const { error } = await supabase.from('dresses').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      console.error(error);
      return;
    }
    setDresses((prev) => prev.filter((d) => d.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const openEdit = (d: Dress) => {
    setEditing(d);
    setShowForm(true);
  };

  const openNew = () => {
    setEditing(null);
    setShowForm(true);
  };

  const generateBarcodeValue = () => {
    const ts = Date.now().toString().slice(-8);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${ts}${rand}`;
  };

  const assignBarcode = async (d: Dress) => {
    const code = generateBarcodeValue();
    const { data, error } = await supabase
      .from('dresses')
      .update({ barcode: code, updated_at: new Date().toISOString() })
      .eq('id', d.id)
      .select()
      .single();
    if (error) {
      console.error(error);
      return;
    }
    const updated = data as Dress;
    setDresses((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    setBarcodeTarget(updated);
  };

  const printBarcode = (d: Dress) => {
    const svgEl = document.getElementById(`dress-barcode-print-${d.id}`);
    if (!svgEl || !d.barcode) return;
    const w = window.open('', '_blank', 'width=400,height=320');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Barcode - ${d.name}</title>
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
        <div class="name">${d.name.replace(/</g, '&lt;')}</div>
        <div class="price">${formatMoney(Number(d.price), currency)}</div>
        ${svgEl.outerHTML}
        <div class="code">${d.barcode}</div>
      </div>
      <script>window.onload=function(){setTimeout(function(){window.print();},200);};</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <PageContainer>
      <PageHeader
        title="Dresses"
        subtitle="Manage your clothing inventory, pricing, stock, and barcodes."
        action={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" />
            Add dress
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MiniStat label="Total items" value={String(stats.total)} icon={Shirt} tint="bg-fuchsia-50 text-fuchsia-600" />
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
              placeholder="Search by name, brand, color, size, barcode…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm outline-none focus:border-fuchsia-400 focus:bg-white focus:ring-2 focus:ring-fuchsia-100"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-8 py-2 text-sm outline-none focus:border-fuchsia-400 cursor-pointer"
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-2 text-sm outline-none focus:border-fuchsia-400 cursor-pointer"
            >
              <option value="all">All genders</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as StockFilter)}
              className="appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-2 text-sm outline-none focus:border-fuchsia-400 cursor-pointer"
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
          <Spinner label="Loading dresses…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Shirt}
            title={dresses.length === 0 ? 'No dresses yet' : 'No dresses match your filters'}
            description={
              dresses.length === 0
                ? 'Add your first dress to start managing your clothing inventory.'
                : 'Try adjusting your search or filters.'
            }
            action={
              dresses.length === 0 ? (
                <Button onClick={openNew}>
                  <Plus className="h-4 w-4" />
                  Add dress
                </Button>
              ) : undefined
            }
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
                    <th className="text-left font-semibold px-4 py-3">Size / Color</th>
                    <th className="text-right font-semibold px-4 py-3">
                      <SortButton label="Price" active={sortKey === 'price'} dir={sortDir} onClick={() => toggleSort('price')} align="right" />
                    </th>
                    <th className="text-right font-semibold px-4 py-3">
                      <SortButton label="Stock" active={sortKey === 'stock'} dir={sortDir} onClick={() => toggleSort('stock')} align="right" />
                    </th>
                    <th className="text-left font-semibold px-4 py-3">Barcode</th>
                    <th className="text-right font-semibold px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-slate-100 grid place-items-center overflow-hidden shrink-0">
                            {d.image_url ? (
                              <img src={d.image_url} alt={d.name} className="h-full w-full object-cover" />
                            ) : (
                              <Shirt className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{d.name}</p>
                            {d.brand && <p className="text-xs text-slate-500 truncate">{d.brand}</p>}
                            {d.website && (
                              <a
                                href={d.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-xs text-fuchsia-600 hover:text-fuchsia-700 hover:underline"
                              >
                                Website
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {d.category ? <Badge color="slate">{d.category}</Badge> : <span className="text-slate-400 text-xs">—</span>}
                        {d.gender && <div className="mt-1 text-xs text-slate-400">{d.gender}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {d.size && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-blue-700">
                              <Ruler className="h-3 w-3" />
                              {d.size}
                            </span>
                          )}
                          {d.color && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
                              <Palette className="h-3 w-3" />
                              {d.color}
                            </span>
                          )}
                          {!d.size && !d.color && <span className="text-slate-400 text-xs">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatMoney(Number(d.price), currency)}</td>
                      <td className="px-4 py-3 text-right">
                        <StockBadge dress={d} />
                      </td>
                      <td className="px-4 py-3">
                        {d.barcode ? (
                          <button
                            onClick={() => setBarcodeTarget(d)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 hover:bg-slate-200 px-2 py-1 text-xs font-mono text-slate-700 transition-colors"
                            title="View / print barcode"
                          >
                            <BarcodeIcon className="h-3.5 w-3.5" />
                            {d.barcode.length > 12 ? `${d.barcode.slice(0, 12)}…` : d.barcode}
                          </button>
                        ) : (
                          <button
                            onClick={() => assignBarcode(d)}
                            className="inline-flex items-center gap-1 rounded-md bg-fuchsia-50 hover:bg-fuchsia-100 px-2 py-1 text-xs font-semibold text-fuchsia-700 transition-colors"
                            title="Generate barcode"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Generate
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(d)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-fuchsia-600 hover:bg-fuchsia-50"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(d)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                            title="Delete"
                          >
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
              {filtered.map((d) => (
                <div key={d.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-lg bg-slate-100 grid place-items-center overflow-hidden shrink-0">
                      {d.image_url ? (
                        <img src={d.image_url} alt={d.name} className="h-full w-full object-cover" />
                      ) : (
                        <Shirt className="h-6 w-6 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{d.name}</p>
                          {d.brand && <p className="text-xs text-slate-500 truncate">{d.brand}</p>}
                        </div>
                        <p className="font-bold text-slate-900 shrink-0">{formatMoney(Number(d.price), currency)}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {d.category && <Badge color="slate">{d.category}</Badge>}
                        {d.size && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-blue-700">
                            <Ruler className="h-3 w-3" />
                            {d.size}
                          </span>
                        )}
                        {d.color && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
                            <Palette className="h-3 w-3" />
                            {d.color}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <StockBadge dress={d} />
                        <div className="flex items-center gap-1">
                          {d.website && (
                            <a
                              href={d.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-md text-slate-500 hover:text-fuchsia-600 hover:bg-fuchsia-50"
                              title="Website"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          {d.barcode ? (
                            <button
                              onClick={() => setBarcodeTarget(d)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-fuchsia-600 hover:bg-fuchsia-50"
                              title="Barcode"
                            >
                              <BarcodeIcon className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => assignBarcode(d)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-fuchsia-600 hover:bg-fuchsia-50"
                              title="Generate barcode"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(d)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-fuchsia-600 hover:bg-fuchsia-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(d)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                          >
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
        <DressForm
          open={showForm}
          onClose={() => setShowForm(false)}
          dress={editing}
          categories={categories}
          currency={currency}
          onSaved={(d, isNew) => {
            if (isNew) {
              setDresses((prev) => [d, ...prev]);
            } else {
              setDresses((prev) => prev.map((x) => (x.id === d.id ? d : x)));
            }
            setShowForm(false);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete dress"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        busy={deleting}
      />

      {barcodeTarget && (
        <BarcodeModal
          dress={barcodeTarget}
          currency={currency}
          onClose={() => setBarcodeTarget(null)}
          onPrint={printBarcode}
          onRegenerate={() => assignBarcode(barcodeTarget)}
        />
      )}
    </PageContainer>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: string;
  icon: typeof Shirt;
  tint: string;
}) {
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

function StockBadge({ dress }: { dress: Dress }) {
  if (dress.stock <= 0) return <Badge color="red">Out of stock</Badge>;
  if (dress.stock <= dress.low_stock_threshold) return <Badge color="amber">{dress.stock} left</Badge>;
  return <Badge color="green">{dress.stock} in stock</Badge>;
}

function SortButton({
  label,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: 'left' | 'right';
}) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        'inline-flex items-center gap-1 hover:text-slate-700',
        align === 'right' && 'flex-row-reverse',
      )}
    >
      {label}
      <ArrowUpDown className={classNames('h-3 w-3', active ? 'text-fuchsia-600' : 'text-slate-300')} />
      {active && <span className="text-[10px] text-fuchsia-600">{dir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  );
}

function BarcodeModal({
  dress,
  currency,
  onClose,
  onPrint,
  onRegenerate,
}: {
  dress: Dress;
  currency: string;
  onClose: () => void;
  onPrint: (d: Dress) => void;
  onRegenerate: (d: Dress) => void;
}) {
  return (
    <Modal open onClose={onClose} title="Dress barcode" size="sm">
      <div className="p-5">
        <div className="text-center mb-4">
          <p className="font-bold text-slate-900">{dress.name}</p>
          <p className="text-sm text-slate-500">{formatMoney(Number(dress.price), currency)}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-center">
          {dress.barcode ? (
            <Barcode value={dress.barcode} height={70} />
          ) : (
            <p className="text-sm text-slate-500">No barcode assigned.</p>
          )}
        </div>

        {dress.barcode && <p className="mt-2 text-center text-xs font-mono text-slate-500">{dress.barcode}</p>}

        {/* Hidden render for print capture */}
        <div className="hidden">
          {dress.barcode && (
            <div id={`dress-barcode-print-${dress.id}`}>
              <Barcode value={dress.barcode} height={50} displayValue={false} />
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => onRegenerate(dress)}>
            <RefreshCw className="h-4 w-4" />
            Regenerate
          </Button>
          <Button className="flex-1" onClick={() => onPrint(dress)} disabled={!dress.barcode}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
        <div className="mt-2 flex justify-center">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
