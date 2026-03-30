# Document Templates & Reports Guide

This guide covers the Open TMS document generation system: Bills of Lading, shipping labels, customs forms, daily operations reports, and template management.

## Overview

The document system provides:
- **Bill of Lading (BOL)** generation from shipment data with auto-numbering
- **Shipping labels** for trackable units (one label per pallet/box/tote)
- **Customs forms** (commercial invoice) for international shipments
- **Daily operations report** as Excel workbook with 5 sheets
- **Template management** UI for customizing document layouts
- **Document storage** with download and listing

Base URL: `http://localhost:3001` (main backend)

## Table of Contents

- [Quick Start](#quick-start)
- [Document Types](#document-types)
  - [Bill of Lading](#bill-of-lading)
  - [Shipping Labels](#shipping-labels)
  - [Customs Form](#customs-form)
  - [Daily Operations Report](#daily-operations-report)
- [API Reference](#api-reference)
  - [Document Generation](#document-generation)
  - [Generated Documents](#generated-documents)
  - [Document Templates](#document-templates)
  - [Daily Report](#daily-report)
- [Template Customization](#template-customization)
- [Frontend Pages](#frontend-pages)

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

## API Reference

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
