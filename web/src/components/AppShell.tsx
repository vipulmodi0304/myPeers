import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DropdownMenu } from "radix-ui";
import { BookOpen, LogOut, MessageCircle, Monitor, Moon, Sun, User, Users, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useMe, useSetMe } from "@/lib/auth";
import { cn } from "@/lib/format";
import { useSocket, useSocketEvent } from "@/lib/socket";
import { useTheme } from "@/lib/theme";
import type { Message } from "@/lib/types";
import { Avatar, Logo } from "./ui";

const NAV = [
  { to: "/app", label: "Study now", icon: BookOpen, end: true },
  { to: "/app/rooms", label: "Rooms", icon: Users, end: false },
  { to: "/app/messages", label: "Messages", icon: MessageCircle, end: false },
] as const;

export function useUnread() {
  return useQuery({
    queryKey: ["unread"],
    queryFn: async () => (await api.get<{ unread: number }>("/api/conversations/unread-count")).unread,
  });
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const { connected, socket } = useSocket();
  const { data: unread = 0 } = useUnread();
  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  // Any new message or read receipt changes the inbox and the badge.
  useSocketEvent<Message & { senderName?: string }>("dm:new", (m) => {
    void qc.invalidateQueries({ queryKey: ["unread"] });
    void qc.invalidateQueries({ queryKey: ["conversations"] });
    const fromOther = m.senderId !== me?.id;
    const viewing = location.pathname === `/app/messages/${m.senderId}`;
    if (fromOther && !viewing) {
      toast(m.senderName ?? "New message", {
        description: m.body ? m.body.slice(0, 90) : "Sent you a file",
        action: { label: "Reply", onClick: () => navigate(`/app/messages/${m.senderId}`) },
      });
    }
  });
  useSocketEvent("dm:read", () => {
    void qc.invalidateQueries({ queryKey: ["unread"] });
    void qc.invalidateQueries({ queryKey: ["conversations"] });
  });

  return (
    <div className="flex h-dvh flex-col">
      {me?.isDemo ? (
        <div className="shrink-0 bg-ink text-paper">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 text-[13px]">
            <p>
              <span className="sm:hidden">Demo mode: everyone here is a sample classmate.</span>
              <span className="hidden sm:inline">You're exploring the demo. Everyone here is a sample classmate, and the demo resets after a day.</span>
            </p>
            <Link to="/signup" className="font-semibold underline underline-offset-2">
              <span className="sm:hidden">Sign up</span>
              <span className="hidden sm:inline">Sign up with your McGill email</span>
            </Link>
          </div>
        </div>
      ) : null}

      <header className="z-20 shrink-0 border-b border-line bg-paper">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link to="/app" aria-label="myPeers home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "relative rounded-md px-3 py-1.5 text-sm font-semibold text-slate hover:text-ink",
                    isActive && "text-ink after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:bg-ink",
                  )
                }
              >
                {label}
                {to === "/app/messages" && unread > 0 ? <Badge count={unread} /> : null}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {socket && !connected ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-amber" role="status">
                <WifiOff className="size-3.5" /> Reconnecting
              </span>
            ) : null}
            {me ? <UserMenu name={me.name} isDemo={me.isDemo} /> : null}
          </div>
        </div>
      </header>

      <main id="main" className="min-h-0 flex-1 overflow-y-auto">{children}</main>

      <nav
        className="grid shrink-0 grid-cols-3 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Main"
      >
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-slate", isActive && "text-ink")
            }
          >
            <span className="relative">
              <Icon className="size-5" />
              {to === "/app/messages" && unread > 0 ? (
                <span className="absolute -top-1 -right-2 min-w-4 rounded-full bg-red px-1 text-center text-[10px] leading-4 text-white">
                  {unread}
                </span>
              ) : null}
            </span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function Badge({ count }: { count: number }) {
  return (
    <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-red px-1.5 text-[11px] leading-5 text-white tabular">
      {count > 99 ? "99+" : count}
      <span className="sr-only"> unread</span>
    </span>
  );
}

function UserMenu({ name, isDemo }: { name: string; isDemo: boolean }) {
  const setMe = useSetMe();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const signOut = async () => {
    await api.post("/api/auth/logout").catch(() => {});
    setMe(null);
    navigate("/");
  };

  const item = "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-surface-2";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-ink/5" aria-label="Account menu">
          <Avatar name={name} size={30} />
          <span className="hidden max-w-36 truncate text-sm font-semibold sm:block">{name}</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-panel">
          <DropdownMenu.Item className={item} onSelect={() => navigate("/app/profile")}>
            <User className="size-4" /> Profile
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Label className="px-2.5 pt-1 pb-1.5 text-[12px] text-slate">Appearance</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
            {(
              [
                ["light", "Light", Sun],
                ["dark", "Dark", Moon],
                ["system", "Match my device", Monitor],
              ] as const
            ).map(([value, label, Icon]) => (
              <DropdownMenu.RadioItem key={value} value={value} className={cn(item, "data-[state=checked]:font-semibold")}>
                <Icon className="size-4" /> {label}
                <DropdownMenu.ItemIndicator className="ml-auto size-1.5 rounded-full bg-ink" />
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item className={cn(item, "text-red")} onSelect={signOut}>
            <LogOut className="size-4" /> {isDemo ? "Leave the demo" : "Sign out"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
