# Records of processing and data breach procedure

For the operator of a Quizmoo installation. GDPR Article 30 exempts most organisations with fewer than 250 employees from keeping records of processing, but only where processing is occasional; a running service is not occasional, so this record is kept. It also serves as the basis for any later compliance review.

> This document is a template prepared by the developer, not legal advice. The operator completes the bracketed fields and has the document reviewed before a rollout beyond friends and family, or before any use by a client or a public body.

## Controller

| Field | Value |
|---|---|
| Controller | [operator's name, as in `OPERATOR_NAME`] |
| Contact | [operator's e-mail, as in `OPERATOR_EMAIL`] |
| Data protection officer | Not designated (no large-scale processing of special categories, no systematic monitoring; GDPR Article 37) |
| Nature | Free, non-commercial service run by a private individual |

## Processing activities

| Activity | Data subjects | Personal data | Purpose | Legal basis (GDPR Art. 6(1)) | Retention |
|---|---|---|---|---|---|
| Running games | Players | Nickname, avatar, team, answers, answer times, points, a random player token | Running the game the player joined, showing the results | (b) participation requested by the player; (f) the host's interest in the results of their event | Finished games deleted after `RESULTS_RETENTION_DAYS` (90); at most 200 per host; unfinished games closed after 12 hours |
| Host accounts | Hosts | Username, password hash, role, status, created, last login, accepted terms version and time | Providing the account; security; proof of the agreement | (b) terms of use; (f) security and proof | Until deleted by the host or the admin; unapproved sign-ups after 7 days |
| Sessions | Hosts | Hash of a random token, expiry | Keeping the host logged in | (b) | 30 days; expired ones deleted daily |
| Host content | Hosts; people shown in uploaded pictures | Quizzes, pictures, settings, event name, logo | Providing the service | (b); the host is responsible for having the right to use pictures of others | Until deleted; unused pictures deleted daily after one day |
| Abuse protection | Visitors | Network address, in memory for at most one minute | Rate limits against password guessing and PIN scanning | (f) security | Not stored |
| Device storage | Visitors | Language, colour mode, player seat, notice seen (browser only) | Functions the visitor asked for | Strictly necessary storage (ePrivacy Directive Art. 5(3); Eht. 155. § (4)) | See `/cookies` |

No special categories of data (Article 9) are intended. No automated decision-making or profiling takes place (Article 22). No analytics, advertising or third-party scripts are used.

## Recipients and processors

| Recipient | Role | Data | Location and safeguards |
|---|---|---|---|
| [hosting provider, as in `HOSTING_PROVIDER`] | Processor (Article 28) | All of the above, stored and processed to run the service | [region]; data processing agreement: [link]; transfers outside the EU/EEA: [adequacy decision / standard contractual clauses] |
| GitHub (Feedback link, optional) | Independent controller | Only what a host chooses to write in an issue | Its own terms; the issue form asks for no personal data |

The hosting provider requires a compliance review (data processing agreement, sub-processors, data location, security certifications) before the service is used beyond a private circle, and always before use by a client or a public body.

## Technical and organisational measures

Encryption in transit (HTTPS, HSTS); passwords hashed with Argon2; session tokens stored as SHA-256 hashes; `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-` session cookie; strict Content Security Policy; rate limits on logins, sign-ups, account actions and PIN lookups; ownership checks on every resource; no client addresses in logs or the database; database errors logged without their values; uploads re-encoded and limited in size and pixels; daily deletion according to the retention periods above; database backups by the hosting provider. Details: `docs/security-notes.md`.

## Data subject requests

- Hosts serve themselves: "Download my data" (access, portability) and "Delete my account" on My settings → Account.
- Players write to the contact with the date, PIN and nickname of the game. The operator finds the game in the admin's tools or the database, sends a copy or deletes the player's entries, and answers within one month (Article 12(3)).
- Requests and answers are kept for one year as proof of handling, then deleted.

## Data breach procedure (Articles 33 and 34)

1. **Contain.** Stop the leak: rotate `SESSION_SECRET` and the database password, delete all sessions (`delete from sessions;`), take the service offline if necessary.
2. **Assess** within 24 hours: what data, how many people, how likely harm to them is. Player data is limited to nicknames and answers; host data includes password hashes.
3. **Notify the authority** (NAIH, through its online incident form at naih.hu) within 72 hours of becoming aware, unless the breach is unlikely to result in a risk to people's rights and freedoms.
4. **Inform the people affected** without undue delay where the risk is high (for example password hashes taken: hosts are asked to change their password here and wherever they reused it). Without e-mail addresses, this is done by a notice on the site and at the next login.
5. **Record** every breach, including those not reported: facts, effects, measures taken (Article 33(5)).

| Date | What happened | Data and people affected | Reported to NAIH | People informed | Measures |
|---|---|---|---|---|---|
| | | | | | |
