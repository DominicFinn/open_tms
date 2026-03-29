# Auth Service

Authentication and authorization service for Open TMS. Manages users, roles, sessions, and JWT tokens.

## Architecture

- **Standalone Fastify app** running on port 3002 (configurable via `AUTH_PORT`)
- **Shared PostgreSQL database** with the main backend (same Prisma schema)
- **JWT-based auth** — access tokens (15min) + refresh tokens (7 days) with rotation
- **Role-based access control** — permissions checked via middleware in both auth-service and backend

## Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma client (uses shared schema from backend)
npm run prisma:generate

# Run in development mode
npm run dev
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string (same as backend) |
| `AUTH_PORT` | `3002` | Port for the auth service |
| `JWT_SECRET` | `open-tms-dev-secret-change-in-production` | Secret for signing JWTs |
| `JWT_ACCESS_EXPIRES_IN` | `900` | Access token TTL in seconds (15 min) |
| `JWT_REFRESH_EXPIRES_IN` | `604800` | Refresh token TTL in seconds (7 days) |

## First-Run Setup

Before any users can log in, run the setup endpoint to seed default roles and create the first admin:

```bash
curl -X POST http://localhost:3002/api/v1/auth/setup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!",
    "firstName": "Admin",
    "lastName": "User"
  }'
```

## API Endpoints

### Public (no auth required)
- `POST /api/v1/auth/setup` — First-run setup (seed roles + create admin)
- `GET  /api/v1/auth/setup/status` — Check if setup is needed
- `POST /api/v1/auth/register` — Register a new user
- `POST /api/v1/auth/login` — Login, returns access + refresh tokens
- `POST /api/v1/auth/refresh` — Exchange refresh token for new token pair
- `POST /api/v1/auth/logout` — Invalidate a refresh token

### Authenticated
- `GET  /api/v1/auth/me` — Get current user profile
- `PUT  /api/v1/auth/change-password` — Change own password
- `POST /api/v1/auth/logout-all` — Revoke all sessions

### User Management (requires `users:read` / `users:write`)
- `GET    /api/v1/users` — List all users
- `GET    /api/v1/users/:id` — Get user by ID
- `POST   /api/v1/users` — Create user (admin)
- `PUT    /api/v1/users/:id` — Update user
- `PUT    /api/v1/users/:id/roles` — Assign roles to user
- `DELETE /api/v1/users/:id` — Deactivate user

### Role Management (requires `roles:read` / `roles:write`)
- `GET    /api/v1/roles` — List all roles
- `GET    /api/v1/roles/:id` — Get role by ID
- `POST   /api/v1/roles` — Create custom role
- `PUT    /api/v1/roles/:id` — Update role permissions
- `DELETE /api/v1/roles/:id` — Delete custom role

## Default Roles

| Role | Permissions |
|---|---|
| `admin` | `*` (full access) |
| `dispatcher` | Shipments, orders, carriers, lanes, locations, customers, integrations |
| `warehouse` | Orders (read/update), shipments (read), locations, customers |
| `readonly` | Read-only access to all data |
| `customer` | Own orders, shipments, and documents only |

## Security

- Passwords hashed with bcrypt (12 rounds)
- Account lockout after 5 failed login attempts (15 min)
- Refresh token rotation (old token invalidated on each refresh)
- Tokens stored as SHA-256 hashes in database
- Access tokens are short-lived (15 min) to limit exposure
