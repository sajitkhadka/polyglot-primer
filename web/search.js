// Client-side search over the chapter Markdown. No dependencies; also loadable from Node for tests.
//   buildIndex([{ file, title, md }]) -> blocks
//   search(blocks, query)             -> hits (best first)
// A "block" is the smallest searchable unit: a code sample, a table row, or a paragraph/list item,
// tagged with the chapter, topic (##) and sub-section (###) it lives under.
(function (root) {
  const LANGS = { go: "go", golang: "go", java: "java", js: "js", javascript: "js", node: "js", nodejs: "js", py: "python", python: "python" };
  const LANG_LABEL = { go: "Go", java: "Java", js: "JavaScript", python: "Python" };
  const FENCE_LANG = { go: "go", java: "java", js: "js", javascript: "js", python: "python" };

  // Query word -> extra spellings a chapter might use. Matching is "any of these".
  const SYNONYMS = {
    loop: ["iterat", "for", "while", "range", "each"],
    array: ["slice", "list"], list: ["array", "slice"], slice: ["list", "array"],
    map: ["dict", "dictionary", "hashmap"], dict: ["map", "dictionary"], dictionary: ["dict", "map"],
    error: ["exception", "err"], exception: ["error", "throw", "panic"],
    string: ["text"], text: ["string"],
    function: ["func", "method", "def", "lambda"], func: ["function"], method: ["function", "func"],
    class: ["struct", "object"], struct: ["class", "object"],
    null: ["nil", "none", "undefined"], nil: ["null", "none"], none: ["null", "nil"], undefined: ["null"],
    print: ["println", "printf", "console.log"],
    switch: ["match"], match: ["switch"],
    constant: ["const", "final"], const: ["constant", "final"],
    variable: ["var", "let"],
    args: ["argument", "argv"], arg: ["argument", "argv"], param: ["parameter", "argument"],
    convert: ["conversion", "parse", "cast"], cast: ["convert", "conversion"],
  };

  const STOP = new Set("a an the how do does did i me my to of in on is are what which can could should would with and or it its this that about use using get".split(" "));

  function stem(w) {
    w = w.toLowerCase();
    if (w.length > 4 && w.endsWith("ing")) {
      w = w.slice(0, -3);
      if (/([^aeiou])\1$/.test(w)) w = w.slice(0, -1); // running -> run
    } else if (w.length > 4 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
    else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
    else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
    return w;
  }

  function has(text, term) {
    if (term.length <= 3) return new RegExp("(^|[^a-z0-9])" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)").test(text);
    return text.includes(term);
  }

  const headerLang = (h) => LANGS[h.trim().split(/[\s(]/)[0].toLowerCase()] || null;
  const splitRow = (l) => l.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
  const plain = (s) => s.replace(/\*\*/g, "").replace(/`/g, "");

  function parseBlocks(file, chTitle, md) {
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let topic = "", sub = "", i = 0, para = [];
    const base = () => ({ file, chTitle, topic, sub });
    const flush = () => { if (para.length) out.push({ ...base(), kind: "text", text: plain(para.join(" ")) }); para = []; };
    while (i < lines.length) {
      const line = lines[i];
      let m;
      if ((m = line.match(/^```(\w*)/))) {
        flush();
        const body = [];
        i++;
        while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
        i++;
        out.push({ ...base(), kind: "code", lang: FENCE_LANG[m[1]] || null, text: body.join("\n") });
      } else if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
        flush();
        if (m[1].length === 2) { topic = plain(m[2]); sub = ""; }
        else if (m[1].length === 3) sub = plain(m[2]);
        i++;
      } else if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || "")) {
        flush();
        const headers = splitRow(line);
        const langCols = headers.map(headerLang);
        i += 2;
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          const cells = splitRow(lines[i]).map(plain);
          out.push({ ...base(), kind: "row", headers, langCols, cells, text: cells.join(" | ") });
          i++;
        }
      } else if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
        flush();
        const raw = line.replace(/^\s*([-*]|\d+\.)\s+(\[[ x]\]\s+)?/i, "");
        const lm = raw.match(/^\*\*(Go|Java|JavaScript|Python)\*\*/);
        out.push({ ...base(), kind: "text", blockLang: lm ? LANGS[lm[1].toLowerCase()] : null, text: plain(raw) });
        i++;
      } else if (/^(>|---)/.test(line) || line.trim() === "") {
        flush();
        i++;
      } else {
        para.push(line.trim());
        i++;
      }
    }
    flush();
    return out;
  }

  function buildIndex(chapters) {
    return chapters.flatMap((c) => parseBlocks(c.file, c.title, c.md));
  }

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function highlight(text, words) {
    let h = esc(text);
    for (const w of words) {
      if (w.length < 2) continue;
      h = h.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (x) => `<mark>${x}</mark>`);
    }
    return h;
  }

  function around(text, words, max) {
    const low = text.toLowerCase();
    let at = -1;
    for (const w of words) { const k = low.indexOf(w); if (k >= 0 && (at < 0 || k < at)) at = k; }
    const start = Math.max(0, at - 50);
    return (start ? "…" : "") + text.slice(start, start + max) + (start + max < text.length ? "…" : "");
  }

  function codeSnippet(text, words) {
    const ls = text.split("\n");
    let at = ls.findIndex((l) => words.some((w) => l.toLowerCase().includes(w)));
    if (at < 0) at = 0;
    return ls.slice(Math.max(0, at - 1), Math.max(0, at - 1) + 4).join("\n");
  }

  function search(blocks, query, limit = 30) {
    const raw = (query.toLowerCase().match(/[a-z0-9_.+#]+/g) || []);
    const langs = [...new Set(raw.filter((w) => LANGS[w]).map((w) => LANGS[w]))];
    const words = raw.filter((w) => !LANGS[w] && !STOP.has(w));
    if (!words.length && !langs.length) return [];
    const terms = words.map((w) => {
      const s = stem(w);
      return { s, alts: [s, ...(SYNONYMS[w] || SYNONYMS[s] || [])] };
    });
    const hl = [...new Set(words.flatMap((w) => [w, stem(w)]))];
    // Strict pass: every word must match. If that finds little, allow one word to be missing.
    let hits = collect(0);
    if (hits.length < 3 && terms.length > 1) hits = collect(1);
    return finish(hits);

    function collect(missAllowed) {
    const hits = [];
    for (const b of blocks) {
      if (b.kind === "code" && langs.length && !langs.includes(b.lang)) continue;
      if (b.kind === "text" && b.blockLang && langs.length && !langs.includes(b.blockLang)) continue;
      const head = `${b.chTitle} ${b.topic} ${b.sub}`.toLowerCase();
      const body = b.text.toLowerCase();
      let score = 0;
      let missed = 0;
      for (const t of terms) {
        const inBody = t.alts.some((a) => has(body, a));
        const inHead = t.alts.some((a) => has(head, a));
        if (!inBody && !inHead) { missed++; continue; }
        score += (inHead ? 3 : 0) + (inBody ? 2 : 0) + (has(body, t.s) || has(head, t.s) ? 1 : 0);
      }
      if (missed > missAllowed || missed === terms.length && terms.length) continue;
      score -= missed * 2;
      if (!terms.length) score = 1; // language-only query: list that language's samples
      if (b.kind === "code" && langs.length) score += 4;
      if (b.kind === "text" && b.blockLang && langs.includes(b.blockLang)) score += 3;
      if (b.kind === "note") score += 2;

      const hit = { file: b.file, chTitle: b.chTitle, topic: b.topic, sub: b.sub, kind: b.kind, lang: null, score, key: `${b.file}|${b.topic}|${b.sub}` };
      if (b.kind === "code") {
        hit.lang = b.lang;
        hit.snippet = codeSnippet(b.text, hl);
        hit.html = highlight(hit.snippet, hl);
        hit.locate = b.text.split("\n")[0].trim();
        if (terms.length && !terms.every((t) => t.alts.some((a) => has(body, a)))) hit.score -= 1; // heading-only match
      } else if (b.kind === "row") {
        const want = langs.length ? langs.find((l) => b.langCols.includes(l)) : null;
        const cell = want ? b.cells[b.langCols.indexOf(want)] : null;
        hit.lang = want || null;
        hit.snippet = cell ? `${b.cells[0]} — ${cell}` : b.cells.slice(0, 3).join(" · ");
        hit.html = highlight(around(hit.snippet, hl, 150), hl);
        hit.locate = b.cells[0];
        if (cell) hit.score += 3;
      } else {
        hit.lang = b.blockLang || null;
        hit.snippet = around(b.text, hl, 150);
        hit.html = highlight(hit.snippet, hl);
        hit.locate = null;
      }
      hits.push(hit);
    }
    return hits;
    }

    function finish(hits) {
    hits.sort((a, b) => b.score - a.score);
    // At most 2 hits per section so one big section cannot flood the list.
    const perKey = {};
    const out = [];
    for (const h of hits) {
      perKey[h.key] = (perKey[h.key] || 0) + 1;
      if (perKey[h.key] > 2) continue;
      out.push(h);
      if (out.length >= limit) break;
    }
    return out;
    }
  }

  const api = { buildIndex, search, parseBlocks, LANG_LABEL };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Search = api;
})(typeof window !== "undefined" ? window : globalThis);
