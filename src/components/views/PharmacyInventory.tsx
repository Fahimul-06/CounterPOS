import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Barcode, Boxes, CalendarClock, PackagePlus, Pill, RefreshCcw, Save, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatMoney, formatShortDate } from '../../lib/utils';
import { PageContainer, PageHeader, Card, Button, Spinner, Badge } from '../ui/Shared';
import ImageDropzone from '../ui/ImageDropzone';
import { ExpiryBadge, daysUntil, unitText } from './pharmacyHelpers';

const CATEGORIES = ['Analgesic', 'Antibiotic', 'Antacid', 'Antihistamine', 'Antidiabetic', 'Cardiac', 'Respiratory', 'Gastrointestinal', 'Vitamin', 'Dermatology', 'Other'];
const DOSAGE_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Drops', 'Cream', 'Ointment', 'Inhaler', 'Suspension', 'Gel', 'Other'];

const emptyMedicine = {
  brand_name: '', name: '', generic_name: '', manufacturer: '', category: 'Analgesic', strength: '', dosage_form: 'Tablet', medicine_type: 'Tablet', barcode: '', sku: '', rack_location: '', purchase_price: '0', mrp: '0', selling_price: '', price: '', cost: '0', pieces_per_strip: '10', strips_per_box: '10', low_stock_threshold: '20', image_url: '', reason: '', expiry_alert_days: '30', is_active: true,
};

const emptyBatch = { medicine_id: '', branch_id: '', batch_number: '', manufacturing_date: '', expiry_date: '', quantity: '', unit_cost: '', rack_location: '' };

