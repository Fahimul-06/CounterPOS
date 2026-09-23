import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarClock, DollarSign, PackageCheck, RefreshCcw, RotateCcw, Truck, WalletCards } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest, supabase } from '../../lib/supabase';
import { formatMoney, formatShortDate } from '../../lib/utils';
import { PageContainer, PageHeader, Card, Button, Spinner, Badge } from '../ui/Shared';
import { ExpiryBadge, daysUntil } from './pharmacyHelpers';

export default function PharmacyReports() {
  const { business } = useAuth();
  const [data, setData] = useState<Record<string, any[]>>({});
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const currency = business?.currency || 'BDT';
  const load = async () => {
    if (!business) return;
    setLoading(true);
    const [dash, sales, purchases, batches, expenses, dues, supplierDue, returns, stock] = await Promise.all([
      apiRequest<{ data: any }>('/pharmacy/dashboard').catch(() => ({ data: {} })),
      supabase.from('sales').select('*').eq('business_id', business.id).order('created_at', { ascending: false }),
      supabase.from('purchases').select('*').eq('business_id', business.id).order('created_at', { ascending: false }),
      supabase.from('medicine_batches').select('*').eq('business_id', business.id).order('expiry_date', { ascending: true }),
      supabase.from('expenses').select('*').eq('business_id', business.id).order('created_at', { ascending: false }),
      supabase.from('customer_dues').select('*').eq('business_id', business.id).order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').eq('business_id', business.id).order('name', { ascending: true }),
      supabase.from('sales_returns').select('*').eq('business_id', business.id).order('created_at', { ascending: false }),
      supabase.from('stock_movements').select('*').eq('business_id', business.id).order('created_at', { ascending: false }),
    ]);
    setSummary(dash.data || {});
    setData({ sales: sales.data as any[] || [], purchases: purchases.data as any[] || [], batches: batches.data as any[] || [], expenses: expenses.data as any[] || [], dues: dues.data as any[] || [], suppliers: supplierDue.data as any[] || [], returns: returns.data as any[] || [], stock: stock.data as any[] || [] });
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [business]);
  const totals = useMemo(() => ({ returns: (data.returns || []).reduce((s, x) => s + Number(x.amount || 0), 0), expenses: (data.expenses || []).reduce((s, x) => s + Number(x.amount || 0), 0), customerDue: (data.dues || []).reduce((s, x) => s + Number(x.balance || 0), 0), supplierDue: (data.suppliers || []).reduce((s, x) => s + Number(x.balance_due || 0), 0) }), [data]);
  if (loading) return <Spinner label="Building reports…" />;
  return <PageContainer className="max-w-8xl"><PageHeader title="Pharmacy Reports" subtitle="Sales, profit, purchases, inventory, expiry, stock valuation, returns, expenses and dues." action={<Button onClick={load}><RefreshCcw className="h-4 w-4" />Refresh</Button>} />
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5"><ReportCard title="Sales report" value={formatMoney(summary.monthly_sales || 0, currency)} icon={<BarChart3 />} sub="This month" /><ReportCard title="Profit report" value={formatMoney(summary.estimated_profit || 0, currency)} icon={<DollarSign />} sub="Estimated" /><ReportCard title="Purchase report" value={formatMoney(summary.monthly_purchases || 0, currency)} icon={<Truck />} sub="This month" /><ReportCard title="Inventory valuation" value={formatMoney(summary.stock_valuation || 0, currency)} icon={<PackageCheck />} sub="Batch cost basis" /><ReportCard title="Expiry report" value={`${summary.expired || 0} expired`} icon={<CalendarClock />} sub={`${summary.near_30 || 0} within 30 days`} /><ReportCard title="Return report" value={formatMoney(totals.returns, currency)} icon={<RotateCcw />} sub={`${(data.returns || []).length} returns`} /><ReportCard title="Expense report" value={formatMoney(totals.expenses, currency)} icon={<WalletCards />} sub={`${(data.expenses || []).length} expenses`} /><ReportCard title="Dues report" value={formatMoney(totals.customerDue + totals.supplierDue, currency)} icon={<WalletCards />} sub="Customer + supplier" /></div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5"><Table title="Sales" rows={data.sales || []} cols={['created_at','customer_name','payment_method','status','total']} currency={currency} moneyCols={['total']} /><Table title="Purchases" rows={data.purchases || []} cols={['purchase_date','invoice_no','total','paid','due','status']} currency={currency} moneyCols={['total','paid','due']} /><ExpiryTable rows={data.batches || []} /><Table title="Stock movement ledger" rows={data.stock || []} cols={['created_at','type','quantity_in','quantity_out','balance_after','reference']} /><Table title="Expenses" rows={data.expenses || []} cols={['expense_date','title','category','payment_method','amount']} currency={currency} moneyCols={['amount']} /><Table title="Customer dues" rows={data.dues || []} cols={['amount','paid','balance','status','due_date']} currency={currency} moneyCols={['amount','paid','balance']} /></div>
  </PageContainer>;
}
function ReportCard({ title, value, icon, sub }: any) { return <Card className="p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase font-bold text-slate-500">{title}</p><p className="text-xl font-extrabold text-slate-900 mt-1">{value}</p><p className="text-xs text-slate-500 mt-1">{sub}</p></div><div className="h-11 w-11 rounded-2xl bg-emerald-50 text-emerald-700 grid place-items-center [&>svg]:h-5 [&>svg]:w-5">{icon}</div></div></Card>; }
function Table({ title, rows, cols, currency = 'BDT', moneyCols = [] }: any) { const money = new Set(moneyCols); return <Card className="p-5"><h3 className="font-bold mb-3">{title}</h3><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b">{cols.map((c: string) => <th key={c} className="py-2">{c.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{rows.slice(0, 15).map((r: any) => <tr key={r.id} className="border-b border-slate-100">{cols.map((c: string) => <td key={c} className="py-2">{c.includes('date') || c === 'created_at' ? (r[c] ? formatShortDate(r[c]) : '-') : money.has(c) ? formatMoney(Number(r[c] || 0), currency) : c === 'status' ? <Badge color={r[c] === 'completed' || r[c] === 'received' || r[c] === 'paid' ? 'green' : 'amber'}>{r[c]}</Badge> : String(r[c] ?? '-')}</td>)}</tr>)}{rows.length === 0 && <tr><td colSpan={cols.length} className="py-8 text-center text-slate-500">No data.</td></tr>}</tbody></table></div></Card>; }
function ExpiryTable({ rows }: any) { return <Card className="p-5"><h3 className="font-bold mb-3">Expiry report</h3><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b"><th className="py-2">Batch</th><th>Expiry</th><th>Days</th><th>Qty</th><th>Alert</th></tr></thead><tbody>{rows.slice(0, 20).map((r: any) => <tr key={r.id} className="border-b border-slate-100"><td className="py-2 font-bold">{r.batch_number}</td><td>{formatShortDate(r.expiry_date)}</td><td>{daysUntil(r.expiry_date)}</td><td>{r.available_quantity}</td><td><ExpiryBadge expiry={r.expiry_date} /></td></tr>)}</tbody></table></div></Card>; }
