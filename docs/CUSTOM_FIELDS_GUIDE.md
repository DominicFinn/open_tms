# Custom Fields & Units of Measure Guide

This guide covers the custom fields system (versioned, configurable fields on any entity) and the units of measure configuration.

## Table of Contents

- [Custom Fields](#custom-fields)
  - [Overview](#overview)
  - [Versioning Model](#versioning-model)
  - [Field Types](#field-types)
  - [API Reference](#api-reference)
  - [Using Custom Fields on Entities](#using-custom-fields-on-entities)
  - [Frontend](#frontend)
- [Units of Measure](#units-of-measure)
  - [System Defaults](#system-defaults)
  - [User Overrides](#user-overrides)
  - [Conversion](#conversion)

---

## Custom Fields

### Overview

Custom fields allow you to add configurable data fields to any entity: **shipments**, **orders**, **carriers**, **customers**, and **locations**. Fields are defined per entity type and are **versioned** — changing field definitions creates a new version without breaking existing records.

### Versioning Model

```
CustomFieldVersion (v1, entityType=shipment)
  └── CustomFieldDefinition[] (invoice_number, customs_ref, ...)

CustomFieldVersion (v2, entityType=shipment)  ← active
  └── CustomFieldDefinition[] (invoice_number, customs_ref, broker_name, ...)
```

**Key design:**
- Each entity type has one **active** version at a time
- When you modify field definitions, a **new version** is created and the old one is deactivated
- Entity records (shipments, orders, etc.) store:
  - `customFieldVersionId` — which version of field definitions they were saved with
  - `customFieldValues` — JSON object of `{ fieldKey: value }`
- Old records remain valid because they reference their original version
- When viewing an old record, the UI fetches the field definitions from *that record's version*, not the current active version
- All changes are recorded in `CustomFieldAudit` for compliance

### Field Types

| Type | Description | Config Options |
|------|-------------|---------------|
| `text` | Plain text | `minLength`, `maxLength`, `formatMask`, `pattern` (regex) |
| `decimal` | Decimal number | `minValue`, `maxValue`, `decimalPlaces` |
| `integer` | Whole number | `minValue`, `maxValue` |
| `date` | Date value | `minDate`, `maxDate` |
| `boolean` | Yes/No toggle | - |
| `list` | Single-select dropdown | `options` (string array) |
| `multi_list` | Multi-select checkboxes | `options` (string array) |

### API Reference

Base URL: `http://localhost:3001`

Interactive docs: `http://localhost:3001/docs` (Swagger UI — Custom Fields tag)

#### Get Active Version

```
GET /api/v1/custom-fields/:entityType
```

Returns the current active version with all field definitions. Use this to render custom fields on create/edit forms.

```json
{
  "data": {
    "id": "version-uuid",
    "entityType": "shipment",
    "version": 2,
    "active": true,
    "fields": [
      {
        "fieldKey": "invoice_number",
        "label": "Invoice Number",
        "fieldType": "text",
        "required": true,
        "config": { "maxLength": 50 },
        "displayOrder": 0
      },
      {
        "fieldKey": "priority",
        "label": "Priority Level",
        "fieldType": "list",
        "required": false,
        "config": { "options": ["Low", "Medium", "High", "Critical"] },
        "displayOrder": 1
      }
    ]
  }
}
```

#### Get Specific Version

```
GET /api/v1/custom-fields/versions/:id
```

Fetch a specific version by ID. Use this when viewing an old record that references a previous version.

#### List Version History

```
GET /api/v1/custom-fields/:entityType/versions
```

Returns all versions for an entity type, newest first.

#### Create New Version

```
POST /api/v1/custom-fields/versions
```

```json
{
  "entityType": "shipment",
  "description": "Added broker name field",
  "fields": [
    {
      "fieldKey": "invoice_number",
      "label": "Invoice Number",
      "fieldType": "text",
      "required": true,
      "config": { "maxLength": 50 }
    },
    {
      "fieldKey": "broker_name",
      "label": "Customs Broker",
      "fieldType": "text",
      "required": false
    },
    {
      "fieldKey": "declared_value",
      "label": "Declared Value",
      "fieldType": "decimal",
      "required": false,
      "config": { "minValue": 0, "decimalPlaces": 2 }
    }
  ]
}
```

**Important:** This creates a new version and deactivates the previous one. Include ALL fields you want in the new version, not just the changed ones.

Field keys must be:
- Lowercase alphanumeric with underscores only
- Start with a letter
- Unique within a version

#### Validate Values

```
POST /api/v1/custom-fields/validate
```

```json
{
  "versionId": "version-uuid",
  "values": {
    "invoice_number": "INV-2026-001",
    "declared_value": 1500.50
  }
}
```

Returns `{ valid: true/false, errors: [...] }`.

#### Get Audit Trail

```
GET /api/v1/custom-fields/audit?entityType=shipment
```

Returns the last 100 audit records showing what changed, when, and by whom.

### Using Custom Fields on Entities

When creating or updating an entity, include the custom field version ID and values:

```json
{
  "reference": "SHIP-001",
  "customerId": "...",
  "customFieldVersionId": "version-uuid",
  "customFieldValues": {
    "invoice_number": "INV-2026-001",
    "priority": "High",
    "declared_value": 1500.50
  }
}
```

When reading an entity, use its `customFieldVersionId` to fetch the field definitions:

```
GET /api/v1/custom-fields/versions/{entity.customFieldVersionId}
```

This ensures you render the fields as they were when the record was created, even if the current version has different fields.

### Frontend

| Page | URL | Description |
|------|-----|-------------|
| **Custom Fields** | `/settings/custom-fields` | Define and manage custom fields per entity type, view version history |

The **CustomFieldRenderer** component (`frontend/src/components/CustomFieldRenderer.tsx`) provides:
- Automatic field rendering based on version definitions
- Edit mode: form inputs with validation (required, min/max, pattern)
- Read-only mode: formatted display values
- Type-specific controls: dropdowns for lists, checkboxes for multi-lists, date pickers, etc.

Usage in a page:

```tsx
import CustomFieldRenderer from '../components/CustomFieldRenderer';

// In an edit form:
<CustomFieldRenderer
  entityType="shipment"
  versionId={shipment.customFieldVersionId}
  values={customFieldValues}
  onChange={(values, versionId) => {
    setCustomFieldValues(values);
    setCustomFieldVersionId(versionId);
  }}
  editable={true}
/>

// In a detail view (read-only):
<CustomFieldRenderer
  entityType="shipment"
  versionId={shipment.customFieldVersionId}
  values={shipment.customFieldValues || {}}
/>
```

---

## Units of Measure

### System Defaults

Organization-level defaults are set in **Settings** (`/settings`):

| Unit Type | Options | Default |
|-----------|---------|---------|
| Weight | kg, lb | kg |
| Dimensions | cm, in | cm |
| Temperature | °C, °F | °C |
| Distance | km, mi | km |

These apply to all users in the organization unless overridden.

### User Overrides

Each user can set their own preferred units. When a user preference is `null`, the organization default is used.

User preferences are stored on the `User` model:
- `weightUnit` — `"kg"` or `"lb"` (null = org default)
- `dimUnit` — `"cm"` or `"in"` (null = org default)
- `temperatureUnit` — `"C"` or `"F"` (null = org default)
- `distanceUnit` — `"km"` or `"mi"` (null = org default)

### Conversion

The backend always stores values in **canonical metric units**:
- Weight: kilograms (kg)
- Dimensions: centimeters (cm)
- Temperature: Celsius (°C)
- Distance: kilometers (km)

Conversion utilities are available in `backend/src/services/unitConversion.ts`:

```typescript
import {
  convertWeight, convertDimension,
  convertTemperature, convertDistance,
  resolvePreferences,
} from '../services/unitConversion.js';

// Resolve user + org preferences
const prefs = resolvePreferences(
  { weightUnit: 'kg', dimUnit: 'cm', temperatureUnit: 'C', distanceUnit: 'km' },
  { weightUnit: 'lb' } // user override
);
// prefs = { weightUnit: 'lb', dimUnit: 'cm', temperatureUnit: 'C', distanceUnit: 'km' }

// Convert for display
convertWeight(100, prefs.weightUnit);       // 220.46 (lb)
convertTemperature(0, prefs.temperatureUnit); // 0 (still °C, no override)
convertDistance(100, prefs.distanceUnit);     // 100 (still km, no override)
```

### API

Organization UoM settings are managed via:

```
GET  /api/v1/organization/settings  — includes weightUnit, dimUnit, temperatureUnit, distanceUnit
PUT  /api/v1/organization/settings  — update any/all unit preferences
```
