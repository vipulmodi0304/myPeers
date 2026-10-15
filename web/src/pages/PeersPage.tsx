import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, MessageCircle, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CourseInput } from "@/components/CourseInput";
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

  const myCourse = checkIn?.courseCode ?? null;
  const sameCourse = myCourse ? peers.filter((p) => p.courseCode === myCourse).length : 0;

  return (
    <div className="mx-auto max-w-[920px] px-4 py-6 sm:px-8 sm:py-8">
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
            <label className="relative block w-full sm:w-60">
              <span className="sr-only">Search classmates</span>
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="h-9 pl-8 text-[14px]" />
            </label>
          ) : null
        }
      />

      <div className="mt-6">
        {isLoading ? (
          <div className="h-[72px]" />
        ) : !checkIn || editing ? (
          <CheckInForm current={checkIn ?? null} onDone={() => setEditing(false)} />
        ) : (
          <MyCheckIn checkIn={checkIn} onEdit={() => setEditing(true)} />
        )}
      </div>

      <PeerBoard peers={peers} loading={peersLoading} arrived={arrived} myCourse={myCourse} query={query} />
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
    <section aria-labelledby="checkin-title" className="rounded-xl border border-line bg-canvas/60 p-4 sm:p-5">
      <h2 id="checkin-title" className="text-[16px] font-semibold">
        {current ? "Update your check-in" : "What are you studying?"}
      </h2>
      {!current ? <p className="mt-0.5 text-[14px] text-ink-2">Check in so classmates taking the same course can find you.</p> : null}
      <form
        className="mt-4 grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)]"
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
        <div className="flex flex-wrap items-center gap-1.5 sm:col-span-3">
          <span className="mr-1 text-[13px] text-ink-3">Quick pick</span>
          {SPOTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setLocation(s)}
              aria-pressed={location === s}
              className={cn(
                "h-7 rounded-md border px-2.5 text-[13px]",
                location === s ? "border-ink bg-ink text-canvas" : "border-line-strong bg-surface text-ink-2 hover:text-ink",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        {save.error ? (
          <p role="alert" className="text-[14px] text-brand sm:col-span-3">
            {errorMessage(save.error)}
          </p>
        ) : null}
        <div className="flex gap-2 pt-1 sm:col-span-3">
          <Button type="submit" variant="brand" loading={save.isPending} disabled={!courseCode.trim()}>
            {current ? "Save changes" : "Check in"}
          </Button>
          {current ? (
            <Button type="button" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

/** Your check-in as a slim status bar, edged in your course colour. */
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
      toast("Checked out. Classmates can't see you on the board now.");
    },
  });
  const since = elapsed(checkIn.startedAt, now);

  return (
    <section
      aria-label="Your check-in"
      style={courseVars(checkIn.courseCode)}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface py-3 pr-3 pl-4 shadow-[inset_3px_0_0_var(--course)] sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <CourseTag code={checkIn.courseCode} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{checkIn.topic || "Studying"}</p>
          <p className="flex items-center gap-3 text-[13px] text-ink-2">
            {checkIn.location ? (
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="size-3.5 shrink-0" />
                {checkIn.location}
              </span>
            ) : null}
            <span className="tabular shrink-0">{since === "just now" ? "Checked in just now" : `For ${since}`}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <div role="radiogroup" aria-label="Status" className="inline-flex rounded-lg bg-surface-2 p-0.5">
          {(["studying", "break"] as const).map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={checkIn.status === s}
              disabled={setStatus.isPending}
              onClick={() => checkIn.status !== s && setStatus.mutate(s)}
              className={cn(
                "h-7 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                checkIn.status === s ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-ink-2 hover:text-ink",
              )}
            >
              {s === "studying" ? "Studying" : "On a break"}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="ghost" size="sm" className="text-ink-3 hover:text-brand" onClick={() => checkOut.mutate()} loading={checkOut.isPending}>
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
      <div className="mt-8 rounded-xl border border-dashed border-line-strong">
        <Empty icon={<Users className="size-7" />} title="It's quiet right now">
          When classmates check in they show up here instantly, grouped by course. Send the link to your study group to get it going.
        </Empty>
      </div>
    );
  }

  return (
    <section aria-label="Classmates studying now" className="mt-8">
      {departments.length > 1 ? (
        <div className="-mx-1 mb-5 flex flex-wrap gap-1" role="group" aria-label="Filter by department">
          <FilterButton active={dept === null} onClick={() => setDept(null)}>
            All <span className="text-ink-3 tabular">{peers.length}</span>
          </FilterButton>
          {departments.map(([d, n]) => (
            <FilterButton key={d} active={dept === d} onClick={() => setDept(dept === d ? null : d)}>
              {d} <span className="text-ink-3 tabular">{n}</span>
            </FilterButton>
          ))}
        </div>
      ) : null}

      {groups.length === 0 ? (
        <p className="py-10 text-center text-ink-2">No one matches “{query}”.</p>
      ) : (
        <div className="space-y-7">
          {groups.map((g) => (
            <div key={g.courseCode} style={courseVars(g.courseCode)}>
              <div className="flex items-baseline gap-2.5 pb-2">
                <h3 className="course-code text-[22px] leading-none text-course">{g.courseCode}</h3>
                <span className="text-[13px] text-ink-3">
                  {g.mine ? "Your course, " : ""}
                  {g.peers.length} {g.peers.length === 1 ? "person" : "people"}
                </span>
              </div>
              <ul className="divide-y divide-line border-y border-line">
                {g.peers.map((p) => (
                  <PeerRow key={p.userId} peer={p} now={now} arrived={arrived.has(p.userId)} />
                ))}
              </ul>
            </div>
          ))}
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
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
        active ? "bg-surface-3 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function PeerRow({ peer, now, arrived }: { peer: Peer; now: number; arrived: boolean }) {
  const navigate = useNavigate();
  return (
    <li className={cn("group flex items-center gap-3 py-2.5 sm:px-1", arrived && "arrive")}>
      <Avatar name={peer.name} size={34} course={peer.courseCode} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5">
          <span className="text-[14.5px] font-semibold">{peer.name}</span>
          <StatusPill status={peer.status} />
        </div>
        <p className="truncate text-[13.5px] text-ink-2">
          {peer.topic || "Studying"}
          {peer.location ? <span className="text-ink-3">{/^online$/i.test(peer.location) ? ", online" : ` in ${peer.location}`}</span> : null}
        </p>
      </div>
      <span className="hidden text-[13px] text-ink-3 tabular sm:block" title={`Checked in at ${new Date(peer.startedAt).toLocaleTimeString()}`}>
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
    </li>
  );
}
