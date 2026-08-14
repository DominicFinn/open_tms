# Security Rules (STRICT)

Exceptions require documented justification — see **Security Exception Registry** at the bottom.

## Multi-tenancy is a security boundary, not a convenience

The single highest-impact security rule in this codebase.

- Every tenant-scoped read and write is filtered by `orgId`. Pass `req.orgId!` into every repository
  call and every `commandBus.dispatch`.
- **Cross-tenant id guesses return 404, never 403** — existence stays opaque.
- **Never `prisma.organization.findFirst()` inline in a route.** It silently resolves to the first
  organization for every caller, which is a cross-tenant data leak the moment a second org exists.
  Use `registerOrgScope` and read `req.orgId!`.
- Portal surfaces derive their scope from the authenticated principal, never from a request
  parameter: `attachOrgScopeFromCustomerUserHook` walks `customerUser.customerId → Customer.orgId`,
  `attachOrgScopeFromCarrierUserHook` walks `carrierUser.carrierId → Carrier.orgId`.
- A customer or carrier must never be able to widen their own scope by supplying an id. Scope comes
  from the token; the id is only ever narrowed against it.

See the multi-tenancy rule for the mechanics.

## Authentication

Four distinct principals, each with its own guard. **Do not cross the wires.**

| Principal | Guard | Notes |
|---|---|---|
| Internal user | `authenticateJWT` | Admin/operations app |
| Customer portal user | `authenticateCustomerJWT` | Separate model, separate issuer |
| Carrier portal user | `authenticateCarrierJWT` | `iss: "open-tms-carrier"`, separate `CarrierUser` model |
| Machine / API client | `apiKeyAuth` | `x-api-key` or `Authorization: Bearer`, customer-scoped |

- Validate the issuer, not just the signature. A carrier token must not authenticate an admin route.
- Password rules where passwords exist: 8+ chars with upper, lower and a number; **account lockout
  after 5 failed attempts for 15 minutes**.
- Magic links (warehouse PWA) are single-use and time-limited. Every operational route behind the
  login endpoints requires the session JWT.
- API keys are customer-scoped credentials — treat them as passwords: hash at rest, show once on
  creation, support revocation.
- Never log a token, key, OTP or magic-link value. Not even truncated, in production.

## Authorization

- Permission checks live in a **preHandler**, not scattered through the handler body
- Check the permission *and* the tenant — `shipments:write` does not authorise writing another org's
  shipment
- Admin-only operations (soft-delete, archives, role management) are gated on an explicit
  admin/`*:delete` permission, never on "is authenticated"

## Input validation

- **Always validate in the Fastify `schema` block**, before the handler runs. See the api-design rule.
- Validate types, lengths, formats and ranges — not just presence
- **Whitelist allowed values, don't blacklist**
- Never trust a client-supplied `orgId`, `customerId`, or `carrierId` to select scope

## Injection

- **No raw SQL outside a repository**, and never built by string concatenation with a runtime value.
  Use Prisma, or the parameterized tagged-template form inside a repository method. See the
  architecture rule.
- The same applies to anything else interpreted: don't interpolate user input into file paths,
  shell commands, EDI segment builders, or template strings that get evaluated.
- On the frontend: never `dangerouslySetInnerHTML` with user or partner-supplied content without
  sanitising it, and document it as an exception. No `eval`, no `new Function`, no assigning user
  input to `location.href`.

## Rate limiting — REQUIRED, currently missing

> **Gap:** `@fastify/rate-limit` is a declared dependency but **is never registered**. There is
> presently no HTTP rate limiting on any endpoint. Account lockout is the only brute-force defence.

Every deployment must rate limit, and these are the tiers to apply:

| Surface | Guidance |
|---|---|
| General authenticated API | Per-user/per-key ceiling |
| **Auth endpoints** (all four logins, magic-link request, password reset) | Aggressive, keyed by IP, with exponential backoff on repeated failure |
| Public webhook ingest (carrier callbacks, EDI inbound) | Per-source ceiling — these are unauthenticated by design |
| Report/export endpoints | Tight — they are expensive by definition |

