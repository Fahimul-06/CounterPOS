import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Receipt,
  ChevronRight,
  Calendar,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Printer,
  Banknote,
  CreditCard,
  Wallet,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { SaleWithItems } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatMoney, formatDate, formatShortDate, classNames } from '../../lib/utils';
import { PageContainer, PageHeader, Card, Spinner, EmptyState, Modal, Button, Badge } from '../ui/Shared';

type RangeKey = 'today' | '7d' | '30d' | 'all';

export default function Sales() {
  const { business } = useAuth();
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<RangeKey>('30d');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'refunded' | 'voided'>('all');
  const [selected, setSelected] = useState<SaleWithItems | null>(null);

  const currency = business?.currency ?? 'USD';

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!business) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (!mounted) return;
      if (error) {
        console.error(error);
      } else {
        setSales(data as SaleWithItems[]);
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [business]);

  const rangeStart = useMemo(() => {
    const now = new Date();
    if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (range === '7d') return now.getTime() - 7 * 24 * 60 * 60 * 1000;
    if (range === '30d') return now.getTime() - 30 * 24 * 60 * 60 * 1000;
    return 0;
  }, [range]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      if (s.status !== 'completed' && range !== 'all') {
        // still include non-completed in range filter if within time
      }
      if (new Date(s.created_at).getTime() < rangeStart && range !== 'all') return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (s.customer_name?.toLowerCase().includes(q) ?? false) ||
        s.payment_method.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.sale_items.some((it) => it.name.toLowerCase().includes(q))
      );
    });
  }, [sales, search, rangeStart, range, statusFilter]);

  const stats = useMemo(() => {
    const completed = filtered.filter((s) => s.status === 'completed');
    const total = completed.reduce((acc, s) => acc + Number(s.total), 0);
    const items = completed.reduce((acc, s) => acc + s.sale_items.reduce((a, it) => a + it.quantity, 0), 0);
    const avg = completed.length ? total / completed.length : 0;
    return { total, count: completed.length, items, avg };
  }, [filtered]);

  return (
    <PageContainer>
      <PageHeader title="Sales" subtitle="Browse transactions and view detailed receipts." />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="Revenue" value={formatMoney(stats.total, currency)} icon={DollarSign} tint="from-emerald-500 to-teal-500" />
        <StatCard label="Transactions" value={String(stats.count)} icon={Receipt} tint="from-brand-500 to-blue-500" />
        <StatCard label="Items sold" value={String(stats.items)} icon={ShoppingBag} tint="from-amber-500 to-orange-500" />
        <StatCard label="Avg. order" value={formatMoney(stats.avg, currency)} icon={TrendingUp} tint="from-fuchsia-500 to-pink-500" />
      </div>

      {/* Toolbar */}
      <Card className="p-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer, item, or payment method…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as RangeKey)}
                className="appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-8 py-2 text-sm outline-none focus:border-brand-400 cursor-pointer"
              >
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="all">All time</option>
              </select>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'completed' | 'refunded' | 'voided')}
              className="appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-2 text-sm outline-none focus:border-brand-400 cursor-pointer"
            >
              <option value="all">All status</option>
              <option value="completed">Completed</option>
              <option value="refunded">Refunded</option>
              <option value="voided">Voided</option>
            </select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <Spinner label="Loading sales…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={sales.length === 0 ? 'No sales yet' : 'No sales match your filters'}
            description={sales.length === 0 ? 'Completed sales will appear here.' : 'Try a different date range or search.'}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 hover:bg-slate-50/60 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={classNames(
                    'h-10 w-10 rounded-xl grid place-items-center shrink-0',
                    s.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : s.status === 'refunded' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600',
                  )}>
                    <PaymentIcon method={s.payment_method} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {s.customer_name || 'Walk-in customer'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {formatDate(s.created_at)} · {s.sale_items.length} {s.sale_items.length === 1 ? 'item' : 'items'} · {s.payment_method}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{formatMoney(Number(s.total), currency)}</p>
                    <StatusBadge status={s.status} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <ReceiptDetailModal
        sale={selected}
        onClose={() => setSelected(null)}
        business={business}
        currency={currency}
      />
    </PageContainer>
  );
}

