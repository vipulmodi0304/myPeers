import { z } from "zod";
import type { AppContext, User } from "../context.js";
import type { Db } from "../db/pool.js";
import { notFound } from "../lib/errors.js";

/**
 * "Worlds" keep demo accounts and real accounts apart. A recruiter trying the
 * demo only ever sees demo classmates, and real students never see demo data.
 */
export type World = "real" | "demo";
export const worldOf = (user: Pick<User, "is_demo">): World => (user.is_demo ? "demo" : "real");
export const sameWorld = (a: Pick<User, "is_demo">, b: Pick<User, "is_demo">) => a.is_demo === b.is_demo;

/** Another user the viewer is allowed to know about (exists, same world, not themselves). */
export async function findOther(db: Db, viewer: User, id: string): Promise<User> {
  const parsed = z.string().uuid().safeParse(id);
  const other = parsed.success
    ? await db.one<User>("select id, email, name, is_demo, email_verified_at from users where id = $1", [parsed.data])
    : null;
  if (!other || other.id === viewer.id || !sameWorld(viewer, other)) throw notFound("That person isn't on myPeers.");
  return other;
}

/** Everyone this user has blocked or been blocked by. */
export async function blockedIds(db: Db, userId: string): Promise<string[]> {
  const rows = await db.query<{ id: string }>(
    `select blocked_id as id from blocks where blocker_id = $1
     union select blocker_id from blocks where blocked_id = $1`,
    [userId],
  );
  return rows.map((r) => r.id);
}

/** SQL condition: a block exists between the two users, in either direction. */
export const blockBetween = (a: string, b: string) =>
  `exists (select 1 from blocks bl where (bl.blocker_id = ${a} and bl.blocked_id = ${b}) or (bl.blocker_id = ${b} and bl.blocked_id = ${a}))`;

export type PeerDto = {
  userId: string;
  name: string;
  courseCode: string;
  topic: string;
  location: string;
  status: "studying" | "break";
  startedAt: string;
};

type PeerRow = {
  user_id: string;
  name: string;
  is_demo: boolean;
  course_code: string;
  topic: string;
  location: string;
  status: "studying" | "break";
  started_at: Date;
};

const PEER_SELECT = `
  select c.user_id, u.name, u.is_demo, c.course_code, c.topic, c.location, c.status, c.started_at
    from check_ins c join users u on u.id = c.user_id`;

export const toPeerDto = (r: PeerRow): PeerDto => ({
  userId: r.user_id,
  name: r.name,
  courseCode: r.course_code,
  topic: r.topic,
  location: r.location,
  status: r.status,
  startedAt: r.started_at.toISOString(),
});

/** A user's check-in plus which world they belong to, or null if not checked in. */
export async function getPeer(ctx: AppContext, userId: string): Promise<(PeerDto & { world: World }) | null> {
  const row = await ctx.db.one<PeerRow>(`${PEER_SELECT} where c.user_id = $1`, [userId]);
  return row ? { ...toPeerDto(row), world: worldOf(row) } : null;
}

/** Everyone in the viewer's world who is checked in and currently connected. */
export async function listLivePeers(ctx: AppContext, viewer: User): Promise<PeerDto[]> {
  const rows = await ctx.db.query<PeerRow>(
    `${PEER_SELECT} where u.is_demo = $1 and c.user_id <> $2 and not ${blockBetween("$2", "c.user_id")}
      order by c.started_at desc limit 500`,
    [viewer.is_demo, viewer.id],
  );
  return rows.filter((r) => ctx.realtime.isLive(r.user_id)).map(toPeerDto);
}
