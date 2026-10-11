const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createApp, configFromEnv } = require("../server");
const { FileStore, NotFound } = require("../store");
const { ROOT } = require("./helpers");

const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-pub-"));
execFileSync(process.execPath, [path.join(ROOT, "scripts", "build.js"), publicDir], { stdio: "ignore" });
const ID = "01-program-basics.md#hello-world";
const ID2 = "04-control-flow.md#loops";
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "pp-srv-"));

async function listen(app) {
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  return { base: `http://127.0.0.1:${app.address().port}`, close: () => new Promise((r) => { app.closeAllConnections(); app.close(r); }) };
}
const json = (base, p, { method = "GET", body, cookie, headers } = {}) =>
  fetch(base + p, {
    method,
    redirect: "manual",
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
const cookieOf = (res) => (res.headers.get("set-cookie") || "").split(";")[0];

// ---------------------------------------------------------------- local mode (no login)
test("local mode: state is saved and no login is needed", async () => {
  const dataDir = tmp();
  const { base, close } = await listen(createApp({ publicDir, dataDir, store: new FileStore(dataDir) }));
  try {
    assert.deepEqual(await (await json(base, "/api/session")).json(), { required: false, authed: true, googleClientId: "", user: null });
    assert.equal((await json(base, "/api/progress", { method: "PUT", body: { id: ID, done: true } })).status, 200);
    assert.equal((await json(base, "/api/notes", { method: "PUT", body: { id: ID, text: "hi" } })).status, 200);
    assert.deepEqual(await (await json(base, "/api/state")).json(), { done: { [ID]: true }, notes: { [ID]: "hi" } });
  } finally { await close(); }
});

test("static: home, chapter pages, trailing-slash redirect, 404, path traversal, health", async () => {
  const dataDir = tmp();
  const { base, close } = await listen(createApp({ publicDir, dataDir, store: new FileStore(dataDir) }));
  try {
    assert.match(await (await json(base, "/")).text(), /<h1>Polyglot Primer<\/h1>/);
    const page = await json(base, "/chapters/04-control-flow/");
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-security-policy"), /accounts\.google\.com\/gsi\/client/);
    assert.equal(page.headers.get("x-frame-options"), "DENY");
    const redirect = await json(base, "/chapters/04-control-flow");
    assert.equal(redirect.status, 301);
    assert.equal(redirect.headers.get("location"), "/chapters/04-control-flow/");
    const nf = await json(base, "/nope");
    assert.equal(nf.status, 404);
    assert.match(await nf.text(), /Page not found/);
    for (const p of ["/..%2f..%2fpackage.json", "/%2e%2e/server.js", "/..%2fserver.js"]) {
      const r = await json(base, p);
      assert.notEqual(r.status, 200, p);
      assert.ok(!(await r.text()).includes("createApp"), p);
    }
    assert.equal((await json(base, "/healthz")).status, 200);
    assert.equal((await json(base, "/sitemap.xml")).headers.get("content-type").split(";")[0], "application/xml");
  } finally { await close(); }
});

test("validation: bad ids, bad bodies, oversized notes and non-JSON posts are rejected", async () => {
  const dataDir = tmp();
  const { base, close } = await listen(createApp({ publicDir, dataDir, store: new FileStore(dataDir) }));
  try {
    for (const id of ["../x#y", "01-a.md", "01-a.md#UPPER", 5, undefined]) {
      assert.equal((await json(base, "/api/progress", { method: "PUT", body: { id, done: true } })).status, 400, String(id));
    }
    assert.equal((await json(base, "/api/progress", { method: "PUT", body: { id: ID, done: "yes" } })).status, 400);
    assert.equal((await json(base, "/api/notes", { method: "PUT", body: { id: ID, text: "x".repeat(20001) } })).status, 400);
    const form = await fetch(base + "/api/progress", { method: "PUT", headers: { "Content-Type": "text/plain" }, body: "{}" });
    assert.equal(form.status, 415);
  } finally { await close(); }
});

// ---------------------------------------------------------------- login mode, several users
class MemStore {
  constructor() { this.users = new Map(); this.bySub = new Map(); this.n = 0; }
  async init() {}
  async upsertUser({ sub, email, name }) {
    if (!this.bySub.has(sub)) {
      const id = String(++this.n);
      this.bySub.set(sub, id);
      this.users.set(id, { email, name, done: {}, notes: {} });
    }
    return this.bySub.get(sub);
  }
  async getUser(id) { const u = this.users.get(id); return u && { email: u.email, name: u.name }; }
  async getState(id) { const u = this.users.get(id); return u ? { done: { ...u.done }, notes: { ...u.notes } } : { done: {}, notes: {} }; }
  async setDone(id, t, d) { const u = this.users.get(id); if (!u) throw new NotFound("gone"); if (d) u.done[t] = true; else delete u.done[t]; }
  async setNote(id, t, text) { const u = this.users.get(id); if (!u) throw new NotFound("gone"); if (text.trim()) u.notes[t] = text; else delete u.notes[t]; }
  async deleteUser(id) { this.users.delete(id); for (const [s, i] of this.bySub) if (i === id) this.bySub.delete(s); }
}
const PEOPLE = {
  alice: { sub: "s-alice", email: "alice@x.com", name: "Alice" },
  bob: { sub: "s-bob", email: "bob@x.com", name: "Bob" },
  eve: { sub: "s-eve", email: "eve@x.com", name: "Eve" },
};
const verifyGoogle = async (tok) => { if (!PEOPLE[tok]) throw new Error("bad token"); return PEOPLE[tok]; };
const loginApp = (extra = {}) =>
  createApp({ publicDir, dataDir: tmp(), googleClientId: "cid.apps.googleusercontent.com", store: new MemStore(), verifyGoogle, ...extra });
const login = async (base, who) => {
  const r = await json(base, "/api/login", { method: "POST", body: { credential: who } });
  return { status: r.status, cookie: cookieOf(r), res: r };
};

test("login mode: chapters are public, state needs a session", async () => {
  const { base, close } = await listen(loginApp());
  try {
    assert.equal((await json(base, "/chapters/01-program-basics/")).status, 200);
    const s = await (await json(base, "/api/session")).json();
    assert.equal(s.required, true);
    assert.equal(s.authed, false);
    assert.equal(s.googleClientId, "cid.apps.googleusercontent.com");
    for (const [p, m, b] of [["/api/state", "GET"], ["/api/progress", "PUT", { id: ID, done: true }], ["/api/notes", "PUT", { id: ID, text: "x" }], ["/api/account", "DELETE"]]) {
      assert.equal((await json(base, p, { method: m, body: b })).status, 401, p);
    }
  } finally { await close(); }
});

test("two users get separate data and see only their own", async () => {
  const { base, close } = await listen(loginApp());
  try {
    const a = await login(base, "alice");
    const b = await login(base, "bob");
    assert.equal(a.status, 200);
    assert.match(a.res.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/);
    await json(base, "/api/progress", { method: "PUT", body: { id: ID, done: true }, cookie: a.cookie });
    await json(base, "/api/notes", { method: "PUT", body: { id: ID, text: "alice note" }, cookie: a.cookie });
    await json(base, "/api/progress", { method: "PUT", body: { id: ID2, done: true }, cookie: b.cookie });
    assert.deepEqual(await (await json(base, "/api/state", { cookie: a.cookie })).json(), { done: { [ID]: true }, notes: { [ID]: "alice note" } });
    assert.deepEqual(await (await json(base, "/api/state", { cookie: b.cookie })).json(), { done: { [ID2]: true }, notes: {} });
    const sess = await (await json(base, "/api/session", { cookie: a.cookie })).json();
    assert.deepEqual([sess.authed, sess.user.email], [true, "alice@x.com"]);
  } finally { await close(); }
});

test("signing in again as the same Google account reaches the same data", async () => {
  const { base, close } = await listen(loginApp());
  try {
    const first = await login(base, "alice");
    await json(base, "/api/progress", { method: "PUT", body: { id: ID, done: true }, cookie: first.cookie });
    const second = await login(base, "alice");
    assert.deepEqual((await (await json(base, "/api/state", { cookie: second.cookie })).json()).done, { [ID]: true });
  } finally { await close(); }
});

test("forged, tampered and logged-out cookies are refused", async () => {
  const { base, close } = await listen(loginApp());
  try {
    const a = await login(base, "alice");
    const [body, mac] = a.cookie.slice("pp_session=".length).split(".");
    const forged = Buffer.from(JSON.stringify({ u: "2", exp: Date.now() + 1e9 })).toString("base64url");
    for (const c of [`pp_session=${forged}.${mac}`, `pp_session=${body}.AAAA`, "pp_session=garbage", "pp_session="]) {
      assert.equal((await json(base, "/api/state", { cookie: c })).status, 401, c);
    }
    const out = await json(base, "/api/logout", { method: "POST", body: {}, cookie: a.cookie });
    assert.match(out.headers.get("set-cookie"), /Max-Age=0/);
  } finally { await close(); }
});

test("bad Google tokens are refused and repeated failures are throttled", async () => {
  const { base, close } = await listen(loginApp());
  try {
    assert.equal((await login(base, "nobody")).status, 401);
    assert.equal((await json(base, "/api/login", { method: "POST", body: {} })).status, 400);
    const form = await fetch(base + "/api/login", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "x" });
    assert.equal(form.status, 415);
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await login(base, "nobody")).status;
    assert.equal(last, 429);
  } finally { await close(); }
});

