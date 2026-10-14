import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The McGill course catalogue (~9,800 codes) lives on the server and is
 * searched here, instead of shipping the whole list to every browser like
 * the old version did (it was most of a 700 KB bundle).
 */
let cache: string[] | null = null;
let lookup: Set<string> | null = null;

export function allCourses(): string[] {
  if (!cache) {
    const file = path.resolve("server/data/courses.json");
    cache = JSON.parse(readFileSync(file, "utf8")) as string[];
    lookup = new Set(cache);
  }
  return cache;
}

/** "comp251", "COMP 251" and "comp 2" all match "COMP 251". Prefix matches rank first. */
export function searchCourses(query: string, limit = 12): string[] {
  const q = normalizeCourse(query);
  if (!q) return [];
  const compact = q.replace(" ", "");
  const starts: string[] = [];
  const contains: string[] = [];
  for (const course of allCourses()) {
    const c = course.replace(" ", "");
    if (c.startsWith(compact)) starts.push(course);
    else if (c.includes(compact)) contains.push(course);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Uppercase and put a single space between department and number: "comp251" -> "COMP 251". */
export function normalizeCourse(input: string): string {
  const s = input.toUpperCase().replace(/\s+/g, "").trim();
  const m = s.match(/^([A-Z]{3,4}\d?)(\d{3}[A-Z0-9]*)$/);
  return m ? `${m[1]} ${m[2]}` : s;
}

export function isKnownCourse(code: string): boolean {
  allCourses();
  return lookup!.has(code);
}

export function departmentOf(code: string): string {
  return code.split(" ")[0] ?? code;
}
