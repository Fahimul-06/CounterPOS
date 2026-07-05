import { useEffect, useMemo, useState, FormEvent } from 'react';
import { Plus, ChefHat, Pencil, Trash2, Loader2, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { KitchenOrder } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { PageContainer, PageHeader, Card, Button, Spinner, EmptyState, Modal, ConfirmDialog, Badge } from '../ui/Shared';

type KitchenStatus = KitchenOrder['status'];
type Priority = KitchenOrder['priority'];

const STATUS_OPTIONS: KitchenStatus[] = ['pending', 'preparing', 'ready', 'served', 'cancelled'];
const PRIORITY_OPTIONS: Priority[] = ['normal', 'urgent'];

export default function Kitchen() {
  const { business } = useAuth();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<KitchenOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KitchenOrder | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<'active' | KitchenStatus | 'all'>('active');

  const load = async () => {
    if (!business) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('kitchen_orders')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false });
    if (!error) setOrders(data as KitchenOrder[]);
    else console.error(error);
    setLoading(false);
  };

  useEffect(() => { load(); }, [business]);

  const filtered = useMemo(() => {
    if (filter === 'all') return orders;
    if (filter === 'active') return orders.filter((o) => ['pending', 'preparing', 'ready'].includes(o.status));
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  const stats = useMemo(() => ({
    pending: orders.filter((o) => o.status === 'pending').length,
    preparing: orders.filter((o) => o.status === 'preparing').length,
    ready: orders.filter((o) => o.status === 'ready').length,
    active: orders.filter((o) => ['pending', 'preparing', 'ready'].includes(o.status)).length,
  }), [orders]);

  const openNew = () => { setEditing(null); setShowForm(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('kitchen_orders').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      console.error(error);
      return;
    }
    setOrders((prev) => prev.filter((o) => o.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const updateStatus = async (order: KitchenOrder, status: KitchenStatus) => {
    const { data, error } = await supabase
      .from('kitchen_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .select()
      .single();
    if (error) {
      console.error(error);
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === order.id ? data as KitchenOrder : o)));
  };

  return (
    <PageContainer>
      <PageHeader
        title="Kitchen"
        subtitle="Track restaurant kitchen tickets from pending to preparing, ready, and served."
        action={<Button onClick={openNew}><Plus className="h-4 w-4" /> Add kitchen order</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Active" value={stats.active} />
        <Stat label="Pending" value={stats.pending} color="amber" />
        <Stat label="Preparing" value={stats.preparing} color="blue" />
        <Stat label="Ready" value={stats.ready} color="green" />
      </div>

      <Card className="p-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {(['active', 'all', ...STATUS_OPTIONS] as const).map((status) => (
            <Button key={status} size="sm" variant={filter === status ? 'primary' : 'secondary'} onClick={() => setFilter(status)}>
              {status === 'active' ? 'Active queue' : labelStatus(status)}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? <Spinner label="Loading kitchen orders…" /> : filtered.length === 0 ? (
          <EmptyState
            icon={ChefHat}
            title="No kitchen orders"
            description="Create a kitchen ticket manually, or use this screen as your kitchen queue for restaurant orders."
            action={<Button onClick={openNew}><Plus className="h-4 w-4" /> Add kitchen order</Button>}
          />
        ) : (
          <div className="grid lg:grid-cols-2 gap-4 p-4">
            {filtered.map((order) => (
              <div key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900">#{order.order_number}</h3>
                      <StatusBadge status={order.status} />
                      {order.priority === 'urgent' && <Badge color="red">Urgent</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {order.table_name || 'No table'}{order.customer_name ? ` • ${order.customer_name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditing(order); setShowForm(true); }} className="p-1.5 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(order)} className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <p className="text-sm whitespace-pre-wrap text-slate-700">{order.items}</p>
                </div>
                {order.note && <p className="mt-2 text-xs text-slate-500">Note: {order.note}</p>}
                <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(order.created_at).toLocaleString()}
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {STATUS_OPTIONS.map((status) => (
                    <Button key={status} variant={order.status === status ? 'primary' : 'secondary'} size="sm" onClick={() => updateStatus(order, status)}>
                      {labelStatus(status)}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showForm && (
        <KitchenOrderForm
          open={showForm}
          order={editing}
          onClose={() => setShowForm(false)}
          onSaved={(saved, isNew) => {
            setOrders((prev) => isNew ? [saved, ...prev] : prev.map((o) => o.id === saved.id ? saved : o));
            setShowForm(false);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete kitchen order"
        message={`Delete order #${deleteTarget?.order_number}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        busy={deleting}
      />
    </PageContainer>
  );
}

function KitchenOrderForm({ open, order, onClose, onSaved }: { open: boolean; order: KitchenOrder | null; onClose: () => void; onSaved: (order: KitchenOrder, isNew: boolean) => void }) {
  const { business } = useAuth();
  const [form, setForm] = useState({
    order_number: order?.order_number ?? `KOT-${Date.now().toString().slice(-6)}`,
    table_name: order?.table_name ?? '',
    customer_name: order?.customer_name ?? '',
    items: order?.items ?? '',
    priority: order?.priority ?? 'normal' as Priority,
    status: order?.status ?? 'pending' as KitchenStatus,
    note: order?.note ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof typeof form, value: string | Priority | KitchenStatus) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!business) return;
    setError(null);
    if (!form.order_number.trim() || !form.items.trim()) {
      setError('Order number and items are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        business_id: business.id,
        order_number: form.order_number.trim(),
        table_name: form.table_name.trim() || null,
        customer_name: form.customer_name.trim() || null,
        items: form.items.trim(),
        priority: form.priority,
        status: form.status,
        note: form.note.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (order) {
        const { data, error } = await supabase.from('kitchen_orders').update(payload).eq('id', order.id).select().single();
        if (error) throw error;
        onSaved(data as KitchenOrder, false);
      } else {
        const { data, error } = await supabase.from('kitchen_orders').insert(payload).select().single();
        if (error) throw error;
        onSaved(data as KitchenOrder, true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save kitchen order.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={order ? 'Edit kitchen order' : 'Add kitchen order'} size="lg">
      <form onSubmit={submit} className="p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Order number *</label>
            <input value={form.order_number} onChange={(e) => update('order_number', e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Table</label>
            <input value={form.table_name} onChange={(e) => update('table_name', e.target.value)} placeholder="e.g. Table 01" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Customer name</label>
          <input value={form.customer_name} onChange={(e) => update('customer_name', e.target.value)} placeholder="Optional" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Items *</label>
          <textarea value={form.items} onChange={(e) => update('items', e.target.value)} rows={5} placeholder={'2 x Burger\n1 x Cold coffee\n1 x Brownie'} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Priority</label>
            <select value={form.priority} onChange={(e) => update('priority', e.target.value as Priority)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100">
              {PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{labelStatus(priority)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status</label>
            <select value={form.status} onChange={(e) => update('status', e.target.value as KitchenStatus)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100">
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{labelStatus(status)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Kitchen note</label>
          <textarea value={form.note} onChange={(e) => update('note', e.target.value)} rows={2} placeholder="No onion, less spicy, etc." className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none" />
        </div>
        {error && <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}</div>}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{order ? 'Save changes' : 'Add order'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function Stat({ label, value, color = 'slate' }: { label: string; value: number; color?: 'slate' | 'green' | 'amber' | 'blue' }) {
  return <Card className="p-4"><p className="text-xs text-slate-500">{label}</p><p className={`text-2xl font-extrabold ${color === 'green' ? 'text-emerald-600' : color === 'amber' ? 'text-amber-600' : color === 'blue' ? 'text-blue-600' : 'text-slate-900'}`}>{value}</p></Card>;
}

function labelStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function StatusBadge({ status }: { status: KitchenStatus }) {
  if (status === 'pending') return <Badge color="amber">Pending</Badge>;
  if (status === 'preparing') return <Badge color="blue">Preparing</Badge>;
  if (status === 'ready') return <Badge color="green">Ready</Badge>;
  if (status === 'cancelled') return <Badge color="red">Cancelled</Badge>;
  return <Badge>Served</Badge>;
}
