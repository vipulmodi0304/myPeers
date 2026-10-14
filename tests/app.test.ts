import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setup } from "./helpers.js";

let t: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => (t = await setup()));
afterAll(() => t.close());

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082",
  "hex",
);

describe("check-ins and the live peer list", () => {
  it("normalizes course codes and shows live peers to each other", async () => {
    const a = await t.student("Alice Peer");
    const b = await t.student("Bob Peer");
    const res = await a.agent.put("/api/check-in").send({ courseCode: "comp251", topic: "A3", location: "Trottier" });
    expect(res.status).toBe(200);
    expect(res.body.checkIn.courseCode).toBe("COMP 251");

    // Bob only sees Alice while she has an open connection.
    expect((await b.agent.get("/api/peers")).body.peers).toEqual([]);
    t.live.add(a.id);
    const peers = (await b.agent.get("/api/peers")).body.peers;
    expect(peers.map((p: { name: string }) => p.name)).toEqual(["Alice Peer"]);
    // Student IDs and emails are not part of what peers can see.
    expect(Object.keys(peers[0]).sort()).toEqual(["courseCode", "location", "name", "startedAt", "status", "topic", "userId"]);
  });

  it("rejects malformed course codes and over-long fields", async () => {
    const s = await t.student("Validator");
    await s.agent.put("/api/check-in").send({ courseCode: "<script>" }).expect(400);
    await s.agent.put("/api/check-in").send({ courseCode: "COMP 251", topic: "x".repeat(81) }).expect(400);
  });
});

describe("direct messages", () => {
  it("delivers messages, pushes them in realtime, and tracks read state", async () => {
    const a = await t.student("Sender Sam");
    const b = await t.student("Reader Rae");
    const sent = await a.agent.post(`/api/conversations/${b.id}/messages`).send({ body: "  study at 3?  " });
    expect(sent.status).toBe(201);
    expect(sent.body.message.body).toBe("study at 3?");
    expect(t.pushed.some((p) => p.to === b.id && p.event === "dm:new")).toBe(true);

    expect((await b.agent.get("/api/conversations/unread-count")).body.unread).toBe(1);
    const thread = await b.agent.get(`/api/conversations/${a.id}/messages`);
    expect(thread.body.messages).toHaveLength(1);
    await b.agent.post(`/api/conversations/${a.id}/read`).expect(200);
    expect((await b.agent.get("/api/conversations/unread-count")).body.unread).toBe(0);
  });

  it("doesn't let a third person read someone else's thread", async () => {
    const a = await t.student("Private A");
    const b = await t.student("Private B");
    const c = await t.student("Nosy C");
    await a.agent.post(`/api/conversations/${b.id}/messages`).send({ body: "secret" }).expect(201);
    const peek = await c.agent.get(`/api/conversations/${a.id}/messages`);
    expect(peek.body.messages).toEqual([]);
  });
});

describe("file uploads", () => {
  it("only lets the two people in the chat open a shared file", async () => {
    const a = await t.student("File Sender");
    const b = await t.student("File Receiver");
    const c = await t.student("File Snooper");
    const up = await a.agent.post("/api/uploads").attach("file", PNG, { filename: "notes.png", contentType: "image/png" });
    expect(up.status).toBe(201);
    const id = up.body.attachment.id;

    await b.agent.get(`/api/uploads/${id}`).expect(404); // not shared yet
    await a.agent.post(`/api/conversations/${b.id}/messages`).send({ attachmentId: id }).expect(201);
    const got = await b.agent.get(`/api/uploads/${id}`);
    expect(got.status).toBe(200);
    expect(got.headers["content-type"]).toBe("image/png");
    await c.agent.get(`/api/uploads/${id}`).expect(404);
  });

  it("rejects files that lie about their type", async () => {
    const s = await t.student("Sneaky Uploader");
    const res = await s.agent
      .post("/api/uploads")
      .attach("file", Buffer.from("<html><script>alert(1)</script>"), { filename: "x.png", contentType: "image/png" });
    expect(res.status).toBe(400);
  });

  it("doesn't let you attach a file someone else uploaded", async () => {
    const a = await t.student("Owner Olive");
    const b = await t.student("Thief Theo");
    const up = await a.agent.post("/api/uploads").attach("file", PNG, { filename: "a.png", contentType: "image/png" });
    await b.agent.post(`/api/conversations/${a.id}/messages`).send({ attachmentId: up.body.attachment.id }).expect(400);
  });
});

