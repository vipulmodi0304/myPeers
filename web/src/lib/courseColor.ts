import type { CSSProperties } from "react";

/**
 * Every course gets its own colour, the way students colour-code a planner.
 * The same course is the same colour everywhere: its label, the avatars of
 * people studying it, and rooms for it. Codes are hashed into one of the 8
 * tokens defined in styles.css, so the colour never changes between visits.
 */
export const COURSE_HUES = 8;

// Big first- and second-year courses get hand-picked hues so the ones that
// usually appear together never share a colour. Everything else is hashed.
const PICKED: Record<string, number> = {
  COMP250: 2, COMP251: 4, COMP202: 6, COMP206: 3, COMP273: 7, COMP302: 5,
  MATH133: 6, MATH140: 1, MATH141: 7, MATH240: 0,
  ECON208: 1, PSYC100: 7, BIOL112: 2, CHEM110: 3, PHYS131: 5,
};

export function courseHue(code: string | null | undefined): number {
  if (!code) return -1;
  const key = code.toUpperCase().replace(/\s+/g, "");
  if (key in PICKED) return PICKED[key]!;
  // FNV-1a: cheap, and spreads similar codes (COMP251, COMP252) apart.
  let h = 0x811c9dc5;
  for (const ch of key) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % COURSE_HUES;
}

/**
 * Inline style that sets the current course's colours for an element and its
 * children: --course (sticker fill), --course-ink (text) and --course-soft (tint).
 */
export function courseVars(code: string | null | undefined): CSSProperties {
  const i = courseHue(code);
  if (i < 0) return {};
  return { "--course": `var(--c${i})`, "--course-ink": `var(--c${i}-ink)`, "--course-soft": `var(--c${i}-soft)` } as CSSProperties;
}
