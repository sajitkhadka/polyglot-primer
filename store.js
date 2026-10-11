// Persistence for progress and notes, behind one async interface with two backends:
//   FileStore  - progress.json / notes.json in DATA_DIR; single user, used for local runs.
//   PgStore    - Postgres; one row set per signed-in Google user. Used when DATABASE_URL is set.
//
// Interface (userId is ignored by FileStore):
//   init()
//   upsertUser({ sub, email, name }) -> userId
//   getUser(userId)                  -> { email, name } | null
//   getState(userId)                 -> { done: { id: true }, notes: { id: text } }
//   setDone(userId, id, done)
//   setNote(userId, id, text)        ("" deletes)
//   deleteUser(userId)               (removes the account and everything stored for it)
const fs = require("fs");
const path = require("path");

const MAX_NOTES_PER_USER = 500;

class NotFound extends Error {}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

// Write-then-rename so a crash mid-write cannot leave a truncated state file.
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

class FileStore {
  constructor(dir) {
    this.progress = path.join(dir, "progress.json");
    this.notes = path.join(dir, "notes.json");
  }
  async init() {}
  async upsertUser() { return "local"; }
  async getUser() { return { email: "", name: "local" }; }
  async getState() {
    return { done: readJson(this.progress, { done: {} }).done || {}, notes: readJson(this.notes, { notes: {} }).notes || {} };
  }
  async setDone(_u, id, done) {
    const s = readJson(this.progress, { done: {} });
    if (done) s.done[id] = true; else delete s.done[id];
    writeJson(this.progress, s);
  }
  async setNote(_u, id, text) {
    const s = readJson(this.notes, { notes: {} });
    if (text.trim()) s.notes[id] = text; else delete s.notes[id];
    writeJson(this.notes, s);
  }
  async deleteUser() {
    for (const f of [this.progress, this.notes]) fs.rmSync(f, { force: true });
  }
  async close() {}
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id          BIGSERIAL PRIMARY KEY,
  google_sub  TEXT NOT NULL UNIQUE,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS progress (
  user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id  TEXT   NOT NULL,
  done_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);
CREATE TABLE IF NOT EXISTS notes (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id   TEXT   NOT NULL,
  body       TEXT   NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);
`;

class PgStore {
  constructor(url, Pool) {
    this.pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30000 });
  }
  async init() { await this.pool.query(SCHEMA); }
  async upsertUser({ sub, email, name }) {
    const r = await this.pool.query(
      `INSERT INTO users (google_sub, email, name) VALUES ($1, $2, $3)
       ON CONFLICT (google_sub) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, last_login = now()
       RETURNING id`,
      [sub, email, name]
    );
    return String(r.rows[0].id);
  }
  async getUser(id) {
    const r = await this.pool.query("SELECT email, name FROM users WHERE id = $1", [id]);
    return r.rows[0] || null;
  }
  async getState(id) {
    const [p, n] = await Promise.all([
      this.pool.query("SELECT topic_id FROM progress WHERE user_id = $1", [id]),
      this.pool.query("SELECT topic_id, body FROM notes WHERE user_id = $1", [id]),
    ]);
    return {
      done: Object.fromEntries(p.rows.map((r) => [r.topic_id, true])),
      notes: Object.fromEntries(n.rows.map((r) => [r.topic_id, r.body])),
    };
  }
  async setDone(id, topic, done) {
    try {
      if (done) await this.pool.query("INSERT INTO progress (user_id, topic_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [id, topic]);
      else await this.pool.query("DELETE FROM progress WHERE user_id = $1 AND topic_id = $2", [id, topic]);
    } catch (e) { throw e.code === "23503" ? new NotFound("user gone") : e; }
  }
  async setNote(id, topic, text) {
    try {
      if (!text.trim()) return void (await this.pool.query("DELETE FROM notes WHERE user_id = $1 AND topic_id = $2", [id, topic]));
      const c = await this.pool.query("SELECT count(*)::int AS n FROM notes WHERE user_id = $1 AND topic_id <> $2", [id, topic]);
      if (c.rows[0].n >= MAX_NOTES_PER_USER) throw new Error("too many notes");
      await this.pool.query(
        `INSERT INTO notes (user_id, topic_id, body) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, topic_id) DO UPDATE SET body = EXCLUDED.body, updated_at = now()`,
        [id, topic, text]
      );
    } catch (e) { throw e.code === "23503" ? new NotFound("user gone") : e; }
  }
  async deleteUser(id) { await this.pool.query("DELETE FROM users WHERE id = $1", [id]); }
  async close() { await this.pool.end(); }
}

// pg is the project's only dependency and is only loaded when a database is configured.
function createStore({ databaseUrl, dataDir }) {
  if (!databaseUrl) return new FileStore(dataDir);
  const { Pool } = require("pg");
  return new PgStore(databaseUrl, Pool);
}

module.exports = { createStore, FileStore, PgStore, NotFound, MAX_NOTES_PER_USER };
