const test = require("node:test");
const assert = require("node:assert/strict");
const { render, slugify, describe } = require("../web/markdown");
const { chapterFiles, readChapter } = require("./helpers");

test("slugify matches the ids used for topics", () => {
  assert.equal(slugify("Hello, World"), "hello-world");
  assert.equal(slugify("`switch` / match"), "switch-match");
  assert.equal(slugify("Nothing: nil, null, undefined, None"), "nothing-nil-null-undefined-none");
});

test("## headings become topics with data-topic ids", () => {
  const html = render("# T\n\n## Loops\n\ntext\n\n## Maps / dicts\n", "04-x.md");
  assert.match(html, /<h2 id="loops" data-topic="04-x\.md#loops">/);
  assert.match(html, /data-topic="04-x\.md#maps-dicts"/);
});

test("code is escaped and tagged with its language", () => {
  const html = render('```js\nif (a < b && "x") {}\n```');
  assert.match(html, /<pre data-lang="js"><code>if \(a &lt; b &amp;&amp; &quot;x&quot;\) \{\}<\/code><\/pre>/);
});

test("tables handle escaped pipes and inline code", () => {
  const html = render("| A | B |\n| --- | --- |\n| `a \\| b` | **x** |\n");
  assert.match(html, /<th>A<\/th><th>B<\/th>/);
  assert.match(html, /<td><code>a \| b<\/code><\/td><td><strong>x<\/strong><\/td>/);
});

test("raw HTML in text is escaped", () => {
  assert.ok(!render("hello <script>alert(1)</script>").includes("<script>"));
});

test("only safe link targets are kept", () => {
  assert.match(render("[ok](https://example.com)"), /<a href="https:\/\/example\.com">ok<\/a>/);
  assert.ok(!render("[bad](javascript:alert(1))").includes("href"));
});

test("task items and nested lists render", () => {
  const html = render("- [ ] one\n- [x] two\n  - nested\n");
  assert.match(html, /<ul class="tasks">/);
  assert.match(html, /☐ one/);
  assert.match(html, /<ul><li>nested<\/li><\/ul>/);
});

test("describe() finds title, trimmed description and topics, ignoring ## inside code", () => {
  const d = describe("01-a.md", "# Chapter 1: A\n\n> " + "word ".repeat(60) + "\n\n## One\n\n```\n## not a topic\n```\n\n## Two\n");
  assert.equal(d.title, "Chapter 1: A");
  assert.ok(d.description.length <= 160 && d.description.endsWith("..."));
  assert.deepEqual(d.topics.map((t) => t.id), ["01-a.md#one", "01-a.md#two"]);
});

test("every real chapter renders without leftover table or fence syntax", () => {
  for (const f of chapterFiles()) {
    const html = render(readChapter(f), f);
    assert.ok(!html.includes("| ---"), f);
    assert.ok(!html.includes("```"), f);
  }
});
