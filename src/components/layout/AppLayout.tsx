import { ReactNode, useState } from 'react';
import {
  LayoutDashboard,
  ScanLine,
  Package,
  Receipt,
  Settings,
  LogOut,
  Store,
  Menu,
  X,
  ChevronDown,
  Pill,
  Shirt,
  ChefHat,
  Table2,
  CreditCard,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CATEGORY_META, classNames } from '../../lib/utils';
import type { BusinessCategory } from '../../lib/supabase';

export type View = 'dashboard' | 'pos' | 'tables' | 'products' | 'medicines' | 'dresses' | 'kitchen' | 'sales' | 'expenses' | 'settings' | 'subscription';

interface NavItem {
  id: View;
  label: string;
  icon: typeof LayoutDashboard;
  description: string;
}

const BASE_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview & analytics' },
  { id: 'pos', label: 'POS Terminal', icon: ScanLine, description: 'Ring up sales' },
  { id: 'products', label: 'Products', icon: Package, description: 'Manage inventory' },
  { id: 'sales', label: 'Sales', icon: Receipt, description: 'History & receipts' },
  { id: 'expenses', label: 'Expenses', icon: WalletCards, description: 'Daily & monthly costs' },
  { id: 'settings', label: 'Settings', icon: Settings, description: 'Business profile' },
  { id: 'subscription', label: 'Subscription', icon: CreditCard, description: 'Trial, monthly & yearly plan' },
];

const MEDICINES_NAV: NavItem = {
  id: 'medicines',
  label: 'Medicines',
  icon: Pill,
  description: 'Pharmacy inventory & expiry',
};

const DRESSES_NAV: NavItem = {
  id: 'dresses',
  label: 'Dresses',
  icon: Shirt,
  description: 'Clothing inventory & stock',
};


const TABLES_NAV: NavItem = {
  id: 'tables',
  label: 'Tables',
  icon: Table2,
  description: 'Table bookings & receipts',
};

const KITCHEN_NAV: NavItem = {
  id: 'kitchen',
  label: 'Kitchen',
  icon: ChefHat,
  description: 'Food preparation queue',
};

function buildNav(category?: string): NavItem[] {
  if (category === 'pharmacy') {
    const nav = [...BASE_NAV];
    nav.splice(3, 0, MEDICINES_NAV);
    return nav;
  }
  if (category === 'clothing') {
    const nav = [...BASE_NAV];
    nav.splice(3, 0, DRESSES_NAV);
    return nav;
  }
  if (category === 'restaurant') {
    const nav = [...BASE_NAV];
    nav.splice(2, 0, TABLES_NAV);
    nav.splice(4, 0, KITCHEN_NAV);
    return nav;
  }
  return BASE_NAV;
}

interface Props {
  current: View;
  onNavigate: (v: View) => void;
  children: ReactNode;
}

