# Phase 36: E-mail to admins about new sign-ups

**Branch:** `feature/signup-emails` (from `develop`)
**Commit:** `Email admins when a new sign-up waits for approval`
**Skills to load:** `server-api`, `database`, `web-ui`, `i18n`, `verification`, `browser-checks`, `git-workflow`

## Goal

When someone signs up as a host on `/register`, the admin gets an e-mail with a link to the app, opens it on a phone from anywhere, logs in and approves or rejects the sign-up on the Users page.

Phase 26 kept e-mail out of scope; the user asked for this before the first deploy (21 October 2026).

## Decisions (21 October 2026)

1. **Delivery: Brevo's HTTPS API** (`POST https://api.brevo.com/v3/smtp/email`, `api-key` header). Railway's Hobby plan blocks outbound SMTP (ports 25, 465, 587, 2525), so SMTP is not an option there. Brevo is a French company with EU data centres; the free plan (300 e-mails a day) is far above the need.
2. **The address is set in the app**, per admin, in My settings (Account tab, admins only). Every admin who set an address gets the e-mail. Stored in a new nullable column `host_settings.signup_notify_email`, deleted with the account.
3. **Content: the number of waiting sign-ups and the link only.** No username: it is text a stranger chose, so it never reaches the admin's inbox, and the e-mail carries no personal data of the person signing up.
4. **Throttled:** the first sign-up sends at once; further ones within the next 15 minutes are gathered into one e-mail sent when the 15 minutes are over, with the number waiting at that moment (none when the admin has already handled them all).

## Security and compliance notes

