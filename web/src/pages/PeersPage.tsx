import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, m } from "motion/react";
import { MapPin, MessageCircle, Search } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CourseInput } from "@/components/CourseInput";
import { Burst, Sleepy } from "@/components/doodles";
import { Avatar, Button, CourseTag, Empty, Field, Input, PageHeader, Spinner, StatusPill } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { courseVars } from "@/lib/courseColor";
import { cn, department, elapsed } from "@/lib/format";
import { checkInKey, shelves, useLivePeers, useMyCheckIn } from "@/lib/peers";
import type { Peer, Status } from "@/lib/types";
import { useNow } from "@/lib/useNow";

const SPOTS = ["McLennan", "Redpath", "Trottier", "Schulich", "Bronfman", "Online"];

export default function PeersPage() {
  const { data: checkIn, isLoading } = useMyCheckIn();
  const { data: peers = [], isLoading: peersLoading, arrived } = useLivePeers();
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  // Checking in (not editing) gets a little burst of pen marks around your check-in.
  const [celebrate, setCelebrate] = useState(false);

  const myCourse = checkIn?.courseCode ?? null;
  const sameCourse = myCourse ? peers.filter((p) => p.courseCode === myCourse).length : 0;

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader
        title="Study now"
        sub={
          <span aria-live="polite">
            {peers.length === 0
              ? "Nobody else is checked in yet."
              : `${peers.length} ${peers.length === 1 ? "classmate" : "classmates"} online${myCourse && sameCourse ? `, ${sameCourse} in ${myCourse}` : ""}.`}
          </span>
        }
        actions={
          peers.length > 0 ? (
            <label className="relative block w-full sm:w-72">
              <span className="sr-only">Search classmates</span>
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search names, courses, places" className="h-10 pl-9 text-[14px]" />
            </label>
          ) : null
        }
      />

      <div className="mt-6">
        {isLoading ? (
          <div className="h-[72px]" />
        ) : !checkIn || editing ? (
          <CheckInForm
            current={checkIn ?? null}
            onDone={(isNew) => {
              setEditing(false);
              if (isNew) {
                setCelebrate(true);
                setTimeout(() => setCelebrate(false), 2000);
              }
            }}
          />
        ) : (
          <MyCheckIn checkIn={checkIn} onEdit={() => setEditing(true)} celebrate={celebrate} />
        )}
      </div>

      <PeerBoard peers={peers} loading={peersLoading} arrived={arrived} myCourse={myCourse} query={query} />
    </div>
  );
}

/* ---------------- Your check-in ---------------- */

