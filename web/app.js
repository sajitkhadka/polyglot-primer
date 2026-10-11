// Browser enhancements for the pre-rendered pages: progress checkboxes, notes, search, sign-in.
// The chapter content itself is plain HTML and works without any of this.
const $ = (id) => document.getElementById(id);
const { esc } = Markdown;

const PAGE = document.body.dataset.page; // "home" | "chapter" | "404"
const CUR = document.body.dataset.chapter || ""; // chapter file, e.g. "04-control-flow.md"
const chapterUrl = (file) => `/chapters/${file.replace(/\.md$/, "")}/`;

let chapters = [];
let done = {};
let notes = {};
let user = null; // { email, name } when signed in to a deployed site
let required = false; // the server has a login gate
let canSave = true; // progress and notes are available (no gate, or signed in)
let googleClientId = "";
let index = null; // search blocks, built lazily on first search

const chapterDone = (c) => c.topics.filter((t) => done[t.id]).length;
const firstUnfinished = () => chapters.find((c) => chapterDone(c) < c.topics.length);

// ---------- persistence ----------
const send = (url, method, body) =>
  fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body), keepalive: true });

async function loadState() {
  const s = await fetch("/api/session").then((r) => r.json());
  required = s.required;
  googleClientId = s.googleClientId || "";
  user = s.user || null;
  canSave = !s.required || s.authed;
  done = {}; notes = {};
  if (!canSave) return;
  const st = await fetch("/api/state").then((r) => r.json());
  done = st.done || {};
  notes = st.notes || {};
}

// ---------- sidebar / drawer ----------
function renderNav() {
  const total = chapters.reduce((n, c) => n + c.topics.length, 0);
  const got = chapters.reduce((n, c) => n + chapterDone(c), 0);
  $("overall").innerHTML = canSave
    ? `${got} of ${total} topics understood<div class="bar"><div style="width:${total ? (got / total) * 100 : 0}%"></div></div>`
    : "";
  $("topbar-progress").textContent = canSave ? `${got}/${total}` : "";
  document.querySelectorAll("#nav a[data-file]").forEach((a) => {
    const c = chapters.find((x) => x.file === a.dataset.file);
    if (!c) return;
    const d = chapterDone(c);
    a.querySelector(".count").textContent = canSave ? `${d}/${c.topics.length}` : "";
    a.classList.toggle("complete", canSave && d === c.topics.length && d > 0);
  });
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
  btn.textContent = has ? "\u{1F4DD} Note ●" : "\u{1F4DD} Note";
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
      const r = await send("/api/notes", "PUT", { id, text: ta.value });
      status.textContent = r.ok ? "Saved" : r.status === 401 ? "Signed out - sign in to save" : "Not saved";
    } catch {
      status.textContent = "Not saved - offline";
    }
  };
  ta.addEventListener("input", () => { status.textContent = "Typing…"; clearTimeout(timer); timer = setTimeout(flush, 700); });
  ta.addEventListener("blur", flush);
  h.after(panel);
  return panel;
}

