import { ReactNode, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  ScanLine,
  Package,
  PackageSearch,
  Receipt,
  Settings,
  LogOut,
  Store,
  Menu,
  X,
  ChevronDown,
  Shirt,
  ChefHat,
  Table2,
  CreditCard,
  WalletCards,
  Users,
  Truck,
  BarChart3,
  ShieldCheck,
  Search,
  Bell,
  Sparkles,
  Activity,
  CircleDollarSign,
  PanelLeftClose,
  PanelLeftOpen,
  Flame,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CATEGORY_META, classNames } from '../../lib/utils';
import type { BusinessCategory } from '../../lib/supabase';

export type View = 'dashboard' | 'pos' | 'tables' | 'products' | 'medicines' | 'lpg_inventory' | 'pharmacy_inventory' | 'pharmacy_suppliers' | 'pharmacy_customers' | 'pharmacy_reports' | 'pharmacy_operations' | 'dresses' | 'kitchen' | 'sales' | 'expenses' | 'settings' | 'subscription';

interface NavItem {
  id: View;
  label: string;
  icon: typeof LayoutDashboard;
  description: string;
  group?: 'main' | 'inventory' | 'finance' | 'operations' | 'account';
}

const BASE_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview & analytics', group: 'main' },
  { id: 'pos', label: 'POS Terminal', icon: ScanLine, description: 'Ring up sales', group: 'main' },
  { id: 'products', label: 'Products', icon: Package, description: 'Manage inventory', group: 'inventory' },
  { id: 'sales', label: 'Sales', icon: Receipt, description: 'History & receipts', group: 'finance' },
  { id: 'expenses', label: 'Expenses', icon: WalletCards, description: 'Daily & monthly costs', group: 'finance' },
  { id: 'settings', label: 'Settings', icon: Settings, description: 'Business profile', group: 'account' },
  { id: 'subscription', label: 'Subscription', icon: CreditCard, description: 'Trial, monthly & yearly plan', group: 'account' },
];

const PHARMACY_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Sales, profit, expiry & stock alerts', group: 'main' },
  { id: 'pos', label: 'Fast POS', icon: ScanLine, description: 'Barcode, FEFO sale & thermal receipt', group: 'main' },
  { id: 'pharmacy_inventory', label: 'Inventory', icon: PackageSearch, description: 'Medicines, batches & FEFO stock', group: 'inventory' },
  { id: 'pharmacy_suppliers', label: 'Suppliers', icon: Truck, description: 'Purchases, returns & supplier payments', group: 'inventory' },
  { id: 'pharmacy_customers', label: 'Customers', icon: Users, description: 'Prescriptions, dues & returns', group: 'finance' },
  { id: 'pharmacy_reports', label: 'Reports', icon: BarChart3, description: 'Sales, profit, stock & expiry reports', group: 'finance' },
  { id: 'pharmacy_operations', label: 'Operations', icon: ShieldCheck, description: 'Branches, cash register, roles & audit logs', group: 'operations' },
  { id: 'expenses', label: 'Expenses', icon: WalletCards, description: 'Daily & monthly costs', group: 'finance' },
  { id: 'settings', label: 'Settings', icon: Settings, description: 'Business profile', group: 'account' },
  { id: 'subscription', label: 'Subscription', icon: CreditCard, description: 'Trial, monthly & yearly plan', group: 'account' },
];


const LPG_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Sales, stock and empty cylinder status', group: 'main' },
  { id: 'pos', label: 'LPG POS', icon: ScanLine, description: 'Sell cylinders and receive empties', group: 'main' },
  { id: 'lpg_inventory', label: 'LPG Inventory', icon: Flame, description: 'Full and empty cylinder stock', group: 'inventory' },
  { id: 'sales', label: 'Sales', icon: Receipt, description: 'History & receipts', group: 'finance' },
  { id: 'expenses', label: 'Expenses', icon: WalletCards, description: 'Daily & monthly costs', group: 'finance' },
  { id: 'settings', label: 'Settings', icon: Settings, description: 'Business profile', group: 'account' },
  { id: 'subscription', label: 'Subscription', icon: CreditCard, description: 'Trial, monthly & yearly plan', group: 'account' },
];

const DRESSES_NAV: NavItem = {
  id: 'dresses',
  label: 'Dresses',
  icon: Shirt,
  description: 'Clothing inventory & stock',
  group: 'inventory',
};

