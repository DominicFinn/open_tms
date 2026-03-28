# Customer API Integration Guide

This guide explains how to integrate with the Open TMS Customer API to programmatically create and track orders.

## Overview

The Customer API allows your systems to:
- Create orders with trackable units (pallets, totes, boxes) and line items
- Query order status and details
- Optionally auto-assign orders to shipments via lane matching

Base URL: `https://your-tms-instance.com` (or `http://localhost:3001` for local dev)

## Authentication

All Customer API endpoints require an API key linked to a specific customer account.

### Getting an API Key

1. **Via the UI**: Navigate to Settings > API Keys, click "Create API Key", and select the customer to associate it with.

2. **Via the API** (admin):
```bash
curl -X POST http://localhost:3001/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -d '{ "name": "My Integration Key", "customerId": "<customer-uuid>" }'
```

The response includes a `key` field (e.g., `sk_live_abc123...`). **Save this immediately** — the full key is only shown once.

### Passing the API Key

Include your key in every request using one of these methods:

| Method | Header | Example |
|--------|--------|---------|
| API Key header | `x-api-key` | `x-api-key: sk_live_abc123...` |
| Bearer token | `Authorization` | `Authorization: Bearer sk_live_abc123...` |

### Authentication Errors

| Code | Meaning |
|------|---------|
| `401` | No API key provided |
| `403` | Invalid/inactive key, or key not linked to a customer |

## Rate Limiting

- **100 requests per minute** per IP address
- When exceeded, you receive a `429 Too Many Requests` response
- Wait 60 seconds before retrying

## Endpoints

### Create Order

```
POST /api/v1/customer-api/orders
```

