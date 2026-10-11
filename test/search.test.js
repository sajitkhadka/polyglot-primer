const test = require("node:test");
const assert = require("node:assert/strict");
const Search = require("../web/search");
const { loadChapters } = require("./helpers");

const index = Search.buildIndex(loadChapters());

test("a language plus a concept returns that language's code first", () => {
  const hits = Search.search(index, "go looping");
  assert.ok(hits.length > 3);
  assert.equal(hits[0].kind, "code");
  assert.equal(hits[0].lang, "go");
  assert.match(hits[0].topic + hits[0].sub, /loop/i);
});

test("a language filter never returns another language's code", () => {
  for (const h of Search.search(index, "python loop")) {
    if (h.kind === "code") assert.equal(h.lang, "python");
  }
});

test("synonyms and stop words: 'how do i read args' finds the arguments material", () => {
  const hits = Search.search(index, "how do i read args");
  assert.ok(hits.some((h) => /argument/i.test(h.snippet)));
});

test("empty and nonsense queries return nothing", () => {
  assert.deepEqual(Search.search(index, ""), []);
  assert.deepEqual(Search.search(index, "   "), []);
  assert.deepEqual(Search.search(index, "zzzzqqqq"), []);
});

test("table rows narrow to the chosen language's cell", () => {
  const hit = Search.search(index, "java split").find((h) => h.kind === "row");
  assert.ok(hit);
  assert.match(hit.snippet, /split/);
});

test("a section cannot flood the results", () => {
  const counts = {};
  for (const h of Search.search(index, "go")) counts[h.key] = (counts[h.key] || 0) + 1;
  assert.ok(Math.max(...Object.values(counts)) <= 2);
});

test("snippets are HTML-escaped", () => {
  const blocks = Search.buildIndex([{ file: "01-x.md", title: "T", md: "## A\n\n```go\nx := a < b\n```\n" }]);
  const [hit] = Search.search(blocks, "go a");
  assert.ok(hit.html.includes("&lt;") && !hit.html.includes("< b"));
});