function StatCard({ label, value, icon: Icon, tint }: { label: string; value: string; icon: typeof DollarSign; tint: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={classNames('h-10 w-10 rounded-xl bg-gradient-to-br grid place-items-center text-white shrink-0', tint)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 truncate">{label}</p>
          <p className="text-lg font-extrabold text-slate-900 truncate">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return <Badge color="green">Completed</Badge>;
  if (status === 'refunded') return <Badge color="amber">Refunded</Badge>;
  if (status === 'voided') return <Badge color="red">Voided</Badge>;
  return <Badge>{status}</Badge>;
}

function PaymentIcon({ method }: { method: string }) {
  if (method === 'card') return <CreditCard className="h-5 w-5" />;
  if (method === 'cash') return <Banknote className="h-5 w-5" />;
  if (method === 'other') return <Wallet className="h-5 w-5" />;
  return <Receipt className="h-5 w-5" />;
}

function ReceiptDetailModal({
  sale,
  onClose,
  business,
  currency,
}: {
  sale: SaleWithItems | null;
  onClose: () => void;
  business: { business_name: string; address: string; owner_name: string; category: string; phone?: string; receipt_message?: string | null; logo_url?: string | null } | null;
  currency: string;
}) {
  if (!sale || !business) return null;
  const taxRate = Number(sale.subtotal) > 0 ? (Number(sale.tax) / (Number(sale.subtotal) - Number(sale.discount))) * 100 : 0;
  return (
    <Modal open={!!sale} onClose={onClose} size="sm">
      <div className="p-5 print-receipt">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-brand-50 grid place-items-center">
              <Receipt className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <p className="font-bold text-slate-900">Receipt</p>
              <p className="text-[11px] text-slate-500">{formatShortDate(sale.created_at)}</p>
            </div>
          </div>
          <StatusBadge status={sale.status} />
        </div>

        <div className="text-center pb-3 border-b border-dashed border-slate-200">
          {business.logo_url && (
            <img src={business.logo_url} alt="Logo" className="mx-auto h-14 w-14 object-contain mb-1" />
          )}
          <p className="font-bold text-slate-900">{business.business_name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{business.address}</p>
          {business.phone && <p className="text-xs text-slate-500 mt-0.5">Tel: {business.phone}</p>}
          <p className="text-xs text-slate-400 mt-1">{sale.id.slice(0, 8).toUpperCase()}</p>
        </div>

        <div className="py-3 space-y-2.5">
          {sale.sale_items.map((it) => (
            <div key={it.id} className="flex justify-between text-sm">
              <div className="min-w-0">
                <p className="font-medium text-slate-900 truncate">{it.name}</p>
                <p className="text-xs text-slate-500">{it.quantity} × {formatMoney(Number(it.unit_price), currency)}</p>
              </div>
              <span className="font-semibold text-slate-900 shrink-0">{formatMoney(Number(it.line_total), currency)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-slate-200 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatMoney(Number(sale.subtotal), currency)}</span>
          </div>
          {Number(sale.discount) > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Discount</span>
              <span>-{formatMoney(Number(sale.discount), currency)}</span>
            </div>
          )}
          {Number(sale.service_charge) > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Service charge</span>
              <span>{formatMoney(Number(sale.service_charge), currency)}</span>
            </div>
          )}
          {Number(sale.vat) > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>VAT</span>
              <span>{formatMoney(Number(sale.vat), currency)}</span>
            </div>
          )}
          {Number(sale.tax) > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Tax ({taxRate.toFixed(1)}%)</span>
              <span>{formatMoney(Number(sale.tax), currency)}</span>
            </div>
          )}
          {Number(sale.delivery_charge) > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Delivery charge</span>
              <span>{formatMoney(Number(sale.delivery_charge), currency)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-slate-200">
            <span className="font-bold text-slate-900">Total</span>
            <span className="font-extrabold text-slate-900">{formatMoney(Number(sale.total), currency)}</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-dashed border-slate-200 space-y-1 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Payment method</span>
            <span className="font-medium capitalize">{sale.payment_method}</span>
          </div>
          {sale.customer_name && (
            <div className="flex justify-between">
              <span>Customer</span>
              <span className="font-medium">{sale.customer_name}</span>
            </div>
          )}
          {sale.service_area && (
            <div className="flex justify-between">
              <span>Service area</span>
              <span className="font-medium">{sale.service_area}</span>
            </div>
          )}
          {sale.tax_zone && (
            <div className="flex justify-between">
              <span>Tax zone</span>
              <span className="font-medium">{sale.tax_zone}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Date</span>
            <span className="font-medium">{formatShortDate(sale.created_at)}</span>
          </div>
        </div>

        {sale.note && (
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold">Note: </span>{sale.note}
          </div>
        )}

        {business.receipt_message && (
          <div className="mt-3 pt-3 border-t border-dashed border-slate-200 text-center">
            <p className="text-xs text-slate-600 italic">{business.receipt_message}</p>
          </div>
        )}

        <div className="mt-5 flex gap-2 no-print">
          <Button variant="secondary" className="flex-1" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button className="flex-1" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
