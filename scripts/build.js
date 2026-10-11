#!/usr/bin/env node
// Pre-renders the site into public/: one real HTML page per chapter (so search engines and link
// previews see the content), a landing page, sitemap.xml, robots.txt, chapters.json, and copies of
// the raw Markdown for the in-browser search. The browser code only adds progress, notes and search.
//
//   SITE_URL=https://example.com node scripts/build.js [outDir]
const fs = require("fs");
const path = require("path");
const { render, esc, describe } = require("../web/markdown");

const ROOT = path.join(__dirname, "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "public"));
const SITE = (process.env.SITE_URL || "http://localhost:4321").replace(/\/+$/, "");
const NAME = "Polyglot Primer";
const TAGLINE = "Go, Java, JavaScript and Python side by side";
const HOME_DESC =
  "A quick side-by-side refresher of Go, Java, JavaScript and Python: syntax tables, quirks, what is idiomatic in each, a checklist and exercises per chapter. Core language and standard library only.";

const REPO_URL = (process.env.REPO_URL || "").replace(/\/+$/, "");
const slugOf = (file) => file.replace(/\.md$/, "");
const urlOf = (file) => `/chapters/${slugOf(file)}/`;

function write(rel, content) {
  const full = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) fs.copyFileSync(path.join(from, f), path.join(to, f));
}

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#2563eb"/><text x="32" y="43" font-family="system-ui,sans-serif" font-size="30" font-weight="700" text-anchor="middle" fill="#fff">4L</text></svg>\n`;

function head({ title, fullTitle, description, path: p, type = "website", jsonld }) {
  const canonical = SITE + p;
  const full = fullTitle || (title === NAME ? title : `${title} · ${NAME}`);
  return `<meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#2563eb">
  <title>${esc(full)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(canonical)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <meta property="og:site_name" content="${NAME}">
  <meta property="og:type" content="${type}">
  <meta property="og:title" content="${esc(full)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${esc(full)}">
  <meta name="twitter:description" content="${esc(description)}">
  <script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>
  <link rel="stylesheet" href="/style.css">`;
}

function shell({ headHtml, chapterFile, page, nav, main }) {
  return `<!doctype html>
<html lang="en">
<head>
  ${headHtml}
</head>
<body${chapterFile ? ` data-chapter="${esc(chapterFile)}"` : ""} data-page="${page}">
  <header id="topbar">
    <button id="menu-btn" aria-label="Open menu" aria-controls="sidebar" aria-expanded="false">\u2630</button>
    <a class="brand" href="/?home">${NAME}</a>
    <span id="topbar-progress"></span>
  </header>
  <div id="backdrop"></div>
  <aside id="sidebar">
    <div class="side-head">
      <a class="brand" href="/?home">${NAME}</a>
      <button id="close-btn" aria-label="Close menu">\u2715</button>
    </div>
    <p class="sub">Go \u00b7 Java \u00b7 JavaScript \u00b7 Python</p>
    <div class="search">
      <input id="search" type="search" placeholder="Search\u2026  e.g. go loop" autocomplete="off" spellcheck="false" aria-label="Search all chapters">
    </div>
    <div id="overall"></div>
    <div id="auth"></div>
    <nav id="nav" aria-label="Chapters">${nav}</nav>
    <div id="results" hidden></div>
    <footer class="side-foot"><a href="/privacy/">Privacy</a>${REPO_URL ? ` · <a href="${esc(REPO_URL)}">Source</a> · <a href="${esc(REPO_URL)}/blob/main/LICENSE-CONTENT.md">License</a>` : ""}</footer>
  </aside>
  <main id="main">
    <article id="content">${main}</article>
  </main>
  <noscript><p style="padding:1rem">Progress tracking, notes and search need JavaScript. The chapters themselves do not.</p></noscript>
  <script src="/markdown.js"></script>
  <script src="/search.js"></script>
  <script src="/app.js"></script>
</body>
</html>
`;
}

