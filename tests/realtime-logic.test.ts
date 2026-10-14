import { describe, expect, it } from "vitest";
import { GRACE_MS, Presence } from "../server/src/realtime/presence.js";
import { applyTimerAction, initialTimer, normalizeTimer } from "../server/src/realtime/timer.js";
import { addStroke, MAX_STROKES, strokeSchema, undoStroke, type Stroke } from "../server/src/realtime/whiteboard.js";
import { normalizeCourse } from "../server/src/lib/courses.js";

describe("shared Pomodoro timer", () => {
  const t0 = 1_000_000;

  it("stores an end time instead of ticking", () => {
    const running = applyTimerAction(initialTimer(), { type: "start" }, t0);
    expect(running.endsAt).toBe(t0 + 25 * 60_000);
  });

  it("pauses and resumes with the right time left", () => {
    let s = applyTimerAction(initialTimer(), { type: "start" }, t0);
    s = applyTimerAction(s, { type: "pause" }, t0 + 60_000);
    expect(s).toMatchObject({ endsAt: null, remainingSec: 24 * 60 });
    s = applyTimerAction(s, { type: "start" }, t0 + 120_000);
    expect(s.endsAt).toBe(t0 + 120_000 + 24 * 60_000);
  });

  it("shows a finished timer at zero, and starting again begins a new round", () => {
    const s = applyTimerAction(initialTimer(), { type: "start" }, t0);
    const later = t0 + 26 * 60_000;
    expect(normalizeTimer(s, later)).toMatchObject({ endsAt: null, remainingSec: 0 });
    expect(applyTimerAction(s, { type: "start" }, later).endsAt).toBe(later + 25 * 60_000);
  });

  it("switches modes with clamped custom lengths", () => {
    expect(applyTimerAction(initialTimer(), { type: "mode", mode: "break" }, t0).durationSec).toBe(300);
    expect(applyTimerAction(initialTimer(), { type: "mode", mode: "focus", minutes: 500 }, t0).durationSec).toBe(90 * 60);
  });
});

describe("presence", () => {
  it("counts multiple tabs and keeps you online briefly after closing the last one", () => {
    let now = 0;
    const p = new Presence(() => now);
    expect(p.connect("u")).toBe(true);
    expect(p.connect("u")).toBe(false); // second tab
    expect(p.disconnect("u")).toBe(false);
    expect(p.disconnect("u")).toBe(true);
    expect(p.isLive("u")).toBe(true); // grace period
    now = GRACE_MS + 1;
    expect(p.isLive("u")).toBe(false);
  });

  it("treats demo bots as always online", () => {
    const p = new Presence();
    p.setAlwaysOnline(["bot"]);
    expect(p.isLive("bot")).toBe(true);
  });
});

describe("whiteboard", () => {
  const stroke = (id: string, userId: string): Stroke => ({ id: `stroke-${id}`, userId, tool: "pen", color: "#111111", size: 3, points: [[0.1, 0.2]] });

  it("rejects pixel coordinates (they must be 0..1 fractions)", () => {
    expect(strokeSchema.safeParse({ ...stroke("a", "u"), points: [[340, 120]] }).success).toBe(false);
  });

  it("caps the number of stored strokes", () => {
    let board: Stroke[] = [];
    for (let i = 0; i < MAX_STROKES + 5; i++) board = addStroke(board, stroke(String(i), "u"));
    expect(board).toHaveLength(MAX_STROKES);
    expect(board[0]!.id).toBe("stroke-5");
  });

  it("undo only removes your own latest stroke", () => {
    const board = [stroke("1", "me"), stroke("2", "you"), stroke("3", "me"), stroke("4", "you")];
    const { strokes, removedId } = undoStroke(board, "me");
    expect(removedId).toBe("stroke-3");
    expect(strokes.map((s) => s.id)).toEqual(["stroke-1", "stroke-2", "stroke-4"]);
  });
});

describe("course codes", () => {
  it.each([
    ["comp251", "COMP 251"],
    ["  Comp 251 ", "COMP 251"],
    ["math133", "MATH 133"],
    ["ACCT 645D1", "ACCT 645D1"],
  ])("%s -> %s", (input, out) => expect(normalizeCourse(input)).toBe(out));
});
