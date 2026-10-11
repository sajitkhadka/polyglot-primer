# CLAUDE.md

Study material comparing Go, Java, JavaScript and Python, plus a small web app (pre-rendered pages, search,
notes, progress, optional Google sign-in with Postgres). Public-facing documents: README.md, CONTRIBUTING.md,
docs/deployment.md. This file is the short version for agents.

## Commands

- `npm install`, `npm test` (node:test, no framework), `npm run build` (writes `public/`), `npm start`
  (build + serve on :4321). Node 20+.
- One runtime dependency, `pg`, loaded only when `DATABASE_URL` is set. Do not add dependencies; the Markdown
  renderer (`web/markdown.js`), search (`web/search.js`) and Google token check (`google-auth.js`) are
  hand-written on purpose.
- Chapter linter: `test/chapters.test.js` enforces the chapter shape. Run the tests after editing a chapter.

## How it fits together

- `scripts/build.js` pre-renders `chapters/*.md` into `public/` (a page per chapter, landing, privacy,
  sitemap, robots, `chapters.json`, `md/` copies for search). `SITE_URL` sets canonical URLs.
- `server.js` serves `public/` and the JSON API. Local run: no login, JSON files via `FileStore`. With
  `GOOGLE_CLIENT_ID` (+ `DATABASE_URL`) it is multi-user: Google ID token -> session cookie -> `PgStore`.
- `web/app.js` only enhances the static pages (checkboxes, notes, search, sign-in). `web/markdown.js` is shared
  by the build and the browser: change it in one place.

## Writing chapters

- File `NN-short-name.md`, matching `^\d+-.*\.md$`. `# Chapter N: Title`, then a `>` summary paragraph (it becomes
  the meta description, keep it under ~160 chars).
- Every `##` heading is a trackable topic. Progress and note ids are `<file>#<slug of heading>`.
  **Renaming a chapter file or a `##` heading orphans every user's saved progress and notes for it.**
- Required: comparison table, code for all four languages (fences `go`, `java`, `js`, `python`), Quirks and
  gotchas, What is idiomatic, Checklist (`- [ ]`), Exercises. Core language and stdlib only.
- Versions: Go 1.22+, Java 21, ES2023/Node 22, Python 3.12. Say so for anything newer or preview.
- Renderer supports headings, tables (write `|` in a cell as `\|`), fences, blockquotes, nested lists, task items,
  bold, italic, inline code, links. A new construct must also be handled by `parseBlocks` in `web/search.js`.

## Constraints

- `progress.json`, `notes.json`, `session.key`, `.env` and `public/` are gitignored. They hold personal state or
  generated output: never commit, edit or delete them unasked.
- Never derive the session key from public values (client id, hostname). It is random or `SESSION_SECRET`.
- Login mode must stay fail-closed: `GOOGLE_CLIENT_ID` without `DATABASE_URL` refuses to start. After any
  deployment change check `/api/session` shows `"required":true`.
- API writes require `Content-Type: application/json` (CSRF defence). Keep that when adding endpoints, and add
  a test in `test/server.test.js`.
- `.github/workflows/deploy.yml` is optional and driven entirely by repository variables/secrets; it must stay
  free of hostnames, IPs and registry addresses.
