import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Banknote, CreditCard, Flame, Minus, Plus, Printer, Receipt, Search, ShoppingCart, Trash2, UserPlus, Wallet } from 'lucide-react';
import { apiRequest, supabase } from '../../lib/supabase';
import type { LpgCylinder, Sale, SaleItem, LpgCylinderSale, Customer } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { classNames, formatDate, formatMoney } from '../../lib/utils';
import { Badge, Button, Card, EmptyState, Modal, PageContainer, PageHeader, Spinner } from '../ui/Shared';

type PaymentMethod = 'cash' | 'card' | 'bkash' | 'nagad' | 'bangla_qr' | 'due' | 'other';

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
  const [customerAddress, setCustomerAddress] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('new');
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

  const loadCustomers = async () => {
    if (!business) return;
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('name', { ascending: true });
    setCustomers((data || []) as Customer[]);
  };

  useEffect(() => { load(); loadCustomers(); }, [business]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => [item.company, item.cylinder_size, item.item_type, item.sku].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [items, search]);

  const companyOptions = useMemo(() => {
    const names = new Set<string>(EMPTY_COMPANIES.filter((x) => x !== 'Other'));
    items.forEach((item) => item.company && names.add(item.company));
    cart.forEach((line) => line.empty_return_company && names.add(line.empty_return_company));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [items, cart]);

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

  const selectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    if (id === 'new') {
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      return;
    }
    const customer = customers.find((x) => x.id === id);
    if (customer) {
      setCustomerName(customer.name || '');
      setCustomerPhone(customer.phone || '');
      setCustomerAddress(customer.address || '');
    }
  };

  const completeSale = async () => {
    if (!cart.length) {
      setError('Cart is empty. Add at least one LPG cylinder.');
      return;
    }
    if (payment === 'due' && (!customerName.trim() || !customerPhone.trim())) {
      setError('For due sale, select a customer or add customer name and phone number.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        payment_method: payment,
        discount: discountValue,
        customer_id: selectedCustomerId !== 'new' ? selectedCustomerId : null,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        customer_address: customerAddress.trim() || null,
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
      setCustomerAddress('');
      setSelectedCustomerId('new');
      setPayment('cash');
      setNote('');
      await loadCustomers();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sale failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const printReceipt = () => {
    if (!completed || !business) return;
    const lines = completed.lpg_items || [];
    const invoice = `#${completed.sale.id.slice(-8).toUpperCase()}`;
    const paymentLabel = String(completed.sale.payment_method || '').replace('_', ' ').toUpperCase();
    const customerBlock = completed.sale.customer_name || completed.sale.customer_phone || completed.sale.customer_address
      ? `<section class="info-card"><h3>Customer information</h3>
          ${completed.sale.customer_name ? `<div class="row"><span>Name</span><b>${escapeHtml(completed.sale.customer_name)}</b></div>` : ''}
          ${completed.sale.customer_phone ? `<div class="row"><span>Phone</span><b>${escapeHtml(completed.sale.customer_phone)}</b></div>` : ''}
          ${completed.sale.customer_address ? `<div class="row"><span>Address</span><b>${escapeHtml(completed.sale.customer_address)}</b></div>` : ''}
        </section>`
      : '';

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LPG Receipt ${invoice}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #f1f5f9; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { width: 190mm; max-width: 100%; min-height: 270mm; margin: 16px auto; background: #ffffff; border-radius: 18px; padding: 18mm; box-shadow: 0 20px 50px rgba(15, 23, 42, .12); }
    .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; border-bottom: 3px solid #f59e0b; padding-bottom: 18px; }
    .brand { display: flex; gap: 14px; align-items: center; }
    .logo { height: 56px; width: 56px; border-radius: 18px; background: linear-gradient(135deg, #f59e0b, #dc2626); color: #fff; display: grid; place-items: center; font-size: 26px; font-weight: 900; }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 24px; line-height: 1.15; }
    .muted { color: #64748b; font-size: 12px; line-height: 1.5; }
    .badge { display: inline-block; border-radius: 999px; padding: 7px 12px; background: #fffbeb; color: #92400e; border: 1px solid #fde68a; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; }
    .invoice-box { text-align: right; min-width: 210px; }
    .invoice-box .no { font-size: 22px; font-weight: 900; margin-top: 8px; }
    .meta { margin-top: 18px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .meta-card, .info-card { border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px; background: #f8fafc; }
    .meta-card span, .row span { color: #64748b; font-size: 12px; }
    .meta-card b { display: block; margin-top: 5px; font-size: 13px; }
    .info-card { margin-top: 14px; background: #fff7ed; border-color: #fed7aa; }
    .info-card h3 { font-size: 13px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: .04em; color: #9a3412; }
    .row { display: flex; justify-content: space-between; gap: 18px; padding: 5px 0; }
    .row b { text-align: right; }
    table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 12px; }
    thead th { background: #111827; color: #fff; padding: 10px 8px; text-align: left; }
    tbody td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    tbody tr { break-inside: avoid; page-break-inside: avoid; }
    .right { text-align: right; }
    .empty-return { color: #b45309; font-weight: 700; font-size: 11px; margin-top: 4px; }
    .totals { margin-left: auto; margin-top: 18px; width: 330px; border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px; background: #f8fafc; }
    .totals .row { border-bottom: 1px dashed #cbd5e1; }
    .totals .row:last-child { border-bottom: 0; }
    .grand { margin-top: 8px; padding-top: 10px; border-top: 2px solid #111827 !important; font-size: 19px; font-weight: 900; color: #111827; }
    .due { color: #dc2626; }
    .footer { margin-top: 22px; border-top: 1px dashed #cbd5e1; padding-top: 14px; text-align: center; color: #64748b; font-size: 12px; }
    .actions { width: 190mm; max-width: 100%; margin: 0 auto 16px; display: flex; justify-content: flex-end; gap: 8px; }
    button { border: 0; border-radius: 12px; padding: 10px 14px; font-weight: 800; cursor: pointer; }
    .print { background: #111827; color: white; }
    .close { background: #e2e8f0; color: #0f172a; }
    @media print {
      html, body { background: #fff; }
      .actions { display: none !important; }
      .sheet { width: auto; min-height: auto; margin: 0; padding: 0; border-radius: 0; box-shadow: none; }
      .top, .meta-card, .info-card, .totals, table { break-inside: avoid; page-break-inside: avoid; }
    }
    @media (max-width: 760px) {
      .sheet { padding: 18px; margin: 0; border-radius: 0; }
      .top { flex-direction: column; }
      .invoice-box { text-align: left; }
      .meta { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .totals { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="actions"><button class="close" onclick="window.close()">Close</button><button class="print" onclick="window.print()">Print receipt</button></div>
  <main class="sheet">
    <section class="top">
      <div class="brand">
        <div class="logo">LPG</div>
        <div>
          <h1>${escapeHtml(business.business_name || 'LPG Cylinder Shop')}</h1>
          <p class="muted">${escapeHtml(business.address || '')}</p>
          <p class="muted">Phone: ${escapeHtml(business.phone || '-')}</p>
        </div>
      </div>
      <div class="invoice-box">
        <span class="badge">LPG sale receipt</span>
        <div class="no">${invoice}</div>
      </div>
    </section>

    <section class="meta">
      <div class="meta-card"><span>Date & time</span><b>${formatDate(completed.sale.created_at)}</b></div>
      <div class="meta-card"><span>Payment</span><b>${paymentLabel}</b></div>
      <div class="meta-card"><span>Status</span><b>${escapeHtml(completed.sale.status || 'completed')}</b></div>
      <div class="meta-card"><span>Items</span><b>${lines.length}</b></div>
    </section>

    ${customerBlock}

    <table>
      <thead><tr><th>#</th><th>Sold cylinder</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead>
      <tbody>
        ${lines.map((x, i) => `<tr>
          <td>${i + 1}</td>
          <td><b>${escapeHtml(x.sold_company)} ${escapeHtml(x.sold_size)} ${escapeHtml(x.sold_item_type)}</b><div class="empty-return">Empty received: ${Number(x.empty_return_quantity || 0)} · ${escapeHtml(x.empty_return_company || '-')} ${escapeHtml(x.empty_return_size || '')}</div></td>
          <td class="right">${Number(x.sold_quantity || 0)}</td>
          <td class="right">${formatMoney(Number(x.unit_price || 0), currency)}</td>
          <td class="right"><b>${formatMoney(Number(x.line_total || 0), currency)}</b></td>
        </tr>`).join('')}
      </tbody>
    </table>

    <section class="totals">
      <div class="row"><span>Subtotal</span><b>${formatMoney(Number(completed.sale.subtotal || 0), currency)}</b></div>
      <div class="row"><span>Discount</span><b>${formatMoney(Number(completed.sale.discount || 0), currency)}</b></div>
      <div class="row"><span>Paid</span><b>${formatMoney(Number(completed.sale.paid_amount || 0), currency)}</b></div>
      <div class="row"><span>Due</span><b class="due">${formatMoney(Number(completed.sale.due_amount || 0), currency)}</b></div>
      <div class="row grand"><span>Total</span><b>${formatMoney(Number(completed.sale.total || 0), currency)}</b></div>
    </section>

    <section class="footer">
      <p>${escapeHtml(business.receipt_message || 'Thank you. Please check cylinder seal and weight before leaving.')}</p>
      <p>Generated by CounterPOS LPG</p>
    </section>
  </main>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.focus(); window.print(); }, 650);
    });
  </script>
</body>
</html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  if (loading) return <PageContainer><Spinner label="Loading LPG POS…" /></PageContainer>;

  return (
    <PageContainer className="max-w-[1600px]">
      <PageHeader title="LPG Cylinder POS" subtitle="Sell full/refill cylinders and record which empty cylinder returned to the shop against every sale." />
      {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 flex gap-2"><AlertCircle className="h-4 w-4 mt-0.5" />{error}</div>}
      <datalist id="lpg-empty-company-options">{companyOptions.map((x) => <option key={x} value={x} />)}</datalist>
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
                      <input
                        value={line.empty_return_company}
                        onChange={(e) => updateLine(line.cylinder.id, { empty_return_company: e.target.value })}
                        className="input text-xs"
                        list="lpg-empty-company-options"
                        placeholder="Empty brand/company"
                      />
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
              <PayButton active={payment === 'due'} onClick={() => setPayment('due')} icon={UserPlus} label="Due" />
              <PayButton active={payment === 'other'} onClick={() => setPayment('other')} icon={Wallet} label="Other" />
            </div>
            {payment === 'due' ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-3 space-y-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-amber-700">Due customer required</p>
                  <p className="text-xs text-amber-700/80">Select an existing customer or add a new customer with name, phone and address.</p>
                </div>
                <select value={selectedCustomerId} onChange={(e) => selectCustomer(e.target.value)} className="input">
                  <option value="new">+ Add new due customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone || 'No phone'} · Due {formatMoney(Number(customer.due_balance || 0), currency)}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input" placeholder="Customer name *" />
                  <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="input" placeholder="Phone number *" />
                </div>
                <input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} className="input" placeholder="Customer address" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input" placeholder="Customer name optional" />
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="input" placeholder="Phone optional" />
              </div>
            )}
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

      {completed && (
        <div className="fixed inset-0 z-[9999] h-[100dvh] w-screen overflow-y-scroll overscroll-y-contain bg-slate-100 px-3 py-4 pb-20 sm:px-6 sm:py-8" style={{ height: '100dvh', overflowY: 'scroll', touchAction: 'pan-y' }}>
          <div className="mx-auto w-full max-w-5xl">
            <div className="w-full rounded-3xl bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6 rounded-t-3xl">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">Completed sale</p>
                  <h2 className="text-xl font-black text-slate-950">LPG sale receipt</h2>
                  <p className="text-sm text-slate-500">Review the full receipt, then print when ready.</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="secondary" onClick={() => setCompleted(null)}>Close</Button>
                  <Button onClick={printReceipt}><Printer className="h-4 w-4" /> Print receipt</Button>
                </div>
              </div>

              <div className="p-4 pb-16 sm:p-6 sm:pb-20 lg:p-8 lg:pb-24">
                <div className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft sm:p-7">
                  <div className="flex flex-col gap-4 border-b-4 border-amber-400 pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-amber-500 to-red-500 text-lg font-black text-white shadow-lg shadow-amber-500/20">LPG</div>
                      <div>
                        <h2 className="text-2xl font-black text-slate-950">{business?.business_name || 'LPG Cylinder Shop'}</h2>
                        <p className="mt-1 text-sm text-slate-500">{business?.address || 'Business address'}</p>
                        <p className="text-sm text-slate-500">Phone: {business?.phone || '-'}</p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <Badge color="amber">LPG sale receipt</Badge>
                      <p className="mt-2 text-2xl font-black text-slate-950">#{completed.sale.id.slice(-8).toUpperCase()}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <ReceiptInfoBox label="Date & time" value={formatDate(completed.sale.created_at)} />
                    <ReceiptInfoBox label="Payment" value={String(completed.sale.payment_method || '').replace('_', ' ')} />
                    <ReceiptInfoBox label="Status" value={completed.sale.status || 'completed'} />
                    <ReceiptInfoBox label="Items" value={String(completed.lpg_items.length)} />
                  </div>

                  {(completed.sale.customer_name || completed.sale.customer_phone || completed.sale.customer_address) && (
                    <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50/70 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-amber-700">Customer information</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {completed.sale.customer_name && <Info label="Name" value={completed.sale.customer_name} />}
                        {completed.sale.customer_phone && <Info label="Phone" value={completed.sale.customer_phone} />}
                        {completed.sale.customer_address && <Info label="Address" value={completed.sale.customer_address} />}
                      </div>
                    </div>
                  )}

                  <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-200">
                    <table className="min-w-[760px] w-full text-sm">
                      <thead className="bg-slate-950 text-white">
                        <tr>
                          <th className="px-4 py-3 text-left">#</th>
                          <th className="px-4 py-3 text-left">Sold cylinder</th>
                          <th className="px-4 py-3 text-right">Qty</th>
                          <th className="px-4 py-3 text-right">Rate</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {completed.lpg_items.map((line, index) => (
                          <tr key={line.id}>
                            <td className="px-4 py-4 font-bold text-slate-500">{index + 1}</td>
                            <td className="px-4 py-4">
                              <p className="font-black text-slate-950">{line.sold_company} {line.sold_size} {line.sold_item_type}</p>
                              <p className="mt-1 text-xs font-bold text-amber-700">Empty received: {line.empty_return_quantity} · {line.empty_return_company || '-'} {line.empty_return_size || ''}</p>
                            </td>
                            <td className="px-4 py-4 text-right font-bold">{line.sold_quantity}</td>
                            <td className="px-4 py-4 text-right">{formatMoney(line.unit_price, currency)}</td>
                            <td className="px-4 py-4 text-right font-black">{formatMoney(line.line_total, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <Info label="Subtotal" value={formatMoney(completed.sale.subtotal, currency)} />
                      <Info label="Discount" value={formatMoney(completed.sale.discount, currency)} />
                      <Info label="Paid" value={formatMoney(Number(completed.sale.paid_amount || 0), currency)} />
                      <Info label="Due" value={formatMoney(Number(completed.sale.due_amount || 0), currency)} />
                      <div className="mt-4 flex justify-between border-t-2 border-slate-900 pt-4 text-2xl font-black text-slate-950">
                        <span>Total</span>
                        <span>{formatMoney(completed.sale.total, currency)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-dashed border-slate-300 pt-4 text-center text-sm text-slate-500">
                    <p>{business?.receipt_message || 'Thank you. Please check cylinder seal and weight before leaving.'}</p>
                    <p className="mt-1 font-bold">Generated by CounterPOS LPG</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function PayButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Banknote; label: string }) {
  return <button onClick={onClick} className={classNames('rounded-2xl border px-2 py-3 text-xs font-black transition-all', active ? 'border-amber-300 bg-amber-50 text-amber-800 ring-2 ring-amber-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}><Icon className="h-4 w-4 mx-auto mb-1" />{label}</button>;
}
function Mini({ label, value, danger }: { label: string; value: string; danger?: boolean }) { return <div className={classNames('rounded-2xl px-2 py-2', danger ? 'bg-rose-100 text-rose-700' : 'bg-slate-50')}><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><p className="font-black text-slate-900 text-xs">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4 text-sm py-1"><span className="text-slate-500">{label}</span><b className="text-slate-900 text-right">{value}</b></div>; }
function ReceiptInfoBox({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-black capitalize text-slate-950">{value}</p></div>; }
function escapeHtml(v: string) { return String(v).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c] || c)); }
