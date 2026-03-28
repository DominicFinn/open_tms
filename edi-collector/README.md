# EDI Collector Service

A lightweight standalone service that automatically polls partner SFTP servers for EDI files and forwards them to the Open TMS backend for processing.

## Overview

The EDI collector runs as a separate process (or container) alongside the backend. It has **no direct database access** — all communication goes through the backend REST API.

```
Partner SFTP    ──► EDI Collector ──► Backend API ──► Database
(poll & download)    (forward)        (parse & import)
```

## Quick Start

### With Docker Compose (Recommended)

```bash
# From the repo root
export EDI_COLLECTOR_API_KEY=sk_live_your_service_api_key
docker compose up --build -d
```

The collector service is already configured in `docker-compose.yml`.

### Standalone

```bash
cd edi-collector
npm install
cp .env.example .env
# Edit .env with your settings
npm run dev
```

## Configuration

All configuration is via environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BACKEND_URL` | Yes | — | URL of the Open TMS backend (e.g., `http://localhost:3001`) |
| `API_KEY` | Yes | — | Backend API key for authentication (`sk_live_*` format) |
| `POLL_CONFIG_INTERVAL` | No | `300` | How often (seconds) to refresh partner configs from the backend |
| `LOG_LEVEL` | No | `info` | Log verbosity: `debug`, `info`, `warn`, `error` |

### API Key Setup

The collector authenticates to the backend using an API key passed via the `x-api-key` header.

1. In the Open TMS UI, go to **API Keys**
2. Create a new key (no customer scope needed — this is a service key)
3. Copy the generated `sk_live_*` key
4. Set it as the `API_KEY` environment variable

## How It Works

### Startup

1. Loads environment configuration
2. Fetches active, polling-enabled EDI partner configs from `GET /api/v1/edi-partners?active=true&pollingEnabled=true`
3. Schedules a collection job for each partner

### Per-Partner Collection Cycle

1. Connect to the partner's SFTP server using stored credentials
2. List files in the configured remote directory
3. Filter files matching the partner's glob pattern (e.g., `*.edi,*.x12,*.850`)
4. Skip files already seen (tracked by `filename:size:modifyTime`)
5. Download new files and POST content to `POST /api/v1/orders/import/edi`
6. Mark files as seen on success (or on 409 duplicate)

### Scheduling

Each partner can use either:
- **Interval-based**: polls every N seconds (configured via `pollingInterval`)
- **Cron-based**: uses a cron expression (configured via `pollingCron`)

If a collection cycle is still running when the next one triggers, it's skipped.

### Config Refresh

Every `POLL_CONFIG_INTERVAL` seconds, the collector re-fetches partner configs from the backend. This means:
- New partners are picked up automatically
- Disabled partners are stopped
- Changed SFTP credentials take effect on the next cycle

### Deduplication

Two layers of dedup:
1. **Collector**: tracks `filename:size:modifyTime` per partner in memory — prevents re-downloading the same file
2. **Backend**: SHA-256 hash check — prevents re-importing identical content even if filename differs

Files are NOT deleted from the SFTP server after download.

## Project Structure

```
edi-collector/
├── src/
│   ├── index.ts        # Entry point — starts scheduler, handles shutdown
│   ├── config.ts       # Environment config + partner config fetching
│   ├── collector.ts    # SFTP connection, file download, backend upload
│   ├── scheduler.ts    # Per-partner job scheduling (cron or interval)
│   └── logger.ts       # Simple leveled logger
├── .env.example        # Environment variable template
├── Dockerfile          # Container build
├── package.json
└── tsconfig.json
```

## Docker Compose

The collector is included in the root `docker-compose.yml`:

```yaml
edi-collector:
  build: ./edi-collector
  environment:
    BACKEND_URL: http://backend:3001
    API_KEY: ${EDI_COLLECTOR_API_KEY:-changeme}
    POLL_CONFIG_INTERVAL: "300"
    LOG_LEVEL: info
  depends_on:
    - backend
  restart: unless-stopped
```

## Troubleshooting

### Collector won't start
- Check that `BACKEND_URL` and `API_KEY` are set
- Verify the backend is reachable from the collector container

### No files being collected
- Check that at least one EDI partner has `pollingEnabled: true` and `active: true`
- Verify SFTP credentials are correct (host, port, username, password/key)
- Check that `sftpFilePattern` matches files on the server
- Set `LOG_LEVEL=debug` for verbose output

### Files downloaded but no orders created
- Check the EDI Files page for processing errors
- Verify the EDI content is valid X12 850
- Ensure the customer referenced in the EDI exists in the system

### Duplicate file warnings
- Expected behavior — the backend deduplicates by content hash
- The collector also tracks seen files in memory (resets on restart)

## Dependencies

- `ssh2-sftp-client` — SFTP operations
- `node-cron` — Cron-based scheduling
- `dotenv` — Environment variable loading
