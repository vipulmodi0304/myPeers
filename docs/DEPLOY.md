# Deploying to Railway

myPeers runs as **one service** (Node serves the API, the WebSocket server and the built React app) plus **one Postgres database**. These steps add both to an existing Railway project.

> Use a **new** Postgres for myPeers. Don't point it at another app's database.

## 1. Add a database

In the project: **New → Database → PostgreSQL**. Rename it to something clear like `mypeers-db`.

## 2. Add the app

**New → GitHub Repo → `mypeers`**. Railway finds `railway.json` and builds with the `Dockerfile`. The first deploy will fail until the variables below are set; that's expected.

## 3. Give it a public URL

Open the service → **Settings → Networking → Generate Domain**. Copy the URL (for example `https://mypeers-production.up.railway.app`).

## 4. Set variables

Service → **Variables**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{mypeers-db.DATABASE_URL}}` (a reference to the database from step 1; Railway autocompletes it) |
| `NODE_ENV` | `production` |
| `APP_URL` | the URL from step 3, with `https://` and no trailing slash |
| `UPLOAD_DIR` | `/app/uploads` |
| `REQUIRE_EMAIL_VERIFICATION` | `false` only until step 6 is done. **Must be `true` before real students sign up.** |
| `ADMIN_EMAIL` | your own inbox; reports made with the **Report** button are emailed here (needs step 6) |

`PORT` is set by Railway automatically.

## 5. Keep uploaded files across deploys

Without a volume, chat attachments are lost on every redeploy. Service → **Attach volume** (or right-click the service), mount path **`/app/uploads`**.

## 6. Turn on email verification (required before launch)

Railway blocks outbound SMTP on most plans, so myPeers sends email through an HTTP API instead.

**Brevo** (free tier, works without owning a domain):
1. Create a Brevo account and add your email as a **verified sender**.
2. Create an API key (SMTP & API → API keys).
3. Set:
   - `EMAIL_PROVIDER` = `brevo`
   - `EMAIL_API_KEY` = your key
   - `EMAIL_FROM` = the verified sender address
   - `REQUIRE_EMAIL_VERIFICATION` = `true`

Resend works too (`EMAIL_PROVIDER=resend`), but it needs a domain you own to email other people.

If verification is on but no provider is configured, the server refuses to start and tells you why, so signups can never get stuck.

## 7. Check it

- `https://<your-domain>/api/health` should return `{"ok":true}`.
- Open the site and press **Try the demo**.
- The database schema is created on first boot, and new migrations run automatically on each deploy.

## Before you invite real students

- **Turn email verification on** (step 6). With it off, anyone can sign up as any McGill address without proving they own it.
- **Keep it at one instance.** Who's online, room state and rate limits live in the server's memory. `railway.json` pins the replica count to 1; don't raise it. One instance comfortably handles a few hundred students.
- **Set `ADMIN_EMAIL`** so reports reach you. They are also saved in the `reports` table (`select * from reports order by created_at desc`).
- **Turn on database backups.** Railway → the Postgres service → **Backups** → enable a daily schedule. The upload volume can be backed up the same way.
- **Watch the logs for the first evening.** Anything logged at `error` level is a bug or an outage; requests answered with `429` mean someone hit a rate limit.

The service restarts itself after a crash (`restartPolicyType: ALWAYS` in `railway.json`), and it keeps running through a database restart.

## Housekeeping the server does by itself

Every hour it removes expired sessions and email codes, demo guests older than a day, rooms nobody is a member of any more, files that were uploaded but never sent, and files whose owner deleted their account.

## Optional

- `DEMO_ENABLED=false` hides the demo.
- `MAX_UPLOAD_MB` (default 10) caps file size.
- `LOG_LEVEL=debug` for more detail in Railway's logs.
