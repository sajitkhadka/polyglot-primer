# Security policy

## Reporting a vulnerability

Please report security problems privately, not in a public issue: use **Security > Report a vulnerability**
on the GitHub repository (a private security advisory). Include what you found, how to reproduce it, and the
version or commit. You should get a first response within about a week.

## Scope and design notes

The site is small, but a public deployment keeps user data, so these are the properties worth testing:

- Chapters are public. Progress and notes are per Google account and need a signed session cookie
  (`HttpOnly`, `SameSite=Lax`, `Secure` behind HTTPS).
- Google ID tokens are verified server-side (signature, issuer, audience, expiry, verified email) with
  `node:crypto`. The client ID is public; no client secret is used.
- State-changing API calls require `Content-Type: application/json`, which cross-site forms cannot send.
- Login attempts and writes are rate limited in memory (single instance).
- The session signing key is random, generated on first start (or `SESSION_SECRET`), and never derived from
  public values.
- A strict Content-Security-Policy allows scripts only from this origin and Google's sign-in script.

Out of scope: denial of service by volume against a small self-hosted instance, and findings that need a
compromised host or database.