export default function AppLayout({ current, onNavigate, children }: Props) {
  const { business, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const meta = business ? CATEGORY_META[business.category as BusinessCategory] : null;
  const nav = buildNav(business?.category);

  const go = (v: View) => {
    onNavigate(v);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <SidebarContent current={current} onNavigate={go} businessName={business?.business_name} businessLogo={business?.logo_url} meta={meta} nav={nav} />
        <div className="mt-auto p-4 border-t border-slate-200">
          <ProfileCard onSignOut={signOut} business={business} meta={meta} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in-fast" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 max-w-[80%] flex flex-col bg-white animate-slide-in-right shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <span className="font-semibold text-slate-700">Menu</span>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent current={current} onNavigate={go} businessName={business?.business_name} businessLogo={business?.logo_url} meta={meta} nav={nav} />
            <div className="mt-auto p-4 border-t border-slate-200">
              <ProfileCard onSignOut={signOut} business={business} meta={meta} />
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 glass border-b border-slate-200/70">
          <div className="flex items-center justify-between px-4 sm:px-6 h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="lg:hidden flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center overflow-hidden">
                  {business?.logo_url ? <img src={business.logo_url} alt="Logo" className="h-full w-full object-cover" /> : <Store className="h-4 w-4 text-white" />}
                </div>
                <span className="font-bold text-slate-900 text-sm">{business?.business_name || 'Counterpoint'}</span>
              </div>
              <div className="hidden lg:block">
                <p className="text-sm font-semibold text-slate-900">{nav.find((n) => n.id === current)?.label}</p>
                <p className="text-xs text-slate-500">{nav.find((n) => n.id === current)?.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('pos')}
                className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors shadow-sm"
              >
                <ScanLine className="h-4 w-4" />
                New sale
              </button>
              <div className="relative">
                <button
                  onClick={() => setProfileOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100 transition-colors"
                >
                  <div className={classNames('h-8 w-8 rounded-lg grid place-items-center text-white bg-gradient-to-br overflow-hidden', meta?.gradient ?? 'from-slate-700 to-slate-900')}>
                    {business?.logo_url ? <img src={business.logo_url} alt="Logo" className="h-full w-full object-cover" /> : <span className="text-xs font-bold">{(business?.business_name ?? 'B').charAt(0).toUpperCase()}</span>}
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400 hidden sm:block" />
                </button>
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white shadow-soft-lg border border-slate-200 p-1.5 z-20 animate-scale-in origin-top-right">
                      <div className="px-3 py-2 border-b border-slate-100 mb-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{business?.business_name}</p>
                        <p className="text-xs text-slate-500 truncate">{business?.owner_name}</p>
                      </div>
                      <button
                        onClick={() => { onNavigate('settings'); setProfileOpen(false); }}
                        className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      >
                        <Settings className="h-4 w-4 text-slate-400" />
                        Settings
                      </button>
                      <button
                        onClick={signOut}
                        className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  current,
  onNavigate,
  businessName,
  businessLogo,
  meta,
  nav,
}: {
  current: View;
  onNavigate: (v: View) => void;
  businessName?: string;
  businessLogo?: string | null;
  meta: { label: string; gradient: string } | null;
  nav: NavItem[];
}) {
  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-200">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center shadow-sm overflow-hidden">
          {businessLogo ? <img src={businessLogo} alt="Logo" className="h-full w-full object-cover" /> : <Store className="h-5 w-5 text-white" />}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-slate-900 text-sm leading-tight truncate">{businessName || 'Counterpoint'}</p>
          <p className="text-[11px] text-slate-500 leading-tight">POS System</p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {nav.map((item) => {
          const active = current === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={classNames(
                'w-full group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <Icon className={classNames('h-4.5 w-4.5 shrink-0', active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600')} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {businessName && meta && (
        <div className="px-3 pb-2">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <div className="flex items-center gap-2.5">
              <div className={classNames('h-8 w-8 rounded-lg bg-gradient-to-br grid place-items-center text-white overflow-hidden', meta.gradient)}>
                {businessLogo ? <img src={businessLogo} alt="Logo" className="h-full w-full object-cover" /> : <Store className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">{businessName}</p>
                <p className="text-[11px] text-slate-500">{meta.label}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileCard({
  onSignOut,
  business,
  meta,
}: {
  onSignOut: () => void;
  business: { business_name: string; owner_name: string; category: string; logo_url?: string | null } | null;
  meta: { label: string; gradient: string } | null;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={classNames('h-9 w-9 rounded-lg bg-gradient-to-br grid place-items-center text-white shrink-0 overflow-hidden', meta?.gradient ?? 'from-slate-700 to-slate-900')}>
        {business?.logo_url ? (
          <img src={business.logo_url} alt="Logo" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-bold">{(business?.business_name ?? 'B').charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 truncate">{business?.business_name}</p>
        <p className="text-xs text-slate-500 truncate">{business?.owner_name}</p>
      </div>
      <button
        onClick={onSignOut}
        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
