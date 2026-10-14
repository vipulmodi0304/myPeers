import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import { userFromCookie } from "../auth/sessions.js";
import type { AppContext, Realtime, User } from "../context.js";
import { logger } from "../logger.js";
import { getPeer, worldOf } from "../services/peers.js";
import { GRACE_MS, Presence } from "./presence.js";
import { applyTimerAction, initialTimer, normalizeTimer, type TimerState } from "./timer.js";
import { addStroke, draftSchema, strokeSchema, undoStroke, type Stroke } from "./whiteboard.js";

/**
 * The realtime layer, built on Socket.IO.
 *
 * Channels ("rooms" in Socket.IO terms, not to be confused with study rooms):
 *   user:<id>      every open tab of one user (DMs, read receipts, typing)
 *   world:<w>      everyone in the real or demo world (live peer list)
 *   room:<id>      everyone currently inside a study room (chat, board, timer)
 *
 * Writes that need to be durable (messages, check-ins) go through the REST
 * API and are then pushed here. Fast, ephemeral things (drawing, typing,
 * reactions, timer buttons) go straight over the socket.
 */

type RoomState = {
  strokes: Stroke[];
  timer: TimerState;
  here: Map<string, number>; // userId -> open sockets in this room
  saveTimer: NodeJS.Timeout | null;
};

const REACTIONS = ["👏", "🔥", "💡", "✅", "😂", "☕"] as const;

/** Small per-socket rate limiter: at most `limit` events per second for a key. */
function limiter() {
  const windows = new Map<string, { start: number; count: number }>();
  return (key: string, limit: number) => {
    const now = Date.now();
    const w = windows.get(key);
    if (!w || now - w.start > 1000) {
      windows.set(key, { start: now, count: 1 });
      return true;
    }
    w.count++;
    return w.count <= limit;
  };
}

