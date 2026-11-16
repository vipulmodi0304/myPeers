import { existsSync, readdirSync, utimesSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sweepUploads } from "../server/src/routes/uploads.js";
import { setup } from "./helpers.js";

let t: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => (t = await setup()));
afterAll(() => t.close());

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082",
  "hex",
);
const pw = "correct horse battery";

describe("sessions", () => {
  it("a stranger who started a signup with your email is signed out when you finish it", async () => {
    const email = "victim@mail.mcgill.ca";
    const attacker = request.agent(t.app);
    await attacker.post("/api/auth/signup").send({ name: "Mallory", email, password: "attacker password" }).expect(201);

    // The real owner signs up later and verifies with the code from their inbox.
    const victim = request.agent(t.app);
    await t.db.query("delete from email_codes"); // skip the resend cooldown
    await victim.post("/api/auth/signup").send({ name: "Victim", email, password: pw }).expect(201);
    await victim.post("/api/auth/verify").send({ code: t.lastCode(email) }).expect(200);

    await victim.get("/api/check-in").expect(200);
    await attacker.get("/api/check-in").expect(401);
  });

  it("changing your password signs out your other devices and their sockets", async () => {
    const s = await t.student("Two Devices");
    const other = request.agent(t.app);
    await other.post("/api/auth/login").send({ email: s.email, password: pw }).expect(200);

    await s.agent.post("/api/me/password").send({ currentPassword: pw, newPassword: "a brand new password" }).expect(200);
    await s.agent.get("/api/check-in").expect(200); // this device stays signed in
    await other.get("/api/check-in").expect(401);
    expect(t.kicked).toContain(s.id);
  });
});

describe("account deletion", () => {
  it("works for someone who sent a file with no text, and removes the file from disk", async () => {
    const a = await t.student("File Only Sender");
    const b = await t.student("File Only Receiver");
    const up = await a.agent.post("/api/uploads").attach("file", PNG, { filename: "n.png", contentType: "image/png" });
    await a.agent.post(`/api/conversations/${b.id}/messages`).send({ attachmentId: up.body.attachment.id }).expect(201);
    const dir = t.ctx.config.UPLOAD_DIR;
    expect(readdirSync(dir)).toHaveLength(1);

    await a.agent.delete("/api/me").send({ password: pw }).expect(200);
    expect((await b.agent.get("/api/conversations")).body.conversations).toEqual([]);

    // The sweep leaves fresh files alone (an upload may be in progress) and removes old orphans.
    const file = path.join(dir, readdirSync(dir)[0]!);
    await sweepUploads(t.ctx);
    expect(existsSync(file)).toBe(true);
    const old = new Date(Date.now() - 2 * 86_400_000);
    utimesSync(file, old, old);
    await sweepUploads(t.ctx);
    expect(existsSync(file)).toBe(false);
  });
});

describe("uploads", () => {
  it("removes files that were uploaded but never sent", async () => {
    const s = await t.student("Never Sent");
    const up = await s.agent.post("/api/uploads").attach("file", PNG, { filename: "x.png", contentType: "image/png" });
    await t.db.query("update attachments set created_at = now() - interval '2 days' where id = $1", [up.body.attachment.id]);
    const dir = t.ctx.config.UPLOAD_DIR;
    const old = new Date(Date.now() - 2 * 86_400_000);
    for (const f of readdirSync(dir)) utimesSync(path.join(dir, f), old, old);

    await sweepUploads(t.ctx);
    expect(readdirSync(dir)).toEqual([]);
    await s.agent.get(`/api/uploads/${up.body.attachment.id}`).expect(404);
  });
});

describe("rooms", () => {
  it("removes you from the live room when you leave it", async () => {
    const s = await t.student("Room Leaver");
    const { code, id } = (await s.agent.post("/api/rooms").send({ name: "Bye" })).body.room;
    const friend = await t.student("Room Stayer");
    await friend.agent.post(`/api/rooms/${code}/join`).expect(200);
    await s.agent.delete(`/api/rooms/${code}/membership`).expect(200);
    expect(t.pushed.some((p) => p.event === "leaveRoom" && p.to === s.id && p.payload === id)).toBe(true);
  });
});

describe("verification codes", () => {
  it("can't be guessed more than 5 times even with parallel requests", async () => {
    const agent = request.agent(t.app);
    const email = "parallel@mail.mcgill.ca";
    await agent.post("/api/auth/signup").send({ name: "Parallel", email, password: pw }).expect(201);
    const right = t.lastCode(email);
    const wrong = right === "111111" ? "222222" : "111111";
    await Promise.all(Array.from({ length: 12 }, () => agent.post("/api/auth/verify").send({ code: wrong })));
    const row = await t.db.one<{ attempts: number }>("select attempts from email_codes order by created_at desc limit 1");
    expect(row!.attempts).toBeLessThanOrEqual(5);
    await agent.post("/api/auth/verify").send({ code: right }).expect(400);
  });
});

describe("blocking and reporting", () => {
  it("stops messages both ways, hides you from each other, and can be undone", async () => {
    const a = await t.student("Blocker Bea");
    const b = await t.student("Blocked Bo");
    t.live.add(a.id).add(b.id);
    await a.agent.put("/api/check-in").send({ courseCode: "COMP 251" }).expect(200);
    await b.agent.put("/api/check-in").send({ courseCode: "COMP 251" }).expect(200);
    await b.agent.post(`/api/conversations/${a.id}/messages`).send({ body: "hey" }).expect(201);

    await a.agent.put(`/api/users/${b.id}/block`).expect(200);
    await a.agent.post(`/api/conversations/${b.id}/messages`).send({ body: "x" }).expect(403);
    await b.agent.post(`/api/conversations/${a.id}/messages`).send({ body: "x" }).expect(403);
    const names = async (who: typeof a) => (await who.agent.get("/api/peers")).body.peers.map((p: { name: string }) => p.name);
    expect(await names(a)).not.toContain("Blocked Bo");
    expect(await names(b)).not.toContain("Blocker Bea");
    expect((await a.agent.get("/api/conversations")).body.conversations).toEqual([]);
    expect((await a.agent.get("/api/conversations/unread-count")).body.unread).toBe(0);
    // Only the person who blocked is told about it.
    expect((await a.agent.get(`/api/conversations/${b.id}/messages`)).body.user.blocked).toBe(true);
    expect((await b.agent.get(`/api/conversations/${a.id}/messages`)).body.user.blocked).toBe(false);
    expect((await a.agent.get("/api/blocks")).body.blocked).toEqual([{ id: b.id, name: "Blocked Bo" }]);

    await a.agent.delete(`/api/users/${b.id}/block`).expect(200);
    await b.agent.post(`/api/conversations/${a.id}/messages`).send({ body: "back" }).expect(201);
    expect(await names(a)).toContain("Blocked Bo");
  });

  it("saves a report and emails it to the admin", async () => {
    const a = await t.student("Reporter Rae");
    const b = await t.student("Reported Rex");
    t.ctx.config.ADMIN_EMAIL = "admin@example.com";
    await a.agent.post(`/api/users/${b.id}/report`).send({ reason: "" }).expect(400);
    await a.agent.post(`/api/users/${b.id}/report`).send({ reason: "Sent rude messages" }).expect(201);
    const row = await t.db.one<{ reason: string; reported_email: string }>("select reason, reported_email from reports");
    expect(row).toEqual({ reason: "Sent rude messages", reported_email: b.email });
    expect(t.outbox.some((m) => m.to === "admin@example.com" && m.text.includes("Sent rude messages"))).toBe(true);
  });
});
