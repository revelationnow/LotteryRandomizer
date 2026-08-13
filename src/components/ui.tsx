import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Shared primitives. Every interactive element here is at least 44px tall so it
 * stays comfortably tappable on a phone.
 */

type Variant = 'primary' | 'ghost' | 'outline';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-linear-to-r from-violet to-cyan text-void font-semibold shadow-lg shadow-violet/25 hover:brightness-110 active:brightness-95',
  ghost: 'text-muted hover:bg-white/8 hover:text-ink',
  outline: 'glass text-ink hover:bg-white/10',
};

export function Button({
  variant = 'outline',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Panel({
  title,
  subtitle,
  children,
  className = '',
  action,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`glass rounded-2xl p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-display text-base font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/4 p-3">
      <div className="text-[11px] tracking-wide text-faint uppercase">{label}</div>
      <div className="mt-1 font-display text-xl font-bold tabular">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

export function Chip({
  active,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...props}
      aria-pressed={active}
      className={`min-h-11 min-w-11 rounded-full border px-3 text-sm font-medium transition ${
        active
          ? 'border-cyan/60 bg-cyan/20 text-ink'
          : 'border-white/12 bg-white/4 text-muted hover:bg-white/10 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
