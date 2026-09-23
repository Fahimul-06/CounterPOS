import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  Barcode as BarcodeIcon,
  Boxes,
  Building2,
  CalendarClock,
  ClipboardList,
  CreditCard,
  FileText,
  History,
  Layers3,
  LockKeyhole,
  Pill,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { CashSession, Customer, Expense, Medicine, MedicineBatch, Purchase, StockMovement, Supplier } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { classNames, formatMoney, formatShortDate } from '../../lib/utils';
import { Badge, Button, Card, EmptyState, Modal, PageContainer, PageHeader, Spinner } from '../ui/Shared';
import ImageDropzone from '../ui/ImageDropzone';
import BarcodeScanner from '../barcode/BarcodeScanner';

export const MEDICINE_TYPES = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Drops', 'Ointment', 'Cream', 'Inhaler', 'Powder', 'Gel', 'Lotion', 'Spray', 'Other'];
const MEDICINE_CATEGORIES = ['Antibiotic', 'Analgesic', 'Antipyretic', 'Antacid', 'Antihistamine', 'Vitamin', 'Diabetes', 'Cardiac', 'Dermatology', 'Respiratory', 'Gastro', 'Other'];
const DOSAGE_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Cream', 'Ointment', 'Drops', 'Inhaler', 'Powder', 'Other'];

type Tab = 'medicines' | 'batches' | 'suppliers' | 'purchases' | 'customers' | 'stock' | 'cash' | 'reports' | 'branches' | 'access';

interface Branch { id: string; name: string; address?: string | null; phone?: string | null; is_active?: boolean; }
interface AuditLog { id: string; action: string; resource?: string | null; metadata?: any; created_at: string; }
interface RolePermission { id: string; role: string; permissions: string[]; is_active: boolean; }

function today() { return new Date().toISOString().slice(0, 10); }
function daysUntil(iso?: string | null) {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const e = new Date(`${iso}T00:00:00`);
  return Math.round((e.getTime() - t.getTime()) / 86400000);
}
function expiryBadge(days: number) {
  if (days < 0) return { label: 'Expired', color: 'red' as const };
  if (days <= 30) return { label: '30-day alert', color: 'red' as const };
  if (days <= 90) return { label: '90-day alert', color: 'amber' as const };
  if (days <= 180) return { label: '180-day alert', color: 'blue' as const };
  return { label: 'Valid', color: 'green' as const };
}

const emptyMedicine = {
  name: '', brand_name: '', generic_name: '', manufacturer: '', category: 'Antibiotic', strength: '', dosage_form: 'Tablet', medicine_type: 'Tablet', pack_size: '', sku: '', barcode: '', rack_location: '',
  pieces_per_strip: '10', strips_per_box: '10', purchase_price: '0', mrp: '0', selling_price: '0', low_stock_threshold: '10', image_url: '', reason: '', is_active: true,
};

