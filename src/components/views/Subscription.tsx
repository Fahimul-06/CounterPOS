import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Copy, Crown, Loader2, ShieldCheck, Smartphone, Sparkles, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../ui/Shared';

type Plan = 'monthly' | 'yearly';

interface Props {
  forcePayment?: boolean;
  onBack?: () => void;
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function Subscription({ forcePayment = false, onBack }: Props) {
  const { business, refreshBusiness, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [paying, setPaying] = useState<Plan | null>(null);
  const [bkashPaying, setBkashPaying] = useState<Plan | null>(null);
  const [bkashInfo, setBkashInfo] = useState<any>(null);
  const [bkashTrxId, setBkashTrxId] = useState('');
  const [confirmingBkash, setConfirmingBkash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('subscription');
    if (result === 'success') setNotice('Payment successful. Your subscription is active now.');
    if (result === 'fail') setError('Payment failed. Please try again.');
    if (result === 'cancel') setError('Payment was cancelled.');
    if (result === 'validation_failed') setError('Payment was received but validation failed. Please contact support before trying again.');
    if (result) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const reloadSubscription = async () => {
    const { data, error } = await supabase.subscription.getStatus();
    if (error) setError(error.message);
    setSubscription(data?.subscription ?? null);
    await refreshBusiness();
  };

  useEffect(() => {
    let mounted = true;
    supabase.subscription.getStatus().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setError(error.message);
      setSubscription(data?.subscription ?? null);
      setLoading(false);
      refreshBusiness();
    });
    return () => { mounted = false; };
  }, [refreshBusiness]);

  const status = useMemo(() => {
    if (subscription) return subscription;
    const now = Date.now();
    const trialEnds = business?.trial_ends_at ? new Date(business.trial_ends_at).getTime() : 0;
    const paidEnds = business?.subscription_ends_at ? new Date(business.subscription_ends_at).getTime() : 0;
    const paidActive = paidEnds > now;
    const trialActive = !paidActive && trialEnds > now;
    const endsAt = paidActive ? paidEnds : trialEnds;
    return {
      active: paidActive || trialActive,
      status: paidActive ? 'active' : trialActive ? 'trialing' : 'expired',
      plan: paidActive ? business?.subscription_plan : 'trial',
      days_remaining: endsAt ? Math.max(0, Math.ceil((endsAt - now) / 86400000)) : 0,
      trial_ends_at: business?.trial_ends_at,
      subscription_ends_at: business?.subscription_ends_at,
    };
  }, [business, subscription]);

  const startCheckout = async (plan: Plan) => {
    setPaying(plan);
    setError(null);
    const { data, error } = await supabase.subscription.checkout(plan);
    setPaying(null);
    if (error) {
      setError(error.message);
      return;
    }
    if (data?.checkout_url) {
      window.location.href = data.checkout_url;
      return;
    }
    setError('SSLCommerz checkout URL was not returned.');
  };

  const startBkashPayment = async (plan: Plan) => {
    setBkashPaying(plan);
    setError(null);
    setNotice(null);
    const { data, error } = await supabase.subscription.bkashPayment(plan);
    setBkashPaying(null);
    if (error) {
      setError(error.message);
      return;
    }
    setBkashInfo(data);
    setBkashTrxId('');
  };

  const confirmBkashPayment = async () => {
    if (!bkashInfo?.tran_id || !bkashTrxId.trim()) {
      setError('Enter the bKash TrxID after sending payment.');
      return;
    }
    setConfirmingBkash(true);
    setError(null);
    const { data, error } = await supabase.subscription.confirmBkashPayment({
      tran_id: bkashInfo.tran_id,
      customer_trx_id: bkashTrxId.trim(),
    });
    setConfirmingBkash(false);
    if (error) {
      setError(error.message);
      return;
    }
    setBkashInfo(null);
    setNotice(data?.message || 'bKash payment submitted. Your subscription is active now.');
    await reloadSubscription();
  };

  const copyText = async (value: string) => {
    await navigator.clipboard?.writeText(value);
    setNotice('Copied to clipboard.');
  };

  if (loading && !business) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <Spinner />
      </div>
    );
  }

  const expired = status?.status === 'expired' || !status?.active;

  return (
    <div className={forcePayment ? 'min-h-screen bg-slate-50 px-4 py-10' : 'p-4 sm:p-6 lg:p-8'}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-700 p-6 sm:p-8 text-white shadow-soft-lg">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold mb-4">
                <Crown className="h-4 w-4" /> CounterPOS Subscription
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold">
                {expired ? 'Your free trial has ended' : status?.status === 'trialing' ? 'Your 15-day free trial is active' : 'Your subscription is active'}
              </h1>
              <p className="mt-2 text-sm text-slate-200 max-w-2xl">
                New businesses can use all features free for 15 days. After that, choose a monthly or yearly subscription and pay through SSLCommerz or bKash Merchant.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 min-w-[220px]">
              <p className="text-xs uppercase tracking-wide text-slate-300">Current status</p>
              <div className="mt-2 flex items-center gap-2 text-lg font-bold">
                {expired ? <XCircle className="h-5 w-5 text-rose-300" /> : <CheckCircle2 className="h-5 w-5 text-emerald-300" />}
                {status?.status === 'trialing' ? 'Trial' : status?.status === 'active' ? 'Active' : 'Expired'}
              </div>
              <p className="mt-1 text-sm text-slate-200">
                {status?.days_remaining || 0} day{Number(status?.days_remaining) === 1 ? '' : 's'} remaining
              </p>
            </div>
          </div>
        </div>

        {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{notice}</div>}
        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

        <div className="grid lg:grid-cols-3 gap-5">
          <StatusCard
            title="Trial details"
            icon={Clock}
            lines={[
              ['Trial ends', formatDate(business?.trial_ends_at ?? status?.trial_ends_at)],
              ['Paid plan ends', formatDate(business?.subscription_ends_at ?? status?.subscription_ends_at)],
              ['Business', business?.business_name || 'Your business'],
            ]}
          />

          <PlanCard
            plan="monthly"
            title="Monthly"
            price="৳999"
            description="Best for testing production with real customers."
            benefits={['Full POS access', 'Products, sales, kitchen & tables', 'SSLCommerz or bKash payment']}
            loading={paying === 'monthly'}
            bkashLoading={bkashPaying === 'monthly'}
            onChoose={() => startCheckout('monthly')}
            onBkashChoose={() => startBkashPayment('monthly')}
          />

          <PlanCard
            plan="yearly"
            title="Yearly"
            price="৳9,999"
            description="Best for long-term business use."
            benefits={['Full yearly access', 'Lower cost than monthly', 'Best for shops and restaurants']}
            loading={paying === 'yearly'}
            bkashLoading={bkashPaying === 'yearly'}
            onChoose={() => startCheckout('yearly')}
            onBkashChoose={() => startBkashPayment('yearly')}
            highlighted
          />
        </div>

        <div className="rounded-3xl border border-pink-100 bg-pink-50/70 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 font-bold text-slate-900"><Smartphone className="h-5 w-5 text-pink-600" /> bKash Merchant payment</h2>
              <p className="mt-1 text-sm text-slate-600">Merchant number: <span className="font-bold text-slate-900">01409472939</span>. Choose a plan and click Pay by bKash to generate a subscription reference.</p>
            </div>
            <button onClick={() => copyText('01409472939')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-pink-200 bg-white px-4 py-2.5 text-sm font-bold text-pink-700 hover:bg-pink-100">
              <Copy className="h-4 w-4" /> Copy number
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {!forcePayment && onBack && (
            <button onClick={onBack} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Back to dashboard
            </button>
          )}
          {forcePayment && (
            <button onClick={signOut} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Sign out
            </button>
          )}
        </div>
      </div>

      {bkashInfo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-soft-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Pay with bKash Merchant</h2>
                <p className="mt-1 text-sm text-slate-500">Send payment first, then submit your bKash TrxID.</p>
              </div>
              <button onClick={() => setBkashInfo(null)} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-500 hover:bg-slate-50">✕</button>
            </div>

            <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <InfoRow label="Merchant number" value={bkashInfo.merchant_number || '01409472939'} onCopy={() => copyText(bkashInfo.merchant_number || '01409472939')} />
              <InfoRow label="Amount" value={`৳${Number(bkashInfo.amount || 0).toLocaleString()}`} />
              <InfoRow label="Plan" value={String(bkashInfo.plan || '').toUpperCase()} />
              <InfoRow label="Reference" value={bkashInfo.reference || bkashInfo.tran_id} onCopy={() => copyText(bkashInfo.reference || bkashInfo.tran_id)} />
            </div>

            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-bold">Payment steps</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Open bKash app or dial bKash USSD.</li>
                <li>Choose Merchant payment / Payment.</li>
                <li>Send the exact amount to <strong>{bkashInfo.merchant_number || '01409472939'}</strong>.</li>
                <li>Use the reference if bKash asks for one.</li>
                <li>Paste the bKash TrxID below and confirm.</li>
              </ol>
            </div>

            <label className="mt-5 block text-sm font-semibold text-slate-700">bKash TrxID</label>
            <input
              value={bkashTrxId}
              onChange={(e) => setBkashTrxId(e.target.value)}
              placeholder="Example: A1B2C3D4E5"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-pink-500 focus:ring-4 focus:ring-pink-100"
            />
            <p className="mt-2 text-xs text-slate-500">For accounting accuracy, verify this TrxID in your bKash merchant account.</p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button onClick={confirmBkashPayment} disabled={confirmingBkash} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-3 text-sm font-bold text-white hover:bg-pink-700 disabled:opacity-60">
                {confirmingBkash && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm bKash payment
              </button>
              <button onClick={() => setBkashInfo(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="inline-flex items-center gap-2 text-right font-bold text-slate-900">
        {value}
        {onCopy && <button onClick={onCopy} className="rounded-lg p-1 text-slate-500 hover:bg-white hover:text-slate-900"><Copy className="h-4 w-4" /></button>}
      </span>
    </div>
  );
}

function StatusCard({ title, icon: Icon, lines }: { title: string; icon: typeof Clock; lines: [string, string][] }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="h-11 w-11 rounded-2xl bg-slate-100 grid place-items-center text-slate-700 mb-4">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="font-bold text-slate-900">{title}</h2>
      <div className="mt-4 space-y-3">
        {lines.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-500">{label}</span>
            <span className="font-semibold text-slate-800 text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanCard({
  title,
  price,
  description,
  benefits,
  loading,
  bkashLoading,
  highlighted = false,
  onChoose,
  onBkashChoose,
}: {
  plan: Plan;
  title: string;
  price: string;
  description: string;
  benefits: string[];
  loading: boolean;
  bkashLoading: boolean;
  highlighted?: boolean;
  onChoose: () => void;
  onBkashChoose: () => void;
}) {
  return (
    <div className={`relative rounded-3xl border p-5 shadow-soft ${highlighted ? 'border-brand-200 bg-brand-50/60' : 'border-slate-200 bg-white'}`}>
      {highlighted && <div className="absolute right-5 top-5 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-bold text-white">Popular</div>}
      <div className={`h-11 w-11 rounded-2xl grid place-items-center mb-4 ${highlighted ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
        {highlighted ? <Sparkles className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
      </div>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <div className="mt-5 flex items-end gap-1">
        <span className="text-3xl font-extrabold text-slate-900">{price}</span>
        <span className="pb-1 text-sm text-slate-500">/{title.toLowerCase()}</span>
      </div>
      <ul className="mt-5 space-y-2.5">
        {benefits.map((b) => (
          <li key={b} className="flex items-center gap-2 text-sm text-slate-600">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {b}
          </li>
        ))}
      </ul>
      <div className="mt-6 space-y-2.5">
        <button
          onClick={onChoose}
          disabled={loading || bkashLoading}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition-colors ${highlighted ? 'bg-brand-600 hover:bg-brand-700' : 'bg-slate-900 hover:bg-slate-800'} disabled:opacity-60`}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Pay with SSLCommerz
        </button>
        <button
          onClick={onBkashChoose}
          disabled={loading || bkashLoading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-pink-200 bg-white px-4 py-3 text-sm font-bold text-pink-700 hover:bg-pink-50 disabled:opacity-60"
        >
          {bkashLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
          Pay by bKash Merchant
        </button>
      </div>
    </div>
  );
}
