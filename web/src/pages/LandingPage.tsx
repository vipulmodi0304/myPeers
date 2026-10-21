import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, m, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Burst, Heart, Sparkle, Squiggle, Star } from "@/components/doodles";
import { Avatar, Button, CourseTag, Logo } from "@/components/ui";
import { api } from "@/lib/api";
import { canUseApp, useMe } from "@/lib/auth";
import { courseVars } from "@/lib/courseColor";
import { cn, initials } from "@/lib/format";
import { useStartDemo } from "./AuthPages";

/*
 * Landing page, "Highlighter" direction (docs/DESIGN.md).
 * The page is a student's own study sheet. The headline's course code is
 * highlighted and keeps changing, the sample board below it highlights each
 * classmate in as they "check in", and the sections further down are working
 * pieces of the app rather than pictures of it.
 */

// The demo's sample classmates (server/src/services/demo.ts), so the board shows what the demo really has.
const DEMO_PEOPLE = [
  { name: "Noah Kim", course: "COMP 302", topic: "OCaml recursion", where: "Schulich Library", mins: 6 },
  { name: "Sofia Rossi", course: "MATH 240", topic: "Induction proofs", where: "Redpath basement", mins: 14 },
  { name: "Daniel Okafor", course: "COMP 251", topic: "Midterm review", where: "McLennan, 4th floor", mins: 18 },
  { name: "Maya Chen", course: "COMP 251", topic: "A3: dynamic programming", where: "Trottier, 3rd floor", mins: 42 },
  { name: "Léa Tremblay", course: "ECON 208", topic: "Problem set 4", where: "Bronfman Building", mins: 51 },
  { name: "Arjun Patel", course: "COMP 206", topic: "Bash scripting lab", where: "Online", mins: 63 },
  { name: "Emma Wilson", course: "COMP 251", topic: "Graph algorithms", where: "Online", mins: 77 },
];
const CYCLE = ["COMP 251", "MATH 240", "ECON 208", "COMP 302", "COMP 206"];
const YOU = { "--hl": "var(--you)" } as CSSProperties;

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

  /** The page's two actions. Signed-in visitors just get a way back into the app. */
  const actions = (size: "md" | "lg" = "lg") =>
    signedIn ? (
      <Link to="/app">
        <Button size={size}>Open myPeers</Button>
      </Link>
    ) : (
      <>
        {demoOn ? (
          <Button size={size} onClick={() => demo.mutate()} loading={demo.isPending}>
            Try the demo
          </Button>
        ) : null}
        <Link to="/signup">
          <Button size={size} variant={demoOn ? "secondary" : "primary"}>
            Sign up with your McGill email
          </Button>
        </Link>
      </>
    );

  return (
    <div className="min-h-dvh overflow-x-clip bg-paper">
      {/* Running head, like the top of a printed handout. */}
      <div className="border-b border-rule">
        <div className="code mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-4 py-2.5 text-[12px] text-ink-3 sm:px-8">
          <span>myPeers · live study board</span>
          <span className="hidden md:inline">Classmates on this page are the demo's samples</span>
          <span>p. 1</span>
        </div>
      </div>

      <header className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-4 py-4 sm:px-8 sm:py-5">
        <Link to="/" aria-label="myPeers home">
          <Logo size={24} />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
          <a href="#how" className="hidden rounded-lg px-3 py-2 text-[14.5px] font-semibold text-ink-2 hover:text-ink md:block">
            How it works
          </a>
          <a href="#rooms" className="hidden rounded-lg px-3 py-2 text-[14.5px] font-semibold text-ink-2 hover:text-ink md:block">
            Rooms
          </a>
          {signedIn ? (
            <Link to="/app">
              <Button size="sm">Open myPeers</Button>
            </Link>
          ) : (
            <>
              <Link to="/login" className="rounded-lg px-3 py-2 text-[14.5px] font-semibold text-ink-2 hover:text-ink">
                Sign in
              </Link>
              {demoOn ? (
                <Button size="sm" className="hidden sm:inline-flex" onClick={() => demo.mutate()} loading={demo.isPending}>
                  Try the demo
                </Button>
              ) : null}
            </>
          )}
        </nav>
      </header>

      <main>
        {/* ---------- Hero: the headline, then the board itself ---------- */}
        <section className="relative mx-auto max-w-[1180px] px-4 pt-6 sm:px-8 sm:pt-10">
          <HeroCluster />
          <h1 className="title text-[clamp(50px,10.5vw,96px)]">
            <span className="sr-only">See which McGill classmates are studying your course right now.</span>
            <span aria-hidden className="block">
              Who's studying
              <br />
              <CyclingCode />
              <br />
              right now?
            </span>
          </h1>
          <div className="mt-7 grid gap-6 lg:max-w-[34rem] lg:gap-4">
            <div>
              <p className="max-w-[34rem] text-[17px] leading-relaxed text-ink-2 sm:text-[18px]">
                Check in with the course you're on and where you are. Everyone else on it shows up instantly. Message them, or open a room with one
                whiteboard and one timer for the whole group.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">{actions()}</div>
            </div>
            <MiniCluster />
            <p className="text-[13.5px] text-ink-3 lg:col-start-1">
              {stats && stats.studyingNow > 0 ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-ink-2">
                  <span className="live-dot size-2 rounded-full bg-live" />
                  {stats.studyingNow} {stats.studyingNow === 1 ? "student" : "students"} checked in right now
                </span>
              ) : (
                "The demo needs no account and takes about two minutes."
              )}
            </p>
          </div>
          <LiveBoard />
        </section>

        <HowItWorks />
        <Rooms />

        {/* ---------- Close ---------- */}
        <section className="mx-auto max-w-[1180px] px-4 pt-6 pb-20 sm:px-8 sm:pb-28">
          <div className="border-t-2 border-ink pt-12 sm:pt-16">
            <div className="relative">
              <p className="title max-w-[16ch] text-[clamp(42px,8vw,88px)]">
                Find out who's studying
                <br />
                <span className="relative inline-block whitespace-nowrap">
                  <span className="hl" style={YOU}>
                    your course
                  </span>
                  .
                  <Squiggle size={150} delay={400} className="absolute -bottom-5 left-2 w-[62%]" />
                </span>
              </p>
              <CloseFaces />
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-3">{actions()}</div>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-4 py-8 text-[14px] text-ink-2 sm:px-8">
          <p>
            Built by{" "}
            <a href="https://www.linkedin.com/in/vipul-modi-883003219/" className="font-semibold text-pen underline decoration-pen/40 hover:decoration-pen">
              Vipul Modi
            </a>
            , a CS student at McGill.
          </p>
          <a href="https://github.com/vipulmodi0304/mypeers" className="font-semibold text-pen underline decoration-pen/40 hover:decoration-pen">
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

