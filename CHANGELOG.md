# Changelog

## 1.3.1

- Optional cookieless Umami visitor counter (1.3.0), enabled with `ANALYTICS_SCRIPT_URL` and `ANALYTICS_WEBSITE_ID`. It does not honor Do-Not-Track.

## 1.2.0

- Every chapter is a pre-rendered HTML page with SEO metadata, `sitemap.xml` and `robots.txt`.
- Multi-user: Google sign-in, per-account progress and notes in Postgres, account deletion.
- Local runs keep working with no login and JSON files.
- Test suite (`npm test`), CI, licenses, contribution and security documents.

## 1.1.x

- Google sign-in (ID token verified with `node:crypto`), session cookies.
- Fixes: sign-in popup (a global `open()` shadowed `window.open`), Docker image missing a module.

## 1.0.0

- First release: six chapters, search, notes, per-topic progress, mobile layout.
