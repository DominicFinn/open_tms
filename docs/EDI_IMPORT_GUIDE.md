# EDI Import Guide

Open TMS supports importing orders from EDI X12 850 (Purchase Order) documents. You can upload EDI files manually through the UI, send them via the API, or configure automated SFTP collection from trading partners.

## Table of Contents

- [Quick Start](#quick-start)
- [Supported EDI Formats](#supported-edi-formats)
- [Manual Upload (UI)](#manual-upload-ui)
- [API Import](#api-import)
- [EDI Partner Configuration](#edi-partner-configuration)
- [Automated SFTP Collection](#automated-sftp-collection)
- [EDI File History](#edi-file-history)
- [Field Mapping](#field-mapping)
- [Troubleshooting](#troubleshooting)

## Quick Start

1. Navigate to **Orders** in the sidebar and click **Import EDI**
2. Drag and drop an `.edi`, `.x12`, `.850`, or `.txt` file
3. Click **Preview** to see parsed orders before importing
4. Click **Import** to create orders

## Supported EDI Formats

| Standard | Transaction Set | Description |
|----------|----------------|-------------|
| X12 | 850 | Purchase Order |

The parser supports X12 version 005010 and earlier. Key segments parsed:

| Segment | Purpose |
|---------|---------|
| BEG | PO number and date |
| DTM | Requested delivery/ship dates |
| N1/N3/N4 | Ship-from, ship-to, and buyer addresses |
| PO1 | Line items (SKU, quantity, unit price) |
| PID | Product descriptions |
| MEA | Weight and dimensions |
| CTT | Transaction totals |

## Manual Upload (UI)

1. Go to **Orders > Import EDI** (or use the sidebar shortcut)
2. Drag and drop your EDI file, or click to browse
3. Optionally select an **EDI Partner** to apply custom field mapping
4. Click **Preview** to parse without creating orders — review the parsed orders table
5. Click **Import** to create orders in the system

The preview shows:
- Order number, PO number, customer name
- Ship-from and ship-to addresses
- Line item count and total quantity

## API Import

### Import EDI Content

```bash
curl -X POST http://localhost:3001/api/v1/orders/import/edi \
  -H "Content-Type: application/json" \
  -d '{
    "ediContent": "ISA*00*          *00*          *ZZ*SENDER...",
    "partnerId": "optional-partner-uuid",
    "customerId": "optional-customer-uuid",
    "fileName": "PO_20240115.edi",
    "source": "manual",
    "autoAssign": false
  }'
```

**Parameters:**

| Field | Required | Description |
|-------|----------|-------------|
| `ediContent` | Yes | Raw X12 EDI content as a string |
| `partnerId` | No | EDI partner ID — applies partner's field mapping and customer |
| `customerId` | No | Override customer ID (ignored if partnerId has a customer) |
| `fileName` | No | Original filename for tracking |
| `source` | No | `manual` (default), `sftp`, or `api` |
| `autoAssign` | No | Auto-assign created orders to shipments via lane matching |

**Response:**
```json
{
  "data": {
    "success": true,
    "fileId": "uuid",
    "ordersCreated": 3,
    "orderIds": ["uuid1", "uuid2", "uuid3"],
    "errors": []
  },
  "error": null
}
```

### Preview EDI Content

Parse without creating orders:

```bash
curl -X POST http://localhost:3001/api/v1/orders/import/edi/preview \
  -H "Content-Type: application/json" \
  -d '{
    "ediContent": "ISA*00*          *00*          *ZZ*SENDER...",
    "partnerId": "optional-partner-uuid"
  }'
```

**Response:**
```json
{
  "data": {
    "orders": [
      {
        "orderNumber": "PO-12345",
        "poNumber": "PO-12345",
        "customerName": "Acme Corp",
        "shipFrom": { "name": "Warehouse A", "address1": "123 Main St", "city": "Chicago", "state": "IL" },
        "shipTo": { "name": "Store 42", "address1": "456 Oak Ave", "city": "Detroit", "state": "MI" },
        "lineItems": [
          { "sku": "WIDGET-A", "description": "Blue Widget", "quantity": 100, "unitPrice": 12.50, "weight": 25.0 }
        ]
      }
    ],
    "totalOrders": 1,
    "totalLineItems": 1
  },
  "error": null
}
```

### Deduplication

Files are deduplicated by SHA-256 hash. If the same EDI content is submitted twice, the second request returns `409 Conflict`:

```json
{ "data": null, "error": "Duplicate EDI file — already processed (file ID: <uuid>)" }
```

## EDI Partner Configuration

EDI partners store trading partner settings: SFTP credentials, polling schedules, and field mapping.

### Create a Partner (UI)

1. Go to **EDI Partners** in the sidebar
2. Click **Add Partner**
3. Fill in:
   - **Name** and **Customer** (links orders to this customer)
   - **SFTP Config**: host, port, username, password or private key, remote directory, file pattern
   - **Polling**: enable/disable, interval in seconds, or cron expression
   - **EDI Settings**: sender/receiver IDs, EDI version
   - **Processing**: auto-create orders, auto-assign to shipments

### Create a Partner (API)

```bash
curl -X POST http://localhost:3001/api/v1/edi-partners \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp EDI",
    "customerId": "<customer-uuid>",
    "sftpHost": "sftp.acme.com",
    "sftpPort": 22,
    "sftpUsername": "tms_user",
    "sftpPassword": "secret",
    "sftpRemoteDir": "/outbound/edi",
    "sftpFilePattern": "*.edi,*.x12,*.850",
    "pollingEnabled": true,
    "pollingInterval": 900,
    "autoCreateOrders": true,
    "autoAssignShipments": false
  }'
```

**Note:** SFTP passwords and private keys are redacted in GET responses for security.

### Partner API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/edi-partners` | List partners (filter: `?active=true`, `?pollingEnabled=true`) |
| POST | `/api/v1/edi-partners` | Create partner |
| GET | `/api/v1/edi-partners/:id` | Get partner details |
| PUT | `/api/v1/edi-partners/:id` | Update partner |
| DELETE | `/api/v1/edi-partners/:id` | Delete partner |

## Automated SFTP Collection

The **edi-collector** service automatically polls partner SFTP servers for new EDI files.

### How It Works

1. The collector fetches active, polling-enabled partner configs from the backend API
2. For each partner, it connects to their SFTP server on the configured schedule
3. It lists files matching the partner's file pattern (e.g., `*.edi,*.x12`)
4. New files (not previously seen) are downloaded and POSTed to the backend import endpoint
5. The backend deduplicates by SHA-256 hash and creates orders
6. Files are NOT deleted from the SFTP server — the collector tracks seen files in memory

### Setup

See the [EDI Collector README](../edi-collector/README.md) for full setup instructions.

**Quick start with Docker Compose:**
```bash
# Set your service API key
export EDI_COLLECTOR_API_KEY=sk_live_your_service_key

# Start all services including the collector
docker compose up --build -d
```

The collector needs a backend API key for authentication. Create one via the API Keys page in the UI (no customer scope needed for service keys).

## EDI File History

### UI

Navigate to **EDI Files** in the sidebar to see:
- **Stats cards**: total files, completed, failed, pending, orders created
- **File table**: filterable by status (pending, processing, completed, failed)
- **Detail view**: click any file to see metadata, errors, and parsed data

### API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/edi-files` | List files (`?status=`, `?partnerId=`, `?source=`, `?limit=`, `?offset=`) |
| GET | `/api/v1/edi-files/:id` | File details (`?includeContent=true` for raw EDI) |
| POST | `/api/v1/edi-files/:id/reprocess` | Reprocess a failed file |
| GET | `/api/v1/edi-files/stats` | Aggregate statistics |

### Reprocessing Failed Files

If a file fails (e.g., due to missing customer data), fix the issue and reprocess:

1. In the **EDI Files** page, find the failed file
2. Review the error message in the detail view
3. Click **Reprocess** to retry

Or via API:
```bash
curl -X POST http://localhost:3001/api/v1/edi-files/<file-id>/reprocess
```

## Field Mapping

Each EDI partner can have custom field mapping stored in `fieldMapping` JSON. This controls how X12 segments map to order fields. The default mapping handles standard 850 documents:

| X12 Segment | Default Mapping |
|-------------|-----------------|
| BEG-03 | Order number |
| BEG-05 | Order date |
| N1 (SF) | Ship-from address |
| N1 (ST) | Ship-to address |
| N1 (BY) | Buyer/customer name |
| PO1-07 | SKU |
| PO1-02 | Quantity |
| PO1-04 | Unit price |
| PID-05 | Line item description |
| MEA (WT) | Item weight |
| DTM (002) | Requested delivery date |

Custom field mapping can be configured per partner through the EDI Partners page.

## Troubleshooting

### Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| "Duplicate EDI file" (409) | Same file content already imported | Expected behavior — the file was already processed |
| "No orders parsed" | EDI content has no 850 transactions | Verify the file contains ST*850 transaction sets |
| Customer not found | Customer name in EDI doesn't match any customer | Create the customer first, or set a `customerId` on the partner |
| SFTP connection failed | Wrong credentials or host unreachable | Check partner SFTP settings; verify network connectivity |
| File pattern not matching | Files on SFTP don't match glob pattern | Update `sftpFilePattern` on the partner (e.g., `*.edi,*.x12,*.850,*.txt`) |

### EDI File Statuses

| Status | Meaning |
|--------|---------|
| `pending` | File received, awaiting processing |
| `processing` | Currently being parsed and imported |
| `completed` | Successfully processed, orders created |
| `failed` | Processing failed — check `errorMessage` for details |
