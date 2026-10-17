import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, m, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Avatar, Button, CourseTag, Logo } from "@/components/ui";
import { api } from "@/lib/api";
import { canUseApp, useMe } from "@/lib/auth";
import { courseVars } from "@/lib/courseColor";
import { cn, initials } from "@/lib/format";
import { useStartDemo } from "./AuthPages";

/*
 * Landing page, "Library floor" direction (docs/DESIGN.md).
 * One loud moment (the poster headline and the cluster of classmates around
 * it), then calmer sections whose illustrations play only while on screen.
 */

// The demo's sample classmates (server/src/services/demo.ts), so the ticker shows what the demo really has.
const DEMO_PEOPLE = [
  { name: "Maya Chen", course: "COMP 251", where: "Trottier" },
  { name: "Sofia Rossi", course: "MATH 240", where: "Redpath" },
  { name: "Noah Kim", course: "COMP 302", where: "Schulich" },
  { name: "Daniel Okafor", course: "COMP 251", where: "McLennan" },
  { name: "Léa Tremblay", course: "ECON 208", where: "Bronfman" },
  { name: "Arjun Patel", course: "COMP 206", where: "home" },
];
const CYCLE = ["COMP 251", "MATH 240", "ECON 208", "COMP 302", "COMP 206"];

const spring = { type: "spring", stiffness: 380, damping: 26 } as const;

