import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Package,
  AlertTriangle,
  Plus,
  ScanLine,
  Receipt,
  WalletCards,
  Clock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Sale, Product, BusinessCategory, Expense } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatMoney, timeAgo, CATEGORY_META, classNames } from '../../lib/utils';
import { PageContainer, PageHeader, Card, Button, Spinner, EmptyState } from '../ui/Shared';
import type { View } from '../layout/AppLayout';

interface Props {
  onNavigate: (v: View) => void;
}

export default function Dashboard({ onNavigate }: Props) {
  const { business } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!business) return;
      const [salesRes, productsRes, expensesRes] = await Promise.all([
        supabase.from('sales').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(250),
        supabase.from('products').select('*').eq('business_id', business.id).order('created_at', { ascending: false }),
        supabase.from('expenses').select('*').eq('business_id', business.id).order('expense_date', { ascending: false }).limit(250),
      ]);
      if (!mounted) return;
      if (salesRes.data) setSales(salesRes.data as Sale[]);
      if (productsRes.data) setProducts(productsRes.data as Product[]);
      if (expensesRes.data) setExpenses(expensesRes.data as Expense[]);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [business]);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const last7Start = todayStart - 7 * 24 * 60 * 60 * 1000;
    const last30Start = todayStart - 30 * 24 * 60 * 60 * 1000;

    const completed = sales.filter((s) => s.status === 'completed');
    const todaySales = completed.filter((s) => new Date(s.created_at).getTime() >= todayStart);
    const yesterdaySales = completed.filter((s) => {
      const t = new Date(s.created_at).getTime();
      return t >= yesterdayStart && t < todayStart;
    });
    const last7Sales = completed.filter((s) => new Date(s.created_at).getTime() >= last7Start);
    const last30Sales = completed.filter((s) => new Date(s.created_at).getTime() >= last30Start);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const todayExpenses = expenses.filter((e) => new Date(e.expense_date || e.created_at).getTime() >= todayStart);
    const monthExpenses = expenses.filter((e) => new Date(e.expense_date || e.created_at).getTime() >= thisMonthStart);

    const sum = (arr: Sale[]) => arr.reduce((acc, s) => acc + Number(s.total), 0);
    const todayTotal = sum(todaySales);
    const yesterdayTotal = sum(yesterdaySales);
    const last7Total = sum(last7Sales);
    const last30Total = sum(last30Sales);
    const avgOrder = todaySales.length ? todayTotal / todaySales.length : 0;
    const todayExpenseTotal = todayExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const monthExpenseTotal = monthExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const todayNet = todayTotal - todayExpenseTotal;
    const monthNet = last30Total - monthExpenseTotal;

    const dayChange = yesterdayTotal > 0 ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100 : todayTotal > 0 ? 100 : 0;

    return {
      todayTotal,
      todayCount: todaySales.length,
      last7Total,
      last7Count: last7Sales.length,
      last30Total,
      last30Count: last30Sales.length,
      avgOrder,
      dayChange,
      todayExpenseTotal,
      monthExpenseTotal,
      todayNet,
      monthNet,
    };
  }, [sales, expenses]);

  const lowStock = useMemo(() => products.filter((p) => p.is_active && p.stock <= 5).sort((a, b) => a.stock - b.stock), [products]);
  const activeProducts = products.filter((p) => p.is_active);
  const inventoryValue = activeProducts.reduce((acc, p) => acc + Number(p.cost) * p.stock, 0);
  const potentialRevenue = activeProducts.reduce((acc, p) => acc + Number(p.price) * p.stock, 0);

  const last7Series = useMemo(() => {
    const days: { label: string; total: number; count: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i).getTime();
      const end = start + 24 * 60 * 60 * 1000;
      const daySales = sales.filter((s) => {
        const t = new Date(s.created_at).getTime();
        return s.status === 'completed' && t >= start && t < end;
      });
      const total = daySales.reduce((acc, s) => acc + Number(s.total), 0);
      days.push({
        label: new Date(start).toLocaleDateString(undefined, { weekday: 'short' }),
        total,
        count: daySales.length,
      });
    }
    return days;
  }, [sales]);

  const recentSales = sales.slice(0, 6);
  const meta = business ? CATEGORY_META[business.category as BusinessCategory] : null;
  const currency = business?.currency ?? 'USD';

  if (loading) {
    return (
      <PageContainer>
        <Spinner label="Loading your dashboard…" />
      </PageContainer>
    );
  }

  const maxBar = Math.max(...last7Series.map((d) => d.total), 1);

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome back, ${business?.owner_name?.split(' ')[0] ?? 'there'}`}
        subtitle={meta ? `${meta.label} · ${business?.business_name}` : 'Here is what is happening today.'}
        action={
          <Button onClick={() => onNavigate('pos')}>
            <ScanLine className="h-4 w-4" />
            Start a sale
          </Button>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Today's revenue"
          value={formatMoney(stats.todayTotal, currency)}
          icon={DollarSign}
          tint="from-emerald-500 to-teal-500"
          trend={stats.dayChange}
          sub={`${stats.todayCount} ${stats.todayCount === 1 ? 'sale' : 'sales'} today`}
        />
        <KpiCard
          label="Today expenses"
          value={formatMoney(stats.todayExpenseTotal, currency)}
          icon={WalletCards}
          tint="from-rose-500 to-pink-500"
          sub={`Net today: ${formatMoney(stats.todayNet, currency)}`}
        />
        <KpiCard
          label="Avg. order value"
          value={formatMoney(stats.avgOrder, currency)}
          icon={ShoppingBag}
          tint="from-amber-500 to-orange-500"
          sub="Today's average ticket"
        />
        <KpiCard
          label="Monthly sales"
          value={formatMoney(stats.last30Total, currency)}
          icon={TrendingUp}
          tint="from-brand-500 to-blue-500"
          sub={`Expenses: ${formatMoney(stats.monthExpenseTotal, currency)}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Sales chart */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-900">Sales this week</h3>
              <p className="text-xs text-slate-500 mt-0.5">Daily revenue, last 7 days</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Week total</p>
              <p className="font-bold text-slate-900">{formatMoney(stats.last7Total, currency)}</p>
            </div>
          </div>
          <div className="flex items-end justify-between gap-2 h-44">
            {last7Series.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="relative w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-brand-500 to-brand-400 transition-all duration-500 hover:from-brand-600 hover:to-brand-500 relative group-hover:opacity-90"
                    style={{ height: `${Math.max((d.total / maxBar) * 100, 4)}%` }}
                  >
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="rounded-md bg-slate-900 text-white text-[11px] px-2 py-1 whitespace-nowrap font-medium shadow-lg">
                        {formatMoney(d.total, currency)}
                      </div>
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-slate-500">{d.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Low stock alerts */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-50 grid place-items-center">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Low stock</h3>
                <p className="text-[11px] text-slate-500">{lowStock.length} {lowStock.length === 1 ? 'item' : 'items'} need restocking</p>
              </div>
            </div>
            <button onClick={() => onNavigate('products')} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              View all
            </button>
          </div>
          {lowStock.length === 0 ? (
            <div className="text-center py-8">
              <div className="h-12 w-12 rounded-xl bg-emerald-50 grid place-items-center mx-auto mb-3">
                <Package className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-slate-900">All stocked up</p>
              <p className="text-xs text-slate-500 mt-0.5">No items below threshold.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto -mr-2 pr-2">
              {lowStock.slice(0, 6).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                    {p.category && <p className="text-[11px] text-slate-500 truncate">{p.category}</p>}
                  </div>
                  <span className={classNames(
                    'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold',
                    p.stock === 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700',
                  )}>
                    {p.stock === 0 ? 'Out of stock' : `${p.stock} left`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent sales */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-brand-50 grid place-items-center">
                <Receipt className="h-4 w-4 text-brand-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Recent sales</h3>
                <p className="text-[11px] text-slate-500">Latest transactions</p>
              </div>
            </div>
            <button onClick={() => onNavigate('sales')} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              View all
            </button>
          </div>
          {recentSales.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No sales yet"
              description="Ring up your first sale to see it here."
              action={
                <Button onClick={() => onNavigate('pos')} size="sm">
                  <Plus className="h-4 w-4" />
                  New sale
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {recentSales.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-slate-100 grid place-items-center shrink-0">
                      <Receipt className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {s.customer_name || 'Walk-in customer'}
                      </p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {timeAgo(s.created_at)} · {s.payment_method}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900">{formatMoney(Number(s.total), currency)}</p>
                    <span className={classNames(
                      'text-[11px] font-medium',
                      s.status === 'completed' ? 'text-emerald-600' : s.status === 'refunded' ? 'text-amber-600' : 'text-rose-600',
                    )}>
                      {s.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Quick actions + inventory summary */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-bold text-slate-900 text-sm mb-3">Quick actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <QuickAction icon={ScanLine} label="New sale" onClick={() => onNavigate('pos')} tint="bg-brand-50 text-brand-600" />
              <QuickAction icon={Plus} label="Add product" onClick={() => onNavigate('products')} tint="bg-emerald-50 text-emerald-600" />
              <QuickAction icon={Receipt} label="View sales" onClick={() => onNavigate('sales')} tint="bg-amber-50 text-amber-600" />
              <QuickAction icon={WalletCards} label="Add expense" onClick={() => onNavigate('expenses')} tint="bg-rose-50 text-rose-600" />
              <QuickAction icon={Package} label="Inventory" onClick={() => onNavigate('products')} tint="bg-fuchsia-50 text-fuchsia-600" />
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-bold text-slate-900 text-sm mb-3">Inventory snapshot</h3>
            <div className="space-y-3">
              <Row label="Inventory cost" value={formatMoney(inventoryValue, currency)} />
              <Row label="Potential revenue" value={formatMoney(potentialRevenue, currency)} />
              <Row label="Potential profit" value={formatMoney(potentialRevenue - inventoryValue, currency)} accent="text-emerald-600" />
              <div className="pt-2 border-t border-slate-100">
                <Row label="Out of stock" value={String(products.filter((p) => p.is_active && p.stock === 0).length)} />
                <Row label="Low stock" value={String(products.filter((p) => p.is_active && p.stock > 0 && p.stock <= 5).length)} />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tint,
  trend,
  sub,
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  tint: string;
  trend?: number;
  sub?: string;
}) {
  const trendUp = (trend ?? 0) >= 0;
  return (
    <Card className="p-5 hover:shadow-soft-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900 tracking-tight truncate">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        <div className={classNames('h-10 w-10 rounded-xl bg-gradient-to-br grid place-items-center text-white shrink-0', tint)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {typeof trend === 'number' && (
        <div className="mt-3 flex items-center gap-1.5">
          <span className={classNames('inline-flex items-center gap-0.5 text-xs font-bold', trendUp ? 'text-emerald-600' : 'text-rose-600')}>
            {trendUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
          <span className="text-xs text-slate-400">vs yesterday</span>
        </div>
      )}
    </Card>
  );
}

function QuickAction({ icon: Icon, label, onClick, tint }: { icon: typeof Plus; label: string; onClick: () => void; tint: string }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 p-3 hover:border-slate-300 hover:bg-slate-50 transition-all text-left"
    >
      <div className={classNames('h-8 w-8 rounded-lg grid place-items-center', tint)}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-xs font-semibold text-slate-700">{label}</span>
    </button>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={classNames('text-sm font-semibold', accent ?? 'text-slate-900')}>{value}</span>
    </div>
  );
}
