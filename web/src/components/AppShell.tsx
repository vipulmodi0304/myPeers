import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DropdownMenu } from "radix-ui";
import { BookOpen, LogOut, MessageCircle, Monitor, Moon, Plus, Sun, User, Users, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useMe, useSetMe } from "@/lib/auth";
import { courseVars } from "@/lib/courseColor";
import { cn } from "@/lib/format";
import { useSocket, useSocketEvent } from "@/lib/socket";
import { useTheme } from "@/lib/theme";
import type { Message, RoomSummary } from "@/lib/types";
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

export function useRooms() {
  return useQuery({ queryKey: ["rooms"], queryFn: async () => (await api.get<{ rooms: RoomSummary[] }>("/api/rooms")).rooms });
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

  const offline = socket && !connected;

  return (
    <div className="flex h-dvh bg-canvas">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-line md:flex">
        <div className="flex h-14 items-center px-5">
          <Link to="/app" aria-label="myPeers home">
            <Logo />
          </Link>
        </div>
        <nav className="space-y-px px-2.5" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[14px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink",
                  isActive && "bg-surface-3/70 text-ink",
                )
              }
            >
              <Icon className="size-4 opacity-80" />
              <span className="flex-1">{label}</span>
              {to === "/app/messages" && unread > 0 ? <Count n={unread} /> : null}
            </NavLink>
          ))}
        </nav>
        <SidebarRooms />
        <div className="mt-auto border-t border-line p-2.5">
          {offline ? (
            <p className="mb-2 flex items-center gap-1.5 px-2.5 text-[12.5px] text-amber" role="status">
              <WifiOff className="size-3.5" /> Reconnecting
            </p>
          ) : null}
          {me ? <UserMenu name={me.name} isDemo={me.isDemo} wide /> : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {me?.isDemo ? <DemoBanner /> : null}

        {/* Top bar (phones) */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4 md:hidden">
          <Link to="/app" aria-label="myPeers home">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            {offline ? <WifiOff className="size-4 text-amber" aria-label="Reconnecting" /> : null}
            {me ? <UserMenu name={me.name} isDemo={me.isDemo} /> : null}
          </div>
        </header>

        <main id="main" className="min-h-0 flex-1 overflow-y-auto bg-surface md:rounded-tl-xl md:border-t md:border-l md:border-line md:mt-2">
          {children}
        </main>

        {/* Bottom tabs (phones) */}
        <nav className="grid shrink-0 grid-cols-3 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-ink-3", isActive && "text-ink")}
            >
              <span className="relative">
                <Icon className="size-5" />
                {to === "/app/messages" && unread > 0 ? (
                  <span className="absolute -top-1 -right-2.5 min-w-4 rounded-full bg-brand px-1 text-center text-[10px] leading-4 font-semibold text-white">
                    {unread}
                  </span>
                ) : null}
              </span>
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

function DemoBanner() {
  return (
    <div className="flex shrink-0 items-center justify-between gap-4 px-4 py-2 text-[13px] text-ink-2 md:px-6">
      <p>
        <span className="font-semibold text-ink">Demo.</span>{" "}
        <span className="sm:hidden">Everyone here is a sample classmate.</span>
        <span className="hidden sm:inline">Everyone here is a sample classmate, and the demo resets after a day.</span>
      </p>
      <Link to="/signup" className="shrink-0 font-semibold text-ink underline decoration-line-strong underline-offset-3 hover:decoration-ink">
        <span className="sm:hidden">Sign up</span>
        <span className="hidden sm:inline">Sign up with McGill email</span>
      </Link>
    </div>
  );
}

function SidebarRooms() {
  const { data: rooms = [] } = useRooms();
  return (
    <div className="mt-6 min-h-0 overflow-y-auto px-2.5">
      <div className="flex items-center justify-between px-2.5 pb-1">
        <p className="text-[12.5px] font-medium text-ink-3">Your rooms</p>
        <Link to="/app/rooms?new=1" className="grid size-6 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="New room">
          <Plus className="size-3.5" />
        </Link>
      </div>
      {rooms.length === 0 ? (
        <p className="px-2.5 py-1 text-[13px] text-ink-3">None yet</p>
      ) : (
        <ul className="space-y-px">
          {rooms.slice(0, 8).map((r) => (
            <li key={r.id}>
              <NavLink
                to={`/app/rooms/${r.code}`}
                className={({ isActive }) =>
                  cn(
                    "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] text-ink-2 hover:bg-surface-2 hover:text-ink",
                    isActive && "bg-surface-3/70 text-ink",
                  )
                }
              >
                <span style={courseVars(r.courseCode)} className={cn("size-2 shrink-0 rounded-[3px]", r.courseCode ? "bg-course" : "bg-ink-3")} />
                <span className="truncate">{r.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="min-w-5 rounded-full bg-brand px-1.5 text-center text-[11px] leading-5 font-semibold text-white tabular">
      {n > 99 ? "99+" : n}
      <span className="sr-only"> unread</span>
    </span>
  );
}

function UserMenu({ name, isDemo, wide }: { name: string; isDemo: boolean; wide?: boolean }) {
  const setMe = useSetMe();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const signOut = async () => {
    await api.post("/api/auth/logout").catch(() => {});
    setMe(null);
    navigate("/");
  };

  const item = "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[14px] outline-none data-[highlighted]:bg-surface-2";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn("flex items-center gap-2.5 rounded-md hover:bg-surface-2", wide ? "h-10 w-full px-2" : "p-0.5")}
          aria-label="Account menu"
        >
          <Avatar name={name} size={wide ? 26 : 28} />
          {wide ? <span className="truncate text-[14px] font-medium">{name}</span> : null}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={wide ? "start" : "end"}
          side={wide ? "top" : "bottom"}
          sideOffset={6}
          className="z-50 w-56 rounded-lg border border-line bg-surface p-1 shadow-pop"
        >
          <DropdownMenu.Item className={item} onSelect={() => navigate("/app/profile")}>
            <User className="size-4 text-ink-2" /> Profile
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Label className="px-2.5 pt-1 pb-1 text-[12px] text-ink-3">Appearance</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
            {(
              [
                ["light", "Light", Sun],
                ["dark", "Dark", Moon],
                ["system", "Match my device", Monitor],
              ] as const
            ).map(([value, label, Icon]) => (
              <DropdownMenu.RadioItem key={value} value={value} className={cn(item, "data-[state=checked]:font-semibold")}>
                <Icon className="size-4 text-ink-2" /> {label}
                <DropdownMenu.ItemIndicator className="ml-auto size-1.5 rounded-full bg-ink" />
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item className={cn(item, "text-brand")} onSelect={signOut}>
            <LogOut className="size-4" /> {isDemo ? "Leave the demo" : "Sign out"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
