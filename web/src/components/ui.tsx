import { Dialog as RDialog } from "radix-ui";
import { X } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { courseVars } from "@/lib/courseColor";
import { cn, initials } from "@/lib/format";

/* ---------- Button ---------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "brand" | "sticker" | "secondary" | "ghost" | "danger" | "red";
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
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-45",
        {
          // Primary and sticker buttons are physical: they lift on hover and sink into their shadow when pressed.
          primary: "press border-2 border-ink bg-ink text-canvas shadow-hard-sm",
          brand: "press border-2 border-ink bg-ink text-canvas shadow-hard-sm",
          sticker: "press border-2 border-ink bg-surface text-ink shadow-hard-sm",
          red: "border-2 border-transparent bg-brand text-white hover:bg-brand/90",
          secondary: "border-2 border-line-strong bg-surface text-ink hover:border-ink-3",
          ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
          danger: "text-brand hover:bg-brand-soft",
        }[variant],
        {
          sm: "h-8 px-3.5 text-[13px]",
          md: "h-10 px-4.5 text-[14px]",
          lg: "h-12 px-6 text-[15.5px]",
          icon: "size-10 p-0",
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
  "w-full rounded-xl border-[1.5px] border-line-strong bg-surface px-3.5 h-11 text-[15px] text-ink placeholder:text-ink-3 " +
  "focus:outline-none focus:border-ink focus:ring-4 focus:ring-focus/15 transition-[border,box-shadow] duration-150 " +
  "aria-[invalid=true]:border-brand";

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
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[13px] text-brand" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-ink-3">{hint}</p>
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
    <div className="grid min-h-[60dvh] place-items-center text-ink-3" role="status" aria-label="Loading">
      <Spinner className="size-5" />
    </div>
  );
}

/**
 * Initials avatar. Given a course, it takes that course's colour, so you can
 * tell at a glance who is studying what. Without one it stays neutral.
 */
export function Avatar({
  name,
  size = 32,
  live,
  course,
  className,
}: {
  name: string;
  size?: number;
  live?: boolean;
  course?: string | null;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size, ...courseVars(course) }}>
      <span
        className={cn(
          "inline-flex size-full items-center justify-center rounded-full font-semibold",
          course ? "bg-course-soft text-course" : "bg-surface-3 text-ink-2",
        )}
        style={{ fontSize: Math.round(size * 0.38), letterSpacing: "0.01em" }}
        aria-hidden
      >
        {initials(name)}
      </span>
      {live ? (
        <span
          className="absolute -right-px -bottom-px rounded-full border-2 border-surface bg-green"
          style={{ width: Math.max(9, size * 0.3), height: Math.max(9, size * 0.3) }}
          aria-label="Online"
        />
      ) : null}
    </span>
  );
}

/** A course code printed as a sticker in its course colour. */
export function CourseTag({
  code,
  size = "md",
  className,
  quiet,
}: {
  code: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Tinted instead of filled, for places where many tags sit together. */
  quiet?: boolean;
}) {
  return (
    <span
      style={courseVars(code)}
      className={cn(
        "course-code inline-flex items-center whitespace-nowrap",
        quiet ? "bg-course-soft text-course" : "bg-course-fill text-white",
        {
          sm: "rounded-[5px] px-1.5 py-px text-[13px]",
          md: "rounded-md px-2 py-0.5 text-[16px]",
          lg: "rounded-lg px-2.5 py-1 text-[22px] leading-none",
        }[size],
        className,
      )}
    >
      {code}
    </span>
  );
}

/** Studying: a small live dot. On a break: amber words. No pill. */
export function StatusPill({ status }: { status: "studying" | "break" }) {
  return status === "studying" ? (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2">
      <span className="live-dot size-1.5 rounded-full bg-green" />
      Studying
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-amber">
      <span className="size-1.5 rounded-full bg-amber" />
      On a break
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <svg viewBox="0 0 32 20" className="h-[17px] w-auto" aria-hidden>
        <circle cx="10" cy="10" r="8.5" className="fill-ink" />
        <circle cx="22" cy="10" r="8.5" className="fill-brand stroke-ink" strokeWidth="2" />
      </svg>
      <span className="display text-[21px] leading-none">myPeers</span>
    </span>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon ? <div className="mb-4 grid size-14 place-items-center rounded-full bg-surface-2 text-ink-2">{icon}</div> : null}
      <p className="display text-[22px] leading-tight">{title}</p>
      {children ? <div className="mt-1 max-w-sm text-[14px] text-ink-2">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Page title row used across the app. */
export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="display text-[32px] leading-none sm:text-[38px]">{title}</h1>
        {sub ? <p className="mt-2 text-[14.5px] text-ink-2">{sub}</p> : null}
      </div>
      {actions ? <div className="flex w-full items-center gap-2 sm:w-auto">{actions}</div> : null}
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
        <RDialog.Overlay className="anim-overlay fixed inset-0 z-40 bg-[#100d16]/45" />
        <RDialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2",
            "anim-dialog rounded-2xl border-2 border-ink bg-surface p-5 shadow-hard-lg focus:outline-none sm:p-6",
            className,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <RDialog.Title className="display text-[24px] leading-tight">{title}</RDialog.Title>
              {description ? <RDialog.Description className="mt-0.5 text-[14px] text-ink-2">{description}</RDialog.Description> : null}
            </div>
            <RDialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close" className="-mt-1.5 -mr-2">
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
