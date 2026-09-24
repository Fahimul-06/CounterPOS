import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Boxes, CalendarClock, Database, DollarSign, PackageCheck, PackageX, Pill, RefreshCcw, ShoppingCart, Truck, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest, supabase } from '../../lib/supabase';
import { formatMoney, formatShortDate } from '../../lib/utils';
import { PageContainer, PageHeader, Card, Button, Spinner, Badge } from '../ui/Shared';
import { ExpiryBadge, StatCard, daysUntil, money, unitText } from './pharmacyHelpers';

export default function PharmacyDashboard({ onNavigate }: { onNavigate?: (view: any) => void }) {
  const { business } = useAuth();
  const [summary, setSummary] = useState<any | null>(null);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    if (!business) return;
    setLoading(true);
    const [summaryRes, medsRes, batchRes, saleRes] = await Promise.all([
      apiRequest<{ data: any }>('/pharmacy/dashboard').catch(() => ({ data: null })),
      supabase.from('medicines').select('*').eq('business_id', business.id).order('name', { ascending: true }),
      supabase.from('medicine_batches').select('*').eq('business_id', business.id).order('expiry_date', { ascending: true }),
      supabase.from('sales').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(8),
    ]);
    setSummary(summaryRes.data);
    setMedicines((medsRes.data as any[]) || []);
    setBatches((batchRes.data as any[]) || []);
    setSales((saleRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [business]);

  const alerts = useMemo(() => {
    const low = medicines.filter((m) => Number(m.pieces || 0) <= Number(m.low_stock_threshold || 20));
    const expired = batches.filter((b) => daysUntil(b.expiry_date) < 0);
    const near30 = batches.filter((b) => daysUntil(b.expiry_date) >= 0 && daysUntil(b.expiry_date) <= 30);
    const near90 = batches.filter((b) => daysUntil(b.expiry_date) > 30 && daysUntil(b.expiry_date) <= 90);
    const near180 = batches.filter((b) => daysUntil(b.expiry_date) > 90 && daysUntil(b.expiry_date) <= 180);
    return { low, expired, near30, near90, near180 };
  }, [medicines, batches]);

  const seed = async () => {
    setSeeding(true);
    setMessage(null);
    try {
      const res = await apiRequest<{ data: any }>('/pharmacy/mock-data', { method: 'POST', body: JSON.stringify({ reset: medicines.length === 0 ? false : false }) });
      setMessage(res.data?.seeded ? `Bangladesh medicine mock data added: ${res.data.inserted_medicines || 0} medicines and ${res.data.batches || 0} batches.` : 'Bangladesh medicine mock data is already loaded for this account.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to add mock data.');
    } finally {
      setSeeding(false);
    }
  };

  if (loading) return <Spinner label="Loading pharmacy dashboard…" />;

  return (
    <PageContainer className="max-w-[1600px]">
      <PageHeader
        title="Pharmacy Dashboard"
        subtitle="Sales, profit, purchases, expiry alerts, stock valuation, and dues in one place."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={seed} disabled={seeding}><Database className="h-4 w-4" /> {seeding ? 'Adding…' : 'Add Bangladesh mock medicines'}</Button>
            <Button onClick={() => load()}><RefreshCcw className="h-4 w-4" /> Refresh</Button>
          </div>
        }
      />

      {message && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>}

      <div className="mb-6 rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-5 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-white/75 text-sm font-semibold uppercase tracking-wide">Professional Pharmacy POS</p>
            <h2 className="mt-1 text-2xl md:text-3xl font-extrabold">{business?.business_name || 'Pharmacy'} operations center</h2>
            <p className="mt-2 text-sm text-white/80 max-w-2xl">Dedicated pharmacy workflow with FEFO sale, batch-wise stock, supplier purchases, prescriptions, dues, returns, reports, branches, permissions and audit logs.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onNavigate?.('pos')}>Fast POS</Button>
            <Button variant="secondary" onClick={() => onNavigate?.('pharmacy_inventory')}>Inventory</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <StatCard label="Today sales" value={money(summary?.today_sales || 0, business)} icon={ShoppingCart} tone="green" />
        <StatCard label="Monthly sales" value={money(summary?.monthly_sales || 0, business)} icon={BarChart3} tone="blue" />
        <StatCard label="Estimated profit" value={money(summary?.estimated_profit || 0, business)} icon={DollarSign} tone="violet" sub="Sales - purchases - expenses" />
        <StatCard label="Stock valuation" value={money(summary?.stock_valuation || 0, business)} icon={Boxes} tone="slate" />
        <StatCard label="Monthly purchases" value={money(summary?.monthly_purchases || 0, business)} icon={Truck} tone="amber" />
        <StatCard label="Customer due" value={money(summary?.customer_due || 0, business)} icon={Users} tone="red" />
        <StatCard label="Supplier due" value={money(summary?.supplier_due || 0, business)} icon={PackageCheck} tone="amber" />
        <StatCard label="Low stock items" value={summary?.low_stock || alerts.low.length} icon={PackageX} tone="red" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900">Expiry alert board</h3>
              <p className="text-xs text-slate-500">30, 90 and 180 day expiry windows with expired stock.</p>
            </div>
            <CalendarClock className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <AlertTile label="Expired" value={alerts.expired.length} color="rose" />
            <AlertTile label="≤ 30 days" value={alerts.near30.length} color="amber" />
            <AlertTile label="≤ 90 days" value={alerts.near90.length} color="blue" />
            <AlertTile label="≤ 180 days" value={alerts.near180.length} color="emerald" />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b"><th className="py-2">Batch</th><th>Medicine</th><th>Expiry</th><th>Qty</th><th>Status</th></tr></thead>
              <tbody>
                {batches.slice(0, 8).map((b) => {
                  const med = medicines.find((m) => m.id === b.medicine_id);
                  return <tr key={b.id} className="border-b border-slate-100"><td className="py-2 font-semibold text-slate-800">{b.batch_number}</td><td>{med?.name || 'Medicine'}</td><td>{formatShortDate(b.expiry_date)}</td><td>{b.available_quantity}</td><td><ExpiryBadge expiry={b.expiry_date} /></td></tr>;
                })}
                {batches.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-500">No batch data yet. Add Bangladesh mock medicines or create medicine batches.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900">Low stock</h3>
              <p className="text-xs text-slate-500">Based on each medicine threshold.</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div className="space-y-3">
            {alerts.low.slice(0, 8).map((m) => (
              <div key={m.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2"><p className="font-bold text-slate-900 text-sm">{m.name}</p><Badge color={Number(m.pieces || 0) <= 0 ? 'red' : 'amber'}>{Number(m.pieces || 0) <= 0 ? 'StockOut' : 'Low'}</Badge></div>
                <p className="text-xs text-slate-500 mt-1">{m.generic_name} · Rack {m.rack_location || 'N/A'}</p>
                <p className={Number(m.pieces || 0) <= 0 ? 'mt-2 inline-flex rounded-md bg-rose-100 px-2 py-0.5 text-xs font-extrabold text-rose-700 ring-1 ring-rose-200' : 'text-xs font-semibold text-slate-700 mt-2'}>{Number(m.pieces || 0) <= 0 ? 'StockOut' : unitText(m)}</p>
              </div>
            ))}
            {alerts.low.length === 0 && <div className="py-8 text-center text-slate-500"><Pill className="h-8 w-8 mx-auto mb-2 text-emerald-500" />All medicines are above low stock level.</div>}
          </div>
        </Card>
      </div>

      <Card className="mt-5 p-5">
        <h3 className="font-bold text-slate-900 mb-3">Recent sales</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b"><th className="py-2">Invoice</th><th>Date</th><th>Customer</th><th>Payment</th><th>Total</th></tr></thead>
            <tbody>{sales.map((s) => <tr key={s.id} className="border-b border-slate-100"><td className="py-2 font-mono text-xs">{s.id.slice(-8).toUpperCase()}</td><td>{formatShortDate(s.created_at)}</td><td>{s.customer_name || 'Walk-in'}</td><td><Badge color={s.payment_method === 'due' ? 'amber' : 'green'}>{s.payment_method}</Badge></td><td className="font-bold">{formatMoney(s.total, business?.currency || 'BDT')}</td></tr>)}</tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}

function AlertTile({ label, value, color }: { label: string; value: number; color: 'rose' | 'amber' | 'blue' | 'emerald' }) {
  const cls = { rose: 'bg-rose-50 text-rose-700 border-rose-100', amber: 'bg-amber-50 text-amber-700 border-amber-100', blue: 'bg-blue-50 text-blue-700 border-blue-100', emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100' }[color];
  return <div className={`rounded-2xl border p-3 ${cls}`}><p className="text-xs font-semibold">{label}</p><p className="text-2xl font-extrabold">{value}</p></div>;
}
