# Privacy

This is a small hobby project. This page says exactly what the site keeps, in plain language.

## Reading the site

You do not need an account to read any chapter. The server does not set cookies for readers, and the site has
no advertising or tracking scripts. The person running a copy of the site can optionally switch on a privacy-friendly
visitor counter (a self-hosted Umami); where that is on, it records the page, the referrer, your browser and
approximate country, sets no cookies, does not honor Do-Not-Track (it collects no personal data), and is not shared with anyone. Like any web server, it may keep ordinary access logs (IP address,
page, time) for a short period for debugging and abuse prevention.

## If you sign in

Signing in is optional and only needed to save your progress and notes. It uses Google Sign-In, which loads a
script from Google while the sign-in button is shown. When you sign in the site stores:

- your Google account's stable ID, email address and display name, so your data can be attached to you;
- which topics you marked as understood, with the time;
- the notes you wrote, with the time they were last changed.

It also sets a single cookie (`pp_session`) that keeps you signed in. It is `HttpOnly` and lasts 30 days.

Your data is used only to show you your own progress and notes. It is not sold, shared or used for advertising.
Your notes are private to your account; they are stored as plain text in the site's database and the person who
runs the site can technically read the database, so do not put secrets in them.

## Deleting your data

Use **Delete my data** in the sidebar while signed in. It removes your account, your progress and your notes
from the database immediately. You can also just sign out; that only removes the cookie.

## Contact

Open an issue on the project's GitHub repository, or use a private security advisory for anything sensitive.
