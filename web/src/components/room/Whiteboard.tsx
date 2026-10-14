import { Download, Eraser, Pen, Trash2, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/format";
import { useSocketEvent } from "@/lib/socket";
import type { Stroke } from "@/lib/types";

const COLORS = ["#17203A", "#D61F2C", "#1F6FD6", "#1F7A4D", "#B26A00"];
const SIZES = [2, 4, 8];
// Line widths are defined for a 1000px-wide board and scaled to the real size,
// so a stroke looks the same on a phone and on a laptop.
const BASE_WIDTH = 1000;

type Props = {
  roomId: string;
  initialStrokes: Stroke[];
  emit: (event: string, payload?: Record<string, unknown>) => void;
  userId: string;
};

/**
 * Shared whiteboard. Points are stored as fractions (0..1) of the board's
 * width and height. While you draw, small "draft" segments stream to everyone
 * for a live preview; on pointer-up the whole stroke is sent once and saved.
 */
export function Whiteboard({ roomId, initialStrokes, emit, userId }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>(initialStrokes);
  const drafts = useRef(new Map<string, Stroke>());
  const current = useRef<Stroke | null>(null);
  const unsent = useRef<[number, number][]>([]);
  const frame = useRef(0);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState(COLORS[0]!);
  const [size, setSize] = useState(4);
  const [isEmpty, setIsEmpty] = useState(initialStrokes.length === 0);
  const area = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    const el = area.current!;
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry!.contentRect;
      const width = Math.floor(Math.max(0, Math.min(w, h * 1.6)));
      setBoardSize({ width, height: Math.floor(width / 1.6) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Redraw everything on the next animation frame (cheap even with ~1500 strokes). */
  const redraw = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = canvas.current;
      const ctx = el?.getContext("2d");
      if (!el || !ctx) return;
      const { width, height } = el;
      ctx.clearRect(0, 0, width, height);
      const all = [...strokes.current, ...drafts.current.values(), ...(current.current ? [current.current] : [])];
      for (const s of all) paint(ctx, s, width, height);
      setIsEmpty(strokes.current.length === 0 && !current.current && drafts.current.size === 0);
    });
  };

  // Keep the canvas's pixel size in sync with its displayed size (and the screen's pixel density).
  useEffect(() => {
    const el = canvas.current!;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      el.width = Math.round(el.clientWidth * dpr);
      el.height = Math.round(el.clientHeight * dpr);
      redraw();
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    strokes.current = initialStrokes;
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStrokes]);

  useSocketEvent<{ roomId: string; stroke: Stroke }>("wb:draft", ({ roomId: r, stroke }) => {
    if (r !== roomId) return;
    const prev = drafts.current.get(stroke.id);
    drafts.current.set(stroke.id, prev ? { ...prev, points: [...prev.points, ...stroke.points] } : stroke);
    redraw();
  });
  useSocketEvent<{ roomId: string; stroke: Stroke }>("wb:stroke", ({ roomId: r, stroke }) => {
    if (r !== roomId) return;
    drafts.current.delete(stroke.id);
    strokes.current = [...strokes.current, stroke];
    redraw();
  });
  useSocketEvent<{ roomId: string; strokeId: string }>("wb:remove", ({ roomId: r, strokeId }) => {
    if (r !== roomId) return;
    strokes.current = strokes.current.filter((s) => s.id !== strokeId);
    redraw();
  });
  useSocketEvent<{ roomId: string }>("wb:clear", ({ roomId: r }) => {
    if (r !== roomId) return;
    strokes.current = [];
    drafts.current.clear();
    redraw();
  });

  // Send live preview segments at most every 40ms.
  useEffect(() => {
    const t = setInterval(() => {
      const s = current.current;
      if (!s || unsent.current.length === 0) return;
      const pts = unsent.current.splice(0, 60);
      emit("wb:draft", { stroke: { id: s.id, tool: s.tool, color: s.color, size: s.size, points: pts } });
    }, 40);
    return () => clearInterval(t);
  }, [emit]);

  const point = (e: React.PointerEvent): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    return [round(clamp((e.clientX - r.left) / r.width)), round(clamp((e.clientY - r.top) / r.height))];
  };

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    canvas.current!.setPointerCapture(e.pointerId);
    const p = point(e);
    current.current = { id: `${userId.slice(0, 8)}-${Date.now().toString(36)}`, tool, color, size, points: [p], userId };
    unsent.current = [p];
    redraw();
  };
  const onMove = (e: React.PointerEvent) => {
    const s = current.current;
    if (!s) return;
    const p = point(e);
    const last = s.points[s.points.length - 1]!;
    if (Math.abs(last[0] - p[0]) + Math.abs(last[1] - p[1]) < 0.0015) return; // skip jitter
    s.points.push(p);
    unsent.current.push(p);
    redraw();
  };
  const onUp = () => {
    const s = current.current;
    if (!s) return;
    current.current = null;
    unsent.current = [];
    const finished = { ...s, points: simplify(s.points, 600) };
    strokes.current = [...strokes.current, finished];
    emit("wb:stroke", { stroke: { id: finished.id, tool: finished.tool, color: finished.color, size: finished.size, points: finished.points } });
    redraw();
  };

  const undo = () => {
    // Optimistic: remove my latest stroke locally; the server confirms for everyone.
    const mine = [...strokes.current].reverse().find((s) => s.userId === userId);
    if (!mine) return;
    strokes.current = strokes.current.filter((s) => s.id !== mine.id);
    emit("wb:undo");
    redraw();
  };

  const exportPng = () => {
    const src = canvas.current!;
    const out = document.createElement("canvas");
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, 0, 0);
    const a = document.createElement("a");
    a.href = out.toDataURL("image/png");
    a.download = `mypeers-board-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.png`;
    a.click();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-line px-2 py-1.5" role="toolbar" aria-label="Whiteboard tools">
        <ToolButton active={tool === "pen"} onClick={() => setTool("pen")} label="Pen">
          <Pen className="size-4" />
        </ToolButton>
        <ToolButton active={tool === "eraser"} onClick={() => setTool("eraser")} label="Eraser">
          <Eraser className="size-4" />
        </ToolButton>
        <span className="mx-1 h-5 w-px shrink-0 bg-line" />
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => {
              setColor(c);
              setTool("pen");
            }}
            aria-label={`Colour ${c}`}
            aria-pressed={color === c && tool === "pen"}
            className={cn("grid size-7 shrink-0 place-items-center rounded-full", color === c && tool === "pen" && "ring-2 ring-ink ring-offset-2 ring-offset-surface")}
          >
            <span className="size-4.5 rounded-full dark:ring-1 dark:ring-white/30" style={{ background: c }} />
          </button>
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-line" />
        {SIZES.map((s) => (
          <ToolButton key={s} active={size === s} onClick={() => setSize(s)} label={`Size ${s}`}>
            <span className="rounded-full bg-current" style={{ width: s + 3, height: s + 3 }} />
          </ToolButton>
        ))}
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <Button variant="ghost" size="icon" onClick={undo} aria-label="Undo my last stroke" title="Undo">
            <Undo2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={exportPng} aria-label="Download as image" title="Download">
            <Download className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (confirm("Clear the whole board for everyone?")) emit("wb:clear");
            }}
            aria-label="Clear board for everyone"
            title="Clear board"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      {/* Fixed 16:10 board, as large as fits, so strokes line up on every screen. */}
      <div ref={area} className="grid min-h-0 flex-1 place-items-center p-2 sm:p-3">
        <div className="relative" style={boardSize}>
          <canvas
            ref={canvas}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className={cn(
              "absolute inset-0 size-full touch-none rounded-xl border border-line bg-white",
              "bg-[radial-gradient(circle,#d6dbe4_1px,transparent_1px)] bg-[size:22px_22px]",
              tool === "eraser" ? "cursor-cell" : "cursor-crosshair",
            )}
            aria-label="Shared whiteboard"
            role="img"
          />
          {isEmpty ? (
            <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-[#8a93a6]">
              Draw here. Everyone in the room sees it live.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ToolButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn("grid size-8 shrink-0 place-items-center rounded-md text-slate hover:text-ink", active && "bg-ink text-paper hover:text-paper")}
    >
      {children}
    </button>
  );
}

