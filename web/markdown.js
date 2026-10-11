// Minimal Markdown renderer shared by the build step (Node) and the browser.
// Supports headings, tables, fenced code, blockquotes, nested lists, task items, bold, italic,
// inline code and links - exactly what the chapters use, nothing else.
(function (root) {
  // Topic ids are "<chapter-file>#<slug of the ## heading>". Keep this the only slugify in the project.
  const slugify = (s) => s.toLowerCase().replace(/`/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const strip = (s) => s.replace(/`/g, "").replace(/\*\*/g, "");

  function inline(raw) {
    const codes = [];
    let s = esc(raw).replace(/`([^`]+)`/g, (_, c) => (codes.push(c), `\u0000${codes.length - 1}\u0000`));
    s = s
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => (/^(https?:|\/|#|mailto:)/.test(u) ? `<a href="${u}">${t}</a>` : t));
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
  }

  // lines[i] is a list item; returns [html, nextIndex]. Nesting by indentation.
  function renderList(lines, i) {
    const itemRe = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
    const first = lines[i].match(itemRe);
    const base = first[1].length;
    const ordered = /\d+\./.test(first[2]);
    let html = "";
    let tasks = false;
    while (i < lines.length) {
      const m = lines[i].match(itemRe);
      if (!m || m[1].length < base) break;
      if (m[1].length > base) {
        const [sub, next] = renderList(lines, i);
        html = html.replace(/<\/li>$/, sub + "</li>");
        i = next;
        continue;
      }
      let text = m[3];
      const t = text.match(/^\[( |x)\]\s+(.*)$/i);
      if (t) { tasks = true; text = `${t[1] === " " ? "☐" : "☑"} ${t[2]}`; }
      html += `<li>${inline(text)}</li>`;
      i++;
    }
    const tag = ordered ? "ol" : "ul";
    return [`<${tag}${tasks ? ' class="tasks"' : ""}>${html}</${tag}>`, i];
  }

  // chapterFile is used only to build the data-topic ids on ## headings.
  function render(md, chapterFile) {
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let i = 0;
    let para = [];
    const flush = () => { if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`); para = []; };
    while (i < lines.length) {
      const line = lines[i];
      let m;
      if ((m = line.match(/^```(\w*)/))) {
        flush();
        const body = [];
        i++;
        while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
        i++;
        out.push(`<pre data-lang="${m[1]}"><code>${esc(body.join("\n"))}</code></pre>`);
      } else if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
        flush();
        const lvl = m[1].length;
        if (lvl === 2) {
          const id = slugify(m[2]);
          out.push(`<h2 id="${id}" data-topic="${esc(chapterFile || "")}#${id}"><span class="title">${inline(m[2])}</span></h2>`);
        } else out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
        i++;
      } else if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || "")) {
        flush();
        const cells = (l) => l.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
        const head = cells(line);
        i += 2;
        let rows = "";
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          rows += `<tr>${cells(lines[i]).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`;
          i++;
        }
        out.push(`<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`);
      } else if (line.startsWith(">")) {
        flush();
        const q = [];
        while (i < lines.length && lines[i].startsWith(">")) q.push(lines[i++].replace(/^>\s?/, ""));
        out.push(`<blockquote>${render(q.join("\n"), chapterFile)}</blockquote>`);
      } else if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
        flush();
        const [html, next] = renderList(lines, i);
        out.push(html);
        i = next;
      } else if (/^---+\s*$/.test(line)) {
        flush(); out.push("<hr>"); i++;
      } else if (line.trim() === "") {
        flush(); i++;
      } else {
        para.push(line.trim()); i++;
      }
    }
    flush();
    return out.join("\n");
  }

  // Chapter metadata used by the build and the topic list: title, first-paragraph description, topics.
  function describe(file, md) {
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    const title = ((md.match(/^#\s+(.+)$/m) || [null, file])[1]).trim();
    const intro = lines.find((l) => l.startsWith(">"));
    let description = intro ? strip(intro.replace(/^>\s?/, "")) : "";
    if (description.length > 160) description = description.slice(0, 157).replace(/\s+\S*$/, "") + "...";
    const topics = [];
    let fence = false;
    for (const line of lines) {
      if (line.startsWith("```")) fence = !fence;
      const m = !fence && line.match(/^##\s+(.+)$/);
      if (m) topics.push({ id: `${file}#${slugify(m[1])}`, slug: slugify(m[1]), title: strip(m[1]) });
    }
    return { file, title, description, topics };
  }

  const api = { render, slugify, esc, inline, describe };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Markdown = api;
})(typeof window !== "undefined" ? window : globalThis);
