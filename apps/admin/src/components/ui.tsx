import {
  useEffect,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { initials } from "../lib/format";

/* ── button ──────────────────────────────────────────────────────────────── */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "quiet" | "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  block?: boolean;
  loading?: boolean;
};

export function Button({
  variant = "quiet",
  size = "md",
  block,
  loading,
  disabled,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  const classes = ["btn", variant === "quiet" ? "" : variant, size === "md" ? "" : size, block ? "block" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <span className="spinner" aria-hidden /> : null}
      {children}
    </button>
  );
}

/* ── card ────────────────────────────────────────────────────────────────── */

export function Card({
  children,
  flush,
  className = "",
  style,
}: PropsWithChildren<{ flush?: boolean; className?: string; style?: CSSProperties }>) {
  return (
    <section className={`card ${flush ? "flush" : ""} ${className}`} style={style}>
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="card-header">
      <div className="stack gap-2">
        <h3>{title}</h3>
        {subtitle ? <span className="t-caption muted">{subtitle}</span> : null}
      </div>
      {actions ? <div className="row gap-4">{actions}</div> : null}
    </header>
  );
}

/* ── badge ───────────────────────────────────────────────────────────────── */

export function Badge({
  tone = "neutral",
  dot,
  children,
}: PropsWithChildren<{ tone?: "neutral" | "success" | "warning" | "info" | "accent"; dot?: boolean }>) {
  return (
    <span className={`badge ${tone === "neutral" ? "" : tone}`}>
      {dot ? <span className="dot" /> : null}
      {children}
    </span>
  );
}

const STATUS_TONE = {
  OPEN: "info",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "accent",
} as const;

export function StatusBadge({ status }: { status: keyof typeof STATUS_TONE }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: "OWNER" | "MANAGER" | "MEMBER" }) {
  return (
    <Badge tone={role === "OWNER" ? "accent" : role === "MANAGER" ? "info" : "neutral"}>
      {role.charAt(0) + role.slice(1).toLowerCase()}
    </Badge>
  );
}

/* ── avatar ──────────────────────────────────────────────────────────────── */

export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span className={`avatar ${size === "md" ? "" : size}`} aria-hidden>
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}

export function Person({
  name,
  meta,
  src,
}: {
  name: string;
  meta?: ReactNode;
  src?: string | null;
}) {
  return (
    <div className="row gap-5">
      <Avatar name={name} src={src} />
      <div className="stack">
        <span className="t-label">{name}</span>
        {meta ? <span className="t-caption muted">{meta}</span> : null}
      </div>
    </div>
  );
}

/* ── stat ────────────────────────────────────────────────────────────────── */

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint ? <span className="t-caption muted">{hint}</span> : null}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(value * 100)}>
      <span style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

/* ── form ────────────────────────────────────────────────────────────────── */

export function Field({
  label,
  error,
  hint,
  children,
}: PropsWithChildren<{ label: string; error?: string | null; hint?: ReactNode }>) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && !error ? <span className="t-caption muted">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`select ${props.className ?? ""}`} />;
}

/* ── modal ───────────────────────────────────────────────────────────────── */

export function Modal({
  title,
  onClose,
  children,
  footer,
}: PropsWithChildren<{ title: string; onClose: () => void; footer?: ReactNode }>) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="modal-scrim"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
        {footer ? <div className="row end gap-5">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ── states ──────────────────────────────────────────────────────────────── */

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="t-title3">{title}</span>
      {hint ? <span className="t-body-sm muted">{hint}</span> : null}
      {action}
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="empty">
      <span className="spinner" />
      <span className="t-body-sm muted">{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty">
      <span className="t-title3">That did not load</span>
      <span className="t-body-sm muted">{message}</span>
      {onRetry ? <Button onClick={onRetry}>Try again</Button> : null}
    </div>
  );
}
