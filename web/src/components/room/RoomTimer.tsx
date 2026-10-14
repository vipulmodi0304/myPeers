import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Button } from "@/components/ui";
import { cn, mmss } from "@/lib/format";
import type { TimerState } from "@/lib/types";

/** Remaining seconds, computed locally from the server's end time. */
function remaining(t: TimerState, offset: number) {
  if (t.endsAt === null) return t.remainingSec;
  return Math.max(0, Math.ceil((t.endsAt - (Date.now() + offset)) / 1000));
}

/** A soft two-note chime when a round ends (no audio files needed). */
function chime() {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.22 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.22);
      o.stop(ctx.currentTime + i * 0.22 + 0.65);
    });
    setTimeout(() => void ctx.close(), 1500);
  } catch {
    /* audio not available */
  }
}

export function RoomTimer({
  timer,
  clockOffset,
  lastBy,
  emit,
  compact = false,
}: {
  compact?: boolean;
  timer: TimerState;
  clockOffset: MutableRefObject<number>;
  lastBy: { name: string; action: string } | null;
  emit: (event: string, payload?: Record<string, unknown>) => void;
}) {
  const [secs, setSecs] = useState(() => remaining(timer, clockOffset.current));
  const running = timer.endsAt !== null && secs > 0;
  const wasRunning = useRef(running);

  useEffect(() => {
    const tick = () => setSecs(remaining(timer, clockOffset.current));
    tick();
    if (timer.endsAt === null) return;
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [timer, clockOffset]);

  useEffect(() => {
    if (wasRunning.current && timer.endsAt !== null && secs === 0) chime();
    wasRunning.current = running;
  }, [secs, running, timer.endsAt]);

  const action = (a: Record<string, unknown>) => emit("timer:action", { action: a });
  const done = secs === 0;
  const progress = 1 - secs / timer.durationSec;

  useEffect(() => {
    const base = "myPeers";
    document.title = running ? `${mmss(secs)} ${timer.mode === "focus" ? "focus" : "break"} | ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [secs, running, timer.mode]);

  const primary = running ? (
    <Button variant="secondary" className="flex-1" onClick={() => action({ type: "pause" })}>
      <Pause className="size-4" /> Pause
    </Button>
  ) : done ? (
    <Button
      className="flex-1"
      onClick={() => {
        action({ type: "mode", mode: timer.mode === "focus" ? "break" : "focus" });
        action({ type: "start" });
      }}
    >
      {timer.mode === "focus" ? "Start break" : "Back to focus"}
    </Button>
  ) : (
    <Button className="flex-1" onClick={() => action({ type: "start" })}>
      <Play className="size-4" /> Start
    </Button>
  );

  if (compact) {
    // Phones: one row, so the whiteboard keeps most of the screen.
    return (
      <section aria-label="Shared timer" className="flex items-center gap-3">
        <button
          onClick={() => action({ type: "mode", mode: timer.mode === "focus" ? "break" : "focus" })}
          className={cn("rounded-md px-2 py-1 text-[12px] font-semibold", timer.mode === "focus" ? "bg-red-soft text-red" : "bg-surface-2 text-green")}
          aria-label={`Mode: ${timer.mode}. Switch mode`}
        >
          {timer.mode === "focus" ? "Focus" : "Break"}
        </button>
        <p className={cn("text-[34px] leading-none font-extrabold tabular", done && "text-red")} style={{ fontStretch: "75%" }}>
          {mmss(secs)}
        </p>
        <div className="ml-auto flex w-40 gap-1.5">
          {primary}
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="Reset timer" onClick={() => action({ type: "reset" })}>
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Shared timer" className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div role="radiogroup" aria-label="Timer mode" className="inline-flex rounded-lg bg-surface-2 p-0.5">
          {(["focus", "break"] as const).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={timer.mode === m}
              onClick={() => timer.mode !== m && action({ type: "mode", mode: m })}
              className={cn(
                "h-7 rounded-md px-2.5 text-[13px] font-semibold",
                timer.mode === m ? "bg-surface text-ink shadow-sm" : "text-slate hover:text-ink",
              )}
            >
              {m === "focus" ? "Focus 25" : "Break 5"}
            </button>
          ))}
        </div>
        <span className="text-[12px] text-slate">Everyone sees this</span>
      </div>

      <p
        className={cn("mt-3 text-[56px] leading-none font-extrabold tabular", done && "text-red")}
        style={{ fontStretch: "75%" }}
        aria-live="off"
      >
        {mmss(secs)}
      </p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className={cn("h-full rounded-full", timer.mode === "focus" ? "bg-red" : "bg-green")} style={{ width: `${Math.min(100, progress * 100)}%` }} />
      </div>
      <p className="mt-2 min-h-5 text-[13px] text-slate" role="status">
        {done
          ? timer.mode === "focus"
            ? "Focus round done. Take a break."
            : "Break's over. Ready for another round?"
          : lastBy
            ? `${lastBy.name} ${lastBy.action === "start" ? "started" : lastBy.action === "pause" ? "paused" : lastBy.action === "reset" ? "reset" : "switched"} the timer`
            : running
              ? "Running"
              : "Start it when your group is ready."}
      </p>

      <div className="mt-3 flex gap-2">
        {primary}
        <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Reset timer" onClick={() => action({ type: "reset" })}>
          <RotateCcw className="size-4" />
        </Button>
      </div>
    </section>
  );
}
