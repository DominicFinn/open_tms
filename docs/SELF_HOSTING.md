# Self-hosting Open TMS

How to run Open TMS on a single server you control, with no managed services. If you would rather
use a cloud platform, the Deploy table in the [README](../README.md) has one-click options for
DigitalOcean, Azure, Google Cloud and AWS.

This guide is provider-neutral. Substitute your own hostname wherever `tms.example.com` appears.

## What you need

| | |
|---|---|
| Server | 2 vCPU and 4 GB RAM is enough for a small installation. Add swap if you build on the box, since the frontend build is memory-hungry. |
| OS | Any current Linux with systemd. |
| Node.js | 22 LTS. |
| PostgreSQL | 16 or later. |
| Object storage | Anything S3-compatible. [MinIO](https://min.io) works well on the same box. |
| Reverse proxy | [Caddy](https://caddyserver.com) or nginx, to terminate TLS. |

There is no Redis. Background jobs run on [pg-boss](https://github.com/timgit/pg-boss), which uses
the same PostgreSQL database.

## Install

Clone the repository, then install and build from the repository root. It is an npm workspace, so
dependencies are hoisted and a root install covers every package.

```bash
git clone https://github.com/dominicfinn/open_tms.git
cd open_tms
npm ci
```

> **Building on Linux:** `package-lock.json` is generated on macOS, so `npm ci` skips the Linux
> native rollup binary and the frontend build fails with `MODULE_NOT_FOUND`. Install it explicitly:
>
> ```bash
> npm install --no-save "@rollup/rollup-linux-x64-gnu@$(node -p "require('./node_modules/rollup/package.json').version")"
> ```

Then build:

```bash
npm -w backend run prisma:generate
npm -w packages/shared run build
npm -w backend run build
VITE_API_URL=https://tms.example.com npm -w frontend run build
```

`VITE_API_URL` is baked into the bundle at build time, so it has to be set here rather than at
runtime. Set it to the origin the browser will use. If the API and the frontend are served from the
same hostname, that is just your public URL, with no path.

The backend build currently exits non-zero on pre-existing type errors while still emitting usable
output. That is tracked and is not something you have done wrong.

## Database

Create a role and a database, then apply the migrations:

```bash
sudo -u postgres createuser --pwprompt opentms
sudo -u postgres createdb -O opentms opentms

cd backend
DATABASE_URL="postgresql://opentms:PASSWORD@127.0.0.1:5432/opentms?schema=public" \
  npx prisma migrate deploy
```

Use `migrate deploy`, never `migrate dev`, on a server. If your password contains characters that
are reserved in a URL, percent-encode them.

## Object storage

Any S3-compatible endpoint works. With MinIO on the same host, bind it to localhost, create a
bucket, and issue a scoped credential rather than using the root one:

```bash
mc mb local/open-tms
mc admin user add local open-tms-storage YOUR_SECRET
mc admin policy attach local readwrite --user open-tms-storage
```

File storage is what backs uploads, generated documents and proof-of-delivery images. If you leave
it unconfigured the rest of the application still works, but anything touching a file will error.

## Configuration

Put the environment in a file the service can read, owned by root and readable only by the service
group. Quote any value containing `&`, so the file can also be sourced by a shell.

**Required**

```bash
NODE_ENV=production
PORT=3001
DATABASE_URL="postgresql://opentms:PASSWORD@127.0.0.1:5432/opentms?schema=public&connection_limit=10"

# Public origin. PUBLIC_URL is used to build shipment share links.
PUBLIC_URL=https://tms.example.com
CORS_ORIGINS=https://tms.example.com

# Generate both with `openssl rand -hex 48`. Losing JWT_SECRET logs everyone out.
# Losing CREDENTIALS_ENCRYPTION_KEY makes stored carrier credentials unrecoverable.
JWT_SECRET=
CREDENTIALS_ENCRYPTION_KEY=

S3_ENDPOINT=http://127.0.0.1:9000
S3_BUCKET=open-tms
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
```

**Optional, by feature**

| Variable | Enables |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM_ADDRESS` | Outbound email. Without it, email is logged to the console instead of sent. |
| `GOOGLE_MAPS_API_KEY`, `HERE_API_KEY`, `TOMTOM_API_KEY`, `VALHALLA_BASE_URL`, `ROUTING_PROVIDER` | Routing, distance and ETA monitoring. The ETA monitor does not register without a routing provider. |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Agent triage and automation suggestions. |
| `LOCOAWARE_WEBHOOK_SECRET` | Signature verification on inbound IoT telemetry webhooks. Set this before pointing real devices at the instance. |
| `*_CRON` | Overrides for the built-in schedules. The defaults are sensible. |

Keep this file out of version control and back it up somewhere you can actually restore from. The
secrets above cannot be recovered from the database.

## Running it

Run the API under systemd so it restarts on failure and starts at boot.

```ini
[Unit]
Description=Open TMS API
After=network-online.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=opentms
WorkingDirectory=/srv/opentms/app/backend
EnvironmentFile=/etc/opentms/app.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/srv/opentms

[Install]
WantedBy=multi-user.target
```

### Workers

By default the API process also runs the queue consumers and the cron schedules: projections, event
handlers, inbound webhooks, SLA and cutoff monitors, invoice and quote jobs, carrier tracking polls
and webhook retries. For a single-server install that is the right choice and there is nothing else
to start.

Setting `DISABLE_EMBEDDED_WORKERS=true` moves that work to a separate `dist/worker.js` process, so
the API only serves requests. That split is worth it once request latency and background work start
competing for CPU. Check the open issues first: the separate worker process has a known problem that
makes it unrunnable at present.

### EDI collector

`edi-collector/` is an optional separate service that polls partner SFTP servers for EDI files and
forwards them to the backend. It needs `BACKEND_URL` and an `API_KEY` created under
Settings, API Keys. Skip it if you are not receiving EDI over SFTP.

## TLS and the reverse proxy

Terminate TLS at the proxy, serve the built SPA as static files, and pass API paths through to the
backend. With Caddy, certificates are automatic:

```
tms.example.com {
	encode zstd gzip

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Frame-Options "DENY"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "geolocation=(), microphone=(), camera=()"
		-Server
	}

	@api path /api/* /health /metrics /docs /docs/*
	handle @api {
		reverse_proxy 127.0.0.1:3001
	}

	handle {
		root * /srv/opentms/app/frontend
		try_files {path} /index.html
		file_server
	}
}
```

The `try_files` fallback matters. Without it, reloading any page other than the root returns a 404.

The application does not set security headers itself, so setting them at the proxy as above is worth
doing. Bind PostgreSQL and your object storage to localhost, and open only 22, 80 and 443 at the
firewall.

## First login

There is no self-registration and no setup endpoint. `POST /api/v1/seed` exists but returns 403
whenever `NODE_ENV=production`, so on a real install the only route in is the seed script, run
directly against the database:

```bash
cd backend
set -a; . /etc/opentms/app.env; set +a
npx tsx src/scripts/comprehensive-seed.ts
```

It prints the demo credentials when it finishes. Note that it **wipes existing data** unless you
pass `--no-wipe`.

This creates a full demo organisation with fictional shipments, customers and carriers, which is
what you want for an evaluation and not what you want for a real installation. If you are setting up
in earnest, seed it, log in, change the passwords, and delete the demo records. A proper bootstrap
command is worth having and does not exist yet.

## Upgrading

```bash
git pull
npm ci
npm -w backend run prisma:generate && npm -w packages/shared run build && npm -w backend run build
DATABASE_URL=... npx --prefix backend prisma migrate deploy
VITE_API_URL=https://tms.example.com npm -w frontend run build
sudo systemctl restart opentms-api
```

Migrations run forward only. Take a database dump before upgrading.

## Backups

Three things, and all three are needed to restore:

1. The PostgreSQL database. `pg_dump` on a schedule, held somewhere off the machine.
2. The object storage bucket.
3. The environment file. `JWT_SECRET` and `CREDENTIALS_ENCRYPTION_KEY` exist nowhere else, and
   without the latter every stored carrier credential is lost.
