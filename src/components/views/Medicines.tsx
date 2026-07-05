import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Pill,
  AlertCircle,
  Tag,
  Filter,
  ArrowUpDown,
  Barcode as BarcodeIcon,
  Printer,
  RefreshCw,
  CalendarClock,
  Package,
  Boxes,
  FlaskConical,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Medicine } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatMoney, formatShortDate, classNames } from '../../lib/utils';
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
import MedicineForm from './MedicineForm';

type SortKey = 'name' | 'expiry_date' | 'price' | 'created_at';
type SortDir = 'asc' | 'desc';
type ExpiryFilter = 'all' | 'expired' | 'expiring' | 'valid';

export const MEDICINE_TYPES = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Injection',
  'Drops',
  'Ointment',
  'Cream',
  'Inhaler',
  'Powder',
  'Gel',
  'Lotion',
  'Spray',
  'Suppository',
  'Granules',
  'Other',
];

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(iso + 'T00:00:00');
  return Math.round((exp.getTime() - today.getTime()) / 86400000);
}

function expiryStatus(m: Medicine): 'expired' | 'expiring' | 'valid' {
  const d = daysUntil(m.expiry_date);
  if (d < 0) return 'expired';
  if (d <= m.expiry_alert_days) return 'expiring';
  return 'valid';
}

