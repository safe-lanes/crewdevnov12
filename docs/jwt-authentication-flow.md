# JWT Authentication & Domain Flow

## Overview

This document provides Mermaid diagrams of the CrewingV2 authentication and multi-tenant domain resolution flow. The system integrates with a parent app (SAIL Audits) that stores an AES-encrypted JWT in `sessionStorage` under the `credentials` key.

**JWT Payload:** `{ id, domain, userType, iat, exp }`

---

## 1. Complete Authentication Flow

```mermaid
flowchart TD
    Start([Browser loads App]) --> BypassCheck{VITE_AUTH_BYPASS\n=== true?}

    BypassCheck -- Yes --> SkipAuth[Skip auth gate\nRender app directly]
    BypassCheck -- No --> GetToken[getAuthToken:\nDecrypt AES credentials\nfrom sessionStorage]

    GetToken --> HasToken{Decrypted token\nstring present?}
    HasToken -- Yes --> RenderAuth[Render AuthenticatedApp]
    HasToken -- No --> HasLoginURL{VITE_PARENT_LOGIN_URL\nset?}
    HasLoginURL -- Yes --> Logout["logout():\nClear sessionStorage\nClear localStorage\nRedirect to login URL"]
    HasLoginURL -- No --> NoOp[No redirect, no clear\nlogout returns early]

    RenderAuth --> TenantInit[useTenantInit hook]
    SkipAuth --> TenantInit

    TenantInit --> ResolveDomain[Decrypt domain\nfrom localStorage]
    ResolveDomain --> HasDomain{Domain\nfound?}
    HasDomain -- No --> SingleTenant[Continue without\ntenant context]
    HasDomain -- Yes --> CacheCheck{Cached tenantId\nmatches domain?}
    CacheCheck -- Yes --> UseCached[Use cached tenantId\nfrom localStorage]
    CacheCheck -- No --> InitAPI["POST /api/v2/tenant/init\n{ domain }"]
    InitAPI --> InitOK{Response OK?}
    InitOK -- Yes --> CacheTenant[Cache tenantId +\ntenantDomain\nin localStorage]
    InitOK -- "404" --> ErrNotFound[Error: No company\nfor domain]
    InitOK -- "403" --> ErrInactive[Error: Company\ninactive]
    InitOK -- "503" --> ErrUnavail[Clear cached tenant\nContinue without tenant]

    CacheTenant --> AppReady([App Ready])
    UseCached --> AppReady
    SingleTenant --> AppReady
```

---

## 2. Frontend Request Pipeline

```mermaid
flowchart TD
    FetchCall([fetch /api/...]) --> BuildHeaders[Create Headers]

    BuildHeaders --> ReadTenant[Read tenantId\nfrom localStorage]
    ReadTenant --> HasTenantId{tenantId\nexists?}
    HasTenantId -- Yes --> SetTenant[Set header:\nx-tenant-id]
    HasTenantId -- No --> SkipTenant[No tenant header]

    SetTenant --> ReadToken[getAuthToken:\nDecrypt credentials]
    SkipTenant --> ReadToken

    ReadToken --> BypassCheck2{VITE_AUTH_BYPASS\n=== true?}
    BypassCheck2 -- Yes --> NoAuthHeader[No Authorization header]
    BypassCheck2 -- No --> HasJWT{Decrypted JWT\navailable?}
    HasJWT -- Yes --> SetAuth["Set header:\nAuthorization: Bearer JWT"]
    HasJWT -- No --> NoAuthHeader

    SetAuth --> SendRequest[Send request\nto backend]
    NoAuthHeader --> SendRequest

    SendRequest --> CheckResponse{Response\nstatus?}
    CheckResponse -- "non-401" --> ReturnOK([Return response as-is])
    CheckResponse -- "401" --> Handle401[handleUnauthorized\n→ logout]
    Handle401 --> HasLoginURL2{VITE_PARENT_LOGIN_URL\nset?}
    HasLoginURL2 -- Yes --> ClearStorage[Clear sessionStorage\nClear localStorage]
    ClearStorage --> RedirectLogin[Redirect to\nparent login URL]
    HasLoginURL2 -- No --> NoOpLogout["logout returns early\nno clear, no redirect"]
    CheckResponse -- Other --> ReturnErr([Return error response])
```

---

## 3. Backend Middleware Chain

