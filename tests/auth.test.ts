import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setup } from "./helpers.js";

let t: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => (t = await setup()));
afterAll(() => t.close());

describe("signup and verification", () => {
  it("only accepts McGill emails", async () => {
    const res = await request(t.app)
      .post("/api/auth/signup")
      .send({ name: "Outsider", email: "someone@gmail.com", password: "long enough pw" });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/mail\.mcgill\.ca/);
  });

  it("requires a verified email before using the app", async () => {
    const agent = request.agent(t.app);
    const email = "pending.user@mail.mcgill.ca";
    const signup = await agent.post("/api/auth/signup").send({ name: "Pending", email, password: "long enough pw" });
    expect(signup.status).toBe(201);
    expect(signup.body.needsVerification).toBe(true);
    expect(signup.headers["set-cookie"]?.[0]).toMatch(/HttpOnly/i);

    await agent.get("/api/peers").expect(403);
    await agent.post("/api/auth/verify").send({ code: "000000" }).expect(400);
    await agent.post("/api/auth/verify").send({ code: t.lastCode(email) }).expect(200);
    await agent.get("/api/peers").expect(200);
  });

  it("burns a code after too many wrong guesses", async () => {
    const agent = request.agent(t.app);
    const email = "guesser@mail.mcgill.ca";
    await agent.post("/api/auth/signup").send({ name: "Guesser", email, password: "long enough pw" }).expect(201);
    const right = t.lastCode(email);
    const wrong = right === "111111" ? "222222" : "111111";
    for (let i = 0; i < 5; i++) await agent.post("/api/auth/verify").send({ code: wrong }).expect(400);
    // Even the right code no longer works.
    await agent.post("/api/auth/verify").send({ code: right }).expect(400);
  });

  it("rejects signing up twice with a verified email", async () => {
    const s = await t.student("Repeat Person");
    const res = await request(t.app).post("/api/auth/signup").send({ name: "X", email: s.email, password: "long enough pw" });
    expect(res.status).toBe(409);
  });

  it("never stores passwords or session tokens in plain text", async () => {
    const s = await t.student("Hash Check");
    const user = await t.db.one<{ password_hash: string }>("select password_hash from users where id = $1", [s.id]);
    expect(user!.password_hash).toMatch(/^\$2[aby]\$12\$/);
    const sessions = await t.db.query<{ id: string }>("select id from auth_sessions where user_id = $1", [s.id]);
    expect(sessions[0]!.id).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("login, logout and password reset", () => {
  it("logs in with the right password only, with the same error for unknown emails", async () => {
    const s = await t.student("Login Person");
    const wrong = await request(t.app).post("/api/auth/login").send({ email: s.email, password: "nope nope nope" });
    const unknown = await request(t.app)
      .post("/api/auth/login")
      .send({ email: "ghost@mail.mcgill.ca", password: "nope nope nope" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);

    const agent = request.agent(t.app);
    await agent.post("/api/auth/login").send({ email: s.email.toUpperCase(), password: "correct horse battery" }).expect(200);
    await agent.get("/api/check-in").expect(200);
    await agent.post("/api/auth/logout").expect(200);
    await agent.get("/api/check-in").expect(401);
  });

  it("resets a password with an emailed code and signs out other devices", async () => {
    const s = await t.student("Forgetful Person");
    await request(t.app).post("/api/auth/password/forgot").send({ email: s.email }).expect(200);
    const code = t.lastCode(s.email);
    await request(t.app)
      .post("/api/auth/password/reset")
      .send({ email: s.email, code, password: "brand new password" })
      .expect(200);

    await s.agent.get("/api/check-in").expect(401); // old session revoked
    await request(t.app).post("/api/auth/login").send({ email: s.email, password: "brand new password" }).expect(200);
  });

  it("answers forgot-password the same way for unknown emails", async () => {
    const res = await request(t.app).post("/api/auth/password/forgot").send({ email: "nobody@mail.mcgill.ca" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe("security headers and CSRF", () => {
  it("blocks writes from another website", async () => {
    const s = await t.student("Csrf Target");
    await s.agent.put("/api/check-in").set("Origin", "https://evil.example").send({ courseCode: "COMP 251" }).expect(403);
  });

  it("sends a content security policy", async () => {
    const res = await request(t.app).get("/api/health");
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
  });
});
