import { Router } from "express";
import { z } from "zod";
import type { AppContext, User } from "../context.js";
import { newRoomCode } from "../lib/crypto.js";
import { normalizeCourse } from "../lib/courses.js";
import { forbidden, notFound } from "../lib/errors.js";
import { normalizeTimer, type TimerState } from "../realtime/timer.js";

type RoomRow = {
  id: string;
  code: string;
  name: string;
  course_code: string | null;
  created_by: string;
  is_demo: boolean;
  created_at: Date;
  timer: TimerState;
};

const codeParam = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, "Room codes are 6 letters and numbers.");

export function roomRoutes(ctx: AppContext) {
  const router = Router();
  const { db } = ctx;

  async function findRoom(code: string, viewer: User) {
    const room = await db.one<RoomRow>(
      "select id, code, name, course_code, created_by, is_demo, created_at, timer from rooms where code = $1",
      [codeParam.parse(code)],
    );
    // Demo and real rooms are invisible to each other.
    if (!room || room.is_demo !== viewer.is_demo) throw notFound("No room with that code.");
    return room;
  }

  async function isMember(roomId: string, userId: string) {
    return Boolean(await db.one("select 1 from room_members where room_id = $1 and user_id = $2", [roomId, userId]));
  }

  async function members(roomId: string) {
    const rows = await db.query<{ id: string; name: string }>(
      `select u.id, u.name from room_members m join users u on u.id = m.user_id
        where m.room_id = $1 order by m.joined_at`,
      [roomId],
    );
    return rows.map((r) => ({ ...r, live: ctx.realtime.isLive(r.id) }));
  }

  const summary = (r: RoomRow, memberCount: number) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    courseCode: r.course_code,
    memberCount,
    createdBy: r.created_by,
    createdAt: r.created_at.toISOString(),
  });

  // Rooms I belong to, most recently active first.
  router.get("/", async (req, res) => {
    const rows = await db.query<RoomRow & { member_count: number; last_activity: Date | null }>(
      `select r.id, r.code, r.name, r.course_code, r.created_by, r.is_demo, r.created_at, r.timer,
              mc.n as member_count, la.at as last_activity
         from rooms r
         join room_members m on m.room_id = r.id and m.user_id = $1
         cross join lateral (select count(*)::int as n from room_members x where x.room_id = r.id) mc
         cross join lateral (select max(created_at) as at from room_messages rm where rm.room_id = r.id) la
        order by coalesce(la.at, r.created_at) desc`,
      [req.user!.id],
    );
    res.json({
      rooms: rows.map((r) => ({ ...summary(r, r.member_count), lastActivity: r.last_activity?.toISOString() ?? null })),
    });
  });

  router.post("/", async (req, res) => {
    const input = z
      .object({
        name: z.string().trim().min(1, "Give your room a name.").max(50, "Keep the name under 50 characters."),
        courseCode: z
          .string()
          .trim()
          .transform((c) => (c ? normalizeCourse(c) : null))
          .nullable()
          .optional(),
      })
      .parse(req.body);

    // Codes are random; on the rare collision, just try another.
    for (let attempt = 0; attempt < 5; attempt++) {
      const room = await db.one<RoomRow>(
        `insert into rooms (code, name, course_code, created_by, is_demo) values ($1, $2, $3, $4, $5)
         on conflict (code) do nothing
         returning id, code, name, course_code, created_by, is_demo, created_at, timer`,
        [newRoomCode(), input.name, input.courseCode ?? null, req.user!.id, req.user!.is_demo],
      );
      if (!room) continue;
      await db.query("insert into room_members (room_id, user_id) values ($1, $2)", [room.id, req.user!.id]);
      return void res.status(201).json({ room: summary(room, 1) });
    }
    throw new Error("Could not generate a unique room code");
  });

  // Members get the full room; non-members get a preview for the "join?" screen.
  router.get("/:code", async (req, res) => {
    const room = await findRoom(req.params.code, req.user!);
    const list = await members(room.id);
    const member = list.some((m) => m.id === req.user!.id);
    res.json({
      room: summary(room, list.length),
      isMember: member,
      members: member ? list : [],
      timer: member ? normalizeTimer(room.timer, Date.now()) : null,
    });
  });

  router.post("/:code/join", async (req, res) => {
    const room = await findRoom(req.params.code, req.user!);
    await db.query("insert into room_members (room_id, user_id) values ($1, $2) on conflict do nothing", [
      room.id,
      req.user!.id,
    ]);
    const list = await members(room.id);
    ctx.realtime.toRoom(room.id, "room:members", { roomId: room.id, members: list });
    res.json({ room: summary(room, list.length) });
  });

  router.delete("/:code/membership", async (req, res) => {
    const room = await findRoom(req.params.code, req.user!);
    await db.query("delete from room_members where room_id = $1 and user_id = $2", [room.id, req.user!.id]);
    const list = await members(room.id);
    // The last person out turns off the lights.
    if (list.length === 0) await db.query("delete from rooms where id = $1", [room.id]);
    else ctx.realtime.toRoom(room.id, "room:members", { roomId: room.id, members: list });
    res.json({ ok: true });
  });

  router.get("/:code/messages", async (req, res) => {
    const room = await findRoom(req.params.code, req.user!);
    if (!(await isMember(room.id, req.user!.id))) throw forbidden("Join the room to see its chat.");
    const q = z.object({ before: z.string().datetime().optional() }).parse(req.query);
    const rows = await db.query<{ id: string; sender_id: string; sender_name: string; body: string; created_at: Date }>(
      `select m.id, m.sender_id, u.name as sender_name, m.body, m.created_at
         from room_messages m join users u on u.id = m.sender_id
        where m.room_id = $1 and ($2::timestamptz is null or m.created_at < $2)
        order by m.created_at desc limit 51`,
      [room.id, q.before ?? null],
    );
    res.json({
      messages: rows
        .slice(0, 50)
        .reverse()
        .map((r) => ({ id: r.id, senderId: r.sender_id, senderName: r.sender_name, body: r.body, createdAt: r.created_at.toISOString() })),
      hasMore: rows.length > 50,
    });
  });

  router.post("/:code/messages", async (req, res) => {
    const room = await findRoom(req.params.code, req.user!);
    if (!(await isMember(room.id, req.user!.id))) throw forbidden("Join the room to chat.");
    const input = z.object({ body: z.string().trim().min(1, "Write something first.").max(2000) }).parse(req.body);
    const row = await db.one<{ id: string; created_at: Date }>(
      "insert into room_messages (room_id, sender_id, body) values ($1, $2, $3) returning id, created_at",
      [room.id, req.user!.id, input.body],
    );
    const message = {
      id: row!.id,
      senderId: req.user!.id,
      senderName: req.user!.name,
      body: input.body,
      createdAt: row!.created_at.toISOString(),
    };
    ctx.realtime.toRoom(room.id, "room:message", { roomId: room.id, message });
    res.status(201).json({ message });
  });

  return router;
}
