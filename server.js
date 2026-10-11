// Polyglot Primer server: serves the pre-rendered site from public/ and a small JSON API for
// sign-in, progress and notes. See README.md for configuration.
//
//   local run   : no env needed. No login; state in DATA_DIR as JSON files (single user).
//   deployed    : GOOGLE_CLIENT_ID + DATABASE_URL. Chapters stay public; progress and notes are
//                 per Google account and need a session cookie.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createVerifier } = require("./google-auth");
const { createStore, NotFound } = require("./store");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const MAX_NOTE = 20000;
const SESSION_MS = 30 * 24 * 3600 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const validId = (id) => typeof id === "string" && id.length < 300 && /^\d+-[^#]*\.md#[a-z0-9-]+$/.test(id);

function loadKey(dataDir, secret) {
  if (secret) return crypto.createHash("sha256").update(secret).digest();
  // A random key kept next to the data (mode 600): sessions survive restarts and the key never lives in
  // git. It must never be derived from public values such as the Google client id.
  const file = path.join(dataDir, "session.key");
  try {
    const k = Buffer.from(fs.readFileSync(file, "utf8").trim(), "hex");
    if (k.length === 32) return k;
  } catch { /* first start */ }
  const k = crypto.randomBytes(32);
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, k.toString("hex"), { mode: 0o600 });
  } catch { /* read-only dir: key lives for this process only */ }
  return k;
}

// config: { publicDir, dataDir, googleClientId, allowedEmails:Set, sessionSecret, store, verifyGoogle,
//           analyticsScriptUrl, analyticsWebsiteId }
// Optional analytics (a cookieless Umami-style counter): both values or neither. The script URL and its origin are
// the only additions to the Content-Security-Policy, and the browser injects the tag (web/app.js).
function parseAnalytics(scriptUrl, websiteId) {
  if (!scriptUrl && !websiteId) return null;
  let u;
  try { u = new URL(scriptUrl); } catch { throw new Error("ANALYTICS_SCRIPT_URL must be an absolute https URL"); }
  if (u.protocol !== "https:" || !/^[0-9a-f-]{8,64}$/i.test(websiteId || "")) throw new Error("ANALYTICS_SCRIPT_URL must be https and ANALYTICS_WEBSITE_ID must be an id (both are required together)");
  return { src: u.href, origin: u.origin, websiteId };
}

