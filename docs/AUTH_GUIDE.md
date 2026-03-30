# Authentication & Authorization Guide

This guide covers the Open TMS auth-service: user management, JWT-based authentication, role-based access control (RBAC), and OAuth integration with Google and Microsoft.

## Overview

The auth-service is a standalone Fastify microservice that provides:
- User registration and login with JWT tokens
- Role-based access control with granular permissions
- OAuth single sign-on (Google, Microsoft)
- Account security (lockout, password policies, token rotation)

Base URL: `http://localhost:3002` (or set via `AUTH_PORT`)

## Table of Contents

- [First-Time Setup](#first-time-setup)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [Setup Endpoints](#setup-endpoints)
  - [Authentication Endpoints](#authentication-endpoints)
  - [User Management Endpoints](#user-management-endpoints)
  - [Role Management Endpoints](#role-management-endpoints)
  - [OAuth Provider Admin Endpoints](#oauth-provider-admin-endpoints)
  - [OAuth Flow Endpoints](#oauth-flow-endpoints)
- [Roles & Permissions](#roles--permissions)
- [Token Management](#token-management)
- [OAuth Integration](#oauth-integration)
- [Security Features](#security-features)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

---

## First-Time Setup

Before using the auth-service, you must run the one-time setup to seed default roles and create an admin user. This endpoint only works when **no users exist** in the system.

**1. Check if setup is needed:**

```bash
curl http://localhost:3002/api/v1/auth/setup/status
```

```json
{ "data": { "setupRequired": true, "userCount": 0 }, "error": null }
```

**2. Run setup:**

```bash
curl -X POST http://localhost:3002/api/v1/auth/setup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePass1",
    "firstName": "Admin",
    "lastName": "User",
    "organizationName": "My Company"
  }'
```

This seeds the 5 default roles (admin, dispatcher, warehouse, readonly, customer), creates OAuth provider placeholders, and registers the admin user with the `admin` role.

---

## Quick Start

**Step 1 — Run setup** (first time only, see above)

**Step 2 — Log in:**

```bash
curl -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "admin@example.com", "password": "SecurePass1" }'
```

```json
{
  "data": {
    "user": { "id": "uuid", "email": "admin@example.com", "firstName": "Admin", "lastName": "User", "roles": ["admin"] },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "abc123...",
    "expiresIn": 900
  },
  "error": null
}
```

**Step 3 — Use the access token** on authenticated endpoints:

```bash
curl http://localhost:3002/api/v1/auth/me \
  -H "Authorization: Bearer eyJhbGciOi..."
```

**Step 4 — Refresh** before the access token expires (900 seconds / 15 minutes):

```bash
curl -X POST http://localhost:3002/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{ "refreshToken": "abc123..." }'
```

You receive a new access token and refresh token pair. The old refresh token is invalidated (token rotation).

---

## API Reference

All responses use the envelope format: `{ "data": ..., "error": ... }`

### Setup Endpoints

#### Check Setup Status

```
GET /api/v1/auth/setup/status
```

Returns whether initial setup is required.

| Field | Type | Description |
|-------|------|-------------|
| `setupRequired` | boolean | `true` if no users exist |
| `userCount` | number | Current number of users |

#### Run Setup

```
POST /api/v1/auth/setup
```

Seeds default roles and creates the first admin user. Only works when `userCount` is 0.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Admin email address |
| `password` | string | Yes | Min 8 chars, must include uppercase, lowercase, and number |
| `firstName` | string | Yes | Admin first name |
| `lastName` | string | Yes | Admin last name |
| `organizationName` | string | No | Creates an organization (uses existing if omitted) |

**Errors:** `409` if setup already completed.

---

### Authentication Endpoints

#### Register

```
POST /api/v1/auth/register
```

Create a new user account. The user is assigned the `readonly` role by default.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email address |
| `password` | string | Yes | Min 8 chars |
| `firstName` | string | Yes | First name |
| `lastName` | string | Yes | Last name |
| `organizationId` | string (UUID) | No | Organization to associate with |
| `roleName` | string | No | Role to assign (default: `readonly`) |

**Response:** `201` with user data. **Errors:** `409` if email already registered.

#### Login

```
POST /api/v1/auth/login
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Email address |
| `password` | string | Yes | Password |

**Response:**
```json
{
  "data": {
    "user": { "id": "...", "email": "...", "firstName": "...", "lastName": "...", "roles": ["..."] },
    "accessToken": "eyJ...",
    "refreshToken": "...",
    "expiresIn": 900
  },
  "error": null
}
```

**Errors:** `401` for invalid credentials or locked account.

#### Refresh Token

```
POST /api/v1/auth/refresh
```

Exchange a valid refresh token for a new token pair. The old refresh token is invalidated (rotation).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `refreshToken` | string | Yes | Current refresh token |

**Response:** Same shape as login (new `accessToken`, `refreshToken`, `expiresIn`).

**Errors:** `401` if token is invalid or expired.

#### Logout

```
POST /api/v1/auth/logout
```

Invalidates a single refresh token (session).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `refreshToken` | string | No | Token to invalidate |

#### Logout All Sessions

```
POST /api/v1/auth/logout-all
```

**Auth required.** Revokes all refresh tokens for the authenticated user.

#### Get Current User

```
GET /api/v1/auth/me
```

**Auth required.** Returns the authenticated user's profile.

```json
{
  "data": { "id": "...", "email": "...", "firstName": "...", "lastName": "...", "roles": ["admin"] },
  "error": null
}
```

#### Change Password

```
PUT /api/v1/auth/change-password
```

**Auth required.** Not available for OAuth-only accounts.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `currentPassword` | string | Yes | Current password |
| `newPassword` | string | Yes | Min 8 chars, must meet password policy |

**Errors:** `401` if current password is wrong. `400` if the account uses OAuth or the new password doesn't meet requirements.

---

### User Management Endpoints

All user management endpoints require authentication and the `users:read` or `users:write` permission.

#### List Users

```
GET /api/v1/users
```

**Permission:** `users:read`

Returns all users.

#### Get User

```
GET /api/v1/users/:id
```

**Permission:** `users:read`

Returns user with role details.

#### Create User

```
POST /api/v1/users
```

**Permission:** `users:write`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email |
| `password` | string | Yes | Min 8 chars, must meet password policy |
| `firstName` | string | Yes | First name |
| `lastName` | string | Yes | Last name |
| `organizationId` | string (UUID) | No | Organization ID |
| `customerId` | string (UUID) | No | Link user to a customer account |
| `phone` | string | No | Phone number |
| `timezone` | string | No | Timezone (e.g., `America/New_York`) |
| `roleIds` | string[] (UUIDs) | No | Role IDs to assign |

**Response:** `201` with user and roles. **Errors:** `409` if email taken.

#### Update User

```
PUT /api/v1/users/:id
```

**Permission:** `users:write`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `firstName` | string | No | First name |
| `lastName` | string | No | Last name |
| `phone` | string | No | Phone number |
| `timezone` | string | No | Timezone |
| `avatarUrl` | string (URL) | No | Avatar URL |
| `active` | boolean | No | Enable/disable account |

#### Update User Roles

```
PUT /api/v1/users/:id/roles
```

**Permission:** `users:write`

Replaces all roles for the user.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `roleIds` | string[] (UUIDs) | Yes | New role IDs (replaces existing) |

#### Delete (Archive) User

```
DELETE /api/v1/users/:id
```

**Permission:** `users:write`

Archives (deactivates) the user. You cannot deactivate your own account.

---

### Role Management Endpoints

All role endpoints require authentication and the `roles:read` or `roles:write` permission. System roles (the 5 defaults) cannot be modified or deleted.

#### List Roles

```
GET /api/v1/roles
```

**Permission:** `roles:read`

#### Get Role

```
GET /api/v1/roles/:id
```

**Permission:** `roles:read`

#### Create Role

```
POST /api/v1/roles
```

**Permission:** `roles:write`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique name (1-50 chars) |
| `description` | string | No | Human-readable description |
| `permissions` | string[] | Yes | Permission strings (see [Roles & Permissions](#roles--permissions)) |

**Response:** `201`. **Errors:** `409` if name exists.

#### Update Role

```
PUT /api/v1/roles/:id
```

**Permission:** `roles:write`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | No | Updated description |
| `permissions` | string[] | No | Updated permissions |

**Errors:** `403` if role is a system role.

#### Delete Role

```
DELETE /api/v1/roles/:id
```

**Permission:** `roles:write`

**Errors:** `403` if role is a system role.

---

### OAuth Provider Admin Endpoints

#### List Enabled Providers (Public)

```
GET /api/v1/auth/providers
```

**No auth required.** Returns enabled providers for frontend login buttons.

```json
{
  "data": [
    { "provider": "google", "displayName": "Google" },
    { "provider": "microsoft", "displayName": "Microsoft" }
  ],
  "error": null
}
```

#### List All Providers (Admin)

```
GET /api/v1/admin/auth-providers
```

**Permission:** `auth:admin`

Returns all providers with configuration (secrets masked as `••••••••`).

#### Get Provider

```
GET /api/v1/admin/auth-providers/:id
```

**Permission:** `auth:admin`

#### Update Provider

```
PUT /api/v1/admin/auth-providers/:id
```

**Permission:** `auth:admin`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `displayName` | string | No | Display name for UI |
| `enabled` | boolean | No | Enable/disable provider |
| `clientId` | string | No | OAuth client ID |
| `clientSecret` | string | No | OAuth client secret |
| `tenantId` | string | No | Microsoft tenant ID (for single-tenant apps) |
| `allowedDomains` | string[] | No | Restrict sign-in to specific email domains |
| `autoCreateUsers` | boolean | No | Auto-create user accounts on first OAuth login |
| `defaultRoleId` | string (UUID) | No | Role for auto-created users |

**Note:** `clientId` and `clientSecret` must be set before enabling a provider.

#### Toggle Provider

```
POST /api/v1/admin/auth-providers/:id/toggle
```

**Permission:** `auth:admin`

Quick enable/disable toggle. Requires credentials to be configured before enabling.

---

### OAuth Flow Endpoints

#### Start OAuth Flow

```
GET /api/v1/oauth/:provider
```

Redirects the user's browser to the OAuth provider's login page. Accepts an optional `returnUrl` query parameter.

```
GET /api/v1/oauth/google?returnUrl=/dashboard
```

#### OAuth Callback

```
GET /api/v1/oauth/:provider/callback
```

Handles the provider's redirect after authentication. On success, redirects to `FRONTEND_URL/auth/callback` with `accessToken`, `refreshToken`, `expiresIn`, and `returnUrl` as query parameters.

---

## Roles & Permissions

### Default Roles

The system ships with 5 built-in roles (seeded during setup). System roles cannot be modified or deleted.

| Role | Description | Permissions |
|------|-------------|-------------|
| **admin** | Full system access | `*` (wildcard — all permissions) |
| **dispatcher** | Manage shipments, orders, and carrier assignments | `shipments:*`, `orders:*`, `carriers:read`, `lanes:read`, `locations:read`, `customers:read`, `integrations:read` |
| **warehouse** | Manage orders and inventory | `orders:read`, `orders:update`, `shipments:read`, `locations:read`, `customers:read` |
| **readonly** | View-only access to all data | `shipments:read`, `orders:read`, `carriers:read`, `lanes:read`, `locations:read`, `customers:read`, `integrations:read` |
| **customer** | Customer portal — own data only | `orders:read:own`, `shipments:read:own`, `documents:read:own` |

### Permission Format

Permissions follow the pattern `resource:action` with optional scope:

| Pattern | Meaning | Example |
|---------|---------|---------|
| `resource:action` | Specific action on a resource | `shipments:read` |
| `resource:*` | All actions on a resource | `orders:*` |
| `resource:action:own` | Action scoped to user's own data | `orders:read:own` |
| `*` | Superadmin wildcard (all permissions) | `*` |

### Custom Roles

You can create custom roles with any combination of permissions:

```bash
curl -X POST http://localhost:3002/api/v1/roles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "logistics-manager",
    "description": "Read/write shipments and orders, read-only carriers",
    "permissions": ["shipments:*", "orders:*", "carriers:read"]
  }'
```

---

## Token Management

### Token Lifecycle

```
Login/OAuth ──> Access Token (15 min) + Refresh Token (7 days)
                    │                        │
                    │  expires ──> Refresh ──>│ Old token deleted
                    │              endpoint   │ New pair issued
                    │                        │
                    └── Logout ──────────────>│ Token deleted
                    └── Logout All ──────────>│ All sessions deleted
```

### Access Token (JWT)

The access token is a signed JWT containing:

| Claim | Description |
|-------|-------------|
| `sub` | User ID |
| `email` | User email |
| `roles` | Array of role names |
| `permissions` | Flattened array of permission strings |
| `organizationId` | Organization ID (if set) |
| `customerId` | Customer ID (if linked) |
| `iss` | `open-tms-auth` |
| `aud` | `open-tms` |
| `exp` | Expiration timestamp |

Pass the access token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOi...
```

### Refresh Token

- Opaque 48-byte random string (base64url-encoded)
- Stored server-side with session metadata (user agent, IP)
- 7-day expiry by default
- **Token rotation:** each refresh invalidates the old token and issues a new pair

---

## OAuth Integration

### Supported Providers

| Provider | Authorization URL | Scopes |
|----------|------------------|--------|
| Google | `accounts.google.com/o/oauth2/v2/auth` | `openid`, `email`, `profile` |
| Microsoft | `login.microsoftonline.com/{tenantId}/oauth2/v2.0/authorize` | `openid`, `email`, `profile`, `User.Read` |

### Setup Walkthrough

**1. Create an OAuth application** at the provider's developer console.

**2. Set the redirect URI** to:
```
http://your-auth-service/api/v1/oauth/{provider}/callback
```

For local development:
- Google: `http://localhost:3002/api/v1/oauth/google/callback`
- Microsoft: `http://localhost:3002/api/v1/oauth/microsoft/callback`

**3. Configure the provider** in Open TMS:

```bash
# Get the provider ID
curl http://localhost:3002/api/v1/admin/auth-providers \
  -H "Authorization: Bearer $TOKEN"

# Update with your OAuth credentials
curl -X PUT http://localhost:3002/api/v1/admin/auth-providers/<provider-id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "autoCreateUsers": true,
    "allowedDomains": ["yourcompany.com"]
  }'
```

**4. Enable the provider:**

```bash
curl -X POST http://localhost:3002/api/v1/admin/auth-providers/<provider-id>/toggle \
  -H "Authorization: Bearer $TOKEN"
```

**5. Verify** — the provider now appears in the public list:

```bash
curl http://localhost:3002/api/v1/auth/providers
```

### OAuth Flow

```
Browser                Auth Service              OAuth Provider
  │                        │                          │
  ├─ GET /oauth/google ───>│                          │
  │                        ├─ Generate CSRF state     │
  │                        ├─ Redirect ──────────────>│
  │                        │                          │
  │                        │    User authenticates    │
  │                        │                          │
  │                        │<── Callback with code ───┤
  │                        ├─ Validate state          │
  │                        ├─ Exchange code for tokens │
  │                        ├─ Find/create user        │
  │                        ├─ Issue JWT pair           │
  │<── Redirect with tokens┤                          │
  │                        │                          │
```

The frontend receives tokens at `/auth/callback?accessToken=...&refreshToken=...&expiresIn=...&returnUrl=...`

### Provider Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `allowedDomains` | Array of allowed email domains (empty = all domains) | `[]` |
| `autoCreateUsers` | Create user on first OAuth login | `false` |
| `defaultRoleId` | Role assigned to auto-created users | `readonly` role |
| `tenantId` | Microsoft-specific: Azure AD tenant ID | `common` |

---

## Security Features

| Feature | Details |
|---------|---------|
| **Password policy** | Min 8 characters, at least 1 uppercase, 1 lowercase, 1 number |
| **Password hashing** | bcrypt with 12 salt rounds |
| **Account lockout** | 5 failed login attempts triggers 15-minute lockout |
| **Token rotation** | Refresh tokens are single-use; each refresh issues a new pair |
| **OAuth CSRF protection** | Random state parameter with 10-minute expiry |
| **Self-deletion prevention** | Users cannot deactivate their own account |
| **System role protection** | Built-in roles cannot be modified or deleted |
| **JWT signing** | HMAC-SHA256 with configurable secret, issuer `open-tms-auth`, audience `open-tms` |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_PORT` | `3002` | Port the auth service listens on |
| `JWT_SECRET` | `open-tms-dev-secret-change-in-production` | Secret for signing JWTs (change in production!) |
| `JWT_ACCESS_EXPIRES_IN` | `900` | Access token TTL in seconds (15 minutes) |
| `JWT_REFRESH_EXPIRES_IN` | `604800` | Refresh token TTL in seconds (7 days) |
| `AUTH_SERVICE_URL` | `http://localhost:3002` | Public URL for OAuth callback redirects |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend URL for post-OAuth redirects |
| `DATABASE_URL` | *(required)* | PostgreSQL connection string (shared with main backend) |

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| `409` "Setup already completed" | Users already exist | Setup is one-time only. Log in with the admin account. |
| `401` on authenticated endpoints | Access token expired | Refresh the token using `POST /api/v1/auth/refresh` |
| `403` "Insufficient permissions" | User's role lacks the required permission | Assign the appropriate role via `PUT /api/v1/users/:id/roles` |
| Account locked | 5 failed login attempts | Wait 15 minutes or have an admin update the user |
| OAuth "Invalid or expired OAuth state" | State token expired (10-minute window) | Retry the OAuth flow from the beginning |
| OAuth "domain not allowed" | Email domain not in `allowedDomains` | Add the domain to the provider's `allowedDomains` config |
| "Password change not available for OAuth accounts" | OAuth-only user has no password | OAuth users sign in via their provider, not with a password |
| "This account uses OAuth sign-in" | Trying to log in with password on an OAuth account | Use the OAuth sign-in flow instead |