```mermaid
flowchart TD
    Request([Incoming API Request]) --> ExemptCheck{Path exempt?\n/api/v2/tenant/init\n/api/health\nnon /api/v2/ paths}

    ExemptCheck -- Yes --> RouteHandler([Route Handler])
    ExemptCheck -- No --> MultiTenant{MASTER_DATABASE_URL\nset?\nMulti-tenant mode?}

    MultiTenant -- No --> AuthMW[Auth Middleware]
    MultiTenant -- Yes --> TenantMW[Tenant Middleware]

    TenantMW --> HasXTenant{x-tenant-id\nheader present?}

    HasXTenant -- Yes --> ValidateTUID[Validate TUID\nin master DB]
    ValidateTUID --> TUIDValid{TUID valid\n& active?}
    TUIDValid -- Yes --> SetContext1["Set req.tenantId\nRun in tenant context"]
    TUIDValid -- "Not found" --> Err403a(["403: invalid_tenant"])
    TUIDValid -- "Inactive" --> Err403b(["403: tenant_inactive"])
    TUIDValid -- "DB error" --> Err503(["503: tenant DB unavailable"])

    HasXTenant -- No --> JWTFallback[Extract JWT from\nAuthorization header]
    JWTFallback --> JWTResult{JWT verify\nresult?}
    JWTResult -- "Valid + domain" --> ResolveTenant["resolveTenant(domain)\nSet req.tenantId\nSet req.tokenData\nSet req.jwtDomain"]
    JWTResult -- "No token /\nno secret /\nno domain" --> Err400(["400: Missing x-tenant-id"])
    JWTResult -- "Expired" --> Err401a(["401: token_expired"])
    JWTResult -- "Invalid" --> Err401b(["401: invalid_token"])

    ResolveTenant --> SetContext2["Run in tenant context"]
    SetContext1 --> AuthMW
    SetContext2 --> AuthMW

    AuthMW --> HasSecret{JWT_SECRET\nconfigured?}

    HasSecret -- No --> DevBypass{AUTH_BYPASS === true\n&& NODE_ENV === dev?}
    DevBypass -- Yes --> RouteHandler
    DevBypass -- No --> Err500(["500: server_configuration_error"])

    HasSecret -- Yes --> AlreadyVerified{req.tokenData\nalready set by\ntenant middleware?}
    AlreadyVerified -- Yes --> ReuseToken["Reuse req.tokenData\nSet req.user"]
    AlreadyVerified -- No --> ExtractBearer[Extract Bearer token\nfrom Authorization header]

    ExtractBearer --> HasBearer{Token\npresent?}
    HasBearer -- No --> Err401c(["401: unauthorized\nMissing authorization token"])
    HasBearer -- Yes --> VerifyJWT["jwt.verify(token, JWT_SECRET)"]

    VerifyJWT --> VerifyResult{Verify\nresult?}
    VerifyResult -- Valid --> SetUser["Set req.user\nSet req.tokenData"]
    VerifyResult -- Expired --> Err401d(["401: token_expired\nToken has expired"])
    VerifyResult -- Invalid --> Err401e(["401: invalid_token\nInvalid authorization token"])

    SetUser --> TenantBinding
    ReuseToken --> TenantBinding

    TenantBinding{Multi-tenant\n+ tenantId set?}
    TenantBinding -- No --> RouteHandler
    TenantBinding -- Yes --> DomainCheck{JWT domain\nmatches tenant?}
    DomainCheck -- Yes --> RouteHandler
    DomainCheck -- No --> Err403c(["403: tenant_mismatch\nToken does not match tenant"])
```

---

## 4. Dev vs Production Behavior

```mermaid
flowchart LR
    subgraph Development
        direction TB
        D1["AUTH_BYPASS=true\n+ no JWT_SECRET"] --> D2[Backend skips\nJWT validation]
        D1b["JWT_SECRET set\n(AUTH_BYPASS ignored)"] --> D2b[Backend validates\nJWT normally]
        D3[VITE_AUTH_BYPASS=true] --> D4[Frontend skips\nauth gate]
        D2 --> D5([Bypass active:\nBackend + frontend\nskip auth])
        D4 --> D5
    end

    subgraph Production
        direction TB
        P1[JWT_SECRET required] --> P2[Backend validates\nevery request]
        P3[VITE_PARENT_LOGIN_URL\nrequired] --> P4[Frontend enforces\nauth gate]
        P2 --> P5([Full auth:\n401 → redirect to\nparent login])
        P4 --> P5
    end
```

---

## 5. Environment Variable Summary

| Variable | Side | Required | Auth Role |
|----------|------|----------|-----------|
| `JWT_SECRET` | Backend | Yes (prod) | Shared signing secret for JWT verify |
| `AUTH_BYPASS` | Backend | No | `"true"` skips auth in dev only |
| `VITE_AUTH_BYPASS` | Frontend | No | `"true"` skips auth gate + token attachment |
| `VITE_PARENT_LOGIN_URL` | Frontend | Yes (prod) | Redirect target for 401 / missing token |
| `VITE_CLIENT_ENCRYPTION_KEY` | Frontend | Yes | AES key to decrypt credentials from sessionStorage |
| `MASTER_DATABASE_URL` | Backend | No | Enables multi-tenant mode with domain-based routing |

---

## 6. Key Source Files

| File | Role |
|------|------|
| `client/src/App.tsx` | Auth gate: checks `isAuthRequired()` + `getAuthToken()` |
| `client/src/lib/authToken.ts` | `getAuthToken()`, `isAuthRequired()`, `logout()`, `handleUnauthorized()` |
| `client/src/lib/tenantFetch.ts` | Fetch interceptor: attaches JWT + tenant headers, handles 401 |
| `client/src/lib/encryptionService.ts` | AES decryption of credentials and domain from storage |
| `client/src/hooks/useTenantInit.ts` | Domain resolution → `/api/v2/tenant/init` → cache tenantId |
| `server/middleware/exemptPaths.ts` | Shared exempt path list for both middleware |
| `server/middleware/tenantMiddleware.ts` | Multi-tenant resolution: x-tenant-id or JWT domain fallback |
| `server/middleware/authMiddleware.ts` | JWT verification, AUTH_BYPASS, tenant binding check |
