import { useQuery } from "@tanstack/react-query";
import { MapPin, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, Button, Logo, StatusPill } from "@/components/ui";
import { api } from "@/lib/api";
import { canUseApp, useMe } from "@/lib/auth";
import { cn } from "@/lib/format";
import { useStartDemo } from "./AuthPages";

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
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
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
                <Button>Create account</Button>
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-8 pb-20 md:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
          <div>
            <h1 className="max-w-[13ch] text-[44px] leading-[1.02] font-extrabold tracking-[-0.02em] sm:text-[60px]" style={{ fontStretch: "86%" }}>
              See who's studying your course right now.
            </h1>
            <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-slate">
              Check in with the course you're working on and find McGill classmates studying it too, whether they're in McLennan, Redpath or
              online. Message them, or open a room with a shared whiteboard and one Pomodoro timer for the whole group.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {signedIn ? (
                <Link to="/app">
                  <Button size="lg">Open myPeers</Button>
                </Link>
              ) : (
                <>
                  <Link to="/signup">
                    <Button size="lg">Sign up with McGill email</Button>
                  </Link>
                  {stats?.demoEnabled !== false ? (
                    <Button size="lg" variant="secondary" onClick={() => demo.mutate()} loading={demo.isPending}>
                      Try the demo
                    </Button>
                  ) : null}
                </>
              )}
            </div>
            {stats && stats.studyingNow > 0 ? (
              <p className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
                <span className="live-dot size-2 rounded-full bg-red" />
                {stats.studyingNow} {stats.studyingNow === 1 ? "student is" : "students are"} checked in right now
              </p>
            ) : (
              <p className="mt-6 text-sm text-slate">The demo needs no account. Sample classmates are waiting in it.</p>
            )}
          </div>
          <BoardPreview />
        </section>

        {/* How it works: a real sequence, so it's numbered */}
        <section aria-labelledby="how" className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 id="how" className="text-[28px] font-extrabold tracking-tight" style={{ fontStretch: "90%" }}>
              How it works
            </h2>
            <ol className="mt-8 grid gap-10 md:grid-cols-3">
              {[
                ["Check in", "Pick your course, say what you're working on and where. It takes ten seconds, and you can check out anytime."],
                ["Find your classmates", "Everyone checked in shows up grouped by course, with yours at the top. The list updates the moment someone arrives or leaves."],
                ["Study together", "Send a message, share notes as images or PDFs, or open a room and work through problems on the same whiteboard."],
              ].map(([title, body], i) => (
                <li key={title} className="grid grid-cols-[auto_1fr] gap-4">
                  <span className="text-[44px] leading-none font-extrabold text-red tabular" style={{ fontStretch: "70%" }}>
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-[17px] font-bold">{title}</h3>
                    <p className="mt-1.5 text-slate">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Rooms */}
        <section aria-labelledby="rooms" className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-2">
          <RoomPreview />
          <div>
            <h2 id="rooms" className="text-[28px] font-extrabold tracking-tight" style={{ fontStretch: "90%" }}>
              One timer for the whole group
            </h2>
            <p className="mt-4 max-w-[52ch] text-slate">
              Start a focus round in a study room and everyone's countdown ends at the same second, on every laptop and phone. Breaks happen
              together, and nobody has to ask "are we still going?"
            </p>
            <ul className="mt-6 space-y-2.5">
              {[
                "Shared whiteboard that looks the same on every screen",
                "Group chat that stays with the room",
                "See who's in the room right now",
                "Invite your group with a six-letter code",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ink" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-slate">
          <p>
            Built by Vipul Modi, a McGill CS student. Not affiliated with McGill University.
          </p>
          <a href="https://github.com/vipulmodi0304/mypeers" className="font-semibold text-ink underline-offset-2 hover:underline">
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

/** An illustration of the "Studying now" board, built from the real components' styles. */
function BoardPreview() {
  const shelves = [
    {
      code: "COMP 251",
      mine: true,
      people: [
        { name: "Maya Chen", topic: "A3: dynamic programming", where: "Trottier", mins: "48m", status: "studying" as const },
        { name: "Daniel Okafor", topic: "Midterm review", where: "McLennan", mins: "1h 12m", status: "studying" as const },
      ],
    },
    {
      code: "MATH 240",
      mine: false,
      people: [{ name: "Sofia Rossi", topic: "Induction proofs", where: "Redpath", mins: "25m", status: "break" as const }],
    },
  ];
  return (
    <div className="relative" aria-label="Preview of the Studying now board" role="img">
      <div className="space-y-6 rounded-2xl border border-line bg-paper p-4 shadow-panel sm:p-6">
        {shelves.map((s) => (
          <div key={s.code} className="grid gap-2 sm:grid-cols-[104px_minmax(0,1fr)] sm:gap-3">
            <div className="flex items-baseline gap-3 sm:block">
              <p className={cn("course-code inline-block text-[26px] leading-[0.95] sm:text-[32px]", s.mine && "rounded bg-highlight px-1.5 text-highlight-ink")}>
                {s.code.split(" ")[0]}
                <br className="hidden sm:block" /> {s.code.split(" ")[1]}
              </p>
              <p className="text-[12px] text-slate sm:mt-1">{s.mine ? "Your course" : `${s.people.length} here`}</p>
            </div>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {s.people.map((p) => (
                <li key={p.name} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar name={p.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="text-[14px] font-semibold">{p.name}</span>
                      <StatusPill status={p.status} />
                    </div>
                    <p className="flex items-center gap-1 truncate text-[12px] text-slate">
                      {p.topic} <MapPin className="ml-1 size-3 shrink-0" /> {p.where}
                    </p>
                  </div>
                  <span className="hidden text-[12px] text-slate tabular sm:block">{p.mins}</span>
                  <span className="grid size-7 place-items-center rounded-md border border-line text-slate">
                    <MessageCircle className="size-3.5" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoomPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-panel" aria-hidden>
      <div className="grid grid-cols-[minmax(0,1fr)_150px] sm:grid-cols-[minmax(0,1fr)_180px]">
        <div className="bg-surface-2 p-3">
          <svg viewBox="0 0 320 200" className="w-full rounded-lg border border-line bg-white">
            <defs>
              <pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.8" fill="#d6dbe4" />
              </pattern>
            </defs>
            <rect width="320" height="200" fill="url(#dots)" />
            {/* A small tree, the kind you'd sketch for COMP 251 */}
            <g stroke="#17203A" strokeWidth="2.2" fill="none" strokeLinecap="round">
              <path d="M160 46 L110 96 M160 46 L210 96 M110 96 L80 146 M110 96 L135 146 M210 96 L240 146" />
            </g>
            <g fill="#fff" stroke="#17203A" strokeWidth="2.2">
              {[
                [160, 46, "8"],
                [110, 96, "3"],
                [210, 96, "10"],
                [80, 146, "1"],
                [135, 146, "6"],
                [240, 146, "14"],
              ].map(([x, y, n]) => (
                <g key={String(n)}>
                  <circle cx={Number(x)} cy={Number(y)} r="15" />
                  <text x={Number(x)} y={Number(y) + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#17203A" stroke="none" fontFamily="Archivo Variable, sans-serif">
                    {n}
                  </text>
                </g>
              ))}
            </g>
            <path d="M228 128 q 18 -30 46 -22" stroke="#D61F2C" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <text x="250" y="96" fontSize="13" fill="#D61F2C" fontFamily="Archivo Variable, sans-serif" fontWeight="600">
              insert 14?
            </text>
          </svg>
        </div>
        <div className="border-l border-line p-4">
          <p className="text-[12px] text-slate">Focus</p>
          <p className="text-[40px] leading-none font-extrabold tabular" style={{ fontStretch: "75%" }}>
            18:42
          </p>
          <div className="mt-2 h-1 rounded-full bg-surface-2">
            <div className="h-full w-1/4 rounded-full bg-red" />
          </div>
          <p className="mt-4 text-[12px] text-slate">4 here now</p>
          <div className="mt-1.5 flex -space-x-1.5">
            {["Maya Chen", "Daniel Okafor", "Emma Wilson", "You There"].map((n) => (
              <Avatar key={n} name={n} size={26} className="rounded-full ring-2 ring-surface" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
