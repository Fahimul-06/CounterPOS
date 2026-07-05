import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout, { type View } from './components/layout/AppLayout';
import SignUp from './components/auth/SignUp';
import SignIn from './components/auth/SignIn';
import Dashboard from './components/views/Dashboard';
import PosTerminal from './components/views/PosTerminal';
import Products from './components/views/Products';
import Medicines from './components/views/Medicines';
import Dresses from './components/views/Dresses';
import Sales from './components/views/Sales';
import Kitchen from './components/views/Kitchen';
import Tables from './components/views/Tables';
import Settings from './components/views/Settings';
import Subscription from './components/views/Subscription';
import { Spinner } from './components/ui/Shared';

type AuthRoute = 'signup' | 'signin' | 'app';

function Router() {
  const { user, loading } = useAuth();
  const [route, setRoute] = useState<AuthRoute>(() => parseRoute());

  useEffect(() => {
    const onPop = () => setRoute(parseRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Once we know the auth state, force the route to the app when signed in,
  // regardless of what the URL says. This fixes the case where a user signs in
  // but the URL is still /signin — they'd otherwise be stuck on the sign-in screen.
  useEffect(() => {
    if (!loading && user && route !== 'app') {
      setRoute('app');
    }
  }, [loading, user, route]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <p className="text-sm text-slate-500">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return route === 'signup' ? <SignUp /> : <SignIn />;
  }

  return <AuthedApp />;
}

function parseRoute(): AuthRoute {
  const p = window.location.pathname;
  if (p === '/signup') return 'signup';
  if (p === '/signin') return 'signin';
  return 'app';
}


function isSubscriptionActive(business: any) {
  const now = Date.now();
  const paidEnd = business?.subscription_ends_at ? new Date(business.subscription_ends_at).getTime() : 0;
  const trialEnd = business?.trial_ends_at ? new Date(business.trial_ends_at).getTime() : 0;
  return paidEnd > now || trialEnd > now;
}

function AuthedApp() {
  const { user, business, loading } = useAuth();
  const [view, setView] = useState<View>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <SignIn />;
  }

  if (user && !business) {
    return <ProfileMissing />;
  }

  if (business && !isSubscriptionActive(business)) {
    return <Subscription forcePayment />;
  }

  return (
    <AppLayout current={view} onNavigate={setView}>
      {view === 'dashboard' && <Dashboard onNavigate={setView} />}
      {view === 'pos' && <PosTerminal />}
      {view === 'tables' && <Tables />}
      {view === 'products' && <Products />}
      {view === 'medicines' && <Medicines />}
      {view === 'dresses' && <Dresses />}
      {view === 'kitchen' && <Kitchen />}
      {view === 'sales' && <Sales />}
      {view === 'settings' && <Settings />}
      {view === 'subscription' && <Subscription onBack={() => setView('dashboard')} />}
    </AppLayout>
  );
}

function ProfileMissing() {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="h-14 w-14 rounded-2xl bg-amber-50 grid place-items-center mx-auto mb-4">
          <span className="text-2xl">!</span>
        </div>
        <h1 className="text-xl font-bold text-slate-900">Business profile missing</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your account exists but your business profile could not be found. Please sign out and try again, or contact support.
        </p>
        <button
          onClick={signOut}
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
