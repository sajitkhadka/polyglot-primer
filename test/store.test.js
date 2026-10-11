const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { FileStore, PgStore } = require("../store");

const ID = "01-program-basics.md#hello-world";

async function roundTrip(store) {
  await store.init();
  const a = await store.upsertUser({ sub: "sub-a-" + Date.now(), email: "a@x.com", name: "A" });
  await store.setDone(a, ID, true);
  await store.setNote(a, ID, "my note");
  assert.deepEqual(await store.getState(a), { done: { [ID]: true }, notes: { [ID]: "my note" } });
  await store.setDone(a, ID, false);
  await store.setNote(a, ID, "   ");
  assert.deepEqual(await store.getState(a), { done: {}, notes: {} });
  return a;
}

test("FileStore round-trips progress and notes and survives a restart", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-store-"));
  const s = new FileStore(dir);
  await s.init();
  await s.setDone("local", ID, true);
  await s.setNote("local", ID, "n");
  const again = new FileStore(dir);
  assert.deepEqual(await again.getState("local"), { done: { [ID]: true }, notes: { [ID]: "n" } });
  await roundTrip(new FileStore(fs.mkdtempSync(path.join(os.tmpdir(), "pp-store-"))));
  await again.deleteUser();
  assert.deepEqual(await again.getState(), { done: {}, notes: {} });
});

// Runs against a real database only when one is provided, e.g.
//   TEST_DATABASE_URL=postgres://user:pass@localhost:5432/scratch npm test
test("PgStore (needs TEST_DATABASE_URL)", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const { Pool } = require("pg");
  const s = new PgStore(process.env.TEST_DATABASE_URL, Pool);
  try {
    const a = await roundTrip(s);
    const b = await s.upsertUser({ sub: "sub-b-" + Date.now(), email: "b@x.com", name: "B" });
    await s.setNote(a, ID, "only a");
    assert.deepEqual((await s.getState(b)).notes, {}, "users must not see each other's data");
    assert.equal(await s.upsertUser({ sub: "x", email: "e", name: "n" }), await s.upsertUser({ sub: "x", email: "e2", name: "n" }), "same sub, same user");
    await s.deleteUser(a);
    assert.equal(await s.getUser(a), null);
    assert.deepEqual(await s.getState(a), { done: {}, notes: {} }, "deleting a user removes their rows");
    await s.deleteUser(b);
  } finally {
    await s.close();
  }
});
