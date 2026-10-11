// Zero-dependency study server: serves web/, lists chapters/, persists progress and notes.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createVerifier } = require("./google-auth");

const PORT = Number(process.env.PORT) || 4321;
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = __dirname;
const CHAPTERS = path.join(ROOT, "chapters");
const WEB = path.join(ROOT, "web");
// DATA_DIR is where user state lives (a mounted volume when deployed).
const DATA_DIR = process.env.DATA_DIR || ROOT;
const PROGRESS = path.join(DATA_DIR, "progress.json");
const NOTES = path.join(DATA_DIR, "notes.json");
const MAX_NOTE = 20000;

// Optional login gate. With AUTH_PASSWORD unset (local use) everything is open. With it set,
// chapters stay readable by anyone but progress and notes need a session cookie. Changing the
// password invalidates every session, because the signing key is derived from it.
// Google sign-in (same pattern as tickoff/sync-todo): GOOGLE_CLIENT_ID enables it, and only the
// addresses in ALLOWED_EMAILS get a session - without that list any Google account would be let in.
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const ALLOWED_EMAILS = new Set((process.env.ALLOWED_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
const AUTH_REQUIRED = !!(AUTH_PASSWORD || GOOGLE_CLIENT_ID);
const verifyGoogle = GOOGLE_CLIENT_ID ? createVerifier({ clientId: GOOGLE_CLIENT_ID }) : null;
if (GOOGLE_CLIENT_ID && !ALLOWED_EMAILS.size) console.error("GOOGLE_CLIENT_ID is set but ALLOWED_EMAILS is empty: nobody can sign in with Google");
// Session key: SESSION_SECRET if given, else the password, so rotating either signs everyone out.
const KEY = crypto.createHash("sha256").update("polyglot-primer|" + (process.env.SESSION_SECRET || AUTH_PASSWORD || GOOGLE_CLIENT_ID)).digest();
const SESSION_MS = 30 * 24 * 3600 * 1000;
const sha = (s) => crypto.createHash("sha256").update(s).digest();
const mac = (exp) => crypto.createHmac("sha256", KEY).update(String(exp)).digest("base64url");
const makeToken = () => { const exp = Date.now() + SESSION_MS; return `${exp}.${mac(exp)}`; };
function validToken(tok) {
  const [exp, m] = (tok || "").split(".");
  if (!/^\d+$/.test(exp || "") || !m || Number(exp) < Date.now()) return false;
  const a = Buffer.from(m), b = Buffer.from(mac(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function sessionCookie(req) {
  const c = (req.headers.cookie || "").split(/;\s*/).find((x) => x.startsWith("pp_session="));
  return c ? c.slice("pp_session=".length) : "";
}
const authed = (req) => !AUTH_REQUIRED || validToken(sessionCookie(req));
const secure = (req) => String(req.headers["x-forwarded-proto"] || "").includes("https");
const clientIp = (req) => req.headers["cf-connecting-ip"] || String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress;

// Failed-login throttle: 8 per IP and 40 overall per 15 minutes.
const WINDOW = 15 * 60 * 1000;
const fails = [];
function throttled(ip) {
  const now = Date.now();
  while (fails.length && now - fails[0].t > WINDOW) fails.shift();
  return fails.length >= 40 || fails.filter((f) => f.ip === ip).length >= 8;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

// Must match slugify() in web/app.js — topic ids are "<chapter-file>#<slug>".
function slugify(s) {
  return s.toLowerCase().replace(/`/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function listChapters() {
  return fs
    .readdirSync(CHAPTERS)
    .filter((f) => /^\d+-.*\.md$/.test(f))
    .sort()
    .map((file) => {
      const text = fs.readFileSync(path.join(CHAPTERS, file), "utf8");
      const title = (text.match(/^#\s+(.+)$/m) || [null, file])[1];
      const topics = [];
      let inFence = false;
      for (const line of text.split(/\r?\n/)) {
        if (line.startsWith("```")) inFence = !inFence;
        const m = !inFence && line.match(/^##\s+(.+)$/);
        if (m) topics.push({ id: `${file}#${slugify(m[1])}`, title: m[1] });
      }
      return { file, title, topics };
    });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

// Write-then-rename so a crash mid-write cannot leave a truncated state file.
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function send(res, code, body, type = "application/json", extra = {}) {
  res.writeHead(code, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    // accounts.google.com is for the Google sign-in button (script, iframe, styles, token callback).
    "Content-Security-Policy": "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; frame-src https://accounts.google.com/gsi/; connect-src 'self' https://accounts.google.com/gsi/; img-src 'self' data: https://*.googleusercontent.com; frame-ancestors 'none'",
    ...extra,
  });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req, res, cb) {
  if (!String(req.headers["content-type"] || "").startsWith("application/json")) return send(res, 415, { error: "json required" });
  let body = "";
  req.on("data", (c) => {
    body += c;
    if (body.length > 1e5) req.destroy();
  });
  req.on("end", () => {
    try {
      cb(JSON.parse(body));
    } catch {
      send(res, 400, { error: "invalid json" });
    }
  });
}

const validId = (id) => typeof id === "string" && id.length < 300 && /^\d+-[^#]*\.md#[a-z0-9-]+$/.test(id);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = decodeURIComponent(url.pathname);

  if (p === "/healthz") return send(res, 200, { ok: true });
  if (p === "/api/chapters") return send(res, 200, listChapters());

  if (p === "/api/session") return send(res, 200, { required: AUTH_REQUIRED, authed: authed(req), googleClientId: GOOGLE_CLIENT_ID, password: !!AUTH_PASSWORD });

  if (p === "/api/login" && req.method === "POST") {
    if (!AUTH_REQUIRED) return send(res, 200, { ok: true });
    const ip = clientIp(req);
    if (throttled(ip)) return send(res, 429, { error: "too many attempts, try again later" });
    const grant = () => {
      const cookie = `pp_session=${makeToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MS / 1000}${secure(req) ? "; Secure" : ""}`;
      send(res, 200, { ok: true }, "application/json", { "Set-Cookie": cookie });
    };
    const deny = (code, error) => { fails.push({ ip, t: Date.now() }); send(res, code, { error }); };
    return readBody(req, res, async (b) => {
      if (typeof b.credential === "string") {
        if (!verifyGoogle) return deny(400, "google sign-in is not enabled");
        let who;
        try { who = await verifyGoogle(b.credential); } catch { return deny(401, "invalid google token"); }
        if (!ALLOWED_EMAILS.has(who.email)) return deny(403, "this account is not allowed");
        return grant();
      }
      const ok = AUTH_PASSWORD && typeof b.password === "string" && crypto.timingSafeEqual(sha(b.password), sha(AUTH_PASSWORD));
      return ok ? grant() : deny(401, "wrong password");
    });
  }

  if (p === "/api/logout" && req.method === "POST") {
    return send(res, 200, { ok: true }, "application/json", { "Set-Cookie": "pp_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" });
  }

  // Everything below that touches personal state needs a session when a password is set.
  if ((p === "/api/progress" || p === "/api/notes") && !authed(req)) return send(res, 401, { error: "sign in required" });

  if (p.startsWith("/api/chapter/")) {
    const file = path.basename(p.slice("/api/chapter/".length));
    const full = path.join(CHAPTERS, file);
    if (!/^\d+-.*\.md$/.test(file) || !fs.existsSync(full)) return send(res, 404, { error: "not found" });
    return send(res, 200, fs.readFileSync(full), "text/markdown; charset=utf-8");
  }

  // Progress: GET returns { done: { id: true } }; PUT { id, done } toggles ONE topic so two
  // devices ticking different topics do not overwrite each other.
  if (p === "/api/progress") {
    if (req.method === "GET") return send(res, 200, readJson(PROGRESS, { done: {} }));
    if (req.method === "PUT") {
      return readBody(req, res, (b) => {
        if (!validId(b.id) || typeof b.done !== "boolean") return send(res, 400, { error: "bad request" });
        const state = readJson(PROGRESS, { done: {} });
        if (b.done) state.done[b.id] = true;
        else delete state.done[b.id];
        writeJson(PROGRESS, state);
        send(res, 200, { ok: true });
      });
    }
    return send(res, 405, { error: "method not allowed" });
  }

  // Notes: GET returns { notes: { id: text } }; PUT { id, text } sets one note ("" deletes it).
  if (p === "/api/notes") {
    if (req.method === "GET") return send(res, 200, readJson(NOTES, { notes: {} }));
    if (req.method === "PUT") {
      return readBody(req, res, (b) => {
        if (!validId(b.id) || typeof b.text !== "string" || b.text.length > MAX_NOTE) {
          return send(res, 400, { error: "bad request" });
        }
        const state = readJson(NOTES, { notes: {} });
        if (b.text.trim()) state.notes[b.id] = b.text;
        else delete state.notes[b.id];
        writeJson(NOTES, state);
        send(res, 200, { ok: true });
      });
    }
    return send(res, 405, { error: "method not allowed" });
  }

  // Static files from web/
  const rel = p === "/" ? "index.html" : p.replace(/^\/+/, "");
  const full = path.join(WEB, rel);
  if (!full.startsWith(WEB + path.sep) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    return send(res, 404, "Not found", "text/plain");
  }
  send(res, 200, fs.readFileSync(full), MIME[path.extname(full)] || "application/octet-stream");
});

server.listen(PORT, HOST, () => {
  console.log(`Polyglot Primer running at http://${HOST}:${PORT} (data: ${DATA_DIR}, login ${AUTH_REQUIRED ? "required" : "off"})`);
});
