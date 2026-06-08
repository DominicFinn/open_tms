/**
 * CSVImportService — bulk-import orders from CSV with full Phase 1/2 field
 * coverage and per-line mode-rules validation.
 *
 * Failure semantics: all-or-nothing per order. If any line in an order fails
 * mode-rules validation or the dispatch fails, that order is rejected with
 * line-by-line errors (carrying the source row numbers). Other orders in the
 * same CSV still go through.
 *
 * Importantly: this dispatches CREATE_ORDER through the command bus rather
 * than calling the repository directly, so domain events fire and the
 * OrderProjection / read model stay consistent with the rest of the system.
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ICustomersRepository } from '../repositories/CustomersRepository.js';
import { ILocationsRepository } from '../repositories/LocationsRepository.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_ORDER } from '../commands/orders/CreateOrderCommand.js';
import { IModeRulesService, Mode } from './orderLineItem/ModeRulesService.js';

/**
 * Every column the importer understands. Header matching is case-insensitive
 * and tolerates a small set of common aliases per column (see CSV_ALIASES).
 */
export const CSV_COLUMNS = [
  // Order header
  'orderNumber', 'poNumber', 'customerId', 'customerName', 'importSource',
  'originId', 'originName', 'originAddress1', 'originAddress2',
  'originCity', 'originState', 'originPostalCode', 'originCountry',
  'destinationId', 'destinationName', 'destinationAddress1', 'destinationAddress2',
  'destinationCity', 'destinationState', 'destinationPostalCode', 'destinationCountry',
  'orderDate', 'requestedPickupDate', 'requestedDeliveryDate',
  'serviceLevel', 'temperatureControl', 'requiresHazmat',
  'specialInstructions', 'notes',
  // Order-level packing summary (Phase 1)
  'packagingTypeCode', 'packingUnitCount', 'packingStackable', 'packingNotes',
  // Trackable unit (Phase 2)
  'unitId', 'unitType', 'customTypeName', 'unitPackagingTypeCode', 'unitBarcode',
  'unitWeight', 'unitWeightUnit', 'unitLength', 'unitWidth', 'unitHeight', 'unitDimUnit',
  'unitStackable', 'unitNotes',
  // Line item — commercial
  'sku', 'description', 'quantity', 'unitOfMeasure',
  'weight', 'weightUnit', 'length', 'width', 'height', 'dimUnit',
  'unitPriceCents', 'totalPriceCents', 'priceCurrency',
  // Line item — LTL classification
  'freightClass', 'nmfcCode',
  // Line item — hazmat
  'itemHazmat', 'unNumber', 'hazmatClass', 'packingGroup', 'properShippingName',
  // Line item — customs
  'hsCode', 'countryOfOrigin',
  // Line item — temperature
  'temperature', 'tempMinC', 'tempMaxC',
] as const;

type ColumnName = (typeof CSV_COLUMNS)[number];