/* ---------- Hero pieces ---------- */

/** The course code in the headline: highlighted, and re-highlighted each time it changes. */
function CyclingCode() {
  const [i, setI] = useState(0);
  useLoop(() => setI((n) => (n + 1) % CYCLE.length), 2600);
  const code = CYCLE[i]!;
  return (
    <m.span
      key={code}
      style={courseVars(code)}
      className="hl swipe inline-block whitespace-nowrap"
      aria-hidden
      initial={{ y: "-0.35em", rotate: -3, opacity: 0 }}
      animate={{ y: 0, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 14 }}
    >
      {code}
    </m.span>
  );
}

/**
 * The sample board, printed as a table. Every few seconds the next demo
 * classmate checks in at the top, highlighted in their course's ink.
 */
function LiveBoard() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { margin: "-10% 0px" });
  const [head, setHead] = useState(0);
  useLoop(() => setHead((h) => h + 1), 3200, visible);
  const rows = [0, 1, 2, 3].map((o) => {
    const k = head - o + DEMO_PEOPLE.length * 100;
    return { ...DEMO_PEOPLE[k % DEMO_PEOPLE.length]!, key: k, fresh: o === 0 && head > 0 };
  });

  return (
    <div ref={ref} className="relative mt-10 sm:mt-12" aria-label="Sample classmates checked in" role="img">
      {/* Margin note in ballpoint, with an arrow down to the board. */}
      <div className="pen-note pointer-events-none absolute -top-14 right-0 hidden -rotate-2 items-end gap-2 text-[15px] lg:flex" aria-hidden>
        <span className="pb-6 text-right leading-snug">
          sample classmates from the demo,
          <br />
          highlighted in as they check in
        </span>
        <svg width="46" height="64" viewBox="0 0 46 64" fill="none" className="text-pen">
          <path className="pen-draw" style={{ "--len": 1, "--draw-delay": "600ms" } as CSSProperties} pathLength={1} d="M8 4c18 6 30 22 26 52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path className="pen-draw" style={{ "--len": 1, "--draw-delay": "1300ms" } as CSSProperties} pathLength={1} d="M24 47l10 10 7-13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="code hidden grid-cols-[minmax(0,13rem)_7.5rem_minmax(0,1fr)_minmax(0,14rem)_5rem] gap-5 border-t-2 border-ink py-2.5 text-[11.5px] text-ink-3 md:grid">
        <span>Name</span>
        <span>Course</span>
        <span>Working on</span>
        <span>Where</span>
        <span className="text-right">For</span>
      </div>
      <ul className="divide-y divide-rule border-y border-rule max-md:border-t-2 max-md:border-t-ink">
        <AnimatePresence initial={false} mode="popLayout">
          {rows.map((p, i) => (
            <m.li
              key={p.key}
              layout="position"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              style={courseVars(p.course)}
              className={cn(
                "grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 py-3 md:grid-cols-[minmax(0,13rem)_7.5rem_minmax(0,1fr)_minmax(0,14rem)_5rem] md:items-center md:gap-5 md:py-3.5",
                p.fresh && "arrive",
                i === 3 && "max-sm:hidden",
              )}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <m.span
                  initial={p.fresh ? { scale: 0.2, rotate: -25 } : false}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 520, damping: 12, delay: 0.1 }}
                  className="inline-flex"
                >
                  <Avatar name={p.name} course={p.course} size={28} />
                </m.span>
                <span className="truncate text-[15px] font-semibold">{p.name}</span>
              </span>
              <span className="text-right md:text-left">
                <CourseTag code={p.course} size="sm" className={p.fresh || head === 0 ? "swipe" : undefined} />
              </span>
              <span className="col-span-2 truncate pl-[38px] text-[14px] text-ink-2 md:col-span-1 md:pl-0 md:text-[15px]">
                {p.topic}
                <span className="text-ink-3 md:hidden"> · {p.where}</span>
              </span>
              <span className="hidden truncate text-[15px] text-ink-2 md:block">{p.where}</span>
              <span className="code hidden text-right text-[12.5px] text-ink-3 md:block">{p.fresh ? "just now" : `${p.mins} min`}</span>
            </m.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

/* ---------- How it works: one walkthrough, the steps light up as it plays ---------- */

const STEPS = [
  { title: "Check in", body: "Pick your course, say what you're on and where. Five seconds." },
  { title: "See who's here", body: "Everyone on your course shows up at the top, live. No refreshing." },
  { title: "Study together", body: "Message someone, or open a room for the group with a six-letter code." },
];

// Frames of the walkthrough (one frame = 110 ms).
const F = { course: 8, topic: 31, where: 50, press: 54, checked: 58, maya: 64, daniel: 70, msg: 86, reply: 100, end: 128 };
const TYPED = { course: "COMP 251", topic: "A3: dynamic programming", where: "Trottier, 3rd floor" };

function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { margin: "-20% 0px" });
  const reduced = useReducedMotion();
  const [f, setF] = useState(reduced ? F.end - 10 : 0);
  useLoop(() => setF((x) => (x >= F.end ? 0 : x + 1)), 110, visible);
  const step = reduced ? -1 : f < F.checked ? 0 : f < F.msg ? 1 : 2;

  return (
    <section id="how" aria-labelledby="how-title" className="mx-auto max-w-[1180px] scroll-mt-6 px-4 pt-24 pb-20 sm:px-8 sm:pt-32 sm:pb-28">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
        <div>
          <h2 id="how-title" className="title max-w-[12ch] text-[clamp(38px,5.4vw,60px)]">
            Check in. See who's here. Study together.
          </h2>
          <ol className="mt-10 space-y-7">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[2rem_1fr] gap-x-3">
                <span className="code pt-1 text-[13px] text-ink-3">{i + 1}.</span>
                <div>
                  <p className="heading text-[22px]">
                    <span key={String(step === i)} className={step === i ? "hl swipe" : undefined} style={YOU}>
                      {s.title}
                    </span>
                  </p>
                  <p className="mt-1.5 max-w-[30rem] text-[16px] text-ink-2">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div ref={ref} aria-hidden>
          <Walkthrough f={f} />
        </div>
      </div>
    </section>
  );
}

