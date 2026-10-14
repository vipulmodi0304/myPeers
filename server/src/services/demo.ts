import { randomInt, randomUUID } from "node:crypto";
import type { AppContext, User } from "../context.js";
import type { Db } from "../db/pool.js";
import { newRoomCode } from "../lib/crypto.js";
import { logger } from "../logger.js";

/**
 * Demo mode. Signup is limited to McGill emails, so recruiters and other
 * visitors would otherwise never get past the login screen. "Try the demo"
 * creates a throwaway guest account in the separate demo world, filled with
 * a few always-online sample classmates (bots), a chat thread and a room.
 */
const BOT_DOMAIN = "demo.mypeers.app";
const GUEST_DOMAIN = "guest.mypeers.app";
export const DEMO_TTL_HOURS = 24;

const BOTS = [
  { slug: "maya", name: "Maya Chen", course: "COMP 251", topic: "A3: dynamic programming", location: "Trottier, 3rd floor", status: "studying" },
  { slug: "daniel", name: "Daniel Okafor", course: "COMP 251", topic: "Midterm review", location: "McLennan, 4th floor", status: "studying" },
  { slug: "emma", name: "Emma Wilson", course: "COMP 251", topic: "Graph algorithms", location: "Online", status: "break" },
  { slug: "sofia", name: "Sofia Rossi", course: "MATH 240", topic: "Induction proofs", location: "Redpath basement", status: "studying" },
  { slug: "arjun", name: "Arjun Patel", course: "COMP 206", topic: "Bash scripting lab", location: "Online", status: "studying" },
  { slug: "lea", name: "Léa Tremblay", course: "ECON 208", topic: "Problem set 4", location: "Bronfman Building", status: "break" },
  { slug: "noah", name: "Noah Kim", course: "COMP 302", topic: "OCaml recursion", location: "Schulich Library", status: "studying" },
] as const;

const BOT_REPLIES = [
  "Hey, nice to meet you 🙂 What are you working on right now?",
  "Want to study together? Make a room from the Rooms tab and send me the code, the whiteboard is great for working through problems.",
  "Same here, I've been at it a while. Short break soon, then another focus block.",
  "Good luck! Ping me if you get stuck 👍",
];

let botIds: string[] = [];
export const demoBotIds = () => botIds;

/** Create or refresh the sample classmates. Safe to run on every boot. */
export async function ensureDemoBots(db: Db): Promise<string[]> {
  const ids: string[] = [];
  for (const bot of BOTS) {
    const row = await db.one<{ id: string }>(
      `insert into users (email, name, is_demo, email_verified_at)
       values ($1, $2, true, now())
       on conflict (lower(email)) do update set name = excluded.name
       returning id`,
      [`${bot.slug}@${BOT_DOMAIN}`, bot.name],
    );
    ids.push(row!.id);
    await db.query(
      `insert into check_ins (user_id, course_code, topic, location, status, started_at)
       values ($1, $2, $3, $4, $5, now() - make_interval(mins => $6))
       on conflict (user_id) do update set course_code = excluded.course_code, topic = excluded.topic,
         location = excluded.location, status = excluded.status`,
      [row!.id, bot.course, bot.topic, bot.location, bot.status, randomInt(8, 95)],
    );
  }
  botIds = ids;
  return ids;
}

/** Keep the bots' "studying for 40m" labels believable on long-running servers. */
async function refreshBotClocks(db: Db) {
  await db.query(
    `update check_ins set started_at = now() - make_interval(mins => (8 + floor(random() * 90))::int)
      where user_id = any($1) and started_at < now() - interval '3 hours'`,
    [botIds],
  );
}

export async function createDemoVisitor(ctx: AppContext): Promise<User> {
  await refreshBotClocks(ctx.db);
  const [maya, daniel, emma] = botIds;
  const name = `Guest ${randomInt(1000, 9999)}`;

  return ctx.db.transaction(async (tx) => {
    const user = (await tx.one<User>(
      `insert into users (email, name, is_demo, email_verified_at)
       values ($1, $2, true, now())
       returning id, email, name, is_demo, email_verified_at`,
      [`guest-${randomUUID()}@${GUEST_DOMAIN}`, name],
    ))!;

    // A friendly opener from Maya, waiting unread in the inbox.
    await tx.query(
      `insert into direct_messages (sender_id, recipient_id, body, created_at) values
         ($1, $2, 'hey! saw you just joined myPeers 👋', now() - interval '3 minutes'),
         ($1, $2, 'are you in COMP 251 too? I''m stuck on A3 Q2 if you want to work through it together', now() - interval '2 minutes')`,
      [maya, user.id],
    );

    // A study room with history, so the room page has something to show.
    const room = (await tx.one<{ id: string }>(
      `insert into rooms (code, name, course_code, created_by, is_demo)
       values ($1, 'COMP 251 Study Squad', 'COMP 251', $2, true) returning id`,
      [newRoomCode(), user.id],
    ))!;
    await tx.query(
      `insert into room_members (room_id, user_id) select $1, unnest($2::uuid[])`,
      [room.id, [user.id, maya, daniel, emma]],
    );
    await tx.query(
      `insert into room_messages (room_id, sender_id, body, created_at) values
         ($1, $2, 'ok who''s done Q3 of the assignment', now() - interval '25 minutes'),
         ($1, $3, 'me, the trick is sorting by finish time first', now() - interval '22 minutes'),
         ($1, $4, 'starting a pomodoro, see you all in 25', now() - interval '20 minutes')`,
      [room.id, daniel, emma, maya],
    );
    return user;
  });
}

/**
 * When a guest messages a bot, the bot "types" for a moment and answers.
 * This makes the demo feel alive and shows off the realtime layer.
 */
export function scheduleBotReply(ctx: AppContext, botId: string, guestId: string) {
  if (!botIds.includes(botId)) return;
  ctx.realtime.toUser(guestId, "dm:typing", { userId: botId });
  setTimeout(async () => {
    try {
      // The guest's Nth message gets the bot's Nth canned reply; after that the bot goes quiet.
      const asked = await ctx.db.one<{ n: number }>(
        "select count(*)::int as n from direct_messages where sender_id = $1 and recipient_id = $2",
        [guestId, botId],
      );
      const body = BOT_REPLIES[(asked?.n ?? 1) - 1];
      if (!body) {
        ctx.realtime.toUser(guestId, "dm:typing-stop", { userId: botId });
        return;
      }
      const msg = await ctx.db.one<{ id: string; created_at: Date }>(
        "insert into direct_messages (sender_id, recipient_id, body) values ($1, $2, $3) returning id, created_at",
        [botId, guestId, body],
      );
      const bot = await ctx.db.one<{ name: string }>("select name from users where id = $1", [botId]);
      ctx.realtime.toUser(guestId, "dm:new", {
        senderName: bot?.name,
        id: msg!.id,
        senderId: botId,
        recipientId: guestId,
        body,
        attachment: null,
        readAt: null,
        createdAt: msg!.created_at.toISOString(),
      });
    } catch (err) {
      logger.warn({ err }, "Bot reply failed");
    }
  }, 1800);
}

/** Delete guest accounts older than a day. Everything they own cascades. */
export async function cleanupDemoVisitors(db: Db): Promise<number> {
  const rows = await db.query(
    `delete from users where is_demo and email like $1 and created_at < now() - make_interval(hours => $2) returning id`,
    [`%@${GUEST_DOMAIN}`, DEMO_TTL_HOURS],
  );
  return rows.length;
}
