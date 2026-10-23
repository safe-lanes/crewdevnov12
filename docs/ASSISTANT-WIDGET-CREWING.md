# Crewing — SAIL Assistant chat widget (stage 1: knowledge answers)

Branch `feature/assistant-widget-crewing`, based on `origin/crewing_accounts` @ `ee3f69ad`. Written 19-Oct-2026.

## Status (19-Oct-2026)

| Item | Status |
|---|---|
| Stage 1 (knowledge answers) | **Implemented locally** on this branch. Not pushed, merged or deployed. |
| Access | **Agreed:** Office users with the server-verified **Sail Admin** role only |
| Shared widget | Pins **widget 1.0.1**. The live assistant serves only 1.0.0 today, so the 1.0.1 assistant release is a **prerequisite** (see Deployment). |
| Genuine SAILERP login check | **Pending** until dev deployment. All tests so far used signed test tokens or Crewing's mock session. |
| Stage 2 (live data) | **Planning only**, not implemented |

## What it does

A "Crewing Assistant" chat button (bottom-right) answers "how do I…" questions from the published Crewing manual and from published Crewing trainer knowledge. It cites its sources and shows Crewing starter questions. **No live data.** The widget is the shared, pinned bundle served by the central assistant; nothing is installed in Crewing.

## Who sees it

| Rule | Where it is enforced |
|---|---|
| Verified SAILERP login (`authMiddleware` → `jwt.verify` with `JWT_SECRET`) | server |
| `userType` **Office** only (Ship users refused: 403 `user_type_not_allowed`) | server (`GET /api/v2/assistant/token`) |
| Role resolved **on the server** (`resolveRequestRole`: `master_users` → `adm_rolemaster_ac`) and in `ASSISTANT_ALLOWED_ROLES` (default **Sail Admin**). Unresolved role → 403 `role_unresolved`; other roles → 403 `role_not_allowed`. Browser headers, the user profile and any `role` claim are ignored. | server |
| The button is hidden for other users | browser (cosmetic only) |

## How it works

1. `client/src/components/SailAssistantMount.tsx` (mounted once in `App.tsx`) loads `https://<assistant>/widget/1.0.1/sail-assistant-widget.1.0.1.js` with Subresource Integrity. It runs only when `VITE_ASSISTANT_URL` is set.
2. The widget asks `GET /api/v2/assistant/token`. `tenantFetch` adds the SAILERP Bearer token and `x-tenant-id`; a 401 signs the user out as usual.
3. The server returns a 60-second signed identity (`server/v2/assistant/`): user id, server-resolved role, `Office`, company domain, tuid, `iss`. The key never leaves the server.
4. The widget talks only to the central assistant (`/chat`, `/suggestions`).
5. **Context reset:** a change of user, company or vessel starts a new conversation. Only the vessel rest-hours page carries a vessel. Sign-out reloads the page, and the widget is gone.

## Configuration

**Crewing server (PM2 env, values never in Git or chat):**

| Variable | Value |
|---|---|
| `ASSISTANT_INSTANCE_ID` | `crewing-dev` (dev), later `crewing-prod` |
| `ASSISTANT_IDENTITY_SIGNING_KEY` | 64-hex, unique to this instance (same value registered on the assistant) |
| `ASSISTANT_ALLOWED_ROLES` | optional; default `Sail Admin` |

**Crewing frontend build (Vite env at build time):**

| Variable | Value |
|---|---|
| `VITE_ASSISTANT_URL` | `https://assistant.sl-sail.com`. Unset → no widget, no script. |
| `VITE_ASSISTANT_ALLOWED_ROLES` | optional, cosmetic; keep equal to the server list |

**Central assistant (support):**
- add `{"crewing-dev":{"module":"crewing","env":"dev","signingKey":"<same key>"}}` to `ASSISTANT_MODULE_INSTANCES`. This is documentation-only: no URL, no secret.
- `https://dev.sl-sail.com` is already an allowed origin.

If either server variable is missing, the endpoint answers 503 `assistant_not_configured`, and the widget shows that it is unavailable.

## Build (Datta, on dev): from the committed code

**This branch changes no dependencies** (`package.json` and `package-lock.json` are untouched). On dev, where the dependency installation already exists, a normal pull and build is enough. No `npm ci` is needed:

```bash
git pull                                            # the release branch after merge
NODE_ENV=production VITE_PARENT_LOGIN_URL=<SAILERP login URL> VITE_ASSISTANT_URL=https://assistant.sl-sail.com npx vite build
npx esbuild server/production.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/server/index.js
```

(Or the usual Crewing build commands, with `VITE_ASSISTANT_URL` added.)

### Only for a fresh install (not needed on dev)

