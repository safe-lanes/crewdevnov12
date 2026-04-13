# Multi-Tenant Token Sequence Diagrams — CrewingV2

> Mermaid sequence diagrams showing the complete multi-tenant JWT authentication flow,
> from app initialization through tenant database connection.

---

## Phase 1 — Tenant Initialization (App Mount)

How the frontend resolves which tenant database to connect to when the app loads.

```mermaid
sequenceDiagram
    autonumber

    participant Browser as React App<br/>(App.tsx)
    participant Auth as getAuthToken()<br/>(authToken.ts)
    participant Hook as useTenantInit<br/>(useTenantInit.ts)
    participant Encrypt as encryptionService<br/>(encryptionService.ts)
    participant TenantStore as tenantStorage<br/>(tenantStorage.ts)
    participant Fetch as tenantFetch<br/>(tenantFetch.ts)
    participant Server as Express Server<br/>(routes.ts)
    participant TCM as TenantConnectionManager<br/>(tenantConnectionManager.ts)
    participant MasterDB as Master DB<br/>(tenants table)

    Browser->>Auth: getAuthToken()
    Auth->>Auth: Decrypt AES(sessionStorage["credentials"])
    alt VITE_AUTH_BYPASS = true
        Auth-->>Browser: null (auth skipped)
    else Token found
        Auth-->>Browser: JWT string
    else No credentials in sessionStorage
        Browser->>Browser: redirectToLogin() → clear storage → redirect to PARENT_LOGIN_URL
    end

    Browser->>Hook: Mount → useEffect triggers
    Hook->>Encrypt: resolveDomain()<br/>getDecryptedLocalStorageItem("domain")
    Encrypt-->>Hook: domain (e.g. "acme.sail.com")

    Hook->>TenantStore: storedTenantId() + getTenantDomain()
    TenantStore->>TenantStore: AES decrypt localStorage["tenantId"]<br/>AES decrypt localStorage["tenantDomain"]

    alt tenantId cached AND cachedDomain === domain
        TenantStore-->>Hook: {tenantId, tenantDomain}
        Hook-->>Browser: Return cached tenantId ✅
    else No tenantId cached OR domain changed
        TenantStore-->>Hook: null
        Note over Hook: Clear stale tenant data if domain changed

        Hook->>Server: POST /api/v2/tenant/init<br/>Body: { domain }<br/>Header: Content-Type: application/json
        Server->>TCM: resolveTenant(domain)

        alt Domain in cache (TTL < 5min)
            TCM->>TCM: Return cached {tuid, companyName}
        else Cache miss
            TCM->>MasterDB: SELECT tuid, is_active, is_deleted<br/>FROM tenants WHERE domain = ?

            alt Tenant found & active
                MasterDB-->>TCM: {tuid, companyName}
                TCM->>TCM: Cache result (5min TTL)
            else Tenant not found
                MasterDB-->>TCM: Empty result
                TCM-->>Server: TenantNotFoundError
                Server-->>Hook: 404 — "No company registered for domain"
                Hook-->>Browser: error state (404)
            else Tenant inactive/deleted
                MasterDB-->>TCM: {isActive: false}
                TCM-->>Server: TenantInactiveError
                Server-->>Hook: 403 — "Company account is currently inactive"
                Hook-->>Browser: error state (403)
            end
        end

        TCM-->>Server: {tuid, companyName}
        Server-->>Hook: 200 {tenantId, companyName}

        Hook->>TenantStore: setTenantId(tuid)
        TenantStore->>TenantStore: AES encrypt → localStorage["tenantId"]
        Hook->>TenantStore: setTenantDomain(domain)
        TenantStore->>TenantStore: AES encrypt → localStorage["tenantDomain"]
        Hook-->>Browser: tenantId resolved ✅
    end

    Note over Browser,Fetch: All subsequent /api/* requests<br/>automatically include x-tenant-id header<br/>and Authorization: Bearer JWT
```

---

## Phase 2 — Subsequent API Request Flow (Frontend → Correct Tenant DB)

How every `/api/*` call flows from the frontend through middleware to the correct tenant database.