test("ALLOWED_EMAILS restricts who may sign in when set", async () => {
  const { base, close } = await listen(loginApp({ allowedEmails: new Set(["alice@x.com"]) }));
  try {
    assert.equal((await login(base, "alice")).status, 200);
    assert.equal((await login(base, "eve")).status, 403);
  } finally { await close(); }
});

test("deleting the account removes the data and invalidates the session", async () => {
  const { base, close } = await listen(loginApp());
  try {
    const a = await login(base, "alice");
    await json(base, "/api/notes", { method: "PUT", body: { id: ID, text: "bye" }, cookie: a.cookie });
    assert.equal((await json(base, "/api/account", { method: "DELETE", cookie: a.cookie })).status, 200);
    assert.equal((await (await json(base, "/api/session", { cookie: a.cookie })).json()).authed, false);
    assert.equal((await json(base, "/api/notes", { method: "PUT", body: { id: ID, text: "again" }, cookie: a.cookie })).status, 401);
    const again = await login(base, "alice");
    assert.deepEqual(await (await json(base, "/api/state", { cookie: again.cookie })).json(), { done: {}, notes: {} });
  } finally { await close(); }
});

test("a write flood from one user is rate limited", async () => {
  const { base, close } = await listen(loginApp());
  try {
    const a = await login(base, "alice");
    let last = 0;
    for (let i = 0; i < 130; i++) last = (await json(base, "/api/progress", { method: "PUT", body: { id: ID, done: i % 2 === 0 }, cookie: a.cookie })).status;
    assert.equal(last, 429);
  } finally { await close(); }
});

