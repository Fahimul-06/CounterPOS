import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Banknote, CreditCard, Flame, Minus, Plus, Printer, Receipt, Search, ShoppingCart, Trash2, Wallet } from 'lucide-react';
import { apiRequest, supabase } from '../../lib/supabase';
import type { LpgCylinder, Sale, SaleItem, LpgCylinderSale } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { classNames, formatDate, formatMoney } from '../../lib/utils';
import { Badge, Button, Card, EmptyState, Modal, PageContainer, PageHeader, Spinner } from '../ui/Shared';

type PaymentMethod = 'cash' | 'card' | 'bkash' | 'nagad' | 'bangla_qr' | 'other';

type CartLine = {
  cylinder: LpgCylinder;
  quantity: number;
  empty_return_quantity: number;
  empty_return_size: string;
  empty_return_company: string;
};

type CompletedSale = { sale: Sale; items: SaleItem[]; lpg_items: LpgCylinderSale[] };

const EMPTY_SIZES = ['5.5 kg', '12 kg', '20 kg', '25 kg', '35 kg', '45 kg'];
const EMPTY_COMPANIES = ['Bashundhara LP Gas', 'Jamuna Gas', 'Omera LPG', 'Beximco LPG', 'Navana LPG', 'Laugfs Gas', 'Totalgaz', 'Orion LPG', 'Petromax LPG', 'Other'];