function createApp(config) {
  const { publicDir, store } = config;
  const analytics = parseAnalytics(config.analyticsScriptUrl, config.analyticsWebsiteId);
  const authRequired = !!config.googleClientId;
  const allowed = config.allowedEmails || new Set();
  const verifyGoogle = authRequired ? config.verifyGoogle || createVerifier({ clientId: config.googleClientId }) : null;
  const key = authRequired ? loadKey(config.dataDir, config.sessionSecret) : null;

  // ----- session cookie: base64url(JSON{u,exp}).hmac -----
  const mac = (body) => crypto.createHmac("sha256", key).update(body).digest("base64url");
  const makeToken = (userId) => {
    const body = Buffer.from(JSON.stringify({ u: String(userId), exp: Date.now() + SESSION_MS })).toString("base64url");
    return `${body}.${mac(body)}`;
  };
  function sessionUser(req) {
    if (!authRequired) return "local";
    const c = (req.headers.cookie || "").split(/;\s*/).find((x) => x.startsWith("pp_session="));
    const [body, m] = (c ? c.slice(11) : "").split(".");
    if (!body || !m) return null;
    const a = Buffer.from(m), b = Buffer.from(mac(body));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
      const p = JSON.parse(Buffer.from(body, "base64url").toString());
      return p.exp > Date.now() && p.u ? String(p.u) : null;
    } catch { return null; }
  }
  const secure = (req) => String(req.headers["x-forwarded-proto"] || "").includes("https");
  const cookie = (req, value, maxAge) =>
    `pp_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure(req) ? "; Secure" : ""}`;
  const clientIp = (req) =>
    req.headers["cf-connecting-ip"] || String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress;

  // ----- throttles (in memory; one replica) -----
  const fails = [];
  const throttled = (ip) => {
    const now = Date.now();
    while (fails.length && now - fails[0].t > LOGIN_WINDOW_MS) fails.shift();
    return fails.length >= 40 || fails.filter((f) => f.ip === ip).length >= 8;
  };
  const writes = new Map(); // userId -> timestamps in the last minute
  const writeLimited = (u) => {
    const now = Date.now();
    const list = (writes.get(u) || []).filter((t) => now - t < 60000);
    list.push(now);
    writes.set(u, list);
    if (writes.size > 5000) writes.clear();
    return list.length > 120;
  };

  function send(res, code, body, type = "application/json", extra = {}) {
    res.writeHead(code, {
      "Content-Type": type,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      // accounts.google.com is for the Google sign-in button (script, iframe, styles, token callback).
      // The analytics entries exist only when ANALYTICS_* is configured: the one script, and its origin for the beacon.
      "Content-Security-Policy":
        `default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client${analytics ? " " + analytics.src : ""}; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; frame-src https://accounts.google.com/gsi/; connect-src 'self' https://accounts.google.com/gsi/${analytics ? " " + analytics.origin : ""}; img-src 'self' data: https://*.googleusercontent.com; frame-ancestors 'none'`,
      ...extra,
    });
    res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  }
  const api = (res, code, body, extra = {}) => send(res, code, body, "application/json", { "Cache-Control": "no-store", ...extra });

  function readBody(req, res, cb) {
    // A cross-site form cannot send application/json without a preflight, which is the CSRF defence here.
    if (!String(req.headers["content-type"] || "").startsWith("application/json")) return api(res, 415, { error: "json required" });
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on("end", () => {
      let data;
      try { data = JSON.parse(body); } catch { return api(res, 400, { error: "invalid json" }); }
      Promise.resolve(cb(data)).catch((e) => {
        if (e instanceof NotFound) return api(res, 401, { error: "sign in required" }, { "Set-Cookie": cookie(req, "", 0) });
        console.error(e);
        api(res, 500, { error: "server error" });
      });
    });
  }

  async function handleApi(req, res, p) {
    if (p === "/api/session") {
      const u = sessionUser(req);
      let user = null;
      if (authRequired && u) user = await store.getUser(u);
      const signedIn = !authRequired || !!user;
      return api(res, 200, { required: authRequired, authed: signedIn, googleClientId: config.googleClientId || "", ...(analytics && { analytics: { src: analytics.src, websiteId: analytics.websiteId } }), user: user && { email: user.email, name: user.name } });
    }

    if (p === "/api/login" && req.method === "POST") {
      if (!authRequired) return api(res, 200, { ok: true });
      const ip = clientIp(req);
      if (throttled(ip)) return api(res, 429, { error: "too many attempts, try again later" });
      return readBody(req, res, async (b) => {
        const deny = (code, error) => { fails.push({ ip, t: Date.now() }); return api(res, code, { error }); };
        if (typeof b.credential !== "string") return deny(400, "credential required");
        let who;
        try { who = await verifyGoogle(b.credential); } catch { return deny(401, "invalid google token"); }
        if (allowed.size && !allowed.has(who.email)) return deny(403, "this account is not allowed");
        const id = await store.upsertUser({ sub: who.sub, email: who.email, name: who.name });
        api(res, 200, { ok: true }, { "Set-Cookie": cookie(req, makeToken(id), SESSION_MS / 1000) });
      });
    }

    if (p === "/api/logout" && req.method === "POST") return api(res, 200, { ok: true }, { "Set-Cookie": cookie(req, "", 0) });

    // Everything below touches personal state and needs a session.
    const u = sessionUser(req);
    if (!u) return api(res, 401, { error: "sign in required" });

    if (p === "/api/state" && req.method === "GET") return api(res, 200, await store.getState(u));

    if (p === "/api/progress" && req.method === "PUT") {
      return readBody(req, res, async (b) => {
        if (!validId(b.id) || typeof b.done !== "boolean") return api(res, 400, { error: "bad request" });
        if (writeLimited(u)) return api(res, 429, { error: "slow down" });
        await store.setDone(u, b.id, b.done);
        api(res, 200, { ok: true });
      });
    }

    if (p === "/api/notes" && req.method === "PUT") {
      return readBody(req, res, async (b) => {
        if (!validId(b.id) || typeof b.text !== "string" || b.text.length > MAX_NOTE) return api(res, 400, { error: "bad request" });
        if (writeLimited(u)) return api(res, 429, { error: "slow down" });
        try { await store.setNote(u, b.id, b.text); } catch (e) {
          if (e.message === "too many notes") return api(res, 400, { error: "too many notes" });
          throw e;
        }
        api(res, 200, { ok: true });
      });
    }

    // Deletes the account and everything stored for it.
    if (p === "/api/account" && req.method === "DELETE") {
      await store.deleteUser(u);
      return api(res, 200, { ok: true }, { "Set-Cookie": cookie(req, "", 0) });
    }

    return api(res, 404, { error: "not found" });
  }

  function serveStatic(req, res, p) {
    const rel = p.replace(/^\/+/, "");
    let full = path.join(publicDir, rel);
    if (full !== publicDir && !full.startsWith(publicDir + path.sep)) return send(res, 400, "Bad request", "text/plain");
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
      if (!p.endsWith("/")) return send(res, 301, "", "text/plain", { Location: p + "/" });
      full = path.join(full, "index.html");
    }
    if (!fs.existsSync(full)) {
      const nf = path.join(publicDir, "404.html");
      const has = fs.existsSync(nf);
      return send(res, 404, has ? fs.readFileSync(nf) : "Not found", has ? MIME[".html"] : "text/plain", { "Cache-Control": "no-store" });
    }
    // Short caching: pages are tiny, and a redeploy should show up within minutes.
    send(res, 200, fs.readFileSync(full), MIME[path.extname(full)] || "application/octet-stream", { "Cache-Control": "public, max-age=300" });
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      let p;
      try { p = decodeURIComponent(url.pathname); } catch { return send(res, 400, "Bad request", "text/plain"); }
      if (p === "/healthz") return api(res, 200, { ok: true });
      if (p.startsWith("/api/")) return await handleApi(req, res, p);
      if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed", "text/plain");
      serveStatic(req, res, p);
    } catch (e) {
      if (e instanceof NotFound) return api(res, 401, { error: "sign in required" });
      console.error(e);
      if (!res.headersSent) api(res, 500, { error: "server error" });
    }
  });
}

