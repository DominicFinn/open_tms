import { PrismaClient } from '@prisma/client';
import { IOrdersRepository } from '../repositories/OrdersRepository.js';
import { ICustomersRepository } from '../repositories/CustomersRepository.js';
import { ILocationsRepository } from '../repositories/LocationsRepository.js';

interface CSVRow {
  // Order level
  orderNumber: string;
  poNumber?: string;
  customerName?: string;
  customerId?: string;

  // Origin
  originName?: string;
  originAddress1?: string;
  originAddress2?: string;
  originCity?: string;
  originState?: string;
  originPostalCode?: string;
  originCountry?: string;
  originId?: string;

  // Destination
  destinationName?: string;
  destinationAddress1?: string;
  destinationAddress2?: string;
  destinationCity?: string;
  destinationState?: string;
  destinationPostalCode?: string;
  destinationCountry?: string;
  destinationId?: string;

  // Dates
  orderDate?: string;
  requestedPickupDate?: string;
  requestedDeliveryDate?: string;

  // Special requirements
  serviceLevel?: string;
  temperatureControl?: string;
  requiresHazmat?: string;

  // Unit level
  unitId?: string;
  unitType?: string;
  customTypeName?: string;

  // Line item level
  sku: string;
  description?: string;
  quantity: string;
  weight?: string;
  weightUnit?: string;
  length?: string;
  width?: string;
  height?: string;
  dimUnit?: string;
  itemHazmat?: string;
  temperature?: string;
}

interface ParsedOrder {
  orderNumber: string;
  poNumber?: string;
  customerId?: string;
  customerName?: string;
  originId?: string;
  originData?: any;
  destinationId?: string;
  destinationData?: any;
  orderDate?: string;
  requestedPickupDate?: string;
  requestedDeliveryDate?: string;
  serviceLevel: string;
  temperatureControl: string;
  requiresHazmat: boolean;
  trackableUnits: Array<{
    identifier: string;
    unitType: string;
    customTypeName?: string;
    lineItems: Array<{
      sku: string;
      description?: string;
      quantity: number;
      weight?: number;
      weightUnit?: string;
      length?: number;
      width?: number;
      height?: number;
      dimUnit?: string;
      hazmat: boolean;
      temperature?: string;
    }>;
  }>;
}

interface ImportResult {
  success: boolean;
  ordersCreated: number;
  errors: Array<{ row: number; message: string }>;
  orders: Array<{ orderNumber: string; id: string }>;
}

export interface ICSVImportService {
  importOrders(csvContent: string): Promise<ImportResult>;
  parseCSV(csvContent: string): ParsedOrder[];
}

export class CSVImportService implements ICSVImportService {
  constructor(
    private prisma: PrismaClient,
    private ordersRepo: IOrdersRepository,
    private customersRepo: ICustomersRepository,
    private locationsRepo: ILocationsRepository
  ) {}

  /**
   * Parse CSV content into structured order data
   */
  parseCSV(csvContent: string): ParsedOrder[] {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV file is empty or has no data rows');
    }

    // Parse header
    const header = this.parseCSVLine(lines[0]);
    const headerMap = new Map<string, number>();
    header.forEach((col, index) => {
      headerMap.set(col.toLowerCase().trim(), index);
    });

