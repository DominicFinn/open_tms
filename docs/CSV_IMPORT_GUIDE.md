# CSV Order Import Guide

This guide explains how to import orders into Open TMS using CSV files.

## Overview

The CSV import feature allows you to bulk import orders with:
- Multiple orders in a single file
- Trackable units (pallets, totes, cases, etc.)
- Multiple line items per trackable unit
- Location data (origin and destination)
- Special requirements (service level, temperature control, hazmat)

## CSV Format

### Structure

Each row in the CSV represents a **line item** within a **trackable unit** that belongs to an **order**.

- Multiple rows with the same **Order Number** are grouped into a single order
- Multiple rows with the same **Unit ID** within an order are grouped into a single trackable unit
- Each row represents one SKU/item within that unit

### Required Columns

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| Order Number | ✅ | Unique identifier for the order | ORD-001 |
| Customer Name | ✅ | Name of the customer (must exist in system) | ACME Corp |
| Unit ID | ✅ | Identifier for the trackable unit | PALLET-001 |
| SKU | ✅ | Stock keeping unit / item code | SKU-12345 |
| Quantity | ✅ | Number of units of this SKU | 100 |

### Optional Columns

#### Order-Level Columns
- **PO Number**: Purchase order number
- **Order Date**: Date the order was placed (YYYY-MM-DD or MM/DD/YYYY)
- **Pickup Date**: Requested pickup date
- **Delivery Date**: Requested delivery date
- **Service Level**: FTL (Full Truck Load) or LTL (Less Than Truck Load) - default: LTL
- **Temperature Control**: ambient, refrigerated, or frozen - default: ambient
- **Requires Hazmat**: Yes/No - whether the order requires hazmat handling

#### Origin Location Columns
- **Origin Name**: Name of the origin location
- **Origin Address**: Street address
- **Origin City**: City
- **Origin State**: State/province code
- **Origin Postal Code**: ZIP/postal code
- **Origin Country**: Country code (e.g., US)
- **Origin ID**: UUID of existing location (if known)

#### Destination Location Columns
- **Destination Name**: Name of the destination location
- **Destination Address**: Street address
- **Destination City**: City
- **Destination State**: State/province code
- **Destination Postal Code**: ZIP/postal code
- **Destination Country**: Country code (e.g., US)
- **Destination ID**: UUID of existing location (if known)

#### Trackable Unit Columns
- **Unit Type**: Type of unit (PALLET, TOTE, CASE, etc.) - default: PALLET
- **Custom Type Name**: Custom name for the unit type

#### Line Item Columns
- **Description**: Item description
- **Weight**: Weight of the item
- **Weight Unit**: kg or lbs - default: kg
- **Length**: Length dimension
- **Width**: Width dimension
- **Height**: Height dimension
- **Dim Unit**: cm or in - default: cm
- **Item Hazmat**: Yes/No - whether this specific item is hazmat
- **Temperature**: Temperature requirements (e.g., "chilled", "frozen")

## Example CSV

See `order_import_template.csv` for a complete example with 3 orders containing multiple trackable units and line items.

### Example: Simple Order with One Pallet

```csv
Order Number,Customer Name,Unit ID,Unit Type,SKU,Description,Quantity
ORD-123,ACME Corp,PALLET-001,PALLET,SKU-001,Widget A,100
ORD-123,ACME Corp,PALLET-001,PALLET,SKU-002,Widget B,50
```

This creates:
- 1 order (ORD-123) for customer ACME Corp
- 1 trackable unit (PALLET-001) of type PALLET
- 2 line items (SKU-001 and SKU-002) in that pallet

### Example: Order with Multiple Pallets

```csv
Order Number,Customer Name,Unit ID,Unit Type,SKU,Quantity,Weight,Weight Unit
ORD-456,GlobalTech,PALLET-001,PALLET,SKU-100,200,500,kg
ORD-456,GlobalTech,PALLET-001,PALLET,SKU-101,150,300,kg
ORD-456,GlobalTech,PALLET-002,PALLET,SKU-200,100,250,kg
```

This creates:
- 1 order (ORD-456) for GlobalTech
- 2 trackable units (PALLET-001 and PALLET-002)
- 3 line items total across the 2 pallets

## Location Matching

The import system handles locations intelligently:

1. **If Origin ID or Destination ID is provided**: Uses that exact location
2. **If location name and city match an existing location**: Uses that location
3. **Otherwise**: Stores the location data with the order as "unvalidated" for manual review

## Customer Matching

Customers must exist in the system before importing orders. The system matches by:
1. Customer ID (if provided)
2. Customer Name (case-insensitive)

If a customer is not found, the import will fail for that order.

## Import Process

1. Navigate to **Orders** > **Import CSV**
2. Download the template (optional, for reference)
3. Upload your CSV file by:
   - Clicking "Choose File" button
   - Dragging and dropping the file
4. Preview the CSV content
5. Click "Import Orders"
6. Review the results:
   - Successfully imported orders
   - Any errors encountered

## Validation

The importer validates:
- Required fields are present
- Customers exist in the system
- Numeric values are valid (quantity, weight, dimensions)
- Dates are parseable
- Service level is FTL or LTL
- Temperature control is ambient, refrigerated, or frozen

Errors will be reported with the specific issue for each order.

## Tips

- **Test with small files first**: Start with 1-2 orders to verify the format
- **Use the template**: Download and modify the provided template
- **Check customer names**: Ensure they match exactly with existing customers
- **Location data**: Provide as much location information as possible for better matching
- **Unit IDs**: Must be unique within each order, but can repeat across different orders
- **Quotes**: Use quotes around fields containing commas or special characters

## Common Issues

**"Customer not found"**
- Solution: Create the customer first, or ensure the name matches exactly

**"No trackable units created"**
- Solution: Ensure Unit ID column is populated for all rows

**"Invalid quantity"**
- Solution: Quantity must be a positive integer

**"Invalid date format"**
- Solution: Use YYYY-MM-DD or MM/DD/YYYY format

## Support

For issues or questions about CSV import, please check the application logs or contact support.
