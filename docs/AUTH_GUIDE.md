# Authentication and Authorisation Guide

How people and machines sign in to Open TMS, and how permissions are checked. Auth is part of the
backend (`backend/src/services/AuthService.ts`, `backend/src/middleware/jwtAuth.ts`). There is no
separate auth service.

The security rules that govern this area are in `.claude/rules/security.md` and
`.claude/rules/multi-tenancy.md`.

## Who can sign in

| Principal | Signs in at | Guard | Token issuer |
|---|---|---|---|
| Internal user | `POST /api/v1/auth/login` | `authenticateJWT` | `open-tms-auth` |
| Customer portal user | the customer portal login | `authenticateCustomerJWT` | its own issuer |
| Carrier portal user | the carrier portal login | `authenticateCarrierJWT` | `open-tms-carrier` |
| Machine or API client | no login: sends an API key | `apiKeyAuth` | none |

Each guard checks the issuer as well as the signature, so a portal token does not authenticate an
admin route. The portals are covered in `CUSTOMER_PORTAL_GUIDE.md`, and API keys in
`CUSTOMER_API_GUIDE.md`. The rest of this guide is about internal users.

## Creating the first user

There is no self-registration and no setup endpoint. A fresh install has no users, and
`POST /api/v1/seed` is disabled when `NODE_ENV=production`.

Create the first login by running the seed script against the database. The steps are in the
"First login" section of [SELF_HOSTING.md](SELF_HOSTING.md). The seed also creates the system
roles.

Inviting further users through the app is not built yet. It is on the roadmap under platform
hardening, along with self-service password reset, argon2id hashing and MFA.

## Internal user endpoints

All responses use the `{ data, error }` envelope.

| Endpoint | What it does |
|---|---|
| `POST /api/v1/auth/login` | Takes `email` and `password`. Returns a token and the user. `401` on bad credentials or a locked account |
| `GET /api/v1/auth/me` | The signed-in user, with roles and permissions |
| `POST /api/v1/auth/change-password` | Change your own password. Needs the current one |
| `POST /api/v1/auth/logout` | Returns success. Sessions are stateless, so the client discards the token |
| `POST /api/v1/auth/forgot-password` | A stub. It always returns the same message and sends nothing. Ask an administrator for a reset |
| `GET /api/v1/users` | List internal users in your organisation. Needs `users:*` today (#403) |
| `PATCH /api/v1/users/:id` | Update a user's name or active flag. Needs `users:*` today (#403) |
| `POST /api/v1/users/:id/reset-password` | Set another user's password. Needs `users:*` today (#403) |

Send the token on every request as `Authorization: Bearer <token>`.

## Sessions

- A session is a signed JWT (HS256) that lasts 12 hours. There is no refresh token: sign in again
  when it expires.
- The token carries the user id, email, name, role names, the flattened permission list and
  `organizationId`. Routes take the tenant from `req.orgId`, which the scope hooks derive from the
  token. See the multi-tenancy rule.
- Permissions are read from the token, so a role change takes effect at the user's next sign-in.
- `JWT_SECRET` signs the tokens. It is required in production, and the backend refuses to start
  without it.
- A token carrying a `scope` claim is refused. Those were restricted sessions for the warehouse and
  inventory apps, which have been removed.

## Passwords and lockout

- At least 8 characters, with an upper-case letter, a lower-case letter and a number.
- Five failed attempts lock the account for 15 minutes. A successful sign-in or an administrator
  reset clears the count.

## Roles and permissions

A permission is `resource:action`, for example `shipments:write`. `resource:*` grants every action
on a resource, and `*` grants everything. The full list is in `backend/src/auth/permissions.ts`,
and `GET /api/v1/roles/permissions` serves it to the role editor.

System roles are defined in code and re-synced on startup, so they cannot be edited or deleted:

| Role | For |
|---|---|
| `admin` | Everything, including users, roles and settings |
| `dispatcher` | Day-to-day operations: shipments, orders, tendering, issues and documents. Read access to carriers, customers, returns and finance |
| `broker_admin` | Brokerage operations, finance, carriers, EDI, integrations, returns and settings |
| `broker_agent` | Quoting, assigning carriers and viewing margins |
| `readonly` | Read access to operational and financial data |
| `finance` | Quotes, charges, invoices, carrier invoices and financial reports |

Custom roles are managed under Settings, Roles and permissions, or through the API:

| Endpoint | Permission |
|---|---|
| `GET /api/v1/roles`, `GET /api/v1/roles/:id`, `GET /api/v1/roles/permissions` | `roles:read` |
| `POST /api/v1/roles`, `PUT /api/v1/roles/:id`, `DELETE /api/v1/roles/:id` | `roles:write` |
| `POST /api/v1/roles/:roleId/users/:userId`, `DELETE /api/v1/roles/:roleId/users/:userId` | `roles:write` |
| `POST /api/v1/roles/seed` | `roles:write`. Seeds or re-syncs the system roles |

### How a route checks permission

Permission checks live in a preHandler, never in the handler body:

```ts
server.get('/api/v1/roles', {
  preHandler: requirePermission('roles:read'),
}, handler);
```

`requirePermission` takes one or more permissions and requires all of them. A `resource:*` grant
satisfies any action on that resource.

A plugin whose routes split cleanly into reads and writes can use `registerReadWriteGuard(server,
'returns')`, which requires `returns:read` for `GET` and `returns:write` for everything else, and
registers the tenant scope in the same place.

A permission check is always paired with a tenant check. `shipments:write` does not allow writing
another organisation's shipment, and an id from another organisation returns `404`.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `401 Authorization header required` | No `Authorization: Bearer` header. Plain links and `<img>` tags do not send it |
| `401 Invalid or expired token` | The token is past its 12 hours, was signed with a different `JWT_SECRET`, or carries a `scope` claim |
| `403` on a write | The user's roles do not grant the permission. Reads are open to any signed-in user unless a route says otherwise |
| `401` naming the tenant | The token has no `organizationId` and more than one organisation exists |
| A role change has no effect | The user is still on a token minted before the change. Sign in again |
