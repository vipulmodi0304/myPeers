import { useQuery } from "@tanstack/react-query";
import { BookOpen, MessageCircle, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, Button, CourseTag, Logo, StatusPill } from "@/components/ui";
import { api } from "@/lib/api";
import { canUseApp, useMe } from "@/lib/auth";
import { courseVars } from "@/lib/courseColor";
import { cn } from "@/lib/format";
import { useStartDemo } from "./AuthPages";

const CYCLE = ["COMP 251", "MATH 240", "ECON 208", "PSYC 100", "BIOL 112", "CHEM 110"];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** The headline's course code swaps every few seconds, each in its own colour. */
function CyclingCourse() {
  const reduced = usePrefersReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setI((n) => (n + 1) % CYCLE.length), 2600);
    return () => clearInterval(t);
  }, [reduced]);
  const code = CYCLE[i]!;
  return (
    <span className="relative block h-[1.12em] overflow-hidden" aria-hidden>
      <span
        key={code}
        style={courseVars(code)}
        className="course-code course-in block leading-[1.12] text-course"
      >
        {code}
      </span>
    </span>
  );
}

export function LandingPage() {
  const { data: me } = useMe();
  const demo = useStartDemo();
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.get<{ studyingNow: number; demoEnabled: boolean }>("/api/stats"),
    refetchInterval: 60_000,
  });
  const signedIn = canUseApp(me);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="mx-auto flex max-w-[1120px] items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-1.5">
          {signedIn ? (
            <Link to="/app">
              <Button>Open myPeers</Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost">Sign in</Button>
              </Link>
              <Link to="/signup" className="hidden sm:block">
                <Button variant="secondary">Create account</Button>
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-[1120px] px-5 pt-10 sm:px-8 sm:pt-16">
          <h1 className="display text-[46px] leading-[1.02] sm:text-[76px]">
            <span className="sr-only">See who's studying your course right now.</span>
            <span aria-hidden>See who's studying</span>
            <CyclingCourse />
            <span aria-hidden>right now.</span>
          </h1>
          <div className="mt-7 max-w-[560px]">
            <p className="text-[17px] leading-relaxed text-ink-2">
              Check in with the course you're on, and McGill classmates working on the same thing show up instantly, whether they're in McLennan,
              Redpath or online. Message them, or open a room with a shared whiteboard and one Pomodoro timer for the whole group.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3">
              <div className="flex flex-wrap gap-2">
                {signedIn ? (
                  <Link to="/app">
                    <Button size="lg" variant="brand">
                      Open myPeers
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/signup">
                      <Button size="lg" variant="brand">
                        Sign up with McGill email
                      </Button>
                    </Link>
                    {stats?.demoEnabled !== false ? (
                      <Button size="lg" variant="secondary" onClick={() => demo.mutate()} loading={demo.isPending}>
                        Try the demo
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
              <p className="text-[13px] text-ink-3">
                {stats && stats.studyingNow > 0 ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-ink-2">
                    <span className="live-dot size-1.5 rounded-full bg-brand" />
                    {stats.studyingNow} {stats.studyingNow === 1 ? "student" : "students"} checked in right now
                  </span>
                ) : (
                  "The demo needs no account."
                )}
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-14 max-w-[1120px] px-5 sm:mt-20 sm:px-8" aria-label="What the app looks like">
          <AppPreview />
        </section>

        {/* Rooms */}
        <section aria-labelledby="rooms" className="mx-auto grid max-w-[1120px] items-center gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-16">
          <div>
            <h2 id="rooms" className="display text-[34px] leading-[1.08] sm:text-[42px]">
              One timer for the whole study group.
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-ink-2">
              Start a focus round in a study room and everyone's countdown ends at the same second, on every laptop and phone. Work through a
              problem on a shared whiteboard, keep the group chat with the room, and bring people in with a six-letter code.
            </p>
          </div>
          <RoomPreview />
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-5 py-8 text-[14px] text-ink-2 sm:px-8">
          <p>Built by Vipul Modi, a CS student at McGill. Not affiliated with McGill University.</p>
          <a href="https://github.com/vipulmodi0304/mypeers" className="font-medium text-ink underline decoration-line-strong underline-offset-3 hover:decoration-ink">
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

/* ---------- Product previews (drawn with the app's own components) ---------- */

const SAMPLE = [
  {
    code: "COMP 251",
    mine: true,
    people: [
      { name: "Maya Chen", topic: "A3: dynamic programming", where: " in Trottier", mins: "48m", status: "studying" as const },
      { name: "Daniel Okafor", topic: "Midterm review", where: " in McLennan", mins: "1h 12m", status: "studying" as const },
      { name: "Emma Wilson", topic: "Graph algorithms", where: ", online", mins: "25m", status: "break" as const },
    ],
  },
  {
    code: "MATH 240",
    mine: false,
    people: [{ name: "Sofia Rossi", topic: "Induction proofs", where: " in Redpath", mins: "36m", status: "studying" as const }],
  },
];

function AppPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-line-strong bg-canvas shadow-pop" role="img" aria-label="The Study now page: classmates grouped by course">
      <div className="flex">
        <div className="hidden w-[200px] shrink-0 border-r border-line p-3 md:block">
          <div className="px-2 py-2">
            <Logo />
          </div>
          <div className="mt-2 space-y-px text-[13.5px]">
            {[
              [BookOpen, "Study now", true],
              [Users, "Rooms", false],
              [MessageCircle, "Messages", false],
            ].map(([Icon, label, on]) => {
              const I = Icon as typeof BookOpen;
              return (
                <div key={label as string} className={cn("flex h-8 items-center gap-2.5 rounded-md px-2.5 text-ink-2", on && "bg-surface-3/70 text-ink")}>
                  <I className="size-4 opacity-80" /> {label as string}
                </div>
              );
            })}
          </div>
          <p className="mt-6 px-2.5 text-[12px] text-ink-3">Your rooms</p>
          {[
            ["COMP 251", "Study Squad"],
            ["MATH 240", "Proofs on Tuesday"],
          ].map(([code, name]) => (
            <div key={name} className="flex h-8 items-center gap-2.5 px-2.5 text-[13px] text-ink-2">
              <span style={courseVars(code)} className="size-2 rounded-[3px] bg-course" />
              {name}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 bg-surface p-4 sm:p-7">
          <p className="display text-[22px]">Study now</p>
          <p className="text-[13px] text-ink-2">4 classmates online, 3 in COMP 251.</p>
          <div
            style={courseVars("COMP 251")}
            className="mt-4 flex items-center gap-3 rounded-lg border border-line py-2.5 pr-3 pl-3.5 shadow-[inset_3px_0_0_var(--course)]"
          >
            <CourseTag code="COMP 251" size="md" />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold">A3 question 2</p>
              <p className="text-[12.5px] text-ink-2">Trottier, for 20m</p>
            </div>
          </div>
          <div className="mt-6 space-y-5">
            {SAMPLE.map((g) => (
              <div key={g.code} style={courseVars(g.code)}>
                <div className="flex items-baseline gap-2.5 pb-1.5">
                  <span className="course-code text-[19px] leading-none text-course">{g.code}</span>
                  <span className="text-[12px] text-ink-3">
                    {g.mine ? "Your course, " : ""}
                    {g.people.length} {g.people.length === 1 ? "person" : "people"}
                  </span>
                </div>
                <ul className="divide-y divide-line border-y border-line">
                  {g.people.map((p) => (
                    <li key={p.name} className="flex items-center gap-3 py-2">
                      <Avatar name={p.name} size={30} course={g.code} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-[13.5px] font-semibold">{p.name}</span>
                          <StatusPill status={p.status} />
                        </div>
                        <p className="truncate text-[12.5px] text-ink-2">
                          {p.topic}
                          <span className="text-ink-3">{p.where}</span>
                        </p>
                      </div>
                      <span className="hidden text-[12px] text-ink-3 tabular sm:block">{p.mins}</span>
                      <span className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] text-ink-3 sm:inline-flex">
                        <MessageCircle className="size-3.5" /> Message
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RoomPreview() {
  return (
    <div style={courseVars("COMP 251")} className="overflow-hidden rounded-xl border border-line-strong bg-surface shadow-pop" aria-hidden>
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
        <CourseTag code="COMP 251" size="sm" />
        <span className="text-[14px] font-semibold">Study Squad</span>
        <span className="ml-auto text-[12px] text-ink-3 tabular">K7QX2M</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_150px] sm:grid-cols-[minmax(0,1fr)_190px]">
        <div className="bg-surface-2 p-3">
          <svg viewBox="0 0 320 200" className="w-full rounded-lg border border-line bg-white">
            <defs>
              <pattern id="lp-dots" width="14" height="14" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.8" fill="#d6d6d0" />
              </pattern>
            </defs>
            <rect width="320" height="200" fill="url(#lp-dots)" />
            <g stroke="#1c1d22" strokeWidth="2.2" fill="none" strokeLinecap="round">
              <path d="M160 46 L110 96 M160 46 L210 96 M110 96 L80 146 M110 96 L135 146 M210 96 L240 146" />
            </g>
            <g fill="#fff" stroke="#1c1d22" strokeWidth="2.2">
              {(
                [
                  [160, 46, "8"],
                  [110, 96, "3"],
                  [210, 96, "10"],
                  [80, 146, "1"],
                  [135, 146, "6"],
                  [240, 146, "14"],
                ] as const
              ).map(([x, y, n]) => (
                <g key={n}>
                  <circle cx={x} cy={y} r="15" />
                  <text x={x} y={y + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#1c1d22" stroke="none" fontFamily="Hanken Grotesk Variable, sans-serif">
                    {n}
                  </text>
                </g>
              ))}
            </g>
            <path d="M228 128 q 18 -30 46 -22" stroke="#3557b3" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <text x="246" y="96" fontSize="13" fill="#3557b3" fontFamily="Hanken Grotesk Variable, sans-serif" fontWeight="600">
              insert 14?
            </text>
          </svg>
        </div>
        <div className="border-l border-line p-4">
          <p className="text-[12px] text-ink-3">Focus</p>
          <p className="display text-[40px] leading-none tabular" style={{ fontStretch: "75%" }}>
            18:42
          </p>
          <div className="mt-2 h-1 rounded-full bg-surface-3">
            <div className="h-full w-1/4 rounded-full bg-brand" />
          </div>
          <p className="mt-5 text-[12px] text-ink-3">4 here now</p>
          <div className="mt-1.5 flex -space-x-1.5">
            {["Maya Chen", "Daniel Okafor", "Emma Wilson", "Arjun Patel"].map((n) => (
              <Avatar key={n} name={n} size={26} course="COMP 251" className="rounded-full ring-2 ring-surface" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
