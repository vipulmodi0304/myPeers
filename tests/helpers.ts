import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../server/src/app.js";
import { loadConfig } from "../server/src/config.js";
import type { AppContext } from "../server/src/context.js";
import { migrate } from "../server/src/db/migrate.js";
import { createDb } from "../server/src/db/pool.js";
import type { Mailer } from "../server/src/lib/email.js";
import { noopRealtime } from "../server/src/realtime/index.js";
import { ensureDemoBots } from "../server/src/services/demo.js";

export type Sent = { to: string; subject: string; text: string };

/**
 * Builds a fresh app on an empty test database. Emails are captured in
 * `outbox` and realtime pushes are recorded in `pushed` so tests can assert on them.
 */
export async function setup(overrides: Record<string, string> = {}) {
  const config = loadConfig({
    ...process.env,
    UPLOAD_DIR: mkdtempSync(path.join(os.tmpdir(), "mypeers-uploads-")),
    ...overrides,
  });
  const db = createDb(config.DATABASE_URL);
  await db.query("drop schema public cascade; create schema public;");
  await migrate(db);
  const botIds = await ensureDemoBots(db);

  const outbox: Sent[] = [];
  const mailer: Mailer = { send: async (to, subject, text) => void outbox.push({ to, subject, text }) };
  const pushed: { to: string; event: string; payload: unknown }[] = [];
  const live = new Set<string>(botIds);
  const realtime = {
    ...noopRealtime((id) => live.has(id)),
    toUser: (to: string, event: string, payload: unknown) => void pushed.push({ to, event, payload }),
    toRoom: (to: string, event: string, payload: unknown) => void pushed.push({ to, event, payload }),
  };
  const ctx: AppContext = { config, db, mailer, realtime };
  const app = createApp(ctx);

  /** Sign up + verify a McGill user, returning a cookie-carrying agent. */
  async function student(name = "Test Student", email = `${name.toLowerCase().replace(/\W+/g, ".")}@mail.mcgill.ca`) {
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/signup").send({ name, email, password: "correct horse battery" });
    if (res.status !== 201) throw new Error(`signup failed: ${JSON.stringify(res.body)}`);
    const code = lastCode(email);
    await agent.post("/api/auth/verify").send({ code }).expect(200);
    return { agent, id: res.body.user.id as string, email };
  }

  function lastCode(email: string) {
    const mail = [...outbox].reverse().find((m) => m.to === email);
    return mail?.text.match(/\b(\d{6})\b/)?.[1] ?? "";
  }

  return { app, ctx, db, outbox, pushed, live, botIds, student, lastCode, close: () => db.close() };
}
