import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  ChefHat,
  Clock3,
  CreditCard,
  Loader2,
  Printer,
  Receipt,
  RefreshCw,
  Store,
  Table2,
  Wallet,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { BusinessCategory, Sale, SaleWithItems } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { CATEGORY_META, classNames, formatMoney } from '../../lib/utils';
import { Badge, Button, Card, EmptyState, Modal, PageContainer, PageHeader, Spinner } from '../ui/Shared';

type PaymentMethod = 'cash' | 'card' | 'other';
type ActiveStatus = 'kitchen' | 'prepared';

const TABLE_NUMBERS = Array.from({ length: 20 }, (_, i) => String(i + 1));

export default function Tables() {
  const { business } = useAuth();
  const [orders, setOrders] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SaleWithItems | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [updating, setUpdating] = useState(false);
  const [receiptSale, setReceiptSale] = useState<SaleWithItems | null>(null);

  const currency = business?.currency ?? 'BDT';
  const taxRate = Number(business?.tax_rate ?? 0);

  const load = async () => {
    if (!business) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false });

    if (error) {
      setOrders([]);
      setError(error.message);
    } else {
      const active = ((data ?? []) as SaleWithItems[]).filter((order) =>
        ['kitchen', 'prepared'].includes(String(order.status)) && !!order.table_number,
      );
      setOrders(active);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [business]);

  const ordersByTable = useMemo(() => {
    const map = new Map<string, SaleWithItems>();
    orders.forEach((order) => {
      const table = String(order.table_number || '').trim();
      if (!table) return;
      if (!map.has(table)) map.set(table, order);
    });
    return map;
  }, [orders]);

  const stats = useMemo(() => ({
    booked: orders.length,
    processing: orders.filter((o) => o.status === 'kitchen').length,
    prepared: orders.filter((o) => o.status === 'prepared').length,
    amount: orders.reduce((sum, o) => sum + Number(o.total || 0), 0),
  }), [orders]);

  const openOrder = (order: SaleWithItems) => {
    setSelected(order);
    setReceiptSale(null);
    setPayment((order.payment_method as PaymentMethod) || 'cash');
  };

  const markPrepared = async () => {
    if (!selected) return;
    setUpdating(true);
    setError(null);
    const { error } = await supabase
      .from('sales')
      .update({ status: 'prepared', updated_at: new Date().toISOString() })
      .eq('id', selected.id);
    setUpdating(false);
    if (error) {
      setError(error.message);
      return;
    }
    const updated = { ...selected, status: 'prepared' as ActiveStatus };
    setSelected(updated);
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  const completeOrder = async () => {
    if (!selected) return;
    setUpdating(true);
    setError(null);
    const { error } = await supabase
      .from('sales')
      .update({ status: 'completed', payment_method: payment, updated_at: new Date().toISOString() })
      .eq('id', selected.id);
    setUpdating(false);
    if (error) {
      setError(error.message);
      return;
    }
    const completed = { ...selected, status: 'completed', payment_method: payment } as SaleWithItems;
    setReceiptSale(completed);
    setOrders((prev) => prev.filter((o) => o.id !== selected.id));
  };

  if (business?.category !== 'restaurant') {
    return (
      <PageContainer>
        <EmptyState icon={Table2} title="Tables are for restaurant accounts" description="Create or switch to a restaurant business profile to use table booking and kitchen orders." />
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <Spinner label="Loading tables…" />
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Restaurant tables"
        subtitle="Click a booked table to see order details, kitchen status, payment method, receipt, and print option."
        action={
          <Button variant="secondary" onClick={load}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-5">
        <TableStat label="Booked tables" value={String(stats.booked)} icon={Table2} />
        <TableStat label="Processing" value={String(stats.processing)} icon={ChefHat} />
        <TableStat label="Prepared" value={String(stats.prepared)} icon={CheckCircle2} />
        <TableStat label="Open amount" value={formatMoney(stats.amount, currency)} icon={Receipt} />
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-extrabold text-slate-900">Table map</h2>
            <p className="text-xs text-slate-500 mt-0.5">Green = available, amber = processing, blue = prepared.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Available</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2.5 py-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Processing</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 px-2.5 py-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> Prepared</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-10 gap-3">
          {TABLE_NUMBERS.map((table) => {
            const order = ordersByTable.get(table);
            const status = order?.status as ActiveStatus | undefined;
            return (
              <button
                key={table}
                onClick={() => order && openOrder(order)}
                className={classNames(
                  'min-h-[105px] rounded-2xl border-2 p-3 text-left transition-all',
                  order
                    ? status === 'prepared'
                      ? 'border-blue-200 bg-blue-50 hover:bg-blue-100 hover:shadow-soft-lg'
                      : 'border-amber-200 bg-amber-50 hover:bg-amber-100 hover:shadow-soft-lg'
                    : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="h-9 w-9 rounded-xl bg-white/80 grid place-items-center shadow-sm">
                    <Table2 className={classNames('h-5 w-5', order ? status === 'prepared' ? 'text-blue-700' : 'text-amber-700' : 'text-emerald-700')} />
                  </div>
                  {order ? <Badge color={status === 'prepared' ? 'blue' : 'amber'}>{status === 'prepared' ? 'Prepared' : 'Booked'}</Badge> : <Badge color="green">Free</Badge>}
                </div>
                <p className="mt-3 text-lg font-extrabold text-slate-900">Table {table}</p>
                {order ? (
                  <div className="mt-1 text-xs text-slate-600 space-y-0.5">
                    <p>{(order.sale_items ?? []).reduce((s, it) => s + Number(it.quantity), 0)} items</p>
                    <p className="font-bold text-slate-900">{formatMoney(Number(order.total), currency)}</p>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-emerald-700 font-semibold">Available</p>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <OrderModal
        open={!!selected}
        onClose={() => setSelected(null)}
        order={selected}
        receiptSale={receiptSale}
        business={business}
        currency={currency}
        taxRate={taxRate}
        payment={payment}
        setPayment={setPayment}
        onPrepared={markPrepared}
        onComplete={completeOrder}
        updating={updating}
      />
    </PageContainer>
  );
}

function TableStat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Table2 }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-slate-100 grid place-items-center">
          <Icon className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="text-xl font-extrabold text-slate-900">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function OrderModal({
  open,
  onClose,
  order,
  receiptSale,
  business,
  currency,
  taxRate,
  payment,
  setPayment,
  onPrepared,
  onComplete,
  updating,
}: {
  open: boolean;
  onClose: () => void;
  order: SaleWithItems | null;
  receiptSale: SaleWithItems | null;
  business: { business_name: string; address: string; owner_name: string; category: string; phone?: string; receipt_message?: string | null; logo_url?: string | null } | null;
  currency: string;
  taxRate: number;
  payment: PaymentMethod;
  setPayment: (method: PaymentMethod) => void;
  onPrepared: () => void;
  onComplete: () => void;
  updating: boolean;
}) {
  if (!order || !business) return null;
  const printable = receiptSale ?? order;
  const status = String(order.status);

  return (
    <Modal open={open} onClose={onClose} size="xl" title={`Table ${order.table_number} order`}>
      <div className="p-5">
        {!receiptSale ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order #{order.id.slice(-6).toUpperCase()}</p>
                <h3 className="mt-1 text-xl font-extrabold text-slate-900">Table {order.table_number}</h3>
                <p className="mt-1 text-xs text-slate-500 flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {new Date(order.created_at).toLocaleString()}</p>
              </div>
              <Badge color={status === 'prepared' ? 'blue' : 'amber'}>{status === 'prepared' ? 'Prepared' : 'Processing'}</Badge>
            </div>

            <div className="mt-4 space-y-2">
              {(order.sale_items ?? []).map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.quantity} × {formatMoney(Number(item.unit_price), currency)}</p>
                  </div>
                  <p className="text-sm font-extrabold text-slate-900">{formatMoney(Number(item.line_total), currency)}</p>
                </div>
              ))}
            </div>

            <AmountSummary sale={order} currency={currency} taxRate={taxRate} />

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-bold text-slate-900 mb-3">Payment method</p>
              <div className="grid grid-cols-3 gap-2">
                <PayChoice current={payment} value="cash" onClick={setPayment} icon={Banknote} label="Cash" />
                <PayChoice current={payment} value="card" onClick={setPayment} icon={CreditCard} label="Card" />
                <PayChoice current={payment} value="other" onClick={setPayment} icon={Wallet} label="Other" />
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              {status === 'kitchen' && (
                <Button variant="secondary" className="flex-1" onClick={onPrepared} disabled={updating}>
                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChefHat className="h-4 w-4" />}
                  Mark prepared
                </Button>
              )}
              <Button className="flex-1" onClick={onComplete} disabled={updating || status !== 'prepared'}>
                {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Complete order & show receipt
              </Button>
            </div>
            {status !== 'prepared' && <p className="mt-2 text-xs text-amber-700">Complete button unlocks after the kitchen marks this order as prepared.</p>}
          </>
        ) : (
          <ReceiptView sale={printable} business={business} currency={currency} taxRate={taxRate} onClose={onClose} />
        )}
      </div>
    </Modal>
  );
}

function AmountSummary({ sale, currency, taxRate }: { sale: Sale; currency: string; taxRate: number }) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1.5 text-sm">
      <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatMoney(Number(sale.subtotal), currency)}</span></div>
      {Number(sale.discount) > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-{formatMoney(Number(sale.discount), currency)}</span></div>}
      {Number(sale.service_charge) > 0 && <div className="flex justify-between text-slate-600"><span>Service charge</span><span>{formatMoney(Number(sale.service_charge), currency)}</span></div>}
      {Number(sale.vat) > 0 && <div className="flex justify-between text-slate-600"><span>VAT</span><span>{formatMoney(Number(sale.vat), currency)}</span></div>}
      {taxRate > 0 && Number(sale.tax) > 0 && <div className="flex justify-between text-slate-600"><span>Tax ({taxRate.toFixed(2)}%)</span><span>{formatMoney(Number(sale.tax), currency)}</span></div>}
      {Number(sale.delivery_charge) > 0 && <div className="flex justify-between text-slate-600"><span>Delivery</span><span>{formatMoney(Number(sale.delivery_charge), currency)}</span></div>}
      <div className="flex justify-between border-t border-slate-200 pt-2 text-base"><span className="font-bold text-slate-900">Total amount</span><span className="font-extrabold text-slate-900">{formatMoney(Number(sale.total), currency)}</span></div>
    </div>
  );
}

function PayChoice({ current, value, onClick, icon: Icon, label }: { current: PaymentMethod; value: PaymentMethod; onClick: (v: PaymentMethod) => void; icon: typeof Banknote; label: string }) {
  const active = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      className={classNames(
        'flex flex-col items-center gap-1 rounded-xl border-2 py-3 transition-all',
        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="text-xs font-bold">{label}</span>
    </button>
  );
}

function ReceiptView({ sale, business, currency, taxRate, onClose }: { sale: SaleWithItems; business: { business_name: string; address: string; owner_name: string; category: string; phone?: string; receipt_message?: string | null; logo_url?: string | null }; currency: string; taxRate: number; onClose: () => void }) {
  const meta = CATEGORY_META[business.category as BusinessCategory];
  return (
    <div className="print-receipt">
      <div className="flex flex-col items-center text-center pb-4 border-b border-dashed border-slate-200">
        <div className={classNames('h-12 w-12 rounded-2xl bg-gradient-to-br grid place-items-center text-white mb-3', meta?.gradient ?? 'from-slate-700 to-slate-900')}>
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <p className="text-lg font-extrabold text-slate-900">Payment received</p>
        <p className="text-sm text-slate-500">{formatMoney(Number(sale.total), currency)} via {sale.payment_method}</p>
      </div>

      <div className="py-4 text-center">
        {business.logo_url ? <img src={business.logo_url} alt="Logo" className="mx-auto h-16 w-16 object-contain mb-2" /> : <Store className="mx-auto h-10 w-10 text-slate-700 mb-2" />}
        <p className="font-bold text-slate-900">{business.business_name}</p>
        <p className="text-xs text-slate-500 mt-0.5">{business.address}</p>
        {business.phone && <p className="text-xs text-slate-500 mt-0.5">Tel: {business.phone}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-2"><span className="text-slate-500">Table</span><p className="font-bold text-slate-900">{sale.table_number}</p></div>
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-2"><span className="text-slate-500">Invoice</span><p className="font-mono font-bold text-slate-900">{sale.id.slice(0, 8).toUpperCase()}</p></div>
      </div>

      <div className="border-t border-dashed border-slate-200 pt-3 space-y-2">
        {(sale.sale_items ?? []).map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <div>
              <p className="font-medium text-slate-900">{item.name}</p>
              <p className="text-xs text-slate-500">{item.quantity} × {formatMoney(Number(item.unit_price), currency)}</p>
            </div>
            <span className="font-semibold text-slate-900">{formatMoney(Number(item.line_total), currency)}</span>
          </div>
        ))}
      </div>

      <AmountSummary sale={sale} currency={currency} taxRate={taxRate} />

      <div className="mt-4 text-center text-xs text-slate-400">{new Date().toLocaleString()}</div>
      {business.receipt_message && <p className="mt-3 pt-3 border-t border-dashed border-slate-200 text-center text-xs text-slate-600 italic">{business.receipt_message}</p>}

      <div className="mt-5 flex gap-2 no-print">
        <Button variant="secondary" className="flex-1" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print receipt</Button>
        <Button className="flex-1" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}
