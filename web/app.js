// Study UI: renders chapter Markdown, tracks per-topic "I understand" checkboxes and notes,
// searches all chapters, and opens on the first chapter that still has an unchecked topic.
const $ = (id) => document.getElementById(id);
let chapters = [];
let done = {};
let notes = {};
let CUR = "";
let index = null; // search blocks, built lazily on first search
let required = false; // server has a login gate
let googleClientId = ""; // set when the server accepts Google sign-in
let passwordLogin = false;
let canSave = true; // progress and notes are available (no gate, or signed in)

// Must match slugify() in server.js.
const slugify = (s) => s.toLowerCase().replace(/`/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------- minimal Markdown renderer (headings, tables, fences, lists, quotes) ----------
function inline(raw) {
  const codes = [];
  let s = esc(raw).replace(/`([^`]+)`/g, (_, c) => (codes.push(c), `\u0000${codes.length - 1}\u0000`));
  s = s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
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

function render(md) {
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
        out.push(`<h2 id="${id}" data-topic="${CUR}#${id}"><span class="title">${inline(m[2])}</span></h2>`);
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
      out.push(`<blockquote>${render(q.join("\n"))}</blockquote>`);
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

// ---------- persistence ----------
const put = (url, body) =>
  fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true });

const chapterDone = (c) => c.topics.filter((t) => done[t.id]).length;
const firstUnfinished = () => chapters.find((c) => chapterDone(c) < c.topics.length);

async function loadState() {
  const s = await fetch("/api/session").then((r) => r.json());
  required = s.required;
  googleClientId = s.googleClientId || "";
  passwordLogin = !!s.password;
  canSave = !s.required || s.authed;
  if (!canSave) { done = {}; notes = {}; return; }
  const [p, n] = await Promise.all([
    fetch("/api/progress").then((r) => r.json()),
    fetch("/api/notes").then((r) => r.json()),
  ]);
  done = p.done || {};
  notes = n.notes || {};
}

function renderAuth() {
  const box = $("auth");
  if (!required) { box.innerHTML = ""; return; }
  if (canSave) {
    box.innerHTML = `<button type="button" class="linkbtn" id="logout">Sign out</button>`;
    $("logout").addEventListener("click", async () => {
      await fetch("/api/logout", { method: "POST" });
      await refreshAfterAuth();
    });
    return;
  }
  box.innerHTML = `<div class="login">
    <div class="hint">Chapters are open to read. Sign in to save progress and notes.</div>
    ${googleClientId ? '<div id="g-btn"></div>' : ""}
    ${passwordLogin ? `<form id="login">
      <input type="password" id="pw" placeholder="Password" autocomplete="current-password" aria-label="Password">
      <button type="submit">Sign in</button>
    </form>` : ""}
    <div class="err" id="login-err" role="alert"></div>
  </div>`;
  const fail = (r) => { $("login-err").textContent = r.status === 429 ? "Too many attempts. Try again later." : r.status === 403 ? "That Google account is not allowed." : "Sign-in failed."; };
  const post = (body) => fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (passwordLogin) {
    $("login").addEventListener("submit", async (e) => {
      e.preventDefault();
      const r = await post({ password: $("pw").value });
      if (r.ok) return refreshAfterAuth();
      fail(r);
    });
  }
  if (googleClientId) loadGoogle().then(() => {
    google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (resp) => {
        const r = await post({ credential: resp.credential });
        if (r.ok) return refreshAfterAuth();
        fail(r);
      },
    });
    google.accounts.id.renderButton($("g-btn"), { theme: "outline", size: "large", text: "signin_with", width: 240 });
  }).catch(() => { $("login-err").textContent = "Could not load Google sign-in."; });
}

let gsiLoading;
function loadGoogle() {
  if (window.google && google.accounts) return Promise.resolve();
  return (gsiLoading ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  }));
}

async function refreshAfterAuth() {
  await loadState();
  index = null;
  renderAuth();
  await openChapter(CUR, null, window.scrollY);
}

// ---------- sidebar / drawer ----------
function renderNav() {
  const total = chapters.reduce((n, c) => n + c.topics.length, 0);
  const got = chapters.reduce((n, c) => n + chapterDone(c), 0);
  $("overall").innerHTML = `${got} of ${total} topics understood<div class="bar"><div style="width:${total ? (got / total) * 100 : 0}%"></div></div>`;
  $("topbar-progress").textContent = `${got}/${total}`;
  $("nav").innerHTML = chapters
    .map((c) => {
      const d = chapterDone(c);
      const cls = [c.file === CUR ? "active" : "", d === c.topics.length && d ? "complete" : ""].join(" ");
      return `<a href="#${c.file}" class="${cls}">${esc(c.title)}<span class="count">${d}/${c.topics.length}</span></a>`;
    })
    .join("");
}

function setMenu(open) {
  document.body.classList.toggle("menu-open", open);
  $("menu-btn").setAttribute("aria-expanded", String(open));
}
$("menu-btn").addEventListener("click", () => setMenu(true));
$("close-btn").addEventListener("click", () => setMenu(false));
$("backdrop").addEventListener("click", () => setMenu(false));
$("nav").addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });

