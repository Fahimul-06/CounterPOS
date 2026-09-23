import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Barcode,
  CheckCircle2,
  CreditCard,
  FileText,
  Minus,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Search,
  Smartphone,
  Trash2,
  Wallet,
  ShoppingCart,
  X,
  PackageCheck,
  MapPin,
  UserRound,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest, supabase } from '../../lib/supabase';
import { classNames, formatMoney } from '../../lib/utils';
import { Button, Modal, Spinner, Badge, EmptyState } from '../ui/Shared';
import BarcodeScanner from '../barcode/BarcodeScanner';
import { PAYMENT_METHODS, piecesFromUnits, unitText } from './pharmacyHelpers';

type CartLine = { medicine: any; quantity: number; unit: 'piece' | 'strip' | 'box' };

const paymentIcons: Record<string, any> = {
  cash: Banknote,
  card: CreditCard,
  bkash: Smartphone,
  nagad: Smartphone,
  bangla_qr: QrCode,
  due: Wallet,
};

const paymentLabels: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  bkash: 'bKash',
  nagad: 'Nagad',
  bangla_qr: 'Bangla QR',
  due: 'Due',
};

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
    return medicines
      .filter((m) => !q || [m.name, m.brand_name, m.generic_name, m.barcode, m.sku, m.category, m.rack_location].some((v) => String(v || '').toLowerCase().includes(q)))
      .slice(0, 36);
  }, [query, medicines]);

  const add = (medicine: any) => {
    if (Number(medicine.pieces || 0) <= 0) return;
    setError(null);
    setCart((prev) => {
      const existing = prev.find((x) => x.medicine.id === medicine.id && x.unit === 'piece');
      if (existing) return prev.map((x) => x === existing ? { ...x, quantity: x.quantity + 1 } : x);
      return [...prev, { medicine, quantity: 1, unit: 'piece' }];
    });
  };

  const subtotal = cart.reduce((s, l) => s + Number(l.medicine[l.unit === 'box' ? 'box_price' : l.unit === 'strip' ? 'strip_price' : 'price'] || l.medicine.selling_price || l.medicine.price || 0) * l.quantity, 0);
  const totalPieces = cart.reduce((s, l) => s + piecesFromUnits(l.medicine, l.quantity, l.unit), 0);
  const total = Math.max(subtotal - Number(discount || 0), 0);
  const selectedCustomer = customers.find((c) => c.id === customerId);

  const setQty = (idx: number, q: number) => setCart((prev) => prev.map((l, i) => i === idx ? { ...l, quantity: Math.max(1, q || 1) } : l));
  const setUnit = (idx: number, unit: 'piece' | 'strip' | 'box') => setCart((prev) => prev.map((l, i) => i === idx ? { ...l, unit } : l));
  const remove = (idx: number) => setCart((prev) => prev.filter((_, i) => i !== idx));

  const scan = (code: string) => {
    const m = medicines.find((x) => String(x.barcode || x.sku || '').toLowerCase() === code.toLowerCase());
    if (m) { add(m); setScannerOpen(false); setError(null); }
    else setError(`No medicine found for barcode ${code}`);
  };

  const charge = async () => {
    if (!cart.length) return setError('Cart is empty. Add at least one medicine before completing sale.');
    setSaving(true); setError(null);
    try {
      const payload = {
        branch_id: branchId || null,
        customer_id: customerId || null,
        customer_name: selectedCustomer?.name || null,
        payment_method: payment,
        discount: Number(discount || 0),
        due_amount: payment === 'due' ? total : 0,
        items: cart.map((l) => ({ medicine_id: l.medicine.id, quantity: l.quantity, unit: l.unit })),
      };
      const res = await apiRequest<{ data: any }>('/pharmacy/pos/sale', { method: 'POST', body: JSON.stringify(payload) });
      setReceipt(res.data);
      setCart([]); setDiscount('0'); setCustomerId('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sale failed.');
    } finally { setSaving(false); }
  };

  if (loading) return <Spinner label="Loading professional pharmacy POS…" />;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-transparent p-2 sm:p-4 lg:p-5">
      <div className="mx-auto grid max-w-[1900px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0 overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 shadow-soft backdrop-blur-xl">
          <div className="border-b border-slate-200/80 bg-white/70 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
                  <ShieldCheck className="h-3.5 w-3.5" /> FEFO pharmacy billing
                </div>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Fast Pharmacy POS</h1>
                <p className="mt-1 text-sm text-slate-500">Search, scan, add to cart, choose payment and print a thermal receipt.</p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
                <Metric label="Items" value={cart.length} />
                <Metric label="Pieces" value={totalPieces} />
                <Metric label="Total" value={formatMoney(total, business?.currency || 'BDT')} strong />
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by medicine, generic, barcode, SKU, category or rack…"
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50/80 py-3.5 pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100/80"
                  autoFocus
                />
                {query && (
                  <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Clear search">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button onClick={() => setScannerOpen(true)} size="lg" className="rounded-3xl">
                <Barcode className="h-4 w-4" /> Scan barcode
              </Button>
            </div>
          </div>

          <div className="max-h-[calc(100vh-17rem)] overflow-y-auto pos-scrollbar p-4 sm:p-5">
            {filtered.length === 0 ? (
              <EmptyState icon={Search} title="No medicine found" description="Try brand name, generic name, SKU, barcode, category or rack location." />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {filtered.map((m) => {
                  const stock = Number(m.pieces || 0);
                  const low = stock <= Number(m.low_stock_threshold || 20);
                  return (
                    <button
                      key={m.id}
                      onClick={() => add(m)}
                      className="group text-left rounded-3xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-soft-lg disabled:cursor-not-allowed disabled:opacity-55"
                      disabled={stock <= 0}
                    >
                      <div className="flex gap-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 grid place-items-center ring-1 ring-emerald-100">
                          {m.image_url ? <img src={m.image_url} className="h-full w-full object-cover" alt={m.name} /> : <FileText className="h-7 w-7 text-emerald-600" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-black leading-5 text-slate-950 line-clamp-2">{m.name}</p>
                            <Badge color={stock <= 0 ? 'red' : low ? 'amber' : 'green'}>{stock <= 0 ? 'Out' : low ? 'Low' : 'Stock'}</Badge>
                          </div>
                          <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">{m.generic_name || 'Generic'} · {m.strength || 'Strength'} · {m.dosage_form || 'Form'}</p>
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400"><MapPin className="h-3 w-3" /> Rack {m.rack_location || 'N/A'} · {m.barcode || m.sku || 'No code'}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Selling price</p>
                          <p className="text-lg font-black text-slate-950">{formatMoney(Number(m.selling_price || m.price || 0), business?.currency || 'BDT')}</p>
                        </div>
                        <p className="rounded-2xl bg-slate-50 px-2.5 py-1 text-right text-[11px] font-bold text-slate-600">{unitText(m)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-soft-lg backdrop-blur-xl xl:sticky xl:top-16 xl:h-[calc(100vh-4.25rem)] xl:max-h-[calc(100vh-4.25rem)]">
          <div className="border-b border-slate-200/80 bg-slate-950 p-3.5 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Current invoice</p>
                <h2 className="mt-1 text-lg font-black">Cart & payment</h2>
                <p className="mt-1 text-xs font-semibold text-slate-300">{cart.length} selected · {formatMoney(total, business?.currency || 'BDT')}</p>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10">
                <ShoppingCart className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="space-y-3 border-b border-slate-200 bg-slate-50/80 p-3.5">
            <div className="grid grid-cols-1 gap-3">
              <label className="block">
                <span className="mb-1 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500"><MapPin className="h-3.5 w-3.5" /> Branch</span>
                <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="form-control">
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500"><UserRound className="h-3.5 w-3.5" /> Customer</span>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="form-control">
                  <option value="">Walk-in customer</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pos-cart-scroll p-3.5">
            {cart.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <PackageCheck className="mx-auto h-10 w-10 text-emerald-500" />
                <p className="mt-3 font-black text-slate-950">Cart is empty</p>
                <p className="mt-1 text-sm text-slate-500">Add medicine from the left or scan barcode.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((l, idx) => {
                  const price = Number(l.medicine[l.unit === 'box' ? 'box_price' : l.unit === 'strip' ? 'strip_price' : 'price'] || l.medicine.selling_price || l.medicine.price || 0);
                  const pieces = piecesFromUnits(l.medicine, l.quantity, l.unit);
                  const lineTotal = price * l.quantity;
                  return (
                    <div key={`${l.medicine.id}-${idx}`} className="rounded-[1.5rem] border border-slate-200 bg-white p-3.5 shadow-sm ring-1 ring-slate-100 transition hover:border-emerald-200 hover:shadow-soft">
                      <div className="flex items-start gap-3">
                        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 ring-1 ring-emerald-100">
                          {l.medicine.image_url ? <img src={l.medicine.image_url} alt={l.medicine.name} className="h-full w-full object-cover" /> : <FileText className="h-6 w-6 text-emerald-600" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="line-clamp-2 text-sm font-black leading-5 text-slate-950">{l.medicine.name}</p>
                              <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">{l.medicine.generic_name || 'Generic'} · {l.medicine.strength || 'Strength'} · Rack {l.medicine.rack_location || 'N/A'}</p>
                            </div>
                            <button onClick={() => remove(idx)} className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl text-rose-500 hover:bg-rose-50" aria-label="Remove item">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-extrabold text-slate-500">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1">FEFO: {pieces} pieces</span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1">Rate: {formatMoney(price, business?.currency || 'BDT')} / {l.unit}</span>
                            {(l.medicine.barcode || l.medicine.sku) && <span className="rounded-full bg-slate-100 px-2.5 py-1">{l.medicine.barcode || l.medicine.sku}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-[112px_minmax(0,1fr)] gap-3">
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-400">Unit</span>
                          <select value={l.unit} onChange={(e) => setUnit(idx, e.target.value as any)} className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-black outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100">
                            <option value="piece">Piece</option>
                            <option value="strip">Strip</option>
                            <option value="box">Box</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-400">Quantity</span>
                          <div className="flex h-11 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                            <button onClick={() => setQty(idx, l.quantity - 1)} className="grid w-12 place-items-center text-slate-600 hover:bg-white"><Minus className="h-4 w-4" /></button>
                            <input value={l.quantity} onChange={(e) => setQty(idx, Number(e.target.value || 1))} className="w-full min-w-0 bg-transparent text-center text-base font-black outline-none" />
                            <button onClick={() => setQty(idx, l.quantity + 1)} className="grid w-12 place-items-center text-slate-600 hover:bg-white"><Plus className="h-4 w-4" /></button>
                          </div>
                        </label>
                        <div className="col-span-2 rounded-2xl bg-slate-950 px-4 py-3 text-right text-white">
                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Line total</p>
                          <p className="mt-0.5 whitespace-nowrap text-lg font-black">{formatMoney(lineTotal, business?.currency || 'BDT')}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white p-3.5">
            {error && <div className="mb-3 flex items-start gap-2 rounded-2xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700"><AlertCircle className="h-4 w-4 mt-0.5" />{error}</div>}

            <div className="mb-3 grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((p) => {
                const Icon = paymentIcons[p];
                return (
                  <button key={p} onClick={() => setPayment(p)} className={classNames('rounded-2xl border px-2 py-2.5 text-xs font-black flex flex-col items-center gap-1 transition-all', payment === p ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                    <Icon className="h-4 w-4" />{paymentLabels[p]}
                  </button>
                );
              })}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="mb-3 flex items-center gap-2">
                <label className="flex-1">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">Discount</span>
                  <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className="form-control bg-white" />
                </label>
                {cart.length > 0 && <Button variant="ghost" onClick={() => setCart([])} className="mt-6 text-rose-600 hover:bg-rose-50">Clear</Button>}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="font-bold text-slate-700">{formatMoney(subtotal, business?.currency || 'BDT')}</span></div>
                <div className="flex justify-between text-slate-500"><span>Discount</span><span className="font-bold text-emerald-700">-{formatMoney(Number(discount || 0), business?.currency || 'BDT')}</span></div>
                <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-xl font-black text-slate-950"><span>Total</span><span>{formatMoney(total, business?.currency || 'BDT')}</span></div>
              </div>
            </div>

            <Button onClick={charge} disabled={saving || !cart.length} className="mt-3 w-full rounded-3xl py-3.5 text-sm" size="lg">
              <Receipt className="h-4 w-4" /> {saving ? 'Processing sale…' : `Complete sale & receipt`}
            </Button>
          </div>
        </aside>
      </div>

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={scan} />
      <ReceiptModal open={!!receipt} onClose={() => setReceipt(null)} data={receipt} business={business} currency={business?.currency || 'BDT'} />
    </div>
  );
}

function Metric({ label, value, strong }: { label: string; value: string | number; strong?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className={classNames('mt-0.5 truncate font-black text-slate-950', strong ? 'text-base' : 'text-xl')}>{value}</p>
    </div>
  );
}

function paymentLabel(method?: string) {
  return paymentLabels[String(method || '').toLowerCase()] || String(method || 'Cash');
}

function shortInvoice(id?: string) {
  return id ? id.slice(-8).toUpperCase() : 'N/A';
}

function formatDateTime(value?: string) {
  if (!value) return new Date().toLocaleString();
  return new Date(value).toLocaleString();
}

function ReceiptModal({
  open,
  onClose,
  data,
  business,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  data: any;
  business: any;
  currency: string;
}) {
  if (!data) return null;
  const sale = data.sale || {};
  const items = data.items || [];
  const subtotal = Number(sale.subtotal || items.reduce((sum: number, item: any) => sum + Number(item.line_total || 0), 0));
  const discount = Number(sale.discount || 0);
  const total = Number(sale.total || Math.max(subtotal - discount, 0));
  const paidAmount = sale.payment_method === 'due' ? 0 : total;
  const dueAmount = sale.payment_method === 'due' ? total : 0;

  return (
    <Modal open={open} onClose={onClose} title="Professional pharmacy receipt" size="sm">
      <div className="p-4 bg-slate-50">
        <div className="print-receipt mx-auto max-w-[360px] rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm print:shadow-none print:border-0">
          <div className="text-center border-b border-dashed border-slate-300 pb-4">
            {business?.logo_url ? (
              <img src={business.logo_url} alt="Business logo" className="mx-auto mb-2 h-14 w-14 rounded-xl object-contain" />
            ) : (
              <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <Receipt className="h-6 w-6" />
              </div>
            )}
            <h2 className="text-lg font-extrabold uppercase tracking-wide text-slate-950">{business?.business_name || 'Pharmacy'}</h2>
            {business?.address && <p className="mt-1 text-[11px] leading-4 text-slate-600">{business.address}</p>}
            {business?.phone && <p className="text-[11px] text-slate-600">Phone: {business.phone}</p>}
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">Sales Receipt</p>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-b border-dashed border-slate-300 py-3 text-[11px] text-slate-600">
            <span>Invoice</span><span className="text-right font-mono font-bold text-slate-900">#{shortInvoice(sale.id)}</span>
            <span>Date</span><span className="text-right font-medium text-slate-800">{formatDateTime(sale.created_at)}</span>
            <span>Payment</span><span className="text-right font-bold text-slate-900">{paymentLabel(sale.payment_method)}</span>
            {sale.customer_name && <><span>Customer</span><span className="text-right font-medium text-slate-800">{sale.customer_name}</span></>}
            <span>Status</span><span className="text-right font-bold capitalize text-emerald-700">{sale.status || 'completed'}</span>
          </div>

          <div className="py-3">
            <div className="grid grid-cols-[1fr_42px_74px] border-b border-slate-200 pb-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
              <span>Medicine</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="divide-y divide-slate-100">
              {items.map((item: any, index: number) => (
                <div key={item.id || index} className="grid grid-cols-[1fr_42px_74px] gap-2 py-2 text-[12px]">
                  <div className="min-w-0">
                    <p className="font-bold leading-4 text-slate-900">{item.name}</p>
                    <p className="text-[10px] text-slate-500">Rate: {formatMoney(Number(item.unit_price || 0), currency)}</p>
                  </div>
                  <span className="text-center font-semibold text-slate-700">{item.quantity}</span>
                  <span className="text-right font-bold text-slate-900">{formatMoney(Number(item.line_total || 0), currency)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-dashed border-slate-300 pt-3 text-[12px]">
            <div className="flex justify-between py-0.5 text-slate-600"><span>Subtotal</span><span>{formatMoney(subtotal, currency)}</span></div>
            {discount > 0 && <div className="flex justify-between py-0.5 text-emerald-700"><span>Discount</span><span>-{formatMoney(discount, currency)}</span></div>}
            <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-extrabold text-slate-950">
              <span>Total</span>
              <span>{formatMoney(total, currency)}</span>
            </div>
            <div className="mt-1 flex justify-between text-slate-600"><span>Paid</span><span>{formatMoney(paidAmount, currency)}</span></div>
            {dueAmount > 0 && <div className="flex justify-between font-bold text-rose-600"><span>Due</span><span>{formatMoney(dueAmount, currency)}</span></div>}
          </div>

          <div className="mt-4 border-t border-dashed border-slate-300 pt-3 text-center">
            <p className="text-[11px] font-semibold text-slate-700">{business?.receipt_message || 'Thank you for your purchase.'}</p>
            <p className="mt-1 text-[10px] text-slate-500">Goods once sold are not returnable without valid invoice.</p>
            <p className="mt-2 text-[10px] text-slate-400">Powered by CounterPOS</p>
          </div>
        </div>

        <div className="mt-4 flex gap-2 no-print">
          <Button onClick={() => window.print()} className="flex-1">
            <Printer className="h-4 w-4" />
            Print receipt
          </Button>
          <Button variant="secondary" onClick={onClose} className="flex-1">
            <CheckCircle2 className="h-4 w-4" />
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