describe("study rooms", () => {
  it("creates, joins, chats and cleans up empty rooms", async () => {
    const a = await t.student("Room Maker");
    const b = await t.student("Room Joiner");
    const created = await a.agent.post("/api/rooms").send({ name: "Finals grind", courseCode: "math 240" });
    expect(created.status).toBe(201);
    const { code } = created.body.room;
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(created.body.room.courseCode).toBe("MATH 240");

    // Non-members get a preview but not the chat.
    const preview = await b.agent.get(`/api/rooms/${code}`);
    expect(preview.body.isMember).toBe(false);
    await b.agent.get(`/api/rooms/${code}/messages`).expect(403);

    await b.agent.post(`/api/rooms/${code}/join`).expect(200);
    await b.agent.post(`/api/rooms/${code}/messages`).send({ body: "hi all" }).expect(201);
    const msgs = await a.agent.get(`/api/rooms/${code}/messages`);
    expect(msgs.body.messages.map((m: { body: string }) => m.body)).toEqual(["hi all"]);

    await a.agent.delete(`/api/rooms/${code}/membership`).expect(200);
    await b.agent.delete(`/api/rooms/${code}/membership`).expect(200);
    await b.agent.get(`/api/rooms/${code}`).expect(404);
  });
});

describe("demo mode", () => {
  it("gives a guest sample classmates, a chat and a room", async () => {
    const guest = request.agent(t.app);
    const res = await guest.post("/api/auth/demo");
    expect(res.status).toBe(201);
    expect(res.body.user.isDemo).toBe(true);

    expect((await guest.get("/api/peers")).body.peers.length).toBeGreaterThanOrEqual(5);
    expect((await guest.get("/api/conversations")).body.conversations[0].user.name).toBe("Maya Chen");
    expect((await guest.get("/api/rooms")).body.rooms[0].name).toBe("COMP 251 Study Squad");
  });

  it("keeps demo and real users completely apart", async () => {
    const real = await t.student("Real Student");
    t.live.add(real.id);
    await real.agent.put("/api/check-in").send({ courseCode: "COMP 251" }).expect(200);

    const guest = request.agent(t.app);
    const g = (await guest.post("/api/auth/demo")).body.user;

    // Real students never see demo bots, and guests never see real students.
    const realPeers = (await real.agent.get("/api/peers")).body.peers.map((p: { userId: string }) => p.userId);
    expect(realPeers.some((id: string) => t.botIds.includes(id))).toBe(false);
    const guestPeers = (await guest.get("/api/peers")).body.peers.map((p: { userId: string }) => p.userId);
    expect(guestPeers).not.toContain(real.id);

    // And they can't message each other.
    await guest.post(`/api/conversations/${real.id}/messages`).send({ body: "hi" }).expect(404);
    await real.agent.post(`/api/conversations/${g.id}/messages`).send({ body: "hi" }).expect(404);

    // Real users can't enter demo rooms.
    const demoRoom = (await guest.get("/api/rooms")).body.rooms[0].code;
    await real.agent.post(`/api/rooms/${demoRoom}/join`).expect(404);
  });

  it("turns off file sharing for guests", async () => {
    const guest = request.agent(t.app);
    await guest.post("/api/auth/demo").expect(201);
    await guest.post("/api/uploads").attach("file", PNG, { filename: "a.png", contentType: "image/png" }).expect(403);
  });

  it("keeps the public stats counter to real students only", async () => {
    const before = (await request(t.app).get("/api/stats")).body.studyingNow;
    expect(typeof before).toBe("number");
    // Seven bots are live but none of them count.
    expect(before).toBeLessThan(t.botIds.length);
  });
});

describe("course search", () => {
  it("finds courses however they're typed", async () => {
    const res = await request(t.app).get("/api/courses?q=comp 25");
    expect(res.body.courses).toContain("COMP 251");
    expect((await request(t.app).get("/api/courses?q=COMP251")).body.courses[0]).toBe("COMP 251");
  });
});
