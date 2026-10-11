// Lint for chapter files: keeps new chapters in the shape the site and the search index expect.
const test = require("node:test");
const assert = require("node:assert/strict");
const { chapterFiles, readChapter } = require("./helpers");

const LANGS = new Set(["go", "java", "js", "python", ""]);

for (const f of chapterFiles()) {
  const md = readChapter(f);
  const lines = md.split(/\r?\n/);

  test(`${f}: has a title, a checklist, exercises, quirks and idioms`, () => {
    assert.match(lines[0], /^# Chapter \d+: /);
    for (const h of ["## Checklist", "## Exercises"]) assert.ok(lines.includes(h), `missing ${h}`);
    assert.ok(lines.some((l) => /^## Quirks/.test(l)), "missing a Quirks section");
    assert.ok(lines.some((l) => /^## What is idiomatic/.test(l)), "missing 'What is idiomatic'");
  });

  test(`${f}: checklist items are unchecked task items`, () => {
    const i = lines.indexOf("## Checklist");
    const items = lines.slice(i + 1).filter((l) => /^- /.test(l)).slice(0, 4);
    assert.ok(items.length >= 3 && items.every((l) => l.startsWith("- [ ] ")));
  });

  test(`${f}: code fences are balanced and use known languages`, () => {
    let open = false;
    for (const l of lines) {
      const m = l.match(/^```(\w*)/);
      if (!m) continue;
      if (!open) assert.ok(LANGS.has(m[1]), `unknown fence language "${m[1]}"`);
      open = !open;
    }
    assert.equal(open, false, "unclosed code fence");
  });

  test(`${f}: tables have a consistent column count and no unescaped pipes in cells`, () => {
    let inFence = false;
    let cols = 0;
    lines.forEach((l, n) => {
      if (l.startsWith("```")) inFence = !inFence;
      if (inFence) return;
      if (!/^\s*\|.*\|\s*$/.test(l)) { cols = 0; return; }
      const count = l.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).length;
      if (cols === 0) cols = count;
      assert.equal(count, cols, `line ${n + 1}: expected ${cols} columns, got ${count}`);
    });
  });

  test(`${f}: ## topics are unique within the chapter`, () => {
    const titles = lines.filter((l) => /^## /.test(l));
    assert.equal(new Set(titles).size, titles.length);
  });
}
