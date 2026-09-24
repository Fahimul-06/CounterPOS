import { useEffect, useState } from 'react';
import { AlertTriangle, Boxes, Flame, ScanLine, TrendingUp, WalletCards } from 'lucide-react';
import { apiRequest } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatMoney } from '../../lib/utils';
import { Button, Card, PageContainer, PageHeader, Spinner, Badge } from '../ui/Shared';
import type { View } from '../layout/AppLayout';

interface Props { onNavigate: (v: View) => void }

export default function LpgDashboard({ onNavigate }: Props) {
  const { business } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const currency = business?.currency ?? 'BDT';

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ data: any }>('/lpg/dashboard');
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <PageContainer><Spinner label="Loading LPG dashboard…" /></PageContainer>;

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome back, ${business?.owner_name?.split(' ')[0] ?? 'there'}`}
        subtitle={`LPG Cylinder Shop · ${business?.business_name || ''}`}
        action={<Button onClick={() => onNavigate('pos')}><ScanLine className="h-4 w-4" /> Start LPG sale</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <Kpi label="Today sales" value={formatMoney(data?.today_revenue || 0, currency)} icon={TrendingUp} sub={`${data?.today_sales_count || 0} LPG sales`} />
        <Kpi label="Monthly sales" value={formatMoney(data?.monthly_revenue || 0, currency)} icon={WalletCards} sub={`Net: ${formatMoney(data?.monthly_net || 0, currency)}`} />
        <Kpi label="Full cylinders" value={data?.full_stock || 0} icon={Flame} sub="Ready to sell" />
        <Kpi label="Empty cylinders" value={data?.empty_stock || 0} icon={Boxes} sub="Returned and in shop" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4"><AlertTriangle className="h-5 w-5 text-amber-500" /><h2 className="font-black text-slate-950">Low stock</h2></div>
          {(data?.low_stock || []).length === 0 ? <p className="text-sm text-slate-500">No low-stock LPG cylinders right now.</p> : <div className="space-y-2">{data.low_stock.map((x: any) => <Row key={x.id} item={x} currency={currency} />)}</div>}
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4"><AlertTriangle className="h-5 w-5 text-rose-500" /><h2 className="font-black text-slate-950">StockOut</h2></div>
          {(data?.stock_out || []).length === 0 ? <p className="text-sm text-slate-500">No StockOut LPG cylinders.</p> : <div className="space-y-2">{data.stock_out.map((x: any) => <Row key={x.id} item={x} currency={currency} danger />)}</div>}
        </Card>
      </div>
    </PageContainer>
  );
}

function Kpi({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub: string; icon: typeof Flame }) {
  return <Card className="p-5"><div className="flex items-center gap-3"><div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500 to-red-500 grid place-items-center text-white"><Icon className="h-5 w-5" /></div><div><p className="text-xs font-bold text-slate-500">{label}</p><p className="text-2xl font-black text-slate-950">{value}</p><p className="text-xs text-slate-400">{sub}</p></div></div></Card>;
}
function Row({ item, currency, danger }: { item: any; currency: string; danger?: boolean }) {
  return <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2"><div><p className="font-black text-slate-900">{item.company} · {item.cylinder_size}</p><p className="text-xs text-slate-500">{item.item_type} · {formatMoney(item.price, currency)}</p></div><Badge color={danger ? 'red' : 'amber'}>{danger ? 'StockOut' : `${item.full_stock} left`}</Badge></div>;
}
