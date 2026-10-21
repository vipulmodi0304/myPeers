import { Dialog as RDialog } from "radix-ui";
import { X } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode } from "react";
import { courseVars } from "@/lib/courseColor";
import { cn, initials } from "@/lib/format";

/* ---------- Button ---------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * primary: a swipe of yellow highlighter, for the one main action on a screen.
   * secondary: a ruled box. ghost: text only. danger: red pen. red: solid, for confirming a delete.
   */
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
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-45",
        {
          primary: "btn-ink font-bold",
          secondary: "rounded-lg border-[1.5px] border-rule-strong bg-paper text-ink hover:border-ink hover:bg-paper-2",
          ghost: "rounded-lg text-ink-2 hover:bg-paper-2 hover:text-ink",
          danger: "rounded-lg text-red hover:bg-red-soft",
          red: "rounded-lg bg-red text-white hover:bg-red/90",
        }[variant],
        {
          sm: "h-8 px-3 text-[13px]",
          md: "h-10 px-4 text-[14px]",
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
  "w-full rounded-lg border-[1.5px] border-rule-strong bg-paper px-3.5 h-11 text-[15px] text-ink placeholder:text-ink-3 " +
  "hover:border-ink-3 focus:outline-none focus:border-ink focus:ring-[3px] focus:ring-pen/20 transition-[border,box-shadow] duration-150 " +
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
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[13px] font-medium text-red" role="alert">
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
 * Initials avatar. Given a course, it takes a wash of that course's ink, so
 * you can tell at a glance who is studying what. Without one it stays neutral.
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
          "inline-flex size-full items-center justify-center rounded-full font-bold",
          course ? "bg-course-soft text-course" : "bg-paper-2 text-ink-2 ring-1 ring-rule ring-inset",
        )}
        style={{ fontSize: Math.round(size * 0.37), fontVariationSettings: '"wdth" 110' }}
        aria-hidden
      >
        {initials(name)}
      </span>
      {live ? (
        <span
          className="absolute -right-px -bottom-px rounded-full border-2 border-paper bg-live"
          style={{ width: Math.max(9, size * 0.3), height: Math.max(9, size * 0.3) }}
          aria-label="Online"
        />
      ) : null}
    </span>
  );
}

/** A course code, highlighted in its course's ink. */
export function CourseTag({
  code,
  size = "md",
  className,
  quiet,
  swipe,
}: {
  code: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Half-height swipe in the course ink, for places where many codes sit together. */
  quiet?: boolean;
  /** Draw the band in, for something that just happened. */
  swipe?: boolean;
}) {
  return (
    <span
      style={courseVars(code)}
      className={cn(
        "code hl inline-block whitespace-nowrap",
        quiet && "hl-low",
        swipe && "swipe",
        {
          sm: "text-[12.5px]",
          md: "text-[14.5px]",
          lg: "text-[20px]",
        }[size],
        className,
      )}
    >
      {code}
    </span>
  );
}

/** Studying: a small live dot. On a break: amber words. */
export function StatusPill({ status }: { status: "studying" | "break" }) {
  return status === "studying" ? (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2">
      <span className="live-dot size-1.5 rounded-full bg-live" />
      Studying
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-warn">
      <span className="size-1.5 rounded-full bg-warn" />
      On a break
    </span>
  );
}

/** The wordmark: "my" in toner, "Peers" highlighted in yellow. */
export function Logo({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn("inline-flex items-baseline leading-none font-extrabold text-ink", className)}
      style={{ fontSize: size, fontVariationSettings: '"wdth" 112', letterSpacing: "-0.025em" } as CSSProperties}
    >
      my<span className="hl" style={{ "--hl": "var(--you)" } as CSSProperties}>Peers</span>
    </span>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon ? <div className="mb-4 text-ink-3">{icon}</div> : null}
      <p className="heading text-[22px]">{title}</p>
      {children ? <div className="mt-1.5 max-w-sm text-[14px] text-ink-2">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Page title row used across the app. */
export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b-2 border-ink pb-4">
      <div className="min-w-0">
        <h1 className="title text-[34px] sm:text-[42px]">{title}</h1>
        {sub ? <p className="mt-2.5 text-[14.5px] text-ink-2">{sub}</p> : null}
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
        <RDialog.Overlay className="anim-overlay fixed inset-0 z-40 bg-[#0e0f11]/40" />
        <RDialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2",
            "anim-dialog rounded-[14px] border border-rule-strong bg-paper p-5 shadow-sheet focus:outline-none sm:p-6",
            className,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <RDialog.Title className="heading text-[22px]">{title}</RDialog.Title>
              {description ? <RDialog.Description className="mt-1 text-[14px] text-ink-2">{description}</RDialog.Description> : null}
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
