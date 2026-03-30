# Document Templates, Reports & File Storage Guide

This guide covers the Open TMS document generation system, file storage, and attachments: Bills of Lading, shipping labels, customs forms, daily operations reports, template management, S3-compatible file storage, and file attachments on any entity.

## Overview

The document system provides:
- **Bill of Lading (BOL)** generation from shipment data with auto-numbering
- **Shipping labels** for trackable units (one label per pallet/box/tote)
- **Customs forms** (commercial invoice) for international shipments
- **Daily operations report** as Excel workbook with 5 sheets
- **Template management** UI for customizing document layouts
- **Document storage** with download and listing
- **S3-compatible file storage** (AWS S3, MinIO, Azure Blob S3 compat) with database fallback
- **File attachments** on any entity (shipments, orders, carriers, customers, locations)

Base URL: `http://localhost:3001` (main backend)

Interactive API docs: `http://localhost:3001/docs` (Swagger UI)

## Table of Contents

- [Quick Start](#quick-start)
- [File Storage Setup](#file-storage-setup)
  - [MinIO (Local Development)](#minio-local-development)
  - [AWS S3](#aws-s3)
  - [Azure Blob Storage](#azure-blob-storage)
  - [Database Fallback](#database-fallback)
- [Document Types](#document-types)
  - [Bill of Lading](#bill-of-lading)
  - [Shipping Labels](#shipping-labels)
  - [Customs Form](#customs-form)
  - [Daily Operations Report](#daily-operations-report)
- [File Attachments](#file-attachments)
- [API Reference](#api-reference)
  - [Document Generation](#document-generation)
  - [Generated Documents](#generated-documents)
  - [Document Templates](#document-templates)
  - [Daily Report](#daily-report)
  - [Attachments](#attachments-api)
- [Template Customization](#template-customization)
- [Frontend Pages](#frontend-pages)
- [Architecture](#architecture)

---

## Quick Start

**Generate a Bill of Lading:**

```bash
curl -X POST http://localhost:3001/api/v1/documents/generate/bol \
  -H "Content-Type: application/json" \
  -d '{ "shipmentId": "<shipment-uuid>" }'
```

```json
{ "data": { "id": "<document-uuid>", "fileName": "BOL-20260330-0001.pdf" }, "error": null }
```

**Download the generated PDF:**

```bash
curl http://localhost:3001/api/v1/documents/<document-uuid>/download -o BOL.pdf
```

**Download today's daily report:**

```bash
curl "http://localhost:3001/api/v1/reports/daily?date=2026-03-30&format=xlsx" -o report.xlsx
```

---

## File Storage Setup

Open TMS uses an S3-compatible file storage provider for all binary content (generated PDFs, uploaded attachments). When S3 is not configured, it falls back to storing content in the PostgreSQL database.

### MinIO (Local Development)

MinIO is included in `docker-compose.yml` and is the recommended local development setup.

**1. Start MinIO:**

```bash
docker-compose up -d minio
```

MinIO console is available at `http://localhost:9001` (login: `minioadmin` / `minioadmin`).

**2. Create the bucket:**

Via MinIO console (http://localhost:9001) or the mc CLI:

```bash
# Install mc (MinIO client) if not already installed
# brew install minio/stable/mc  (macOS)
# or download from https://min.io/docs/minio/linux/reference/minio-mc.html

mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/open-tms
```

**3. Set environment variables** (already set in docker-compose for the backend service):

```env
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=open-tms
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
```

### AWS S3

```env
S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=false
```

### Azure Blob Storage

Azure Blob supports an S3 compatibility layer:

```env
S3_ENDPOINT=https://your-account.blob.core.windows.net
S3_BUCKET=your-container
S3_ACCESS_KEY_ID=your-storage-account
S3_SECRET_ACCESS_KEY=your-storage-key
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
```

### Database Fallback

If no `S3_ENDPOINT` and `S3_BUCKET` environment variables are set, the system automatically falls back to storing binary content in the `BinaryStore` PostgreSQL table. This requires no extra infrastructure and works out of the box, but is not recommended for production with large file volumes.

### Storage Key Security

All files are stored with **opaque, UUID-based keys** (e.g., `files/550e8400-e29b-41d4-a716-446655440000`). Storage keys contain:

- **No entity IDs** — you cannot determine which customer, shipment, or order a file belongs to from the key
- **No filenames** — original filenames are stored only in the database and served via `Content-Disposition` headers on download
- **No entity types** — no indication of what the file is attached to

This is a deliberate security design: even if someone gains read access to the S3 bucket, they cannot correlate files to customers, shipments, or any other entity. The mapping from storage key to entity is maintained only in the PostgreSQL database.

### Retention Policy

All files (attachments and generated documents) have a **default retention period of 10 years** from creation. The `retentionExpiresAt` field is set automatically:

- Attachments: set at upload time
- Generated documents: set at generation time
- Existing records: backfilled to `createdAt + 10 years` via migration

Set `retentionExpiresAt` to `null` for indefinite retention. Retention cleanup is not yet automated — this field supports future cleanup jobs or compliance queries.

---

## Document Types

### Bill of Lading

The BOL is the primary shipping document. It is auto-generated from shipment data and includes:

| Section | Fields |
|---------|--------|
| **Header** | BOL number (auto: `BOL-YYYYMMDD-NNNN`), date, shipment reference |
| **Shipper (Origin)** | Location name, full address |
| **Consignee (Destination)** | Location name, full address |
| **Carrier** | Name, MC#, DOT#, contact name, phone, email |
| **Vehicle & Driver** | Vehicle plate, type; driver name, phone (from Load assignments) |
| **Customer** | Name, contact email |
| **Shipment** | Pickup date, delivery date, status |
| **Stops** | Sequence, type (pickup/delivery), location, estimated arrival, instructions |
| **Orders** | Order number, PO#, service level, temperature, hazmat flag |
| **Trackable Units** | Identifier, unit type, barcode |
| **Line Items** | SKU, description, quantity, weight, dimensions, hazmat |
| **Totals** | Order count, unit count, item count, total weight |
| **Signatures** | Empty signature blocks for shipper, carrier, consignee |

BOL numbers are auto-incremented per organization and never reused.

### Shipping Labels

One label per trackable unit, designed for 4x6 inch printing. Includes:

| Field | Source |
|-------|--------|
| **From** | Order origin location |
| **To** | Order destination location (highlighted) |
| **Order** | Order number, PO number |
| **Shipment** | Reference number |
| **Carrier** | Name |
| **Unit** | Identifier, type, barcode, sequence number (e.g., "2 of 5") |
| **Handling** | Temperature control, hazmat warning, special instructions |

### Customs Form

A commercial invoice / customs declaration for international shipments. Includes system data plus blank fill-in fields for data not yet in the schema:

| Section | Fields |
|---------|--------|
| **Header** | Invoice number, date, shipment reference |
| **Exporter** | Customer name, origin location with full address |
| **Importer** | Destination location with full address |
| **Carrier** | Name, MC# |
| **Goods** | SKU, description, qty, weight, dimensions |
| **Blank columns** | Country of origin, HS code, declared value (for manual completion) |
| **Blank fields** | Incoterms, export license, reason for export, currency |
| **Declaration** | Standard customs declaration text with signature line |

### Daily Operations Report

An Excel workbook for ops managers to print at the start of each day. Contains 5 sheets:

**Sheet 1: Summary**
- Report date and generation timestamp
- Shipment counts by status (draft, in_transit, delivered, etc.)
- Order counts by delivery status
- Exception count

**Sheet 2: Shipments**
- All shipments where pickup or delivery date is the report date, or status is `in_transit`
- Columns: reference, status, customer, origin, destination, pickup/delivery dates, carrier, vehicle plate/type, driver name/phone, # orders, # stops

**Sheet 3: Orders**
- All orders linked to the day's shipments or with requested dates on the report date
- Columns: order#, PO#, status, delivery status, customer, origin, destination, service level, temp control, hazmat, requested pickup/delivery, shipment ref, exception type, special instructions

**Sheet 4: Stop Schedule**
- All stops with estimated arrival on the report date
- Columns: shipment ref, stop #, type, location, city/state, est. arrival, est. departure, status, instructions

**Sheet 5: Exceptions**
- Orders with delivery status = `exception`
- Columns: order#, shipment ref, exception type, exception notes, customer

---

## File Attachments

File attachments can be added to any entity in the system: shipments, orders, carriers, customers, and locations. Files are stored via the configured storage provider (S3 or database).

**Supported use cases:**
- Attach packing lists, rate confirmations, or POD photos to shipments
- Attach purchase orders or customs paperwork to orders
- Attach insurance certificates or contracts to carriers
- Attach agreements or compliance docs to customers
- Attach photos or permits to locations

**Upload limits:**
- Maximum file size: 50 MB
- Any file type accepted (stored with original MIME type)

**Frontend:** The `AttachmentPanel` component is available on Shipment Details and Order Details pages. It supports drag-and-drop upload, download, and delete.

---

## API Reference

All endpoints return the standard `{ data, error }` envelope. Full interactive API docs are available at `/docs` (Swagger UI).

### Document Generation

#### Generate Bill of Lading

```
POST /api/v1/documents/generate/bol
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `shipmentId` | string (UUID) | Yes | Shipment to generate BOL for |
| `templateId` | string (UUID) | No | Custom template (uses default if omitted) |

**Response:** `201` with `{ id, fileName }`. The document is stored and can be downloaded via `/documents/:id/download`.

#### Generate Shipping Labels

```
POST /api/v1/documents/generate/labels
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orderId` | string (UUID) | Yes | Order with trackable units |
| `templateId` | string (UUID) | No | Custom template |

#### Generate Customs Form

```
POST /api/v1/documents/generate/customs
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `shipmentId` | string (UUID) | Yes | Shipment for customs form |
| `templateId` | string (UUID) | No | Custom template |

### Generated Documents

#### List Documents

```
GET /api/v1/documents?shipmentId=X&orderId=Y&documentType=bol
```

All query parameters are optional filters.

#### Get Document Metadata

```
GET /api/v1/documents/:id
```

Returns metadata without the binary file content.

#### Download Document

```
GET /api/v1/documents/:id/download
```

Returns the file with appropriate `Content-Type` and `Content-Disposition` headers.

#### Delete Document

```
DELETE /api/v1/documents/:id
```

### Document Templates

#### List All Templates

```
GET /api/v1/document-templates
```

#### Get Template

```
GET /api/v1/document-templates/:id
```

#### Create Template

```
POST /api/v1/document-templates
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Template name (e.g., "International BOL") |
| `documentType` | string | Yes | `bol`, `label`, `customs`, or `daily_report` |
| `description` | string | No | Description |
| `htmlTemplate` | string | Yes | HTML with Handlebars placeholders |
| `config` | object | No | Type-specific configuration JSON |
| `isDefault` | boolean | No | Set as default for this type |

#### Update Template

```
PUT /api/v1/document-templates/:id
```

#### Delete Template

```
DELETE /api/v1/document-templates/:id
```

### Attachments API

#### List Attachments

```
GET /api/v1/attachments?entityType=shipment&entityId=<uuid>
```

Both `entityType` and `entityId` are required. Valid entity types: `shipment`, `order`, `carrier`, `customer`, `location`.

**Response:**

```json
{
  "data": [
    {
      "id": "...",
      "entityType": "shipment",
      "entityId": "...",
      "fileName": "packing-list.pdf",
      "mimeType": "application/pdf",
      "fileSize": 45230,
      "storageBackend": "s3",
      "description": null,
      "createdAt": "2026-03-30T10:00:00.000Z"
    }
  ],
  "error": null
}
```

#### Upload Attachment

```
POST /api/v1/attachments
Content-Type: multipart/form-data
```

Form fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | The file to upload (max 50 MB) |
| `entityType` | string | Yes | `shipment`, `order`, `carrier`, `customer`, or `location` |
| `entityId` | string (UUID) | Yes | ID of the entity to attach to |
| `description` | string | No | Optional description |

**curl example:**

```bash
curl -X POST http://localhost:3001/api/v1/attachments \
  -F "file=@packing-list.pdf" \
  -F "entityType=shipment" \
  -F "entityId=<shipment-uuid>"
```

**Response:** `201` with the created attachment record.

#### Download Attachment

```
GET /api/v1/attachments/:id/download
```

Returns the binary file with appropriate `Content-Type` and `Content-Disposition` headers.

#### Delete Attachment

```
DELETE /api/v1/attachments/:id
```

Removes both the database record and the stored file from S3/storage.

### Daily Report

#### Get Report Summary

```
GET /api/v1/reports/daily/summary?date=2026-03-30
```

Returns JSON with shipment/order counts by status, exception count.

#### Download Report

```
GET /api/v1/reports/daily?date=2026-03-30&format=xlsx
```

Returns an Excel file. The `date` parameter is required (YYYY-MM-DD format).

---

## Template Customization

Templates use [Handlebars](https://handlebarsjs.com/) syntax for variable substitution. The system provides built-in default templates for BOL, labels, and customs forms.

### Available Variables

**BOL templates:**
- `{{bolNumber}}`, `{{date}}`
- `{{shipment.reference}}`, `{{shipment.status}}`, `{{shipment.pickupDate}}`, `{{shipment.deliveryDate}}`
- `{{shipment.origin.name}}`, `{{shipment.origin.address1}}`, `{{shipment.origin.city}}`, etc.
- `{{shipment.destination.*}}` (same fields as origin)
- `{{customer.name}}`, `{{customer.contactEmail}}`
- `{{carrier.name}}`, `{{carrier.mcNumber}}`, `{{carrier.dotNumber}}`, `{{carrier.contactName}}`, `{{carrier.contactPhone}}`
- `{{vehicle.plate}}`, `{{vehicle.type}}`
- `{{driver.name}}`, `{{driver.phone}}`
- `{{#each stops}}` — `{{this.sequenceNumber}}`, `{{this.stopType}}`, `{{this.location.*}}`, `{{this.estimatedArrival}}`
- `{{#each orders}}` — `{{this.orderNumber}}`, `{{this.poNumber}}`, `{{this.serviceLevel}}`, `{{this.temperatureControl}}`, `{{this.requiresHazmat}}`
- `{{#each orders.trackableUnits}}` — `{{this.identifier}}`, `{{this.unitType}}`, `{{this.barcode}}`
- `{{#each orders.lineItems}}` — `{{this.sku}}`, `{{this.description}}`, `{{this.quantity}}`, `{{this.weight}}`
- `{{totals.orderCount}}`, `{{totals.unitCount}}`, `{{totals.itemCount}}`, `{{totals.totalWeight}}`

**Label templates:**
- `{{origin.*}}`, `{{destination.*}}`
- `{{orderNumber}}`, `{{poNumber}}`, `{{shipmentReference}}`, `{{carrierName}}`
- `{{#each units}}` — `{{this.identifier}}`, `{{this.unitType}}`, `{{this.barcode}}`, `{{this.sequenceNumber}}`
- `{{unitTotal}}`, `{{temperatureControl}}`, `{{requiresHazmat}}`, `{{specialInstructions}}`

**Customs templates:**
- `{{date}}`, `{{invoiceNumber}}`, `{{shipment.*}}`, `{{customer.*}}`, `{{carrier.*}}`
- `{{#each lineItems}}` — `{{this.sku}}`, `{{this.description}}`, `{{this.quantity}}`, `{{this.weight}}`
- `{{totals.itemCount}}`, `{{totals.totalWeight}}`

### Creating a Custom Template

1. Navigate to **Settings > Document Templates** in the UI
2. Click **+ New Template**
3. Select the document type and enter your HTML with Handlebars placeholders
4. Check **Set as default** to use this template instead of the built-in one
5. Save

The built-in templates are used as fallback when no custom default template exists for a document type.

---

## Frontend Pages

| Page | URL | Description |
|------|-----|-------------|
| **Documents** | `/documents` | List, download, and delete generated documents with type filter |
| **Daily Report** | `/reports/daily` | Date picker, summary stats, Excel download |
| **Document Templates** | `/settings/document-templates` | Create, edit, delete custom templates |
| **Shipment Details** | `/shipments/:id` | "Generate BOL" and "Customs Form" buttons added |
| **Order Details** | `/orders/:id` | "Labels" button added for generating shipping labels |

All pages are accessible from the sidebar navigation.

---

## Architecture

### Storage Provider System

The file storage system uses a **provider pattern** with two layers:

| Interface | Purpose | Implementations |
|-----------|---------|----------------|
| `IFileStorageProvider` | String content (EDI files) | `DatabaseFileStorage` |
| `IBinaryStorageProvider` | Binary content (PDFs, uploads) | `S3FileStorage`, `DatabaseBinaryStorage` |

The `IBinaryStorageProvider` is selected at startup based on environment variables:
- If `S3_ENDPOINT` and `S3_BUCKET` are set → `S3FileStorage`
- Otherwise → `DatabaseBinaryStorage` (stores in `BinaryStore` PostgreSQL table)

### Key Files

```
backend/src/
  storage/
    IBinaryStorageProvider.ts    # Binary storage interface
    S3FileStorage.ts             # S3-compatible implementation (@aws-sdk/client-s3)
    DatabaseBinaryStorage.ts     # PostgreSQL fallback
    IFileStorageProvider.ts      # String storage interface (EDI)
    DatabaseFileStorage.ts       # EDI file storage
  repositories/
    AttachmentRepository.ts      # Attachment CRUD
    GeneratedDocumentRepository.ts # Document metadata + content
  routes/
    attachments.ts               # File upload/download/list/delete endpoints
    documents.ts                 # Template CRUD + document generation + download
    dailyReport.ts               # Daily report summary + Excel download
  services/
    DocumentGenerationService.ts # PDF generation (pdf-lib + Handlebars)
    DailyReportService.ts        # Excel report generation (exceljs)
  di/
    tokens.ts                    # DI tokens (IBinaryStorageProvider, IAttachmentRepository)
    registry.ts                  # Env-based storage provider selection
```

### Data Flow

**Document Generation:**
1. API request (e.g., `POST /documents/generate/bol`) triggers `DocumentGenerationService`
2. Service loads shipment data, renders Handlebars template, generates PDF via `pdf-lib`
3. PDF stored via `IBinaryStorageProvider` (S3 key: `documents/bol/{shipmentId}/{filename}`)
4. Metadata stored in `GeneratedDocument` table with `storageKey` and `storageBackend`

**File Upload:**
1. Multipart upload to `POST /attachments` with `entityType`, `entityId`, and file
2. File stored via `IBinaryStorageProvider` (S3 key: `attachments/{entityType}/{entityId}/{uuid}-{filename}`)
3. Metadata stored in `Attachment` table

**File Download:**
1. Request to `GET /attachments/:id/download` or `GET /documents/:id/download`
2. System looks up the `storageKey` and `storageBackend`
3. Retrieves binary content from S3 or database
4. Returns file with proper `Content-Type` and `Content-Disposition` headers

### E-Signatures (Deferred)

Electronic signature capture has been deliberately deferred. Simple canvas-based signatures are not legally binding. When implemented, this will use an adapter pattern with pluggable providers:

- **DocuSign** — industry standard for legally binding e-signatures
- **Adobe Sign** — alternative provider
- **Wet signature** workflows — print, sign, scan/photo upload

The `ShipmentStop` model already has `signatureUrl`, `photoUrls`, and `proofOfDelivery` fields ready for this integration.
