# Polyglot Primer

A fast side-by-side refresher for **Go, Java, JavaScript and Python** - core language and standard library only, no frameworks, no third-party packages.

The idea: you already know some of these (Java, JS), use one daily (Go) and want to pick up another (Python). Instead of four separate tutorials, every chapter puts the same concept next to each other in tables and code, then calls out the quirks and says what is *idiomatic* in each language. Every chapter ends with a checklist of what you should have learned and an exercise to do in all four languages.

Assumed versions: **Go 1.22+, Java 21, JavaScript (ES2023, Node 22), Python 3.12**.

## Chapters

| # | Chapter | Covers |
| --- | --- | --- |
| 1 | [Program Basics](chapters/01-program-basics.md) | Hello world, running code, entry points, comments, naming, formatting |
| 2 | [Variables, Constants and Types](chapters/02-variables-and-types.md) | Declarations, scope, numeric types, zero values, conversion, truthiness, equality, operators |
| 3 | [Strings and Text](chapters/03-strings-and-text.md) | Encoding, formatting, common operations, slicing, bytes, regex |
| 4 | [Control Flow](chapters/04-control-flow.md) | if, loops, labels, switch/match, ternaries |
| 5 | [Functions](chapters/05-functions.md) | Multiple returns, defaults, variadics, closures, first-class functions, passing semantics |
| 6 | [Collections](chapters/06-collections.md) | Arrays, lists/slices, maps, sets, sorting, comprehensions, copying |

### Planned (not written yet)

7. Structs, classes and objects - 8. Interfaces, inheritance and polymorphism - 9. Error handling - 10. Generics - 11. Concurrency - 12. Packages and modules - 13. Files and I/O - 14. Standard library tour (time, JSON, math, text) - 15. Testing - 16. Memory, references and the garbage collector - 17+. **Language-only features**: Go (goroutines, channels, `defer`), Java (checked exceptions, annotations, sealed types), JavaScript (prototypes, event loop, `async/await`), Python (decorators, generators, context managers, dunder methods).

New chapters are just new `NN-name.md` files in `chapters/` - the web UI picks them up automatically.

## Chapter format

Each chapter follows the same shape so you can skim it:

1. A short intro and comparison table
2. One `##` section per **topic** with code in all four languages
3. **Quirks and gotchas**
4. **What is idiomatic**
5. **Checklist** - what you should know afterwards
6. **Exercises** - to do in each language

Each `##` heading is a topic that gets an "I understand this" checkbox in the web UI.


## Web interface

```
cd polyglot-primer
node server.js          # or: npm start
```

Open <http://localhost:4321>. Requires Node 18+; there are no dependencies to install.

- **Progress**: tick **I understand this** on any topic. On open, the site jumps to the **first chapter that still has an unchecked topic** and scrolls to that topic. When everything is ticked it opens the last chapter.
- **Search** (sidebar box, or press `/`): searches every chapter's text, code samples, table rows and your own notes. Put a language in the query to narrow it: `go looping`, `python slicing`, `java switch`. Close words match (`looping` finds loops, `for`, `range`, `while`), and if nothing matches every word it retries allowing one miss. Enter opens the best hit; arrow keys move through results.
- **Notes**: every topic has a **Note** button beside the checkbox that opens a text box. Notes autosave, and the box re-opens by itself when a note exists.
- **Phone**: below 800px the sidebar becomes a slide-in menu (the hamburger button); tables and code scroll sideways.
- **Storage**: `progress.json` and `notes.json` are written to `DATA_DIR` (default: this folder; both gitignored). Each tick or note is saved individually, so a phone and a PC can share one server without overwriting each other; a tab refreshes its state when you switch back to it.
- Deep links work: `http://localhost:4321/#03-strings-and-text.md`.

To reset, delete `progress.json` / `notes.json`. Environment variables: `PORT` (4321), `HOST` (127.0.0.1; the container uses 0.0.0.0), `DATA_DIR`, `AUTH_PASSWORD` (unset = no login; set = chapters stay public, progress and notes need a signed-in session).

## Deployment

Deployed to the home k3s cluster the same way as the other apps: pushing a `vX.Y.Z` tag runs `.github/workflows/deploy.yml` (self-hosted runner), which builds the image into the local registry and commits the new tag to the `k8s-config` repo (`polyglot-primer/`). Argo CD is on manual sync, so sync the `polyglot-primer` application to ship it. Progress and notes live on a 1 GiB PVC mounted at `/data`. It is published only through the Cloudflare tunnel at `primer.sajitkhadka.com` (no Ingress). Chapters are readable by anyone; progress and notes sit behind a password login (`AUTH_PASSWORD`, set from a SealedSecret). Locally `AUTH_PASSWORD` is unset, so there is no login.

## Layout

```
chapters/    one Markdown file per chapter (the content)
web/         static UI: index.html, app.js (Markdown renderer, notes, drawer), search.js, style.css
server.js    zero-dependency Node server: serves web/, lists chapters, stores progress and notes
Dockerfile   container image used by the deploy workflow
```