// ---------- notes ----------
function noteLabel(btn, id) {
  const has = !!(notes[id] && notes[id].trim());
  btn.classList.toggle("has", has);
  btn.textContent = has ? "📝 Note ●" : "📝 Note";
}

function buildNotePanel(h, id, btn) {
  const panel = document.createElement("div");
  panel.className = "note-panel";
  panel.innerHTML = `<textarea placeholder="Your notes for this topic…" aria-label="Notes for this topic"></textarea><div class="status"></div>`;
  const ta = panel.querySelector("textarea");
  const status = panel.querySelector(".status");
  ta.value = notes[id] || "";
  let timer;
  const flush = async () => {
    clearTimeout(timer);
    if ((notes[id] || "") === ta.value) return;
    if (ta.value.trim()) notes[id] = ta.value; else delete notes[id];
    index = null; // notes are part of the search index
    noteLabel(btn, id);
    status.textContent = "Saving…";
    try {
      const r = await put("/api/notes", { id, text: ta.value });
      status.textContent = r.ok ? "Saved" : "Not saved - server rejected it";
    } catch {
      status.textContent = "Not saved - offline";
    }
  };
  ta.addEventListener("input", () => { status.textContent = "Typing…"; clearTimeout(timer); timer = setTimeout(flush, 700); });
  ta.addEventListener("blur", flush);
  h.after(panel);
  return panel;
}

// ---------- page ----------
function decorateTopics(el) {
  if (!canSave) return; // signed out: read-only, no checkboxes or notes
  el.querySelectorAll("h2[data-topic]").forEach((h) => {
    const id = h.dataset.topic;

    const label = document.createElement("label");
    label.className = "pill understood" + (done[id] ? " on" : "");
    label.innerHTML = `<input type="checkbox" ${done[id] ? "checked" : ""}> I understand this`;
    label.querySelector("input").addEventListener("change", async (e) => {
      const on = e.target.checked;
      if (on) done[id] = true; else delete done[id];
      label.classList.toggle("on", on);
      renderNav();
      try { await put("/api/progress", { id, done: on }); } catch { /* offline: kept in memory only */ }
    });

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pill note-btn";
    noteLabel(btn, id);
    const panel = buildNotePanel(h, id, btn);
    const show = (open) => { panel.hidden = !open; btn.setAttribute("aria-expanded", String(open)); };
    show(!!(notes[id] && notes[id].trim()));
    btn.addEventListener("click", () => {
      show(panel.hidden);
      if (!panel.hidden) panel.querySelector("textarea").focus();
    });

    h.append(label, btn);
  });
}

function flash(el) {
  el.classList.remove("flash");
  void el.offsetWidth; // restart the animation
  el.classList.add("flash");
}

// target: { topicId } or { topic, sub, kind, locate } from a search hit.
function scrollToTarget(target) {
  const el = $("content");
  let node = null;
  if (target.topicId) node = el.querySelector(`h2[data-topic="${CSS.escape(target.topicId)}"]`);
  else {
    const h2 = [...el.querySelectorAll("h2")].find((h) => h.querySelector(".title").textContent === target.topic);
    node = h2;
    // Everything under this topic, up to the next topic heading.
    const section = [];
    for (let n = h2 && h2.nextElementSibling; n && n.tagName !== "H2"; n = n.nextElementSibling) section.push(n);
    const h3 = target.sub && section.find((n) => n.tagName === "H3" && n.textContent === target.sub);
    if (h3) node = h3;
    if (target.kind === "code" && target.locate) {
      const pre = section.find((n) => n.tagName === "PRE" && n.textContent.trim().startsWith(target.locate));
      if (pre) node = pre;
    } else if (target.kind === "row" && target.locate) {
      const tr = section.filter((n) => n.tagName === "TABLE").flatMap((tb) => [...tb.querySelectorAll("tbody tr")])
        .find((r) => r.cells[0] && r.cells[0].textContent.trim() === target.locate);
      if (tr) node = tr;
    } else if (target.kind === "note" && h2) {
      const p = h2.nextElementSibling;
      node = p && p.classList.contains("note-panel") ? p : h2;
    }
  }
  if (node) { node.scrollIntoView({ block: "center" }); flash(node); } else window.scrollTo(0, 0);
}

async function openChapter(file, target, keepScroll) {
  CUR = file;
  const md = await (await fetch(`/api/chapter/${file}`)).text();
  const el = $("content");
  el.innerHTML = render(md);
  decorateTopics(el);
  const idx = chapters.findIndex((c) => c.file === file);
  const prev = chapters[idx - 1], next = chapters[idx + 1];
  el.insertAdjacentHTML("beforeend", `<div class="pager"><span>${prev ? `<a href="#${prev.file}">← ${esc(prev.title)}</a>` : ""}</span><span>${next ? `<a href="#${next.file}">${esc(next.title)} →</a>` : ""}</span></div>`);
  renderNav();
  renderAuth();
  document.title = `${chapters[idx].title} · Polyglot Primer`;
  if (target) scrollToTarget(target);
  else if (keepScroll === undefined) window.scrollTo(0, 0);
  else window.scrollTo(0, keepScroll);
}