const round = (v: number) => Math.round(v * 10000) / 10000;

function paint(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number) {
  const pts = s.points;
  if (!pts.length) return;
  ctx.save();
  ctx.globalCompositeOperation = s.tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = (s.tool === "eraser" ? s.size * 4 : s.size) * (w / BASE_WIDTH) * 1.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0]![0] * w, pts[0]![1] * h, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Smooth the line by curving through the midpoints between samples.
    ctx.beginPath();
    ctx.moveTo(pts[0]![0] * w, pts[0]![1] * h);
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, y] = pts[i]!;
      const [nx, ny] = pts[i + 1]!;
      ctx.quadraticCurveTo(x * w, y * h, ((x + nx) / 2) * w, ((y + ny) / 2) * h);
    }
    const last = pts[pts.length - 1]!;
    ctx.lineTo(last[0] * w, last[1] * h);
    ctx.stroke();
  }
  ctx.restore();
}

/** Keep long strokes under the server's point limit by dropping evenly spaced samples. */
function simplify(points: [number, number][], max: number): [number, number][] {
  if (points.length <= max) return points;
  const step = points.length / max;
  const out: [number, number][] = [];
  for (let i = 0; i < max - 1; i++) out.push(points[Math.floor(i * step)]!);
  out.push(points[points.length - 1]!);
  return out;
}
