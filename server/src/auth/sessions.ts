import type { NextFunction, Request, Response } from "express";
import { parseCookie } from "cookie";
import type { AppContext, User } from "../context.js";
import { newToken, sha256 } from "../lib/crypto.js";
import { unauthorized, forbidden } from "../lib/errors.js";

/**
 * Session auth, same pattern as ReplayLab:
 * 1. On login we create a random token and put it in an httpOnly cookie
 *    (JavaScript in the browser can't read it, which blocks XSS token theft).
 * 2. The database stores only sha256(token), so a DB leak can't log anyone in.
 * 3. Each request hashes the cookie and looks the session up.
 */
export const SESSION_COOKIE = "mypeers_session";
const SESSION_DAYS = 30;
const DEMO_SESSION_HOURS = 6;

export async function startSession(ctx: AppContext, res: Response, user: Pick<User, "id" | "is_demo">) {
  const token = newToken();
  const ms = user.is_demo ? DEMO_SESSION_HOURS * 3600_000 : SESSION_DAYS * 86_400_000;
  const expiresAt = new Date(Date.now() + ms);
  await ctx.db.query("insert into auth_sessions (id, user_id, expires_at) values ($1, $2, $3)", [
    sha256(token),
    user.id,
    expiresAt,
  ]);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: ctx.config.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(ctx: AppContext, req: Request, res: Response) {
  const token = readToken(req.headers.cookie);
  if (token) await ctx.db.query("delete from auth_sessions where id = $1", [sha256(token)]);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function readToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  return parseCookie(cookieHeader)[SESSION_COOKIE] ?? null;
}

/** Look up the user behind a cookie header. Shared by REST and Socket.IO. */
export async function userFromCookie(ctx: AppContext, cookieHeader: string | undefined): Promise<User | null> {
  const token = readToken(cookieHeader);
  if (!token) return null;
  return ctx.db.one<User>(
    `select u.id, u.email, u.name, u.is_demo, u.email_verified_at
       from auth_sessions s join users u on u.id = s.user_id
      where s.id = $1 and s.expires_at > now()`,
    [sha256(token)],
  );
}

/** Attaches req.user when a valid session cookie is present. Never rejects. */
export function loadUser(ctx: AppContext) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    req.user = (await userFromCookie(ctx, req.headers.cookie)) ?? undefined;
    next();
  };
}

/** Rejects the request unless a signed-in, verified user is present. */
export function requireUser(ctx: AppContext) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (ctx.config.REQUIRE_EMAIL_VERIFICATION && !req.user.is_demo && !req.user.email_verified_at) {
      return next(forbidden("Verify your email to continue."));
    }
    next();
  };
}
