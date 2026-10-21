import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
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
  // Under ~2% the band would read as a stray cursor, so it waits until it can read as ink.
  const pct = done ? 100 : Math.min(100, Math.max(0, progress * 100));
  const fill = pct < 2 ? 0 : pct;
  const band = timer.mode === "focus" ? "var(--course, var(--you))" : "color-mix(in srgb, var(--live) 45%, var(--paper))";

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
          className="text-[13px] font-semibold"
          aria-label={`Mode: ${timer.mode}. Switch mode`}
        >
          <span className="hl" style={{ "--hl": "var(--you)" } as CSSProperties}>
            {timer.mode === "focus" ? "Focus" : "Break"}
          </span>
        </button>
        <div className="relative h-[44px] w-[132px]">
          <div aria-hidden className={cn("ink-fill absolute inset-y-0 left-0 transition-[width] duration-300 ease-linear", done && "timer-done")} style={{ width: `${fill}%`, background: band }} />
          <p className="title relative px-1.5 pt-1.5 text-[36px] leading-none tabular">{mmss(secs)}</p>
          <p
            aria-hidden
            className="title absolute inset-0 px-1.5 pt-1.5 text-[36px] leading-none text-on-band tabular transition-[clip-path] duration-300 ease-linear"
            style={{ clipPath: `inset(0 ${100 - fill}% 0 0)` }}
          >
            {mmss(secs)}
          </p>
        </div>
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
    <section aria-label="Shared timer" className="rounded-xl bg-paper-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <div role="radiogroup" aria-label="Timer mode" className="inline-flex gap-1 rounded-lg border-[1.5px] border-rule-strong p-1">
          {(["focus", "break"] as const).map((mode) => (
            <button
              key={mode}
              role="radio"
              aria-checked={timer.mode === mode}
              onClick={() => timer.mode !== mode && action({ type: "mode", mode })}
              className={cn("h-7 rounded-md px-2.5 text-[13px] font-semibold", timer.mode === mode ? "text-ink" : "text-ink-3 hover:text-ink")}
            >
              <span key={String(timer.mode === mode)} className={timer.mode === mode ? "hl swipe" : undefined} style={{ "--hl": "var(--you)" } as CSSProperties}>
                {mode === "focus" ? "Focus 25" : "Break 5"}
              </span>
            </button>
          ))}
        </div>
        <span className="text-[12px] text-ink-3">Everyone sees this</span>
      </div>

      {/*
        The round fills with ink behind the numbers as it runs. The digits are
        drawn twice: toner on the paper, and a copy clipped to the ink so they
        stay black wherever the band has reached (that matters in dark mode).
      */}
      <div className="relative mt-3 h-[78px]">
        <div
          aria-hidden
          className={cn("ink-fill absolute inset-y-0 left-0 transition-[width] duration-300 ease-linear", done && "timer-done")}
          style={{ width: `${fill}%`, background: band }}
        />
        <p className="title relative px-2.5 pt-2.5 text-[64px] leading-none tabular" aria-live="off">
          {mmss(secs)}
        </p>
        <p
          aria-hidden
          className="title absolute inset-0 px-2.5 pt-2.5 text-[64px] leading-none text-on-band tabular transition-[clip-path] duration-300 ease-linear"
          style={{ clipPath: `inset(0 ${100 - fill}% 0 0)` }}
        >
          {mmss(secs)}
        </p>
      </div>
      <p className="mt-2 min-h-5 text-[13px] text-ink-2" role="status">
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
