import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../server/src/app.js";
import { attachRealtime } from "../server/src/realtime/index.js";
import { setup } from "./helpers.js";

/**
 * End-to-end check of the Socket.IO layer: a real HTTP server, real cookies,
 * and two connected clients.
 */
let t: Awaited<ReturnType<typeof setup>>;
let server: Server;
let url: string;
let closeRealtime: () => Promise<void>;
const sockets: Socket[] = [];

beforeAll(async () => {
  t = await setup({ APP_URL: "http://localhost:5173" });
  server = createServer(createApp(t.ctx));
  const rt = attachRealtime(server, t.ctx, t.botIds);
  t.ctx.realtime = rt.realtime;
  closeRealtime = rt.close;
  await new Promise<void>((r) => server.listen(0, r));
  url = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  sockets.forEach((s) => s.disconnect());
  await closeRealtime();
  await t.close();
});

function cookieOf(res: { headers: Record<string, unknown> }) {
  return String((res.headers["set-cookie"] as string[])[0]).split(";")[0]!;
}

async function socketFor(cookie: string) {
  const s = connect(url, { extraHeaders: { cookie }, transports: ["websocket"], forceNew: true });
  sockets.push(s);
  await new Promise<void>((resolve, reject) => {
    s.on("connect", () => resolve());
    s.on("connect_error", reject);
  });
  return s;
}

const next = <T>(s: Socket, event: string) => new Promise<T>((resolve) => s.once(event, resolve));

describe("realtime", () => {
  it("rejects sockets without a session", async () => {
    const s = connect(url, { transports: ["websocket"], forceNew: true });
    sockets.push(s);
    const err = await new Promise<Error>((resolve) => s.on("connect_error", resolve));
    expect(err.message).toBe("unauthorized");
  });

  it("pushes check-ins live, then shares a room's timer and whiteboard", async () => {
    const a = await t.student("Socket Alice");
    const b = await t.student("Socket Bob");
    // Log in again with a separate client to get a second session cookie for the socket.
    const login = (email: string) =>
      request(t.app).post("/api/auth/login").send({ email, password: "correct horse battery" });
    const aCookie = cookieOf(await login(a.email));
    const bCookie = cookieOf(await login(b.email));

    const sa = await socketFor(aCookie);
    const sb = await socketFor(bCookie);

    // Alice checks in; Bob's socket hears about it without polling.
    const upsert = next<{ name: string; courseCode: string }>(sb, "peer:upsert");
    await a.agent.put("/api/check-in").send({ courseCode: "COMP 251", topic: "A3" }).expect(200);
    expect(await upsert).toMatchObject({ name: "Socket Alice", courseCode: "COMP 251" });

    // Both enter the same study room.
    const { code } = (await a.agent.post("/api/rooms").send({ name: "Live room" })).body.room;
    await b.agent.post(`/api/rooms/${code}/join`).expect(200);
    const enterA = await sa.emitWithAck("room:enter", { code });
    const enterB = await sb.emitWithAck("room:enter", { code });
    expect(enterB.here.sort()).toEqual([a.id, b.id].sort());
    const roomId = enterA.roomId as string;

    // Alice starts the timer; Bob gets the same end time.
    const timer = next<{ timer: { endsAt: number }; by: { name: string } }>(sb, "timer:state");
    sa.emit("timer:action", { roomId, action: { type: "start" } });
    const state = await timer;
    expect(state.timer.endsAt).toBeGreaterThan(Date.now() + 24 * 60_000);
    expect(state.by.name).toBe("Socket Alice");

    // Alice draws; Bob receives the stroke.
    const stroke = next<{ stroke: { id: string; userId: string } }>(sb, "wb:stroke");
    sa.emit("wb:stroke", {
      roomId,
      stroke: { id: "stroke-test-1", tool: "pen", color: "#222222", size: 4, points: [[0.1, 0.1], [0.5, 0.5]] },
    });
    expect((await stroke).stroke).toMatchObject({ id: "stroke-test-1", userId: a.id });

    // A late joiner gets the board and the running timer.
    const again = await sb.emitWithAck("room:enter", { code });
    expect(again.strokes).toHaveLength(1);
    expect(again.timer.endsAt).toBe(state.timer.endsAt);
  });

  it("won't let you into a room you haven't joined", async () => {
    const owner = await t.student("Room Owner Rt");
    const outsider = await t.student("Outsider Rt");
    const { code } = (await owner.agent.post("/api/rooms").send({ name: "Private" })).body.room;
    const res = await request(t.app).post("/api/auth/login").send({ email: outsider.email, password: "correct horse battery" });
    const s = await socketFor(cookieOf(res));
    const ack = await s.emitWithAck("room:enter", { code });
    expect(ack.error).toBeTruthy();
  });
});