const TABLES_NAV: NavItem = {
  id: 'tables',
  label: 'Tables',
  icon: Table2,
  description: 'Table bookings & receipts',
  group: 'main',
};

const KITCHEN_NAV: NavItem = {
  id: 'kitchen',
  label: 'Kitchen',
  icon: ChefHat,
  description: 'Food preparation queue',
  group: 'operations',
};

const GROUP_LABELS: Record<NonNullable<NavItem['group']>, string> = {
  main: 'Work desk',
  inventory: 'Inventory',
  finance: 'Money',
  operations: 'Operations',
  account: 'Account',
};

function buildNav(category?: string): NavItem[] {
  if (category === 'pharmacy') return PHARMACY_NAV;
  if (category === 'lpg_cylinder') return LPG_NAV;
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
  const [collapsed, setCollapsed] = useState(false);

  const meta = business ? CATEGORY_META[business.category as BusinessCategory] : null;
  const nav = useMemo(() => buildNav(business?.category), [business?.category]);
  const currentItem = nav.find((n) => n.id === current) || nav[0];

  const go = (v: View) => {
    onNavigate(v);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen app-shell-bg flex text-slate-900">
      <aside className={classNames('hidden lg:flex shrink-0 flex-col sidebar-surface border-r border-white/70 transition-all duration-300', collapsed ? 'w-[88px]' : 'w-[284px]')}>
        <SidebarContent
          current={current}
          onNavigate={go}
          businessName={business?.business_name}
          businessLogo={business?.logo_url}
          meta={meta}
          nav={nav}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
        />
        <div className="mt-auto p-3 border-t border-slate-200/80">
          <ProfileCard onSignOut={signOut} business={business} meta={meta} collapsed={collapsed} />
        </div>
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm animate-fade-in-fast" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-[316px] max-w-[86%] flex flex-col bg-white animate-slide-in-right shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <p className="text-sm font-extrabold text-slate-900">Menu</p>
                <p className="text-xs text-slate-500">Choose a workspace</p>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent current={current} onNavigate={go} businessName={business?.business_name} businessLogo={business?.logo_url} meta={meta} nav={nav} collapsed={false} />
            <div className="mt-auto p-4 border-t border-slate-200">
              <ProfileCard onSignOut={signOut} business={business} meta={meta} />
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/70">
          <div className="flex items-center justify-between gap-3 px-3 sm:px-5 h-16">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </button>
              <div className="lg:hidden h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 grid place-items-center overflow-hidden shadow-sm">
                {business?.logo_url ? <img src={business.logo_url} alt="Logo" className="h-full w-full object-cover" /> : <Store className="h-5 w-5 text-white" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm sm:text-base font-extrabold text-slate-950">{currentItem?.label}</p>
                  {business?.category === 'pharmacy' && <span className="hidden sm:inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Pharmacy</span>}
                </div>
                <p className="hidden sm:block truncate text-xs text-slate-500">{currentItem?.description}</p>
              </div>
            </div>

            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <button onClick={() => onNavigate('pos')} className="group flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-left text-sm text-slate-500 hover:border-emerald-200 hover:bg-white hover:shadow-sm">
                <Search className="h-4 w-4 text-slate-400 group-hover:text-emerald-600" />
                Search medicines, products or invoices from POS
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => onNavigate('pos')} className="hidden sm:inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-600/20">
                <ScanLine className="h-4 w-4" />
                New sale
              </button>
              <button className="hidden sm:grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" title="Notifications">
                <Bell className="h-4 w-4" />
              </button>
              <div className="relative">
                <button onClick={() => setProfileOpen((o) => !o)} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 pr-2.5 hover:bg-slate-50 transition-colors shadow-sm">
                  <div className={classNames('h-8 w-8 rounded-xl grid place-items-center text-white bg-gradient-to-br overflow-hidden', meta?.gradient ?? 'from-slate-700 to-slate-900')}>
                    {business?.logo_url ? <img src={business.logo_url} alt="Logo" className="h-full w-full object-cover" /> : <span className="text-xs font-black">{(business?.business_name ?? 'B').charAt(0).toUpperCase()}</span>}
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400 hidden sm:block" />
                </button>
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white shadow-soft-lg border border-slate-200 p-2 z-20 animate-scale-in origin-top-right">
                      <div className="px-3 py-3 border-b border-slate-100 mb-1">
                        <p className="text-sm font-extrabold text-slate-900 truncate">{business?.business_name}</p>
                        <p className="text-xs text-slate-500 truncate">{business?.owner_name}</p>
                      </div>
                      <button onClick={() => { onNavigate('settings'); setProfileOpen(false); }} className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                        <Settings className="h-4 w-4 text-slate-400" />
                        Settings
                      </button>
                      <button onClick={signOut} className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50">
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
  collapsed,
  onToggleCollapse,
}: {
  current: View;
  onNavigate: (v: View) => void;
  businessName?: string;
  businessLogo?: string | null;
  meta: { label: string; gradient: string } | null;
  nav: NavItem[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const grouped = useMemo(() => {
    const order: NonNullable<NavItem['group']>[] = ['main', 'inventory', 'finance', 'operations', 'account'];
    return order
      .map((group) => ({ group, items: nav.filter((item) => (item.group || 'main') === group) }))
      .filter((section) => section.items.length > 0);
  }, [nav]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className={classNames('flex items-center gap-3 px-4 h-20 border-b border-slate-200/80', collapsed && 'justify-center px-3')}>
        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 grid place-items-center shadow-sm overflow-hidden shrink-0">
          {businessLogo ? <img src={businessLogo} alt="Logo" className="h-full w-full object-cover" /> : <Store className="h-5 w-5 text-white" />}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="font-black text-slate-950 text-sm leading-tight truncate">{businessName || 'CounterPOS'}</p>
            <p className="text-[11px] text-slate-500 leading-tight font-semibold">{meta?.label || 'Point of Sale'}</p>
          </div>
        )}
        {onToggleCollapse && (
          <button onClick={onToggleCollapse} className="hidden lg:grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Toggle sidebar">
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="mx-3 mt-3 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 p-3 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-100" />
            <p className="text-xs font-black uppercase tracking-wide">Production workspace</p>
          </div>
          <p className="mt-1 text-[11px] text-white/75">Fast billing, stock control, expiry alerts and clean receipts.</p>
        </div>
      )}

      <nav className={classNames('flex-1 overflow-y-auto px-3 py-3 space-y-4 no-scrollbar', collapsed && 'px-2')}>
        {grouped.map((section) => (
          <div key={section.group}>
            {!collapsed && <p className="mb-1.5 px-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{GROUP_LABELS[section.group]}</p>}
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = current === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={classNames(
                      'w-full group flex items-center rounded-2xl text-sm font-bold transition-all outline-none focus:ring-2 focus:ring-emerald-100',
                      collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5',
                      active ? 'bg-slate-950 text-white shadow-sm shadow-slate-950/15' : 'text-slate-600 hover:bg-white hover:text-slate-950 hover:shadow-sm',
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className={classNames('h-4 w-4 shrink-0', active ? 'text-white' : 'text-slate-400 group-hover:text-emerald-600')} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed && businessName && meta && (
        <div className="px-3 pb-2">
          <div className="rounded-2xl bg-white/75 border border-white p-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className={classNames('h-9 w-9 rounded-xl bg-gradient-to-br grid place-items-center text-white overflow-hidden', meta.gradient)}>
                {businessLogo ? <img src={businessLogo} alt="Logo" className="h-full w-full object-cover" /> : <Activity className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-950 truncate">{businessName}</p>
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
  collapsed,
}: {
  onSignOut: () => void;
  business: { business_name: string; owner_name: string; category: string; logo_url?: string | null } | null;
  meta: { label: string; gradient: string } | null;
  collapsed?: boolean;
}) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className={classNames('h-10 w-10 rounded-2xl bg-gradient-to-br grid place-items-center text-white overflow-hidden', meta?.gradient ?? 'from-slate-700 to-slate-900')}>
          {business?.logo_url ? <img src={business.logo_url} alt="Logo" className="h-full w-full object-cover" /> : <CircleDollarSign className="h-5 w-5" />}
        </div>
        <button onClick={onSignOut} className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" aria-label="Sign out" title="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-white/75 border border-white p-2 shadow-sm">
      <div className={classNames('h-10 w-10 rounded-2xl bg-gradient-to-br grid place-items-center text-white shrink-0 overflow-hidden', meta?.gradient ?? 'from-slate-700 to-slate-900')}>
        {business?.logo_url ? (
          <img src={business.logo_url} alt="Logo" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-black">{(business?.business_name ?? 'B').charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-slate-950 truncate">{business?.business_name}</p>
        <p className="text-xs text-slate-500 truncate">{business?.owner_name}</p>
      </div>
      <button onClick={onSignOut} className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" aria-label="Sign out" title="Sign out">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