**Known issue in the lockfile (pre-existing; not introduced by this branch).** `package-lock.json` contains 110 package download URLs pointing to Replit's internal package proxy (`package-firewall.replit.internal` / `.replit.local`), added by Replit Agent lockfile commits. The latest is `44020378` (16-Sep-2026). Outside Replit, `npm ci` fails on those URLs.

**What was verified:** replacing only the host of those 110 URLs with `https://registry.npmjs.org/` changes **no package version and no integrity hash** (939 packages compared; every one of the 110 has a hash, so npm still checks the exact same files).

**Fresh-install steps** (a new server that cannot reach Replit's proxy):

```bash
git checkout feature/assistant-widget-crewing        # after merge: the release branch
cp package-lock.json /tmp/package-lock.orig.json
sed -i -E 's#https?://package-firewall\.replit\.(internal|local)/npm/#https://registry.npmjs.org/#g' package-lock.json
npm ci --no-audit --no-fund
cp /tmp/package-lock.orig.json package-lock.json     # restore; never commit the rewritten copy
NODE_ENV=production VITE_PARENT_LOGIN_URL=<SAILERP login URL> VITE_ASSISTANT_URL=https://assistant.sl-sail.com npx vite build
npx esbuild server/production.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/server/index.js
```

This was verified locally on 19-Oct-2026: frontend and backend built. The frontend bundle contains the 1.0.1 SRI and the assistant URL, and does **not** contain the dev persona token. The signing-key name appears only in the server bundle.

**Proposed smallest repository fix (not applied; needs approval):** commit the same host replacement in `package-lock.json`. That is 110 changed `"resolved"` lines, with no version, integrity or dependency change and no regeneration. After it, plain `npm ci` works everywhere.

## Deployment order (dev); each step needs approval

1. **Assistant release with widget 1.0.1** (v10, see the assistant release plan §8). Then verify through `https://assistant.sl-sail.com`:
   - `/widget/1.0.1/sail-assistant-widget.1.0.1.js` has SRI `sha384-e2Q1Mm3OiovWmjX/D8EIXFTxKaNbunU2Y2jH0JuaITO2DdarwsW3BxJQrHte4ZMU` (the value pinned in `client/src/lib/sailAssistant.ts`);
   - `/widget/1.0.0/…` is still `sha384-Dz8YnW533ZDxdij+nA0olCnp3VYRdi7kPkEpOxhXKilHPneJPVMiQWFwsaVJErWP`, unchanged for existing consumers.

   **Do not enable Crewing before this passes.** With a wrong or missing hash the browser blocks the script and no widget appears (fail-safe).
2. **Register `crewing-dev`** on the assistant (support): `{"module":"crewing","env":"dev","signingKey":"<key>"}`. It is documentation-only (no URL, no secret). `https://dev.sl-sail.com` is already an allowed origin.
3. **Crewing (Datta, Crewing PIC):** review and merge into the Crewing release branch, then set PM2 env `ASSISTANT_INSTANCE_ID=crewing-dev` and `ASSISTANT_IDENTITY_SIGNING_KEY=<same key>`. Build as above with `VITE_ASSISTANT_URL=https://assistant.sl-sail.com`, deploy, restart.
4. **Genuine-login acceptance on dev:**
   - A Sail Admin (Office) user signs in to SAILERP and opens Crewing. The button is visible, shows the 5 Crewing starter questions, and answers with Crewing citations.
   - Another role sees no button, and the token request returns 403.
   - A Ship user is refused.
   - Sign-out removes the button.

**Rollback:**
- **Crewing only:** rebuild without `VITE_ASSISTANT_URL` (no script, no widget) or redeploy the previous build. No database change.
- **Assistant rollback (v10 → v9) while Crewing is enabled:** v9 serves neither widget 1.0.1 nor the `crewing-dev` registration. The Crewing chat button then **disappears** (the browser blocks the missing 1.0.1 script). That is fail-safe, and the rest of Crewing is unaffected. Support tells Datta. Either disable the Crewing widget (rebuild without `VITE_ASSISTANT_URL`), or support restores an assistant build that serves 1.0.1 and has the registration.
- **Removing the `crewing-dev` registration:** Crewing's token still mints, but the assistant refuses it (401), so the widget shows "sign in again". Disable the widget in Crewing at the same time.

## Local testing (mock session — not a genuine login)

- Crewing's existing dev mode (`NODE_ENV=development`, `AUTH_BYPASS=true`, `VITE_AUTH_BYPASS=true`, no `JWT_SECRET`) with the persona switcher.
- Point `VITE_ASSISTANT_URL` at the **pilot** assistant, with `ASSISTANT_INSTANCE_ID=crewing-pilot` and its pilot key from a local-only file.
- Keep these settings in a local launcher or shell only, never in `.env*` files committed to Git.
- The real token-validation path is covered by `tests/integration/api/assistant-token.test.ts`, which signs real JWTs.