    // Parse rows
    const rows: CSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0 || values.every(v => !v.trim())) {
        continue; // Skip empty rows
      }

      const row: CSVRow = {
        orderNumber: this.getCell(values, headerMap, 'order number', 'ordernumber') || '',
        poNumber: this.getCell(values, headerMap, 'po number', 'ponumber', 'po'),
        customerName: this.getCell(values, headerMap, 'customer name', 'customername', 'customer'),
        customerId: this.getCell(values, headerMap, 'customer id', 'customerid'),

        originName: this.getCell(values, headerMap, 'origin name', 'originname', 'origin'),
        originAddress1: this.getCell(values, headerMap, 'origin address', 'origin address1', 'originaddress1', 'originaddress'),
        originAddress2: this.getCell(values, headerMap, 'origin address2', 'originaddress2'),
        originCity: this.getCell(values, headerMap, 'origin city', 'origincity'),
        originState: this.getCell(values, headerMap, 'origin state', 'originstate'),
        originPostalCode: this.getCell(values, headerMap, 'origin postal code', 'origin postalcode', 'originpostalcode', 'origin zip', 'originzip'),
        originCountry: this.getCell(values, headerMap, 'origin country', 'origincountry'),
        originId: this.getCell(values, headerMap, 'origin id', 'originid'),

        destinationName: this.getCell(values, headerMap, 'destination name', 'destinationname', 'destination'),
        destinationAddress1: this.getCell(values, headerMap, 'destination address', 'destination address1', 'destinationaddress1', 'destinationaddress'),
        destinationAddress2: this.getCell(values, headerMap, 'destination address2', 'destinationaddress2'),
        destinationCity: this.getCell(values, headerMap, 'destination city', 'destinationcity'),
        destinationState: this.getCell(values, headerMap, 'destination state', 'destinationstate'),
        destinationPostalCode: this.getCell(values, headerMap, 'destination postal code', 'destination postalcode', 'destinationpostalcode', 'destination zip', 'destinationzip'),
        destinationCountry: this.getCell(values, headerMap, 'destination country', 'destinationcountry'),
        destinationId: this.getCell(values, headerMap, 'destination id', 'destinationid'),

        orderDate: this.getCell(values, headerMap, 'order date', 'orderdate'),
        requestedPickupDate: this.getCell(values, headerMap, 'pickup date', 'pickupdate', 'requested pickup date', 'requestedpickupdate'),
        requestedDeliveryDate: this.getCell(values, headerMap, 'delivery date', 'deliverydate', 'requested delivery date', 'requesteddeliverydate'),

        serviceLevel: this.getCell(values, headerMap, 'service level', 'servicelevel'),
        temperatureControl: this.getCell(values, headerMap, 'temperature control', 'temperaturecontrol', 'temp control'),
        requiresHazmat: this.getCell(values, headerMap, 'requires hazmat', 'requireshazmat', 'hazmat required'),

        unitId: this.getCell(values, headerMap, 'unit id', 'unitid', 'unit identifier'),
        unitType: this.getCell(values, headerMap, 'unit type', 'unittype'),
        customTypeName: this.getCell(values, headerMap, 'custom type name', 'customtypename', 'custom type'),

        sku: this.getCell(values, headerMap, 'sku') || '',
        description: this.getCell(values, headerMap, 'description', 'item description'),
        quantity: this.getCell(values, headerMap, 'quantity', 'qty') || '0',
        weight: this.getCell(values, headerMap, 'weight'),
        weightUnit: this.getCell(values, headerMap, 'weight unit', 'weightunit'),
        length: this.getCell(values, headerMap, 'length'),
        width: this.getCell(values, headerMap, 'width'),
        height: this.getCell(values, headerMap, 'height'),
        dimUnit: this.getCell(values, headerMap, 'dim unit', 'dimunit', 'dimension unit'),
        itemHazmat: this.getCell(values, headerMap, 'item hazmat', 'hazmat', 'itemhazmat'),
        temperature: this.getCell(values, headerMap, 'temperature', 'temp')
      };

      rows.push(row);
    }

    // Group rows by order number
    const orderGroups = new Map<string, CSVRow[]>();
    for (const row of rows) {
      if (!row.orderNumber) {
        continue;
      }
      if (!orderGroups.has(row.orderNumber)) {
        orderGroups.set(row.orderNumber, []);
      }
      orderGroups.get(row.orderNumber)!.push(row);
    }

    // Build parsed orders
    const orders: ParsedOrder[] = [];
    for (const [orderNumber, orderRows] of orderGroups.entries()) {
      const firstRow = orderRows[0];

      // Build origin data
      let originData: any = undefined;
      if (firstRow.originName || firstRow.originAddress1) {
        originData = {
          name: firstRow.originName || 'Unknown',
          address1: firstRow.originAddress1 || '',
          address2: firstRow.originAddress2,
          city: firstRow.originCity || '',
          state: firstRow.originState,
          postalCode: firstRow.originPostalCode,
          country: firstRow.originCountry || 'US'
        };
      }

      // Build destination data
      let destinationData: any = undefined;
      if (firstRow.destinationName || firstRow.destinationAddress1) {
        destinationData = {
          name: firstRow.destinationName || 'Unknown',
          address1: firstRow.destinationAddress1 || '',
          address2: firstRow.destinationAddress2,
          city: firstRow.destinationCity || '',
          state: firstRow.destinationState,
          postalCode: firstRow.destinationPostalCode,
          country: firstRow.destinationCountry || 'US'
        };
      }

      // Group rows by unit ID
      const unitGroups = new Map<string, CSVRow[]>();
      for (const row of orderRows) {
        const unitKey = row.unitId || 'LEGACY';
        if (!unitGroups.has(unitKey)) {
          unitGroups.set(unitKey, []);
        }
        unitGroups.get(unitKey)!.push(row);
      }

      // Build trackable units
      const trackableUnits: ParsedOrder['trackableUnits'] = [];
      for (const [unitKey, unitRows] of unitGroups.entries()) {
        if (unitKey === 'LEGACY' || !unitKey) {
          // Skip legacy items for now - we'll handle them separately if needed
          continue;
        }

        const firstUnitRow = unitRows[0];
        const lineItems = unitRows.map(row => ({
          sku: row.sku,
          description: row.description,
          quantity: parseInt(row.quantity) || 1,
          weight: row.weight ? parseFloat(row.weight) : undefined,
          weightUnit: row.weightUnit || 'kg',
          length: row.length ? parseFloat(row.length) : undefined,
          width: row.width ? parseFloat(row.width) : undefined,
          height: row.height ? parseFloat(row.height) : undefined,
          dimUnit: row.dimUnit || 'cm',
          hazmat: this.parseBoolean(row.itemHazmat),
          temperature: row.temperature
        }));

        trackableUnits.push({
          identifier: unitKey,
          unitType: firstUnitRow.unitType || 'PALLET',
          customTypeName: firstUnitRow.customTypeName,
          lineItems
        });
      }

      orders.push({
        orderNumber,
        poNumber: firstRow.poNumber,
        customerId: firstRow.customerId,
        customerName: firstRow.customerName,
        originId: firstRow.originId,
        originData,
        destinationId: firstRow.destinationId,
        destinationData,
        orderDate: firstRow.orderDate ? this.parseDate(firstRow.orderDate) : new Date().toISOString(),
        requestedPickupDate: firstRow.requestedPickupDate ? this.parseDate(firstRow.requestedPickupDate) : undefined,
        requestedDeliveryDate: firstRow.requestedDeliveryDate ? this.parseDate(firstRow.requestedDeliveryDate) : undefined,
        serviceLevel: this.normalizeServiceLevel(firstRow.serviceLevel),
        temperatureControl: this.normalizeTemperatureControl(firstRow.temperatureControl),
        requiresHazmat: this.parseBoolean(firstRow.requiresHazmat),
        trackableUnits
      });
    }

    return orders;
  }

  /**
   * Import orders from CSV content
   */
  async importOrders(csvContent: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      ordersCreated: 0,
      errors: [],
      orders: []
    };

    try {
      const parsedOrders = this.parseCSV(csvContent);

      for (const parsedOrder of parsedOrders) {
        try {
          // Resolve customer
          let customerId = parsedOrder.customerId;
          if (!customerId && parsedOrder.customerName) {
            const customers = await this.customersRepo.all();
            const customer = customers.find(c =>
              c.name.toLowerCase() === parsedOrder.customerName!.toLowerCase()
            );
            if (customer) {
              customerId = customer.id;
            } else {
              throw new Error(`Customer "${parsedOrder.customerName}" not found. Please create the customer first.`);
            }
          }

          if (!customerId) {
            throw new Error('Customer ID or Customer Name is required');
          }

          // Resolve origin location
          let originId = parsedOrder.originId;
          if (!originId && parsedOrder.originData) {
            const locations = await this.locationsRepo.all();
            const location = locations.find(l =>
              l.name.toLowerCase() === parsedOrder.originData.name.toLowerCase() &&
              l.city.toLowerCase() === parsedOrder.originData.city.toLowerCase()
            );
            if (location) {
              originId = location.id;
            }
          }

          // Resolve destination location
          let destinationId = parsedOrder.destinationId;
          if (!destinationId && parsedOrder.destinationData) {
            const locations = await this.locationsRepo.all();
            const location = locations.find(l =>
              l.name.toLowerCase() === parsedOrder.destinationData.name.toLowerCase() &&
              l.city.toLowerCase() === parsedOrder.destinationData.city.toLowerCase()
            );
            if (location) {
              destinationId = location.id;
            }
          }

          // Create order
          const order = await this.ordersRepo.create({
            orderNumber: parsedOrder.orderNumber,
            poNumber: parsedOrder.poNumber,
            customerId,
            importSource: 'csv',
            originId,
            originData: !originId ? parsedOrder.originData : undefined,
            destinationId,
            destinationData: !destinationId ? parsedOrder.destinationData : undefined,
            orderDate: parsedOrder.orderDate ? new Date(parsedOrder.orderDate) : undefined,
            requestedPickupDate: parsedOrder.requestedPickupDate ? new Date(parsedOrder.requestedPickupDate) : undefined,
            requestedDeliveryDate: parsedOrder.requestedDeliveryDate ? new Date(parsedOrder.requestedDeliveryDate) : undefined,
            trackableUnits: parsedOrder.trackableUnits,
            lineItems: [] // We're using trackable units
          });

          result.ordersCreated++;
          result.orders.push({
            orderNumber: parsedOrder.orderNumber,
            id: (order as any).id
          });

        } catch (error: any) {
          result.success = false;
          result.errors.push({
            row: 0, // TODO: track actual row number
            message: `Order ${parsedOrder.orderNumber}: ${error.message}`
          });
        }
      }

    } catch (error: any) {
      result.success = false;
      result.errors.push({
        row: 0,
        message: `CSV parsing failed: ${error.message}`
      });
    }

    return result;
  }

  /**
   * Helper: Parse a CSV line respecting quoted fields
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // Toggle quotes
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add last field
    result.push(current.trim());

    return result;
  }

  /**
   * Helper: Get cell value with multiple possible header names
   */
  private getCell(values: string[], headerMap: Map<string, number>, ...possibleNames: string[]): string | undefined {
    for (const name of possibleNames) {
      const index = headerMap.get(name.toLowerCase());
      if (index !== undefined && index < values.length) {
        const value = values[index].trim();
        if (value) {
          return value;
        }
      }
    }
    return undefined;
  }

  /**
   * Helper: Parse boolean from string
   */
  private parseBoolean(value?: string): boolean {
    if (!value) return false;
    const lower = value.toLowerCase().trim();
    return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'y';
  }

  /**
   * Helper: Normalize service level
   */
  private normalizeServiceLevel(value?: string): string {
    if (!value) return 'LTL';
    const upper = value.toUpperCase().trim();
    if (upper === 'FTL' || upper === 'FULL TRUCK LOAD') return 'FTL';
    return 'LTL';
  }

  /**
   * Helper: Normalize temperature control
   */
  private normalizeTemperatureControl(value?: string): string {
    if (!value) return 'ambient';
    const lower = value.toLowerCase().trim();
    if (lower.includes('refrig') || lower.includes('chilled')) return 'refrigerated';
    if (lower.includes('froz')) return 'frozen';
    return 'ambient';
  }

  /**
   * Helper: Parse date from various formats
   */
  private parseDate(value: string): string {
    try {
      // Try ISO format first
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }

      // Try MM/DD/YYYY
      const parts = value.split('/');
      if (parts.length === 3) {
        const [month, day, year] = parts;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }

      // Default to now
      return new Date().toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
}
