import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, CreditCard, Loader2, Plus, ReceiptText, Trash2, WalletCards } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Expense } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatMoney } from '../../lib/utils';
import { Badge, Button, Card, EmptyState, PageContainer, PageHeader, Spinner } from '../ui/Shared';

const EXPENSE_CATEGORIES = ['Rent', 'Salary', 'Utilities', 'Supplies', 'Transport', 'Maintenance', 'Marketing', 'Food Cost', 'Internet', 'Other'];
const PAYMENT_METHODS = ['cash', 'card', 'bkash', 'nagad', 'bank', 'other'];

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

export default function Expenses() {
  const { business } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    category: 'Other',
    amount: '',
    payment_method: 'cash',
    expense_date: todayInput(),
    note: '',
  });

  const load = async () => {
    if (!business) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('business_id', business.id)
      .order('expense_date', { ascending: false })
      .limit(250);
    if (error) setError(error.message);
    if (data) setExpenses(data as Expense[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [business?.id]);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const today = expenses.filter((e) => new Date(e.expense_date || e.created_at).getTime() >= todayStart);
    const month = expenses.filter((e) => new Date(e.expense_date || e.created_at).getTime() >= monthStart);
    const sum = (arr: Expense[]) => arr.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    return { today: sum(today), month: sum(month), total: sum(expenses), count: expenses.length };
  }, [expenses]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!business) return;
    if (!form.title.trim() || Number(form.amount) <= 0) {
      setError('Expense title and amount are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase.from('expenses').insert({
        title: form.title.trim(),
        category: form.category,
        amount: Number(form.amount),
        payment_method: form.payment_method,
        expense_date: form.expense_date,
        note: form.note.trim() || null,
      });
      if (error) throw error;
      setForm({ title: '', category: 'Other', amount: '', payment_method: 'cash', expense_date: todayInput(), note: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (expense: Expense) => {
    if (!confirm(`Delete expense "${expense.title}"?`)) return;
    const { error } = await supabase.from('expenses').delete().eq('id', expense.id);
    if (error) setError(error.message);
    else await load();
  };

  const currency = business?.currency ?? 'BDT';

  return (
    <PageContainer>
      <PageHeader title="Expenses" subtitle="Track daily and monthly business costs beside your sales." />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Stat label="Today's expense" value={formatMoney(stats.today, currency)} icon={WalletCards} />
        <Stat label="This month" value={formatMoney(stats.month, currency)} icon={CalendarDays} />
        <Stat label="Recorded total" value={formatMoney(stats.total, currency)} icon={ReceiptText} />
        <Stat label="Entries" value={String(stats.count)} icon={CreditCard} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-5 lg:col-span-1 h-fit">
          <h3 className="font-bold text-slate-900 mb-1">Add expense</h3>
          <p className="text-sm text-slate-500 mb-4">Record rent, salary, supplies, utilities, and other costs.</p>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Title">
              <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Staff lunch" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Amount">
                <input className="input" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Payment">
                <select className="input capitalize" value={form.payment_method} onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Date">
                <input className="input" type="date" value={form.expense_date} onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))} />
              </Field>
            </div>
            <Field label="Note">
              <textarea className="input resize-none" rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Optional note" />
            </Field>
            {error && <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 flex gap-2"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{error}</div>}
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add expense
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Expense history</h3>
              <p className="text-sm text-slate-500">Latest 250 expense records.</p>
            </div>
          </div>
          {loading ? <Spinner label="Loading expenses…" /> : expenses.length === 0 ? (
            <EmptyState icon={ReceiptText} title="No expenses yet" description="Add your first expense to start tracking profit accurately." />
          ) : (
            <div className="divide-y divide-slate-100">
              {expenses.map((expense) => (
                <div key={expense.id} className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900 truncate">{expense.title}</p>
                      <Badge color="blue">{expense.category}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(expense.expense_date || expense.created_at).toLocaleDateString()} · {expense.payment_method}
                    </p>
                    {expense.note && <p className="text-sm text-slate-500 mt-1">{expense.note}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="font-bold text-slate-900">{formatMoney(Number(expense.amount), currency)}</p>
                    <button onClick={() => remove(expense)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <style>{`.input{display:block;width:100%;border-radius:0.75rem;border:1px solid #e2e8f0;background:#fff;padding:0.625rem 0.875rem;font-size:0.875rem;color:#0f172a;outline:none;transition:all .15s;box-shadow:0 1px 2px rgba(15,23,42,.04)}.input::placeholder{color:#94a3b8}.input:focus{border-color:#3370ff;box-shadow:0 0 0 3px rgba(51,112,255,.15)}`}</style>
    </PageContainer>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof WalletCards }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="mt-1 text-xl font-extrabold text-slate-900">{value}</p>
        </div>
        <div className="h-11 w-11 rounded-xl bg-slate-100 grid place-items-center text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