function typed(text: string, from: number, f: number) {
  return text.slice(0, Math.max(0, Math.min(text.length, f - from)));
}

/** A small, working-looking copy of the Study now screen that plays the three steps. */
function Walkthrough({ f }: { f: number }) {
  const course = typed(TYPED.course, 0, f);
  const topic = typed(TYPED.topic, F.course, f);
  const where = typed(TYPED.where, F.topic, f);
  const field = f < F.course ? 0 : f < F.topic ? 1 : f < F.where ? 2 : -1;
  const checked = f >= F.checked;

  return (
    <div className="overflow-hidden rounded-[14px] border border-rule-strong bg-paper">
      <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
        <span className="heading text-[15px]">Study now</span>
        <span className="code text-[11.5px] text-ink-3">3 classmates online</span>
      </div>
      <div className="h-[400px] p-4 sm:p-5">
        <AnimatePresence mode="wait" initial={false}>
          {!checked ? (
            <m.div key="form" exit={{ opacity: 0, y: -6, transition: { duration: 0.18 } }}>
              <p className="heading border-b border-rule pb-3 text-[19px]">What are you studying?</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[8.5rem_1fr]">
                <FakeField label="Course" active={field === 0} mono>
                  {course}
                </FakeField>
                <FakeField label="Working on" active={field === 1}>
                  {topic}
                </FakeField>
                <FakeField label="Where" active={field === 2} className="sm:col-span-2">
                  {where}
                </FakeField>
              </div>
              <p className="mt-3 flex flex-wrap items-center text-[12.5px] text-ink-2">
                <span className="mr-2 text-ink-3">Quick pick</span>
                {["McLennan", "Redpath", "Trottier", "Schulich", "Online"].map((p, i) => (
                  <span key={p} className={cn("px-2", i > 0 && "border-l border-rule")}>
                    <span className={cn(f >= F.topic + 3 && p === "Trottier" && "hl swipe font-semibold")} style={YOU}>
                      {p}
                    </span>
                  </span>
                ))}
              </p>
              <span
                className={cn(
                  "btn-ink mt-5 inline-flex h-11 items-center px-6 text-[14.5px] font-bold transition-transform",
                  f >= F.press && f < F.checked && "scale-95",
                )}
              >
                Check in
              </span>
            </m.div>
          ) : (
            <m.div key="board" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <div style={courseVars("COMP 251")} className="relative flex items-center gap-3 rounded-xl border-2 border-ink p-3">
                <Burst colors={["var(--pen)", "var(--c4-ink)", "var(--c6-ink)"]} />
                <CourseTag code="COMP 251" size="md" swipe />
                <div className="min-w-0">
                  <p className="text-[11.5px] font-semibold text-ink-3">You're checked in</p>
                  <p className="truncate text-[14px] font-semibold">A3: dynamic programming</p>
                </div>
                <span className="code ml-auto text-[11.5px] text-ink-3">just now</span>
              </div>
              <p className="mt-4 flex items-baseline gap-2.5 pb-1.5">
                <CourseTag code="COMP 251" size="sm" />
                <span className="text-[12px] font-medium text-ink-3">Your course</span>
              </p>
              <ul className="divide-y divide-rule border-y border-rule">
                {[
                  { name: "Maya Chen", topic: "A3: dynamic programming", where: "Trottier, 3rd floor", at: F.maya },
                  { name: "Daniel Okafor", topic: "Midterm review", where: "McLennan, 4th floor", at: F.daniel },
                ]
                  .filter((p) => f >= p.at)
                  .map((p) => (
                    <m.li
                      key={p.name}
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 420, damping: 18 }}
                      style={courseVars("COMP 251")}
                      className="arrive flex items-center gap-2.5 py-2.5"
                    >
                      <Avatar name={p.name} course="COMP 251" size={28} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold">{p.name}</span>
                        <span className="block truncate text-[12.5px] text-ink-2">
                          {p.topic} <span className="text-ink-3">in {p.where}</span>
                        </span>
                      </span>
                      <span className={cn("rounded-md px-2 py-1 text-[12px] font-semibold text-ink-2", p.name === "Daniel Okafor" && f >= F.msg - 4 && "bg-paper-2 text-ink")}>
                        Message
                      </span>
                    </m.li>
                  ))}
              </ul>
              <div className="mt-4 flex flex-col gap-1.5">
                <AnimatePresence initial={false}>
                  {f >= F.msg ? (
                    <Note key="a" from="Daniel">
                      want to do Q2 together?
                    </Note>
                  ) : null}
                  {f >= F.reply ? (
                    <Note key="b" mine>
                      yes, come up to the 3rd floor
                    </Note>
                  ) : null}
                </AnimatePresence>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FakeField({ label, active, mono, className, children }: { label: string; active: boolean; mono?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <p className="mb-1 text-[12px] font-semibold text-ink-2">{label}</p>
      <div className={cn("flex h-10 items-center rounded-lg border-[1.5px] bg-paper px-3 text-[14px]", active ? "border-ink ring-[3px] ring-pen/20" : "border-rule-strong")}>
        <span className={cn("truncate", mono && "code uppercase")}>{children}</span>
        {active ? <span className="caret ml-px h-4 w-[2px] shrink-0 bg-pen" /> : null}
      </div>
    </div>
  );
}

function Note({ from, mine, children }: { from?: string; mine?: boolean; children: ReactNode }) {
  return (
    <m.p
      layout
      initial={{ opacity: 0, y: 8, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 480, damping: 17 }}
      style={{ transformOrigin: mine ? "bottom right" : "bottom left" }}
      className={cn(
        "max-w-[80%] rounded-[14px] px-3 py-1.5 text-[13.5px]",
        mine ? "self-end rounded-br-[4px] bg-ink text-paper" : "self-start rounded-bl-[4px] border border-rule-strong bg-paper-2",
      )}
    >
      {from ? <span className="mr-1.5 font-semibold">{from}</span> : null}
      {children}
    </m.p>
  );
}

/* ---------- The desk: notes, faces and doodles beside the headline ---------- */

const pop = (delay: number) => ({
  initial: { opacity: 0, scale: 0.4, y: 28 },
  animate: { opacity: 1, scale: 1, y: 0 },
  transition: { type: "spring" as const, stiffness: 360, damping: 14, delay },
});

/**
 * Something lying on the desk. It pops in on a spring, drifts, tilts when you
 * hover it, and you can pick it up and toss it: it springs back to its spot.
 */
function DeskItem({ at, delay, tilt = 0, className, children }: { at: CSSProperties; delay: number; tilt?: number; className?: string; children: ReactNode }) {
  return (
    <m.div
      className={cn("absolute cursor-grab touch-none active:cursor-grabbing", className)}
      style={at}
      {...pop(delay)}
      drag
      dragSnapToOrigin
      dragElastic={0.5}
      dragTransition={{ bounceStiffness: 420, bounceDamping: 14 }}
      whileHover={{ scale: 1.05, rotate: -tilt * 0.6 }}
      whileDrag={{ scale: 1.12, rotate: tilt * 2, zIndex: 20 }}
    >
      <div className="bob" style={{ "--tilt": `${tilt}deg`, animationDelay: `${-delay * 3}s` } as CSSProperties}>
        {children}
      </div>
    </m.div>
  );
}

function PassedNote({ from, course, width = 232, children }: { from: string; course: string; width?: number; children: ReactNode }) {
  return (
    <div className="paper-shadow">
      <div className="paper-note px-4 pt-3 pb-6" style={{ width }}>
        <p className="hand text-[17px] leading-[22px] font-medium">{children}</p>
        <p className="mt-1.5 flex items-center gap-2 text-[12px] font-semibold text-[#5c6170]">
          {from} <CourseTag code={course} size="sm" />
        </p>
      </div>
    </div>
  );
}

function PaperFace({ name, course, size }: { name: string; course: string; size: number }) {
  return (
    <span
      style={{ ...courseVars(course), width: size, height: size, fontSize: size * 0.34 }}
      className="paper-face grid place-items-center rounded-full bg-course-band font-extrabold text-on-band"
      title={`${name}, ${course}`}
    >
      {initials(name)}
    </span>
  );
}

function StickyNote({ course, children, sub }: { course: string; children: ReactNode; sub: string }) {
  return (
    // Real sticky notes are pale paper in both themes, so these colours don't follow dark mode.
    <div style={{ "--sticky": STICKY[course.length % STICKY.length] } as CSSProperties} className="sticky-note w-[178px] p-3.5 pb-4">
      <p className="hand text-[17px] leading-snug font-semibold">{children}</p>
      <p className="mt-2 text-[11.5px] font-semibold text-[#5c6170]">{sub}</p>
    </div>
  );
}

const STICKY = ["#dff3cf", "#ffe3f1", "#dcefff"];

function TypingDots() {
  return (
    <span className="ml-1 inline-flex gap-[3px] align-middle" aria-hidden>
      {[0, 0.15, 0.3].map((d) => (
        <i key={d} className="typing-dot size-[5px] rounded-full bg-[#1b1d22]" style={{ animationDelay: `${d}s` }} />
      ))}
    </span>
  );
}

/** Wide screens: the desk beside the headline, in the space its shorter lines leave. */
function HeroCluster() {
  return (
    <div className="pointer-events-none absolute top-[150px] right-8 hidden h-[350px] w-[390px] lg:block" aria-hidden>
      <div className="pointer-events-auto">
        <DeskItem at={{ left: 40, top: 0 }} delay={0.35} tilt={-3}>
          <PassedNote from="Maya" course="COMP 251">
            anyone doing A3 tonight?
            <TypingDots />
          </PassedNote>
        </DeskItem>
        <DeskItem at={{ right: 0, top: -30 }} delay={0.5} tilt={8}>
          <PaperFace name="Noah Kim" course="COMP 302" size={54} />
        </DeskItem>
        <DeskItem at={{ right: 4, top: 104 }} delay={0.62} tilt={-6}>
          <PaperFace name="Daniel Okafor" course="COMP 251" size={70} />
        </DeskItem>
        <DeskItem at={{ left: 0, top: 136 }} delay={0.74} tilt={4}>
          <StickyNote course="COMP 251" sub="Finals grind · COMP 251">
            25:00 focus, starting now!
          </StickyNote>
        </DeskItem>
        <DeskItem at={{ left: 206, top: 206 }} delay={0.86} tilt={-2}>
          <PassedNote from="Sofia" course="MATH 240" width={176}>
            saving you a seat in Redpath
          </PassedNote>
        </DeskItem>
      </div>
      <Star size={28} delay={1300} className="absolute top-[100px] left-[278px] text-pen" />
      <Heart size={22} delay={1500} className="absolute top-[268px] left-[176px] text-[var(--c6-ink)]" />
      <Sparkle size={20} delay={1700} className="absolute top-[-30px] left-[150px] text-pen" />
      <p className="pen-note absolute top-[300px] left-[10px] rotate-[-4deg] text-[14px]">go on, move them around</p>
    </div>
  );
}

/** Phones and tablets: a smaller desk between the buttons and the board. */
function MiniCluster() {
  return (
    <div className="relative h-[150px] lg:hidden" aria-hidden>
      <DeskItem at={{ left: 0, top: 8 }} delay={0.4} tilt={-3}>
        <PassedNote from="Maya" course="COMP 251" width={200}>
          anyone doing A3 tonight?
        </PassedNote>
      </DeskItem>
      <DeskItem at={{ left: 214, top: 0 }} delay={0.55} tilt={8}>
        <PaperFace name="Daniel Okafor" course="COMP 251" size={58} />
      </DeskItem>
      <DeskItem at={{ left: 250, top: 70 }} delay={0.7} tilt={-6}>
        <PaperFace name="Noah Kim" course="COMP 302" size={44} />
      </DeskItem>
      <Star size={22} delay={1100} className="absolute top-[96px] left-[200px] text-pen" />
    </div>
  );
}

/** The close: a few faces waiting on the desk. */
function CloseFaces() {
  return (
    <div className="pointer-events-none absolute top-0 right-0 hidden h-full w-[300px] lg:block" aria-hidden>
      <div className="pointer-events-auto">
        <DeskItem at={{ right: 150, top: 20 }} delay={0.2} tilt={-6}>
          <PaperFace name="Léa Tremblay" course="ECON 208" size={64} />
        </DeskItem>
        <DeskItem at={{ right: 40, top: 0 }} delay={0.35} tilt={7}>
          <PaperFace name="Arjun Patel" course="COMP 206" size={78} />
        </DeskItem>
        <DeskItem at={{ right: 90, top: 110 }} delay={0.5} tilt={-3}>
          <PaperFace name="Emma Wilson" course="COMP 251" size={56} />
        </DeskItem>
      </div>
      <p className="pen-note absolute top-[190px] right-[30px] rotate-[-4deg] text-[16px]">
        see you on the board <Heart size={18} delay={900} className="inline-block align-[-3px] text-[var(--c6-ink)]" />
      </p>
    </div>
  );
}

/* ---------- Rooms ---------- */

const REACTIONS = [
  { e: "👏", who: "Maya" },
  { e: "💡", who: "Daniel" },
  { e: "🔥", who: "Emma" },
  { e: "✅", who: "Arjun" },
];

function Rooms() {
  return (
    <section id="rooms" aria-labelledby="rooms-title" className="scroll-mt-6 bg-paper-2">
      <div className="mx-auto max-w-[1180px] px-4 py-20 sm:px-8 sm:py-28">
        <h2 id="rooms-title" className="title max-w-[14ch] text-[clamp(38px,5.4vw,60px)]">
          One timer for the whole{" "}
          <span className="hl" style={courseVars("COMP 251")}>
            group
          </span>
          .
        </h2>
        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-14">
          <RoomPreview />
          <div className="space-y-6 lg:pt-2">
            <p className="text-[17px] leading-relaxed text-ink-2">
              Start a focus round and everyone's countdown ends at the same second, on every laptop and phone in the room.
            </p>
            <ul className="space-y-4 border-t border-rule-strong pt-6 text-[15.5px]">
              <li>
                <p className="font-semibold">A shared whiteboard</p>
                <p className="text-ink-2">Work a problem out together. Everyone sees each stroke as it's drawn.</p>
              </li>
              <li>
                <p className="font-semibold">A six-letter code</p>
                <p className="text-ink-2">Send it to your group. Anyone with it can join.</p>
              </li>
              <li>
                <p className="font-semibold">Chat that stays with the room</p>
                <p className="text-ink-2">Plus quick reactions when someone finally gets it.</p>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/** A study room: the tree draws itself in pen, the timer fills with ink as it counts down. */
function RoomPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { margin: "-15% 0px" });
  const drawn = useInView(ref, { margin: "-15% 0px", once: true });
  const reduced = useReducedMotion();
  const [secs, setSecs] = useState(9 * 60 + 42);
  const [pops, setPops] = useState<{ id: number; e: string; who: string; x: number }[]>([]);
  useLoop(() => setSecs((s) => (s > 0 ? s - 1 : 25 * 60)), 1000, visible);
  // Someone in the room reacts every few seconds; the emoji floats up over the board.
  useLoop(
    () => {
      const id = Date.now();
      const r = REACTIONS[id % REACTIONS.length]!;
      setPops((p) => [...p.slice(-3), { id, e: r.e, who: r.who, x: 12 + (id % 62) }]);
    },
    2700,
    visible,
  );
  const fill = Math.max(3, (1 - secs / 1500) * 100);
  const clock = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  const show = drawn || reduced;

  const edges = ["M160 44 L108 96", "M160 44 L212 96", "M108 96 L76 148", "M108 96 L136 148", "M212 96 L244 148"];
  const nodes = [
    [160, 44, "8"],
    [108, 96, "3"],
    [212, 96, "10"],
    [76, 148, "1"],
    [136, 148, "6"],
    [244, 148, "14"],
  ] as const;
  const draw = (i: number) => (show ? { className: "pen-draw", style: { "--len": 1, "--draw-delay": `${200 + i * 160}ms` } as CSSProperties } : { opacity: 0 });

  return (
    <div ref={ref} style={courseVars("COMP 251")} className="min-w-0 overflow-hidden rounded-[14px] border border-rule-strong bg-paper" aria-hidden>
      <div className="flex items-center gap-3 border-b-2 border-ink px-4 py-3">
        <CourseTag code="COMP 251" size="sm" />
        <span className="heading truncate text-[17px]">Finals grind</span>
        <span className="code ml-auto text-[12px] tracking-wider text-ink-3">K7QX2M</span>
      </div>
      <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
        <div className="relative overflow-hidden bg-paper-2 p-3 sm:p-4">
          {pops.map((p) => (
            <span key={p.id} className="float-up pointer-events-none absolute bottom-4 z-10 flex flex-col items-center" style={{ left: `${p.x}%` }}>
              <span className="text-3xl">{p.e}</span>
              <span className="hand rounded bg-ink/85 px-1.5 text-[11px] font-semibold text-paper">{p.who}</span>
            </span>
          ))}
          <svg viewBox="0 0 320 196" className="graph-paper w-full rounded-[10px] border border-rule-strong">
            {/* A highlighter swipe across node 14, in the course ink. */}
            <rect x="222" y="134" width="46" height="26" rx="5" fill="var(--course)" opacity={show ? 0.9 : 0} transform="rotate(-4 245 147)" style={{ transition: "opacity 400ms 1.6s" }} />
            <g stroke="#1b2140" strokeWidth="2.3" fill="none" strokeLinecap="round">
              {edges.map((d, i) => (
                <path key={d} d={d} pathLength={1} {...draw(i)} />
              ))}
              {nodes.map(([x, y], i) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r="14" pathLength={1} fill="#fff" {...draw(i + 1)} />
              ))}
            </g>
            {nodes.map(([x, y, n], i) => (
              <text
                key={n}
                x={x}
                y={y + 5}
                textAnchor="middle"
                fontSize="14"
                fontWeight="700"
                fill="#1b2140"
                fontFamily="Archivo Variable, sans-serif"
                opacity={show ? 1 : 0}
                style={{ transition: `opacity 300ms ${0.4 + i * 0.16}s` }}
              >
                {n}
              </text>
            ))}
            <path d="M262 128 q 12 -26 40 -26" stroke="var(--pen)" strokeWidth="2" fill="none" strokeLinecap="round" pathLength={1} {...draw(8)} />
            <text x="252" y="92" fontSize="13" fontStyle="italic" fontWeight="600" fill="var(--pen)" fontFamily="Archivo Variable, sans-serif" opacity={show ? 1 : 0} style={{ transition: "opacity 300ms 1.9s" }}>
              insert 14?
            </text>
          </svg>
        </div>
        <div className="border-t border-rule p-4 sm:border-t-0 sm:border-l">
          <p className="text-[12.5px] font-semibold text-ink-2">
            <span className="hl" style={YOU}>
              Focus 25
            </span>{" "}
            <span className="ml-1 font-medium text-ink-3">Break 5</span>
          </p>
          <div className="relative mt-3 h-[64px]">
            <div className="ink-fill absolute inset-y-0 left-0 bg-course-band transition-[width] duration-700 ease-linear" style={{ width: `${fill}%` }} />
            <p className="title relative px-2 pt-2 text-[50px] leading-none tabular">{clock}</p>
            <p className="title absolute inset-0 px-2 pt-2 text-[50px] leading-none text-on-band tabular" style={{ clipPath: `inset(0 ${100 - fill}% 0 0)` }}>
              {clock}
            </p>
          </div>
          <p className="mt-2 text-[12.5px] text-ink-3">Daniel started the timer</p>
          <p className="mt-5 text-[12.5px] font-semibold text-ink-2">4 here now</p>
          <div className="mt-2 flex -space-x-1.5">
            {["Maya Chen", "Daniel Okafor", "Emma Wilson", "Arjun Patel"].map((n) => (
              <Avatar key={n} name={n} size={30} course="COMP 251" className="rounded-full ring-2 ring-paper" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