Keying: authenticated principal where available, IP otherwise.

## Security headers — REQUIRED, currently missing

> **Gap:** no security headers are set on any response. There is no helmet-equivalent registered.

Every response should carry:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Frame-Options: DENY` (the API is never framed)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- A Content-Security-Policy on the served frontend, with `connect-src` covering the API origin and
  the Google Maps endpoints the map surfaces need

Treat a missing header set as a blocker for a production deployment, not a nice-to-have.

## CORS

- **Never `*` in production.** Origins come from `CORS_ORIGINS` per environment.
- `credentials: true` is set — which makes a permissive origin considerably worse, so the allowlist
  matters
- The dev fallback (`origin: true`) must stay gated on `NODE_ENV !== 'production'`

## Webhooks and inbound integrations

- **Verify the signature** on every inbound webhook that offers one (carrier tracking providers
  use HMAC-SHA256). An unverified webhook endpoint is an unauthenticated write.
- Signing secrets come from config/env, never a literal
- Compare signatures in constant time; match the full value, never a prefix or `includes`
- Every external event consumer needs an **idempotency key backed by a unique constraint** — see the
  transactions-and-concurrency rule
- EDI inbound resolves its org through the trading partner, not through a client-supplied field

## File upload and storage

- Validate file type, size and content — **not just the extension**. The multipart limit is 50MB.
- **Storage keys are opaque**: `files/{uuid}`. No entity ids, filenames, customer names or other
  business data in the key.
- Serve through a route that performs the tenancy and permission check, or via a short-lived signed
  URL. Never expose a bucket path directly.
- Never trust a client-supplied filename for anything but display, and escape it there.

## PII

PII rules are defined in the error-handling-and-logging rule and apply everywhere data leaves the
process: **logs, event metadata, audit records, broadcast payloads, and issue/PR comments.**

In this domain, treat as PII: driver contact details, consignee names and addresses, signature and
POD images, and any end-customer contact data on an order.

Reference `shipmentId` / `orderId` / `userId` instead.

## Secrets and environment

- All secrets in environment variables. Never committed, never in code, never in a client bundle.
- `.env` stays gitignored; separate values per environment
- Rotate API keys and provider credentials periodically
- Stack traces and internal errors must never reach an API response body in production

## Dependency hygiene

Run `npm audit` regularly and act on high/critical findings.

## Security Exception Registry

When a rule here must be bypassed for a legitimate reason, document it in
`docs/security-exceptions.md`:

```markdown
## Exception: [Short Title]
- **Date Added:** YYYY-MM-DD
- **Rule Bypassed:** [Which rule from this document]
- **Location:** [File path(s) affected]
- **Justification:** [Why this is necessary]
- **Mitigations:** [What safeguards are in place instead]
- **Review Date:** [Max 6 months out]
```

## Security checklist

- [ ] Every tenant-scoped query filtered by `orgId`; no inline `organization.findFirst()`
- [ ] Cross-tenant misses return 404, not 403
- [ ] Permission checks in a preHandler, covering both permission and tenant
- [ ] Validation in the `schema` block; no client-supplied scope ids trusted
- [ ] No raw SQL outside a repository; nothing concatenated
- [ ] Rate limiting applied, aggressive on auth endpoints
- [ ] Security headers present on every response
- [ ] CORS locked to explicit origins in production
- [ ] Inbound webhook signatures verified; idempotency key with a unique constraint
- [ ] Uploads validated by content; storage keys opaque; downloads permission-checked
- [ ] No PII or secrets in logs, events, or error responses
- [ ] No stack traces in production responses
- [ ] `npm audit` clean of high/critical
- [ ] Exceptions documented in `docs/security-exceptions.md`