export default function Medicines() {
  const { business } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('medicines');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cashSessions, setCashSessions] = useState<CashSession[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [roles, setRoles] = useState<RolePermission[]>([]);
  const [medicineModal, setMedicineModal] = useState(false);
  const [batchModal, setBatchModal] = useState(false);
  const [purchaseModal, setPurchaseModal] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const [customerModal, setCustomerModal] = useState(false);
  const [adjustModal, setAdjustModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const currency = business?.currency ?? 'BDT';

  const load = async () => {
    if (!business) return;
    setLoading(true);
    const [medRes, batchRes, supplierRes, purchaseRes, customerRes, moveRes, expenseRes, cashRes, branchRes, auditRes, roleRes] = await Promise.all([
      supabase.from('medicines').select('*').eq('business_id', business.id).order('name', { ascending: true }),
      supabase.from('medicine_batches').select('*').eq('business_id', business.id).order('expiry_date', { ascending: true }),
      supabase.from('suppliers').select('*').eq('business_id', business.id).order('name', { ascending: true }),
      supabase.from('purchases').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('customers').select('*').eq('business_id', business.id).order('name', { ascending: true }),
      supabase.from('stock_movements').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(250),
      supabase.from('expenses').select('*').eq('business_id', business.id).order('expense_date', { ascending: false }).limit(250),
      supabase.from('cash_sessions').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('branches').select('*').eq('business_id', business.id).order('name', { ascending: true }),
      supabase.from('audit_logs').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('role_permissions').select('*').eq('business_id', business.id).order('role', { ascending: true }),
    ]);
    setMedicines((medRes.data ?? []) as Medicine[]);
    setBatches((batchRes.data ?? []) as MedicineBatch[]);
    setSuppliers((supplierRes.data ?? []) as Supplier[]);
    setPurchases((purchaseRes.data ?? []) as Purchase[]);
    setCustomers((customerRes.data ?? []) as Customer[]);
    setMovements((moveRes.data ?? []) as StockMovement[]);
    setExpenses((expenseRes.data ?? []) as Expense[]);
    setCashSessions((cashRes.data ?? []) as CashSession[]);
    setBranches((branchRes.data ?? []) as Branch[]);
    setAuditLogs((auditRes.data ?? []) as AuditLog[]);
    setRoles((roleRes.data ?? []) as RolePermission[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [business]);

  const filteredMedicines = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return medicines;
    return medicines.filter((m) => [m.name, m.brand_name, m.generic_name, m.manufacturer, m.category, m.strength, m.sku, m.barcode, m.rack_location].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [medicines, search]);

  const stats = useMemo(() => {
    const low = medicines.filter((m) => Number(m.pieces || 0) <= Number(m.low_stock_threshold || 10));
    const activeBatches = batches.filter((b) => Number(b.quantity || 0) > 0 && b.status === 'active');
    const expired = activeBatches.filter((b) => daysUntil(b.expiry_date) < 0);
    const near30 = activeBatches.filter((b) => daysUntil(b.expiry_date) >= 0 && daysUntil(b.expiry_date) <= 30);
    const near90 = activeBatches.filter((b) => daysUntil(b.expiry_date) > 30 && daysUntil(b.expiry_date) <= 90);
    const near180 = activeBatches.filter((b) => daysUntil(b.expiry_date) > 90 && daysUntil(b.expiry_date) <= 180);
    const stockValue = activeBatches.reduce((sum, b) => sum + Number(b.quantity || 0) * Number(b.cost || b.purchase_price || 0), 0);
    const monthlyPurchases = purchases.reduce((sum, p) => sum + Number(p.total || 0), 0);
    const monthlyExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const supplierDue = suppliers.reduce((sum, s) => sum + Number(s.current_due || 0), 0);
    const customerDue = customers.reduce((sum, c) => sum + Number(c.current_due || 0), 0);
    return { low, expired, near30, near90, near180, stockValue, monthlyPurchases, monthlyExpenses, supplierDue, customerDue };
  }, [medicines, batches, purchases, expenses, suppliers, customers]);

  const tabs: { id: Tab; label: string; icon: typeof Pill }[] = [
    { id: 'medicines', label: 'Medicines', icon: Pill },
    { id: 'batches', label: 'Batches & FEFO', icon: Layers3 },
    { id: 'suppliers', label: 'Suppliers', icon: Truck },
    { id: 'purchases', label: 'Purchases', icon: ShoppingCart },
    { id: 'customers', label: 'Customers & dues', icon: Users },
    { id: 'stock', label: 'Stock ledger', icon: History },
    { id: 'cash', label: 'Cash register', icon: Banknote },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'branches', label: 'Branches', icon: Building2 },
    { id: 'access', label: 'Roles & audit', icon: ShieldCheck },
  ];

  if (loading) return <PageContainer><Spinner label="Loading pharmacy module…" /></PageContainer>;

  return (
    <PageContainer className="max-w-[1600px]">
      <PageHeader
        title="Pharmacy management"
        subtitle="Medicine-only inventory, batch-wise FEFO stock, suppliers, customers, dues, cash register, reports, branches, roles and audit logs."
        action={<Button onClick={load} variant="secondary"><RefreshCw className="h-4 w-4" /> Refresh</Button>}
      />

      {message && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <MiniStat label="Medicines" value={String(medicines.length)} icon={Pill} />
        <MiniStat label="Low stock" value={String(stats.low.length)} icon={AlertTriangle} tone="amber" />
        <MiniStat label="Expired" value={String(stats.expired.length)} icon={CalendarClock} tone="red" />
        <MiniStat label="Stock value" value={formatMoney(stats.stockValue, currency)} icon={Boxes} />
        <MiniStat label="Customer due" value={formatMoney(stats.customerDue, currency)} icon={CreditCard} tone="amber" />
      </div>

      <div className="mb-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2">
        <div className="flex gap-2 min-w-max">
          {tabs.map((t) => <TabButton key={t.id} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} icon={t.icon} label={t.label} />)}
        </div>
      </div>

      {activeTab === 'medicines' && (
        <Card className="overflow-hidden">
          <SectionHeader title="Medicine management" subtitle="Brand, generic, manufacturer, category, strength, dosage form, barcode, SKU, rack, price and stock alerts." action={<Button onClick={() => setMedicineModal(true)}><Plus className="h-4 w-4" /> Add medicine</Button>} />
          <div className="p-4 border-b border-slate-200">
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, brand, generic, barcode, SKU, rack…" className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-2.5 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="text-left px-4 py-3">Medicine</th><th className="text-left px-4 py-3">Category</th><th className="text-left px-4 py-3">Rack</th><th className="text-right px-4 py-3">Stock</th><th className="text-right px-4 py-3">Purchase</th><th className="text-right px-4 py-3">MRP</th><th className="text-right px-4 py-3">Selling</th><th className="text-left px-4 py-3">Barcode/SKU</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMedicines.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-[280px]">
                        <div className="h-11 w-11 rounded-xl bg-rose-50 grid place-items-center overflow-hidden shrink-0">{m.image_url ? <img src={m.image_url} className="h-full w-full object-cover" /> : <Pill className="h-5 w-5 text-rose-500" />}</div>
                        <div className="min-w-0"><p className="font-bold text-slate-900 truncate">{m.name}</p><p className="text-xs text-slate-500 truncate">{m.brand_name || 'No brand'} · {m.generic_name || 'No generic'} · {m.strength || 'No strength'}{m.pack_size ? ` · ${m.pack_size}` : ''}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.category || m.medicine_type}</td>
                    <td className="px-4 py-3 text-slate-600">{m.rack_location || 'N/A'}</td>
                    <td className="px-4 py-3 text-right"><span className={classNames('font-bold', Number(m.pieces) <= Number(m.low_stock_threshold || 10) ? 'text-rose-600' : 'text-slate-900')}>{m.pieces}</span></td>
                    <td className="px-4 py-3 text-right">{formatMoney(Number(m.purchase_price || m.cost || 0), currency)}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(Number(m.mrp || 0), currency)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatMoney(Number(m.selling_price || m.price || 0), currency)}</td>
                    <td className="px-4 py-3 text-slate-500"><div className="flex items-center gap-1"><BarcodeIcon className="h-3.5 w-3.5" />{m.barcode || m.sku || 'N/A'}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredMedicines.length === 0 && <EmptyState icon={Pill} title="No medicines found" description="Add pharmacy medicines before using the fast POS." />}
          </div>
        </Card>
      )}

      {activeTab === 'batches' && (
        <Card className="overflow-hidden">
          <SectionHeader title="Batch-wise inventory & FEFO" subtitle="Every sale deducts stock from the batch expiring first. Alerts are shown for 30, 90 and 180 days." action={<Button onClick={() => setBatchModal(true)}><Plus className="h-4 w-4" /> Add batch</Button>} />
          <BatchTable batches={batches} medicines={medicines} currency={currency} />
        </Card>
      )}

      {activeTab === 'suppliers' && (
        <Card className="overflow-hidden">
          <SectionHeader title="Supplier management" subtitle="Supplier profiles, dues and supplier payments." action={<Button onClick={() => setSupplierModal(true)}><Plus className="h-4 w-4" /> Add supplier</Button>} />
          <SimpleTable empty="No suppliers yet" rows={suppliers.map((s) => [s.name, s.phone || 'N/A', s.email || 'N/A', formatMoney(Number(s.current_due || 0), currency), s.is_active ? 'Active' : 'Inactive'])} headers={['Supplier', 'Phone', 'Email', 'Current due', 'Status']} />
        </Card>
      )}

      {activeTab === 'purchases' && (
        <Card className="overflow-hidden">
          <SectionHeader title="Purchases & purchase returns" subtitle="Receive medicine purchases, batch stock and supplier dues." action={<Button onClick={() => setPurchaseModal(true)}><Plus className="h-4 w-4" /> Receive purchase</Button>} />
          <SimpleTable empty="No purchases yet" rows={purchases.map((p) => [p.invoice_no || p.id.slice(-6), p.supplier_name || suppliers.find((s) => s.id === p.supplier_id)?.name || 'N/A', p.purchase_date || formatShortDate(p.created_at), formatMoney(Number(p.total || 0), currency), formatMoney(Number(p.due || 0), currency), p.status])} headers={['Invoice', 'Supplier', 'Date', 'Total', 'Due', 'Status']} />
        </Card>
      )}

      {activeTab === 'customers' && (
        <Card className="overflow-hidden">
          <SectionHeader title="Customers, prescriptions & dues" subtitle="Customer profiles, prescription notes, due sales and sale returns." action={<Button onClick={() => setCustomerModal(true)}><Plus className="h-4 w-4" /> Add customer</Button>} />
          <SimpleTable empty="No customers yet" rows={customers.map((c) => [c.name, c.phone || 'N/A', c.address || 'N/A', formatMoney(Number(c.current_due || 0), currency), c.notes || ''])} headers={['Customer', 'Phone', 'Address', 'Due', 'Notes']} />
        </Card>
      )}

      {activeTab === 'stock' && (
        <Card className="overflow-hidden">
          <SectionHeader title="Stock movement ledger" subtitle="Purchases, FEFO sales, adjustments, damaged/expired stock and transfers." action={<Button onClick={() => setAdjustModal(true)}><Plus className="h-4 w-4" /> Stock adjustment</Button>} />
          <SimpleTable empty="No stock movements yet" rows={movements.map((m) => [formatShortDate(m.created_at), medicines.find((x) => x.id === m.medicine_id)?.name || 'Medicine', m.movement_type, String(m.quantity), String(m.after_quantity), m.note || ''])} headers={['Date', 'Medicine', 'Type', 'Qty', 'After', 'Note']} />
        </Card>
      )}

      {activeTab === 'cash' && <CashRegister currency={currency} sessions={cashSessions} reload={load} setMessage={setMessage} />}
      {activeTab === 'reports' && <Reports currency={currency} medicines={medicines} batches={batches} purchases={purchases} expenses={expenses} suppliers={suppliers} customers={customers} stats={stats} />}
      {activeTab === 'branches' && <Branches branches={branches} medicines={medicines} batches={batches} reload={load} setMessage={setMessage} />}
      {activeTab === 'access' && <Access roles={roles} logs={auditLogs} reload={load} setMessage={setMessage} />}

      <MedicineModal open={medicineModal} onClose={() => setMedicineModal(false)} onSaved={() => { setMedicineModal(false); load(); setMessage('Medicine saved successfully.'); }} />
      <BatchModal open={batchModal} onClose={() => setBatchModal(false)} medicines={medicines} suppliers={suppliers} onSaved={() => { setBatchModal(false); load(); setMessage('Batch added successfully.'); }} />
      <SupplierModal open={supplierModal} onClose={() => setSupplierModal(false)} onSaved={() => { setSupplierModal(false); load(); setMessage('Supplier saved successfully.'); }} />
      <CustomerModal open={customerModal} onClose={() => setCustomerModal(false)} onSaved={() => { setCustomerModal(false); load(); setMessage('Customer saved successfully.'); }} />
      <PurchaseModal open={purchaseModal} onClose={() => setPurchaseModal(false)} medicines={medicines} suppliers={suppliers} onSaved={() => { setPurchaseModal(false); load(); setMessage('Purchase received and batch stock updated.'); }} />
      <AdjustModal open={adjustModal} onClose={() => setAdjustModal(false)} medicines={medicines} batches={batches} busy={busy} setBusy={setBusy} onSaved={() => { setAdjustModal(false); load(); setMessage('Stock adjustment recorded.'); }} />
    </PageContainer>
  );
}

