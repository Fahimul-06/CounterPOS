import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Boxes, CheckCircle2, Edit3, Flame, Loader2, PackagePlus, Plus, Printer, RefreshCw, Search, Trash2 } from 'lucide-react';
import { supabase, apiRequest } from '../../lib/supabase';
import type { LpgCylinder } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatMoney, classNames } from '../../lib/utils';
import { Badge, Button, Card, ConfirmDialog, EmptyState, PageContainer, PageHeader, Spinner } from '../ui/Shared';

const LPG_SIZES = ['5.5 kg', '12 kg', '20 kg', '25 kg', '35 kg', '45 kg'];
const LPG_COMPANIES = ['Bashundhara LP Gas', 'Jamuna Gas', 'Omera LPG', 'Beximco LPG', 'Navana LPG', 'Laugfs Gas', 'Totalgaz', 'Orion LPG', 'Petromax LPG', 'Other'];

type FormState = {
  cylinder_size: string;
  company: string;
  item_type: 'refill' | 'package';
  price: string;
  cost: string;
  full_stock: string;
  empty_stock: string;
  sku: string;
  low_stock_threshold: string;
  notes: string;
};

const emptyForm: FormState = {
  cylinder_size: '12 kg',
  company: 'Bashundhara LP Gas',
  item_type: 'refill',
  price: '',
  cost: '',
  full_stock: '0',
  empty_stock: '0',
  sku: '',
  low_stock_threshold: '3',
  notes: '',
};

function stockStatus(c: LpgCylinder) {
  if (Number(c.full_stock || 0) <= 0) return { label: 'StockOut', color: 'red' as const };
  if (Number(c.full_stock || 0) <= Number(c.low_stock_threshold || 3)) return { label: 'Low stock', color: 'amber' as const };
  return { label: 'In stock', color: 'green' as const };
}