/** Aliases recognised for each canonical column (alongside the canonical name itself). */
const CSV_ALIASES: Partial<Record<ColumnName, string[]>> = {
  orderNumber:           ['order number', 'order_number'],
  poNumber:              ['po number', 'po', 'po_number'],
  customerId:            ['customer id', 'customer_id'],
  customerName:          ['customer name', 'customer', 'customer_name'],
  originName:            ['origin name', 'origin', 'origin_name'],
  originAddress1:        ['origin address', 'origin address1', 'origin_address1', 'originaddress'],
  originAddress2:        ['origin address2', 'origin_address2'],
  originCity:            ['origin city', 'origin_city'],
  originState:           ['origin state', 'origin_state'],
  originPostalCode:      ['origin postal code', 'origin_postal_code', 'origin zip', 'origin_zip'],
  originCountry:         ['origin country', 'origin_country'],
  originId:              ['origin id', 'origin_id'],
  destinationName:       ['destination name', 'destination', 'destination_name'],
  destinationAddress1:   ['destination address', 'destination address1', 'destination_address1', 'destinationaddress'],
  destinationAddress2:   ['destination address2', 'destination_address2'],
  destinationCity:       ['destination city', 'destination_city'],
  destinationState:      ['destination state', 'destination_state'],
  destinationPostalCode: ['destination postal code', 'destination_postal_code', 'destination zip', 'destination_zip'],
  destinationCountry:    ['destination country', 'destination_country'],
  destinationId:         ['destination id', 'destination_id'],
  orderDate:             ['order date', 'order_date'],
  requestedPickupDate:   ['pickup date', 'pickup_date', 'requested pickup date', 'requested_pickup_date'],
  requestedDeliveryDate: ['delivery date', 'delivery_date', 'requested delivery date', 'requested_delivery_date'],
  serviceLevel:          ['service level', 'service_level', 'mode'],
  temperatureControl:    ['temperature control', 'temperature_control', 'temp control', 'temp_control'],
  requiresHazmat:        ['requires hazmat', 'requires_hazmat', 'hazmat required'],
  packagingTypeCode:     ['packaging type code', 'packaging_type_code', 'packaging type'],
  packingUnitCount:      ['packing unit count', 'packing_unit_count', 'packing units', 'unit count'],
  packingStackable:      ['packing stackable', 'packing_stackable'],
  packingNotes:          ['packing notes', 'packing_notes'],
  unitId:                ['unit id', 'unit_id', 'unit identifier'],
  unitType:              ['unit type', 'unit_type'],
  customTypeName:        ['custom type name', 'custom_type_name', 'custom type'],
  unitPackagingTypeCode: ['unit packaging type code', 'unit_packaging_type_code', 'unit packaging type'],
  unitBarcode:           ['unit barcode', 'unit_barcode'],
  unitWeight:            ['unit weight', 'unit_weight'],
  unitWeightUnit:        ['unit weight unit', 'unit_weight_unit'],
  unitLength:            ['unit length', 'unit_length'],
  unitWidth:             ['unit width', 'unit_width'],
  unitHeight:            ['unit height', 'unit_height'],
  unitDimUnit:           ['unit dim unit', 'unit_dim_unit'],
  unitStackable:         ['unit stackable', 'unit_stackable'],
  unitNotes:             ['unit notes', 'unit_notes'],
  description:           ['item description', 'item_description'],
  quantity:              ['qty'],
  unitOfMeasure:         ['unit of measure', 'unit_of_measure', 'uom'],
  weightUnit:            ['weight unit', 'weight_unit'],
  dimUnit:               ['dim unit', 'dim_unit', 'dimension unit'],
  unitPriceCents:        ['unit price cents', 'unit_price_cents'],
  totalPriceCents:       ['total price cents', 'total_price_cents'],
  priceCurrency:         ['price currency', 'price_currency', 'currency'],
  freightClass:          ['freight class', 'freight_class', 'class'],
  nmfcCode:              ['nmfc code', 'nmfc_code', 'nmfc'],
  itemHazmat:            ['item hazmat', 'item_hazmat', 'hazmat'],
  unNumber:              ['un number', 'un_number', 'un'],
  hazmatClass:           ['hazmat class', 'hazmat_class'],
  packingGroup:          ['packing group', 'packing_group', 'pg'],
  properShippingName:    ['proper shipping name', 'proper_shipping_name', 'psn'],
  hsCode:                ['hs code', 'hs_code', 'hs'],
  countryOfOrigin:       ['country of origin', 'country_of_origin', 'coo'],
  tempMinC:              ['temp min c', 'temp_min_c', 'temp min', 'temp_min'],
  tempMaxC:              ['temp max c', 'temp_max_c', 'temp max', 'temp_max'],
  specialInstructions:   ['special instructions', 'special_instructions'],
  notes:                 ['note'],
};

/** Raw row, all values as strings. Includes the source line number for error reporting. */
interface CSVRow {
  rowNumber: number; // 1-based, including the header row (data starts at row 2)
  cells: Partial<Record<ColumnName, string>>;
}

interface ImportError {
  row: number;
  orderNumber?: string;
  message: string;
}

export interface ImportResult {
  success: boolean;
  ordersCreated: number;
  errors: ImportError[];
  orders: Array<{ orderNumber: string; id: string }>;
}

