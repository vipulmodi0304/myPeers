import { Dialog as RDialog } from "radix-ui";
import { X } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { cn, initials } from "@/lib/format";

/* ---------- Button ---------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "red";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        {
          primary: "bg-ink text-paper hover:bg-ink/85",
          red: "bg-red text-white hover:bg-red/90",
          secondary: "bg-surface text-ink border border-line hover:border-slate/50 hover:bg-surface-2",
          ghost: "text-ink hover:bg-ink/6",
          danger: "text-red hover:bg-red-soft",
        }[variant],
        {
          sm: "h-8 px-3 text-[13px]",
          md: "h-10 px-4 text-sm",
          lg: "h-12 px-5 text-[15px]",
          icon: "h-9 w-9 p-0",
        }[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </button>
  );
});

/* ---------- Inputs ---------- */

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 h-10 text-[15px] text-ink placeholder:text-slate/70 " +
  "focus:outline-none focus:border-focus focus:ring-3 focus:ring-focus/20 transition-[border,box-shadow] " +
  "aria-[invalid=true]:border-red";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputClass, className)} {...props} />;
});

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  htmlFor: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[13px] text-red" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-slate">{hint}</p>
      ) : null}
    </div>
  );
}

/* ---------- Bits ---------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function FullPageSpinner() {
  return (
    <div className="grid min-h-[60dvh] place-items-center text-slate" role="status" aria-label="Loading">
      <Spinner className="size-6" />
    </div>
  );
}

const AVATAR_TONES = [
  "bg-[#dfe6f3] text-[#23345e] dark:bg-[#26334d] dark:text-[#c9d6f0]",
  "bg-[#e6eedf] text-[#2f4a1e] dark:bg-[#273626] dark:text-[#cfe3c4]",
  "bg-[#f3e4dc] text-[#5e2f1d] dark:bg-[#3a2a24] dark:text-[#f0d2c4]",
  "bg-[#ece2f1] text-[#48275a] dark:bg-[#33263b] dark:text-[#e1cdec]",
  "bg-[#e0eeee] text-[#1d4a4a] dark:bg-[#213536] dark:text-[#c3e4e4]",
];

export function Avatar({ name, size = 36, live, className }: { name: string; size?: number; live?: boolean; className?: string }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <span
        className={cn("inline-flex size-full items-center justify-center rounded-full font-bold condensed", AVATAR_TONES[h % AVATAR_TONES.length])}
        style={{ fontSize: size * 0.38 }}
        aria-hidden
      >
        {initials(name)}
      </span>
      {live ? (
        <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-surface bg-green" aria-label="Online" />
      ) : null}
    </span>
  );
}

/** Small status label: red "live" dot while studying, amber while on a break. */
export function StatusPill({ status }: { status: "studying" | "break" }) {
  return status === "studying" ? (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-red">
      <span className="live-dot size-1.5 rounded-full bg-red" />
      Studying
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-2 py-0.5 text-[12px] font-semibold text-amber">
      On a break
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <svg viewBox="0 0 34 20" className="h-[18px] w-auto" aria-hidden>
        <circle cx="10" cy="10" r="9" className="fill-ink" />
        <circle cx="24" cy="10" r="9" className="fill-red" />
      </svg>
      <span className="text-[19px] font-extrabold tracking-tight" style={{ fontStretch: "88%" }}>
        myPeers
      </span>
    </span>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon ? <div className="mb-4 text-slate">{icon}</div> : null}
      <p className="text-[17px] font-bold">{title}</p>
      {children ? <div className="mt-1.5 max-w-sm text-sm text-slate">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ---------- Dialog (Radix handles focus trapping, Escape and aria) ---------- */

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-[#0b1020]/45 backdrop-blur-[2px]" />
        <RDialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-2xl border border-line bg-surface p-6 shadow-panel focus:outline-none",
            className,
          )}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <RDialog.Title className="text-lg font-bold">{title}</RDialog.Title>
              {description ? <RDialog.Description className="mt-1 text-sm text-slate">{description}</RDialog.Description> : null}
            </div>
            <RDialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close" className="-mt-1 -mr-2">
                <X className="size-4" />
              </Button>
            </RDialog.Close>
          </div>
          {children}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
