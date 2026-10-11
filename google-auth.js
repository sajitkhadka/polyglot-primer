// Verifies a Google Identity Services ID token (RS256 JWT) with node:crypto only.
// Same flow as tickoff and sync-todo: the browser gets the token from Google, the server checks
// the signature against Google's published keys, then issues its own session cookie.
const crypto = require("crypto");

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const KEY_TTL_MS = 3600 * 1000;

async function defaultFetchJwks() {
  const r = await fetch(JWKS_URL);
  if (!r.ok) throw new Error(`jwks fetch failed: ${r.status}`);
  return (await r.json()).keys || [];
}

// Returns async (idToken) => { email, name } or throws. fetchJwks/now are injectable for tests.
function createVerifier({ clientId, fetchJwks = defaultFetchJwks, now = Date.now }) {
  let keys = [];
  let fetchedAt = 0;

  async function keyFor(kid, force) {
    if (force || !keys.length || now() - fetchedAt > KEY_TTL_MS) {
      keys = await fetchJwks();
      fetchedAt = now();
    }
    return keys.find((k) => k.kid === kid);
  }

  return async function verify(idToken) {
    const parts = String(idToken).split(".");
    if (parts.length !== 3) throw new Error("malformed token");
    const [h, p, s] = parts;
    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    if (header.alg !== "RS256") throw new Error("unexpected alg");

    // An unknown kid usually means Google rotated keys: refetch once before giving up.
    const jwk = (await keyFor(header.kid, false)) || (await keyFor(header.kid, true));
    if (!jwk) throw new Error("unknown signing key");

    const ok = crypto.verify("RSA-SHA256", Buffer.from(`${h}.${p}`), crypto.createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(s, "base64url"));
    if (!ok) throw new Error("bad signature");

    const c = JSON.parse(Buffer.from(p, "base64url").toString());
    if (!ISSUERS.has(c.iss)) throw new Error("bad issuer");
    if (c.aud !== clientId) throw new Error("bad audience");
    if (!c.exp || c.exp * 1000 < now()) throw new Error("token expired");
    if (!c.email || c.email_verified !== true) throw new Error("email not verified");
    return { email: String(c.email).toLowerCase(), name: c.name || c.email };
  };
}

module.exports = { createVerifier };