export default function LpgPOS() {
  const { business } = useAuth();
  const [items, setItems] = useState<LpgCylinder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [discount, setDiscount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<CompletedSale | null>(null);
  const currency = business?.currency ?? 'BDT';

  const load = async () => {
    if (!business) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('lpg_cylinders')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('company', { ascending: true });
    if (error) setError(error.message);
    else setItems((data || []) as LpgCylinder[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [business]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => [item.company, item.cylinder_size, item.item_type, item.sku].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [items, search]);

  const subtotal = cart.reduce((sum, line) => sum + line.quantity * Number(line.cylinder.price || 0), 0);
  const discountValue = Math.max(Number(discount || 0), 0);
  const total = Math.max(subtotal - discountValue, 0);

  const addToCart = (item: LpgCylinder) => {
    if (Number(item.full_stock || 0) <= 0) return;
    setError(null);
    setCart((prev) => {
      const found = prev.find((x) => x.cylinder.id === item.id);
      if (found) {
        return prev.map((x) => x.cylinder.id === item.id ? { ...x, quantity: Math.min(x.quantity + 1, Number(item.full_stock || 0)), empty_return_quantity: Math.min(x.empty_return_quantity + 1, Number(item.full_stock || 0)) } : x);
      }
      return [...prev, { cylinder: item, quantity: 1, empty_return_quantity: item.item_type === 'refill' ? 1 : 0, empty_return_size: item.cylinder_size, empty_return_company: item.company }];
    });
  };

  const updateLine = (id: string, patch: Partial<CartLine>) => {
    setCart((prev) => prev.map((x) => x.cylinder.id === id ? { ...x, ...patch } : x));
  };

  const changeQty = (id: string, delta: number) => {
    setCart((prev) => prev.map((x) => {
      if (x.cylinder.id !== id) return x;
      const qty = Math.max(1, Math.min(x.quantity + delta, Number(x.cylinder.full_stock || 0)));
      return { ...x, quantity: qty, empty_return_quantity: Math.min(x.empty_return_quantity, qty) };
    }));
  };

  const removeLine = (id: string) => setCart((prev) => prev.filter((x) => x.cylinder.id !== id));

  const completeSale = async () => {
    if (!cart.length) {
      setError('Cart is empty. Add at least one LPG cylinder.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        payment_method: payment,
        discount: discountValue,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        note: note.trim() || null,
        items: cart.map((line) => ({
          cylinder_id: line.cylinder.id,
          quantity: line.quantity,
          unit_price: line.cylinder.price,
          empty_return_quantity: line.empty_return_quantity,
          empty_return_size: line.empty_return_size,
          empty_return_company: line.empty_return_company,
        })),
      };
      const res = await apiRequest<{ data: CompletedSale }>('/lpg/pos/sale', { method: 'POST', body: JSON.stringify(body) });
      setCompleted(res.data);
      setCart([]);
      setDiscount('');
      setCustomerName('');
      setCustomerPhone('');
      setNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sale failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const printReceipt = () => {
    if (!completed || !business) return;
    const w = window.open('', '_blank', 'width=420,height=680');
    if (!w) return;
    const lines = completed.lpg_items || [];
    w.document.write(`<!doctype html><html><head><title>LPG Receipt</title><style>
      @page{size:80mm auto;margin:4mm} body{font-family:Arial, sans-serif;color:#111827;margin:0;font-size:12px}.receipt{width:72mm;margin:auto}.center{text-align:center}.shop{font-size:18px;font-weight:800}.muted{color:#64748b}.hr{border-top:1px dashed #94a3b8;margin:8px 0}.row{display:flex;justify-content:space-between;gap:8px}.total{font-size:16px;font-weight:900}.item{margin:7px 0}.badge{display:inline-block;border:1px solid #111827;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:800}table{width:100%;border-collapse:collapse}td{vertical-align:top;padding:2px 0}</style></head><body><div class="receipt">
      <div class="center"><div class="shop">${escapeHtml(business.business_name || 'LPG Shop')}</div><div class="muted">${escapeHtml(business.address || '')}</div><div>${escapeHtml(business.phone || '')}</div><div style="margin-top:4px"><span class="badge">LPG SALE RECEIPT</span></div></div>
      <div class="hr"></div><div class="row"><span>Invoice</span><b>#${completed.sale.id.slice(-8).toUpperCase()}</b></div><div class="row"><span>Date</span><span>${formatDate(completed.sale.created_at)}</span></div><div class="row"><span>Payment</span><b>${completed.sale.payment_method}</b></div>${completed.sale.customer_name ? `<div class="row"><span>Customer</span><b>${escapeHtml(completed.sale.customer_name)}</b></div>` : ''}${completed.sale.customer_phone ? `<div class="row"><span>Phone</span><span>${escapeHtml(completed.sale.customer_phone)}</span></div>` : ''}
      <div class="hr"></div>
      ${lines.map((x) => `<div class="item"><b>${escapeHtml(x.sold_company)} ${escapeHtml(x.sold_size)} ${x.sold_item_type}</b><div class="row"><span>Sold: ${x.sold_quantity} x ${formatMoney(x.unit_price, currency)}</span><b>${formatMoney(x.line_total, currency)}</b></div><div class="muted">Empty received: ${x.empty_return_quantity} ${escapeHtml(x.empty_return_company || '-')} ${escapeHtml(x.empty_return_size || '')}</div></div>`).join('')}
      <div class="hr"></div><div class="row"><span>Subtotal</span><b>${formatMoney(completed.sale.subtotal, currency)}</b></div><div class="row"><span>Discount</span><b>${formatMoney(completed.sale.discount, currency)}</b></div><div class="row total"><span>Total</span><span>${formatMoney(completed.sale.total, currency)}</span></div><div class="hr"></div><div class="center muted">${escapeHtml(business.receipt_message || 'Thank you. Please check cylinder seal and weight before leaving.')}</div></div><script>window.onload=function(){setTimeout(function(){window.print();},200)}</script></body></html>`);
    w.document.close();
  };

  if (loading) return <PageContainer><Spinner label="Loading LPG POS…" /></PageContainer>;

  return (
    <PageContainer className="max-w-[1600px]">
      <PageHeader title="LPG Cylinder POS" subtitle="Sell full/refill cylinders and record which empty cylinder returned to the shop against every sale." />
      {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 flex gap-2"><AlertCircle className="h-4 w-4 mt-0.5" />{error}</div>}
      <div className="grid gap-5 xl:grid-cols-[1fr_430px]">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-12 h-13 text-base" placeholder="Search by company, size, SKU, refill/package" />
            </div>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((item) => {
              const out = Number(item.full_stock || 0) <= 0;
              return (
                <button key={item.id} onClick={() => addToCart(item)} disabled={out} className={classNames('text-left rounded-3xl border bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-soft-lg disabled:cursor-not-allowed', out ? 'border-rose-200 bg-rose-50/80' : 'border-white hover:border-amber-200')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500 to-red-500 grid place-items-center text-white"><Flame className="h-6 w-6" /></div>
                    <Badge color={out ? 'red' : item.item_type === 'package' ? 'blue' : 'green'}>{out ? 'StockOut' : item.item_type}</Badge>
                  </div>
                  <h3 className="mt-3 font-black text-slate-950">{item.company}</h3>
                  <p className="text-sm font-bold text-slate-600">{item.cylinder_size} · {item.sku || 'No SKU'}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <Mini label="Full" value={String(item.full_stock)} danger={out} />
                    <Mini label="Empty" value={String(item.empty_stock)} />
                    <Mini label="Price" value={formatMoney(item.price, currency)} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <Card className="overflow-hidden h-max">
          <div className="border-b border-slate-100 p-4 bg-slate-950 text-white">
            <div className="flex items-center justify-between"><div><h2 className="font-black text-lg">Cart & payment</h2><p className="text-xs text-slate-300">{cart.length} selected LPG item(s)</p></div><ShoppingCart className="h-6 w-6 text-amber-300" /></div>
          </div>
          <div className="p-4 space-y-4">
            {cart.length === 0 ? <EmptyState icon={ShoppingCart} title="Cart is empty" description="Click a cylinder from the left to add it." /> : <div className="space-y-3 max-h-[46vh] overflow-y-auto pr-1">
              {cart.map((line) => (
                <div key={line.cylinder.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="font-black text-slate-950">{line.cylinder.company}</p><p className="text-xs font-bold text-slate-500">{line.cylinder.cylinder_size} · {line.cylinder.item_type}</p></div>
                    <button onClick={() => removeLine(line.cylinder.id)} className="rounded-xl p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => changeQty(line.cylinder.id, -1)}><Minus className="h-3 w-3" /></Button>
                    <div className="text-center rounded-xl bg-white py-2 text-sm font-black">Sold: {line.quantity}</div>
                    <Button size="sm" variant="secondary" onClick={() => changeQty(line.cylinder.id, 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <div className="mt-3 rounded-2xl bg-white p-3 space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Empty cylinder received against this sale</p>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={line.empty_return_company} onChange={(e) => updateLine(line.cylinder.id, { empty_return_company: e.target.value })} className="input text-xs">
                        {EMPTY_COMPANIES.map((x) => <option key={x}>{x}</option>)}
                      </select>
                      <select value={line.empty_return_size} onChange={(e) => updateLine(line.cylinder.id, { empty_return_size: e.target.value })} className="input text-xs">
                        {EMPTY_SIZES.map((x) => <option key={x}>{x}</option>)}
                      </select>
                    </div>
                    <input type="number" min="0" max={line.quantity} value={line.empty_return_quantity} onChange={(e) => updateLine(line.cylinder.id, { empty_return_quantity: Math.min(Number(e.target.value || 0), line.quantity) })} className="input" placeholder="Empty quantity received" />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm"><span className="text-slate-500">Line total</span><b>{formatMoney(line.quantity * line.cylinder.price, currency)}</b></div>
                </div>
              ))}
            </div>}

            <div className="grid grid-cols-3 gap-2">
              <PayButton active={payment === 'cash'} onClick={() => setPayment('cash')} icon={Banknote} label="Cash" />
              <PayButton active={payment === 'card'} onClick={() => setPayment('card')} icon={CreditCard} label="Card" />
              <PayButton active={payment === 'bkash'} onClick={() => setPayment('bkash')} icon={Wallet} label="bKash" />
              <PayButton active={payment === 'nagad'} onClick={() => setPayment('nagad')} icon={Wallet} label="Nagad" />
              <PayButton active={payment === 'bangla_qr'} onClick={() => setPayment('bangla_qr')} icon={Receipt} label="Bangla QR" />
              <PayButton active={payment === 'other'} onClick={() => setPayment('other')} icon={Wallet} label="Other" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input" placeholder="Customer name" />
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="input" placeholder="Phone" />
            </div>
            <input value={discount} onChange={(e) => setDiscount(e.target.value)} className="input" type="number" min="0" placeholder="Discount amount" />
            <textarea value={note} onChange={(e) => setNote(e.target.value)} className="input min-h-[70px]" placeholder="Sale note (optional)" />
            <div className="rounded-3xl bg-slate-950 p-4 text-white space-y-2">
              <div className="flex justify-between text-sm text-slate-300"><span>Subtotal</span><span>{formatMoney(subtotal, currency)}</span></div>
              <div className="flex justify-between text-sm text-slate-300"><span>Discount</span><span>{formatMoney(discountValue, currency)}</span></div>
              <div className="flex justify-between border-t border-white/10 pt-3 text-xl font-black"><span>Total</span><span>{formatMoney(total, currency)}</span></div>
            </div>
            <Button size="lg" onClick={completeSale} disabled={submitting || !cart.length} className="w-full">{submitting ? 'Completing…' : 'Complete sale & receipt'}</Button>
          </div>
        </Card>
      </div>

      <Modal open={!!completed} onClose={() => setCompleted(null)} title="LPG sale receipt" size="lg">
        {completed && <div className="p-5 space-y-4">
          <div className="rounded-3xl border border-slate-200 p-5 bg-white">
            <div className="text-center"><h2 className="text-xl font-black text-slate-950">{business?.business_name}</h2><p className="text-sm text-slate-500">{business?.address}</p><p className="text-sm text-slate-500">{business?.phone}</p><Badge color="amber">LPG sale receipt</Badge></div>
            <div className="my-4 border-t border-dashed border-slate-300" />
            <div className="grid grid-cols-2 gap-2 text-sm"><Info label="Invoice" value={`#${completed.sale.id.slice(-8).toUpperCase()}`} /><Info label="Date" value={formatDate(completed.sale.created_at)} /><Info label="Payment" value={completed.sale.payment_method} /><Info label="Customer" value={completed.sale.customer_name || 'Walk-in'} /></div>
            <div className="my-4 border-t border-dashed border-slate-300" />
            <div className="space-y-3">{completed.lpg_items.map((line) => <div key={line.id} className="rounded-2xl bg-slate-50 p-3"><div className="flex justify-between gap-3"><b>{line.sold_company} {line.sold_size} {line.sold_item_type}</b><b>{formatMoney(line.line_total, currency)}</b></div><p className="text-sm text-slate-500">Sold {line.sold_quantity} x {formatMoney(line.unit_price, currency)}</p><p className="text-sm text-amber-700 font-bold">Empty received: {line.empty_return_quantity} · {line.empty_return_company} {line.empty_return_size}</p></div>)}</div>
            <div className="my-4 border-t border-dashed border-slate-300" />
            <Info label="Subtotal" value={formatMoney(completed.sale.subtotal, currency)} /><Info label="Discount" value={formatMoney(completed.sale.discount, currency)} /><div className="mt-3 flex justify-between text-xl font-black"><span>Total</span><span>{formatMoney(completed.sale.total, currency)}</span></div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setCompleted(null)}>Close</Button><Button onClick={printReceipt}><Printer className="h-4 w-4" /> Print receipt</Button></div>
        </div>}
      </Modal>
    </PageContainer>
  );
}

function PayButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Banknote; label: string }) {
  return <button onClick={onClick} className={classNames('rounded-2xl border px-2 py-3 text-xs font-black transition-all', active ? 'border-amber-300 bg-amber-50 text-amber-800 ring-2 ring-amber-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}><Icon className="h-4 w-4 mx-auto mb-1" />{label}</button>;
}
function Mini({ label, value, danger }: { label: string; value: string; danger?: boolean }) { return <div className={classNames('rounded-2xl px-2 py-2', danger ? 'bg-rose-100 text-rose-700' : 'bg-slate-50')}><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><p className="font-black text-slate-900 text-xs">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4 text-sm"><span className="text-slate-500">{label}</span><b className="text-slate-900 text-right">{value}</b></div>; }
function escapeHtml(v: string) { return String(v).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c] || c)); }
