import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createDb, type Db } from "./pool.js";

/**
 * Minimal migration runner: applies server/migrations/*.sql in filename order,
 * each inside a transaction, and records it in schema_migrations so it never
 * runs twice. A Postgres advisory lock stops two instances migrating at once.
 */
export async function migrate(db: Db, dir = path.resolve("server/migrations")): Promise<string[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];

  await db.transaction(async (tx) => {
    await tx.query("select pg_advisory_xact_lock(742001)");
    await tx.query(
      "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const done = new Set((await tx.query<{ name: string }>("select name from schema_migrations")).map((r) => r.name));
    for (const file of files) {
      if (done.has(file)) continue;
      await tx.query(await readFile(path.join(dir, file), "utf8"));
      await tx.query("insert into schema_migrations (name) values ($1)", [file]);
      applied.push(file);
    }
  });
  return applied;
}

// Run directly: `npm run db:migrate` (dev) or `node dist/server/db/migrate.js` (prod).
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  const db = createDb(url);
  migrate(db)
    .then((applied) => console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database is up to date"))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exitCode = 1;
    })
    .finally(() => db.close());
}