export default function Medicines() {
  const { business } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Medicine | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [barcodeTarget, setBarcodeTarget] = useState<Medicine | null>(null);

  const currency = business?.currency ?? 'BDT';

  const load = async () => {
    if (!business) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('medicines')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
    } else {
      setMedicines(data as Medicine[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business]);

  const types = useMemo(() => {
    const set = new Set<string>();
    medicines.forEach((m) => set.add(m.medicine_type));
    return Array.from(set).sort();
  }, [medicines]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = medicines.filter((m) => {
      if (typeFilter !== 'all' && m.medicine_type !== typeFilter) return false;
      if (expiryFilter !== 'all' && expiryStatus(m) !== expiryFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        (m.generic_name?.toLowerCase().includes(q) ?? false) ||
        (m.manufacturer?.toLowerCase().includes(q) ?? false) ||
        (m.reason?.toLowerCase().includes(q) ?? false) ||
        (m.barcode?.toLowerCase().includes(q) ?? false) ||
        m.medicine_type.toLowerCase().includes(q)
      );
    });
    out.sort((a, b) => {
      let av: string | number = a[sortKey] as string | number;
      let bv: string | number = b[sortKey] as string | number;
      if (sortKey === 'price') {
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
  }, [medicines, search, typeFilter, expiryFilter, sortKey, sortDir]);

  const stats = useMemo(() => {
    const active = medicines.filter((m) => m.is_active);
    return {
      total: medicines.length,
      active: active.length,
      expired: active.filter((m) => expiryStatus(m) === 'expired').length,
      expiring: active.filter((m) => expiryStatus(m) === 'expiring').length,
    };
  }, [medicines]);

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
    const { error } = await supabase.from('medicines').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      console.error(error);
      return;
    }
    setMedicines((prev) => prev.filter((m) => m.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const openEdit = (m: Medicine) => {
    setEditing(m);
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

  const assignBarcode = async (m: Medicine) => {
    const code = generateBarcodeValue();
    const { data, error } = await supabase
      .from('medicines')
      .update({ barcode: code, updated_at: new Date().toISOString() })
      .eq('id', m.id)
      .select()
      .single();
    if (error) {
      console.error(error);
      return;
    }
    const updated = data as Medicine;
    setMedicines((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    setBarcodeTarget(updated);
  };

  const printBarcode = (m: Medicine) => {
    const svgEl = document.getElementById(`medicine-barcode-print-${m.id}`);
    if (!svgEl || !m.barcode) return;
    const w = window.open('', '_blank', 'width=400,height=320');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Barcode - ${m.name}</title>
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
        <div class="name">${m.name.replace(/</g, '&lt;')}</div>
        <div class="price">${formatMoney(Number(m.price), currency)}</div>
        ${svgEl.outerHTML}
        <div class="code">${m.barcode}</div>
      </div>
      <script>window.onload=function(){setTimeout(function(){window.print();},200);};</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <PageContainer>
      <PageHeader
        title="Medicines"
        subtitle="Manage your pharmacy inventory, expiry tracking, and barcodes."
        action={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" />
            Add medicine
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MiniStat label="Total medicines" value={String(stats.total)} icon={Pill} tint="bg-rose-50 text-rose-600" />
        <MiniStat label="Active" value={String(stats.active)} icon={Tag} tint="bg-emerald-50 text-emerald-600" />
        <MiniStat label="Expiring soon" value={String(stats.expiring)} icon={CalendarClock} tint="bg-amber-50 text-amber-600" />
        <MiniStat label="Expired" value={String(stats.expired)} icon={AlertCircle} tint="bg-rose-100 text-rose-700" />
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
              placeholder="Search by name, generic, manufacturer, reason, barcode…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm outline-none focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-8 py-2 text-sm outline-none focus:border-rose-400 cursor-pointer"
              >
                <option value="all">All types</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value as ExpiryFilter)}
              className="appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-2 text-sm outline-none focus:border-rose-400 cursor-pointer"
            >
              <option value="all">All expiry</option>
              <option value="valid">Valid</option>
              <option value="expiring">Expiring soon</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <Spinner label="Loading medicines…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Pill}
            title={medicines.length === 0 ? 'No medicines yet' : 'No medicines match your filters'}
            description={
              medicines.length === 0
                ? 'Add your first medicine to start managing your pharmacy inventory.'
                : 'Try adjusting your search or filters.'
            }
            action={
              medicines.length === 0 ? (
                <Button onClick={openNew}>
                  <Plus className="h-4 w-4" />
                  Add medicine
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
                    <th className="text-left font-semibold px-4 py-3">Type</th>
                    <th className="text-left font-semibold px-4 py-3">Stock</th>
                    <th className="text-right font-semibold px-4 py-3">
                      <SortButton label="Price" active={sortKey === 'price'} dir={sortDir} onClick={() => toggleSort('price')} align="right" />
                    </th>
                    <th className="text-left font-semibold px-4 py-3">
                      <SortButton label="Expiry" active={sortKey === 'expiry_date'} dir={sortDir} onClick={() => toggleSort('expiry_date')} />
                    </th>
                    <th className="text-left font-semibold px-4 py-3">Barcode</th>
                    <th className="text-right font-semibold px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((m) => {
                    const status = expiryStatus(m);
                    const d = daysUntil(m.expiry_date);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-rose-50 grid place-items-center shrink-0">
                              <Pill className="h-5 w-5 text-rose-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{m.name}</p>
                              {m.generic_name && <p className="text-xs text-slate-500 truncate">{m.generic_name}</p>}
                              {m.reason && <p className="text-xs text-slate-400 truncate">For: {m.reason}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge color="slate">{m.medicine_type}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <StockSummary m={m} />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {formatMoney(Number(m.price), currency)}
                        </td>
                        <td className="px-4 py-3">
                          <ExpiryBadge status={status} days={d} date={m.expiry_date} />
                        </td>
                        <td className="px-4 py-3">
                          {m.barcode ? (
                            <button
                              onClick={() => setBarcodeTarget(m)}
                              className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 hover:bg-slate-200 px-2 py-1 text-xs font-mono text-slate-700 transition-colors"
                              title="View / print barcode"
                            >
                              <BarcodeIcon className="h-3.5 w-3.5" />
                              {m.barcode.length > 12 ? `${m.barcode.slice(0, 12)}…` : m.barcode}
                            </button>
                          ) : (
                            <button
                              onClick={() => assignBarcode(m)}
                              className="inline-flex items-center gap-1 rounded-md bg-rose-50 hover:bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 transition-colors"
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
                              onClick={() => openEdit(m)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(m)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map((m) => {
                const status = expiryStatus(m);
                const d = daysUntil(m.expiry_date);
                return (
                  <div key={m.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-lg bg-rose-50 grid place-items-center shrink-0">
                        <Pill className="h-6 w-6 text-rose-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{m.name}</p>
                            <p className="text-xs text-slate-500 truncate">{m.medicine_type}</p>
                          </div>
                          <p className="font-bold text-slate-900 shrink-0">{formatMoney(Number(m.price), currency)}</p>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <ExpiryBadge status={status} days={d} date={m.expiry_date} />
                          <div className="flex items-center gap-1">
                            {m.barcode ? (
                              <button
                                onClick={() => setBarcodeTarget(m)}
                                className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                                title="Barcode"
                              >
                                <BarcodeIcon className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => assignBarcode(m)}
                                className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                                title="Generate barcode"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => openEdit(m)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(m)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-2">
                          <StockSummary m={m} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {showForm && (
        <MedicineForm
          open={showForm}
          onClose={() => setShowForm(false)}
          medicine={editing}
          currency={currency}
          onSaved={(m, isNew) => {
            if (isNew) {
              setMedicines((prev) => [m, ...prev]);
            } else {
              setMedicines((prev) => prev.map((x) => (x.id === m.id ? m : x)));
            }
            setShowForm(false);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete medicine"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        busy={deleting}
      />

      {barcodeTarget && (
        <BarcodeModal
          medicine={barcodeTarget}
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
  icon: typeof Pill;
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

function StockSummary({ m }: { m: Medicine }) {
  const totalPieces =
    m.pieces + m.pieces_per_strip * m.strips + m.pieces_per_strip * m.strips_per_box * m.boxes;
  return (
    <div className="flex flex-wrap gap-1.5">
      {m.boxes > 0 && (
        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-blue-700">
          <Package className="h-3 w-3" />
          {m.boxes} box
        </span>
      )}
      {m.strips > 0 && (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
          <Boxes className="h-3 w-3" />
          {m.strips} strip
        </span>
      )}
      {m.pieces > 0 && (
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
          <FlaskConical className="h-3 w-3" />
          {m.pieces} pc
        </span>
      )}
      {totalPieces === 0 && <span className="text-xs text-slate-400">No stock</span>}
    </div>
  );
}

function ExpiryBadge({
  status,
  days,
  date,
}: {
  status: 'expired' | 'expiring' | 'valid';
  days: number;
  date: string;
}) {
  if (status === 'expired') {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge color="red">Expired</Badge>
        <span className="text-xs text-slate-400">{formatShortDate(date)}</span>
      </div>
    );
  }
  if (status === 'expiring') {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge color="amber">In {days}d</Badge>
        <span className="text-xs text-slate-400">{formatShortDate(date)}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <Badge color="green">Valid</Badge>
      <span className="text-xs text-slate-400">{formatShortDate(date)}</span>
    </div>
  );
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
      <ArrowUpDown className={classNames('h-3 w-3', active ? 'text-rose-600' : 'text-slate-300')} />
      {active && <span className="text-[10px] text-rose-600">{dir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  );
}

function BarcodeModal({
  medicine,
  currency,
  onClose,
  onPrint,
  onRegenerate,
}: {
  medicine: Medicine;
  currency: string;
  onClose: () => void;
  onPrint: (m: Medicine) => void;
  onRegenerate: (m: Medicine) => void;
}) {
  return (
    <Modal open onClose={onClose} title="Medicine barcode" size="sm">
      <div className="p-5">
        <div className="text-center mb-4">
          <p className="font-bold text-slate-900">{medicine.name}</p>
          <p className="text-sm text-slate-500">{formatMoney(Number(medicine.price), currency)}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-center">
          {medicine.barcode ? (
            <Barcode value={medicine.barcode} height={70} />
          ) : (
            <p className="text-sm text-slate-500">No barcode assigned.</p>
          )}
        </div>

        {medicine.barcode && (
          <p className="mt-2 text-center text-xs font-mono text-slate-500">{medicine.barcode}</p>
        )}

        {/* Hidden render for print capture */}
        <div className="hidden">
          {medicine.barcode && (
            <div id={`medicine-barcode-print-${medicine.id}`}>
              <Barcode value={medicine.barcode} height={50} displayValue={false} />
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => onRegenerate(medicine)}>
            <RefreshCw className="h-4 w-4" />
            Regenerate
          </Button>
          <Button className="flex-1" onClick={() => onPrint(medicine)} disabled={!medicine.barcode}>
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