export interface ImportOptions {
  orgId: string;
  /** When provided, every order is forced to this customerId (portal). */
  forceCustomerId?: string;
  /** Identifies the source of this import. Defaults to 'csv'. */
  source?: 'csv' | 'customer_portal_csv';
  actorId?: string | null;
}

export interface ICSVImportService {
  importOrders(csvContent: string, options: ImportOptions): Promise<ImportResult>;
  /** Returns a CSV template string (header row only) with all supported columns. */
  buildTemplate(): string;
  /** Visible to tests so we can assert parse behaviour without running the importer. */
  parseCSV(csvContent: string): Array<{ rowNumber: number; cells: Partial<Record<string, string>> }>;
}

export class CSVImportService implements ICSVImportService {
  constructor(
    private prisma: PrismaClient,
    private customersRepo: ICustomersRepository,
    private locationsRepo: ILocationsRepository,
    private commandBus: ICommandBus,
    private modeRules: IModeRulesService,
  ) {}

  buildTemplate(): string {
    return CSV_COLUMNS.join(',') + '\n';
  }

  parseCSV(csvContent: string): CSVRow[] {
    const lines = csvContent.split(/\r?\n/);
    let firstNonEmptyIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim()) { firstNonEmptyIdx = i; break; }
    }
    if (firstNonEmptyIdx === -1) throw new Error('CSV is empty');

    const headerCells = this.parseCSVLine(lines[firstNonEmptyIdx]);
    if (headerCells.length === 0) throw new Error('CSV header row is empty');

    // Build a header→column-name map. Handle canonical names and aliases.
    const headerIndex = new Map<string, ColumnName>();
    const allKeys = new Map<string, ColumnName>();
    for (const col of CSV_COLUMNS) {
      allKeys.set(col.toLowerCase(), col);
      for (const alias of CSV_ALIASES[col] ?? []) {
        allKeys.set(alias.toLowerCase(), col);
      }
    }
    headerCells.forEach((raw, i) => {
      const key = raw.toLowerCase().trim();
      const col = allKeys.get(key);
      if (col) headerIndex.set(String(i), col);
    });

    if (headerIndex.size === 0) {
      throw new Error('No recognised column headers found. Download the template for the expected format.');
    }

    const rows: CSVRow[] = [];
    for (let i = firstNonEmptyIdx + 1; i < lines.length; i++) {
      const raw = lines[i];
      if (!raw.trim()) continue;
      const values = this.parseCSVLine(raw);
      if (values.every(v => !v.trim())) continue;

      const cells: Partial<Record<ColumnName, string>> = {};
      values.forEach((value, idx) => {
        const col = headerIndex.get(String(idx));
        if (!col) return;
        const v = value.trim();
        if (v) cells[col] = v;
      });
      rows.push({ rowNumber: i + 1, cells });
    }

    return rows;
  }

  async importOrders(csvContent: string, options: ImportOptions): Promise<ImportResult> {
    const result: ImportResult = { success: true, ordersCreated: 0, errors: [], orders: [] };

    let rows: CSVRow[];
    try {
      rows = this.parseCSV(csvContent);
    } catch (err: any) {
      result.success = false;
      result.errors.push({ row: 1, message: `CSV parsing failed: ${err.message}` });
      return result;
    }

    // Group rows by orderNumber. Rows missing an orderNumber become per-row errors.
    const orderGroups = new Map<string, CSVRow[]>();
    for (const row of rows) {
      const orderNumber = row.cells.orderNumber;
      if (!orderNumber) {
        result.success = false;
        result.errors.push({ row: row.rowNumber, message: 'Missing orderNumber' });
        continue;
      }
      const group = orderGroups.get(orderNumber) ?? [];
      group.push(row);
      orderGroups.set(orderNumber, group);
    }

    // Pre-fetch reference data once for the whole batch.
    const customers = await this.customersRepo.all(options.orgId);
    const locations = await this.locationsRepo.all(options.orgId);
    const packagingTypes = await this.prisma.packagingType.findMany({
      where: { orgId: options.orgId, active: true },
      select: { id: true, code: true, kind: true },
    });
    const packagingByCode = new Map(packagingTypes.map(p => [p.code.toLowerCase(), p]));

    for (const [orderNumber, orderRows] of orderGroups.entries()) {
      const orderErrors: ImportError[] = [];
      const headerRow = orderRows[0];
      const cells = headerRow.cells;

      // ── Customer resolution (force when portal) ──
      let customerId: string | undefined;
      if (options.forceCustomerId) {
        const declared = cells.customerId;
        if (declared && declared !== options.forceCustomerId) {
          orderErrors.push({ row: headerRow.rowNumber, orderNumber, message: 'customerId does not match the authenticated customer' });
        } else {
          customerId = options.forceCustomerId;
        }
      } else if (cells.customerId) {
        customerId = cells.customerId;
      } else if (cells.customerName) {
        const match = customers.find(c => c.name.toLowerCase() === cells.customerName!.toLowerCase());
        if (!match) {
          orderErrors.push({ row: headerRow.rowNumber, orderNumber, message: `Customer "${cells.customerName}" not found` });
        } else {
          customerId = match.id;
        }
      } else {
        orderErrors.push({ row: headerRow.rowNumber, orderNumber, message: 'customerId or customerName is required' });
      }

      // ── Location resolution (id, then fuzzy name+city, else raw data) ──
      let originId = cells.originId;
      let destinationId = cells.destinationId;
      const originData  = (!originId      && (cells.originName      || cells.originAddress1))      ? this.buildLocationData('origin', cells)      : undefined;
      const destinationData = (!destinationId && (cells.destinationName || cells.destinationAddress1)) ? this.buildLocationData('destination', cells) : undefined;
      if (!originId && originData) {
        const fuzzy = locations.find(l => l.name.toLowerCase() === originData.name.toLowerCase() && (l.city?.toLowerCase() ?? '') === originData.city.toLowerCase());
        if (fuzzy) originId = fuzzy.id;
      }
      if (!destinationId && destinationData) {
        const fuzzy = locations.find(l => l.name.toLowerCase() === destinationData.name.toLowerCase() && (l.city?.toLowerCase() ?? '') === destinationData.city.toLowerCase());
        if (fuzzy) destinationId = fuzzy.id;
      }

      // ── Order-level flags + mode for validation ──
      const serviceLevel = this.normalizeServiceLevel(cells.serviceLevel);
      const temperatureControl = this.normalizeTemperatureControl(cells.temperatureControl);
      const requiresHazmatOrder = this.parseBoolean(cells.requiresHazmat);
      const mode: Mode = serviceLevel === 'FTL' ? 'ftl' : 'ltl';
      const international = !!(cells.originCountry && cells.destinationCountry &&
        cells.originCountry.toUpperCase() !== cells.destinationCountry.toUpperCase());

      // ── Build line items + trackable units from the rows ──
      type LineItem = ReturnType<CSVImportService['buildLineItem']>;
      const unitGroups = new Map<string, { headerRow: CSVRow; lines: { row: CSVRow; line: LineItem }[] }>();
      const flatLines:                              { row: CSVRow; line: LineItem }[] = [];

      for (const row of orderRows) {
        if (!row.cells.sku) continue; // header-only rows are OK; skip them silently
        const itemHazmat = this.parseBoolean(row.cells.itemHazmat) || requiresHazmatOrder;
        const line = this.buildLineItem(row, itemHazmat);

        const validation = this.modeRules.validate(mode, {
          hazmat: itemHazmat,
          international,
          temperatureControlled: temperatureControl !== 'ambient',
        }, line);
        if (!validation.ok) {
          orderErrors.push({
            row: row.rowNumber,
            orderNumber,
            message: `Line ${row.cells.sku} missing required fields for mode=${mode}${itemHazmat ? '+hazmat' : ''}: ${validation.missing.join(', ')}`,
          });
          continue;
        }

        if (row.cells.unitId) {
          const g = unitGroups.get(row.cells.unitId) ?? { headerRow: row, lines: [] };
          g.lines.push({ row, line });
          unitGroups.set(row.cells.unitId, g);
        } else {
          flatLines.push({ row, line });
        }
      }

      if (orderErrors.length > 0) {
        result.success = false;
        result.errors.push(...orderErrors);
        continue;
      }

      // ── Trackable units (with optional packaging + dim/weight overrides) ──
      const trackableUnits = [...unitGroups.entries()].map(([identifier, { headerRow: uHeader }]) => {
        const c = uHeader.cells;
        let packagingTypeId: string | null | undefined;
        if (c.unitPackagingTypeCode) {
          const pt = packagingByCode.get(c.unitPackagingTypeCode.toLowerCase());
          if (!pt) orderErrors.push({ row: uHeader.rowNumber, orderNumber, message: `Unknown unitPackagingTypeCode "${c.unitPackagingTypeCode}"` });
          else packagingTypeId = pt.id;
        }
        return {
          identifier,
          unitType: c.unitType ?? 'pallet',
          customTypeName: c.customTypeName,
          barcode: c.unitBarcode,
          notes: c.unitNotes,
          packagingTypeId: packagingTypeId ?? null,
          weight: this.parseFloat(c.unitWeight),
          weightUnit: c.unitWeightUnit ?? 'kg',
          length: this.parseFloat(c.unitLength),
          width: this.parseFloat(c.unitWidth),
          height: this.parseFloat(c.unitHeight),
          dimUnit: c.unitDimUnit ?? 'cm',
          stackable: c.unitStackable ? this.parseBoolean(c.unitStackable) : true,
          lineItems: (unitGroups.get(identifier)?.lines ?? []).map(({ line }) => line),
        };
      });

      // ── Order-level packing summary (auto-gen if no explicit units) ──
      let packingSummary: { packagingTypeId?: string | null; unitCount: number; stackable?: boolean; notes?: string } | undefined;
      if (cells.packingUnitCount) {
        let summaryPackagingId: string | null | undefined;
        if (cells.packagingTypeCode) {
          const pt = packagingByCode.get(cells.packagingTypeCode.toLowerCase());
          if (!pt) orderErrors.push({ row: headerRow.rowNumber, orderNumber, message: `Unknown packagingTypeCode "${cells.packagingTypeCode}"` });
          else summaryPackagingId = pt.id;
        }
        const count = this.parseInt(cells.packingUnitCount);
        if (count && count > 0) {
          packingSummary = {
            packagingTypeId: summaryPackagingId ?? null,
            unitCount: count,
            stackable: cells.packingStackable ? this.parseBoolean(cells.packingStackable) : true,
            notes: cells.packingNotes,
          };
        }
      }

      if (orderErrors.length > 0 || !customerId) {
        result.success = false;
        result.errors.push(...orderErrors);
        continue;
      }

      // ── Dispatch CREATE_ORDER ──
      const dispatch = await this.commandBus.dispatch({
        type: CREATE_ORDER,
        orgId: options.orgId,
        actorId: options.actorId ?? null,
        payload: {
          orderData: {
            orgId: options.orgId,
            orderNumber,
            poNumber: cells.poNumber,
            customerId,
            importSource: options.source ?? cells.importSource ?? 'csv',
            originId,
            originData: !originId ? originData : undefined,
            destinationId,
            destinationData: !destinationId ? destinationData : undefined,
            orderDate: cells.orderDate ? this.parseDate(cells.orderDate) : undefined,
            requestedPickupDate: cells.requestedPickupDate ? this.parseDate(cells.requestedPickupDate) : undefined,
            requestedDeliveryDate: cells.requestedDeliveryDate ? this.parseDate(cells.requestedDeliveryDate) : undefined,
            specialInstructions: cells.specialInstructions,
            notes: cells.notes,
            trackableUnits: trackableUnits.length ? trackableUnits : undefined,
            lineItems: flatLines.length ? flatLines.map(({ line }) => line) : undefined,
            packingSummary,
          },
          // status is derived inside the command from origin/destination presence
          // for non-route imports; pass 'pending' so the command resolves it.
          status: originId && destinationId ? 'validated' : 'pending',
        },
        metadata: { correlationId: randomUUID(), source: options.source ?? 'csv-import' },
      });

      if (!dispatch.success) {
        result.success = false;
        result.errors.push({ row: headerRow.rowNumber, orderNumber, message: dispatch.error ?? 'Failed to create order' });
        continue;
      }

      const data = dispatch.data as { id: string; orderNumber: string };
      result.ordersCreated++;
      result.orders.push({ orderNumber: data.orderNumber, id: data.id });
    }

    return result;
  }

  // ───────────────────── helpers ─────────────────────

  private buildLineItem(row: CSVRow, hazmat: boolean) {
    const c = row.cells;
    return {
      sku: c.sku!,
      description: c.description,
      quantity: this.parseInt(c.quantity) ?? 1,
      unitOfMeasure: c.unitOfMeasure ?? 'each',
      weight: this.parseFloat(c.weight),
      weightUnit: c.weightUnit ?? 'kg',
      length: this.parseFloat(c.length),
      width: this.parseFloat(c.width),
      height: this.parseFloat(c.height),
      dimUnit: c.dimUnit ?? 'cm',
      unitPriceCents: this.parseInt(c.unitPriceCents),
      totalPriceCents: this.parseInt(c.totalPriceCents),
      priceCurrency: c.priceCurrency,
      freightClass: c.freightClass,
      nmfcCode: c.nmfcCode,
      hazmat,
      unNumber: c.unNumber,
      hazmatClass: c.hazmatClass,
      packingGroup: c.packingGroup,
      properShippingName: c.properShippingName,
      hsCode: c.hsCode,
      countryOfOrigin: c.countryOfOrigin,
      temperature: c.temperature,
      tempMinC: this.parseFloat(c.tempMinC),
      tempMaxC: this.parseFloat(c.tempMaxC),
      stackable: true, // mode-rules wants something here for the validate() call; storage ignores it
    };
  }

  private buildLocationData(prefix: 'origin' | 'destination', cells: Partial<Record<ColumnName, string>>) {
    const name      = cells[`${prefix}Name` as ColumnName] || cells[`${prefix}City` as ColumnName] || 'Unknown';
    const address1  = cells[`${prefix}Address1` as ColumnName] || '';
    const address2  = cells[`${prefix}Address2` as ColumnName];
    const city      = cells[`${prefix}City` as ColumnName] || '';
    const state     = cells[`${prefix}State` as ColumnName];
    const postalCode = cells[`${prefix}PostalCode` as ColumnName];
    const country   = cells[`${prefix}Country` as ColumnName] || 'US';
    return { name, address1, address2, city, state, postalCode, country };
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  private parseBoolean(value?: string): boolean {
    if (!value) return false;
    const lower = value.toLowerCase().trim();
    return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'y';
  }

  private normalizeServiceLevel(value?: string): 'FTL' | 'LTL' {
    if (!value) return 'LTL';
    const upper = value.toUpperCase().trim();
    if (upper === 'FTL' || upper === 'FULL TRUCK LOAD' || upper === 'FTL ') return 'FTL';
    return 'LTL';
  }

  private normalizeTemperatureControl(value?: string): 'ambient' | 'refrigerated' | 'frozen' {
    if (!value) return 'ambient';
    const lower = value.toLowerCase().trim();
    if (lower.includes('refrig') || lower.includes('chilled')) return 'refrigerated';
    if (lower.includes('froz')) return 'frozen';
    return 'ambient';
  }

  private parseDate(value: string): Date {
    const direct = new Date(value);
    if (!isNaN(direct.getTime())) return direct;
    const parts = value.split('/');
    if (parts.length === 3) {
      const [month, day, year] = parts;
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  }

  private parseInt(value?: string): number | undefined {
    if (value == null || value === '') return undefined;
    const n = parseInt(value, 10);
    return isNaN(n) ? undefined : n;
  }

  private parseFloat(value?: string): number | undefined {
    if (value == null || value === '') return undefined;
    const n = parseFloat(value);
    return isNaN(n) ? undefined : n;
  }
}
