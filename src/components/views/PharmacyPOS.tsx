import { useEffect, useMemo, useState } from 'react';
import { Banknote, Barcode, CheckCircle2, CreditCard, FileText, Minus, Plus, Printer, QrCode, Receipt, Search, Smartphone, Trash2, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest, supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/utils';
import { Button, Modal, Spinner, Badge } from '../ui/Shared';
import BarcodeScanner from '../barcode/BarcodeScanner';
import { PAYMENT_METHODS, piecesFromUnits, unitText } from './pharmacyHelpers';

type CartLine = { medicine: any; quantity: number; unit: 'piece' | 'strip' | 'box' };

const paymentIcons: Record<string, any> = { cash: Banknote, card: CreditCard, bkash: Smartphone, nagad: Smartphone, bangla_qr: QrCode, due: Wallet };

export default function PharmacyPOS() {
  const { business } = useAuth();
  const [medicines, setMedicines] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<(typeof PAYMENT_METHODS)[number]>('cash');
  const [customerId, setCustomerId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [discount, setDiscount] = useState('0');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);

  const load = async () => {
    if (!business) return;
    setLoading(true);
    const [m, c, b] = await Promise.all([
      supabase.from('medicines').select('*').eq('business_id', business.id).eq('is_active', true).order('name', { ascending: true }),
      supabase.from('customers').select('*').eq('business_id', business.id).order('name', { ascending: true }),
      supabase.from('branches').select('*').eq('business_id', business.id).order('name', { ascending: true }),
    ]);
    setMedicines((m.data as any[]) || []);
    setCustomers((c.data as any[]) || []);
    setBranches((b.data as any[]) || []);
    setBranchId(((b.data as any[]) || [])[0]?.id || '');
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [business]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return medicines.filter((m) => !q || [m.name, m.brand_name, m.generic_name, m.barcode, m.sku, m.category, m.rack_location].some((v) => String(v || '').toLowerCase().includes(q))).slice(0, 30);
  }, [query, medicines]);

  const add = (medicine: any) => {
    if (Number(medicine.pieces || 0) <= 0) return;
    setCart((prev) => {
      const existing = prev.find((x) => x.medicine.id === medicine.id && x.unit === 'piece');
      if (existing) return prev.map((x) => x === existing ? { ...x, quantity: x.quantity + 1 } : x);
      return [...prev, { medicine, quantity: 1, unit: 'piece' }];
    });
  };

  const subtotal = cart.reduce((s, l) => s + Number(l.medicine[l.unit === 'box' ? 'box_price' : l.unit === 'strip' ? 'strip_price' : 'price'] || l.medicine.selling_price || l.medicine.price || 0) * l.quantity, 0);
  const total = Math.max(subtotal - Number(discount || 0), 0);

  const setQty = (idx: number, q: number) => setCart((prev) => prev.map((l, i) => i === idx ? { ...l, quantity: Math.max(1, q) } : l));
  const setUnit = (idx: number, unit: 'piece' | 'strip' | 'box') => setCart((prev) => prev.map((l, i) => i === idx ? { ...l, unit } : l));
  const remove = (idx: number) => setCart((prev) => prev.filter((_, i) => i !== idx));

  const scan = (code: string) => {
    const m = medicines.find((x) => String(x.barcode || x.sku || '').toLowerCase() === code.toLowerCase());
    if (m) { add(m); setScannerOpen(false); setError(null); }
    else setError(`No medicine found for barcode ${code}`);
  };

  const charge = async () => {
    if (!cart.length) return setError('Cart is empty.');
    setSaving(true); setError(null);
    try {
      const payload = {
        branch_id: branchId || null,
        customer_id: customerId || null,
        customer_name: customers.find((c) => c.id === customerId)?.name || null,
        payment_method: payment,
        discount: Number(discount || 0),
        due_amount: payment === 'due' ? total : 0,
        items: cart.map((l) => ({ medicine_id: l.medicine.id, quantity: l.quantity, unit: l.unit })),
      };
      const res = await apiRequest<{ data: any }>('/pharmacy/pos/sale', { method: 'POST', body: JSON.stringify(payload) });
      setReceipt(res.data);
      setCart([]); setDiscount('0');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sale failed.');
    } finally { setSaving(false); }
  };

  if (loading) return <Spinner label="Loading pharmacy POS…" />;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col xl:flex-row bg-slate-50">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="bg-white border-b border-slate-200 p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search medicine by name, generic, barcode, SKU, category or rack…" className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-3 text-sm outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100" /></div>
            <Button onClick={() => setScannerOpen(true)}><Barcode className="h-4 w-4" /> Scan barcode</Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
            {filtered.map((m) => <button key={m.id} onClick={() => add(m)} className="group text-left rounded-2xl bg-white border border-slate-200 p-3 hover:border-emerald-300 hover:shadow-lg transition-all disabled:opacity-50" disabled={Number(m.pieces || 0) <= 0}>
              <div className="flex gap-3"><div className="h-14 w-14 rounded-2xl bg-emerald-50 overflow-hidden grid place-items-center">{m.image_url ? <img src={m.image_url} className="h-full w-full object-cover" /> : <FileText className="h-6 w-6 text-emerald-600" />}</div><div className="min-w-0 flex-1"><p className="font-bold text-slate-900 line-clamp-1">{m.name}</p><p className="text-xs text-slate-500 line-clamp-1">{m.generic_name} · {m.strength} · {m.dosage_form}</p><p className="text-[11px] text-slate-400">Rack {m.rack_location || 'N/A'} · {m.barcode || m.sku}</p></div></div>
              <div className="mt-3 flex items-center justify-between"><span className="font-extrabold text-slate-900">{formatMoney(Number(m.selling_price || m.price || 0), business?.currency || 'BDT')}</span><Badge color={Number(m.pieces || 0) <= Number(m.low_stock_threshold || 20) ? 'red' : 'green'}>{Number(m.pieces || 0) <= 0 ? 'Out' : unitText(m)}</Badge></div>
            </button>)}
          </div>
        </div>
      </div>
      <aside className="w-full xl:w-[460px] bg-white border-l border-slate-200 flex flex-col">
        <div className="p-4 border-b"><h2 className="text-lg font-extrabold text-slate-900">Fast POS</h2><p className="text-xs text-slate-500">FEFO batch sale · Unit conversion · Due support</p></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2"><label className="block"><span className="text-xs font-bold text-slate-600">Branch</span><select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label className="block"><span className="text-xs font-bold text-slate-600">Customer</span><select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">Walk-in</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
          {cart.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-500">Add medicines to start invoice.</div> : cart.map((l, idx) => {
            const price = Number(l.medicine[l.unit === 'box' ? 'box_price' : l.unit === 'strip' ? 'strip_price' : 'price'] || l.medicine.selling_price || l.medicine.price || 0);
            const pieces = piecesFromUnits(l.medicine, l.quantity, l.unit);
            return <div key={`${l.medicine.id}-${idx}`} className="rounded-2xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-bold text-slate-900 text-sm">{l.medicine.name}</p><p className="text-xs text-slate-500">FEFO out: {pieces} pieces · {formatMoney(price, business?.currency || 'BDT')} / {l.unit}</p></div><button onClick={() => remove(idx)} className="text-rose-500"><Trash2 className="h-4 w-4" /></button></div><div className="mt-3 grid grid-cols-3 gap-2"><select value={l.unit} onChange={(e) => setUnit(idx, e.target.value as any)} className="rounded-lg border border-slate-200 px-2 py-2 text-sm"><option value="piece">Piece</option><option value="strip">Strip</option><option value="box">Box</option></select><div className="flex rounded-lg border border-slate-200 overflow-hidden"><button onClick={() => setQty(idx, l.quantity - 1)} className="px-2"><Minus className="h-4 w-4" /></button><input value={l.quantity} onChange={(e) => setQty(idx, Number(e.target.value || 1))} className="w-full text-center text-sm outline-none" /><button onClick={() => setQty(idx, l.quantity + 1)} className="px-2"><Plus className="h-4 w-4" /></button></div><div className="text-right font-bold py-2">{formatMoney(price * l.quantity, business?.currency || 'BDT')}</div></div></div>;
          })}
        </div>
        <div className="border-t border-slate-200 p-4">
          {error && <div className="mb-3 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700">{error}</div>}
          <div className="grid grid-cols-3 gap-2 mb-3">{PAYMENT_METHODS.map((p) => { const Icon = paymentIcons[p]; return <button key={p} onClick={() => setPayment(p)} className={`rounded-xl border px-2 py-2 text-xs font-bold flex flex-col items-center gap-1 ${payment === p ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Icon className="h-4 w-4" />{p.replace('_', ' ')}</button>; })}</div>
          <div className="flex items-center gap-2 mb-3"><input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="Discount" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /><div className="text-right min-w-36"><p className="text-xs text-slate-500">Total</p><p className="text-2xl font-extrabold text-slate-900">{formatMoney(total, business?.currency || 'BDT')}</p></div></div>
          <Button onClick={charge} disabled={saving || !cart.length} className="w-full" size="lg"><Receipt className="h-4 w-4" /> {saving ? 'Processing…' : `Complete sale`}</Button>
        </div>
      </aside>
      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={scan} />
      <ReceiptModal open={!!receipt} onClose={() => setReceipt(null)} data={receipt} currency={business?.currency || 'BDT'} />
    </div>
  );
}

function ReceiptModal({ open, onClose, data, currency }: { open: boolean; onClose: () => void; data: any; currency: string }) {
  if (!data) return null;
  return <Modal open={open} onClose={onClose} title="Thermal invoice preview" size="sm"><div className="p-5"><div className="mx-auto max-w-xs border border-slate-200 p-4 text-sm"><div className="text-center border-b pb-3 mb-3"><h3 className="font-extrabold">Pharmacy Invoice</h3><p className="text-xs text-slate-500">#{data.sale?.id?.slice(-8).toUpperCase()}</p></div>{(data.items || []).map((i: any) => <div key={i.id} className="flex justify-between gap-3 py-1"><span>{i.name} × {i.quantity}</span><strong>{formatMoney(i.line_total, currency)}</strong></div>)}<div className="border-t mt-3 pt-3 flex justify-between text-base"><strong>Total</strong><strong>{formatMoney(data.sale?.total || 0, currency)}</strong></div><p className="mt-2 text-xs text-slate-500">Payment: {data.sale?.payment_method}</p></div><Button onClick={() => window.print()} className="mt-4 w-full"><Printer className="h-4 w-4" /> Print receipt</Button><Button variant="secondary" onClick={onClose} className="mt-2 w-full"><CheckCircle2 className="h-4 w-4" /> Done</Button></div></Modal>;
}