function go(file, target) {
  if (location.hash.slice(1) !== file) history.pushState(null, "", `#${file}`);
  setMenu(false);
  return openChapter(file, target);
}

// ---------- search ----------
async function ensureIndex() {
  if (index) return index;
  const docs = await Promise.all(
    chapters.map(async (c) => ({ file: c.file, title: c.title, md: await (await fetch(`/api/chapter/${c.file}`)).text() }))
  );
  const blocks = Search.buildIndex(docs);
  for (const [id, text] of Object.entries(notes)) {
    const [file, slug] = id.split("#");
    const c = chapters.find((x) => x.file === file);
    const t = c && c.topics.find((x) => x.id === id);
    if (c && t) blocks.push({ file, chTitle: c.title, topic: t.title, sub: "", kind: "note", text });
  }
  return (index = blocks);
}

let hits = [];
let searchSeq = 0;
async function runSearch() {
  const q = $("search").value.trim();
  const box = $("results");
  if (!q) {
    box.hidden = true;
    $("nav").hidden = false;
    return;
  }
  const seq = ++searchSeq;
  const blocks = await ensureIndex();
  if (seq !== searchSeq) return; // a newer keystroke superseded this one
  hits = Search.search(blocks, q);
  $("nav").hidden = true;
  box.hidden = false;
  if (!hits.length) {
    box.innerHTML = `<div class="none">No results for “${esc(q)}”. Try fewer words, or a language plus a concept: <em>python slicing</em>, <em>java switch</em>.</div>`;
    return;
  }
  box.innerHTML =
    `<div class="meta">${hits.length} result${hits.length === 1 ? "" : "s"}</div>` +
    hits
      .map((h, i) => {
        const crumb = [h.chTitle.replace(/^Chapter \d+:\s*/, ""), h.topic, h.sub].filter(Boolean).map(esc).join(" › ");
        const lang = h.lang ? `<span class="lang">${esc(Search.LANG_LABEL[h.lang])}</span>` : "";
        const label = h.kind === "note" ? `<span class="lang">Note</span>` : lang;
        const snip = h.kind === "code" ? `<pre class="snip">${h.html}</pre>` : `<div class="snip">${h.html}</div>`;
        return `<button class="hit" data-i="${i}"><div class="crumb">${label}${crumb}</div>${snip}</button>`;
      })
      .join("");
}

function openHit(i) {
  const h = hits[i];
  if (!h) return;
  go(h.file, { topic: h.topic, sub: h.sub, kind: h.kind, locate: h.locate });
}

let searchTimer;
$("search").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 120); });
$("search").addEventListener("keydown", (e) => {
  if (e.key === "Escape") { e.target.value = ""; runSearch(); }
  else if (e.key === "Enter") { clearTimeout(searchTimer); runSearch().then(() => openHit(0)); }
  else if (e.key === "ArrowDown") { const b = $("results").querySelector(".hit"); if (b) { e.preventDefault(); b.focus(); } }
});
$("results").addEventListener("click", (e) => {
  const b = e.target.closest(".hit");
  if (b) openHit(Number(b.dataset.i));
});
$("results").addEventListener("keydown", (e) => {
  const b = e.target.closest(".hit");
  if (!b) return;
  const move = e.key === "ArrowDown" ? b.nextElementSibling : e.key === "ArrowUp" ? b.previousElementSibling : null;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (move && move.classList.contains("hit")) move.focus(); else if (e.key === "ArrowUp") $("search").focus();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
    e.preventDefault();
    setMenu(true);
    $("search").focus();
  } else if (e.key === "Escape") setMenu(false);
});

// ---------- startup ----------
async function init() {
  const [list] = await Promise.all([fetch("/api/chapters").then((r) => r.json()), loadState()]);
  chapters = list;
  if (!chapters.length) { $("content").textContent = "No chapters found."; return; }
  const hash = location.hash.slice(1);
  if (chapters.some((c) => c.file === hash)) return openChapter(hash);
  // Default: first chapter with an unchecked topic, scrolled to that topic.
  const c = firstUnfinished() || chapters[chapters.length - 1];
  const t = c.topics.find((x) => !done[x.id]);
  history.replaceState(null, "", `#${c.file}`);
  openChapter(c.file, t && { topicId: t.id });
}

window.addEventListener("hashchange", () => {
  const f = location.hash.slice(1);
  if (f && f !== CUR && chapters.some((c) => c.file === f)) { setMenu(false); openChapter(f); }
});

// Phone and PC share one server: pick up changes made elsewhere when this tab comes back.
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || !chapters.length) return;
  if (document.activeElement && document.activeElement.tagName === "TEXTAREA") return;
  try {
    await loadState();
    index = null;
    openChapter(CUR, null, window.scrollY); // re-render checkboxes and notes from fresh state
  } catch { /* offline: keep what we have */ }
});

init();