```mermaid
sequenceDiagram
    autonumber

    participant Component as React Component<br/>(any page)
    participant RQ as useQuery / useMutation<br/>(queryClient.ts)
    participant Fetch as window.fetch interceptor<br/>(tenantFetch.ts)
    participant TenantStore as tenantStorage<br/>(tenantStorage.ts)
    participant Auth as getAuthToken()<br/>(authToken.ts)
    participant Server as Express Server<br/>(index.ts)
    participant TenantMW as tenantMiddleware<br/>(tenantMiddleware.ts)
    participant AuthMW as authMiddleware<br/>(authMiddleware.ts)
    participant TCM as TenantConnectionManager<br/>(tenantConnectionManager.ts)
    participant MasterDB as Master DB<br/>(tenants table)
    participant TenantDB as Tenant DB<br/>(tenant-specific PostgreSQL)

    Component->>RQ: useQuery({ queryKey: ["/api/v2/crew"] })
    RQ->>Fetch: fetch("/api/v2/crew")

    Note over Fetch: tenantFetch.ts intercepts all /api/* calls

    Fetch->>TenantStore: getTenantId()
    TenantStore->>TenantStore: AES decrypt localStorage["tenantId"]
    TenantStore-->>Fetch: tenantId (TUID)

    Fetch->>Auth: getAuthToken()
    Auth->>Auth: AES decrypt sessionStorage["credentials"]
    Auth-->>Fetch: JWT string

    Fetch->>Server: GET /api/v2/crew<br/>Headers:<br/>  x-tenant-id: {tuid}<br/>  Authorization: Bearer {jwt}

    Note over Server: Middleware chain: tenantMiddleware → authMiddleware → route handler

    Server->>TenantMW: tenantMiddleware(req, res, next)

    alt Path is exempt (/api/v2/tenant/init, /api/health)
        TenantMW->>Server: next() — skip tenant check
    else x-tenant-id header present
        TenantMW->>TenantMW: Extract x-tenant-id from headers
        TenantMW->>TCM: validateTuid(tenantId)
        TCM->>MasterDB: Check tenant exists, is_active, not is_deleted
        alt Tenant valid & active
            MasterDB-->>TCM: ✅ Valid
            TCM-->>TenantMW: Validation passed
            TenantMW->>TCM: runInTenantContext(tenantId, callback)
            TCM->>TCM: getTenantDb(tuid) — check poolCache
            alt Pool exists in cache
                TCM->>TCM: Reuse existing Drizzle connection
            else Pool not cached
                TCM->>TenantDB: Create new pg.Pool connection<br/>+ run pending migrations
                TCM->>TCM: Cache in poolCache
            end
            TCM->>TCM: AsyncLocalStorage.run(db, callback)
            Note over TCM: Tenant DB context now active<br/>for this entire request
            TenantMW->>Server: next() → proceed to authMiddleware
        else Tenant not found
            MasterDB-->>TCM: Not found
            TCM-->>TenantMW: TenantNotFoundError
            TenantMW-->>Fetch: 403 — "invalid_tenant"
        else Tenant inactive
            MasterDB-->>TCM: inactive
            TCM-->>TenantMW: TenantInactiveError
            TenantMW-->>Fetch: 403 — "tenant_inactive"
        else Database unavailable
            TCM-->>TenantMW: TenantDatabaseError
            TenantMW-->>Fetch: 503 — "Tenant database unavailable"
        end
    else No x-tenant-id header (JWT fallback)
        TenantMW->>TenantMW: extractDomainFromJwt(req)<br/>jwt.verify(token, JWT_SECRET)
        alt JWT has valid domain
            TenantMW->>TCM: resolveTenant(domain)
            TCM->>MasterDB: Lookup tuid by domain
            MasterDB-->>TCM: {tuid}
            TCM-->>TenantMW: tenant resolved
            TenantMW->>TenantMW: Set req.tenantId, req.tokenData
            TenantMW->>TCM: runInTenantContext(tuid, callback)
            TenantMW->>Server: next()
        else JWT expired
            TenantMW-->>Fetch: 401 — "token_expired"
        else JWT invalid
            TenantMW-->>Fetch: 401 — "invalid_token"
        end
    end

    Server->>AuthMW: authMiddleware(req, res, next)

    alt req.tokenData already set (by tenantMiddleware)
        AuthMW->>AuthMW: Reuse req.tokenData<br/>(skip duplicate jwt.verify)
    else No tokenData yet
        AuthMW->>AuthMW: extractToken(req)<br/>→ Bearer header or ?sail= query param
        AuthMW->>AuthMW: jwt.verify(token, JWT_SECRET)
        alt Token valid
            AuthMW->>AuthMW: Set req.user = decoded payload<br/>{id, domain, userType, iat, exp}
        else Token missing
            AuthMW-->>Fetch: 401 — "Missing authorization token"
        else Token expired
            AuthMW-->>Fetch: 401 — "token_expired"
        else Token invalid
            AuthMW-->>Fetch: 401 — "invalid_token"
        end
    end

    Note over AuthMW: Cross-check: JWT domain vs tenantId

    AuthMW->>AuthMW: proceedWithTenantBinding()
    alt req.jwtDomain === decoded.domain (already verified)
        AuthMW->>Server: next() — domain matches ✅
    else Need verification
        AuthMW->>TCM: resolveTenant(decoded.domain)
        TCM-->>AuthMW: {tuid}
        alt tuid === req.tenantId
            AuthMW->>Server: next() — tenant binding valid ✅
        else tuid !== req.tenantId
            AuthMW-->>Fetch: 403 — "tenant_mismatch"
        end
    end

    Note over Server: Route handler executes within AsyncLocalStorage context

    Server->>TenantDB: SQL query via getTenantDb()<br/>(from AsyncLocalStorage context)
    TenantDB-->>Server: Query results
    Server-->>Fetch: 200 JSON response

    Fetch-->>RQ: Response data
    RQ-->>Component: Rendered data ✅

    alt Response is 401
        Fetch->>Auth: handleUnauthorized()
        Auth->>Auth: Clear sessionStorage + localStorage
        Auth->>Browser: Redirect to PARENT_LOGIN_URL
    end
```

