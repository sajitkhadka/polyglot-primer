# Polyglot Primer

**Go, Java, JavaScript and Python side by side.** A fast refresher for people who already program and want
the same concept compared across four languages: syntax tables, quirks, what is idiomatic in each, a checklist
of what you should know afterwards, and an exercise to do in every language. Core language and standard
library only: no frameworks, no third-party packages.

It is meant for the situation where you know some of these languages (say Java and JavaScript), use one daily
(Go) and want to pick up another (Python), and four separate tutorials would repeat the same ideas four times.

Assumed versions: **Go 1.22+, Java 21, JavaScript (ES2023, Node 22), Python 3.12.**

## Chapters

| # | Chapter | Covers |
| --- | --- | --- |
| 1 | [Program Basics](chapters/01-program-basics.md) | Hello world, running code, entry points, comments, naming, formatting |
| 2 | [Variables, Constants and Types](chapters/02-variables-and-types.md) | Declarations, scope, numeric types, zero values, conversion, truthiness, equality, operators |
| 3 | [Strings and Text](chapters/03-strings-and-text.md) | Encoding, formatting, common operations, slicing, bytes, regex |
| 4 | [Control Flow](chapters/04-control-flow.md) | if, loops, labels, switch/match, ternaries |
| 5 | [Functions](chapters/05-functions.md) | Multiple returns, defaults, variadics, closures, first-class functions, passing semantics |
| 6 | [Collections](chapters/06-collections.md) | Arrays, lists/slices, maps, sets, sorting, comprehensions, copying |

**Planned:** structs, classes and objects; interfaces and inheritance; error handling; generics; concurrency;
packages and modules; files and I/O; a standard library tour; testing; memory and the garbage collector; and
a chapter per language for the features only it has (goroutines and `defer`, checked exceptions and sealed
types, prototypes and the event loop, decorators and generators). See [CONTRIBUTING.md](CONTRIBUTING.md) if
you would like to write one.

Every chapter has the same shape: a comparison table, one `##` section per topic with code in all four
languages, **Quirks and gotchas**, **What is idiomatic**, a **Checklist** and **Exercises**.

## The study site

The chapters are plain Markdown and read fine on GitHub. The repository also contains a small web app that
renders them as fast, searchable pages:

- **Search** (press `/`): across text, code samples, table rows and your own notes. Name a language to narrow
  it: `go looping`, `python slicing`, `java switch`.
- **Progress**: tick "I understand this" on any topic; opening the site resumes at the first topic you have
  not finished.
- **Notes** on every topic.
- **Phone friendly**: the sidebar becomes a slide-in menu.
- Every chapter is a real, pre-rendered HTML page with its own title, description, canonical URL, Open Graph
  tags and structured data, plus `sitemap.xml` and `robots.txt`, so it can be found and shared.

### Run it locally

Requires Node 20+.

```
npm install
npm start          # builds public/ then serves http://localhost:4321
```

Locally there is no login: progress and notes are saved as `progress.json` and `notes.json` in the project
folder (gitignored). To reset, delete them.

### Run it as a public site

Set `GOOGLE_CLIENT_ID` and `DATABASE_URL` and the same server becomes multi-user: chapters stay public, and
progress and notes belong to each signed-in Google account, stored in Postgres. Everything is documented in
[docs/deployment.md](docs/deployment.md), including the Docker image, environment variables, and the privacy
page the build generates.

## Development

```
npm test           # chapter linter, renderer, search, token verification, build output, server API
npm run build      # writes the site to public/ (SITE_URL sets canonical URLs and the sitemap)
```

There is exactly one runtime dependency (`pg`, loaded only when `DATABASE_URL` is set). Layout:

```
chapters/       the content: one Markdown file per chapter
web/            browser code: Markdown renderer (shared with the build), search, UI, styles
scripts/        build.js: pre-renders every page, sitemap, robots, chapter index
server.js       static files + the small JSON API (sessions, progress, notes)
store.js        file store (local) and Postgres store (deployed)
google-auth.js  verifies Google ID tokens with node:crypto
test/           node:test suites
docs/           deployment and privacy documentation
```

## License

Code: [MIT](LICENSE). Written chapters: [CC BY-SA 4.0](LICENSE-CONTENT.md).
