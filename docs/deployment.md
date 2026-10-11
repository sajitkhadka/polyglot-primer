# Deploying Polyglot Primer

The site is a static, pre-rendered set of pages plus a tiny Node server. You can run it three ways:

| Mode | Needs | What you get |
| --- | --- | --- |
| **Local** (`npm start`) | Node 20+ | Everything, no login; progress and notes in JSON files |
| **Read-only public site** | Any static host, after `npm run build` | The chapters, search, SEO pages. No progress or notes (those need the server) |
| **Full public site** | The container (or Node), Postgres, a Google OAuth client | Chapters public; per-account progress and notes |

## Configuration

All configuration is environment variables.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` / `HOST` | `4321` / `127.0.0.1` (container: `8080` / `0.0.0.0`) | Where the server listens |
| `DATA_DIR` | project folder (container: `/data`) | Where `session.key` (and, without a database, the JSON files) are written |
| `GOOGLE_CLIENT_ID` | unset | Turns on Google sign-in and the login gate. **Requires `DATABASE_URL`** |
| `ANALYTICS_SCRIPT_URL`, `ANALYTICS_WEBSITE_ID` | unset | Optional cookieless visitor counter (Umami). Set both or neither; the URL must be https. Adds only that script and its origin to the Content-Security-Policy |
| `DATABASE_URL` | unset | Postgres connection string. Tables are created on start |
| `ALLOWED_EMAILS` | unset | Optional comma-separated allowlist. Empty means any Google account may sign in |
| `SESSION_SECRET` | random, kept in `DATA_DIR/session.key` | Signing key for session cookies. Set it if you run several instances or have no persistent volume; changing it signs everyone out |

Build-time (used by `npm run build` and the Dockerfile `ARG`s):

| Variable | Meaning |
| --- | --- |
| `SITE_URL` | Public origin, e.g. `https://primer.example.com`. Used for canonical URLs, Open Graph tags and `sitemap.xml`. **Set it, or search engines will see `localhost`** |
| `REPO_URL` | Optional. Adds Source and License links to the sidebar footer |

## 1. Google sign-in

1. In Google Cloud Console create an **OAuth client ID** of type *Web application*.
2. Add your site's origin (e.g. `https://primer.example.com`, plus `http://localhost:4321` for local testing) under
   **Authorized JavaScript origins**.
3. Use the client ID as `GOOGLE_CLIENT_ID`.

That is all. The site uses the ID-token flow (Google Identity Services), so there is **no client secret and no
redirect URI**. The server checks each token's signature, issuer, audience, expiry and verified email itself.
If you see "origin_mismatch" the origin is missing from the client's list (changes can take a few minutes).

## 2. Postgres

Create an empty database and a role that owns it:

```sql
CREATE ROLE polyglot_primer LOGIN PASSWORD '...';
CREATE DATABASE polyglot_primer OWNER polyglot_primer;
```

```
DATABASE_URL=postgres://polyglot_primer:...@db-host:5432/polyglot_primer?sslmode=disable
```

Use `sslmode=require` if the database is not on a trusted network. On start the server creates three tables
(`users`, `progress`, `notes`; progress and notes cascade-delete with the user). The footprint is tiny, so a
shared Postgres instance is fine. Back the database up like any other: notes are the only data that cannot be
regenerated.

## 3. Container

```
docker build --build-arg SITE_URL=https://primer.example.com \
             --build-arg REPO_URL=https://github.com/you/polyglot-primer \
             -t polyglot-primer .

docker run -d --name polyglot-primer -p 8080:8080 \
  -v polyglot-primer-data:/data \
  -e GOOGLE_CLIENT_ID=... \
  -e DATABASE_URL=postgres://... \
  polyglot-primer
```

The image runs as the unprivileged `node` user and exposes `GET /healthz`. Mount `/data` so `session.key`
survives restarts (otherwise sessions end whenever the container is recreated, unless you set `SESSION_SECRET`).

## 4. Behind a proxy or tunnel

- Terminate TLS in front of the app. The session cookie is marked `Secure` only when the request carries
  `X-Forwarded-Proto: https` (Cloudflare, nginx and most ingress controllers add it).
- For login throttling the app uses `CF-Connecting-IP`, then `X-Forwarded-For`, then the socket address. Only expose
  the container through a proxy you trust to set those headers; do not publish the container port directly if
  you rely on per-IP throttling.
- Run **one replica**. The login and write rate limits are in memory.

## 5. After deploying

- `curl https://your-site/api/session` should show `"required":true` and your client ID. If it shows
  `"required":false`, the Google variables did not reach the container and **the site has no login**.
- Submit `https://your-site/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
- Check a chapter's link preview with a social-card debugger; the cards are text only (no image).

## Operating notes

- **Privacy page**: the build generates `/privacy/` from `docs/privacy.md`. Edit it to match how you run the
  site (log retention, contact details) before publishing.
- **Account deletion** is built in (sidebar, "Delete my data"); it removes the user row and, by cascade, all of
  their progress and notes.
- **Static hosting only?** Run `SITE_URL=... npm run build` and publish `public/`. Progress, notes and sign-in
  call `/api/*`, which a static host does not have; the pages degrade to read-only.
