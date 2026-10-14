import { Router } from "express";
import { z } from "zod";
import type { AppContext, User } from "../context.js";
import { badRequest, notFound } from "../lib/errors.js";
import { demoBotIds, scheduleBotReply } from "../services/demo.js";
import { getPeer, sameWorld } from "../services/peers.js";

type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: Date | null;
  created_at: Date;
  att_id: string | null;
  att_name: string | null;
  att_mime: string | null;
  att_size: number | null;
};

export type MessageDto = ReturnType<typeof toMessageDto>;

export const toMessageDto = (r: MessageRow) => ({
  id: r.id,
  senderId: r.sender_id,
  recipientId: r.recipient_id,
  body: r.body,
  readAt: r.read_at?.toISOString() ?? null,
  createdAt: r.created_at.toISOString(),
  attachment: r.att_id
    ? { id: r.att_id, fileName: r.att_name!, mimeType: r.att_mime!, size: r.att_size!, url: `/api/uploads/${r.att_id}` }
    : null,
});

const MESSAGE_SELECT = `
  select m.id, m.sender_id, m.recipient_id, m.body, m.read_at, m.created_at,
         a.id as att_id, a.file_name as att_name, a.mime_type as att_mime, a.size_bytes as att_size
    from direct_messages m left join attachments a on a.id = m.attachment_id`;

const uuid = z.string().uuid("Unknown user.");

export function messageRoutes(ctx: AppContext) {
  const router = Router();
  const { db } = ctx;

  /** The other person in a conversation, if the viewer is allowed to talk to them. */
  async function otherUser(viewer: User, id: string) {
    const other = await db.one<User>("select id, email, name, is_demo, email_verified_at from users where id = $1", [
      uuid.parse(id),
    ]);
    if (!other || other.id === viewer.id || !sameWorld(viewer, other)) throw notFound("That person isn't on myPeers.");
    return other;
  }

  // Inbox: one row per person you've talked to, newest first.
  router.get("/conversations", async (req, res) => {
    const me = req.user!.id;
    const rows = await db.query<{
      other_id: string;
      other_name: string;
      body: string;
      has_attachment: boolean;
      sender_id: string;
      created_at: Date;
      unread: number;
    }>(
      `with mine as (
         select m.*, case when m.sender_id = $1 then m.recipient_id else m.sender_id end as other_id
           from direct_messages m where m.sender_id = $1 or m.recipient_id = $1
       ), latest as (
         select distinct on (other_id) other_id, body, attachment_id is not null as has_attachment, sender_id, created_at
           from mine order by other_id, created_at desc
       )
       select l.other_id, u.name as other_name, l.body, l.has_attachment, l.sender_id, l.created_at,
              (select count(*)::int from mine x where x.other_id = l.other_id and x.recipient_id = $1 and x.read_at is null) as unread
         from latest l join users u on u.id = l.other_id
        order by l.created_at desc
        limit 100`,
      [me],
    );
    res.json({
      conversations: rows.map((r) => ({
        user: { id: r.other_id, name: r.other_name, live: ctx.realtime.isLive(r.other_id) },
        lastMessage: {
          preview: r.body || (r.has_attachment ? "Sent a file" : ""),
          fromMe: r.sender_id === me,
          createdAt: r.created_at.toISOString(),
        },
        unread: r.unread,
      })),
    });
  });

  router.get("/conversations/unread-count", async (req, res) => {
    const row = await db.one<{ n: number }>(
      "select count(*)::int as n from direct_messages where recipient_id = $1 and read_at is null",
      [req.user!.id],
    );
    res.json({ unread: row?.n ?? 0 });
  });

  // One thread, paginated backwards with ?before=<ISO timestamp>.
  router.get("/conversations/:userId/messages", async (req, res) => {
    const other = await otherUser(req.user!, req.params.userId);
    const q = z
      .object({ before: z.string().datetime().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) })
      .parse(req.query);
    const rows = await db.query<MessageRow>(
      `${MESSAGE_SELECT}
        where least(m.sender_id, m.recipient_id) = least($1::uuid, $2::uuid)
          and greatest(m.sender_id, m.recipient_id) = greatest($1::uuid, $2::uuid)
          and ($3::timestamptz is null or m.created_at < $3)
        order by m.created_at desc limit $4`,
      [req.user!.id, other.id, q.before ?? null, q.limit + 1],
    );
    const hasMore = rows.length > q.limit;
    const checkIn = await getPeer(ctx, other.id);
    res.json({
      user: {
        id: other.id,
        name: other.name,
        live: ctx.realtime.isLive(other.id),
        checkIn: checkIn ? { courseCode: checkIn.courseCode, topic: checkIn.topic, location: checkIn.location, status: checkIn.status } : null,
      },
      messages: rows.slice(0, q.limit).reverse().map(toMessageDto),
      hasMore,
    });
  });

  router.post("/conversations/:userId/messages", async (req, res) => {
    const me = req.user!;
    const other = await otherUser(me, req.params.userId);
    const input = z
      .object({
        body: z.string().trim().max(2000, "Messages are limited to 2000 characters.").default(""),
        attachmentId: z.string().uuid().optional(),
      })
      .refine((v) => v.body.length > 0 || v.attachmentId, "Write a message or attach a file.")
      .parse(req.body);

    if (input.attachmentId) {
      const owned = await db.one("select 1 from attachments where id = $1 and uploader_id = $2", [input.attachmentId, me.id]);
      if (!owned) throw badRequest("That file wasn't found. Try uploading it again.");
    }
    const inserted = await db.one<{ id: string }>(
      "insert into direct_messages (sender_id, recipient_id, body, attachment_id) values ($1, $2, $3, $4) returning id",
      [me.id, other.id, input.body, input.attachmentId ?? null],
    );
    const row = await db.one<MessageRow>(`${MESSAGE_SELECT} where m.id = $1`, [inserted!.id]);
    const message = toMessageDto(row!);

    // Push to the recipient, and to the sender's other tabs/devices.
    ctx.realtime.toUser(other.id, "dm:new", message);
    ctx.realtime.toUser(me.id, "dm:new", message);
    if (me.is_demo && demoBotIds().includes(other.id)) scheduleBotReply(ctx, other.id, me.id);

    res.status(201).json({ message });
  });

  router.post("/conversations/:userId/read", async (req, res) => {
    const other = await otherUser(req.user!, req.params.userId);
    const updated = await db.query(
      `update direct_messages set read_at = now()
        where recipient_id = $1 and sender_id = $2 and read_at is null returning id`,
      [req.user!.id, other.id],
    );
    if (updated.length) {
      const payload = { readerId: req.user!.id, otherId: other.id, at: new Date().toISOString() };
      ctx.realtime.toUser(other.id, "dm:read", payload); // read receipts for the sender
      ctx.realtime.toUser(req.user!.id, "dm:read", payload); // keeps badges in sync across my tabs
    }
    res.json({ marked: updated.length });
  });

  return router;
}
