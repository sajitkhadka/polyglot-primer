const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createVerifier } = require("../google-auth");

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (claims, kid = "k1", key = privateKey) => {
  const h = b64({ alg: "RS256", kid, typ: "JWT" }), p = b64(claims);
  return `${h}.${p}.${crypto.sign("RSA-SHA256", Buffer.from(`${h}.${p}`), key).toString("base64url")}`;
};
const good = () => ({ iss: "https://accounts.google.com", aud: "cid", sub: "123", exp: Math.floor(Date.now() / 1000) + 600, email: "Me@X.com", email_verified: true, name: "Me" });
const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;

test("accepts a valid token and normalises the email", async () => {
  const v = createVerifier({ clientId: "cid", fetchJwks: async () => [jwk] });
  assert.deepEqual(await v(sign(good())), { sub: "123", email: "me@x.com", name: "Me" });
});

const bad = {
  "wrong audience": () => sign({ ...good(), aud: "other" }),
  "expired": () => sign({ ...good(), exp: 1 }),
  "wrong issuer": () => sign({ ...good(), iss: "https://evil.example" }),
  "unverified email": () => sign({ ...good(), email_verified: false }),
  "missing subject": () => sign({ ...good(), sub: undefined }),
  "forged signature": () => sign(good(), "k1", other),
  "unknown key id": () => sign(good(), "nope"),
  "alg none": () => `${b64({ alg: "none" })}.${b64(good())}.`,
  "garbage": () => "abc",
};
for (const [name, make] of Object.entries(bad)) {
  test(`rejects: ${name}`, async () => {
    const v = createVerifier({ clientId: "cid", fetchJwks: async () => [jwk] });
    await assert.rejects(v(make()));
  });
}

test("refetches keys once when the key id is unknown (key rotation)", async () => {
  let calls = 0;
  const v = createVerifier({ clientId: "cid", fetchJwks: async () => (calls++, calls === 1 ? [] : [jwk]) });
  assert.equal((await v(sign(good()))).sub, "123");
  assert.equal(calls, 2);
});