export function attachRealtime(httpServer: HttpServer, ctx: AppContext, botIds: string[] = []) {
  const presence = new Presence();
  presence.setAlwaysOnline(botIds);
  const rooms = new Map<string, RoomState>();
  const { db, config } = ctx;

  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: config.APP_URL, credentials: true },
    // Only accept sockets opened by our own site.
    allowRequest: (req, cb) => {
      const origin = req.headers.origin;
      cb(null, !origin || origin === new URL(config.APP_URL).origin);
    },
  });

  const realtime: Realtime = {
    toUser: (userId, event, payload) => void io.to(`user:${userId}`).emit(event, payload),
    toRoom: (roomId, event, payload) => void io.to(`room:${roomId}`).emit(event, payload),
    isLive: (userId) => presence.isLive(userId),
    async checkInChanged(userId) {
      const peer = await getPeer(ctx, userId);
      if (peer && presence.isLive(userId)) {
        const { world, ...dto } = peer;
        io.to(`world:${world}`).emit("peer:upsert", dto);
      } else {
        const user = await db.one<{ is_demo: boolean }>("select is_demo from users where id = $1", [userId]);
        io.to(`world:${user ? worldOf(user) : "real"}`).emit("peer:remove", { userId });
        // Account deleted: tell both worlds, it costs nothing.
        if (!user) io.to("world:demo").emit("peer:remove", { userId });
      }
    },
  };

  // --- Study room state (loaded on demand, saved shortly after changes) ---

  async function loadRoom(roomId: string): Promise<RoomState> {
    let state = rooms.get(roomId);
    if (state) return state;
    const row = await db.one<{ whiteboard: Stroke[]; timer: TimerState }>(
      "select whiteboard, timer from rooms where id = $1",
      [roomId],
    );
    // Another socket may have loaded it while we awaited.
    state = rooms.get(roomId) ?? {
      strokes: row?.whiteboard ?? [],
      timer: row?.timer ?? initialTimer(),
      here: new Map(),
      saveTimer: null,
    };
    rooms.set(roomId, state);
    return state;
  }

  function scheduleSave(roomId: string, state: RoomState) {
    if (state.saveTimer) return;
    state.saveTimer = setTimeout(() => void saveRoom(roomId, state), 1500);
  }

  async function saveRoom(roomId: string, state: RoomState) {
    if (state.saveTimer) clearTimeout(state.saveTimer);
    state.saveTimer = null;
    try {
      await db.query("update rooms set whiteboard = $2, timer = $3 where id = $1", [
        roomId,
        JSON.stringify(state.strokes),
        JSON.stringify(state.timer),
      ]);
    } catch (err) {
      logger.error({ err, roomId }, "Failed to save room state");
    }
    // Nobody inside and nothing pending: free the memory.
    if (state.here.size === 0 && !state.saveTimer) rooms.delete(roomId);
  }

  const hereList = (state: RoomState) => [...state.here.keys()];

  function leaveRoom(socket: Socket, roomId: string) {
    const user = socket.data.user as User;
    const joined = socket.data.rooms as Set<string>;
    if (!joined.delete(roomId)) return;
    socket.leave(`room:${roomId}`);
    const state = rooms.get(roomId);
    if (!state) return;
    const n = (state.here.get(user.id) ?? 1) - 1;
    if (n > 0) state.here.set(user.id, n);
    else state.here.delete(user.id);
    io.to(`room:${roomId}`).emit("room:here", { roomId, userIds: hereList(state) });
    if (state.here.size === 0) void saveRoom(roomId, state);
  }

  // --- Connection lifecycle ---

  io.use(async (socket, next) => {
    try {
      const user = await userFromCookie(ctx, socket.handshake.headers.cookie);
      if (!user) return next(new Error("unauthorized"));
      if (config.REQUIRE_EMAIL_VERIFICATION && !user.is_demo && !user.email_verified_at) {
        return next(new Error("unverified"));
      }
      socket.data.user = user;
      socket.data.rooms = new Set<string>();
      next();
    } catch (err) {
      logger.error({ err }, "Socket auth failed");
      next(new Error("server_error"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as User;
    const joined = socket.data.rooms as Set<string>;
    const allow = limiter();
    void socket.join([`user:${user.id}`, `world:${worldOf(user)}`]);

    if (presence.connect(user.id)) void realtime.checkInChanged(user.id).catch(() => {});

    /** Wraps a handler with input validation, rate limiting and error reporting. */
    function on<T extends z.ZodTypeAny>(
      event: string,
      schema: T,
      perSecond: number,
      handler: (data: z.infer<T>, ack: (res: unknown) => void) => Promise<void> | void,
    ) {
      socket.on(event, async (raw: unknown, maybeAck?: unknown) => {
        const ack = typeof maybeAck === "function" ? (maybeAck as (res: unknown) => void) : () => {};
        if (!allow(event, perSecond)) return ack({ error: "Slow down a little." });
        const parsed = schema.safeParse(raw);
        if (!parsed.success) return ack({ error: "Invalid data." });
        try {
          await handler(parsed.data, ack);
        } catch (err) {
          logger.error({ err, event }, "Socket handler failed");
          ack({ error: "Something went wrong." });
        }
      });
    }

    const roomId = z.string().uuid();
    const inRoom = (id: string) => joined.has(id);

    on("room:enter", z.object({ code: z.string().regex(/^[A-Z0-9]{6}$/) }), 5, async ({ code }, ack) => {
      const room = await db.one<{ id: string; is_demo: boolean }>(
        `select r.id, r.is_demo from rooms r join room_members m on m.room_id = r.id and m.user_id = $2 where r.code = $1`,
        [code, user.id],
      );
      if (!room || room.is_demo !== user.is_demo) return ack({ error: "Join this room first." });
      const state = await loadRoom(room.id);
      if (!joined.has(room.id)) {
        joined.add(room.id);
        await socket.join(`room:${room.id}`);
        state.here.set(user.id, (state.here.get(user.id) ?? 0) + 1);
        io.to(`room:${room.id}`).emit("room:here", { roomId: room.id, userIds: hereList(state) });
      }
      ack({
        roomId: room.id,
        strokes: state.strokes,
        timer: normalizeTimer(state.timer, Date.now()),
        here: hereList(state),
        serverNow: Date.now(),
      });
    });

    on("room:exit", z.object({ roomId }), 5, ({ roomId }) => leaveRoom(socket, roomId));

    on("wb:draft", z.object({ roomId, stroke: draftSchema }), 40, ({ roomId, stroke }) => {
      if (!inRoom(roomId)) return;
      socket.volatile.to(`room:${roomId}`).emit("wb:draft", { roomId, stroke: { ...stroke, userId: user.id } });
    });

    on("wb:stroke", z.object({ roomId, stroke: strokeSchema }), 20, async ({ roomId, stroke }) => {
      if (!inRoom(roomId)) return;
      const state = await loadRoom(roomId);
      const full = { ...stroke, userId: user.id };
      state.strokes = addStroke(state.strokes, full);
      socket.to(`room:${roomId}`).emit("wb:stroke", { roomId, stroke: full });
      scheduleSave(roomId, state);
    });

    on("wb:undo", z.object({ roomId }), 10, async ({ roomId }) => {
      if (!inRoom(roomId)) return;
      const state = await loadRoom(roomId);
      const result = undoStroke(state.strokes, user.id);
      if (!result.removedId) return;
      state.strokes = result.strokes;
      io.to(`room:${roomId}`).emit("wb:remove", { roomId, strokeId: result.removedId });
      scheduleSave(roomId, state);
    });

    on("wb:clear", z.object({ roomId }), 2, async ({ roomId }) => {
      if (!inRoom(roomId)) return;
      const state = await loadRoom(roomId);
      state.strokes = [];
      io.to(`room:${roomId}`).emit("wb:clear", { roomId, by: user.name });
      scheduleSave(roomId, state);
    });

    const timerAction = z.discriminatedUnion("type", [
      z.object({ type: z.literal("start") }),
      z.object({ type: z.literal("pause") }),
      z.object({ type: z.literal("reset") }),
      z.object({ type: z.literal("mode"), mode: z.enum(["focus", "break"]), minutes: z.number().int().min(1).max(90).optional() }),
    ]);

    on("timer:action", z.object({ roomId, action: timerAction }), 5, async ({ roomId, action }) => {
      if (!inRoom(roomId)) return;
      const state = await loadRoom(roomId);
      state.timer = applyTimerAction(state.timer, action, Date.now());
      io.to(`room:${roomId}`).emit("timer:state", {
        roomId,
        timer: state.timer,
        serverNow: Date.now(),
        by: { id: user.id, name: user.name },
        action: action.type,
      });
      scheduleSave(roomId, state);
    });

    on("room:react", z.object({ roomId, emoji: z.enum(REACTIONS) }), 3, ({ roomId, emoji }) => {
      if (!inRoom(roomId)) return;
      io.to(`room:${roomId}`).emit("room:reaction", { roomId, emoji, userId: user.id, name: user.name });
    });

    const typing = z.object({ toUserId: z.string().uuid() });
    on("dm:typing", typing, 2, async ({ toUserId }) => {
      const other = await db.one<{ is_demo: boolean }>("select is_demo from users where id = $1", [toUserId]);
      if (other && other.is_demo === user.is_demo) realtime.toUser(toUserId, "dm:typing", { userId: user.id });
    });
    on("dm:typing-stop", typing, 4, ({ toUserId }) => realtime.toUser(toUserId, "dm:typing-stop", { userId: user.id }));

    socket.on("disconnect", () => {
      for (const id of [...joined]) leaveRoom(socket, id);
      if (presence.disconnect(user.id)) {
        // Wait out the grace period before telling everyone they left.
        setTimeout(() => {
          if (!presence.isLive(user.id)) void realtime.checkInChanged(user.id).catch(() => {});
        }, GRACE_MS + 500);
      }
    });
  });

  async function close() {
    await Promise.all([...rooms.entries()].map(([id, state]) => saveRoom(id, state)));
    await new Promise<void>((resolve) => io.close(() => resolve()));
  }

  return { realtime, io, presence, close };
}

/** Used by tests and scripts that run the API without sockets. */
export function noopRealtime(live: (userId: string) => boolean = () => false): Realtime {
  return {
    toUser: () => {},
    toRoom: () => {},
    checkInChanged: async () => {},
    isLive: live,
  };
}
