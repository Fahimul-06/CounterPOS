import { FormEvent, useEffect, useMemo, useState } from 'react';
import { FileText, RefreshCcw, RotateCcw, Save, UserPlus, Users, WalletCards } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatMoney, formatShortDate } from '../../lib/utils';
import { PageContainer, PageHeader, Card, Button, Spinner, Badge } from '../ui/Shared';
import ImageDropzone from '../ui/ImageDropzone';

export default function PharmacyCustomers() {
  const { business } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [dues, setDues] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '', prescription_notes: '' });
  const [prescription, setPrescription] = useState({ customer_id: '', doctor_name: '', notes: '', image_url: '' });
  const [saleReturn, setSaleReturn] = useState({ sale_id: '', quantity: '', amount: '', reason: '' });

  const load = async () => {
    if (!business) return;
    setLoading(true);
    const [c, p, d, r, s] = await Promise.all([
      supabase.from('customers').select('*').eq('business_id', business.id).order('name', { ascending: true }),
      supabase.from('prescriptions').select('*').eq('business_id', business.id).order('created_at', { ascending: false }),
      supabase.from('customer_dues').select('*').eq('business_id', business.id).order('created_at', { ascending: false }),
      supabase.from('sales_returns').select('*').eq('business_id', business.id).order('created_at', { ascending: false }),
      supabase.from('sales').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(40),
    ]);
    setCustomers((c.data as any[]) || []); setPrescriptions((p.data as any[]) || []); setDues((d.data as any[]) || []); setReturns((r.data as any[]) || []); setSales((s.data as any[]) || []); setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [business]);

  const totalDue = useMemo(() => customers.reduce((sum, c) => sum + Number(c.due_balance || 0), 0), [customers]);
  const addCustomer = async (e: FormEvent) => { e.preventDefault(); if (!business) return; await supabase.from('customers').insert({ business_id: business.id, ...customer, due_balance: 0, is_active: true }); setCustomer({ name: '', phone: '', address: '', prescription_notes: '' }); load(); };
  const addPrescription = async (e: FormEvent) => { e.preventDefault(); if (!business) return; await supabase.from('prescriptions').insert({ business_id: business.id, ...prescription }); setPrescription({ customer_id: '', doctor_name: '', notes: '', image_url: '' }); load(); };
  const addReturn = async (e: FormEvent) => { e.preventDefault(); if (!business) return; await supabase.from('sales_returns').insert({ business_id: business.id, ...saleReturn, quantity: Number(saleReturn.quantity || 0), amount: Number(saleReturn.amount || 0) }); setSaleReturn({ sale_id: '', quantity: '', amount: '', reason: '' }); load(); };

  if (loading) return <Spinner label="Loading customers…" />;

  return <PageContainer className="max-w-8xl"><PageHeader title="Customer, Prescription & Due Management" subtitle="Customer profiles, prescriptions, customer dues, due payments and sales returns." action={<Button onClick={load}><RefreshCcw className="h-4 w-4" /> Refresh</Button>} />
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5"><Summary label="Customers" value={customers.length} icon={<Users />} /><Summary label="Prescriptions" value={prescriptions.length} icon={<FileText />} /><Summary label="Customer due" value={formatMoney(totalDue, business?.currency || 'BDT')} icon={<WalletCards />} /><Summary label="Sales returns" value={returns.length} icon={<RotateCcw />} /></div>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5"><Card className="p-5"><h3 className="font-bold mb-3 flex items-center gap-2"><UserPlus className="h-5 w-5 text-emerald-600" /> Add customer</h3><form onSubmit={addCustomer} className="space-y-3"><Input label="Name" value={customer.name} onChange={(v) => setCustomer({ ...customer, name: v })} required /><Input label="Phone" value={customer.phone} onChange={(v) => setCustomer({ ...customer, phone: v })} /><Input label="Address" value={customer.address} onChange={(v) => setCustomer({ ...customer, address: v })} /><Text label="Prescription notes" value={customer.prescription_notes} onChange={(v) => setCustomer({ ...customer, prescription_notes: v })} /><Button type="submit" className="w-full"><Save className="h-4 w-4" /> Save customer</Button></form></Card>
      <Card className="p-5"><h3 className="font-bold mb-3">Save prescription</h3><form onSubmit={addPrescription} className="space-y-3"><Select label="Customer" value={prescription.customer_id} options={customers.map((c) => ({ value: c.id, label: `${c.name} · ${c.phone || ''}` }))} onChange={(v) => setPrescription({ ...prescription, customer_id: v })} /><Input label="Doctor name" value={prescription.doctor_name} onChange={(v) => setPrescription({ ...prescription, doctor_name: v })} /><ImageDropzone value={prescription.image_url} onChange={(v) => setPrescription({ ...prescription, image_url: v || '' })} label="Prescription photo" accent="rose" /><Text label="Notes" value={prescription.notes} onChange={(v) => setPrescription({ ...prescription, notes: v })} /><Button type="submit" className="w-full">Save prescription</Button></form></Card>
      <Card className="p-5"><h3 className="font-bold mb-3">Sales return</h3><form onSubmit={addReturn} className="space-y-3"><Select label="Invoice" value={saleReturn.sale_id} options={sales.map((s) => ({ value: s.id, label: `${s.id.slice(-8).toUpperCase()} · ${formatMoney(s.total, business?.currency || 'BDT')}` }))} onChange={(v) => setSaleReturn({ ...saleReturn, sale_id: v })} /><Input label="Quantity" type="number" value={saleReturn.quantity} onChange={(v) => setSaleReturn({ ...saleReturn, quantity: v })} /><Input label="Amount" type="number" value={saleReturn.amount} onChange={(v) => setSaleReturn({ ...saleReturn, amount: v })} /><Text label="Reason" value={saleReturn.reason} onChange={(v) => setSaleReturn({ ...saleReturn, reason: v })} /><Button type="submit" className="w-full">Record return</Button></form></Card></div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5"><TableCard title="Customers" rows={customers} cols={['name','phone','address','due_balance','prescription_notes']} moneyCol="due_balance" currency={business?.currency || 'BDT'} /><TableCard title="Customer dues" rows={dues} cols={['amount','paid','balance','status','due_date']} moneyCols={['amount','paid','balance']} currency={business?.currency || 'BDT'} /><TableCard title="Prescriptions" rows={prescriptions} cols={['prescription_date','doctor_name','notes','image_url']} /><TableCard title="Sales returns" rows={returns} cols={['return_date','quantity','amount','reason']} moneyCol="amount" currency={business?.currency || 'BDT'} /></div>
  </PageContainer>;
}
function Summary({ label, value, icon }: any) { return <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs uppercase font-bold text-slate-500">{label}</p><p className="text-2xl font-extrabold text-slate-900">{value}</p></div><div className="h-11 w-11 rounded-2xl bg-teal-50 text-teal-700 grid place-items-center [&>svg]:h-5 [&>svg]:w-5">{icon}</div></div></Card>; }
function Input({ label, value, onChange, type='text', required }: any) { return <label className="block"><span className="text-xs font-bold text-slate-600">{label}</span><input required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" /></label>; }
function Text({ label, value, onChange }: any) { return <label className="block"><span className="text-xs font-bold text-slate-600">{label}</span><textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" /></label>; }
function Select({ label, value, onChange, options }: any) { return <label className="block"><span className="text-xs font-bold text-slate-600">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">Select</option>{options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>; }
function TableCard({ title, rows, cols, moneyCol, moneyCols = [], currency = 'BDT' }: any) { const moneySet = new Set([moneyCol, ...moneyCols].filter(Boolean)); return <Card className="p-5"><h3 className="font-bold mb-3">{title}</h3><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b">{cols.map((c: string) => <th key={c} className="py-2">{c.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{rows.map((r: any) => <tr key={r.id} className="border-b border-slate-100">{cols.map((c: string) => <td key={c} className="py-2 max-w-52 truncate">{c.includes('date') && r[c] ? formatShortDate(r[c]) : moneySet.has(c) ? formatMoney(Number(r[c] || 0), currency) : c === 'status' ? <Badge color={r[c] === 'paid' ? 'green' : 'amber'}>{r[c]}</Badge> : String(r[c] ?? '-')}</td>)}</tr>)}{rows.length === 0 && <tr><td colSpan={cols.length} className="py-8 text-center text-slate-500">No records yet.</td></tr>}</tbody></table></div></Card>; }
