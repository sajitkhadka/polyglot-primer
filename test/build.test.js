const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { ROOT, chapterFiles } = require("./helpers");

const out = fs.mkdtempSync(path.join(os.tmpdir(), "pp-build-"));
execFileSync(process.execPath, [path.join(ROOT, "scripts", "build.js"), out], { env: { ...process.env, SITE_URL: "https://example.org/" } });
const read = (p) => fs.readFileSync(path.join(out, p), "utf8");

test("every chapter gets a real page with title, description, canonical and structured data", () => {
  for (const f of chapterFiles()) {
    const slug = f.replace(/\.md$/, "");
    const html = read(`chapters/${slug}/index.html`);
    assert.match(html, /<title>[^<]+Go vs Java vs JavaScript vs Python/, f);
    assert.match(html, /<meta name="description" content="[^"]{20,160}">/, f);
    assert.ok(html.includes(`<link rel="canonical" href="https://example.org/chapters/${slug}/">`), f);
    assert.ok(html.includes('"@type":"LearningResource"'), f);
    assert.ok(html.includes('<meta property="og:title"'), f);
    assert.match(html, /<h1>/, f);
    assert.ok((html.match(/data-topic="/g) || []).length >= 5, f);
    assert.ok(!html.includes("localhost"), `${f} leaks the default SITE_URL`);
  }
});

test("sitemap lists the home page and all chapters; robots points at it", () => {
  const sm = read("sitemap.xml");
  assert.ok(sm.includes("<loc>https://example.org/</loc>"));
  for (const f of chapterFiles()) assert.ok(sm.includes(`https://example.org/chapters/${f.replace(/\.md$/, "")}/`), f);
  const robots = read("robots.txt");
  assert.match(robots, /Sitemap: https:\/\/example\.org\/sitemap\.xml/);
  assert.match(robots, /Disallow: \/api\//);
});

test("landing page, 404 page, favicon, raw markdown and chapter index exist", () => {
  assert.match(read("index.html"), /<h1>Polyglot Primer<\/h1>/);
  assert.match(read("404.html"), /noindex/);
  assert.ok(read("favicon.svg").includes("<svg"));
  for (const f of chapterFiles()) assert.ok(read(`md/${f}`).startsWith("# "));
  const idx = JSON.parse(read("chapters.json"));
  assert.equal(idx.length, chapterFiles().length);
  assert.ok(idx.every((c) => c.topics.length && c.url.startsWith("/chapters/")));
});

test("the privacy page is generated, linked from every page and listed in the sitemap", () => {
  assert.ok(read("privacy/index.html").includes("<h1>Privacy</h1>"));
  assert.ok(read("sitemap.xml").includes("https://example.org/privacy/"));
  assert.ok(read("index.html").includes('<a href="/privacy/">Privacy</a>'));
  for (const f of chapterFiles()) assert.ok(read(`chapters/${f.replace(/\.md$/, "")}/index.html`).includes('href="/privacy/"'), f);
});

test("pages link their neighbours and expose the sidebar as real links", () => {
  const html = read(`chapters/${chapterFiles()[1].replace(/\.md$/, "")}/index.html`);
  assert.match(html, /rel="prev"/);
  assert.match(html, /<nav id="nav"[^>]*><a href="\/chapters\//);
});