Creates a new order for your customer account.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orderNumber` | string | Yes | Your unique order reference (must be globally unique) |
| `poNumber` | string | No | Purchase order number |
| `originId` | uuid | No* | ID of an existing origin location |
| `destinationId` | uuid | No* | ID of an existing destination location |
| `originData` | object | No* | Raw origin address (see below) |
| `destinationData` | object | No* | Raw destination address (see below) |
| `orderDate` | datetime | No | Order date (defaults to now) |
| `requestedPickupDate` | datetime | No | Requested pickup date |
| `requestedDeliveryDate` | datetime | No | Requested delivery date |
| `serviceLevel` | string | No | `"FTL"` or `"LTL"` (default: `"LTL"`) |
| `temperatureControl` | string | No | `"ambient"`, `"refrigerated"`, or `"frozen"` (default: `"ambient"`) |
| `requiresHazmat` | boolean | No | Whether hazmat handling is needed (default: `false`) |
| `trackableUnits` | array | No | Trackable units containing line items (preferred) |
| `lineItems` | array | No | Legacy line items (use trackableUnits instead) |
| `specialInstructions` | string | No | Free-text instructions |
| `notes` | string | No | Internal notes |
| `autoAssign` | boolean | No | Auto-assign to shipment via lane matching (default: `false`) |

*\*Provide either `originId` or `originData` (same for destination). If you provide location IDs, the order is marked as `validated`. If you provide raw address data, it's stored for manual review.*

#### Location Data Object

When using `originData` / `destinationData`:

```json
{
  "name": "Chicago Warehouse",
  "address1": "123 Industrial Blvd",
  "address2": "Suite 4",
  "city": "Chicago",
  "state": "IL",
  "postalCode": "60601",
  "country": "US"
}
```

Required fields: `name`, `address1`, `city`, `country`

#### Trackable Unit Object

```json
{
  "identifier": "PALLET-001",
  "unitType": "pallet",
  "customTypeName": null,
  "barcode": "1234567890",
  "notes": "Fragile items",
  "lineItems": [
    {
      "sku": "WIDGET-A",
      "description": "Blue Widget",
      "quantity": 100,
      "weight": 25.0,
      "weightUnit": "kg",
      "length": 120,
      "width": 80,
      "height": 15,
      "dimUnit": "cm",
      "hazmat": false,
      "temperature": "ambient"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `identifier` | string | Yes | Your identifier for this unit (e.g., "PALLET-001") |
| `unitType` | string | Yes | `"pallet"`, `"tote"`, `"box"`, `"stillage"`, or `"custom"` |
| `customTypeName` | string | No | Name when unitType is "custom" |
| `barcode` | string | No | Barcode/QR code value |
| `notes` | string | No | Notes about this unit |
| `lineItems` | array | Yes | At least one line item (see below) |

#### Line Item Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sku` | string | Yes | SKU/item code |
| `description` | string | No | Item description |
| `quantity` | integer | Yes | Quantity (must be positive) |
| `weight` | number | No | Weight per unit |
| `weightUnit` | string | No | `"kg"` or `"lb"` (default: org setting) |
| `length` | number | No | Length dimension |
| `width` | number | No | Width dimension |
| `height` | number | No | Height dimension |
| `dimUnit` | string | No | `"cm"` or `"in"` (default: org setting) |
| `hazmat` | boolean | No | Hazmat item (default: `false`) |
| `temperature` | string | No | Temperature requirement |

#### Example Request

```bash
curl -X POST http://localhost:3001/api/v1/customer-api/orders \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk_live_your_key_here" \
  -d '{
    "orderNumber": "ORD-2024-001",
    "poNumber": "PO-5678",
    "originId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "destinationId": "f9e8d7c6-b5a4-3210-fedc-ba0987654321",
    "serviceLevel": "LTL",
    "temperatureControl": "refrigerated",
    "requestedDeliveryDate": "2024-12-20T09:00:00Z",
    "trackableUnits": [
      {
        "identifier": "PLT-001",
        "unitType": "pallet",
        "lineItems": [
          {
            "sku": "PHARMA-100",
            "description": "Temperature-sensitive medication",
            "quantity": 500,
            "weight": 12.5,
            "weightUnit": "kg"
          },
          {
            "sku": "PHARMA-200",
            "description": "Vaccine doses",
            "quantity": 1000,
            "weight": 8.0,
            "weightUnit": "kg"
          }
        ]
      },
      {
        "identifier": "PLT-002",
        "unitType": "pallet",
        "lineItems": [
          {
            "sku": "PHARMA-300",
            "description": "Saline solution",
            "quantity": 200,
            "weight": 45.0,
            "weightUnit": "kg"
          }
        ]
      }
    ],
    "autoAssign": true,
    "specialInstructions": "Do not stack. Keep upright."
  }'
```

#### Response (201 Created)

```json
{
  "data": {
    "id": "uuid-of-created-order",
    "orderNumber": "ORD-2024-001",
    "poNumber": "PO-5678",
    "status": "validated",
    "importSource": "api",
    "customerId": "uuid-from-api-key",
    "originId": "a1b2c3d4-...",
    "destinationId": "f9e8d7c6-...",
    "serviceLevel": "LTL",
    "temperatureControl": "refrigerated",
    "deliveryStatus": "unassigned",
    "trackableUnits": [ ... ],
    "lineItems": [],
    "customer": { "id": "...", "name": "ACME Pharma" },
    "origin": { "id": "...", "name": "Chicago Warehouse", ... },
    "destination": { "id": "...", "name": "NYC Distribution Center", ... },
    "createdAt": "2024-12-15T10:30:00Z",
    "updatedAt": "2024-12-15T10:30:00Z"
  },
  "assignment": {
    "success": true,
    "shipmentId": "uuid-of-shipment",
    "message": "Order assigned to shipment SH-LTL-ABC123"
  },
  "error": null
}
```

#### Error Responses

| Code | Scenario | Example |
|------|----------|---------|
| `400` | Validation error | Missing required field, invalid enum value |
| `409` | Duplicate order number | `"Order number 'ORD-001' already exists."` |

### List Orders

```
GET /api/v1/customer-api/orders
```

Returns all orders belonging to your customer account.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | (all) | Filter by status: `pending`, `validated`, `location_error`, `assigned`, `converted`, `pending_lane`, `cancelled` |
| `limit` | integer | 50 | Max results (1-100) |
| `offset` | integer | 0 | Skip N results for pagination |

#### Example

```bash
# Get first 20 validated orders
curl "http://localhost:3001/api/v1/customer-api/orders?status=validated&limit=20" \
  -H "x-api-key: sk_live_your_key_here"
```

#### Response (200 OK)

```json
{
  "data": [
    {
      "id": "...",
      "orderNumber": "ORD-2024-001",
      "status": "validated",
      "deliveryStatus": "assigned",
      ...
    }
  ],
  "error": null
}
```

### Get Order Detail

```
GET /api/v1/customer-api/orders/:id
```

Returns full details of a specific order, including trackable units, line items, and location data.

```bash
curl "http://localhost:3001/api/v1/customer-api/orders/uuid-here" \
  -H "x-api-key: sk_live_your_key_here"
```

Returns `404` if the order doesn't exist or belongs to a different customer.

### Get Order Status

```
GET /api/v1/customer-api/orders/:id/status
```

Lightweight endpoint for polling order progress. Returns only status fields.

```bash
curl "http://localhost:3001/api/v1/customer-api/orders/uuid-here/status" \
  -H "x-api-key: sk_live_your_key_here"
```

#### Response (200 OK)

```json
{
  "data": {
    "orderId": "uuid",
    "orderNumber": "ORD-2024-001",
    "status": "assigned",
    "deliveryStatus": "in_transit",
    "deliveredAt": null,
    "updatedAt": "2024-12-16T14:00:00Z"
  },
  "error": null
}
```

## Order Lifecycle

### Order Status (`status`)

| Status | Description |
|--------|-------------|
| `pending` | Order created, awaiting location validation |
| `validated` | Both origin and destination locations are confirmed |
| `location_error` | Raw address data provided but location not yet matched |
| `assigned` | Assigned to a shipment via lane matching |
| `converted` | Manually converted to a shipment |
| `pending_lane` | No matching lane found; pending lane request created |
| `cancelled` | Order cancelled |
| `archived` | Soft-deleted |

### Delivery Status (`deliveryStatus`)

| Status | Description |
|--------|-------------|
| `unassigned` | Not yet on a shipment |
| `assigned` | On a shipment, awaiting dispatch |
| `in_transit` | Shipment is in transit |
| `delivered` | Successfully delivered |
| `exception` | Delivery issue (delay, damage, refused, etc.) |
| `cancelled` | Delivery cancelled |

## Auto-Assignment

When you set `autoAssign: true`, the system automatically:

1. **Finds a matching lane** — looks for an active lane with the same origin, destination, service level (FTL/LTL), and capability flags (temperature control, hazmat)
2. **Assigns to a shipment**:
   - **FTL**: Creates a new dedicated shipment
   - **LTL**: Consolidates into an existing draft shipment on the same lane, or creates a new one
3. **No matching lane?** Creates a `PendingLaneRequest` for manual review. The order status becomes `pending_lane`.

The assignment result is returned in the `assignment` field of the create response.

## Swagger / OpenAPI

Full interactive API documentation is available at:

```
http://localhost:3001/docs
```

The Customer API endpoints are tagged as **"Customer API"** in the Swagger UI.