function main() {
  const chaptersDir = path.join(ROOT, "chapters");
  const files = fs.readdirSync(chaptersDir).filter((f) => /^\d+-.*\.md$/.test(f)).sort();
  if (!files.length) throw new Error("no chapters found");

  fs.rmSync(OUT, { recursive: true, force: true });
  copyDir(path.join(ROOT, "web"), OUT);
  write("favicon.svg", FAVICON);

  const chapters = files.map((file) => {
    const md = fs.readFileSync(path.join(chaptersDir, file), "utf8");
    return { ...describe(file, md), md, url: urlOf(file) };
  });

  const navHtml = (active) =>
    chapters
      .map((c) => `<a href="${c.url}" data-file="${esc(c.file)}"${c.file === active ? ' class="active" aria-current="page"' : ""}>${esc(c.title)}<span class="count"></span></a>`)
      .join("");

  chapters.forEach((c, i) => {
    const prev = chapters[i - 1], next = chapters[i + 1];
    const pager = `<div class="pager"><span>${prev ? `<a href="${prev.url}" rel="prev">\u2190 ${esc(prev.title)}</a>` : ""}</span><span>${next ? `<a href="${next.url}" rel="next">${esc(next.title)} \u2192</a>` : ""}</span></div>`;
    const desc = c.description || HOME_DESC;
    const jsonld = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "LearningResource",
          name: c.title,
          description: desc,
          url: SITE + c.url,
          inLanguage: "en",
          learningResourceType: "tutorial",
          teaches: ["Go", "Java", "JavaScript", "Python"],
          isPartOf: { "@type": "WebSite", name: NAME, url: SITE + "/" },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: NAME, item: SITE + "/" },
            { "@type": "ListItem", position: 2, name: c.title, item: SITE + c.url },
          ],
        },
      ],
    };
    write(
      `${c.url.slice(1)}index.html`,
      shell({
        headHtml: head({ title: c.title, fullTitle: `${c.title.replace(/^Chapter \d+:\s*/, "")}: Go vs Java vs JavaScript vs Python | ${NAME}`, description: desc, path: c.url, type: "article", jsonld }),
        chapterFile: c.file,
        page: "chapter",
        nav: navHtml(c.file),
        main: render(c.md, c.file) + pager,
      })
    );
    write(`md/${c.file}`, c.md);
  });

  const cards = chapters
    .map((c) => `<li><a href="${c.url}"><strong>${esc(c.title)}</strong></a><br><span class="muted">${esc(c.description)}</span></li>`)
    .join("\n");
  const homeMain = `<h1>${NAME}</h1>
<p class="lede">${esc(TAGLINE)}.</p>
<p>${esc(HOME_DESC)}</p>
<div id="continue"></div>
<h2 class="plain">Chapters</h2>
<ol class="chapter-list">
${cards}
</ol>
<h2 class="plain">How each chapter works</h2>
<ul>
  <li>Comparison tables and code for all four languages, one topic at a time.</li>
  <li>Quirks and gotchas, and what is idiomatic in each language.</li>
  <li>A checklist of what you should have learned, and an exercise to do in every language.</li>
  <li>Search across everything (try <code>go looping</code>), tick topics you understand, and keep notes. Sign in with Google to keep progress and notes across devices.</li>
</ul>`;
  const homeLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: NAME,
    url: SITE + "/",
    description: HOME_DESC,
    inLanguage: "en",
  };
  write("index.html", shell({
    headHtml: head({ title: NAME, description: HOME_DESC, path: "/", jsonld: homeLd }),
    page: "home",
    nav: navHtml(""),
    main: homeMain,
  }));

  write("404.html", shell({
    headHtml: head({ title: "Page not found", description: "That page does not exist.", path: "/404.html", jsonld: { "@context": "https://schema.org", "@type": "WebPage", name: "Page not found" } }).replace("<title>", '<meta name="robots" content="noindex">\n  <title>'),
    page: "404",
    nav: navHtml(""),
    main: `<h1>Page not found</h1><p><a href="/">Back to the chapters</a>.</p>`,
  }));

  const today = new Date().toISOString().slice(0, 10);
  const privacyMd = fs.readFileSync(path.join(ROOT, "docs", "privacy.md"), "utf8");
  write("privacy/index.html", shell({
    headHtml: head({
      title: "Privacy",
      description: "What Polyglot Primer stores when you read the site and when you sign in, and how to delete it.",
      path: "/privacy/",
      jsonld: { "@context": "https://schema.org", "@type": "WebPage", name: "Privacy", url: SITE + "/privacy/" },
    }),
    page: "page",
    nav: navHtml(""),
    main: render(privacyMd, "privacy"),
  }));

  const urls = ["/", ...chapters.map((c) => c.url), "/privacy/"];
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${esc(SITE + u)}</loc><lastmod>${today}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`);
  write("robots.txt", `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
  write("chapters.json", JSON.stringify(chapters.map(({ md, ...c }) => c)));

  console.log(`built ${chapters.length} chapters + landing, sitemap and robots into ${OUT} (SITE_URL=${SITE})`);
}

main();
