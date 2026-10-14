import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button, Field, FullPageSpinner, Input, Logo } from "@/components/ui";
import { api, ApiError, errorMessage } from "@/lib/api";
import { canUseApp, useMe, useSetMe } from "@/lib/auth";
import type { Me } from "@/lib/types";

type AuthResponse = { user: Me; needsVerification?: boolean };

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 py-5">
        <Link to="/" aria-label="myPeers home">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-14">
        <div className="w-full max-w-[400px]">
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight" style={{ fontStretch: "90%" }}>
            {title}
          </h1>
          {subtitle ? <p className="mt-2 text-slate">{subtitle}</p> : null}
          <div className="mt-7">{children}</div>
          {footer ? <div className="mt-8 text-sm text-slate">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}

function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-soft px-3 py-2.5 text-sm text-red">
      {errorMessage(error)}
    </p>
  );
}

export function useStartDemo() {
  const setMe = useSetMe();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => api.post<AuthResponse>("/api/auth/demo"),
    onSuccess: ({ user }) => {
      setMe(user);
      navigate("/app");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}

/* ---------------- Sign in ---------------- */

export function LoginPage() {
  const setMe = useSetMe();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const demo = useStartDemo();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation({
    mutationFn: () => api.post<AuthResponse>("/api/auth/login", { email, password }),
    onSuccess: ({ user, needsVerification }) => {
      setMe(user);
      const next = params.get("next");
      navigate(needsVerification ? "/verify" : next?.startsWith("/app") ? next : "/app");
    },
  });

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to see who's studying your courses."
      footer={
        <>
          New to myPeers?{" "}
          <Link to="/signup" className="font-semibold text-ink underline underline-offset-2">
            Create an account
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          login.mutate();
        }}
      >
        <Field label="McGill email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="first.last@mail.mcgill.ca" />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          hint={
            <Link to="/forgot-password" className="font-semibold text-ink underline-offset-2 hover:underline">
              Forgot your password?
            </Link>
          }
        >
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <FormError error={login.error} />
        <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
          Sign in
        </Button>
      </form>
      <DemoDivider onClick={() => demo.mutate()} loading={demo.isPending} />
    </AuthLayout>
  );
}

function DemoDivider({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <div className="mt-8 border-t border-line pt-6">
      <p className="text-sm text-slate">Not at McGill, or just looking around?</p>
      <Button variant="secondary" size="lg" className="mt-3 w-full" onClick={onClick} loading={loading}>
        Try the demo
      </Button>
    </div>
  );
}

/* ---------------- Sign up ---------------- */

export function SignupPage() {
  const setMe = useSetMe();
  const navigate = useNavigate();
  const demo = useStartDemo();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const signup = useMutation({
    mutationFn: () => api.post<AuthResponse>("/api/auth/signup", form),
    onSuccess: ({ user, needsVerification }) => {
      setMe(user);
      navigate(needsVerification ? "/verify" : "/app");
    },
  });
  const takenEmail = signup.error instanceof ApiError && signup.error.code === "email_taken";

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Only McGill students can join, so everyone you see is a real classmate."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-ink underline underline-offset-2">
            Sign in
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          signup.mutate();
        }}
      >
        <Field label="Your name" htmlFor="name" hint="Classmates see this next to your course.">
          <Input id="name" autoComplete="name" required maxLength={60} value={form.name} onChange={set("name")} />
        </Field>
        <Field label="McGill email" htmlFor="email" hint="We'll send a 6-digit code to confirm it's you.">
          <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={set("email")} placeholder="first.last@mail.mcgill.ca" />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set("password")} />
        </Field>
        {takenEmail ? (
          <p role="alert" className="rounded-lg bg-red-soft px-3 py-2.5 text-sm text-red">
            You already have an account.{" "}
            <Link to="/login" className="font-semibold underline">
              Sign in instead
            </Link>
          </p>
        ) : (
          <FormError error={signup.error} />
        )}
        <Button type="submit" size="lg" className="w-full" loading={signup.isPending}>
          Create account
        </Button>
      </form>
      <DemoDivider onClick={() => demo.mutate()} loading={demo.isPending} />
    </AuthLayout>
  );
}

/* ---------------- Verify email ---------------- */

function CodeInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      className="h-14 text-center text-[28px] font-bold tracking-[0.5em] tabular"
      placeholder="······"
    />
  );
}

export function VerifyPage() {
  const { data: me, isLoading } = useMe();
  const setMe = useSetMe();
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const verify = useMutation({
    mutationFn: () => api.post<AuthResponse>("/api/auth/verify", { code }),
    onSuccess: ({ user }) => {
      setMe(user);
      toast.success("Email verified. Welcome to myPeers!");
      navigate("/app");
    },
  });
  const resend = useMutation({
    mutationFn: () => api.post("/api/auth/verify/resend"),
    onSuccess: () => toast.success("New code sent."),
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <FullPageSpinner />;
  if (!me) return <Navigate to="/login" replace />;
  if (canUseApp(me)) return <Navigate to="/app" replace />;

  return (
    <AuthLayout
      title="Check your inbox"
      subtitle={
        <>
          We sent a 6-digit code to <strong className="text-ink">{me.email}</strong>. It expires in 15 minutes.
        </>
      }
      footer={
        <button
          className="font-semibold text-ink underline underline-offset-2"
          onClick={async () => {
            await api.post("/api/auth/logout");
            setMe(null);
            navigate("/signup");
          }}
        >
          Wrong email? Start over
        </button>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          verify.mutate();
        }}
      >
        <Field label="Verification code" htmlFor="code">
          <CodeInput id="code" value={code} onChange={setCode} />
        </Field>
        <FormError error={verify.error} />
        <Button type="submit" size="lg" className="w-full" disabled={code.length !== 6} loading={verify.isPending}>
          Verify email
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => resend.mutate()} loading={resend.isPending}>
          Send a new code
        </Button>
      </form>
    </AuthLayout>
  );
}

/* ---------------- Forgot / reset password ---------------- */

export function ForgotPasswordPage() {
  const setMe = useSetMe();
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const request = useMutation({
    mutationFn: () => api.post("/api/auth/password/forgot", { email }),
    onSuccess: () => setStep("reset"),
  });
  const reset = useMutation({
    mutationFn: () => api.post<AuthResponse>("/api/auth/password/reset", { email, code, password }),
    onSuccess: ({ user }) => {
      setMe(user);
      toast.success("Password changed. You're signed in.");
      navigate("/app");
    },
  });

  if (step === "email") {
    return (
      <AuthLayout
        title="Reset your password"
        subtitle="Enter your McGill email and we'll send you a code."
        footer={
          <Link to="/login" className="font-semibold text-ink underline underline-offset-2">
            Back to sign in
          </Link>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            request.mutate();
          }}
        >
          <Field label="McGill email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <FormError error={request.error} />
          <Button type="submit" size="lg" className="w-full" loading={request.isPending}>
            Send code
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle={
        <>
          If <strong className="text-ink">{email}</strong> has an account, a code is on its way.
        </>
      }
      footer={
        <button className="font-semibold text-ink underline underline-offset-2" onClick={() => setStep("email")}>
          Use a different email
        </button>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          reset.mutate();
        }}
      >
        <Field label="Code from the email" htmlFor="code">
          <CodeInput id="code" value={code} onChange={setCode} />
        </Field>
        <Field label="New password" htmlFor="password" hint="At least 8 characters.">
          <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <FormError error={reset.error} />
        <Button type="submit" size="lg" className="w-full" disabled={code.length !== 6} loading={reset.isPending}>
          Change password
        </Button>
      </form>
    </AuthLayout>
  );
}
