# CLAUDE.md

Study material comparing Go, Java, JavaScript and Python, plus a web UI (search, notes, progress). Repo: sajitkhadka/polyglot-primer (private).

## Run

`node server.js` (port 4321; `PORT`, `HOST`, `DATA_DIR`, `AUTH_PASSWORD` override). Zero dependencies - do not add any; the
UI's Markdown renderer is hand-written in `web/app.js`; search is `web/search.js` (loadable from Node with
`require`, so it can be exercised without a browser). There are no tests.

## Writing chapters

- File name `NN-short-name.md`; the server lists files matching `^\d+-.*\.md$` in order.
- `# Title` once at the top. Every `##` heading becomes a trackable topic, so only use `##` for real
  topics (including "Checklist" and "Exercises"). Use `###` for sub-sections.
- Progress ids are `<file>#<slug of heading>`. **Renaming a chapter file or a `##` heading orphans the
  saved progress for that topic.** `slugify()` must stay identical in `server.js` and `web/app.js`.
- Required shape: comparison table, code in all four languages (fences tagged `go`, `java`, `js`,
  `python`), Quirks and gotchas, What is idiomatic, Checklist, Exercises.
- Scope: core language and stdlib only. No frameworks or third-party libraries.
- Renderer supports: headings, tables (escape `|` inside cells as `\|`), fenced code, blockquotes, nested
  lists, task-list items, bold, italic, inline code, links. Nothing else (no images, no HTML).
- Versions: Go 1.22+, Java 21, ES2023/Node 22, Python 3.12. Mark newer-version features as such.

## Constraints

- `progress.json` and `notes.json` are the user's personal state and are gitignored. Never edit or delete
  them unasked. Note ids are `<file>#<slug>`, like progress ids, with the same rename caveat.
- Search blocks come from the same Markdown: a new Markdown construct added to the renderer must also be
  understood by `parseBlocks` in `web/search.js`.
- Deployment: tag `vX.Y.Z` -> `.github/workflows/deploy.yml` -> image tag committed to `k8s-config`
  (`polyglot-primer/`) -> manual Argo CD sync. Public via the Cloudflare tunnel (no Ingress), with the app's own password gate
  (`AUTH_PASSWORD`); `.env` holds the deployed password locally and is gitignored.
