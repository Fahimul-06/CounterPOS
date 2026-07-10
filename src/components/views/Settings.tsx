import { useEffect, useState, FormEvent } from 'react';
import {
  Store,
  User as UserIcon,
  Phone,
  MapPin,
  Mail,
  Percent,
  Coins,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Utensils,
  ShoppingBag,
  Pill,
  Shirt,
  Lock,
  Truck,
  MapPinned,
  Receipt,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { BusinessCategory } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { CATEGORY_META, classNames } from '../../lib/utils';
import { PageContainer, PageHeader, Card, Button, Spinner } from '../ui/Shared';
import ImageDropzone from '../ui/ImageDropzone';

const CATEGORY_ICONS: Record<BusinessCategory, typeof Utensils> = {
  restaurant: Utensils,
  shop: ShoppingBag,
  pharmacy: Pill,
  departmental_store: Building2,
  clothing: Shirt,
};

const CURRENCIES = ['BDT', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR', 'NGN', 'BRL', 'ZAR', 'AED', 'SAR', 'SGD', 'KES', 'GHS', 'PKR', 'LKR', 'NPR'];

export default function Settings() {
  const { business, user, refreshBusiness } = useAuth();
  const [form, setForm] = useState({
    owner_name: '',
    phone: '',
    business_name: '',
    category: '' as BusinessCategory | '',
    address: '',
    currency: 'BDT',
    tax_rate: '0',
    service_charge_rate: '0',
    vat_rate: '0',
    delivery_charge: '0',
    service_area: '',
    tax_zone: '',
    receipt_message: '',
    logo_url: '' as string | null,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);

  useEffect(() => {
    if (business) {
      setForm({
        owner_name: business.owner_name,
        phone: business.phone,
        business_name: business.business_name,
        category: business.category,
        address: business.address,
        currency: business.currency,
        tax_rate: String(business.tax_rate ?? 0),
        service_charge_rate: String(business.service_charge_rate ?? 0),
        vat_rate: String(business.vat_rate ?? 0),
        delivery_charge: String(business.delivery_charge ?? 0),
        service_area: business.service_area ?? '',
        tax_zone: business.tax_zone ?? '',
        receipt_message: business.receipt_message ?? '',
        logo_url: business.logo_url ?? '',
      });
      setLoading(false);
    }
  }, [business]);

  const update = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
    setError(null);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!business) return;
    setError(null);
    setSaving(true);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          owner_name: form.owner_name.trim(),
          phone: form.phone.trim(),
          business_name: form.business_name.trim(),
          address: form.address.trim(),
          currency: form.currency,
          tax_rate: Number(form.tax_rate) || 0,
          service_charge_rate: Number(form.service_charge_rate) || 0,
          vat_rate: Number(form.vat_rate) || 0,
          delivery_charge: Number(form.delivery_charge) || 0,
          service_area: form.service_area.trim() || null,
          tax_zone: form.tax_zone.trim() || null,
          receipt_message: form.receipt_message.trim() || null,
          logo_url: form.logo_url || null,
        })
        .eq('id', business.id);
      if (error) throw error;
      await refreshBusiness();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };


  const requestPasswordReset = async () => {
    if (!user?.email) return;
    setPasswordError(null);
    setPasswordMessage(null);
    setResetLink(null);
    setResetBusy(true);
    try {
      const { data, error } = await supabase.auth.forgotPassword(user.email);
      if (error) throw error;
      setPasswordMessage(data?.message || 'Password reset request created.');
      if (data?.reset_link) setResetLink(data.reset_link);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to create password reset request.');
    } finally {
      setResetBusy(false);
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);
    if (passwordForm.new_password.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }
    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      if (error) throw error;
      setPasswordMessage('Password changed successfully.');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading || !business) {
    return (
      <PageContainer>
        <Spinner label="Loading settings…" />
      </PageContainer>
    );
  }

  const meta = CATEGORY_META[business.category as BusinessCategory];
  const Icon = CATEGORY_ICONS[business.category as BusinessCategory];

  return (
    <PageContainer>
      <PageHeader title="Settings" subtitle="Manage your business profile, charges, and preferences." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Business card preview */}
        <div className="lg:col-span-1">
          <Card className="p-5 sticky top-20">
            <div className="flex items-center gap-3 mb-4">
              <div className={classNames('h-14 w-14 rounded-2xl bg-gradient-to-br grid place-items-center text-white shadow-sm overflow-hidden shrink-0', meta.gradient)}>
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <Icon className="h-7 w-7" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 truncate">{form.business_name || 'Your business'}</p>
                <p className="text-xs text-slate-500">{meta?.label}</p>
              </div>
            </div>
            <div className="space-y-2.5 text-sm">
              <InfoRow icon={UserIcon} label="Owner" value={form.owner_name || '—'} />
              <InfoRow icon={Phone} label="Phone" value={form.phone || '—'} />
              <InfoRow icon={MapPin} label="Address" value={form.address || '—'} />
              <InfoRow icon={Mail} label="Email" value={user?.email ?? '—'} />
              <InfoRow icon={Coins} label="Currency" value={form.currency} />
              <InfoRow icon={Percent} label="Tax rate" value={`${form.tax_rate || 0}%`} />
              <InfoRow icon={Receipt} label="Service charge" value={`${form.service_charge_rate || 0}%`} />
              <InfoRow icon={Percent} label="VAT rate" value={`${form.vat_rate || 0}%`} />
              <InfoRow icon={Truck} label="Delivery charge" value={form.delivery_charge || '0'} />
              <InfoRow icon={MapPinned} label="Service area" value={form.service_area || '—'} />
              <InfoRow icon={Building2} label="Tax zone" value={form.tax_zone || '—'} />
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500">Member since</p>
              <p className="text-sm font-semibold text-slate-900">
                {new Date(business.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </Card>
        </div>

        {/* Edit form */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-5 sm:p-6">
            <form onSubmit={save} className="space-y-5">
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Business profile</h3>
                <p className="text-sm text-slate-500">Update your business information.</p>
              </div>

              <ImageDropzone
                value={form.logo_url || null}
                onChange={(url) => update('logo_url', url ?? '')}
                label="Shop logo"
                accent="fuchsia"
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField label="Owner name" icon={UserIcon}>
                  <input type="text" value={form.owner_name} onChange={(e) => update('owner_name', e.target.value)} className="input" />
                </FormField>
                <FormField label="Phone" icon={Phone}>
                  <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} className="input" />
                </FormField>
              </div>

              <FormField label="Business name" icon={Store}>
                <input type="text" value={form.business_name} onChange={(e) => update('business_name', e.target.value)} className="input" />
              </FormField>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Business category</label>
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className={classNames('h-10 w-10 rounded-lg bg-gradient-to-br grid place-items-center text-white shrink-0', meta.gradient)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{meta?.label}</p>
                    <p className="text-xs text-slate-500">Category cannot be changed after sign-up.</p>
                  </div>
                </div>
              </div>

              <FormField label="Business address" icon={MapPin}>
                <textarea value={form.address} onChange={(e) => update('address', e.target.value)} rows={2} className="input resize-none" />
              </FormField>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField label="Currency" icon={Coins}>
                  <select value={form.currency} onChange={(e) => update('currency', e.target.value)} className="input cursor-pointer">
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Tax rate (%)" icon={Percent}>
                  <input type="number" value={form.tax_rate} onChange={(e) => update('tax_rate', e.target.value)} min="0" max="100" step="0.01" className="input" />
                </FormField>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-3 text-sm text-rose-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {saved && (
                <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-3 text-sm text-emerald-700 animate-fade-in-fast">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Settings saved successfully.</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save changes
                </Button>
              </div>
            </form>
          </Card>

          {/* Charges & zones */}
          <Card className="p-5 sm:p-6">
            <div className="mb-4">
              <h3 className="font-bold text-slate-900 mb-1">Charges & zones</h3>
              <p className="text-sm text-slate-500">Default charges and location info applied to new sales. You can override each per sale at the POS.</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <FormField label="Service charge (%)" icon={Receipt}>
                <input type="number" value={form.service_charge_rate} onChange={(e) => update('service_charge_rate', e.target.value)} min="0" max="100" step="0.01" className="input" />
              </FormField>
              <FormField label="VAT (%)" icon={Percent}>
                <input type="number" value={form.vat_rate} onChange={(e) => update('vat_rate', e.target.value)} min="0" max="100" step="0.01" className="input" />
              </FormField>
              <FormField label="Delivery charge" icon={Truck}>
                <input type="number" value={form.delivery_charge} onChange={(e) => update('delivery_charge', e.target.value)} min="0" step="0.01" className="input" />
              </FormField>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <FormField label="Service area name" icon={MapPinned}>
                <input type="text" value={form.service_area} onChange={(e) => update('service_area', e.target.value)} placeholder="e.g. Dhanmondi" className="input" />
              </FormField>
              <FormField label="Tax zone name" icon={Building2}>
                <input type="text" value={form.tax_zone} onChange={(e) => update('tax_zone', e.target.value)} placeholder="e.g. Dhaka VAT Zone" className="input" />
              </FormField>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="mb-4">
              <h3 className="font-bold text-slate-900 mb-1">Receipt message</h3>
              <p className="text-sm text-slate-500">A message printed at the bottom of every receipt — e.g. "Thank you for your business!" or "Goods once sold are not returnable."</p>
            </div>
            <FormField label="Footer message" icon={Receipt}>
              <textarea
                value={form.receipt_message}
                onChange={(e) => update('receipt_message', e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Thank you for your business!"
                className="input resize-none"
              />
            </FormField>
            <p className="mt-1.5 text-xs text-slate-400 text-right">{form.receipt_message.length}/500</p>
          </Card>

          <Card className="p-5 sm:p-6">
            <h4 className="font-semibold text-slate-900 text-sm mb-1">Account & password</h4>
            <p className="text-sm text-slate-500 mb-4">Change your password from settings. Public forgot-password reset routes are also available for signed-out users.</p>
            <FormField label="Email" icon={Mail}>
              <input type="email" value={user?.email ?? ''} disabled className="input bg-slate-50 text-slate-500 cursor-not-allowed" />
            </FormField>
            <p className="mt-2 mb-5 text-xs text-slate-500 flex items-center gap-1.5">
              <Lock className="h-3 w-3" />
              Email changes are not supported in this version.
            </p>

            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Forgot password reset</p>
                  <p className="text-xs text-slate-500">Generate a secure reset link for this account email. In production, connect an email provider to send it automatically.</p>
                </div>
                <Button type="button" variant="secondary" disabled={resetBusy} onClick={requestPasswordReset}>
                  {resetBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Create reset link
                </Button>
              </div>
              {resetLink && (
                <div className="mt-3 rounded-lg bg-white border border-slate-200 p-3">
                  <p className="text-xs font-semibold text-slate-500 mb-1">Development reset link</p>
                  <a href={resetLink} className="text-xs text-brand-700 break-all hover:underline">{resetLink}</a>
                </div>
              )}
            </div>

            <form onSubmit={changePassword} className="space-y-4 border-t border-slate-100 pt-5">
              <div className="grid sm:grid-cols-3 gap-4">
                <FormField label="Current password" icon={Lock}>
                  <input type="password" value={passwordForm.current_password} onChange={(e) => setPasswordForm((f) => ({ ...f, current_password: e.target.value }))} className="input" />
                </FormField>
                <FormField label="New password" icon={Lock}>
                  <input type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm((f) => ({ ...f, new_password: e.target.value }))} minLength={6} className="input" />
                </FormField>
                <FormField label="Confirm password" icon={Lock}>
                  <input type="password" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm((f) => ({ ...f, confirm_password: e.target.value }))} minLength={6} className="input" />
                </FormField>
              </div>
              {passwordError && (
                <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-3 text-sm text-rose-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}
              {passwordMessage && (
                <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-3 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{passwordMessage}</span>
                </div>
              )}
              <div className="flex justify-end">
                <Button type="submit" disabled={passwordSaving} variant="outline">
                  {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Update password
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
      <style>{`.input{display:block;width:100%;border-radius:0.75rem;border:1px solid #e2e8f0;background:#fff;padding:0.625rem 0.875rem;font-size:0.875rem;color:#0f172a;outline:none;transition:all .15s;box-shadow:0 1px 2px rgba(15,23,42,.04)}.input::placeholder{color:#94a3b8}.input:focus{border-color:#3370ff;box-shadow:0 0 0 3px rgba(51,112,255,.15)}`}</style>
    </PageContainer>
  );
}

function FormField({ label, icon: Icon, children }: { label: string; icon: typeof UserIcon; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</span>
      <div className="relative">
        <Icon className="absolute left-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
        <div className="[&_.input]:pl-9">{children}</div>
      </div>
    </label>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof UserIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-900 break-words">{value}</p>
      </div>
    </div>
  );
}
