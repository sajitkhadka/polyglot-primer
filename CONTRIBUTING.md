# Contributing

Thanks for helping. The most valuable contributions are **corrections** (a wrong claim in a comparison is worse
than a missing one) and **new chapters**. Code changes to the site are welcome too, but keep it small: the
project deliberately has one runtime dependency.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Chapters are contributed under
[CC BY-SA 4.0](LICENSE-CONTENT.md) and code under the [MIT license](LICENSE).

## Setup

```
npm install
npm test
npm start      # http://localhost:4321
```

Node 20 or newer. Run `npm test` before opening a pull request; CI runs the same command.

## Writing or changing a chapter

A chapter is one Markdown file, `chapters/NN-short-name.md`. The linter in `test/chapters.test.js` enforces
the shape, so `npm test` tells you what is missing.

- `# Chapter N: Title` once at the top, then a `>` paragraph that summarises it. That paragraph becomes the
  page's meta description, so make it a good one (under about 160 characters reads best).
- Every `##` heading is a **topic** with its own "I understand this" checkbox, note box and search entry.
  Use `##` only for real topics, and `###` for sub-sections.
- Required sections: a comparison table, **Quirks and gotchas**, **What is idiomatic**, **Checklist** (unchecked
  `- [ ]` items) and **Exercises** (to do in each language).
- Show all four languages for a concept, in fences tagged `go`, `java`, `js` and `python`. If a language has no
  equivalent, say so; that is useful information. Features only one language has deserve their own chapter.
- **Scope:** core language and standard library only. No frameworks or third-party packages.
- **Versions:** Go 1.22+, Java 21, ES2023 / Node 22, Python 3.12. Say so when a feature needs something newer
  or is still a preview.
- **Accuracy:** run the snippets you add. If a claim depends on a version or a platform, name it.
- In tables, write a literal pipe as `\|`.
- Do not rename a chapter file or a `##` heading casually: progress and notes are stored under
  `<file>#<heading slug>`, so renaming orphans them for every user.

The renderer is intentionally small. It supports headings, tables, fenced code, blockquotes, nested lists, task
items, bold, italic, inline code and links. If you need another Markdown feature, add it to `web/markdown.js`
**and** teach `parseBlocks` in `web/search.js` about it, with tests.

## Changing the site

- `web/markdown.js` is shared by the build and the browser; `scripts/build.js` produces `public/`.
- `server.js` is the only server. API changes need a test in `test/server.test.js`.
- The Postgres store has a test that runs when `TEST_DATABASE_URL` points at a scratch database:
  `TEST_DATABASE_URL=postgres://user:pass@localhost:5432/scratch npm test`.
- Please do not add dependencies without discussing it in an issue first.

## Pull requests

Keep them focused, explain what changed and why, and link the issue if there is one. For a chapter, say how you
verified the code samples. Small fixes (typos, a wrong claim) can go straight to a PR.