test("the session cookie is Secure behind an HTTPS proxy", async () => {
  const { base, close } = await listen(loginApp());
  try {
    const r = await json(base, "/api/login", { method: "POST", body: { credential: "alice" }, headers: { "X-Forwarded-Proto": "https" } });
    assert.match(r.headers.get("set-cookie"), /; Secure/);
  } finally { await close(); }
});

test("login mode refuses to start without a database", () => {
  assert.throws(() => configFromEnv({ GOOGLE_CLIENT_ID: "x" }), /DATABASE_URL/);
});

test("analytics: off by default; when configured only that script and origin join the CSP and /api/session", async () => {
  const dataDir = tmp();
  const off = await listen(createApp({ publicDir, dataDir, store: new FileStore(dataDir) }));
  try {
    const csp = (await json(off.base, "/")).headers.get("content-security-policy");
    assert.doesNotMatch(csp, /stats\.example/);
    assert.equal("analytics" in (await (await json(off.base, "/api/session")).json()), false);
  } finally { await off.close(); }

  const on = await listen(createApp({
    publicDir, dataDir, store: new FileStore(dataDir),
    analyticsScriptUrl: "https://stats.example.com/s.js", analyticsWebsiteId: "04936ad9-ccf3-4243-883e-d9cfe93d5eca",
  }));
  try {
    const csp = (await json(on.base, "/")).headers.get("content-security-policy");
    assert.match(csp, /script-src 'self' https:\/\/accounts\.google\.com\/gsi\/client https:\/\/stats\.example\.com\/s\.js;/);
    assert.match(csp, /connect-src 'self' https:\/\/accounts\.google\.com\/gsi\/ https:\/\/stats\.example\.com;/);
    assert.deepEqual((await (await json(on.base, "/api/session")).json()).analytics,
      { src: "https://stats.example.com/s.js", websiteId: "04936ad9-ccf3-4243-883e-d9cfe93d5eca" });
  } finally { await on.close(); }
});

test("analytics: half-configured or non-https settings refuse to start", () => {
  const base = { publicDir, dataDir: tmp(), store: null };
  assert.throws(() => createApp({ ...base, analyticsScriptUrl: "https://stats.example.com/s.js" }), /ANALYTICS_/);
  assert.throws(() => createApp({ ...base, analyticsWebsiteId: "04936ad9-ccf3-4243-883e-d9cfe93d5eca" }), /ANALYTICS_/);
  assert.throws(() => createApp({ ...base, analyticsScriptUrl: "http://stats.example.com/s.js", analyticsWebsiteId: "04936ad9-ccf3" }), /https/);
});