/** Runs `tick` every `ms` while `active`, unless the visitor prefers reduced motion. */
function useLoop(tick: () => void, ms: number, active = true) {
  const reduced = useReducedMotion();
  const saved = useRef(tick);
  useEffect(() => {
    saved.current = tick;
  });
  useEffect(() => {
    if (reduced || !active) return;
    const t = setInterval(() => saved.current(), ms);
    return () => clearInterval(t);
  }, [ms, active, reduced]);
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
  const demoOn = stats?.demoEnabled !== false;

  const ctas = (inverse = false) =>
    signedIn ? (
      <Link to="/app">
        <Button size="lg" variant={inverse ? "sticker" : "primary"}>
          Open myPeers
        </Button>
      </Link>
    ) : (
      <>
        <Link to="/signup">
          <Button size="lg" variant={inverse ? "sticker" : "primary"}>
            Sign up with McGill email
          </Button>
        </Link>
        {demoOn ? (
          <Button
            size="lg"
            variant={inverse ? "ghost" : "sticker"}
            className={inverse ? "border-2 border-white/70 text-white hover:bg-white/10 hover:text-white" : undefined}
            onClick={() => demo.mutate()}
            loading={demo.isPending}
          >
            Try the demo
          </Button>
        ) : null}
      </>
    );

  return (
    <div className="min-h-dvh overflow-x-clip bg-canvas">
      <header className="mx-auto flex max-w-[1180px] items-center justify-between px-4 py-4 sm:px-8 sm:py-5">
        <Logo />
        <nav className="flex items-center gap-1.5">
          {signedIn ? (
            <Link to="/app">
              <Button size="sm">Open myPeers</Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link to="/signup" className="hidden sm:block">
                <Button variant="sticker" size="sm">
                  Create account
                </Button>
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="mx-auto grid max-w-[1180px] gap-8 px-4 pt-6 sm:px-8 sm:pt-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-6 lg:pt-12">
          <div className="min-w-0">
            <h1 className="poster text-[clamp(54px,13.5vw,92px)] lg:text-[clamp(84px,7.8vw,112px)]">
              <span className="sr-only">See who's studying your course at McGill right now.</span>
              <span aria-hidden>
                Who's in McLennan doing{" "}
                <span className="whitespace-nowrap">
                  <CyclingChip />?
                </span>
              </span>
            </h1>
            <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-ink-2 sm:text-[18px]">
              Check in with the course you're on and see every McGill classmate working on it right now, in the library or online. Message them,
              or open a room with one whiteboard and one timer for the whole group.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">{ctas()}</div>
            <p className="mt-4 text-[13.5px] text-ink-3">
              {stats && stats.studyingNow > 0 ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-ink-2">
                  <span className="live-dot size-2 rounded-full bg-green" />
                  {stats.studyingNow} {stats.studyingNow === 1 ? "student" : "students"} checked in right now
                </span>
              ) : (
                "The demo needs no account and takes about two minutes."
              )}
            </p>
          </div>
          <HeroCluster />
        </section>

        <Ticker />

        {/* ---------- How it works ---------- */}
        <section aria-labelledby="how" className="mx-auto max-w-[1180px] px-4 py-20 sm:px-8 sm:py-28">
          <h2 id="how" className="display max-w-[18ch] text-[38px] leading-[0.98] text-balance sm:text-[56px]">
            Check in. See who's here. Study together.
          </h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3 md:gap-5">
            <Step n={1} title="Check in" body="Pick your course and say what you're on and where. It takes five seconds.">
              <CheckInDemo />
            </Step>
            <Step n={2} title="See who's here" body="Everyone on your course shows up at the top, live. No refreshing.">
              <BoardDemo />
            </Step>
            <Step n={3} title="Study together" body="Message someone, or open a room for the group with a six-letter code.">
              <ChatDemo />
            </Step>
          </ol>
        </section>

        {/* ---------- Rooms ---------- */}
        <section
          aria-labelledby="rooms"
          className="mx-auto grid max-w-[1180px] items-center gap-10 px-4 pb-20 sm:px-8 sm:pb-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16"
        >
          <div className="min-w-0">
            <h2 id="rooms" className="display text-[38px] leading-[0.98] text-balance sm:text-[56px]">
              One timer for the whole group.
            </h2>
            <p className="mt-5 max-w-[32rem] text-[17px] leading-relaxed text-ink-2">
              Start a focus round and everyone's countdown ends at the same second, on every laptop and phone. Work a problem out on a shared
              whiteboard, send a reaction when someone gets it, and keep the group chat with the room.
            </p>
          </div>
          <RoomDemo />
        </section>

        {/* ---------- Closing ---------- */}
        <section className="mx-auto max-w-[1180px] px-4 pb-16 sm:px-8 sm:pb-24">
          <div style={courseVars("COMP 302")} className="relative overflow-hidden rounded-[28px] border-2 border-ink bg-course-fill px-6 py-12 text-white shadow-hard-lg sm:px-12 sm:py-16">
            <p className="poster max-w-[14ch] text-[clamp(44px,9vw,92px)]">Someone in your class is studying right now.</p>
            <div className="mt-8 flex flex-wrap gap-3">{ctas(true)}</div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-4 py-8 text-[14px] text-ink-2 sm:px-8">
          <p>
            Built by{" "}
            <a href="https://www.linkedin.com/in/vipul-modi-883003219/" className="font-semibold text-ink underline decoration-line-strong underline-offset-3 hover:decoration-ink">
              Vipul Modi
            </a>
            , a CS student at McGill.
          </p>
          <a href="https://github.com/vipulmodi0304/mypeers" className="font-semibold text-ink underline decoration-line-strong underline-offset-3 hover:decoration-ink">
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

/* ---------- Hero pieces ---------- */

/** The course code in the headline, printed as a sticker that swaps every few seconds. */
function CyclingChip() {
  const [i, setI] = useState(0);
  useLoop(() => setI((n) => (n + 1) % CYCLE.length), 2400);
  const code = CYCLE[i]!;
  return (
    <span className="relative inline-block align-baseline">
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={code}
          initial={{ y: "70%", opacity: 0, rotate: -9 }}
          animate={{ y: 0, opacity: 1, rotate: -2 }}
          exit={{ y: "-35%", opacity: 0, rotate: 5, transition: { duration: 0.14, ease: "easeIn" } }}
          transition={spring}
          style={{ ...courseVars(code), boxShadow: "0.05em 0.05em 0 var(--hard)" } as CSSProperties}
          className="inline-block rounded-[0.12em] border-[0.035em] border-ink bg-course-fill px-[0.12em] whitespace-nowrap text-white"
        >
          {code}
        </m.span>
      </AnimatePresence>
    </span>
  );
}

/** Placed item in the hero cluster: pops in on load, then drifts. */
function Float({ at, delay, tilt = 0, className, children }: { at: CSSProperties; delay: number; tilt?: number; className?: string; children: ReactNode }) {
  return (
    <m.div
      className={cn("absolute", className)}
      style={at}
      initial={{ opacity: 0, scale: 0.6, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ ...spring, delay }}
    >
      <div className="bob" style={{ "--tilt": `${tilt}deg`, animationDelay: `${-delay * 3}s` } as CSSProperties}>
        {children}
      </div>
    </m.div>
  );
}

function Bubble({ children, from, course, tail = "left" }: { children: ReactNode; from: string; course: string; tail?: "left" | "right" }) {
  return (
    <div
      className={cn(
        "sticker max-w-[230px] rounded-[18px] bg-surface px-3.5 py-2.5 sm:max-w-[260px]",
        tail === "left" ? "rounded-bl-[5px]" : "rounded-br-[5px]",
      )}
    >
      <p className="text-[14.5px] leading-snug font-semibold">{children}</p>
      <p className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-3">
        {from} <CourseTag code={course} size="sm" />
      </p>
    </div>
  );
}

function FaceSticker({ name, course, size }: { name: string; course: string; size: number }) {
  return (
    <span
      style={{ ...courseVars(course), width: size, height: size, fontSize: size * 0.34 }}
      className="sticker grid place-items-center rounded-full bg-course-fill font-bold text-white"
      title={`${name}, ${course}`}
    >
      {initials(name)}
    </span>
  );
}

function TypingDots() {
  return (
    <span className="ml-1 inline-flex gap-[3px] align-middle" aria-hidden>
      {[0, 0.15, 0.3].map((d) => (
        <i key={d} className="typing-dot size-[5px] rounded-full bg-ink" style={{ animationDelay: `${d}s` }} />
      ))}
    </span>
  );
}

function HeroCluster() {
  return (
    <div className="relative mx-auto h-[330px] w-full max-w-[520px] sm:h-[400px] lg:h-[470px]" aria-hidden>
      <Float at={{ left: "0%", top: "3%" }} delay={0.35} tilt={-2}>
        <Bubble from="Maya" course="COMP 251">
          anyone doing A3 tonight?
          <TypingDots />
        </Bubble>
      </Float>
      <Float at={{ right: "6%", top: "1%" }} delay={0.5} tilt={6}>
        <FaceSticker name="Noah Kim" course="COMP 302" size={52} />
      </Float>
      <Float at={{ left: "10%", top: "34%" }} delay={0.62} tilt={-1}>
        <div style={courseVars("COMP 251")} className="sticker w-[250px] rounded-2xl bg-surface p-3.5 sm:w-[280px]">
          <p className="text-[12px] font-semibold text-ink-3">You're checked in</p>
          <div className="mt-2 flex items-center gap-2.5">
            <CourseTag code="COMP 251" size="lg" />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold">Q2, the knapsack one</p>
              <p className="text-[12.5px] text-ink-2">Trottier, for 48m</p>
            </div>
          </div>
        </div>
      </Float>
      <Float at={{ right: "0%", top: "30%" }} delay={0.74} tilt={-7}>
        <FaceSticker name="Daniel Okafor" course="COMP 251" size={64} />
      </Float>
      <Float at={{ left: "4%", bottom: "6%" }} delay={0.86} tilt={5} className="hidden sm:block">
        <FaceSticker name="Sofia Rossi" course="MATH 240" size={48} />
      </Float>
      <Float at={{ right: "2%", bottom: "4%" }} delay={0.98} tilt={2}>
        <Bubble from="Finals grind" course="COMP 251" tail="right">
          25:00 focus, starting now
        </Bubble>
      </Float>
    </div>
  );
}

/** The demo's classmates checking in, scrolling past. Hover to pause. */
function Ticker() {
  const items = DEMO_PEOPLE.map((p) => (
    <span key={p.name} className="inline-flex shrink-0 items-center gap-2 text-[14.5px] font-semibold">
      {p.name.split(" ")[0]} checked in
      <CourseTag code={p.course} size="sm" />
      {p.where === "home" ? "from home" : `at ${p.where}`}
    </span>
  ));
  return (
    <div className="ticker-wrap relative mt-10 flex h-14 items-center overflow-hidden border-y-2 border-ink bg-ink text-canvas sm:mt-14" aria-hidden>
      <span className="absolute left-0 z-10 flex h-full items-center gap-2 bg-ink pr-4 pl-4 text-[12.5px] font-semibold text-canvas/70 sm:pl-8">
        <span className="live-dot size-2 rounded-full bg-green" /> In the demo
      </span>
      {/* Two identical halves; sliding by exactly half loops without a seam. */}
      <div className="pl-36 sm:pl-40">
        <div className="ticker flex w-max">
          <div className="flex shrink-0 gap-10 pr-10">{items}</div>
          <div className="flex shrink-0 gap-10 pr-10">{items}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- How it works ---------- */

function Step({ n, title, body, children }: { n: number; title: string; body: string; children: ReactNode }) {
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-[22px] border-[1.5px] border-line-strong bg-surface">
      <div className="relative h-[220px] border-b-[1.5px] border-line bg-canvas/60">{children}</div>
      <div className="p-5">
        <p className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-full bg-ink text-[13px] font-bold text-canvas">{n}</span>
          <span className="display text-[22px] leading-none">{title}</span>
        </p>
        <p className="mt-2.5 text-[15px] text-ink-2">{body}</p>
      </div>
    </li>
  );
}

/** Types a course code, then turns it into a sticker. Loops while visible. */
function CheckInDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { margin: "-15% 0px" });
  const reduced = useReducedMotion();
  const word = "COMP 251";
  const [n, setN] = useState(reduced ? word.length + 6 : 0);
  useLoop(() => setN((x) => (x >= word.length + 10 ? 0 : x + 1)), 170, visible);
  const typed = word.slice(0, Math.min(n, word.length));
  const done = n > word.length + 1;
  return (
    <div ref={ref} className="flex h-full flex-col justify-center gap-3 px-6">
      <div className="flex h-11 items-center rounded-xl border-[1.5px] border-ink bg-surface px-3.5">
        <span className="course-code text-[17px]">{typed}</span>
        {!done ? <span className="ml-px h-5 w-[2px] animate-pulse bg-ink" /> : null}
      </div>
      <div className="flex h-9 items-center gap-2">
        <AnimatePresence>
          {done ? (
            <m.span key="tag" initial={{ scale: 0.4, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: -3, opacity: 1 }} exit={{ opacity: 0 }} transition={spring}>
              <CourseTag code={word} size="md" />
            </m.span>
          ) : null}
        </AnimatePresence>
        <span className={cn("text-[13px] font-semibold transition-colors", done ? "text-green" : "text-ink-3")}>{done ? "Checked in at Trottier" : "Trottier, 3rd floor"}</span>
      </div>
    </div>
  );
}

/** Classmates arriving at the top of the list. */
function BoardDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { margin: "-15% 0px" });
  const [k, setK] = useState(3);
  useLoop(() => setK((x) => x + 1), 2200, visible);
  const rows = [0, 1, 2].map((o) => DEMO_PEOPLE[(k - o) % DEMO_PEOPLE.length]!);
  return (
    <div ref={ref} className="h-full overflow-hidden px-4 pt-4">
      <ul className="space-y-2">
        <AnimatePresence initial={false} mode="popLayout">
          {rows.map((p, i) => (
            <m.li
              key={`${p.name}-${k - i}`}
              layout
              initial={{ opacity: 0, y: -18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12 }}
              transition={spring}
              className="flex items-center gap-2.5 rounded-xl border-[1.5px] border-line bg-surface px-3 py-2"
            >
              <Avatar name={p.name} course={p.course} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{p.name}</span>
                <span className="block truncate text-[12px] text-ink-3">{p.where === "home" ? "Online" : p.where}</span>
              </span>
              <CourseTag code={p.course} size="sm" />
            </m.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

const CHAT = [
  { mine: false, text: "want to do Q2 together?" },
  { mine: true, text: "yes, I'm on the 3rd floor" },
  { mine: false, text: "opening a room, code K7QX2M" },
];

function ChatDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { margin: "-15% 0px" });
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? CHAT.length : 1);
  useLoop(() => setN((x) => (x >= CHAT.length + 1 ? 1 : x + 1)), 1500, visible);
  return (
    <div ref={ref} className="flex h-full flex-col justify-end gap-2 px-5 pb-5">
      <AnimatePresence initial={false}>
        {CHAT.slice(0, Math.min(n, CHAT.length)).map((msg) => (
          <m.p
            key={msg.text}
            layout
            initial={{ opacity: 0, scale: 0.7, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={spring}
            style={{ transformOrigin: msg.mine ? "bottom right" : "bottom left" }}
            className={cn(
              "max-w-[85%] rounded-[16px] px-3 py-1.5 text-[13.5px] font-medium",
              msg.mine ? "self-end rounded-br-[4px] bg-ink text-canvas" : "self-start rounded-bl-[4px] border-[1.5px] border-line-strong bg-surface",
            )}
          >
            {msg.text}
          </m.p>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Rooms ---------- */

const REACTIONS = ["👏", "🔥", "💡", "✅"];

/** A study room: the tree draws itself, the timer counts, reactions float up. */
function RoomDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { margin: "-15% 0px" });
  // The drawing plays once and then stays; only the timer and reactions keep going.
  const drawn = useInView(ref, { margin: "-15% 0px", once: true });
  const reduced = useReducedMotion();
  const [secs, setSecs] = useState(18 * 60 + 42);
  const [pops, setPops] = useState<{ id: number; e: string; x: number }[]>([]);
  useLoop(() => setSecs((s) => (s > 0 ? s - 1 : 25 * 60)), 1000, visible);
  useLoop(
    () => {
      const id = Date.now();
      setPops((p) => [...p.slice(-3), { id, e: REACTIONS[id % REACTIONS.length]!, x: 15 + (id % 60) }]);
    },
    2600,
    visible,
  );
  const progress = 1 - secs / 1500;
  const nodes = [
    [160, 46, "8"],
    [110, 96, "3"],
    [210, 96, "10"],
    [80, 146, "1"],
    [135, 146, "6"],
    [240, 146, "14"],
  ] as const;
  const draw = (delay: number) => ({
    initial: { pathLength: reduced ? 1 : 0 },
    animate: drawn || reduced ? { pathLength: 1 } : undefined,
    transition: { duration: 0.7, delay, ease: "easeInOut" as const },
  });

  return (
    <div ref={ref} style={courseVars("COMP 251")} className="sticker min-w-0 overflow-hidden rounded-[22px] bg-surface" aria-hidden>
      <div className="flex items-center gap-2.5 border-b-2 border-ink px-4 py-3">
        <CourseTag code="COMP 251" size="sm" />
        <span className="truncate text-[15px] font-bold">Finals grind</span>
        <span className="ml-auto text-[12.5px] font-semibold tracking-wider text-ink-3 tabular">K7QX2M</span>
      </div>
      <div className="grid sm:grid-cols-[minmax(0,1fr)_200px]">
        <div className="relative bg-canvas p-3 sm:p-4">
          <svg viewBox="0 0 320 200" className="w-full rounded-xl border-[1.5px] border-line bg-surface">
            <defs>
              <pattern id="lp-dots" width="14" height="14" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.8" className="fill-line-strong" />
              </pattern>
            </defs>
            <rect width="320" height="200" fill="url(#lp-dots)" />
            <g className="stroke-ink" strokeWidth="2.4" fill="none" strokeLinecap="round">
              {(
                [
                  "M160 46 L110 96",
                  "M160 46 L210 96",
                  "M110 96 L80 146",
                  "M110 96 L135 146",
                  "M210 96 L240 146",
                ] as const
              ).map((d, i) => (
                <m.path key={d} d={d} {...draw(0.2 + i * 0.18)} />
              ))}
            </g>
            {nodes.map(([x, y, n], i) => (
              <m.g
                key={n}
                initial={{ opacity: reduced ? 1 : 0, scale: reduced ? 1 : 0.4 }}
                animate={drawn || reduced ? { opacity: 1, scale: 1 } : undefined}
                transition={{ ...spring, delay: 0.1 + i * 0.12 }}
                style={{ transformOrigin: `${x}px ${y}px` }}
              >
                <circle cx={x} cy={y} r="15" className="fill-surface stroke-ink" strokeWidth="2.4" />
                <text x={x} y={y + 5} textAnchor="middle" fontSize="14" fontWeight="700" className="fill-ink" fontFamily="Hanken Grotesk Variable, sans-serif">
                  {n}
                </text>
              </m.g>
            ))}
            <m.path d="M228 128 q 18 -30 46 -22" stroke="var(--course-ink)" strokeWidth="2.6" fill="none" strokeLinecap="round" {...draw(1.4)} />
            <m.text
              x="244"
              y="96"
              fontSize="13"
              fontWeight="700"
              fill="var(--course-ink)"
              fontFamily="Hanken Grotesk Variable, sans-serif"
              initial={{ opacity: reduced ? 1 : 0 }}
              animate={drawn || reduced ? { opacity: 1 } : undefined}
              transition={{ delay: 1.9 }}
            >
              insert 14?
            </m.text>
          </svg>
          {pops.map((p) => (
            <span key={p.id} className="float-up pointer-events-none absolute bottom-6 text-3xl" style={{ left: `${p.x}%` }}>
              {p.e}
            </span>
          ))}
        </div>
        <div className="border-t-2 border-ink p-4 sm:border-t-0 sm:border-l-2">
          <span className="rounded-md bg-course-soft px-2 py-0.5 text-[12px] font-bold text-course">Focus</span>
          <p className="display mt-2 text-[52px] leading-none tabular" style={{ fontStretch: "75%" }}>
            {String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full border-[1.5px] border-ink bg-surface-2">
            <div className="h-full bg-course-fill transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="mt-4 text-[12.5px] font-semibold text-ink-3">4 here now</p>
          <div className="mt-1.5 flex -space-x-1.5">
            {["Maya Chen", "Daniel Okafor", "Emma Wilson", "Arjun Patel"].map((n) => (
              <Avatar key={n} name={n} size={30} course="COMP 251" className="rounded-full ring-2 ring-surface" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
