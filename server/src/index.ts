import { createServer } from "node:http";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import type { AppContext } from "./context.js";
import { migrate } from "./db/migrate.js";
import { createDb } from "./db/pool.js";
import { createMailer } from "./lib/email.js";
import { logger } from "./logger.js";
import { attachRealtime, noopRealtime } from "./realtime/index.js";
import { cleanupDemoVisitors, ensureDemoBots } from "./services/demo.js";

async function main() {
  const config = loadConfig();
  const db = createDb(config.DATABASE_URL);

  // Apply any pending schema changes before taking traffic.
  const applied = await migrate(db);
  if (applied.length) logger.info({ applied }, "Database migrated");

  const botIds = config.DEMO_ENABLED ? await ensureDemoBots(db) : [];

  // The realtime layer needs the HTTP server, and the routes need the realtime
  // layer, so the context starts with a placeholder that is swapped in below.
  const ctx: AppContext = { config, db, mailer: createMailer(config), realtime: noopRealtime() };
  const server = createServer(createApp(ctx));
  const realtime = attachRealtime(server, ctx, botIds);
  ctx.realtime = realtime.realtime;

  const sweep = async () => {
    try {
      await db.query("delete from auth_sessions where expires_at < now()");
      await db.query("delete from email_codes where expires_at < now() - interval '1 day'");
      const removed = await cleanupDemoVisitors(db);
      if (removed) logger.info({ removed }, "Removed expired demo guests");
    } catch (err) {
      logger.error({ err }, "Cleanup failed");
    }
  };
  void sweep();
  const sweepTimer = setInterval(sweep, 60 * 60_000);

  server.listen(config.PORT, () => {
    logger.info(`myPeers API listening on http://localhost:${config.PORT}`);
  });

  // Railway sends SIGTERM on redeploy: stop accepting connections, save room state, close the DB.
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down");
    clearInterval(sweepTimer);
    await realtime.close();
    await db.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "Failed to start");
  process.exit(1);
});
