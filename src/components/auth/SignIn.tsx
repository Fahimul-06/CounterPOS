import { useState, FormEvent } from 'react';
import { Store, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function SignIn() {
  const { refreshBusiness } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      await refreshBusiness();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-[1fr_1.1fr] bg-slate-50">
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
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">Welcome back to your counter.</h1>
          <p className="mt-4 text-slate-300 leading-relaxed">Sign in to pick up where you left off — your products, sales, and insights are waiting.</p>
        </div>
        <div className="relative z-10 text-xs text-slate-500">&copy; {new Date().getFullYear()} Counterpoint POS. All rights reserved.</div>
      </div>

      <div className="flex flex-col min-h-screen">
        <div className="lg:hidden flex items-center gap-3 px-6 pt-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center">
            <Store className="h-5 w-5 text-white" />
          </div>
          <p className="font-bold text-slate-900">Counterpoint POS</p>
        </div>

        <div className="flex-1 flex items-center justify-center px-5 sm:px-8 py-8">
          <div className="w-full max-w-sm animate-fade-in">
            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Sign in</h2>
              <p className="mt-2 text-sm text-slate-500">Enter your credentials to access your dashboard.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block">
                <span className="block text-sm font-semibold text-slate-700 mb-1.5">Email</span>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@business.com"
                    className="input pl-9"
                    autoComplete="email"
                  />
                </div>
              </label>

              <label className="block">
                <span className="block text-sm font-semibold text-slate-700 mb-1.5">Password</span>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    className="input pl-9 pr-10"
                    autoComplete="current-password"
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
              </label>

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
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>

              <p className="text-center text-sm text-slate-500">
                New here?{' '}
                <a href="/signup" className="font-semibold text-brand-600 hover:text-brand-700">
                  Create an account
                </a>
              </p>
            </form>
          </div>
        </div>
      </div>
      <style>{`.input{display:block;width:100%;border-radius:0.75rem;border:1px solid #e2e8f0;background:#fff;padding:0.625rem 0.875rem;font-size:0.875rem;color:#0f172a;outline:none;transition:all .15s;box-shadow:0 1px 2px rgba(15,23,42,.04)}.input::placeholder{color:#94a3b8}.input:focus{border-color:#3370ff;box-shadow:0 0 0 3px rgba(51,112,255,.15)}`}</style>
    </div>
  );
}
