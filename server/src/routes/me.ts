import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { endSession } from "../auth/sessions.js";
import type { AppContext, User } from "../context.js";
import { forbidden, HttpError } from "../lib/errors.js";
import { BCRYPT_ROUNDS, publicUser } from "./auth.js";

export function meRoutes(ctx: AppContext) {
  const router = Router();

  router.patch("/", async (req, res) => {
    const input = z.object({ name: z.string().trim().min(1, "Enter your name.").max(60) }).parse(req.body);
    const user = (await ctx.db.one<User>(
      "update users set name = $2 where id = $1 returning id, email, name, is_demo, email_verified_at",
      [req.user!.id, input.name],
    ))!;
    // Your name shows on your check-in card, so tell everyone who can see it.
    await ctx.realtime.checkInChanged(user.id);
    res.json({ user: publicUser(user) });
  });

  router.post("/password", async (req, res) => {
    if (req.user!.is_demo) throw forbidden("Demo accounts don't have a password.");
    const input = z
      .object({
        currentPassword: z.string().max(200),
        newPassword: z.string().min(8, "New password must be at least 8 characters.").max(200),
      })
      .parse(req.body);
    const row = await ctx.db.one<{ password_hash: string }>("select password_hash from users where id = $1", [
      req.user!.id,
    ]);
    if (!row?.password_hash || !(await bcrypt.compare(input.currentPassword, row.password_hash))) {
      throw new HttpError(400, "Your current password is incorrect.", "bad_credentials");
    }
    await ctx.db.query("update users set password_hash = $2 where id = $1", [
      req.user!.id,
      await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS),
    ]);
    res.json({ ok: true });
  });

  // Permanently delete the account and everything it owns (cascades in SQL).
  router.delete("/", async (req, res) => {
    if (!req.user!.is_demo) {
      const input = z.object({ password: z.string().max(200) }).parse(req.body);
      const row = await ctx.db.one<{ password_hash: string }>("select password_hash from users where id = $1", [
        req.user!.id,
      ]);
      if (!row?.password_hash || !(await bcrypt.compare(input.password, row.password_hash))) {
        throw new HttpError(400, "Password is incorrect.", "bad_credentials");
      }
    }
    await ctx.db.query("delete from check_ins where user_id = $1", [req.user!.id]);
    await ctx.realtime.checkInChanged(req.user!.id);
    await endSession(ctx, req, res);
    await ctx.db.query("delete from users where id = $1", [req.user!.id]);
    res.json({ ok: true });
  });

  return router;
}
