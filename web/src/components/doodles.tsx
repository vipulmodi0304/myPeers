import { m, useReducedMotion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/format";

/*
 * Ballpoint doodles: the little marks students draw in the margins of their
 * notes. Every stroke writes itself in once (the .pen-draw class), in
 * ballpoint blue by default. Sizes are in px; colour follows currentColor.
 */

type DoodleProps = { size?: number; className?: string; delay?: number; style?: CSSProperties; strokeWidth?: number };

function Svg({ size = 28, className, delay = 0, style, strokeWidth = 2, viewBox = "0 0 32 32", children }: DoodleProps & { viewBox?: string; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("text-pen", className)}
      style={{ "--draw-delay": `${delay}ms`, ...style } as CSSProperties}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** One stroke that draws itself. */
const P = ({ d, i = 0 }: { d: string; i?: number }) => (
  <path className="pen-draw" pathLength={1} d={d} style={{ "--len": 1, animationDelay: `calc(var(--draw-delay, 0ms) + ${i * 160}ms)` } as CSSProperties} />
);

export const Star = (p: DoodleProps) => (
  <Svg {...p}>
    <P d="M16 3.5l3.4 7.6 8.2.8-6.2 5.5 1.9 8.1L16 21.3l-7.3 4.2 1.9-8.1-6.2-5.5 8.2-.8z" />
  </Svg>
);

export const Heart = (p: DoodleProps) => (
  <Svg {...p}>
    <P d="M16 27C9 21.6 4 17.4 4 11.6 4 8 6.8 5.4 10 5.4c2.5 0 4.6 1.5 6 3.8 1.4-2.3 3.5-3.8 6-3.8 3.2 0 6 2.6 6 6.2 0 5.8-5 10-12 15.4z" />
  </Svg>
);

export const Sparkle = (p: DoodleProps) => (
  <Svg {...p}>
    <P d="M16 3v9" />
    <P d="M16 20v9" i={1} />
    <P d="M3 16h9" i={2} />
    <P d="M20 16h9" i={3} />
  </Svg>
);

export const Squiggle = ({ size = 90, ...p }: DoodleProps) => (
  <Svg size={size} viewBox="0 0 90 16" {...p} style={{ height: (size * 16) / 90, ...p.style }}>
    <P d="M2 10c6-8 10-8 14 0s9 8 14 0 9-8 14 0 9 8 14 0 9-8 14 0 8 6 14-2" />
  </Svg>
);

export const Smiley = (p: DoodleProps) => (
  <Svg {...p}>
    <P d="M16 4.5c6.4 0 11.5 5.1 11.5 11.5S22.4 27.5 16 27.5 4.5 22.4 4.5 16 9.6 4.5 16 4.5z" />
    <P d="M12 13v1.5M20 13v1.5" i={2} />
    <P d="M10.5 19.5c3 3.6 8 3.6 11 0" i={3} />
  </Svg>
);

/** A sleepy face with a little Zz: for "it's quiet right now". */
export const Sleepy = (p: DoodleProps) => (
  <Svg {...p} viewBox="0 0 48 40">
    <P d="M20 9c6.6 0 12 5.4 12 12s-5.4 12-12 12S8 27.6 8 21 13.4 9 20 9z" />
    <P d="M14 20c1 1.2 2.6 1.2 3.6 0M22.4 20c1 1.2 2.6 1.2 3.6 0" i={2} />
    <P d="M17 27c2 1 4 1 6 0" i={3} />
    <P d="M33 6h6l-6 7h6" i={4} />
    <P d="M41 1h4l-4 4.5h4" i={5} />
  </Svg>
);

/** A folded note with a heart: for empty inboxes. */
export const NoteDoodle = (p: DoodleProps) => (
  <Svg {...p} viewBox="0 0 40 36">
    <P d="M5 7l26-3 4 23-26 4z" />
    <P d="M5 7l14 12 16-15" i={1} />
    <P d="M27 26c-2-1.6-3.6-3-3.6-4.6 0-1.2.9-2 1.9-2 .8 0 1.4.5 1.7 1.1.3-.6.9-1.1 1.7-1.1 1 0 1.9.8 1.9 2 0 1.6-1.6 3-3.6 4.6z" i={3} />
  </Svg>
);

/** A little door with a key: for "no rooms yet". */
export const DoorDoodle = (p: DoodleProps) => (
  <Svg {...p} viewBox="0 0 40 40">
    <P d="M9 36V6h18v30" />
    <P d="M5 36h28" i={1} />
    <P d="M22 21v.5" i={2} />
    <P d="M30 13c3 0 5 2 5 4.5S33 22 30 22s-5-2-5-4.5S27 13 30 13zM35 17.5h3.5v2.5" i={3} />
  </Svg>
);

/**
 * A burst of pen marks popping out around something that just happened:
 * checking in, finishing a focus round. Plays once; reduced motion shows it still.
 */
export function Burst({ className, colors }: { className?: string; colors?: string[] }) {
  const reduced = useReducedMotion();
  const marks = [
    { x: -46, y: -30, r: -20, C: Star },
    { x: 52, y: -34, r: 18, C: Sparkle },
    { x: -58, y: 18, r: 8, C: Sparkle },
    { x: 60, y: 22, r: -12, C: Heart },
    { x: 4, y: -48, r: 0, C: Sparkle },
  ];
  return (
    <span className={cn("pointer-events-none absolute top-1/2 left-1/2 z-10", className)} aria-hidden>
      {marks.map(({ x, y, r, C }, i) => (
        <m.span
          key={i}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ color: colors?.[i % colors.length] }}
          initial={reduced ? { x, y, opacity: 1, scale: 1 } : { x: 0, y: 0, opacity: 0, scale: 0.2, rotate: r - 40 }}
          animate={reduced ? { opacity: [1, 1, 0] } : { x, y, opacity: [0, 1, 1, 0], scale: [0.2, 1.15, 1, 0.9], rotate: r }}
          transition={{ duration: reduced ? 1.6 : 1.4, ease: [0.16, 1, 0.3, 1], times: reduced ? undefined : [0, 0.25, 0.75, 1], delay: i * 0.04 }}
        >
          <C size={20} strokeWidth={2.2} className={colors ? "" : "text-pen"} />
        </m.span>
      ))}
    </span>
  );
}

/**
 * Paper scraps in course inks tumbling out once, for finishing a focus round.
 * Twenty small pieces, CSS only, removed by the parent after it plays.
 */
export function Confetti({ count = 22 }: { count?: number }) {
  const inks = ["var(--you)", "var(--course, var(--c4))", "var(--c6)", "var(--c2)", "var(--c1)"];
  return (
    <span className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const dist = 70 + ((i * 37) % 60);
        return (
          <span
            key={i}
            className="confetti absolute top-1/3 left-1/2 block h-2.5 w-1.5 rounded-[1px]"
            style={
              {
                background: inks[i % inks.length],
                "--dx": `${Math.cos(angle) * dist}px`,
                "--dy": `${Math.sin(angle) * dist * 0.6 - 30}px`,
                "--rot": `${(i * 47) % 360}deg`,
                animationDelay: `${(i % 5) * 30}ms`,
              } as CSSProperties
            }
          />
        );
      })}
    </span>
  );
}
