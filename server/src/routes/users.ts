import { Router } from "express";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { forbidden } from "../lib/errors.js";
import { limit } from "../lib/limits.js";
import { logger } from "../logger.js";
import { findOther } from "../services/peers.js";

export function userRoutes(ctx: AppContext) {
  const router = Router();
  const { db } = ctx;

  // People I have blocked (so I can unblock them from my profile).
  router.get("/blocks", async (req, res) => {
    const blocked = await db.query<{ id: string; name: string }>(
      `select u.id, u.name from blocks b join users u on u.id = b.blocked_id
        where b.blocker_id = $1 order by b.created_at desc`,
      [req.user!.id],
    );
    res.json({ blocked });
  });

  router.put("/users/:userId/block", async (req, res) => {
    const me = req.user!;
    const other = await findOther(db, me, req.params.userId);
    await db.query("insert into blocks (blocker_id, blocked_id) values ($1, $2) on conflict do nothing", [me.id, other.id]);
    // Nothing from them should sit unread in a conversation I can no longer see.
    await db.query("update direct_messages set read_at = now() where recipient_id = $1 and sender_id = $2 and read_at is null", [
      me.id,
      other.id,
    ]);
    // Take each off the other's live board straight away.
    ctx.realtime.toUser(me.id, "peer:remove", { userId: other.id });
    ctx.realtime.toUser(other.id, "peer:remove", { userId: me.id });
    res.json({ ok: true });
  });

  router.delete("/users/:userId/block", async (req, res) => {
    const other = await findOther(db, req.user!, req.params.userId);
    await db.query("delete from blocks where blocker_id = $1 and blocked_id = $2", [req.user!.id, other.id]);
    res.json({ ok: true });
  });

  const reportLimit = limit({ windowMs: 24 * 3600_000, limit: 10 });
  router.post("/users/:userId/report", reportLimit, async (req, res) => {
    const me = req.user!;
    if (me.is_demo) throw forbidden("Reporting is turned off in the demo.");
    const other = await findOther(db, me, String(req.params.userId));
    const input = z
      .object({ reason: z.string().trim().min(1, "Tell us what happened.").max(1000, "Keep it under 1000 characters.") })
      .parse(req.body);
    await db.query("insert into reports (reporter_id, reported_id, reported_email, reason) values ($1, $2, $3, $4)", [
      me.id,
      other.id,
      other.email,
      input.reason,
    ]);
    logger.warn({ reporter: me.id, reported: other.id }, "User reported");
    if (ctx.config.ADMIN_EMAIL) {
      // The report is already saved; a failed notification must not fail the request.
      await ctx.mailer
        .send(
          ctx.config.ADMIN_EMAIL,
          `myPeers report: ${other.name}`,
          `${me.name} <${me.email}> reported ${other.name} <${other.email}>.\n\nWhat they wrote:\n${input.reason}\n\nReported account id: ${other.id}`,
        )
        .catch((err) => logger.error({ err }, "Could not email the report"));
    }
    res.status(201).json({ ok: true });
  });

  return router;
}
