import { Router } from "express";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { normalizeCourse } from "../lib/courses.js";
import { getPeer, listLivePeers } from "../services/peers.js";

/** The check-in as the client sees it (without the internal "world" flag). */
async function myCheckIn(ctx: AppContext, userId: string) {
  const peer = await getPeer(ctx, userId);
  if (!peer) return null;
  const { world: _world, ...dto } = peer;
  return dto;
}

const COURSE_FORMAT = /^[A-Z]{3,4}\d? \d{3}[A-Z0-9]{0,3}$/;

const checkInInput = z.object({
  courseCode: z
    .string()
    .transform(normalizeCourse)
    .refine((c) => COURSE_FORMAT.test(c), "Use a course code like COMP 251."),
  topic: z.string().trim().max(80, "Keep it under 80 characters.").default(""),
  location: z.string().trim().max(60, "Keep it under 60 characters.").default(""),
  status: z.enum(["studying", "break"]).default("studying"),
});

export function checkInRoutes(ctx: AppContext) {
  const router = Router();

  router.get("/check-in", async (req, res) => {
    res.json({ checkIn: await myCheckIn(ctx, req.user!.id) });
  });

  // Create or update your check-in. Switching course restarts the "studying for" clock.
  router.put("/check-in", async (req, res) => {
    const input = checkInInput.parse(req.body);
    await ctx.db.query(
      `insert into check_ins (user_id, course_code, topic, location, status)
       values ($1, $2, $3, $4, $5)
       on conflict (user_id) do update set
         topic = excluded.topic, location = excluded.location, status = excluded.status, updated_at = now(),
         started_at = case when check_ins.course_code = excluded.course_code then check_ins.started_at else now() end,
         course_code = excluded.course_code`,
      [req.user!.id, input.courseCode, input.topic, input.location, input.status],
    );
    await ctx.realtime.checkInChanged(req.user!.id);
    res.json({ checkIn: await myCheckIn(ctx, req.user!.id) });
  });

  router.delete("/check-in", async (req, res) => {
    await ctx.db.query("delete from check_ins where user_id = $1", [req.user!.id]);
    await ctx.realtime.checkInChanged(req.user!.id);
    res.json({ ok: true });
  });

  router.get("/peers", async (req, res) => {
    res.json({ peers: await listLivePeers(ctx, req.user!) });
  });

  return router;
}
