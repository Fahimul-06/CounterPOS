import { useState, FormEvent, useMemo } from 'react';
import {
  Store,
  User as UserIcon,
  Phone,
  Building2,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Utensils,
  ShoppingBag,
  Pill,
  Shirt,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CATEGORY_OPTIONS } from '../../lib/utils';
import type { BusinessCategory } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const CATEGORY_VISUALS: Record<BusinessCategory, { icon: typeof Utensils; tint: string; ring: string }> = {
  restaurant: { icon: Utensils, tint: 'bg-orange-50 text-orange-600', ring: 'ring-orange-200' },
  shop: { icon: ShoppingBag, tint: 'bg-emerald-50 text-emerald-600', ring: 'ring-emerald-200' },
  pharmacy: { icon: Pill, tint: 'bg-rose-50 text-rose-600', ring: 'ring-rose-200' },
  departmental_store: { icon: Building2, tint: 'bg-blue-50 text-blue-600', ring: 'ring-blue-200' },
  clothing: { icon: Shirt, tint: 'bg-fuchsia-50 text-fuchsia-600', ring: 'ring-fuchsia-200' },
};

export default function SignUp() {
  const { refreshBusiness } = useAuth();
  const [form, setForm] = useState({
    ownerName: '',
    phone: '',
    businessName: '',
    category: '' as BusinessCategory | '',
    address: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordStrength = useMemo(() => {
    const p = form.password;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  }, [form.password]);

  const strengthLabel = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][passwordStrength];
  const strengthColor = ['bg-slate-200', 'bg-rose-400', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-500'][passwordStrength];

  const update = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  const validate = (): string | null => {
    if (!form.ownerName.trim()) return 'Please enter your name.';
    if (!form.phone.trim()) return 'Please enter your phone number.';
    if (!form.businessName.trim()) return 'Please enter your business name.';
    if (!form.category) return 'Please select a business category.';
    if (!form.address.trim()) return 'Please enter your business address.';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Please enter a valid email address.';
    if (form.password.length < 6) return 'Password must be at least 6 characters.';
    if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            owner_name: form.ownerName.trim(),
            phone: form.phone.trim(),
            business_name: form.businessName.trim(),
            category: form.category,
            address: form.address.trim(),
          },
        },
      });
      if (signUpError) throw signUpError;
      if (!data.user) throw new Error('Sign-up failed. Please try again.');

      await refreshBusiness();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-up failed. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-[1fr_1.1fr] bg-slate-50">
      {/* Left: brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-slate-950 text-white p-12">
        <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(60% 50% at 20% 10%, #3370ff 0%, transparent 60%), radial-gradient(50% 40% at 90% 80%, #0ea5e9 0%, transparent 55%)' }} />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 grid place-items-center shadow-lg shadow-brand-600/30">
              <Store className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">Counterpoint POS</p>
              <p className="text-xs text-slate-400">Point of Sale, reimagined</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Run your business from one beautiful counter.
          </h1>
          <p className="mt-4 text-slate-300 leading-relaxed">
            From restaurants to retail, pharmacies to fashion — manage products, ring up sales, and track performance in real time.
          </p>
          <div className="mt-8 space-y-3">
            {[
              { icon: Sparkles, text: 'Lightning-fast checkout with a tactile POS terminal' },
              { icon: ShoppingBag, text: 'Live inventory that updates with every sale' },
              { icon: Building2, text: 'Built for five business types out of the box' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <div className="mt-0.5 h-8 w-8 rounded-lg bg-white/10 grid place-items-center shrink-0">
                  <Icon className="h-4 w-4 text-brand-300" />
                </div>
                <p className="text-sm text-slate-200">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-500">
          &copy; {new Date().getFullYear()} Counterpoint POS. All rights reserved.
        </div>
      </div>

      {/* Right: form */}
      <div className="flex flex-col min-h-screen">
        <div className="lg:hidden flex items-center gap-3 px-6 pt-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center">
            <Store className="h-5 w-5 text-white" />
          </div>
          <p className="font-bold text-slate-900">Counterpoint POS</p>
        </div>

        <div className="flex-1 flex items-center justify-center px-5 sm:px-8 py-8">
          <div className="w-full max-w-lg animate-fade-in">
            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Create your account</h2>
              <p className="mt-2 text-sm text-slate-500">Get your business online in under a minute.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Field label="Your name" icon={UserIcon}>
                <input
                  type="text"
                  value={form.ownerName}
                  onChange={(e) => update('ownerName', e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="input"
                  autoComplete="name"
                />
              </Field>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Phone" icon={Phone}>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    placeholder="+1 555 010 2030"
                    className="input"
                    autoComplete="tel"
                  />
                </Field>
                <Field label="Business name" icon={Store}>
                  <input
                    type="text"
                    value={form.businessName}
                    onChange={(e) => update('businessName', e.target.value)}
                    placeholder="e.g. Sunrise Diner"
                    className="input"
                  />
                </Field>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Business category</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {CATEGORY_OPTIONS.map((opt) => {
                    const v = CATEGORY_VISUALS[opt.value];
                    const Icon = v.icon;
                    const selected = form.category === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => update('category', opt.value)}
                        className={`group relative flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-all ${
                          selected
                            ? `border-transparent ring-2 ${v.ring} ${v.tint}`
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-xs font-semibold text-slate-700 leading-tight">{opt.label}</span>
                        {selected && <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-slate-700" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Field label="Business address" icon={MapPin}>
                <textarea
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  placeholder="Street, city, postcode"
                  rows={2}
                  className="input resize-none"
                />
              </Field>

              <Field label="Email" icon={Building2}>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="you@business.com"
                  className="input"
                  autoComplete="email"
                />
              </Field>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Password" icon={Lock}>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => update('password', e.target.value)}
                      placeholder="At least 6 characters"
                      className="input pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                      tabIndex={-1}
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {form.password && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-full ${strengthColor} transition-all duration-300`} style={{ width: `${(passwordStrength / 4) * 100}%` }} />
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 w-16 text-right">{strengthLabel}</span>
                    </div>
                  )}
                </Field>
                <Field label="Confirm password" icon={Lock}>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={form.confirmPassword}
                      onChange={(e) => update('confirmPassword', e.target.value)}
                      placeholder="Re-enter password"
                      className="input pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    {form.confirmPassword && form.password === form.confirmPassword && (
                      <CheckCircle2 className="absolute right-9 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                    )}
                  </div>
                </Field>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-3 text-sm text-rose-700 animate-fade-in-fast">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="group w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition-all hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-900/15 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating your account…
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>

              <p className="text-center text-sm text-slate-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    window.history.pushState({}, '', '/signin');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className="font-semibold text-brand-600 hover:text-brand-700"
                >
                  Sign in
                </button>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: typeof UserIcon; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</span>
      <div className="relative">
        <Icon className="absolute left-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
        <div className="[&_.input]:pl-9">{children}</div>
      </div>
      <style>{`.input{display:block;width:100%;border-radius:0.75rem;border:1px solid #e2e8f0;background:#fff;padding:0.625rem 0.875rem;font-size:0.875rem;color:#0f172a;outline:none;transition:all .15s;box-shadow:0 1px 2px rgba(15,23,42,.04)}.input::placeholder{color:#94a3b8}.input:focus{border-color:#3370ff;box-shadow:0 0 0 3px rgba(51,112,255,.15)}`}</style>
    </label>
  );
}