---

## Key Source Files Reference

| Layer | File | Role |
|-------|------|------|
| **Frontend** | `client/src/App.tsx` | App mount, auth gate, tenant error display |
| **Frontend** | `client/src/hooks/useTenantInit.ts` | Tenant initialization hook (Phase 1) |
| **Frontend** | `client/src/lib/authToken.ts` | JWT decrypt from sessionStorage, logout/redirect |
| **Frontend** | `client/src/lib/tenantStorage.ts` | Encrypted tenantId/tenantDomain in localStorage |
| **Frontend** | `client/src/lib/encryptionService.ts` | AES encrypt/decrypt for localStorage & sessionStorage |
| **Frontend** | `client/src/lib/tenantFetch.ts` | Fetch interceptor — injects x-tenant-id & Bearer headers |
| **Frontend** | `client/src/lib/queryClient.ts` | TanStack Query default fetcher with tenant headers |
| **Backend** | `server/routes.ts` | POST /api/v2/tenant/init endpoint |
| **Backend** | `server/middleware/tenantMiddleware.ts` | Validates x-tenant-id or JWT domain fallback |
| **Backend** | `server/middleware/authMiddleware.ts` | JWT verify, tenant binding cross-check |
| **Backend** | `server/middleware/exemptPaths.ts` | Paths that skip tenant + auth middleware |
| **Backend** | `server/utils/tenantConnectionManager.ts` | Master DB lookup, connection pooling, AsyncLocalStorage |

---

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `JWT_SECRET` | Backend | Shared secret for jwt.verify() — must match parent SAIL Audits app |
| `AUTH_BYPASS` | Backend | Skip JWT auth in dev (only when JWT_SECRET is absent) |
| `VITE_AUTH_BYPASS` | Frontend | Skip auth entirely on client side |
| `VITE_PARENT_LOGIN_URL` | Frontend | Redirect target on 401 / logout |
| `VITE_CLIENT_ENCRYPTION_KEY` | Frontend | AES key for localStorage & sessionStorage encryption |
| `MASTER_DATABASE_URL` | Backend | Enables multi-tenant mode (master tenants DB) |
| `DATABASE_URL` | Backend | Default single-tenant database connection |
