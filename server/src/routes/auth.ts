import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { consumeCode, sendCode } from "../auth/codes.js";
import { endSession, startSession } from "../auth/sessions.js";
import type { AppContext, User } from "../context.js";
import { badRequest, conflict, forbidden, HttpError, unauthorized } from "../lib/errors.js";
import { logger } from "../logger.js";
import { createDemoVisitor } from "../services/demo.js";

const BCRYPT_ROUNDS = 12;
// Used so "unknown email" and "wrong password" take the same time (no user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);

const name = z.string().trim().min(1, "Enter your name.").max(60, "Name is too long.");
const password = z.string().min(8, "Password must be at least 8 characters.").max(200);
const code = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code.");

export const publicUser = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.is_demo ? null : u.email,
  isDemo: u.is_demo,
  emailVerified: Boolean(u.email_verified_at),
});

export function authRoutes(ctx: AppContext) {
  const router = Router();
  const { config, db } = ctx;
  const isTest = config.NODE_ENV === "test";

  const email = z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email.")
    .refine((e) => e.endsWith(`@${config.ALLOWED_EMAIL_DOMAIN}`), `Use your @${config.ALLOWED_EMAIL_DOMAIN} email.`);

  // Brute-force protection on everything that checks a secret.
  const strict = rateLimit({ windowMs: 15 * 60_000, limit: 30, skip: () => isTest, standardHeaders: "draft-8", legacyHeaders: false });
  const demoLimit = rateLimit({ windowMs: 60 * 60_000, limit: 15, skip: () => isTest, standardHeaders: "draft-8", legacyHeaders: false });

  const userColumns = "id, email, name, is_demo, email_verified_at";

  router.get("/me", (req, res) => {
    res.json({ user: req.user ? publicUser(req.user) : null });
  });

  router.post("/signup", strict, async (req, res) => {
    const input = z.object({ name, email, password }).parse(req.body);
    const hash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const verifiedNow = !config.REQUIRE_EMAIL_VERIFICATION;

    const existing = await db.one<User>(`select ${userColumns} from users where lower(email) = $1`, [input.email]);
    let user: User;
    if (existing?.email_verified_at || (existing && verifiedNow)) {
      throw conflict("An account with this email already exists. Sign in instead.", "email_taken");
    } else if (existing) {
      // Unfinished signup: whoever proves they own the inbox (via the code) gets the account.
      user = (await db.one<User>(
        `update users set name = $2, password_hash = $3 where id = $1 returning ${userColumns}`,
        [existing.id, input.name, hash],
      ))!;
    } else {
      user = (await db.one<User>(
        `insert into users (email, name, password_hash, email_verified_at)
         values ($1, $2, $3, case when $4 then now() end) returning ${userColumns}`,
        [input.email, input.name, hash, verifiedNow],
      ))!;
    }

    if (!verifiedNow) {
      try {
        await sendCode(ctx, user, "verify");
      } catch (err) {
        if (!(err instanceof HttpError && err.code === "cooldown")) throw err;
      }
    }
    await startSession(ctx, res, user);
    res.status(201).json({ user: publicUser(user), needsVerification: !verifiedNow });
  });

  router.post("/verify", strict, async (req, res) => {
    if (!req.user) throw unauthorized();
    if (req.user.email_verified_at) return void res.json({ user: publicUser(req.user) });
    const input = z.object({ code }).parse(req.body);
    await consumeCode(ctx, req.user.id, "verify", input.code);
    const user = (await db.one<User>(
      `update users set email_verified_at = now() where id = $1 returning ${userColumns}`,
      [req.user.id],
    ))!;
    res.json({ user: publicUser(user) });
  });

  router.post("/verify/resend", strict, async (req, res) => {
    if (!req.user) throw unauthorized();
    if (req.user.email_verified_at) throw badRequest("Your email is already verified.");
    await sendCode(ctx, req.user, "verify");
    res.json({ ok: true });
  });

  router.post("/login", strict, async (req, res) => {
    const input = z.object({ email: z.string().trim().toLowerCase(), password: z.string().max(200) }).parse(req.body);
    const row = await db.one<User & { password_hash: string | null }>(
      `select ${userColumns}, password_hash from users where lower(email) = $1 and not is_demo`,
      [input.email],
    );
    const ok = await bcrypt.compare(input.password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !row.password_hash || !ok) {
      throw new HttpError(401, "Email or password is incorrect.", "bad_credentials");
    }
    const { password_hash: _ignored, ...user } = row;
    await startSession(ctx, res, user);
    res.json({ user: publicUser(user), needsVerification: config.REQUIRE_EMAIL_VERIFICATION && !user.email_verified_at });
  });

  router.post("/logout", async (req, res) => {
    await endSession(ctx, req, res);
    res.json({ ok: true });
  });

  // Always answers the same way, so this endpoint can't be used to check who has an account.
  router.post("/password/forgot", strict, async (req, res) => {
    const input = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email.") }).parse(req.body);
    const user = await db.one<User>(`select ${userColumns} from users where lower(email) = $1 and not is_demo`, [
      input.email,
    ]);
    if (user) {
      try {
        await sendCode(ctx, user, "reset");
      } catch (err) {
        logger.info({ err: (err as Error).message }, "Reset code not sent");
      }
    }
    res.json({ ok: true });
  });

  router.post("/password/reset", strict, async (req, res) => {
    const input = z.object({ email: z.string().trim().toLowerCase(), code, password }).parse(req.body);
    const user = await db.one<User>(`select ${userColumns} from users where lower(email) = $1 and not is_demo`, [
      input.email,
    ]);
    if (!user) throw new HttpError(400, "That code is wrong or has expired.", "invalid_code");
    await consumeCode(ctx, user.id, "reset", input.code);
    const hash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    // Resetting via email also proves inbox ownership, so mark the email verified,
    // and sign out every other device.
    const updated = (await db.one<User>(
      `update users set password_hash = $2, email_verified_at = coalesce(email_verified_at, now())
        where id = $1 returning ${userColumns}`,
      [user.id, hash],
    ))!;
    await db.query("delete from auth_sessions where user_id = $1", [user.id]);
    await startSession(ctx, res, updated);
    res.json({ user: publicUser(updated) });
  });

  router.post("/demo", demoLimit, async (req, res) => {
    if (!config.DEMO_ENABLED) throw forbidden("The demo is turned off.");
    if (req.user) await endSession(ctx, req, res);
    const user = await createDemoVisitor(ctx);
    await startSession(ctx, res, user);
    res.status(201).json({ user: publicUser(user) });
  });

  return router;
}

export { BCRYPT_ROUNDS };
