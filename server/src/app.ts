import { existsSync } from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { z } from "zod";
import { loadUser, requireUser } from "./auth/sessions.js";
import type { AppContext } from "./context.js";
import { searchCourses } from "./lib/courses.js";
import { errorHandler, forbidden, notFound } from "./lib/errors.js";
import { logger } from "./logger.js";
import { authRoutes } from "./routes/auth.js";
import { checkInRoutes } from "./routes/checkins.js";
import { meRoutes } from "./routes/me.js";
import { messageRoutes } from "./routes/messages.js";
import { roomRoutes } from "./routes/rooms.js";
import { uploadRoutes } from "./routes/uploads.js";

export function createApp(ctx: AppContext) {
  const app = express();
  const { config } = ctx;
  const appOrigin = new URL(config.APP_URL).origin;

  app.disable("x-powered-by");
  app.set("trust proxy", 1); // Railway sits behind one proxy; needed for real client IPs in rate limits.

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", appOrigin.replace(/^http/, "ws")],
          imgSrc: ["'self'", "data:", "blob:"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", "data:"],
          frameSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: config.NODE_ENV === "production" ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  if (config.NODE_ENV !== "test") app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/api/health" } }));
  app.use(express.json({ limit: "64kb" }));

  // CSRF defence on top of SameSite=Lax cookies: browsers always send Origin on
  // cross-site writes, so reject any write whose Origin isn't our own site.
  app.use("/api", (req: Request, _res: Response, next: NextFunction) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (origin && origin !== appOrigin) return next(forbidden("Cross-site request blocked."));
    next();
  });

  app.use("/api", loadUser(ctx));

  // --- Public endpoints ---
  app.get("/api/health", async (_req, res) => {
    await ctx.db.query("select 1");
    res.json({ ok: true });
  });

  // Live number on the landing page. Real students only, demo bots don't count.
  app.get("/api/stats", async (_req, res) => {
    const rows = await ctx.db.query<{ user_id: string }>(
      "select c.user_id from check_ins c join users u on u.id = c.user_id where not u.is_demo",
    );
    res.json({ studyingNow: rows.filter((r) => ctx.realtime.isLive(r.user_id)).length, demoEnabled: config.DEMO_ENABLED });
  });

  app.get("/api/courses", (req, res) => {
    const q = z.string().max(20).catch("").parse(req.query.q);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json({ courses: searchCourses(q) });
  });

  app.use("/api/auth", authRoutes(ctx));

  // --- Everything below needs a signed-in, verified user ---
  const authed = requireUser(ctx);
  app.use("/api/me", authed, meRoutes(ctx));
  app.use("/api", authed, checkInRoutes(ctx)); // /api/check-in, /api/peers
  app.use("/api", authed, messageRoutes(ctx)); // /api/conversations/...
  app.use("/api/uploads", authed, uploadRoutes(ctx));
  app.use("/api/rooms", authed, roomRoutes(ctx));

  app.use("/api", (_req, _res, next) => next(notFound("No such API endpoint.")));

  // --- The React app (production build) ---
  const webDist = path.resolve("dist/web");
  if (existsSync(webDist)) {
    app.use(
      express.static(webDist, {
        index: false,
        setHeaders: (res, file) => {
          // Hashed asset filenames never change, so browsers can cache them forever.
          if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        },
      }),
    );
    // Client-side routing: any other page loads index.html and React Router takes over.
    app.get("/{*path}", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(webDist, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