// ---------- topics ----------
function decorateTopics() {
  document.querySelectorAll(".pill, .note-panel").forEach((n) => n.remove());
  if (!canSave) return; // signed out: read-only, no checkboxes or notes
  document.querySelectorAll("h2[data-topic]").forEach((h) => {
    const id = h.dataset.topic;

    const label = document.createElement("label");
    label.className = "pill understood" + (done[id] ? " on" : "");
    label.innerHTML = `<input type="checkbox" ${done[id] ? "checked" : ""}> I understand this`;
    label.querySelector("input").addEventListener("change", async (e) => {
      const on = e.target.checked;
      if (on) done[id] = true; else delete done[id];
      label.classList.toggle("on", on);
      renderNav();
      try { await send("/api/progress", "PUT", { id, done: on }); } catch { /* offline: kept in memory only */ }
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

// target: { topicId } or { topic, sub, kind, locate } (from a search hit); returns true if it scrolled.
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
  if (node) { node.scrollIntoView({ block: "center" }); flash(node); return true; }
  return false;
}

// Navigate to a chapter. Within the same page we just scroll; otherwise we hand the target to the next page.
function go(file, target) {
  setMenu(false);
  if (file === CUR) { scrollToTarget(target); return; }
  try { sessionStorage.setItem("pp_target", JSON.stringify(target)); } catch { /* private mode: lands at the top */ }
  location.href = chapterUrl(file);
}

// ---------- sign-in ----------
function renderAuth() {
  const box = $("auth");
  if (!required) { box.innerHTML = ""; return; }
  if (canSave) {
    box.innerHTML = `<div class="who">Signed in as <strong>${esc((user && (user.name || user.email)) || "you")}</strong></div>
      <button type="button" class="linkbtn" id="logout">Sign out</button> ·
      <button type="button" class="linkbtn" id="delete-account">Delete my data</button>`;
    $("logout").addEventListener("click", async () => { await send("/api/logout", "POST"); await refreshAfterAuth(); });
    $("delete-account").addEventListener("click", async () => {
      if (!confirm("Delete your account and all your progress and notes? This cannot be undone.")) return;
      await send("/api/account", "DELETE");
      await refreshAfterAuth();
    });
    return;
  }
  box.innerHTML = `<div class="login">
    <div class="hint">Chapters are open to read. Sign in with Google to save progress and notes.</div>
    ${googleClientId ? '<div id="g-btn"></div>' : ""}
    <div class="err" id="login-err" role="alert"></div>
  </div>`;
  if (!googleClientId) return;
  const fail = (r) => { $("login-err").textContent = r.status === 429 ? "Too many attempts. Try again later." : r.status === 403 ? "That Google account is not allowed." : "Sign-in failed."; };
  loadGoogle().then(() => {
    google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (resp) => {
        const r = await send("/api/login", "POST", { credential: resp.credential });
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
  renderNav();
  renderAuth();
  if (PAGE === "chapter") decorateTopics();
  if (PAGE === "home") renderContinue();
}

// ---------- search ----------
async function ensureIndex() {
  if (index) return index;
  const docs = await Promise.all(
    chapters.map(async (c) => ({ file: c.file, title: c.title, md: await (await fetch(`/md/${c.file}`)).text() }))
  );
  const blocks = Search.buildIndex(docs);
  for (const [id, text] of Object.entries(notes)) {
    const file = id.split("#")[0];
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
  if (!q) { box.hidden = true; $("nav").hidden = false; return; }
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
  if (h) go(h.file, { topic: h.topic, sub: h.sub, kind: h.kind, locate: h.locate });
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
  if (!b || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
  e.preventDefault();
  const move = e.key === "ArrowDown" ? b.nextElementSibling : b.previousElementSibling;
  if (move && move.classList.contains("hit")) move.focus(); else if (e.key === "ArrowUp") $("search").focus();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
    e.preventDefault();
    setMenu(true);
    $("search").focus();
  } else if (e.key === "Escape") setMenu(false);
});

// ---------- home: continue where you left off ----------
function resumeTarget() {
  const c = firstUnfinished() || chapters[chapters.length - 1];
  const t = c.topics.find((x) => !done[x.id]);
  return { chapter: c, topic: t, url: chapterUrl(c.file) + (t ? `#${t.slug}` : "") };
}

function renderContinue() {
  const box = $("continue");
  if (!box) return;
  if (!canSave || !chapters.length) { box.innerHTML = ""; return; }
  const r = resumeTarget();
  const started = Object.keys(done).length > 0;
  box.innerHTML = `<p><a class="cta" href="${r.url}">${started ? "Continue: " : "Start: "}${esc(r.chapter.title)}${r.topic ? " › " + esc(r.topic.title) : ""}</a></p>`;
}

// ---------- startup ----------
async function init() {
  // Old links used #file.md; send them to the real chapter URL.
  const legacy = location.hash.slice(1);
  if (/^\d+-.*\.md$/.test(legacy)) { location.replace(chapterUrl(legacy)); return; }

  chapters = await fetch("/chapters.json").then((r) => r.json());
  try { await loadState(); } catch { canSave = false; }
  renderNav();
  renderAuth();

  if (PAGE === "home") {
    renderContinue();
    // Opening the site lands on the first chapter you have not finished. ?home skips that (the logo link).
    const skip = location.search.includes("home");
    if (canSave && !skip && chapters.length && (!required || Object.keys(done).length)) location.replace(resumeTarget().url);
    return;
  }
  if (PAGE !== "chapter") return;

  decorateTopics();
  let target = null;
  try {
    target = JSON.parse(sessionStorage.getItem("pp_target") || "null");
    sessionStorage.removeItem("pp_target");
  } catch { /* ignore */ }
  if (target) scrollToTarget(target);
  else if (location.hash.length > 1) {
    const h = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (h) { h.scrollIntoView({ block: "start" }); flash(h); }
  }
}

// Phone and PC share one account: pick up changes made elsewhere when this tab comes back.
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || !chapters.length || PAGE !== "chapter") return;
  if (document.activeElement && document.activeElement.tagName === "TEXTAREA") return;
  try {
    await loadState();
    index = null;
    renderNav();
    renderAuth();
    decorateTopics();
  } catch { /* offline: keep what we have */ }
});

init();
