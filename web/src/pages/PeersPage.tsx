import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coffee, MapPin, MessageCircle, Pencil, Plus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CourseInput } from "@/components/CourseInput";
import { Avatar, Button, Empty, Field, Input, StatusPill, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { cn, department, elapsed } from "@/lib/format";
import { checkInKey, shelves, useLivePeers, useMyCheckIn } from "@/lib/peers";
import type { Conversation, Peer, RoomSummary, Status } from "@/lib/types";
import { useNow } from "@/lib/useNow";

const SPOTS = ["McLennan", "Redpath", "Trottier", "Schulich", "Bronfman", "Online"];

export default function PeersPage() {
  const { data: checkIn, isLoading } = useMyCheckIn();
  const [editing, setEditing] = useState(false);

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        {isLoading ? (
          <div className="h-40" />
        ) : !checkIn || editing ? (
          <CheckInForm current={checkIn ?? null} onDone={() => setEditing(false)} />
        ) : (
          <MyCheckIn checkIn={checkIn} onEdit={() => setEditing(true)} />
        )}
        <PeerBoard myCourse={checkIn?.courseCode ?? null} />
      </div>
      <aside className="hidden space-y-8 lg:block">
        <RoomsAside />
        <MessagesAside />
      </aside>
    </div>
  );
}

/* ---------------- Your check-in ---------------- */