function CheckInForm({ current, onDone }: { current: Peer | null; onDone: (isNew?: boolean) => void }) {
  const qc = useQueryClient();
  const [courseCode, setCourse] = useState(current?.courseCode ?? "");
  const [topic, setTopic] = useState(current?.topic ?? "");
  const [location, setLocation] = useState(current?.location ?? "");

  const save = useMutation({
    mutationFn: () => api.put<{ checkIn: Peer }>("/api/check-in", { courseCode, topic, location, status: current?.status ?? "studying" }),
    onSuccess: ({ checkIn }) => {
      qc.setQueryData(checkInKey, checkIn);
      toast.success(current ? "Check-in updated" : `Checked in to ${checkIn.courseCode}`);
      onDone(!current);
    },
  });

  return (
    <section aria-labelledby="checkin-title" className="rounded-xl bg-paper-2 p-4 sm:p-6">
      <h2 id="checkin-title" className="heading text-[24px]">
        {current ? "Update your check-in" : "What are you studying?"}
      </h2>
      {!current ? <p className="mt-0.5 text-[14px] text-ink-2">Check in so classmates taking the same course can find you.</p> : null}
      <form
        className="mt-5 grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)]"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Course" htmlFor="course">
          <CourseInput id="course" value={courseCode} onChange={setCourse} autoFocus={!current} />
        </Field>
        <Field label="Working on" htmlFor="topic">
          <Input id="topic" maxLength={80} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Assignment 3" />
        </Field>
        <Field label="Where" htmlFor="location">
          <Input id="location" maxLength={60} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="McLennan, 4th floor" />
        </Field>
        <div className="flex flex-wrap items-center gap-y-1 sm:col-span-3">
          <span className="mr-2 text-[13px] text-ink-3">Quick pick</span>
          {SPOTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setLocation(s)}
              aria-pressed={location === s}
              className={cn(
                "h-8 border-l border-rule-strong px-2.5 text-[13.5px] font-medium transition-colors first-of-type:border-l-0",
                location === s ? "font-semibold text-ink" : "text-ink-2 hover:text-ink hover:underline",
              )}
            >
              <span key={String(location === s)} className={location === s ? "hl swipe" : undefined} style={{ "--hl": "var(--you)" } as CSSProperties}>
                {s}
              </span>
            </button>
          ))}
        </div>
        {save.error ? (
          <p role="alert" className="text-[14px] font-medium text-red sm:col-span-3">
            {errorMessage(save.error)}
          </p>
        ) : null}
        <div className="flex gap-2 pt-1 sm:col-span-3">
          <Button type="submit" size="lg" loading={save.isPending} disabled={!courseCode.trim()}>
            {current ? "Save changes" : "Check in"}
          </Button>
          {current ? (
            <Button type="button" variant="ghost" onClick={() => onDone()}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

/** Your check-in as a slim status bar, edged in your course colour. */
function MyCheckIn({ checkIn, onEdit, celebrate }: { checkIn: Peer; onEdit: () => void; celebrate?: boolean }) {
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
      toast("Checked out. Classmates can't see you on the board now.");
    },
  });
  const since = elapsed(checkIn.startedAt, now);

  return (
    <section
      aria-label="Your check-in"
      style={courseVars(checkIn.courseCode)}
      className="relative flex flex-col gap-3 rounded-xl border-2 border-ink p-4 sm:flex-row sm:items-center"
    >
      {celebrate ? (
        <span className="absolute top-1/2 left-16">
          <Burst colors={["var(--pen)", "var(--course-ink)", "var(--c6-ink)"]} />
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <CourseTag code={checkIn.courseCode} size="lg" swipe />
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-ink-3">You're checked in</p>
          <p className="truncate text-[16px] font-semibold">{checkIn.topic || "Studying"}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-ink-2">
            {checkIn.location ? (
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="size-3.5 shrink-0" />
                {checkIn.location}
              </span>
            ) : null}
            <span className="code shrink-0 text-[12.5px]">{since === "just now" ? "Checked in just now" : `For ${since}`}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <div role="radiogroup" aria-label="Status" className="inline-flex gap-1 rounded-lg border-[1.5px] border-rule-strong p-1">
          {(["studying", "break"] as const).map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={checkIn.status === s}
              disabled={setStatus.isPending}
              onClick={() => checkIn.status !== s && setStatus.mutate(s)}
              className={cn("h-7 rounded-md px-2.5 text-[13px] font-semibold transition-colors", checkIn.status === s ? "text-ink" : "text-ink-3 hover:text-ink")}
            >
              <span key={String(checkIn.status === s)} className={checkIn.status === s ? "hl swipe" : undefined} style={{ "--hl": "var(--you)" } as CSSProperties}>
                {s === "studying" ? "Studying" : "On a break"}
              </span>
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="ghost" size="sm" className="text-ink-3 hover:bg-red-soft hover:text-red" onClick={() => checkOut.mutate()} loading={checkOut.isPending}>
          Check out
        </Button>
      </div>
    </section>
  );
}

/* ---------------- Who's studying ---------------- */

function PeerBoard({
  peers,
  loading,
  arrived,
  myCourse,
  query,
}: {
  peers: Peer[];
  loading: boolean;
  arrived: Set<string>;
  myCourse: string | null;
  query: string;
}) {
  const [dept, setDept] = useState<string | null>(null);
  const now = useNow();

  const departments = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of peers) counts.set(department(p.courseCode), (counts.get(department(p.courseCode)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
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

  if (loading) {
    return (
      <div className="grid h-40 place-items-center text-ink-3">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (peers.length === 0) {
    return (
      <div className="mt-8 rounded-xl border-[1.5px] border-dashed border-rule-strong">
        <Empty icon={<Sleepy size={64} />} title="It's quiet right now">
          When classmates check in they show up here instantly, grouped by course. Send the link to your study group to get it going.
        </Empty>
      </div>
    );
  }

  return (
    <section aria-label="Classmates studying now" className="mt-8">
      {departments.length > 1 ? (
        <div className="mb-6 flex flex-wrap items-center gap-y-1" role="group" aria-label="Filter by department">
          <FilterButton active={dept === null} onClick={() => setDept(null)}>
            All <span className="code text-[12px] opacity-70">{peers.length}</span>
          </FilterButton>
          {departments.map(([d, n]) => (
            <FilterButton key={d} active={dept === d} onClick={() => setDept(dept === d ? null : d)}>
              {d} <span className="code text-[12px] opacity-70">{n}</span>
            </FilterButton>
          ))}
        </div>
      ) : null}

      {groups.length === 0 ? (
        <p className="py-10 text-center text-ink-2">No one matches “{query}”.</p>
      ) : (
        <div className="space-y-8">
          <AnimatePresence initial={false}>
            {groups.map((g) => (
              <m.div
                key={g.courseCode}
                layout="position"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 34 }}
                style={courseVars(g.courseCode)}
              >
                <div className="flex items-baseline gap-3 pb-2">
                  <h3>
                    <CourseTag code={g.courseCode} size="lg" />
                  </h3>
                  <span className="text-[13px] font-medium text-ink-3">
                    {g.mine ? "Your course, " : ""}
                    {g.peers.length} {g.peers.length === 1 ? "person" : "people"}
                  </span>
                </div>
                <ul className="divide-y divide-rule border-y border-rule">
                  <AnimatePresence initial={false}>
                    {g.peers.map((p) => (
                      <PeerRow key={p.userId} peer={p} now={now} arrived={arrived.has(p.userId)} />
                    ))}
                  </AnimatePresence>
                </ul>
              </m.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center border-l border-rule-strong px-3 text-[13.5px] font-semibold transition-colors first:border-l-0 first:pl-0",
        active ? "text-ink" : "text-ink-2 hover:text-ink hover:underline",
      )}
    >
      <span key={String(active)} className={cn("inline-flex items-center gap-1.5", active && "hl swipe")} style={{ "--hl": "var(--you)" } as CSSProperties}>
        {children}
      </span>
    </button>
  );
}

function PeerRow({ peer, now, arrived }: { peer: Peer; now: number; arrived: boolean }) {
  const navigate = useNavigate();
  return (
    // New arrivals slide in and get a wash of their course colour; people who leave fade out.
    <m.li
      layout="position"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className={cn("group flex items-center gap-3 py-3 sm:px-2 lg:grid lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,13rem)_4.5rem_auto] lg:gap-5", arrived && "arrive")}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* A classmate who just checked in pops onto the board. */}
        <m.span
          initial={arrived ? { scale: 0.2, rotate: -25 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 520, damping: 12 }}
          className="inline-flex"
        >
          <Avatar name={peer.name} size={36} course={peer.courseCode} />
        </m.span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5">
            <span className="text-[14.5px] font-semibold">{peer.name}</span>
            <StatusPill status={peer.status} />
          </div>
          {/* Phones and tablets: topic and place on one line under the name. */}
          <p className="truncate text-[13.5px] text-ink-2 lg:hidden">
            {peer.topic || "Studying"}
            {peer.location ? <span className="text-ink-3">{/^online$/i.test(peer.location) ? ", online" : ` in ${peer.location}`}</span> : null}
          </p>
        </div>
      </div>
      <span className="hidden truncate text-[14px] text-ink-2 lg:block">{peer.topic || "Studying"}</span>
      <span className="hidden truncate text-[14px] text-ink-2 lg:block">{peer.location || "Not given"}</span>
      <span className="code hidden text-right text-[12.5px] text-ink-3 sm:block" title={`Checked in at ${new Date(peer.startedAt).toLocaleTimeString()}`}>
        {elapsed(peer.startedAt, now)}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="text-ink-3 group-hover:text-ink"
        onClick={() => navigate(`/app/messages/${peer.userId}`)}
        aria-label={`Message ${peer.name}`}
      >
        <MessageCircle className="size-4" />
        <span className="hidden sm:inline">Message</span>
      </Button>
    </m.li>
  );
}
