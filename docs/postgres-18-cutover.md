# Moving the database to PostgreSQL 18

The shared Match plan uses Neon Realtime, which runs only on PostgreSQL 18. The app's Neon project, `rolling-sparks`, is on PostgreSQL 17, and Neon can't upgrade a project in place. So the app database moves to a new Neon project, `rolling-sparks-pg18`. This page is the checklist for that move. It ran against production on November 1, 2026, as recorded at the end of this page.

There are no DNS changes. The site stays on Vercel at www.rollingsparks.org. The move itself is a short write freeze, a copy, two environment variable edits, and a redeploy.

## What exists now

| | Old project | New project |
|---|---|---|
| Name and id | `rolling-sparks` (`odd-resonance-62813161`) | `rolling-sparks-pg18` (`lingering-glade-24452823`) |
| PostgreSQL | 17 | 18 |
| Serves production | No. Read-only since the cutover | Yes, since November 1, 2026 |
| `main` branch | Production data as of the freeze | Production data |
| Other branches | | `match-plan-shared`, used by the shared Match plan preview and local development |
| Realtime | Not available | On for `main` and `match-plan-shared` |
| Logical replication | Off | On (Realtime needs it) |

Both projects are in AWS us-east-1 with the same compute range (0.25 to 8 CU).

**What moves.** Everything in the `public` and `drizzle` schemas: accounts, sessions, the journal, missions, programs, the team project, and the migration history. Sessions are copied and `BETTER_AUTH_SECRET` doesn't change, so nobody gets signed out.

**What stays on the old project.** Object storage, which holds every uploaded photo, video, and program file. The database stores only object keys, so files keep working. The `AWS_*` and `NEON_STORAGE_BUCKET` variables don't change. This is why the old project must not be deleted.

**What isn't copied.** The `neon_auth` schema. The app signs people in through its own Better Auth tables, and no code reads `NEON_AUTH_BASE_URL`.

## Before you start

- PostgreSQL 18 client tools (`psql`, `pg_dump`, `pg_restore`). The script looks in `/usr/lib/postgresql/18/bin`. Anywhere else, set `PG_BIN`. On a Mac, `brew install postgresql@18` and `PG_BIN=$(brew --prefix postgresql@18)/bin`.
- Three connection strings from Neon Console > project > **Connect**, branch `main`, database `neondb`, role `neondb_owner`:
  - old project with connection pooling off, used as `OLD_DATABASE_URL_DIRECT`
  - new project with pooling off, used as `NEW_DATABASE_URL_DIRECT` and for Vercel's `DATABASE_URL_DIRECT`
  - new project with pooling on, for Vercel's `DATABASE_URL`
- The new project's Realtime URL and secret for branch `main`. They're on Neon Console > `rolling-sparks-pg18` > **Postgres database** > **Realtime**, or run `neon env pull --service realtime` in a directory linked to that project.
- About 20 minutes when nobody is using the site, with no pull requests merging. The copy takes under a minute because the database is about 10 MB.

Keep the connection strings and the Realtime secret out of git, chat, and screenshots.

## Cutover

### 1. Freeze writes on the old database

The freeze stops people from saving changes that the copy would miss. These commands make new transactions read-only and end the sessions that are open now:

```bash
psql "$OLD_DATABASE_URL_DIRECT" \
  -c "ALTER DATABASE neondb SET default_transaction_read_only = on" \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname = 'neondb' AND pid <> pg_backend_pid() AND usename = current_user"
```

Until step 4 finishes, the site still shows everything, but anything that saves fails, including signing in. Rollback undoes the freeze.

### 2. Copy and compare

```bash
OLD_DATABASE_URL_DIRECT='…' NEW_DATABASE_URL_DIRECT='…' \
CONFIRM_OVERWRITE='<new host>' scripts/copy-to-postgres-18.sh
```

Run it once without `CONFIRM_OVERWRITE` first. It refuses and prints the host to confirm, which should start with `ep-patient-king`. The script also refuses a pooled connection string, a source that isn't PostgreSQL 17, and a target that isn't 18.

It must finish with `Copied 23 tables to … Row counts and content hashes match.` If it prints anything else, stop and unfreeze (Rollback step 2). Vercel hasn't changed yet, so nothing else needs undoing.

### 3. Point Vercel at the new database

In Vercel, open the `rolling-sparks` project > **Settings** > **Environment Variables**. The old values don't need saving, because the old project's Connect dialog always shows them.

| Variable | Change | Environments |
|---|---|---|
| `DATABASE_URL` | Edit to the new pooled string | Production, Preview, Development (one shared variable) |
| `DATABASE_URL_DIRECT` | Edit to the new direct string | Production, Preview, Development (one shared variable) |
| `NEON_REALTIME_URL` | Add | Production, Preview, Development |
| `NEON_REALTIME_SECRET` | Add, marked **Sensitive** | Production, Preview |

