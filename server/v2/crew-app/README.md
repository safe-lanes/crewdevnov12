# Crew Mobile App — Auth Module (Phase 1)

Fully isolated authentication for the crew-facing Android/iOS app. Nothing here
imports from `server/middleware/authMiddleware.ts` or `tenantMiddleware.ts`,
and nothing here reads `JWT_SECRET`. Verify with:

```
grep -rn "authMiddleware\|tenantMiddleware\|JWT_SECRET" server/v2/crew-app
```
(should return nothing).

Routes are mounted at `/api/crew-app/auth/...` — deliberately **outside** the
`/api/v2/` prefix, so the legacy tenant+auth middleware (applied globally to
every `/api/v2/*` path in `server/index.ts`) never runs against them. See
`server/middleware/exemptPaths.ts::isExempt()`.

## Required environment variables

| Var | Notes |
|---|---|
| `CREW_APP_ACCESS_TOKEN_SECRET` | Signs the 15-minute access token. Must be distinct from `JWT_SECRET` and from the refresh secret below. |
| `CREW_APP_REFRESH_TOKEN_SECRET` | Signs the 45-day refresh token. Must be distinct from both of the above. |

Both are required — the module throws at startup if either is missing (same
fail-fast behavior as `authMiddleware.ts`'s `JWT_SECRET` check). There is no
dev-bypass equivalent for this module.

Add both to your local secret store / `.env` (not committed) before starting
the server.

## Token design

Both access and refresh tokens are JWTs. The refresh token is also a JWT
(rather than an opaque random string) specifically so that `POST /refresh` —
which has no prior session — can read `domain` and the credential id straight
out of the token payload to resolve the correct tenant, without the client
needing to resend `domain` on every refresh call.

The refresh token's **raw value is never stored**. Only its SHA-256 hash is
kept in `app_crew_refresh_tokens.token_hash`, so a token can be looked up,
revoked, and marked single-use without the database ever holding a bearer
credential.

Refresh rotation is single-use: every successful `/refresh` call revokes the
token it was given and issues a brand-new pair. If a refresh token is
presented a second time (already revoked), that's treated as replay/reuse —
**every** refresh token for that credential is revoked, forcing the user to
log in again.

## Endpoints

### `POST /api/crew-app/auth/login`
```json
{ "identifier": "K 1003", "password": "...", "domain": "acme", "deviceId": "optional", "deviceLabel": "optional" }
```
`identifier` matches `emp_no`, `mobile`, or `email`. Not-found and
wrong-password both return the same generic `401 { "error": "Invalid credentials" }`
(no account enumeration). A locked account returns
`401 { "error": "Account locked until <ISO time>. Try again later." }` — this
is a deliberate, disclosed exception to the no-enumeration rule, acceptable
for an internal crew user base; collapse it into the generic message too if
stricter enumeration resistance is ever needed.

5 consecutive wrong-password attempts locks the account for 15 minutes.

Success (`200`):
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "mustResetPassword": true,
  "crew": { "crewUuid": "...", "empNo": "...", "mobile": "...", "email": "...", "userType": "Crew" }
}
```

### `POST /api/crew-app/auth/refresh`
```json
{ "refreshToken": "...", "deviceId": "optional" }
```
Success (`200`): `{ "accessToken": "...", "refreshToken": "..." }` — always a
**new** pair; the old refresh token is immediately invalid.
Failure: `401 { "error": "Invalid refresh token" }`.

### `POST /api/crew-app/auth/logout` (requires `Authorization: Bearer <accessToken>`)
```json
{ "refreshToken": "...", "allDevices": false }
```
Revokes the given refresh token (or every token for the credential if
`allDevices: true`). Idempotent — always `200`.

### `POST /api/crew-app/auth/set-password` (requires `Authorization: Bearer <accessToken>`)
```json
{ "currentPassword": "...", "newPassword": "..." }
```
Requires the current/temp password (so a leaked-but-valid access token alone
can't take over the account). Clears `must_reset_password` on success.

## Backfill

`npx tsx server/v2/crew-app/scripts/backfillCrewCredentials.ts --domain=<domain> [--dry-run] [--verbose] [--limit=N]`

Creates `app_crew_credentials` rows for any active `crew_members_v2` row in
the given tenant that doesn't have one yet, using `emp_no` as the login
identifier and a random temporary password. `--verbose` prints each generated
temp password once to the console (never run against retained/production
logs) so it can be distributed to the crew member out of band.
