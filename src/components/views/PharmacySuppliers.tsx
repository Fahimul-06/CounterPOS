import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCcw, RotateCcw, Save, Truck, WalletCards } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatMoney, formatShortDate } from '../../lib/utils';
import { PageContainer, PageHeader, Card, Button, Spinner, Badge } from '../ui/Shared';

export default function PharmacySuppliers() {
  const { business } = useAuth();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState({ name: '', phone: '', address: '' });
  const [purchase, setPurchase] = useState({ supplier_id: '', invoice_no: '', total: '', paid: '', note: '' });
  const [payment, setPayment] = useState({ supplier_id: '', amount: '', payment_method: 'cash', note: '' });

  const load = async () => {
    if (!business) return;
    setLoading(true);
    const [s, p, pay, r] = await Promise.all([
      supabase.from('suppliers').select('*').eq('business_id', business.id).order('name', { ascending: true }),
      supabase.from('purchases').select('*').eq('business_id', business.id).order('created_at', { ascending: false }),
      supabase.from('supplier_payments').select('*').eq('business_id', business.id).order('created_at', { ascending: false }),
      supabase.from('purchase_returns').select('*').eq('business_id', business.id).order('created_at', { ascending: false }),
    ]);
    setSuppliers((s.data as any[]) || []); setPurchases((p.data as any[]) || []); setPayments((pay.data as any[]) || []); setReturns((r.data as any[]) || []); setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [business]);

  const totalDue = useMemo(() => suppliers.reduce((sum, s) => sum + Number(s.balance_due || 0), 0), [suppliers]);

  const addSupplier = async (e: FormEvent) => { e.preventDefault(); if (!business) return; await supabase.from('suppliers').insert({ business_id: business.id, ...supplier, balance_due: 0, is_active: true }); setSupplier({ name: '', phone: '', address: '' }); load(); };
  const addPurchase = async (e: FormEvent) => { e.preventDefault(); if (!business) return; const total = Number(purchase.total || 0); const paid = Number(purchase.paid || 0); const due = Math.max(total - paid, 0); await supabase.from('purchases').insert({ business_id: business.id, ...purchase, total, paid, due, status: due > 0 ? 'partial' : 'received' }); if (purchase.supplier_id && due) await supabase.from('suppliers').update({ balance_due: Number(suppliers.find((s) => s.id === purchase.supplier_id)?.balance_due || 0) + due }).eq('id', purchase.supplier_id); setPurchase({ supplier_id: '', invoice_no: '', total: '', paid: '', note: '' }); load(); };
  const addPayment = async (e: FormEvent) => { e.preventDefault(); if (!business) return; const amount = Number(payment.amount || 0); await supabase.from('supplier_payments').insert({ business_id: business.id, ...payment, amount }); if (payment.supplier_id) await supabase.from('suppliers').update({ balance_due: Math.max(Number(suppliers.find((s) => s.id === payment.supplier_id)?.balance_due || 0) - amount, 0) }).eq('id', payment.supplier_id); setPayment({ supplier_id: '', amount: '', payment_method: 'cash', note: '' }); load(); };

  if (loading) return <Spinner label="Loading suppliers…" />;

  return <PageContainer className="max-w-8xl"><PageHeader title="Suppliers, Purchases & Returns" subtitle="Manage supplier profiles, purchase invoices, supplier payments and purchase returns." action={<Button onClick={load}><RefreshCcw className="h-4 w-4" /> Refresh</Button>} />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5"><Summary label="Suppliers" value={suppliers.length} icon={<Truck />} /><Summary label="Purchase invoices" value={purchases.length} icon={<Plus />} /><Summary label="Supplier due" value={formatMoney(totalDue, business?.currency || 'BDT')} icon={<WalletCards />} /></div>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5"><Card className="p-5"><h3 className="font-bold mb-3">Add supplier</h3><form onSubmit={addSupplier} className="space-y-3"><Input label="Supplier name" value={supplier.name} onChange={(v) => setSupplier({ ...supplier, name: v })} required /><Input label="Phone" value={supplier.phone} onChange={(v) => setSupplier({ ...supplier, phone: v })} /><Input label="Address" value={supplier.address} onChange={(v) => setSupplier({ ...supplier, address: v })} /><Button type="submit" className="w-full"><Save className="h-4 w-4" />Save supplier</Button></form></Card>
      <Card className="p-5"><h3 className="font-bold mb-3">Record purchase</h3><form onSubmit={addPurchase} className="space-y-3"><Select label="Supplier" value={purchase.supplier_id} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} onChange={(v) => setPurchase({ ...purchase, supplier_id: v })} /><Input label="Invoice no" value={purchase.invoice_no} onChange={(v) => setPurchase({ ...purchase, invoice_no: v })} /><Input label="Total" type="number" value={purchase.total} onChange={(v) => setPurchase({ ...purchase, total: v })} /><Input label="Paid" type="number" value={purchase.paid} onChange={(v) => setPurchase({ ...purchase, paid: v })} /><Input label="Note" value={purchase.note} onChange={(v) => setPurchase({ ...purchase, note: v })} /><Button type="submit" className="w-full">Save purchase</Button></form></Card>
      <Card className="p-5"><h3 className="font-bold mb-3">Supplier payment</h3><form onSubmit={addPayment} className="space-y-3"><Select label="Supplier" value={payment.supplier_id} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} onChange={(v) => setPayment({ ...payment, supplier_id: v })} /><Input label="Amount" type="number" value={payment.amount} onChange={(v) => setPayment({ ...payment, amount: v })} /><Select label="Method" value={payment.payment_method} options={['cash', 'card', 'bkash', 'nagad', 'bank']} onChange={(v) => setPayment({ ...payment, payment_method: v })} /><Input label="Note" value={payment.note} onChange={(v) => setPayment({ ...payment, note: v })} /><Button type="submit" className="w-full">Record payment</Button></form></Card></div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5"><TableCard title="Suppliers" rows={suppliers} cols={['name','phone','address','balance_due']} moneyCol="balance_due" currency={business?.currency || 'BDT'} /><TableCard title="Purchases" rows={purchases} cols={['invoice_no','purchase_date','total','paid','due','status']} moneyCols={['total','paid','due']} currency={business?.currency || 'BDT'} /><TableCard title="Supplier payments" rows={payments} cols={['payment_date','amount','payment_method','note']} moneyCol="amount" currency={business?.currency || 'BDT'} /><TableCard title="Purchase returns" rows={returns} cols={['return_date','quantity','amount','reason']} moneyCol="amount" currency={business?.currency || 'BDT'} emptyIcon={<RotateCcw />} /></div>
  </PageContainer>;
}
function Summary({ label, value, icon }: any) { return <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs uppercase font-bold text-slate-500">{label}</p><p className="text-2xl font-extrabold text-slate-900">{value}</p></div><div className="h-11 w-11 rounded-2xl bg-emerald-50 text-emerald-700 grid place-items-center [&>svg]:h-5 [&>svg]:w-5">{icon}</div></div></Card>; }
function Input({ label, value, onChange, type='text', required }: any) { return <label className="block"><span className="text-xs font-bold text-slate-600">{label}</span><input required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" /></label>; }
function Select({ label, value, onChange, options }: any) { return <label className="block"><span className="text-xs font-bold text-slate-600">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">Select</option>{options.map((o: any) => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>; }
function TableCard({ title, rows, cols, moneyCol, moneyCols = [], currency, emptyIcon }: any) { const moneySet = new Set([moneyCol, ...moneyCols].filter(Boolean)); return <Card className="p-5"><h3 className="font-bold mb-3">{title}</h3><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b">{cols.map((c: string) => <th key={c} className="py-2">{c.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{rows.map((r: any) => <tr key={r.id} className="border-b border-slate-100">{cols.map((c: string) => <td key={c} className="py-2">{c.includes('date') && r[c] ? formatShortDate(r[c]) : moneySet.has(c) ? formatMoney(Number(r[c] || 0), currency) : c === 'status' ? <Badge color={r[c] === 'received' ? 'green' : 'amber'}>{r[c]}</Badge> : String(r[c] ?? '-')}</td>)}</tr>)}{rows.length === 0 && <tr><td colSpan={cols.length} className="py-8 text-center text-slate-500">{emptyIcon} No records yet.</td></tr>}</tbody></table></div></Card>; }
