import { useEffect, useMemo, useState, FormEvent } from 'react';
import { Plus, Table2, Pencil, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { RestaurantTable } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { PageContainer, PageHeader, Card, Button, Spinner, EmptyState, Modal, ConfirmDialog, Badge } from '../ui/Shared';

type TableStatus = RestaurantTable['status'];

const STATUS_OPTIONS: TableStatus[] = ['available', 'occupied', 'reserved', 'cleaning'];

export default function Tables() {
  const { business } = useAuth();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RestaurantTable | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    if (!business) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('restaurant_tables')
      .select('*')
      .eq('business_id', business.id)
      .order('name', { ascending: true });
    if (!error) setTables(data as RestaurantTable[]);
    else console.error(error);
    setLoading(false);
  };

  useEffect(() => { load(); }, [business]);

  const stats = useMemo(() => ({
    total: tables.length,
    available: tables.filter((t) => t.status === 'available').length,
    occupied: tables.filter((t) => t.status === 'occupied').length,
    reserved: tables.filter((t) => t.status === 'reserved').length,
  }), [tables]);

  const openNew = () => { setEditing(null); setShowForm(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('restaurant_tables').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      console.error(error);
      return;
    }
    setTables((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const quickStatus = async (table: RestaurantTable, status: TableStatus) => {
    const { data, error } = await supabase
      .from('restaurant_tables')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', table.id)
      .select()
      .single();
    if (error) {
      console.error(error);
      return;
    }
    setTables((prev) => prev.map((t) => (t.id === table.id ? data as RestaurantTable : t)));
  };

  return (
    <PageContainer>
      <PageHeader
        title="Tables"
        subtitle="Create and manage restaurant tables, capacity, sections, and live table status."
        action={<Button onClick={openNew}><Plus className="h-4 w-4" /> Add table</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Total tables" value={stats.total} />
        <Stat label="Available" value={stats.available} color="green" />
        <Stat label="Occupied" value={stats.occupied} color="red" />
        <Stat label="Reserved" value={stats.reserved} color="amber" />
      </div>

      <Card className="overflow-hidden">
        {loading ? <Spinner label="Loading tables…" /> : tables.length === 0 ? (
          <EmptyState
            icon={Table2}
            title="No tables yet"
            description="Add your dining tables so staff can track occupied, reserved, cleaning, and available seats."
            action={<Button onClick={openNew}><Plus className="h-4 w-4" /> Add table</Button>}
          />
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
            {tables.map((table) => (
              <div key={table.id} className="rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900">{table.name}</h3>
                      <StatusBadge status={table.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {table.capacity} seats{table.section ? ` • ${table.section}` : ''}
                    </p>
                    {table.current_order && <p className="mt-2 text-xs text-slate-500">Current order: {table.current_order}</p>}
                    {table.notes && <p className="mt-2 text-xs text-slate-500 line-clamp-2">{table.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditing(table); setShowForm(true); }} className="p-1.5 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(table)} className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((status) => (
                    <Button key={status} variant={table.status === status ? 'primary' : 'secondary'} size="sm" onClick={() => quickStatus(table, status)}>
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
        <TableForm
          open={showForm}
          table={editing}
          onClose={() => setShowForm(false)}
          onSaved={(saved, isNew) => {
            setTables((prev) => isNew ? [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)) : prev.map((t) => t.id === saved.id ? saved : t));
            setShowForm(false);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete table"
        message={`Delete ${deleteTarget?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        busy={deleting}
      />
    </PageContainer>
  );
}

function TableForm({ open, table, onClose, onSaved }: { open: boolean; table: RestaurantTable | null; onClose: () => void; onSaved: (table: RestaurantTable, isNew: boolean) => void }) {
  const { business } = useAuth();
  const [form, setForm] = useState({
    name: table?.name ?? '',
    capacity: table ? String(table.capacity) : '4',
    section: table?.section ?? '',
    status: table?.status ?? 'available' as TableStatus,
    current_order: table?.current_order ?? '',
    notes: table?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof typeof form, value: string | TableStatus) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!business) return;
    setError(null);
    if (!form.name.trim()) {
      setError('Table name is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        business_id: business.id,
        name: form.name.trim(),
        capacity: Number(form.capacity) || 0,
        section: form.section.trim() || null,
        status: form.status,
        current_order: form.current_order.trim() || null,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (table) {
        const { data, error } = await supabase.from('restaurant_tables').update(payload).eq('id', table.id).select().single();
        if (error) throw error;
        onSaved(data as RestaurantTable, false);
      } else {
        const { data, error } = await supabase.from('restaurant_tables').insert(payload).select().single();
        if (error) throw error;
        onSaved(data as RestaurantTable, true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save table.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={table ? 'Edit table' : 'Add table'} size="lg">
      <form onSubmit={submit} className="p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Table name *</label>
            <input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Table 01" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Capacity</label>
            <input type="number" min="1" value={form.capacity} onChange={(e) => update('capacity', e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Section / floor</label>
            <input value={form.section} onChange={(e) => update('section', e.target.value)} placeholder="Ground floor, Rooftop, VIP" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status</label>
            <select value={form.status} onChange={(e) => update('status', e.target.value as TableStatus)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100">
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{labelStatus(status)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Current order</label>
          <input value={form.current_order} onChange={(e) => update('current_order', e.target.value)} placeholder="Optional order number" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes</label>
          <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={3} placeholder="Optional table notes" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none" />
        </div>
        {error && <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}</div>}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{table ? 'Save changes' : 'Add table'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function Stat({ label, value, color = 'slate' }: { label: string; value: number; color?: 'slate' | 'green' | 'amber' | 'red' }) {
  return <Card className="p-4"><p className="text-xs text-slate-500">{label}</p><p className={`text-2xl font-extrabold ${color === 'green' ? 'text-emerald-600' : color === 'red' ? 'text-rose-600' : color === 'amber' ? 'text-amber-600' : 'text-slate-900'}`}>{value}</p></Card>;
}

function labelStatus(status: TableStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function StatusBadge({ status }: { status: TableStatus }) {
  if (status === 'available') return <Badge color="green">Available</Badge>;
  if (status === 'occupied') return <Badge color="red">Occupied</Badge>;
  if (status === 'reserved') return <Badge color="amber">Reserved</Badge>;
  return <Badge>Cleaning</Badge>;
}
