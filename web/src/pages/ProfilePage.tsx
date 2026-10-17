import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Avatar, Button, Dialog, Field, Input } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useMe, useSetMe } from "@/lib/auth";
import type { Me } from "@/lib/types";

export default function ProfilePage() {
  const { data: me } = useMe();
  if (!me) return null;
  return (
    <div className="mx-auto max-w-[640px] space-y-10 px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex items-center gap-4">
        <Avatar name={me.name} size={64} />
        <div className="min-w-0">
          <h1 className="display truncate text-[34px] leading-none">{me.name}</h1>
          <p className="text-sm text-ink-2">{me.isDemo ? "Demo account" : me.email}</p>
        </div>
      </div>
      <NameForm me={me} />
      {me.isDemo ? (
        <section className="sticker rounded-[22px] bg-surface p-5 sm:p-6">
          <h2 className="display text-[22px]">This is a demo account</h2>
          <p className="mt-1 text-sm text-ink-2">It has no password and is deleted after a day. McGill students can create a real account in under a minute.</p>
          <Link to="/signup" className="mt-4 inline-block">
            <Button>Sign up with McGill email</Button>
          </Link>
        </section>
      ) : (
        <>
          <PasswordForm />
          <DangerZone />
        </>
      )}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border-t-[1.5px] border-line pt-7">
      <h2 className="display text-[22px] leading-tight">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-ink-2">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function NameForm({ me }: { me: Me }) {
  const setMe = useSetMe();
  const [name, setName] = useState(me.name);
  const save = useMutation({
    mutationFn: () => api.patch<{ user: Me }>("/api/me", { name }),
    onSuccess: ({ user }) => {
      setMe(user);
      toast.success("Name saved");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  return (
    <Section title="Display name" description="Shown to classmates on your check-in and in chats.">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label htmlFor="display-name" className="sr-only">
          Display name
        </label>
        <Input id="display-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" variant="secondary" loading={save.isPending} disabled={!name.trim() || name.trim() === me.name}>
          Save name
        </Button>
      </form>
    </Section>
  );
}

function PasswordForm() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const save = useMutation({
    mutationFn: () => api.post("/api/me/password", form),
    onSuccess: () => {
      setForm({ currentPassword: "", newPassword: "" });
      toast.success("Password changed");
    },
  });
  return (
    <Section title="Password">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Current password" htmlFor="cur-pw">
          <Input id="cur-pw" type="password" autoComplete="current-password" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        </Field>
        <Field label="New password" htmlFor="new-pw" hint="At least 8 characters." error={save.error ? errorMessage(save.error) : null}>
          <Input id="new-pw" type="password" autoComplete="new-password" required minLength={8} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
        </Field>
        <Button type="submit" variant="secondary" loading={save.isPending}>
          Change password
        </Button>
      </form>
    </Section>
  );
}

function DangerZone() {
  const setMe = useSetMe();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const del = useMutation({
    mutationFn: () => api.delete("/api/me", { password }),
    onSuccess: () => {
      setMe(null);
      navigate("/");
      toast("Your account and everything in it has been deleted.");
    },
  });
  return (
    <Section title="Delete account" description="Removes your account, check-in, messages, files and rooms you're alone in. This can't be undone.">
      <Button variant="danger" className="border-2 border-red/40" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Delete your account?" description="Enter your password to confirm. Everything is removed right away.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            del.mutate();
          }}
        >
          <Field label="Password" htmlFor="del-pw" error={del.error ? errorMessage(del.error) : null}>
            <Input id="del-pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Keep my account
            </Button>
            <Button type="submit" variant="red" loading={del.isPending}>
              Delete account
            </Button>
          </div>
        </form>
      </Dialog>
    </Section>
  );
}