Preview deployments keep sharing the production database, as they do today. Today's code doesn't read the two Realtime variables. The shared Match plan pull request does, and adding them now lets it merge without another environment change. `NEON_REALTIME_SECRET` must never get a `NEXT_PUBLIC_` prefix.

### 4. Redeploy production

Open Vercel > **Deployments**, then the current production deployment > **Redeploy**. Environment changes reach only new deployments. The build runs `drizzle-kit migrate` against the new database, which has nothing to apply, and then builds the app.

### 5. Check the site

On www.rollingsparks.org:

- Reload. You should still be signed in.
- Open the Journal, then open a photo or video from the Gallery.
- Download a program file.
- Save something small, such as a mission note, and reload to see that it stayed.
- In Neon Console, the new project's **Monitoring** shows connections. After a few minutes, the old one shows none.

If any of these fail, roll back.

### 6. Tidy up

- Delete the two preview variables scoped to branch `cursor/postgres-18-cutover-c2a6` (`DATABASE_URL` and `DATABASE_URL_DIRECT`). They existed only for the rehearsal.
- Keep the four variables scoped to `cursor/match-plan-shared-c2a6` until that pull request merges, then delete them.
- Leave the old database frozen. Its object storage keeps serving files, and the freeze stops any stale deployment from writing there.
- Don't run the copy script again. From step 4 on, the new database is production, and the script would overwrite it.

## Rollback

Until someone saves on the new database, rolling back loses nothing.

1. Set `DATABASE_URL` and `DATABASE_URL_DIRECT` back to the old project's strings.
2. Unfreeze the old database. A plain `ALTER DATABASE … RESET` fails while the database is read-only, so turn read-only off for the session first:

   ```bash
   psql "$OLD_DATABASE_URL_DIRECT" \
     -c "SET default_transaction_read_only = off" \
     -c "ALTER DATABASE neondb RESET default_transaction_read_only"
   ```

3. Redeploy production.

After people have saved on the new database, rolling back leaves those changes behind. The script copies only from 17 to 18, so moving them back would be manual.

## What can't be undone

- Logical replication on the new project. Realtime needs it, Neon can't turn it off, and it's already on. It doesn't touch the old project.
- Deleting the old project. That would delete every uploaded file. It isn't part of this move, and it should happen only after object storage moves, which is separate work.

You can undo the switch itself until people start saving on the new database.

## Cost

Both projects bill for storage while they coexist. Once production stops connecting, the old project's compute suspends when idle, and it costs only storage plus the transfer for files it serves. Realtime is free during its beta.

## Merge order

1. The cutover, done November 1, 2026. Merging the pull request that adds this page changes nothing at runtime.
2. Merge the Match plan page, https://github.com/meritw/fll/pull/49.
3. Merge the shared Match plan pull request. Its migration creates the `match_plan` table on the new database, and it needs the Realtime variables from step 3. Don't merge it before the cutover.

## What the rehearsal covered

- Two copies of production onto the new `main` matched on all 23 tables by row count and content hash. The script refused to run without `CONFIRM_OVERWRITE` and refused a target with tables the source lacks.
- The app built and ran on a PostgreSQL 18 copy. Sign-in and every page loaded.
- This branch's Vercel preview ran against the new `main` with the real storage settings. Sign-in, the main pages, a journal photo, a program file download, and the team project download all worked.
- The freeze and unfreeze commands ran on a PostgreSQL 18 branch. The database refused writes, the freeze ended an open session, `pg_dump` still worked, and unfreezing needed the session override shown above.

## How the cutover went

Times are UTC on November 1, 2026. The copy script ran from branch `cursor/postgres-18-cutover-c2a6`.

| Time | Step | Result |
|---|---|---|
| 21:38:42 | 1. Freeze | One idle session ended. A test write was refused. |
| 21:38:51 | 2. Copy | All 23 tables matched by row count and content hash. |
| 21:41:38 | 3. Vercel | `DATABASE_URL` and `DATABASE_URL_DIRECT` point at the new project. `NEON_REALTIME_URL` and `NEON_REALTIME_SECRET` were added. |
| 21:42:52 | 4. Redeploy | Production went live on the new database. `drizzle-kit migrate` had nothing to apply. |
| 21:45:27 | 5. Checks | Sign-in through the login form, the main pages, a journal photo, a program download, and the team project download all worked on www.rollingsparks.org. Signing in saved a session to the new database. |

The checks used a temporary coach account, `cursorverify`, which was deleted right after. Every table is back to its copied row count. Production has logged no new errors since the switch.

The two preview variables for branch `cursor/postgres-18-cutover-c2a6` are still in Vercel. They now hold the same values as the shared variables, so they change nothing, but they should still be deleted.
