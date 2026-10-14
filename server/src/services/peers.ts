import type { AppContext, User } from "../context.js";

/**
 * "Worlds" keep demo accounts and real accounts apart. A recruiter trying the
 * demo only ever sees demo classmates, and real students never see demo data.
 */
export type World = "real" | "demo";
export const worldOf = (user: Pick<User, "is_demo">): World => (user.is_demo ? "demo" : "real");
export const sameWorld = (a: Pick<User, "is_demo">, b: Pick<User, "is_demo">) => a.is_demo === b.is_demo;

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
    `${PEER_SELECT} where u.is_demo = $1 and c.user_id <> $2 order by c.started_at desc limit 500`,
    [viewer.is_demo, viewer.id],
  );
  return rows.filter((r) => ctx.realtime.isLive(r.user_id)).map(toPeerDto);
}
