import type { BusinessCategory } from './supabase';

export function formatMoney(amount: number, currency = 'BDT'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${(amount || 0).toFixed(2)}`;
  }
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return formatShortDate(iso);
}

export const CATEGORY_META: Record<BusinessCategory, { label: string; icon: string; gradient: string; accent: string }> = {
  restaurant: {
    label: 'Restaurant',
    icon: 'utensils',
    gradient: 'from-orange-500 to-amber-500',
    accent: 'orange',
  },
  shop: {
    label: 'Shop',
    icon: 'shopping-bag',
    gradient: 'from-emerald-500 to-teal-500',
    accent: 'emerald',
  },
  pharmacy: {
    label: 'Pharmacy',
    icon: 'pill',
    gradient: 'from-rose-500 to-red-500',
    accent: 'rose',
  },
  departmental_store: {
    label: 'Departmental Store',
    icon: 'building-2',
    gradient: 'from-blue-500 to-cyan-500',
    accent: 'blue',
  },
  clothing: {
    label: 'Clothing Shop',
    icon: 'shirt',
    gradient: 'from-fuchsia-500 to-pink-500',
    accent: 'fuchsia',
  },
};

export const CATEGORY_OPTIONS: { value: BusinessCategory; label: string }[] = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'shop', label: 'Shop' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'departmental_store', label: 'Departmental Store' },
  { value: 'clothing', label: 'Clothing Shop' },
];

export function classNames(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
