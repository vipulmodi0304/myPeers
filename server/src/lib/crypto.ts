import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** 32 random bytes, URL-safe. Used as the session cookie value. */
export const newToken = () => randomBytes(32).toString("base64url");

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Six-digit numeric code for email verification / password reset. */
export const newCode = () => randomInt(0, 1_000_000).toString().padStart(6, "0");

/** Compare two hex hashes without leaking timing information. */
export function hashesMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid typos

/** Six-character room code like "K7QX2M". */
export function newRoomCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += ROOM_ALPHABET[randomInt(0, ROOM_ALPHABET.length)];
  return code;
}
