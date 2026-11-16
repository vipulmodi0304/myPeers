import type { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/**
 * Rate limits. Signed-in requests are counted per account, not per IP: most
 * students sit behind the same few campus Wi-Fi addresses, so a per-IP limit
 * would lock out a whole library when one person misbehaves.
 *
 * ponytail: counters live in this process's memory, which is right for one
 * instance. Several instances would need a shared store (rate-limit-redis).
 */
const byUser = (req: Request) => req.user?.id ?? ipKeyGenerator(req.ip ?? "");

/** For endpoints that check a secret: counted per account (or per email being tried), so guessing one account is slow. */
export const perAccount = (req: Request) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase().slice(0, 200) : "";
  return req.user?.id ?? (email || ipKeyGenerator(req.ip ?? ""));
};

export function limit(opts: { windowMs: number; limit: number; key?: (req: Request) => string; skip?: (req: Request) => boolean }) {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    keyGenerator: opts.key ?? byUser,
    // Tests hammer the API from one address on purpose.
    skip: (req) => process.env.NODE_ENV === "test" || Boolean(opts.skip?.(req)),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: { code: "rate_limited", message: "Too many requests. Wait a moment and try again." } },
  });
}
