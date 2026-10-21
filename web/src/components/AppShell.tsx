import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DropdownMenu } from "radix-ui";
import { BookOpen, LogOut, MessageCircle, Monitor, Moon, Plus, Sun, User, Users, WifiOff } from "lucide-react";
import { m } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
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
    <div className="flex h-dvh bg-desk">
      {/* Sidebar (desktop): sits on the desk, beside the sheet */}
      <aside className="hidden w-[232px] shrink-0 flex-col md:flex">
        <div className="flex h-16 items-center px-6">
          <Link to="/app" aria-label="myPeers home">
            <Logo />
          </Link>
        </div>
        <nav className="space-y-0.5 px-3" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="group flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] font-semibold">
              {({ isActive }) => (
                <>
                  {/* The icon hops when its page opens. */}
                  <m.span
                    key={isActive ? "on" : "off"}
                    className="inline-flex"
                    initial={false}
                    animate={isActive ? { y: [0, -5, 0], rotate: [0, -10, 0] } : undefined}
                    transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
                  >
                    <Icon className={cn("size-[18px] shrink-0 transition-colors", isActive ? "text-ink" : "text-ink-3 group-hover:text-ink")} strokeWidth={isActive ? 2.3 : 2} />
                  </m.span>
                  {/* The active page gets highlighted: the band swipes in each time you switch. */}
                  <span className="flex-1">
                    <span
                      key={isActive ? "on" : "off"}
                      className={cn("transition-colors", isActive ? "hl swipe" : "text-ink-2 group-hover:text-ink")}
                      style={{ "--hl": "var(--you)" } as CSSProperties}
                    >
                      {label}
                    </span>
                  </span>
                  {to === "/app/messages" && unread > 0 ? <Count n={unread} /> : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <SidebarRooms />
        <div className="mt-auto p-3">
          {offline ? (
            <p className="mb-2 flex items-center gap-1.5 px-2.5 text-[12.5px] text-warn" role="status">
              <WifiOff className="size-3.5" /> Reconnecting
            </p>
          ) : null}
          {me ? <UserMenu name={me.name} isDemo={me.isDemo} wide /> : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {me?.isDemo ? <DemoBanner /> : null}

        {/* Top bar (phones) */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-rule bg-paper px-4 md:hidden">
          <Link to="/app" aria-label="myPeers home">
            <Logo size={20} />
          </Link>
          <div className="flex items-center gap-2">
            {offline ? <WifiOff className="size-4 text-warn" aria-label="Reconnecting" /> : null}
            {me ? <UserMenu name={me.name} isDemo={me.isDemo} /> : null}
          </div>
        </header>

        <main
          id="main"
          className="min-h-0 flex-1 overflow-y-auto bg-paper md:mt-3 md:rounded-tl-[14px] md:border-t md:border-l md:border-rule-strong"
        >
          {children}
        </main>

        {/* Bottom tabs (phones) */}
        <nav className="grid shrink-0 grid-cols-3 gap-1 border-t border-rule bg-paper px-2 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] md:hidden" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="flex flex-col items-center gap-1 py-1.5 text-[12px] font-semibold">
              {({ isActive }) => (
                <>
                  <span className={cn("relative", isActive ? "text-ink" : "text-ink-3")}>
                    <Icon className="size-5" strokeWidth={isActive ? 2.4 : 2} />
                    {to === "/app/messages" && unread > 0 ? (
                      <span className="absolute -top-1 -right-2.5 min-w-4 rounded-full bg-red px-1 text-center text-[10px] leading-4 font-bold text-white">
                        {unread}
                      </span>
                    ) : null}
                  </span>
                  <span
                    key={isActive ? "on" : "off"}
                    className={cn(isActive ? "hl swipe" : "text-ink-3")}
                    style={{ "--hl": "var(--you)" } as CSSProperties}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

function DemoBanner() {
  return (
    <div className="flex shrink-0 items-center justify-between gap-4 bg-paper px-4 py-2 text-[13px] text-ink-2 md:bg-transparent md:px-6 md:pt-3 md:pb-0">
      <p className="flex min-w-0 items-center gap-2">
        <span className="hl shrink-0 font-bold" style={{ "--hl": "var(--you)" } as CSSProperties}>
          Demo
        </span>
        <span className="truncate sm:hidden">Everyone here is a sample classmate.</span>
        <span className="hidden truncate sm:inline">Everyone here is a sample classmate, and the demo resets after a day.</span>
      </p>
      <Link to="/signup" className="shrink-0 font-semibold text-pen underline decoration-pen/40 hover:decoration-pen">
        <span className="sm:hidden">Sign up</span>
        <span className="hidden sm:inline">Sign up with McGill email</span>
      </Link>
    </div>
  );
}

function SidebarRooms() {
  const { data: rooms = [] } = useRooms();
  return (
    <div className="mt-7 min-h-0 overflow-y-auto px-3">
      <div className="flex items-center justify-between border-b border-rule-strong px-3 pb-1.5">
        <p className="text-[12.5px] font-semibold text-ink-2">Your rooms</p>
        <Link to="/app/rooms?new=1" className="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-paper hover:text-ink" aria-label="New room">
          <Plus className="size-3.5" />
        </Link>
      </div>
      {rooms.length === 0 ? (
        <p className="px-3 py-2 text-[13px] text-ink-3">None yet</p>
      ) : (
        <ul className="space-y-px pt-1.5">
          {rooms.slice(0, 8).map((r) => (
            <li key={r.id}>
              <NavLink
                to={`/app/rooms/${r.code}`}
                className={({ isActive }) =>
                  cn(
                    "flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium text-ink-2 hover:bg-paper hover:text-ink",
                    isActive && "bg-paper text-ink",
                  )
                }
              >
                <span style={courseVars(r.courseCode)} className={cn("h-2.5 w-3.5 shrink-0 rounded-[3px] -rotate-6", r.courseCode ? "bg-course-band" : "bg-rule-strong")} />
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
    <span className="min-w-5 rounded-full bg-red px-1.5 text-center text-[11px] leading-5 font-bold text-white tabular">
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

  const item = "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] outline-none data-[highlighted]:bg-paper-2";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn("flex items-center gap-2.5 rounded-lg hover:bg-paper", wide ? "h-11 w-full px-1.5" : "rounded-full p-0.5")}
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
          className="anim-menu z-50 w-56 rounded-[10px] border border-rule-strong bg-paper p-1.5 shadow-sheet"
        >
          <DropdownMenu.Item className={item} onSelect={() => navigate("/app/profile")}>
            <User className="size-4 text-ink-2" /> Profile
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-rule" />
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
                <DropdownMenu.ItemIndicator className="ml-auto h-2 w-3 -rotate-6 rounded-[2px] bg-you" />
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="my-1 h-px bg-rule" />
          <DropdownMenu.Item className={cn(item, "text-red")} onSelect={signOut}>
            <LogOut className="size-4" /> {isDemo ? "Leave the demo" : "Sign out"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
