import type { AppContext } from "../context.js";
import { hashesMatch, newCode, sha256 } from "../lib/crypto.js";
import { codeEmail } from "../lib/email.js";
import { HttpError } from "../lib/errors.js";

const CODE_TTL_MIN = 15;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SEC = 45;

type Purpose = "verify" | "reset";

/** Create a fresh code (replacing any old one) and email it. */
export async function sendCode(ctx: AppContext, user: { id: string; email: string }, purpose: Purpose) {
  const recent = await ctx.db.one<{ age: number }>(
    `select extract(epoch from now() - created_at)::int as age
       from email_codes where user_id = $1 and purpose = $2
      order by created_at desc limit 1`,
    [user.id, purpose],
  );
  if (recent && recent.age < RESEND_COOLDOWN_SEC) {
    throw new HttpError(429, `Please wait ${RESEND_COOLDOWN_SEC - recent.age}s before requesting another code.`, "cooldown");
  }

  const code = newCode();
  await ctx.db.transaction(async (tx) => {
    await tx.query("delete from email_codes where user_id = $1 and purpose = $2", [user.id, purpose]);
    await tx.query(
      `insert into email_codes (user_id, purpose, code_hash, expires_at)
       values ($1, $2, $3, now() + make_interval(mins => $4))`,
      [user.id, purpose, sha256(code), CODE_TTL_MIN],
    );
  });
  const mail = codeEmail(purpose, code);
  await ctx.mailer.send(user.email, mail.subject, mail.text);
}

/**
 * Check a code. Every guess is counted in the same statement that reads the
 * code, so parallel requests can't sneak in extra guesses, and the code is
 * dead after MAX_ATTEMPTS: a 6-digit code can't be brute forced.
 */
export async function consumeCode(ctx: AppContext, userId: string, purpose: Purpose, code: string): Promise<void> {
  const row = await ctx.db.one<{ id: string; code_hash: string }>(
    `update email_codes set attempts = attempts + 1
      where user_id = $1 and purpose = $2 and expires_at > now() and attempts < $3
      returning id, code_hash`,
    [userId, purpose, MAX_ATTEMPTS],
  );
  if (!row || !hashesMatch(row.code_hash, sha256(code))) {
    throw new HttpError(400, "That code is wrong or has expired.", "invalid_code");
  }
  await ctx.db.query("delete from email_codes where id = $1", [row.id]);
}
