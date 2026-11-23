import { STATUS_LABEL, type RequestStatus } from '@csis/shared';
import { CheckCircle2, CircleDashed, CornerUpLeft, Loader2, XCircle, Ban } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-ink-inverse shadow-[0_6px_18px_-8px_hsl(352_72%_30%/0.7)] hover:bg-brand-hover',
  secondary: 'bg-surface text-ink ring-1 ring-line-strong hover:bg-sunken',
  ghost: 'text-ink-muted hover:bg-sunken hover:text-ink',
  danger: 'bg-surface text-danger ring-1 ring-danger/40 hover:bg-danger-soft',
};

export function Button({ variant = 'primary', loading, icon, className, children, disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-[15px] font-medium',
        'transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
        VARIANT[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx('rounded-[var(--radius-card)] bg-surface shadow-card ring-1 ring-line/70', className)}>{children}</div>;
}

export function Field({ label, hint, error, children, counter }: { label: string; hint?: string | undefined; error?: string | undefined; counter?: string; children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="grid content-start gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[15px] font-medium">{label}</label>
        {counter && <span className="text-xs tabular-nums text-ink-muted">{counter}</span>}
      </div>
      {children({ id, describedBy, invalid: !!error })}
      {hint && !error && <p id={hintId} className="text-sm text-ink-muted">{hint}</p>}
      <p id={errorId} className="min-h-0 text-sm text-danger" aria-live="polite">{error}</p>
    </div>
  );
}

const control = 'w-full rounded-[var(--radius-control)] bg-surface px-3.5 text-base ring-1 ring-line-strong transition-[box-shadow] duration-150 placeholder:text-ink-muted/70 focus:outline-none focus:ring-2 focus:ring-brand aria-[invalid=true]:ring-danger';

export function Input(props: InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  return <input {...props} className={cx(control, 'min-h-11', props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(control, 'min-h-24 py-2.5 leading-relaxed', props.className)} />;
}

const STATUS_STYLE: Record<RequestStatus, { cls: string; Icon: typeof CheckCircle2 }> = {
  pending: { cls: 'bg-info-soft text-info', Icon: CircleDashed },
  returned: { cls: 'bg-warn-soft text-warn', Icon: CornerUpLeft },
  approved: { cls: 'bg-ok-soft text-ok', Icon: CheckCircle2 },
  rejected: { cls: 'bg-danger-soft text-danger', Icon: XCircle },
  cancelled: { cls: 'bg-sunken text-ink-muted', Icon: Ban },
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const { cls, Icon } = STATUS_STYLE[status];
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-medium whitespace-nowrap', cls)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Alert({ tone = 'danger', children }: { tone?: 'danger' | 'info' | 'warn' | 'ok'; children: ReactNode }) {
  const map = { danger: 'bg-danger-soft text-danger', info: 'bg-info-soft text-info', warn: 'bg-warn-soft text-warn', ok: 'bg-ok-soft text-ok' };
  return <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('rounded-[var(--radius-control)] px-4 py-3 text-[15px]', map[tone])}>{children}</div>;
}

export function Spinner({ label = 'กำลังโหลด' }: { label?: string }) {
  return (
    <div className="grid place-items-center py-16 text-ink-muted" role="status">
      <Loader2 className="size-6 animate-spin" aria-hidden="true" />
      <span className="mt-2 text-sm">{label}</span>
    </div>
  );
}

export { cx };