- **Compliance review needed:** Brevo is a third-party service and a processor under the GDPR (it handles the admin's e-mail address). Before use: a data processing agreement with Brevo (its standard DPA), and the privacy page names it as a processor (`MAIL_PROVIDER` text next to `HOSTING_PROVIDER`). For any government or client deployment this needs a separate compliance review.
- **No action links in the e-mail.** The link opens `${APP_ORIGIN}/host/users`; approving still needs the admin's login (and passes the screen lock). A forwarded or leaked e-mail cannot approve anyone.
- **Secrets in server settings only:** `BREVO_API_KEY` and `MAIL_FROM` (a sender address verified in Brevo) are environment variables; neither is sent to the browser or logged. Without them, nothing is sent and the settings section says that e-mail is not set up on this server.
- **The address**: validated with Zod (`z.string().trim().email().max(200)`), shown only to its own admin, never in logs (log lines say "sign-up e-mail sent" or the provider's status code), never in any other API response. It is ignored while the account is not an admin; demoting an admin clears it.
- **Sending never blocks or fails a sign-up**: it runs after the response, with a 10 s timeout; errors are logged without the address. The register route's limits (5 an hour per IP, `MAX_PENDING_SIGNUPS`) and the throttle cap the volume.
- **Return after login**: the host layout sends a logged-out visitor to `/login?redirect=<path>`, and login goes there afterwards only if the path starts with `/host/` (not `//`, no scheme): no open redirect.
- **"Send a test e-mail"** in the settings section, limited to 3 an hour, so the admin can check the address and the provider set-up.

## Scope

In:
- Config: `BREVO_API_KEY`, `MAIL_FROM` (both optional, `emptyAsUnset`), `MAIL_PROVIDER` (privacy page text), in `config.ts`, `.env.example` and `docs/deploy.md`.
- Database: migration adding `host_settings.signup_notify_email` (nullable text).
- Server: `src/mail.ts` (one `sendMail({ to, subject, text, html })` over `fetch` to Brevo, and a no-op when not configured); `src/signup-notify.ts` (the throttle, counting pending sign-ups, collecting admin addresses, the bilingual Hungarian and English text with the link); a call after a successful `POST /api/auth/register`; admin-only `GET` (`{ email, mailConfigured }`), `PUT` and `DELETE /api/me/signup-email` and `POST /api/me/signup-email/test`; clearing the address when an admin is demoted; the address in "Download my data".
- Web: an admin-only "Sign-up e-mails" section in My settings (Account), with the address, Save, Remove, "Send a test e-mail" and the not-configured note; the `redirect` search param on `/login` and in the host layout's 401 redirect. Texts in `hu.json` and `en.json`; privacy page processor line.
- Tests: `mail.ts` with a stubbed `fetch` (request shape, no-op without a key, timeout); the throttle and text; routes (admin only, validation, delete, test e-mail limit, no address in other responses); register triggers one notification and a burst triggers one; the login redirect's path check (unit test); an e2e step that sets and removes the address.

Out: e-mails to the person who signed up (verification, approval notice), password reset by e-mail, other notifications, SMTP, a second provider, approve or reject links in the e-mail.

## Steps

1. Config and `mail.ts`. Check: unit tests with a stubbed `fetch`.
2. Migration and the `/api/me/signup-email` routes, demotion clears the address. Check: `me.test.ts` and `users` tests against Postgres.
3. `signup-notify.ts` and the register hook. Check: `signup.test.ts` (one e-mail, the burst, nothing without addresses or config, a failing provider does not fail the sign-up).
4. Web: settings section, login redirect. Check: screenshots of the section (phone and laptop, light and dark, Hungarian and English); logged out, open `/host/users`, log in, land on Users.
5. Privacy page, `docs/deploy.md` (Brevo account, verified sender, DPA, the variables), `docs/security-notes.md`, skills (`server-api`), CHANGELOG, backlog, README row. Check: full e2e on the production build.
6. A real send through Brevo, done by the user with their own account (the agent has no key). Check: the e-mail arrives and its link opens the Users page on a phone.

## Done when

- A sign-up sends one e-mail to every admin with an address, within seconds; a burst within 15 minutes sends one.
- The e-mail holds the count and the link, no username; the link leads to the Users page after login.
- Without `BREVO_API_KEY` nothing is sent, nothing fails, and the settings say e-mail is not set up.
- The address is visible only to its admin and never logged.
- `pnpm verify` passes, the server tests pass against Postgres, the full e2e suite passes on the production build.

## Verification command

```powershell
pnpm verify
$env:TEST_DATABASE_URL="postgres://quizmoo:quizmoo@localhost:5432/quizmoo"; pnpm --filter @quizmoo/server test
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e
```

## Manual test list (draft)

1. Create a free Brevo account, verify a sender address, create an API key. Put `BREVO_API_KEY` and `MAIL_FROM` in `.env`, `REGISTRATION_OPEN=true`, restart.
2. As admin, My settings, Account: enter your address, Save, "Send a test e-mail": it arrives.
3. In a private window, sign up on `/register`: within a minute an e-mail says one sign-up is waiting.
4. Sign up again right away: no second e-mail. After 15 minutes another sign-up sends one saying two are waiting.
5. Open the link on your phone while logged out: log in, you land on Users with the waiting sign-ups; approve one, reject the other.
6. Remove the address: further sign-ups send nothing.
7. Without `BREVO_API_KEY`: the section says e-mail is not set up; sign-up still works.
8. As an editor: the section is not there.

## Results

- Server: `BREVO_API_KEY`, `MAIL_FROM`, `MAIL_PROVIDER` in `config.ts`; `src/mail.ts` (Brevo over `fetch`, 10 s timeout, errors without the provider's answer); `src/signup-notify.ts` (one e-mail per admin, count and link only, 15-minute throttle with a trailing send, HU and EN text); the register route calls it after storing the sign-up; migration `0013` adds `host_settings.signup_notify_email`; admin-only `GET` / `PUT` / `DELETE /api/me/signup-email` and `POST /api/me/signup-email/test` (3 an hour); demoting an admin clears the address; "Download my data" includes it; `/api/site` gives `mailProvider`.
- Web: "Sign-up e-mails" in My settings, Account (admins only) with the not-set-up note, Save, Remove and "Send a test e-mail"; `/login?redirect=` back to a `/host` path (`lib/redirect.ts`); the privacy notice names the e-mail provider and the admin's address.
- Tests: `test/mail.test.ts` (4), `test/signup-email.test.ts` (10: the routes, admin only, validation, no address in other responses, export, demotion, test e-mail and its limit, provider failure, one e-mail per admin without the username, the burst, the trailing e-mail), `src/lib/redirect.test.ts` (2), a step in `e2e/admin-users.e2e.ts`. All 476 server tests pass against Postgres, `pnpm verify` passes (web 235), the full e2e suite (22 specs) passes on the production build.
- Screenshots: the section on a phone (error, saved) and a laptop, light English and dark Hungarian, and without a key; logged out, `/host/users` leads to `/login?redirect=%2Fhost%2Fusers` and back after login.
- Docs: `.env.example`, `docker-compose.yml`, `docs/deploy.md` (Brevo set-up with the compliance note), `docs/legal/records-of-processing.md`, `docs/security-notes.md`, README, the `server-api` skill.

## Deviations

- **Throttle with a trailing e-mail** (decided before coding): sign-ups inside the 15 minutes are counted in one e-mail at the end of them, instead of waiting for the next sign-up, which might never come.
- **Own endpoint** `GET /api/me/signup-email` instead of extra fields on `GET /api/me/settings`, so the address is never in the settings every host loads.
- **`TERMS_VERSION` not raised**: the privacy notice gained lines about an optional, admin-only setting, not something every host agrees to.

## Known gaps

- No real send was made: step 6 (a Brevo account, a verified sender, an actual e-mail opened on a phone) needs the user's own key.
- The throttle lives in memory: a restart within the 15 minutes may send one more e-mail.