function configFromEnv(env = process.env, root = __dirname) {
  const googleClientId = env.GOOGLE_CLIENT_ID || "";
  if (googleClientId && !env.DATABASE_URL) throw new Error("GOOGLE_CLIENT_ID requires DATABASE_URL: signed-in users need somewhere to keep their data");
  const dataDir = env.DATA_DIR || root;
  return {
    port: Number(env.PORT) || 4321,
    host: env.HOST || "127.0.0.1",
    publicDir: path.join(root, "public"),
    dataDir,
    googleClientId,
    allowedEmails: new Set((env.ALLOWED_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)),
    sessionSecret: env.SESSION_SECRET || "",
    analyticsScriptUrl: env.ANALYTICS_SCRIPT_URL || "",
    analyticsWebsiteId: env.ANALYTICS_WEBSITE_ID || "",
    store: createStore({ databaseUrl: env.DATABASE_URL, dataDir }),
  };
}

if (require.main === module) {
  (async () => {
    const cfg = configFromEnv();
    if (!fs.existsSync(path.join(cfg.publicDir, "index.html"))) {
      console.error("public/ is missing: run `npm run build` first (npm start does it for you)");
      process.exit(1);
    }
    await cfg.store.init();
    createApp(cfg).listen(cfg.port, cfg.host, () => {
      console.log(`Polyglot Primer at http://${cfg.host}:${cfg.port} (store: ${process.env.DATABASE_URL ? "postgres" : "files in " + cfg.dataDir}, login ${cfg.googleClientId ? "google" : "off"})`);
    });
  })().catch((e) => { console.error(e.message); process.exit(1); });
}

module.exports = { createApp, configFromEnv };
