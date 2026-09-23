import { ReactNode, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { classNames } from '../../lib/utils';

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={classNames('px-3 sm:px-5 lg:px-6 py-5 sm:py-6 max-w-7xl mx-auto animate-fade-in', className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 rounded-3xl border border-white/80 bg-white/80 p-4 sm:p-5 shadow-soft backdrop-blur-xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">{subtitle}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={classNames('rounded-3xl bg-white/90 border border-white/80 shadow-soft backdrop-blur-sm', className)}>{children}</div>;
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled,
  className,
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
} & Record<string, unknown>) {
  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-600/20',
    outline: 'border border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/40',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-sm',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-100',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof X;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="h-14 w-14 rounded-2xl bg-emerald-50 grid place-items-center mb-4">
        <Icon className="h-7 w-7 text-emerald-600" />
      </div>
      <p className="text-base font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  children,
  title,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in-fast" onClick={onClose} />
      <div className={classNames('relative w-full bg-white shadow-2xl animate-slide-up sm:animate-scale-in rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col', sizes[size])}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
            <h3 className="font-bold text-slate-900">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin" />
      {label && <p className="mt-2 text-sm">{label}</p>}
    </div>
  );
}

export function Badge({ children, color = 'slate' }: { children: ReactNode; color?: 'slate' | 'green' | 'amber' | 'red' | 'blue' }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80',
    green: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80',
    amber: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200/80',
    red: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200/80',
    blue: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200/80',
  };
  return <span className={classNames('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold capitalize', colors[color])}>{children}</span>;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="p-5">
        <p className="text-sm text-slate-600">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