function CheckInForm({ current, onDone }: { current: Peer | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [courseCode, setCourse] = useState(current?.courseCode ?? "");
  const [topic, setTopic] = useState(current?.topic ?? "");
  const [location, setLocation] = useState(current?.location ?? "");

  const save = useMutation({
    mutationFn: () => api.put<{ checkIn: Peer }>("/api/check-in", { courseCode, topic, location, status: current?.status ?? "studying" }),
    onSuccess: ({ checkIn }) => {
      qc.setQueryData(checkInKey, checkIn);
      toast.success(current ? "Check-in updated" : `Checked in to ${checkIn.courseCode}`);
      onDone();
    },
  });

  return (
    <section aria-labelledby="checkin-title" className="rounded-2xl border border-line bg-surface p-5 shadow-panel sm:p-6">
      <h1 id="checkin-title" className="text-[22px] font-extrabold tracking-tight" style={{ fontStretch: "90%" }}>
        {current ? "Update your check-in" : "What are you studying?"}
      </h1>
      {!current ? (
        <p className="mt-1 text-sm text-slate">Check in so classmates in the same course can find you. You can check out anytime.</p>
      ) : null}
      <form
        className="mt-5 grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Course" htmlFor="course">
          <CourseInput id="course" value={courseCode} onChange={setCourse} autoFocus={!current} />
        </Field>
        <Field label="Working on" htmlFor="topic" hint="Optional">
          <Input id="topic" maxLength={80} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Assignment 3, midterm review…" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Where" htmlFor="location" hint="Optional. Pick a spot or type your own.">
            <Input id="location" maxLength={60} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="McLennan, 4th floor" />
          </Field>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SPOTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setLocation(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[13px] font-semibold",
                  location === s ? "border-ink bg-ink text-paper" : "border-line text-slate hover:border-slate/60 hover:text-ink",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {save.error ? (
          <p role="alert" className="text-sm text-red sm:col-span-2">
            {errorMessage(save.error)}
          </p>
        ) : null}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" size="lg" loading={save.isPending} disabled={!courseCode.trim()}>
            {current ? "Save changes" : "Check in"}
          </Button>
          {current ? (
            <Button type="button" variant="ghost" size="lg" onClick={onDone}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function MyCheckIn({ checkIn, onEdit }: { checkIn: Peer; onEdit: () => void }) {
  const qc = useQueryClient();
  const now = useNow();

  const setStatus = useMutation({
    mutationFn: (status: Status) => api.put<{ checkIn: Peer }>("/api/check-in", { ...checkIn, status }),
    onSuccess: ({ checkIn }) => qc.setQueryData(checkInKey, checkIn),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const checkOut = useMutation({
    mutationFn: () => api.delete("/api/check-in"),
    onSuccess: () => {
      qc.setQueryData(checkInKey, null);
      toast("Checked out. Nobody can see you studying now.");
    },
  });

  return (
    <section aria-label="Your check-in" className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 shadow-panel sm:flex-row sm:items-center sm:p-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <span className="course-code rounded-md bg-highlight px-2.5 py-1 text-[26px] leading-none text-highlight-ink">{checkIn.courseCode}</span>
          <StatusPill status={checkIn.status} />
        </div>
        <p className="mt-3 truncate text-[17px] font-semibold">{checkIn.topic || "Studying"}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-slate">
          {checkIn.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {checkIn.location}
            </span>
          ) : null}
          <span className="tabular">
            {elapsed(checkIn.startedAt, now) === "just now" ? "Checked in just now" : `Checked in ${elapsed(checkIn.startedAt, now)} ago`}
          </span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Status" className="inline-flex rounded-lg border border-line p-0.5">
          {(["studying", "break"] as const).map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={checkIn.status === s}
              disabled={setStatus.isPending}
              onClick={() => checkIn.status !== s && setStatus.mutate(s)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold",
                checkIn.status === s ? "bg-ink text-paper" : "text-slate hover:text-ink",
              )}
            >
              {s === "break" ? <Coffee className="size-3.5" /> : null}
              {s === "studying" ? "Studying" : "On a break"}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="size-3.5" /> Edit
        </Button>
        <Button variant="danger" size="sm" onClick={() => checkOut.mutate()} loading={checkOut.isPending}>
          Check out
        </Button>
      </div>
    </section>
  );
}

/* ---------------- Who's studying ---------------- */

function PeerBoard({ myCourse }: { myCourse: string | null }) {
  const { data: peers = [], isLoading, arrived } = useLivePeers();
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState<string | null>(null);
  const now = useNow();

  const departments = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of peers) counts.set(department(p.courseCode), (counts.get(department(p.courseCode)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [peers]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "");
    return peers.filter((p) => {
      if (dept && department(p.courseCode) !== dept) return false;
      if (!q) return true;
      return [p.name, p.courseCode, p.topic, p.location].some((f) => f.toLowerCase().replace(/\s+/g, "").includes(q));
    });
  }, [peers, query, dept]);

  const groups = shelves(visible, myCourse);
  const sameCourse = myCourse ? peers.filter((p) => p.courseCode === myCourse).length : 0;

  return (
    <section aria-labelledby="board-title" className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="board-title" className="text-[22px] font-extrabold tracking-tight" style={{ fontStretch: "90%" }}>
            Studying now
          </h2>
          <p className="mt-0.5 text-sm text-slate" aria-live="polite">
            {peers.length === 0
              ? "Nobody else is checked in yet."
              : `${peers.length} ${peers.length === 1 ? "classmate" : "classmates"} online${myCourse && sameCourse ? `, ${sameCourse} in ${myCourse}` : ""}.`}
          </p>
        </div>
        {peers.length > 0 ? (
          <label className="relative w-full sm:w-64">
            <span className="sr-only">Search classmates</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, course, topic" className="pl-9" />
          </label>
        ) : null}
      </div>

      {departments.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter by department">
          <Chip active={dept === null} onClick={() => setDept(null)}>
            All <span className="text-current/60 tabular">{peers.length}</span>
          </Chip>
          {departments.map(([d, n]) => (
            <Chip key={d} active={dept === d} onClick={() => setDept(dept === d ? null : d)}>
              <span className="course-code text-[14px]">{d}</span> <span className="text-current/60 tabular">{n}</span>
            </Chip>
          ))}
        </div>
      ) : null}

      <div className="mt-6">
        {isLoading ? (
          <div className="grid h-40 place-items-center text-slate">
            <Spinner className="size-5" />
          </div>
        ) : peers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line">
            <Empty icon={<Users className="size-8" />} title="It's quiet right now">
              When classmates check in, they'll appear here instantly, grouped by course. Share myPeers with your study group to get it going.
            </Empty>
          </div>
        ) : groups.length === 0 ? (
          <p className="py-10 text-center text-slate">No one matches “{query}”.</p>
        ) : (
          <div className="space-y-8">
            {groups.map((g) => (
              <div key={g.courseCode} className="grid gap-3 sm:grid-cols-[132px_minmax(0,1fr)]">
                {/* The shelf label: course code set like a library spine label. */}
                <div className="flex items-baseline gap-3 sm:block">
                  <h3
                    className={cn(
                      "course-code inline-block text-[30px] leading-[0.95] sm:text-[34px]",
                      g.mine && "rounded bg-highlight px-1.5 text-highlight-ink",
                    )}
                  >
                    {g.courseCode.split(" ")[0]}
                    <br className="hidden sm:block" /> {g.courseCode.split(" ")[1]}
                  </h3>
                  <p className="text-[13px] text-slate sm:mt-1.5">
                    {g.mine ? "Your course" : `${g.peers.length} here`}
                  </p>
                </div>
                <ul className="divide-y divide-line self-start overflow-hidden rounded-xl border border-line bg-surface">
                  {g.peers.map((p) => (
                    <PeerRow key={p.userId} peer={p} now={now} arrived={arrived.has(p.userId)} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold",
        active ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink hover:border-slate/60",
      )}
    >
      {children}
    </button>
  );
}

function PeerRow({ peer, now, arrived }: { peer: Peer; now: number; arrived: boolean }) {
  const navigate = useNavigate();
  return (
    <li className={cn("flex items-center gap-3 px-4 py-3", arrived && "arrive")}>
      <Avatar name={peer.name} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
          <span className="font-semibold">{peer.name}</span>
          <StatusPill status={peer.status} />
        </div>
        <p className="truncate text-sm text-slate">
          {peer.topic || "Studying"}
          {peer.location ? (
            <>
              <span className="mx-1.5 text-line">/</span>
              {peer.location}
            </>
          ) : null}
        </p>
      </div>
      <span className="hidden text-[13px] text-slate tabular sm:block" title={`Checked in ${new Date(peer.startedAt).toLocaleTimeString()}`}>
        {elapsed(peer.startedAt, now)}
      </span>
      <Button variant="secondary" size="sm" onClick={() => navigate(`/app/messages/${peer.userId}`)} aria-label={`Message ${peer.name}`}>
        <MessageCircle className="size-3.5" />
        <span className="hidden sm:inline">Message</span>
      </Button>
    </li>
  );
}

/* ---------------- Side column ---------------- */

function RoomsAside() {
  const { data } = useQuery({ queryKey: ["rooms"], queryFn: () => api.get<{ rooms: RoomSummary[] }>("/api/rooms") });
  const rooms = data?.rooms ?? [];
  return (
    <section aria-labelledby="aside-rooms">
      <div className="flex items-center justify-between">
        <h2 id="aside-rooms" className="font-bold">
          Your rooms
        </h2>
        <Link to="/app/rooms" className="inline-flex items-center gap-1 text-[13px] font-semibold text-slate hover:text-ink">
          <Plus className="size-3.5" /> New
        </Link>
      </div>
      {rooms.length === 0 ? (
        <p className="mt-2 text-sm text-slate">Rooms give your study group a shared whiteboard, timer and chat.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {rooms.slice(0, 4).map((r) => (
            <li key={r.id}>
              <Link to={`/app/rooms/${r.code}`} className="flex items-center justify-between rounded-lg px-2 py-2 -mx-2 hover:bg-surface">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{r.name}</span>
                  <span className="text-[12px] text-slate">{r.memberCount} {r.memberCount === 1 ? "member" : "members"}</span>
                </span>
                {r.courseCode ? <span className="course-code text-[14px] text-slate">{r.courseCode}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MessagesAside() {
  const { data } = useQuery({ queryKey: ["conversations"], queryFn: () => api.get<{ conversations: Conversation[] }>("/api/conversations") });
  const list = data?.conversations ?? [];
  if (list.length === 0) return null;
  return (
    <section aria-labelledby="aside-msgs">
      <h2 id="aside-msgs" className="font-bold">
        Recent messages
      </h2>
      <ul className="mt-2 space-y-1">
        {list.slice(0, 4).map((c) => (
          <li key={c.user.id}>
            <Link to={`/app/messages/${c.user.id}`} className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-surface">
              <Avatar name={c.user.name} size={30} live={c.user.live} />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm", c.unread ? "font-bold" : "font-semibold")}>{c.user.name}</span>
                <span className="block truncate text-[12px] text-slate">
                  {c.lastMessage.fromMe ? "You: " : ""}
                  {c.lastMessage.preview}
                </span>
              </span>
              {c.unread ? <span className="size-2 rounded-full bg-red" aria-label={`${c.unread} unread`} /> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
