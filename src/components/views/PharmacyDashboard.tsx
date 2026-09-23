import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Boxes,
  CalendarClock,
  ClipboardList,
  PackageSearch,
  Pill,
  Receipt,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Expense, Medicine, MedicineBatch, Purchase, Sale, SaleWithItems } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { classNames, formatMoney, formatShortDate } from '../../lib/utils';
import { Badge, Button, Card, EmptyState, PageContainer, PageHeader, Spinner } from '../ui/Shared';
import type { View } from '../layout/AppLayout';

interface Props {
  onNavigate: (v: View) => void;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysUntil(iso?: string | null) {
  if (!iso) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(`${iso}T00:00:00`);
  return Math.round((exp.getTime() - today.getTime()) / 86400000);
}

export default function PharmacyDashboard({ onNavigate }: Props) {
  const { business } = useAuth();
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!business) return;
      setLoading(true);
      const [salesRes, medsRes, batchRes, purchaseRes, expenseRes] = await Promise.all([
        supabase.from('sales').select('*,sale_items(*)').eq('business_id', business.id).order('created_at', { ascending: false }).limit(300),
        supabase.from('medicines').select('*').eq('business_id', business.id).order('name', { ascending: true }),
        supabase.from('medicine_batches').select('*').eq('business_id', business.id).order('expiry_date', { ascending: true }),
        supabase.from('purchases').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(250),
        supabase.from('expenses').select('*').eq('business_id', business.id).order('expense_date', { ascending: false }).limit(250),
      ]);
      if (!mounted) return;
      setSales((salesRes.data ?? []) as SaleWithItems[]);
      setMedicines((medsRes.data ?? []) as Medicine[]);
      setBatches((batchRes.data ?? []) as MedicineBatch[]);
      setPurchases((purchaseRes.data ?? []) as Purchase[]);
      setExpenses((expenseRes.data ?? []) as Expense[]);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [business]);

  const currency = business?.currency ?? 'BDT';

  const medicineCost = useMemo(() => {
    const map = new Map<string, number>();
    medicines.forEach((m) => map.set(m.id, Number(m.purchase_price || m.cost || 0)));
    return map;
  }, [medicines]);

  const metrics = useMemo(() => {
    const today = startOfToday().getTime();
    const month = startOfMonth().getTime();
    const saleTotal = (rows: Sale[]) => rows.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const purchaseTotal = (rows: Purchase[]) => rows.reduce((sum, p) => sum + Number(p.total || 0), 0);
    const expenseTotal = (rows: Expense[]) => rows.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const todaySales = sales.filter((s) => new Date(s.created_at).getTime() >= today);
    const monthSales = sales.filter((s) => new Date(s.created_at).getTime() >= month);
    const todayPurchases = purchases.filter((p) => new Date(p.created_at || p.purchase_date || '').getTime() >= today);
    const monthPurchases = purchases.filter((p) => new Date(p.created_at || p.purchase_date || '').getTime() >= month);
    const todayExpenses = expenses.filter((e) => new Date(e.expense_date || e.created_at).getTime() >= today);
    const monthExpenses = expenses.filter((e) => new Date(e.expense_date || e.created_at).getTime() >= month);

    const grossProfit = monthSales.reduce((sum, sale) => {
      const cost = (sale.sale_items || []).reduce((acc, item) => acc + Number(item.quantity || 0) * Number(medicineCost.get(String(item.product_id)) || 0), 0);
      return sum + Number(sale.total || 0) - cost;
    }, 0);

    const lowStock = medicines.filter((m) => Number(m.pieces || 0) <= Number(m.low_stock_threshold || 10));
    const expired = batches.filter((b) => Number(b.quantity || 0) > 0 && daysUntil(b.expiry_date) < 0);
    const near30 = batches.filter((b) => Number(b.quantity || 0) > 0 && daysUntil(b.expiry_date) >= 0 && daysUntil(b.expiry_date) <= 30);
    const near90 = batches.filter((b) => Number(b.quantity || 0) > 0 && daysUntil(b.expiry_date) > 30 && daysUntil(b.expiry_date) <= 90);
    const near180 = batches.filter((b) => Number(b.quantity || 0) > 0 && daysUntil(b.expiry_date) > 90 && daysUntil(b.expiry_date) <= 180);
    const valuation = batches.reduce((sum, b) => sum + Number(b.quantity || 0) * Number(b.cost || b.purchase_price || 0), 0);

    return {
      todaySales: saleTotal(todaySales),
      monthSales: saleTotal(monthSales),
      todayPurchases: purchaseTotal(todayPurchases),
      monthPurchases: purchaseTotal(monthPurchases),
      todayExpenses: expenseTotal(todayExpenses),
      monthExpenses: expenseTotal(monthExpenses),
      monthProfit: grossProfit - expenseTotal(monthExpenses),
      lowStock,
      expired,
      near30,
      near90,
      near180,
      valuation,
    };
  }, [sales, purchases, expenses, medicines, batches, medicineCost]);

  if (loading) return <PageContainer><Spinner label="Loading pharmacy dashboard…" /></PageContainer>;

  return (
    <PageContainer>
      <PageHeader
        title="Pharmacy dashboard"
        subtitle="Sales, profit, purchases, low stock, expiry and inventory valuation for pharmacy accounts."
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onNavigate('pos')}><Receipt className="h-4 w-4" /> Fast POS</Button>
            <Button variant="secondary" onClick={() => onNavigate('medicines')}><Pill className="h-4 w-4" /> Pharmacy management</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Metric label="Today sales" value={formatMoney(metrics.todaySales, currency)} icon={TrendingUp} tint="bg-emerald-50 text-emerald-600" />
        <Metric label="Monthly sales" value={formatMoney(metrics.monthSales, currency)} icon={Receipt} tint="bg-blue-50 text-blue-600" />
        <Metric label="Monthly profit" value={formatMoney(metrics.monthProfit, currency)} icon={Banknote} tint="bg-violet-50 text-violet-600" />
        <Metric label="Inventory value" value={formatMoney(metrics.valuation, currency)} icon={Boxes} tint="bg-slate-100 text-slate-700" />
        <Metric label="Today purchases" value={formatMoney(metrics.todayPurchases, currency)} icon={ShoppingCart} tint="bg-amber-50 text-amber-600" />
        <Metric label="Monthly purchases" value={formatMoney(metrics.monthPurchases, currency)} icon={ClipboardList} tint="bg-orange-50 text-orange-600" />
        <Metric label="Today expenses" value={formatMoney(metrics.todayExpenses, currency)} icon={Banknote} tint="bg-rose-50 text-rose-600" />
        <Metric label="Monthly expenses" value={formatMoney(metrics.monthExpenses, currency)} icon={Banknote} tint="bg-rose-50 text-rose-600" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">Stock alerts</h2>
            <Badge color="amber">{metrics.lowStock.length} low stock</Badge>
          </div>
          {metrics.lowStock.length === 0 ? (
            <EmptyState icon={PackageSearch} title="No low-stock medicines" description="All medicines are above their alert threshold." />
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {metrics.lowStock.slice(0, 12).map((m) => (
                <div key={m.id} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{m.name}</p>
                    <p className="text-xs text-slate-500 truncate">Rack {m.rack_location || 'N/A'} · {m.generic_name || 'No generic'}</p>
                  </div>
                  <span className="text-xs font-extrabold text-rose-600">{m.pieces} left</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">Expiry alerts</h2>
            <div className="flex flex-wrap gap-2">
              <Badge color="red">Expired {metrics.expired.length}</Badge>
              <Badge color="amber">30d {metrics.near30.length}</Badge>
              <Badge color="blue">90d {metrics.near90.length}</Badge>
              <Badge>180d {metrics.near180.length}</Badge>
            </div>
          </div>
          {[...metrics.expired, ...metrics.near30, ...metrics.near90].length === 0 ? (
            <EmptyState icon={CalendarClock} title="No urgent expiry alerts" description="No active batch is expired or near expiry in 90 days." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-500 border-b border-slate-200">
                  <tr><th className="text-left py-2">Batch</th><th className="text-left py-2">Medicine</th><th className="text-left py-2">Expiry</th><th className="text-right py-2">Qty</th><th className="text-right py-2">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...metrics.expired, ...metrics.near30, ...metrics.near90].slice(0, 12).map((b) => {
                    const med = medicines.find((m) => m.id === b.medicine_id);
                    const d = daysUntil(b.expiry_date);
                    return (
                      <tr key={b.id}>
                        <td className="py-2 font-semibold text-slate-900">{b.batch_number}</td>
                        <td className="py-2 text-slate-600">{med?.name || 'Medicine'}</td>
                        <td className="py-2 text-slate-600">{formatShortDate(b.expiry_date)}</td>
                        <td className="py-2 text-right font-semibold">{b.quantity}</td>
                        <td className="py-2 text-right"><span className={classNames('text-xs font-bold rounded-full px-2 py-0.5', d < 0 ? 'bg-rose-100 text-rose-700' : d <= 30 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}>{d < 0 ? 'Expired' : `${d} days`}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-5 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-white p-5">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-slate-900">Pharmacy account protection enabled</p>
            <p className="text-sm text-slate-600 mt-1">This account uses medicine-only inventory. Product/dress inventory pages are hidden; pharmacy sales use FEFO batch deduction, expiry alerts and pharmacy payment methods.</p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function Metric({ label, value, icon: Icon, tint }: { label: string; value: string; icon: typeof TrendingUp; tint: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="mt-1 text-xl font-extrabold text-slate-900">{value}</p>
        </div>
        <div className={classNames('h-10 w-10 rounded-xl grid place-items-center', tint)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
