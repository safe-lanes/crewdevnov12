# Crewing — SAIL Assistant chat widget (stage 1: knowledge answers)

Branch `feature/assistant-widget-crewing`, based on `origin/crewing_accounts` @ `ee3f69ad`. Written 19-Oct-2026.

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

## Deployment (dev)

1. Merge the branch into the Crewing release branch (Crewing team review).
2. Set the two server variables in PM2, set `VITE_ASSISTANT_URL` for the build, then build and restart.
3. Support registers `crewing-dev` on the assistant.
4. **Genuine-login acceptance (pending until this step):**
   - A Sail Admin (Office) signs in to SAILERP and opens Crewing. The button is visible, shows the 5 Crewing starter questions, and answers with Crewing citations.
   - Another role sees no button, and the token request returns 403.
   - Sign-out removes it.

**Rollback:** rebuild without `VITE_ASSISTANT_URL`, or deploy the previous build. On the assistant, remove the `crewing-dev` entry. No database change anywhere.

## Local testing (mock session — not a genuine login)

- Crewing's existing dev mode (`NODE_ENV=development`, `AUTH_BYPASS=true`, `VITE_AUTH_BYPASS=true`, no `JWT_SECRET`) with the persona switcher.
- Point `VITE_ASSISTANT_URL` at the **pilot** assistant, with `ASSISTANT_INSTANCE_ID=crewing-pilot` and its pilot key from a local-only file.
- Keep these settings in a local launcher or shell only, never in `.env*` files committed to Git.
- The real token-validation path is covered by `tests/integration/api/assistant-token.test.ts`, which signs real JWTs.