function MiniStat({ label, value, icon: Icon, tone = 'slate' }: { label: string; value: string; icon: typeof Pill; tone?: 'slate' | 'amber' | 'red' }) {
  const cls = tone === 'red' ? 'bg-rose-50 text-rose-600' : tone === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-700';
  return <Card className="p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-lg font-extrabold text-slate-900">{value}</p></div><div className={classNames('h-10 w-10 rounded-xl grid place-items-center', cls)}><Icon className="h-5 w-5" /></div></div></Card>;
}
function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Pill; label: string }) { return <button onClick={onClick} className={classNames('inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all', active ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100')}><Icon className="h-4 w-4" />{label}</button>; }
function SectionHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) { return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><div><h2 className="font-extrabold text-slate-900">{title}</h2><p className="text-sm text-slate-500 mt-0.5">{subtitle}</p></div>{action}</div>; }
function Input({ label, value, onChange, type = 'text', required, placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string }) { return <label className="block"><span className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</span><input required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" /></label>; }
function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) { return <label className="block"><span className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100">{children}</select></label>; }

function MedicineModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { business } = useAuth();
  const [form, setForm] = useState({ ...emptyMedicine });
  const [saving, setSaving] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const asText = (value: unknown) => (value === undefined || value === null ? '' : String(value));

  const applyMedicineDetails = (medicine: Partial<Medicine>, scannedCode: string, source: string | null) => {
    setForm((current) => ({
      ...current,
      barcode: asText(medicine.barcode) || scannedCode || current.barcode,
      sku: asText(medicine.sku) || current.sku,
      name: asText(medicine.name) || current.name,
      brand_name: asText(medicine.brand_name) || current.brand_name,
      generic_name: asText(medicine.generic_name) || current.generic_name,
      manufacturer: asText(medicine.manufacturer) || current.manufacturer,
      category: asText(medicine.category) || current.category,
      strength: asText(medicine.strength) || current.strength,
      dosage_form: asText(medicine.dosage_form) || current.dosage_form,
      medicine_type: asText(medicine.medicine_type) || asText(medicine.dosage_form) || current.medicine_type,
      pack_size: asText(medicine.pack_size) || current.pack_size,
      pieces_per_strip: medicine.pieces_per_strip !== undefined && medicine.pieces_per_strip !== null ? String(medicine.pieces_per_strip) : current.pieces_per_strip,
      strips_per_box: medicine.strips_per_box !== undefined && medicine.strips_per_box !== null ? String(medicine.strips_per_box) : current.strips_per_box,
      mrp: medicine.mrp !== undefined && medicine.mrp !== null && Number(medicine.mrp) > 0 ? String(medicine.mrp) : current.mrp,
      selling_price: medicine.selling_price !== undefined && medicine.selling_price !== null && Number(medicine.selling_price) > 0 ? String(medicine.selling_price) : current.selling_price,
    }));
    const label = source === 'business_medicine' ? 'from your saved medicines' : source === 'qr_payload' ? 'from the scanned QR payload' : 'from the medicine catalog';
    setLookupMessage(`Medicine details filled ${label}.`);
  };

  const lookupCode = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    set('barcode', trimmed);
    setLookupLoading(true);
    setLookupMessage(null);
    try {
      const { data, error } = await supabase.pharmacy.lookupCode(trimmed);
      if (error) throw error;
      if (data?.found && data.medicine) applyMedicineDetails(data.medicine, trimmed, data.source);
      else setLookupMessage('No master data found for this code. Fill the details once and the code will auto-fill next time.');
    } catch (err) {
      setLookupMessage(err instanceof Error ? err.message : 'Barcode lookup failed.');
    } finally {
      setLookupLoading(false);
      setScanOpen(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!business) return; setSaving(true);
    const payload = {
      business_id: business.id, name: form.name.trim(), brand_name: form.brand_name || null, generic_name: form.generic_name || null, manufacturer: form.manufacturer || null, category: form.category || null,
      strength: form.strength || null, dosage_form: form.dosage_form || null, medicine_type: form.medicine_type, pack_size: form.pack_size || null, sku: form.sku || null, barcode: form.barcode || form.sku || null, rack_location: form.rack_location || null,
      pieces: 0, pieces_per_strip: Number(form.pieces_per_strip) || 10, strips_per_box: Number(form.strips_per_box) || 10,
      purchase_price: Number(form.purchase_price) || 0, cost: Number(form.purchase_price) || 0, mrp: Number(form.mrp) || 0, selling_price: Number(form.selling_price) || 0, price: Number(form.selling_price) || 0,
      low_stock_threshold: Number(form.low_stock_threshold) || 10, image_url: form.image_url || null, reason: form.reason || null, expiry_date: '2099-12-31', expiry_alert_days: 30, is_active: true,
    };
    const { error } = await supabase.from('medicines').insert(payload).select().single();
    setSaving(false); if (error) alert(error.message); else { setForm({ ...emptyMedicine }); setLookupMessage(null); onSaved(); }
  };

  return <Modal open={open} onClose={onClose} title="Add pharmacy medicine" size="xl"><form onSubmit={submit} className="p-5 space-y-4">
    <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-slate-900">Scan medicine barcode / QR</h3>
          <p className="text-sm text-slate-600">Scan the medicine box code to auto-fill product name, company, generic, strength and pack size when data is available.</p>
        </div>
        <Button type="button" onClick={() => setScanOpen(true)}><BarcodeIcon className="h-4 w-4" /> Scan code</Button>
      </div>
      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <input value={form.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder="Scan or type barcode / QR code" className="flex-1 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-mono outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
        <Button type="button" variant="secondary" onClick={() => lookupCode(form.barcode)} disabled={lookupLoading || !form.barcode.trim()}>{lookupLoading ? 'Checking…' : 'Lookup'}</Button>
      </div>
      {lookupMessage && <p className="mt-2 text-xs font-semibold text-slate-600">{lookupMessage}</p>}
    </div>

    <ImageDropzone value={form.image_url || null} onChange={(url) => set('image_url', url || '')} label="Medicine photo" accent="rose" />
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input required label="Medicine product name" value={form.name} onChange={(v) => set('name', v)} /><Input label="Brand name" value={form.brand_name} onChange={(v) => set('brand_name', v)} /></div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Input label="Generic name" value={form.generic_name} onChange={(v) => set('generic_name', v)} /><Input label="Manufacturer company" value={form.manufacturer} onChange={(v) => set('manufacturer', v)} /><Select label="Category" value={form.category} onChange={(v) => set('category', v)}>{MEDICINE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></div>
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3"><Input label="Strength" value={form.strength} onChange={(v) => set('strength', v)} placeholder="500mg" /><Input label="Pack size" value={form.pack_size} onChange={(v) => set('pack_size', v)} placeholder="10 strips x 10 tablets" /><Select label="Dosage form" value={form.dosage_form} onChange={(v) => set('dosage_form', v)}>{DOSAGE_FORMS.map((c) => <option key={c}>{c}</option>)}</Select><Select label="Medicine type" value={form.medicine_type} onChange={(v) => set('medicine_type', v)}>{MEDICINE_TYPES.map((c) => <option key={c}>{c}</option>)}</Select></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input label="SKU" value={form.sku} onChange={(v) => set('sku', v)} /><Input label="Rack location" value={form.rack_location} onChange={(v) => set('rack_location', v)} placeholder="A-01" /></div>
    <div className="grid grid-cols-2 sm:grid-cols-6 gap-3"><Input type="number" label="Purchase price" value={form.purchase_price} onChange={(v) => set('purchase_price', v)} /><Input type="number" label="MRP" value={form.mrp} onChange={(v) => set('mrp', v)} /><Input type="number" label="Selling price" value={form.selling_price} onChange={(v) => set('selling_price', v)} /><Input type="number" label="Pieces/strip" value={form.pieces_per_strip} onChange={(v) => set('pieces_per_strip', v)} /><Input type="number" label="Strips/box" value={form.strips_per_box} onChange={(v) => set('strips_per_box', v)} /><Input type="number" label="Low stock alert" value={form.low_stock_threshold} onChange={(v) => set('low_stock_threshold', v)} /></div>
    <Input label="Indication / note" value={form.reason} onChange={(v) => set('reason', v)} />
    <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save medicine'}</Button></div>
    <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onDetected={lookupCode} />
  </form></Modal>;
}

function BatchModal({ open, onClose, medicines, suppliers, onSaved }: { open: boolean; onClose: () => void; medicines: Medicine[]; suppliers: Supplier[]; onSaved: () => void }) {
  const { business } = useAuth();
  const [form, setForm] = useState({ medicine_id: '', supplier_id: '', batch_number: '', manufacturing_date: '', expiry_date: '', quantity: '0', cost: '0', selling_price: '0' });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async (e: FormEvent) => { e.preventDefault(); if (!business || !form.medicine_id) return; const med = medicines.find((m) => m.id === form.medicine_id); const payload = { business_id: business.id, medicine_id: form.medicine_id, supplier_id: form.supplier_id || null, batch_number: form.batch_number, manufacturing_date: form.manufacturing_date || null, expiry_date: form.expiry_date, quantity: Number(form.quantity) || 0, cost: Number(form.cost) || 0, purchase_price: Number(form.cost) || 0, selling_price: Number(form.selling_price || med?.selling_price || med?.price || 0), status: 'active' }; const { error } = await supabase.from('medicine_batches').insert(payload).select().single(); if (error) alert(error.message); else { const qty = Number(form.quantity) || 0; const current = Number(med?.pieces || 0); await supabase.from('medicines').update({ pieces: current + qty, updated_at: new Date().toISOString() }).eq('id', form.medicine_id); onSaved(); } };
  return <Modal open={open} onClose={onClose} title="Add medicine batch" size="lg"><form onSubmit={submit} className="p-5 space-y-4"><Select label="Medicine" value={form.medicine_id} onChange={(v) => set('medicine_id', v)}><option value="">Select medicine</option>{medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Select label="Supplier" value={form.supplier_id} onChange={(v) => set('supplier_id', v)}><option value="">No supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select><Input required label="Batch number" value={form.batch_number} onChange={(v) => set('batch_number', v)} /></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input type="date" label="Manufacturing date" value={form.manufacturing_date} onChange={(v) => set('manufacturing_date', v)} /><Input required type="date" label="Expiry date" value={form.expiry_date} onChange={(v) => set('expiry_date', v)} /></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Input type="number" label="Quantity pieces" value={form.quantity} onChange={(v) => set('quantity', v)} /><Input type="number" label="Cost per piece" value={form.cost} onChange={(v) => set('cost', v)} /><Input type="number" label="Selling price" value={form.selling_price} onChange={(v) => set('selling_price', v)} /></div><div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save batch</Button></div></form></Modal>;
}

function SupplierModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) { const { business } = useAuth(); const [f,setF]=useState({name:'',phone:'',email:'',address:'',opening_due:'0'}); const set=(k:keyof typeof f,v:string)=>setF(x=>({...x,[k]:v})); const submit=async(e:FormEvent)=>{e.preventDefault(); if(!business)return; const {error}=await supabase.from('suppliers').insert({business_id:business.id,...f,opening_due:Number(f.opening_due)||0,current_due:Number(f.opening_due)||0,is_active:true}).select().single(); if(error)alert(error.message); else onSaved();}; return <Modal open={open} onClose={onClose} title="Add supplier" size="lg"><form onSubmit={submit} className="p-5 space-y-4"><Input required label="Supplier name" value={f.name} onChange={v=>set('name',v)} /><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input label="Phone" value={f.phone} onChange={v=>set('phone',v)} /><Input label="Email" value={f.email} onChange={v=>set('email',v)} /></div><Input label="Address" value={f.address} onChange={v=>set('address',v)} /><Input type="number" label="Opening due" value={f.opening_due} onChange={v=>set('opening_due',v)} /><div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save supplier</Button></div></form></Modal>; }
function CustomerModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) { const { business } = useAuth(); const [f,setF]=useState({name:'',phone:'',address:'',current_due:'0',notes:''}); const set=(k:keyof typeof f,v:string)=>setF(x=>({...x,[k]:v})); const submit=async(e:FormEvent)=>{e.preventDefault(); if(!business)return; const {error}=await supabase.from('customers').insert({business_id:business.id,name:f.name,phone:f.phone||null,address:f.address||null,current_due:Number(f.current_due)||0,notes:f.notes||null}).select().single(); if(error)alert(error.message); else onSaved();}; return <Modal open={open} onClose={onClose} title="Add customer" size="lg"><form onSubmit={submit} className="p-5 space-y-4"><Input required label="Customer name" value={f.name} onChange={v=>set('name',v)} /><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input label="Phone" value={f.phone} onChange={v=>set('phone',v)} /><Input type="number" label="Opening due" value={f.current_due} onChange={v=>set('current_due',v)} /></div><Input label="Address" value={f.address} onChange={v=>set('address',v)} /><Input label="Prescription / note" value={f.notes} onChange={v=>set('notes',v)} /><div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Save customer</Button></div></form></Modal>; }
function PurchaseModal({ open, onClose, medicines, suppliers, onSaved }: { open: boolean; onClose: () => void; medicines: Medicine[]; suppliers: Supplier[]; onSaved: () => void }) { const [f,setF]=useState({supplier_id:'',medicine_id:'',invoice_no:'',purchase_date:today(),batch_number:'',manufacturing_date:'',expiry_date:'',quantity:'0',unit_cost:'0',selling_price:'0',paid:'0',discount:'0'}); const set=(k:keyof typeof f,v:string)=>setF(x=>({...x,[k]:v})); const submit=async(e:FormEvent)=>{e.preventDefault(); const supplier=suppliers.find(s=>s.id===f.supplier_id); const {error}=await supabase.pharmacy.receivePurchase({supplier_id:f.supplier_id||null,supplier_name:supplier?.name||null,invoice_no:f.invoice_no,purchase_date:f.purchase_date,paid:Number(f.paid)||0,discount:Number(f.discount)||0,items:[{medicine_id:f.medicine_id,batch_number:f.batch_number,manufacturing_date:f.manufacturing_date,expiry_date:f.expiry_date,quantity:Number(f.quantity)||0,unit_cost:Number(f.unit_cost)||0,selling_price:Number(f.selling_price)||0}]}); if(error)alert(error.message); else onSaved();}; return <Modal open={open} onClose={onClose} title="Receive purchase" size="xl"><form onSubmit={submit} className="p-5 space-y-4"><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Select label="Supplier" value={f.supplier_id} onChange={v=>set('supplier_id',v)}><option value="">Walk-in supplier</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select><Input label="Invoice no" value={f.invoice_no} onChange={v=>set('invoice_no',v)} /><Input type="date" label="Purchase date" value={f.purchase_date} onChange={v=>set('purchase_date',v)} /></div><Select label="Medicine" value={f.medicine_id} onChange={v=>set('medicine_id',v)}><option value="">Select medicine</option>{medicines.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</Select><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Input required label="Batch number" value={f.batch_number} onChange={v=>set('batch_number',v)} /><Input type="date" label="Manufacturing date" value={f.manufacturing_date} onChange={v=>set('manufacturing_date',v)} /><Input required type="date" label="Expiry date" value={f.expiry_date} onChange={v=>set('expiry_date',v)} /></div><div className="grid grid-cols-2 sm:grid-cols-5 gap-3"><Input type="number" label="Quantity" value={f.quantity} onChange={v=>set('quantity',v)} /><Input type="number" label="Unit cost" value={f.unit_cost} onChange={v=>set('unit_cost',v)} /><Input type="number" label="Selling price" value={f.selling_price} onChange={v=>set('selling_price',v)} /><Input type="number" label="Paid" value={f.paid} onChange={v=>set('paid',v)} /><Input type="number" label="Discount" value={f.discount} onChange={v=>set('discount',v)} /></div><div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Receive purchase</Button></div></form></Modal>; }

function AdjustModal({ open, onClose, medicines, batches, busy, setBusy, onSaved }: { open: boolean; onClose: () => void; medicines: Medicine[]; batches: MedicineBatch[]; busy: boolean; setBusy: (v: boolean) => void; onSaved: () => void }) { const { business }=useAuth(); const [f,setF]=useState({medicine_id:'',batch_id:'',adjustment_type:'decrease',quantity:'0',reason:''}); const set=(k:keyof typeof f,v:string)=>setF(x=>({...x,[k]:v})); const relevant=batches.filter(b=>!f.medicine_id||b.medicine_id===f.medicine_id); const submit=async(e:FormEvent)=>{e.preventDefault(); if(!business)return; setBusy(true); const batch=batches.find(b=>b.id===f.batch_id); const qty=Number(f.quantity)||0; await supabase.from('stock_adjustments').insert({business_id:business.id,medicine_id:f.medicine_id,batch_id:f.batch_id||null,adjustment_type:f.adjustment_type,quantity:qty,reason:f.reason||null}).select().single(); if(batch){ const next=f.adjustment_type==='increase'?Number(batch.quantity)+qty:Math.max(0,Number(batch.quantity)-qty); await supabase.from('medicine_batches').update({quantity:next,status: next<=0 && ['damage','expired','decrease'].includes(f.adjustment_type) ? (f.adjustment_type==='expired'?'expired':f.adjustment_type==='damage'?'damaged':'sold_out') : batch.status}).eq('id',batch.id); await supabase.from('stock_movements').insert({business_id:business.id,medicine_id:f.medicine_id,batch_id:batch.id,movement_type:f.adjustment_type==='increase'?'adjustment':f.adjustment_type,quantity:f.adjustment_type==='increase'?qty:-qty,before_quantity:batch.quantity,after_quantity:next,note:f.reason||null}).select().single(); } setBusy(false); onSaved();}; return <Modal open={open} onClose={onClose} title="Stock adjustment" size="lg"><form onSubmit={submit} className="p-5 space-y-4"><Select label="Medicine" value={f.medicine_id} onChange={v=>set('medicine_id',v)}><option value="">Select medicine</option>{medicines.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</Select><Select label="Batch" value={f.batch_id} onChange={v=>set('batch_id',v)}><option value="">Select batch</option>{relevant.map(b=><option key={b.id} value={b.id}>{b.batch_number} · {b.quantity} pcs · exp {b.expiry_date}</option>)}</Select><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Select label="Adjustment type" value={f.adjustment_type} onChange={v=>set('adjustment_type',v)}><option value="increase">Increase</option><option value="decrease">Decrease</option><option value="damage">Damaged stock</option><option value="expired">Expired stock</option></Select><Input type="number" label="Quantity" value={f.quantity} onChange={v=>set('quantity',v)} /></div><Input label="Reason" value={f.reason} onChange={v=>set('reason',v)} /><div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy?'Saving…':'Save adjustment'}</Button></div></form></Modal>; }

function BatchTable({ batches, medicines, currency }: { batches: MedicineBatch[]; medicines: Medicine[]; currency: string }) { return <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left px-4 py-3">Batch</th><th className="text-left px-4 py-3">Medicine</th><th className="text-left px-4 py-3">Mfg</th><th className="text-left px-4 py-3">Expiry</th><th className="text-right px-4 py-3">Qty</th><th className="text-right px-4 py-3">Cost</th><th className="text-right px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{batches.map(b=>{const d=daysUntil(b.expiry_date); const badge=expiryBadge(d); return <tr key={b.id}><td className="px-4 py-3 font-bold text-slate-900">{b.batch_number}</td><td className="px-4 py-3 text-slate-600">{medicines.find(m=>m.id===b.medicine_id)?.name||'Medicine'}</td><td className="px-4 py-3 text-slate-500">{b.manufacturing_date||'N/A'}</td><td className="px-4 py-3 text-slate-600">{formatShortDate(b.expiry_date)}</td><td className="px-4 py-3 text-right font-semibold">{b.quantity}</td><td className="px-4 py-3 text-right">{formatMoney(Number(b.cost||0),currency)}</td><td className="px-4 py-3 text-right"><Badge color={badge.color}>{badge.label}</Badge></td></tr>})}</tbody></table>{batches.length===0&&<EmptyState icon={Layers3} title="No batches yet" description="Add batch-wise inventory to enable FEFO selling." />}</div>; }
function SimpleTable({ headers, rows, empty }: { headers: string[]; rows: (string | number)[][]; empty: string }) { return <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{headers.map(h=><th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j} className="px-4 py-3 text-slate-700 whitespace-nowrap">{c}</td>)}</tr>)}</tbody></table>{rows.length===0&&<EmptyState icon={ClipboardList} title={empty} />}</div>; }
function CashRegister({ currency, sessions, reload, setMessage }: { currency: string; sessions: CashSession[]; reload: () => void; setMessage: (m: string) => void }) { const {business}=useAuth(); const openSession=sessions.find(s=>s.status==='open'); const [opening,setOpening]=useState('0'); const [counted,setCounted]=useState('0'); const open=async()=>{if(!business)return; await supabase.from('cash_sessions').insert({business_id:business.id,opening_cash:Number(opening)||0,expected_cash:Number(opening)||0,status:'open'}); setMessage('Cash register opened.'); reload();}; const close=async()=>{if(!openSession)return; const diff=(Number(counted)||0)-Number(openSession.expected_cash||0); await supabase.from('cash_sessions').update({status:'closed',closed_at:new Date().toISOString(),counted_cash:Number(counted)||0,difference:diff}).eq('id',openSession.id); setMessage('Cash register closed and reconciled.'); reload();}; return <Card className="p-5"><SectionHeader title="Cash register & cashier reconciliation" subtitle="Open/close counter cash and record differences." /><div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5"><Card className="p-4"><h3 className="font-bold mb-3">Current register</h3>{openSession?<><p className="text-sm text-slate-600">Opened: {formatShortDate(openSession.opened_at)}</p><p className="mt-2 text-xl font-extrabold">Expected {formatMoney(Number(openSession.expected_cash||0),currency)}</p><Input type="number" label="Counted cash" value={counted} onChange={setCounted}/><Button className="mt-3" onClick={close}>Close register</Button></>:<><Input type="number" label="Opening cash" value={opening} onChange={setOpening}/><Button className="mt-3" onClick={open}>Open register</Button></>}</Card><Card className="p-4"><h3 className="font-bold mb-3">Recent sessions</h3><div className="space-y-2">{sessions.map(s=><div key={s.id} className="rounded-xl border border-slate-200 p-3 flex justify-between text-sm"><span>{s.status}</span><span>{formatMoney(Number(s.difference||0),currency)}</span></div>)}</div></Card></div></Card>; }
function Reports({ currency, stats, purchases, expenses, suppliers, customers }: { currency: string; medicines: Medicine[]; batches: MedicineBatch[]; purchases: Purchase[]; expenses: Expense[]; suppliers: Supplier[]; customers: Customer[]; stats: any }) { const cards=[['Inventory valuation',formatMoney(stats.stockValue,currency)],['Purchases',formatMoney(stats.monthlyPurchases,currency)],['Expenses',formatMoney(stats.monthlyExpenses,currency)],['Supplier dues',formatMoney(stats.supplierDue,currency)],['Customer dues',formatMoney(stats.customerDue,currency)],['Expired batches',String(stats.expired.length)],['30-day expiry',String(stats.near30.length)],['90-day expiry',String(stats.near90.length)],['180-day expiry',String(stats.near180.length)],['Purchase invoices',String(purchases.length)],['Expense records',String(expenses.length)],['Suppliers',String(suppliers.length)],['Customers',String(customers.length)]]; return <Card className="p-5"><SectionHeader title="Reports" subtitle="Sales, profit, purchases, inventory, expiry, stock valuation, returns, expenses and dues." /><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">{cards.map(([a,b])=><div key={a} className="rounded-xl border border-slate-200 p-4"><p className="text-xs uppercase font-semibold text-slate-500">{a}</p><p className="mt-1 text-lg font-extrabold text-slate-900">{b}</p></div>)}</div></Card>; }
function Branches({ branches, medicines, batches, reload, setMessage }: { branches: Branch[]; medicines: Medicine[]; batches: MedicineBatch[]; reload: () => void; setMessage: (m: string) => void }) { const {business}=useAuth(); const [name,setName]=useState(''); const [transfer,setTransfer]=useState({from_branch_id:'',to_branch_id:'',medicine_id:'',batch_id:'',quantity:'0'}); const create=async()=>{if(!business||!name)return; await supabase.from('branches').insert({business_id:business.id,name,is_active:true}); setName('');setMessage('Branch added.');reload();}; const saveTransfer=async()=>{if(!business)return; await supabase.from('stock_transfers').insert({business_id:business.id,...transfer,quantity:Number(transfer.quantity)||0,status:'pending'}); setMessage('Branch stock transfer created.');reload();}; const relevant=batches.filter(b=>!transfer.medicine_id||b.medicine_id===transfer.medicine_id); return <Card className="p-5"><SectionHeader title="Multi-branch support" subtitle="Manage branches and create branch-to-branch stock transfers." /><div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5"><div><div className="flex gap-2"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Branch name" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"/><Button onClick={create}>Add branch</Button></div><div className="mt-3 space-y-2">{branches.map(b=><div key={b.id} className="rounded-xl border border-slate-200 p-3 flex items-center gap-2"><Store className="h-4 w-4 text-slate-400"/><span className="font-semibold text-sm">{b.name}</span></div>)}</div></div><div className="space-y-3"><Select label="From branch" value={transfer.from_branch_id} onChange={v=>setTransfer(x=>({...x,from_branch_id:v}))}><option value="">Main</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</Select><Select label="To branch" value={transfer.to_branch_id} onChange={v=>setTransfer(x=>({...x,to_branch_id:v}))}><option value="">Select branch</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</Select><Select label="Medicine" value={transfer.medicine_id} onChange={v=>setTransfer(x=>({...x,medicine_id:v}))}><option value="">Select medicine</option>{medicines.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</Select><Select label="Batch" value={transfer.batch_id} onChange={v=>setTransfer(x=>({...x,batch_id:v}))}><option value="">Select batch</option>{relevant.map(b=><option key={b.id} value={b.id}>{b.batch_number}</option>)}</Select><Input type="number" label="Quantity" value={transfer.quantity} onChange={v=>setTransfer(x=>({...x,quantity:v}))}/><Button onClick={saveTransfer}><ArrowLeftRight className="h-4 w-4"/> Create transfer</Button></div></div></Card>; }
function Access({ roles, logs, reload, setMessage }: { roles: RolePermission[]; logs: AuditLog[]; reload: () => void; setMessage: (m: string) => void }) { const {business}=useAuth(); const [role,setRole]=useState('Cashier'); const [perms,setPerms]=useState('pos,sales,customers'); const create=async()=>{if(!business)return; await supabase.from('role_permissions').insert({business_id:business.id,role,permissions:perms.split(',').map(p=>p.trim()).filter(Boolean),is_active:true}); setMessage('Role permission saved.');reload();}; return <Card className="p-5"><SectionHeader title="Role-based permissions & audit logs" subtitle="Define roles and review critical pharmacy actions." /><div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5"><Card className="p-4"><h3 className="font-bold mb-3 flex gap-2 items-center"><LockKeyhole className="h-4 w-4"/> Roles</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><Input label="Role" value={role} onChange={setRole}/><Input label="Permissions CSV" value={perms} onChange={setPerms}/></div><Button className="mt-3" onClick={create}>Save role</Button><div className="mt-3 space-y-2">{roles.map(r=><div key={r.id} className="rounded-xl border border-slate-200 p-3"><p className="font-bold text-sm">{r.role}</p><p className="text-xs text-slate-500">{r.permissions.join(', ')}</p></div>)}</div></Card><Card className="p-4"><h3 className="font-bold mb-3 flex gap-2 items-center"><Activity className="h-4 w-4"/> Audit logs</h3><div className="space-y-2 max-h-96 overflow-y-auto">{logs.map(l=><div key={l.id} className="rounded-xl border border-slate-200 p-3"><p className="font-bold text-sm">{l.action}</p><p className="text-xs text-slate-500">{l.resource || 'system'} · {formatShortDate(l.created_at)}</p></div>)}</div></Card></div></Card>; }
