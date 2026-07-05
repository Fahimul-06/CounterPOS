import { useEffect, useMemo, useState } from 'react';
import { ChefHat, Clock3, CheckCircle2, RefreshCw, Utensils, Table2, StickyNote } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { SaleWithItems } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatMoney } from '../../lib/utils';
import { PageContainer, PageHeader, Card, Button, Spinner, EmptyState, Badge } from '../ui/Shared';

export default function Kitchen() {
  const { business } = useAuth();
  const [orders, setOrders] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currency = business?.currency ?? 'BDT';

  const load = async () => {
    if (!business) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('business_id', business.id)
      .eq('status', 'kitchen')
      .order('created_at', { ascending: true });

    if (error) {
      setError(error.message);
      setOrders([]);
    } else {
      setOrders((data ?? []) as SaleWithItems[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [business]);

  const markPrepared = async (order: SaleWithItems) => {
    setUpdatingId(order.id);
    setError(null);
    const { data, error } = await supabase
      .from('sales')
      .update({ status: 'prepared', updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .select('*, sale_items(*)')
      .single();

    setUpdatingId(null);
    if (error) {
      setError(error.message);
      return;
    }
    const prepared = data as SaleWithItems;
    setOrders((prev) => prev.filter((o) => o.id !== prepared.id));
  };

  const stats = useMemo(() => ({
    active: orders.length,
    items: orders.reduce((acc, o) => acc + (o.sale_items ?? []).reduce((sum, item) => sum + Number(item.quantity), 0), 0),
    total: orders.reduce((acc, o) => acc + Number(o.total), 0),
  }), [orders]);

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <Spinner label="Loading kitchen orders…" />
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Kitchen"
        subtitle="Restaurant food orders sent from the POS with table number and item details."
        action={
          <Button variant="secondary" onClick={load}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <KitchenStat label="Pending orders" value={String(stats.active)} icon={ChefHat} />
        <KitchenStat label="Food items" value={String(stats.items)} icon={Utensils} />
        <KitchenStat label="Order value" value={formatMoney(stats.total, currency)} icon={CheckCircle2} />
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={ChefHat}
          title="No kitchen orders"
          description="When restaurant staff click “Send order to kitchen” in POS, the order will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {orders.map((order) => (
            <Card key={order.id} className="overflow-hidden border-amber-200">
              <div className="p-4 border-b border-amber-100 bg-amber-50/70">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-xl bg-amber-100 grid place-items-center">
                        <ChefHat className="h-5 w-5 text-amber-700" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-900">Order #{order.id.slice(-6).toUpperCase()}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock3 className="h-3.5 w-3.5" />
                          {new Date(order.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Badge color="amber">Preparing</Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white border border-amber-100 p-3">
                    <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1"><Table2 className="h-3.5 w-3.5" /> Table</p>
                    <p className="mt-1 text-lg font-extrabold text-slate-900">{order.table_number || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-white border border-amber-100 p-3">
                    <p className="text-[11px] font-semibold text-slate-500">Total</p>
                    <p className="mt-1 text-lg font-extrabold text-slate-900">{formatMoney(Number(order.total), currency)}</p>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="space-y-2">
                  {(order.sale_items ?? []).map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500">{formatMoney(Number(item.unit_price), currency)} × {item.quantity}</p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-sm font-extrabold text-slate-900">
                        x{item.quantity}
                      </span>
                    </div>
                  ))}
                </div>

                {order.note && (
                  <div className="mt-3 flex gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600">
                    <StickyNote className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>{order.note}</span>
                  </div>
                )}

                <button
                  onClick={() => markPrepared(order)}
                  disabled={updatingId === order.id}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {updatingId === order.id ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Updating…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Prepared
                    </>
                  )}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function KitchenStat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof ChefHat }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-amber-50 grid place-items-center">
          <Icon className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="text-xl font-extrabold text-slate-900">{value}</p>
        </div>
      </div>
    </Card>
  );
}