export default function LpgInventory() {
  const { business } = useAuth();
  const [items, setItems] = useState<LpgCylinder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'refill' | 'package'>('all');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<LpgCylinder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LpgCylinder | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currency = business?.currency ?? 'BDT';

  const load = async () => {
    if (!business) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('lpg_cylinders')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setItems((data || []) as LpgCylinder[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [business]);

  const stats = useMemo(() => ({
    full: items.filter((x) => x.is_active).reduce((s, x) => s + Number(x.full_stock || 0), 0),
    empty: items.filter((x) => x.is_active).reduce((s, x) => s + Number(x.empty_stock || 0), 0),
    stockOut: items.filter((x) => x.is_active && Number(x.full_stock || 0) <= 0).length,
    value: items.filter((x) => x.is_active).reduce((s, x) => s + Number(x.full_stock || 0) * Number(x.cost || 0), 0),
  }), [items]);

  const companyOptions = useMemo(() => {
    const names = new Set<string>(LPG_COMPANIES.filter((x) => x !== 'Other'));
    items.forEach((item) => {
      if (item.company) names.add(item.company);
    });
    if (form.company) names.add(form.company);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [items, form.company]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (typeFilter !== 'all' && item.item_type !== typeFilter) return false;
      if (!q) return true;
      return [item.company, item.cylinder_size, item.item_type, item.sku, item.notes].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [items, search, typeFilter]);

  const update = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
    setMessage(null);
  };

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const openEdit = (item: LpgCylinder) => {
    setEditing(item);
    setForm({
      cylinder_size: item.cylinder_size || '12 kg',
      company: item.company || 'Bashundhara LP Gas',
      item_type: item.item_type || 'refill',
      price: String(item.price ?? ''),
      cost: String(item.cost ?? ''),
      full_stock: String(item.full_stock ?? 0),
      empty_stock: String(item.empty_stock ?? 0),
      sku: item.sku || '',
      low_stock_threshold: String(item.low_stock_threshold ?? 3),
      notes: item.notes || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const payload = () => ({
    cylinder_size: form.cylinder_size.trim(),
    company: form.company.trim(),
    item_type: form.item_type,
    price: Number(form.price || 0),
    cost: Number(form.cost || 0),
    full_stock: Number(form.full_stock || 0),
    empty_stock: Number(form.empty_stock || 0),
    sku: form.sku.trim() || null,
    low_stock_threshold: Number(form.low_stock_threshold || 3),
    notes: form.notes.trim() || null,
    is_active: true,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.cylinder_size.trim() || !form.company.trim()) {
      setError('Cylinder size and company are required.');
      return;
    }
    setSaving(true);
    const p = payload();
    const res = editing
      ? await supabase.from('lpg_cylinders').update(p).eq('id', editing.id).select().single()
      : await supabase.from('lpg_cylinders').insert(p).select().single();
    setSaving(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setMessage(editing ? 'Cylinder item updated successfully.' : 'Cylinder item added successfully.');
    resetForm();
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('lpg_cylinders').delete().eq('id', deleteTarget.id);
    if (error) setError(error.message);
    else {
      setItems((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      setDeleteTarget(null);
    }
  };

  const seed = async () => {
    setSaving(true);
    try {
      await apiRequest('/lpg/seed', { method: 'POST', body: JSON.stringify({ reset: false }) });
      setMessage('Bangladesh LPG mock stock added. Existing stock was not duplicated.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mock data failed.');
    } finally {
      setSaving(false);
    }
  };

  const printStockReport = () => {
    if (!business) return;
    const rows = filtered;
    const totalFull = rows.reduce((s, x) => s + Number(x.full_stock || 0), 0);
    const totalEmpty = rows.reduce((s, x) => s + Number(x.empty_stock || 0), 0);
    const stockOut = rows.filter((x) => Number(x.full_stock || 0) <= 0).length;
    const lowStock = rows.filter((x) => Number(x.full_stock || 0) > 0 && Number(x.full_stock || 0) <= Number(x.low_stock_threshold || 0)).length;
    const reportDate = new Date().toLocaleString();
    const w = window.open('', '_blank', 'width=1180,height=820');
    if (!w) return;

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LPG Cylinder Stock Report</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #f1f5f9; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { width: 277mm; max-width: 100%; min-height: 190mm; margin: 16px auto; background: #fff; border-radius: 18px; padding: 12mm; box-shadow: 0 18px 50px rgba(15, 23, 42, .12); }
    .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; border-bottom: 3px solid #f59e0b; padding-bottom: 14px; }
    h1, h2, p { margin: 0; }
    h1 { font-size: 24px; line-height: 1.1; }
    h2 { margin-top: 6px; font-size: 18px; color: #92400e; }
    .muted { color: #64748b; font-size: 12px; line-height: 1.45; }
    .badge { display: inline-block; border-radius: 999px; padding: 7px 12px; background: #fffbeb; color: #92400e; border: 1px solid #fde68a; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; }
    .summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin: 16px 0; }
    .box { border: 1px solid #e2e8f0; border-radius: 16px; background: #f8fafc; padding: 11px; }
    .box span { display: block; color: #64748b; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; }
    .box b { display: block; margin-top: 5px; font-size: 22px; line-height: 1; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    thead th { background: #111827; color: #fff; padding: 8px 7px; text-align: left; white-space: nowrap; }
    tbody td { border-bottom: 1px solid #e5e7eb; padding: 7px; vertical-align: top; }
    tbody tr { break-inside: avoid; page-break-inside: avoid; }
    .right { text-align: right; }
    .red { color: #dc2626; font-weight: 900; }
    .green { color: #047857; font-weight: 900; }
    .amber { color: #b45309; font-weight: 900; }
    .badge-red { background: #fee2e2; color: #b91c1c; border-color: #fecaca; }
    .badge-green { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
    .badge-amber { background: #fef3c7; color: #92400e; border-color: #fde68a; }
    .footer { margin-top: 12px; text-align: center; color: #64748b; font-size: 11px; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
    .actions { width: 277mm; max-width: 100%; margin: 0 auto 16px; display: flex; justify-content: flex-end; gap: 8px; }
    button { border: 0; border-radius: 12px; padding: 10px 14px; font-weight: 800; cursor: pointer; }
    .print { background: #111827; color: white; }
    .close { background: #e2e8f0; color: #0f172a; }
    @media print {
      html, body { background: #fff; }
      .actions { display: none !important; }
      .sheet { width: auto; min-height: auto; margin: 0; padding: 0; border-radius: 0; box-shadow: none; }
      .top, .summary, .box, tbody tr { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="actions"><button class="close" onclick="window.close()">Close</button><button class="print" onclick="window.print()">Print report</button></div>
  <main class="sheet">
    <section class="top">
      <div>
        <h1>${escapeHtml(business.business_name || 'LPG Cylinder Shop')}</h1>
        <p class="muted">${escapeHtml(business.address || '')}</p>
        <p class="muted">Phone: ${escapeHtml(business.phone || '-')}</p>
        <h2>LPG Cylinder Inventory Stock Report</h2>
      </div>
      <div style="text-align:right">
        <span class="badge">Inventory report</span>
        <p class="muted" style="margin-top:10px">Printed at<br/><b>${escapeHtml(reportDate)}</b></p>
      </div>
    </section>

    <section class="summary">
      <div class="box"><span>Total items</span><b>${rows.length}</b></div>
      <div class="box"><span>Full cylinders</span><b class="green">${totalFull}</b></div>
      <div class="box"><span>Empty cylinders</span><b>${totalEmpty}</b></div>
      <div class="box"><span>Low stock</span><b class="amber">${lowStock}</b></div>
      <div class="box"><span>StockOut</span><b class="red">${stockOut}</b></div>
    </section>

    <table>
      <thead>
        <tr>
          <th>#</th><th>Company</th><th>Size</th><th>Type</th><th>SKU</th><th class="right">Full stock</th><th class="right">Empty cylinders</th><th class="right">Low alert</th><th class="right">Price</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((x, i) => {
          const full = Number(x.full_stock || 0);
          const low = full > 0 && full <= Number(x.low_stock_threshold || 0);
          const out = full <= 0;
          const status = out
            ? '<span class="badge badge-red">StockOut</span>'
            : low
              ? '<span class="badge badge-amber">Low stock</span>'
              : '<span class="badge badge-green">In stock</span>';
          return `<tr>
            <td>${i + 1}</td>
            <td><b>${escapeHtml(x.company)}</b></td>
            <td>${escapeHtml(x.cylinder_size)}</td>
            <td>${escapeHtml(x.item_type)}</td>
            <td>${escapeHtml(x.sku || '-')}</td>
            <td class="right ${out ? 'red' : low ? 'amber' : 'green'}">${full}</td>
            <td class="right">${Number(x.empty_stock || 0)}</td>
            <td class="right">${Number(x.low_stock_threshold || 0)}</td>
            <td class="right">${formatMoney(Number(x.price || 0), currency)}</td>
            <td>${status}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div class="footer">Generated by CounterPOS LPG Cylinder Inventory</div>
  </main>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.focus(); window.print(); }, 750);
    });
  </script>
</body>
</html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  if (loading) return <PageContainer><Spinner label="Loading LPG inventory…" /></PageContainer>;

  return (
    <PageContainer>
      <PageHeader
        title="LPG cylinder inventory"
        subtitle="Manage refill/package cylinders, full stock, empty cylinders, company/brand and selling price."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={printStockReport}><Printer className="h-4 w-4" /> Print stock report</Button>
            <Button variant="outline" onClick={seed} disabled={saving}><RefreshCw className="h-4 w-4" /> Add mock data</Button>
            <Button onClick={resetForm}><Plus className="h-4 w-4" /> New cylinder</Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4 mb-5">
        <Stat label="Full cylinders" value={stats.full} icon={Flame} tint="from-emerald-500 to-teal-500" />
        <Stat label="Empty cylinders" value={stats.empty} icon={Boxes} tint="from-amber-500 to-orange-500" />
        <Stat label="StockOut items" value={stats.stockOut} icon={AlertTriangle} tint="from-rose-500 to-red-500" />
        <Stat label="Stock value" value={formatMoney(stats.value, currency)} icon={CheckCircle2} tint="from-blue-500 to-cyan-500" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <Card className="p-5 h-max">
          <h2 className="text-lg font-black text-slate-950">{editing ? 'Edit cylinder item' : 'Add LPG cylinder'}</h2>
          <p className="text-sm text-slate-500 mt-1">Track both full cylinders for sale and empty cylinders returned to the shop.</p>
          {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
          {message && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>}
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cylinder size">
                <select value={form.cylinder_size} onChange={(e) => update('cylinder_size', e.target.value)} className="input">
                  {LPG_SIZES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Type">
                <select value={form.item_type} onChange={(e) => update('item_type', e.target.value as FormState['item_type'])} className="input">
                  <option value="refill">Refill</option>
                  <option value="package">Package</option>
                </select>
              </Field>
            </div>
            <Field label="Company / brand">
              <input
                value={form.company}
                onChange={(e) => update('company', e.target.value)}
                className="input"
                list="lpg-company-options"
                placeholder="Type or select company name"
              />
              <datalist id="lpg-company-options">
                {companyOptions.map((x) => <option key={x} value={x} />)}
              </datalist>
              <p className="mt-1 text-[11px] font-semibold text-slate-400">Need a new LPG company? Type the new company name here and save.</p>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Selling price"><input value={form.price} onChange={(e) => update('price', e.target.value)} type="number" min="0" className="input" /></Field>
              <Field label="Purchase cost"><input value={form.cost} onChange={(e) => update('cost', e.target.value)} type="number" min="0" className="input" /></Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Full stock"><input value={form.full_stock} onChange={(e) => update('full_stock', e.target.value)} type="number" min="0" className="input" /></Field>
              <Field label="Empty stock"><input value={form.empty_stock} onChange={(e) => update('empty_stock', e.target.value)} type="number" min="0" className="input" /></Field>
              <Field label="Low alert"><input value={form.low_stock_threshold} onChange={(e) => update('low_stock_threshold', e.target.value)} type="number" min="0" className="input" /></Field>
            </div>
            <Field label="SKU / barcode"><input value={form.sku} onChange={(e) => update('sku', e.target.value)} className="input" placeholder="LPG-BASH-12-R" /></Field>
            <Field label="Notes"><textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} className="input min-h-[80px]" placeholder="Optional notes" /></Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving} className="flex-1">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Update cylinder' : 'Add cylinder'}</Button>
              {editing && <Button variant="secondary" onClick={resetForm}>Cancel</Button>}
            </div>
          </form>
        </Card>

        <Card className="overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-black text-slate-950">Cylinder list</h2>
              <p className="text-xs text-slate-500">See full and empty stock by size/company.</p>
            </div>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1 md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9" placeholder="Search company, size, SKU" />
              </div>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className="input w-32">
                <option value="all">All</option>
                <option value="refill">Refill</option>
                <option value="package">Package</option>
              </select>
            </div>
          </div>
          {filtered.length === 0 ? (
            <EmptyState icon={PackagePlus} title="No LPG cylinders found" description="Add your first cylinder item or load the mock data." />
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((item) => {
                const st = stockStatus(item);
                return (
                  <div key={item.id} className={classNames('p-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center', Number(item.full_stock || 0) <= 0 && 'bg-rose-50/60')}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black text-slate-950 truncate">{item.company} · {item.cylinder_size}</h3>
                        <Badge color={item.item_type === 'package' ? 'blue' : 'green'}>{item.item_type}</Badge>
                        <Badge color={st.color}>{st.label}</Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <Mini label="Full" value={`${item.full_stock} pcs`} />
                        <Mini label="Empty" value={`${item.empty_stock} pcs`} />
                        <Mini label="Price" value={formatMoney(item.price, currency)} />
                        <Mini label="SKU" value={item.sku || 'N/A'} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(item)}><Edit3 className="h-4 w-4" /> Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => setDeleteTarget(item)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete cylinder item?" message="This will remove the LPG cylinder item from inventory." confirmLabel="Delete" danger />
    </PageContainer>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
}

function Stat({ label, value, icon: Icon, tint }: { label: string; value: string | number; icon: typeof Flame; tint: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={classNames('h-11 w-11 rounded-2xl bg-gradient-to-br grid place-items-center text-white', tint)}><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-xs font-bold text-slate-500">{label}</p>
          <p className="text-xl font-black text-slate-950">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><p className="mt-0.5 font-extrabold text-slate-800 truncate">{value}</p></div>;
}

function escapeHtml(v: string) { return String(v).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c] || c)); }