export default function PharmacyInventory() {
  const { business } = useAuth();
  const [medicines, setMedicines] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [medicineForm, setMedicineForm] = useState<any>(emptyMedicine);
  const [batchForm, setBatchForm] = useState<any>(emptyBatch);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    if (!business) return;
    setLoading(true);
    const [m, b, br] = await Promise.all([
      supabase.from('medicines').select('*').eq('business_id', business.id).order('name', { ascending: true }),
      supabase.from('medicine_batches').select('*').eq('business_id', business.id).order('expiry_date', { ascending: true }),
      supabase.from('branches').select('*').eq('business_id', business.id).order('name', { ascending: true }),
    ]);
    setMedicines((m.data as any[]) || []);
    setBatches((b.data as any[]) || []);
    setBranches((br.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [business]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return medicines.filter((m) => !q || [m.name, m.brand_name, m.generic_name, m.manufacturer, m.category, m.barcode, m.sku, m.rack_location].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [medicines, search]);

  const saveMedicine = async (e: FormEvent) => {
    e.preventDefault();
    if (!business) return;
    setSaving(true); setMessage(null);
    const payload = {
      business_id: business.id,
      ...medicineForm,
      name: medicineForm.name.trim(),
      brand_name: medicineForm.brand_name.trim() || medicineForm.name.trim(),
      medicine_type: medicineForm.dosage_form,
      price: Number(medicineForm.selling_price || medicineForm.price || 0),
      selling_price: Number(medicineForm.selling_price || medicineForm.price || 0),
      purchase_price: Number(medicineForm.purchase_price || 0),
      cost: Number(medicineForm.cost || medicineForm.purchase_price || 0),
      mrp: Number(medicineForm.mrp || medicineForm.selling_price || 0),
      pieces_per_strip: Number(medicineForm.pieces_per_strip || 1),
      strips_per_box: Number(medicineForm.strips_per_box || 1),
      low_stock_threshold: Number(medicineForm.low_stock_threshold || 20),
      expiry_alert_days: Number(medicineForm.expiry_alert_days || 30),
      boxes: 0, strips: 0, pieces: 0,
      batch_number: null,
      expiry_date: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      barcode: medicineForm.barcode || medicineForm.sku || `${Date.now()}`,
      sku: medicineForm.sku || medicineForm.barcode || `SKU-${Date.now().toString().slice(-6)}`,
    };
    const { error } = await supabase.from('medicines').insert(payload).select().single();
    setSaving(false);
    if (error) setMessage(error.message); else { setMessage('Medicine saved. Now add its batch stock.'); setMedicineForm(emptyMedicine); await load(); }
  };

  const saveBatch = async (e: FormEvent) => {
    e.preventDefault();
    if (!business || !batchForm.medicine_id) return;
    setSaving(true); setMessage(null);
    const med = medicines.find((m) => m.id === batchForm.medicine_id);
    const qty = Number(batchForm.quantity || 0);
    const payload = {
      business_id: business.id,
      medicine_id: batchForm.medicine_id,
      branch_id: batchForm.branch_id || branches[0]?.id || null,
      batch_number: batchForm.batch_number.trim() || `B-${Date.now().toString().slice(-6)}`,
      manufacturing_date: batchForm.manufacturing_date || null,
      expiry_date: batchForm.expiry_date,
      quantity: qty,
      available_quantity: qty,
      unit_cost: Number(batchForm.unit_cost || med?.cost || med?.purchase_price || 0),
      purchase_price: Number(batchForm.unit_cost || med?.cost || med?.purchase_price || 0),
      rack_location: batchForm.rack_location || med?.rack_location || null,
      status: 'active',
    };
    const { data, error } = await supabase.from('medicine_batches').insert(payload).select().single();
    if (!error) {
      const newPieces = Number(med?.pieces || 0) + qty;
      await supabase.from('medicines').update({ pieces: newPieces, updated_at: new Date().toISOString() }).eq('id', batchForm.medicine_id);
      await supabase.from('stock_movements').insert({ business_id: business.id, branch_id: payload.branch_id, medicine_id: batchForm.medicine_id, batch_id: (data as any).id, type: 'purchase', quantity_in: qty, quantity_out: 0, balance_after: qty, reference: 'Manual batch entry', note: 'Batch-wise inventory entry' });
    }
    setSaving(false);
    if (error) setMessage(error.message); else { setMessage('Batch stock saved and medicine stock updated.'); setBatchForm(emptyBatch); await load(); }
  };

  if (loading) return <Spinner label="Loading medicine inventory…" />;

  return (
    <PageContainer className="max-w-8xl">
      <PageHeader title="Medicine Management" subtitle="Pharmacy-only inventory with brand, generic, strength, dosage, SKU, barcode, rack, purchase price, MRP, selling price and batch-wise FEFO stock." action={<Button onClick={load}><RefreshCcw className="h-4 w-4" />Refresh</Button>} />
      {message && <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">{message}</div>}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
        <Card className="p-5 xl:col-span-2">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Pill className="h-5 w-5 text-emerald-600" /> Add pharmacy item</h3>
          <form onSubmit={saveMedicine} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input label="Brand name" value={medicineForm.brand_name} onChange={(v) => setMedicineForm({ ...medicineForm, brand_name: v, name: medicineForm.name || v })} required />
            <Input label="Medicine name" value={medicineForm.name} onChange={(v) => setMedicineForm({ ...medicineForm, name: v })} required />
            <Input label="Generic name" value={medicineForm.generic_name} onChange={(v) => setMedicineForm({ ...medicineForm, generic_name: v })} />
            <Input label="Manufacturer" value={medicineForm.manufacturer} onChange={(v) => setMedicineForm({ ...medicineForm, manufacturer: v })} />
            <Select label="Category" value={medicineForm.category} options={CATEGORIES} onChange={(v) => setMedicineForm({ ...medicineForm, category: v })} />
            <Input label="Strength" value={medicineForm.strength} onChange={(v) => setMedicineForm({ ...medicineForm, strength: v })} placeholder="500mg" />
            <Select label="Dosage form" value={medicineForm.dosage_form} options={DOSAGE_FORMS} onChange={(v) => setMedicineForm({ ...medicineForm, dosage_form: v, medicine_type: v })} />
            <Input label="Barcode" value={medicineForm.barcode} onChange={(v) => setMedicineForm({ ...medicineForm, barcode: v })} icon={<Barcode className="h-4 w-4" />} />
            <Input label="SKU" value={medicineForm.sku} onChange={(v) => setMedicineForm({ ...medicineForm, sku: v })} />
            <Input label="Rack location" value={medicineForm.rack_location} onChange={(v) => setMedicineForm({ ...medicineForm, rack_location: v })} placeholder="A1" />
            <Input label="Purchase price" type="number" value={medicineForm.purchase_price} onChange={(v) => setMedicineForm({ ...medicineForm, purchase_price: v, cost: v })} />
            <Input label="MRP" type="number" value={medicineForm.mrp} onChange={(v) => setMedicineForm({ ...medicineForm, mrp: v })} />
            <Input label="Selling price" type="number" value={medicineForm.selling_price} onChange={(v) => setMedicineForm({ ...medicineForm, selling_price: v, price: v })} required />
            <Input label="Pieces per strip" type="number" value={medicineForm.pieces_per_strip} onChange={(v) => setMedicineForm({ ...medicineForm, pieces_per_strip: v })} />
            <Input label="Strips per box" type="number" value={medicineForm.strips_per_box} onChange={(v) => setMedicineForm({ ...medicineForm, strips_per_box: v })} />
            <Input label="Low stock threshold" type="number" value={medicineForm.low_stock_threshold} onChange={(v) => setMedicineForm({ ...medicineForm, low_stock_threshold: v })} />
            <div className="md:col-span-3">
              <ImageDropzone value={medicineForm.image_url} onChange={(url) => setMedicineForm({ ...medicineForm, image_url: url || '' })} label="Medicine photo" />
            </div>
            <div className="md:col-span-3 flex justify-end"><Button type="submit" disabled={saving}><Save className="h-4 w-4" /> Save medicine</Button></div>
          </form>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><PackagePlus className="h-5 w-5 text-emerald-600" /> Add batch stock</h3>
          <form onSubmit={saveBatch} className="space-y-3">
            <Select label="Medicine" value={batchForm.medicine_id} options={medicines.map((m) => ({ value: m.id, label: `${m.name} · ${m.strength || ''}` }))} onChange={(v) => setBatchForm({ ...batchForm, medicine_id: v })} />
            <Select label="Branch" value={batchForm.branch_id} options={branches.map((b) => ({ value: b.id, label: b.name }))} onChange={(v) => setBatchForm({ ...batchForm, branch_id: v })} />
            <Input label="Batch number" value={batchForm.batch_number} onChange={(v) => setBatchForm({ ...batchForm, batch_number: v })} />
            <Input label="Manufacturing date" type="date" value={batchForm.manufacturing_date} onChange={(v) => setBatchForm({ ...batchForm, manufacturing_date: v })} />
            <Input label="Expiry date" type="date" value={batchForm.expiry_date} onChange={(v) => setBatchForm({ ...batchForm, expiry_date: v })} required />
            <Input label="Quantity in pieces" type="number" value={batchForm.quantity} onChange={(v) => setBatchForm({ ...batchForm, quantity: v })} required />
            <Input label="Unit cost" type="number" value={batchForm.unit_cost} onChange={(v) => setBatchForm({ ...batchForm, unit_cost: v })} />
            <Input label="Rack override" value={batchForm.rack_location} onChange={(v) => setBatchForm({ ...batchForm, rack_location: v })} />
            <Button type="submit" className="w-full" disabled={saving}><Boxes className="h-4 w-4" /> Save batch</Button>
          </form>
        </Card>
      </div>

      <Card className="p-5 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div><h3 className="font-bold text-slate-900">Medicine list</h3><p className="text-xs text-slate-500">Only pharmacy items are available for pharmacy accounts.</p></div>
          <div className="relative w-full sm:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search medicines…" className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" /></div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b"><th className="py-2">Medicine</th><th>Generic</th><th>Manufacturer</th><th>Stock</th><th>Prices</th><th>Rack</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.map((m) => <tr key={m.id} className="border-b border-slate-100"><td className="py-3"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-emerald-50 overflow-hidden grid place-items-center">{m.image_url ? <img src={m.image_url} className="h-full w-full object-cover" /> : <Pill className="h-5 w-5 text-emerald-600" />}</div><div><p className="font-bold text-slate-900">{m.name}</p><p className="text-xs text-slate-500">{m.category} · {m.strength} · {m.dosage_form}</p><p className="text-[11px] text-slate-400">SKU {m.sku || m.barcode}</p></div></div></td><td>{m.generic_name}</td><td>{m.manufacturer}</td><td><p className="font-semibold">{unitText(m)}</p><p className="text-xs text-slate-500">{m.pieces || 0} pieces</p></td><td><p className="text-xs">Buy: {formatMoney(Number(m.purchase_price || m.cost || 0), business?.currency || 'BDT')}</p><p className="text-xs">MRP: {formatMoney(Number(m.mrp || 0), business?.currency || 'BDT')}</p><p className="font-bold">Sell: {formatMoney(Number(m.selling_price || m.price || 0), business?.currency || 'BDT')}</p></td><td>{m.rack_location || '-'}</td><td>{Number(m.pieces || 0) <= Number(m.low_stock_threshold || 20) ? <Badge color="red">Low stock</Badge> : <Badge color="green">Active</Badge>}</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4"><CalendarClock className="h-5 w-5 text-emerald-600" /><div><h3 className="font-bold text-slate-900">Batch-wise inventory and FEFO queue</h3><p className="text-xs text-slate-500">POS automatically sells from the earliest expiry batch first.</p></div></div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b"><th className="py-2">Batch</th><th>Medicine</th><th>MFG</th><th>Expiry</th><th>Qty</th><th>Cost</th><th>Rack</th><th>Alert</th></tr></thead>
            <tbody>{batches.map((b) => { const m = medicines.find((x) => x.id === b.medicine_id); return <tr key={b.id} className="border-b border-slate-100"><td className="py-2 font-bold">{b.batch_number}</td><td>{m?.name || '-'}</td><td>{b.manufacturing_date ? formatShortDate(b.manufacturing_date) : '-'}</td><td>{formatShortDate(b.expiry_date)}</td><td>{b.available_quantity}</td><td>{formatMoney(Number(b.unit_cost || 0), business?.currency || 'BDT')}</td><td>{b.rack_location || m?.rack_location || '-'}</td><td><ExpiryBadge expiry={b.expiry_date} /> <span className="text-xs text-slate-400 ml-1">{daysUntil(b.expiry_date)} days</span></td></tr>; })}</tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}

function Input({ label, value, onChange, type = 'text', required, placeholder, icon }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string; icon?: any }) {
  return <label className="block"><span className="block text-xs font-bold text-slate-600 mb-1">{label}{required ? ' *' : ''}</span><div className="relative">{icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}<input required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`w-full rounded-lg border border-slate-200 bg-white ${icon ? 'pl-9' : 'px-3'} py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100`} /></div></label>;
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[] }) {
  return <label className="block"><span className="block text-xs font-bold text-slate-600 mb-1">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"><option value="">Select</option>{options.map((o) => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
}
