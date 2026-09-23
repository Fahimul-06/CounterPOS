import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, Badge } from '../ui/Shared';
import { classNames, formatMoney } from '../../lib/utils';
import type { Business } from '../../lib/supabase';

export const PAYMENT_METHODS = ['cash', 'card', 'bkash', 'nagad', 'bangla_qr', 'due'] as const;
export const EXPIRY_WINDOWS = [30, 90, 180];

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function daysUntil(iso?: string | null): number {
  if (!iso) return 999999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(`${iso}T00:00:00`);
  return Math.ceil((exp.getTime() - today.getTime()) / 86400000);
}

export function expiryLabel(iso?: string | null) {
  const d = daysUntil(iso);
  if (d < 0) return { label: 'Expired', color: 'red' as const };
  if (d <= 30) return { label: '30-day alert', color: 'red' as const };
  if (d <= 90) return { label: '90-day alert', color: 'amber' as const };
  if (d <= 180) return { label: '180-day alert', color: 'blue' as const };
  return { label: 'Valid', color: 'green' as const };
}

export function totalStock(medicine: any) {
  return Number(medicine?.pieces ?? medicine?.stock ?? 0);
}

export function piecesFromUnits(medicine: any, qty: number, unit: string) {
  const pps = Math.max(Number(medicine?.pieces_per_strip || 1), 1);
  const spb = Math.max(Number(medicine?.strips_per_box || 1), 1);
  if (unit === 'box') return qty * pps * spb;
  if (unit === 'strip') return qty * pps;
  return qty;
}

export function unitText(medicine: any) {
  const boxes = Math.floor(Number(medicine?.pieces || 0) / Math.max(Number(medicine?.pieces_per_strip || 1) * Number(medicine?.strips_per_box || 1), 1));
  const strips = Math.floor((Number(medicine?.pieces || 0) % Math.max(Number(medicine?.pieces_per_strip || 1) * Number(medicine?.strips_per_box || 1), 1)) / Math.max(Number(medicine?.pieces_per_strip || 1), 1));
  const pieces = Number(medicine?.pieces || 0) % Math.max(Number(medicine?.pieces_per_strip || 1), 1);
  return `${boxes} box · ${strips} strip · ${pieces} pc`;
}

export function StatCard({ label, value, icon: Icon, tone = 'slate', sub }: { label: string; value: ReactNode; icon: LucideIcon; tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue' | 'violet'; sub?: ReactNode }) {
  const tones = {
    slate: 'bg-slate-50 text-slate-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{value}</p>
          {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
        </div>
        <div className={classNames('h-11 w-11 rounded-2xl grid place-items-center shrink-0', tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

export function ExpiryBadge({ expiry }: { expiry?: string | null }) {
  const meta = expiryLabel(expiry);
  return <Badge color={meta.color}>{meta.label}</Badge>;
}

export function money(n: number, business?: Business | null) {
  return formatMoney(Number(n || 0), business?.currency || 'BDT');
}

export function pharmacyGradient() {
  return 'bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600';
}
