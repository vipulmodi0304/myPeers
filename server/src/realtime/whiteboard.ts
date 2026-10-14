import { z } from "zod";

/**
 * Whiteboard strokes use coordinates between 0 and 1 (a fraction of the
 * board's width and height) instead of pixels. The old version sent raw
 * pixels, so a stroke drawn on a laptop landed in the wrong place on a phone.
 */
export const MAX_STROKES = 1500;
export const MAX_POINTS = 600;

const coord = z.number().min(0).max(1);

export const strokeSchema = z.object({
  id: z.string().min(6).max(40),
  tool: z.enum(["pen", "eraser"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  size: z.number().min(1).max(40),
  points: z.array(z.tuple([coord, coord])).min(1).max(MAX_POINTS),
});

export type Stroke = z.infer<typeof strokeSchema> & { userId: string };

/** Live preview of a stroke that is still being drawn (not stored). */
export const draftSchema = strokeSchema.extend({ points: z.array(z.tuple([coord, coord])).min(1).max(60) });

/** Append a stroke, dropping the oldest when the board is full so the row stays small. */
export function addStroke(strokes: Stroke[], stroke: Stroke): Stroke[] {
  const next = [...strokes, stroke];
  return next.length > MAX_STROKES ? next.slice(next.length - MAX_STROKES) : next;
}

/** Remove the most recent stroke drawn by this user. */
export function undoStroke(strokes: Stroke[], userId: string): { strokes: Stroke[]; removedId: string | null } {
  for (let i = strokes.length - 1; i >= 0; i--) {
    if (strokes[i]!.userId === userId) {
      return { strokes: [...strokes.slice(0, i), ...strokes.slice(i + 1)], removedId: strokes[i]!.id };
    }
  }
  return { strokes, removedId: null };
}
