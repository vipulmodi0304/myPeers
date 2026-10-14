/**
 * Shared Pomodoro timer for a study room.
 *
 * The old version had one browser broadcast the remaining seconds every
 * second. If that tab slept or closed, everyone's timer froze or drifted.
 *
 * Here the server is the source of truth and stores only *when the timer
 * ends* (endsAt). Every client counts down locally from that timestamp, so
 * there is no per-second network traffic and every screen shows the same
 * time. These are pure functions so they're easy to unit test.
 */
export type TimerMode = "focus" | "break";

export type TimerState = {
  mode: TimerMode;
  durationSec: number;
  /** Epoch milliseconds when the running timer hits zero, or null when paused. */
  endsAt: number | null;
  /** Seconds left while paused. */
  remainingSec: number;
};

export type TimerAction =
  | { type: "start" }
  | { type: "pause" }
  | { type: "reset" }
  | { type: "mode"; mode: TimerMode; minutes?: number };

export const DEFAULT_MINUTES: Record<TimerMode, number> = { focus: 25, break: 5 };

export const initialTimer = (): TimerState => ({
  mode: "focus",
  durationSec: DEFAULT_MINUTES.focus * 60,
  endsAt: null,
  remainingSec: DEFAULT_MINUTES.focus * 60,
});

/** A running timer whose end time has passed is shown as finished (paused at 0). */
export function normalizeTimer(state: TimerState, now: number): TimerState {
  if (state.endsAt !== null && state.endsAt <= now) {
    return { ...state, endsAt: null, remainingSec: 0 };
  }
  return state;
}

export function applyTimerAction(prev: TimerState, action: TimerAction, now: number): TimerState {
  const state = normalizeTimer(prev, now);
  switch (action.type) {
    case "start": {
      if (state.endsAt !== null) return state; // already running
      // Starting a finished timer starts a fresh round of the same mode.
      const seconds = state.remainingSec > 0 ? state.remainingSec : state.durationSec;
      return { ...state, endsAt: now + seconds * 1000, remainingSec: seconds };
    }
    case "pause":
      if (state.endsAt === null) return state;
      return { ...state, endsAt: null, remainingSec: Math.max(0, Math.ceil((state.endsAt - now) / 1000)) };
    case "reset":
      return { ...state, endsAt: null, remainingSec: state.durationSec };
    case "mode": {
      const minutes = Math.min(90, Math.max(1, Math.round(action.minutes ?? DEFAULT_MINUTES[action.mode])));
      return { mode: action.mode, durationSec: minutes * 60, endsAt: null, remainingSec: minutes * 60 };
    }
  }
}
