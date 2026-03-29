/**
 * EDI Import Service
 *
 * Orchestrates the EDI import flow:
 * 1. Stores raw EDI file in database
 * 2. Calls EDI850ParseService to parse the file
 * 3. Resolves customers and locations
 * 4. Creates orders via OrdersRepository
 * 5. Tracks results in EdiFile record
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { IOrdersRepository } from '../repositories/OrdersRepository.js';
import { ICustomersRepository } from '../repositories/CustomersRepository.js';
import { ILocationsRepository } from '../repositories/LocationsRepository.js';
import { IEDI850ParseService, ParseResult, EdiFieldMappingConfig } from './EDI850ParseService.js';

export interface EdiImportOptions {
  partnerId?: string;
  customerId?: string; // Override — if not provided, resolved from partner
  fileName?: string;
  source?: string; // manual, sftp, api
  autoAssign?: boolean;
  fieldMapping?: Partial<EdiFieldMappingConfig>;
}

export interface EdiImportResult {
  success: boolean;
  fileId: string;
  transactionType: string;
  transactionCount: number;
  ordersCreated: number;
  orders: Array<{ orderNumber: string; id: string }>;
  errors: string[];
  parseResult?: ParseResult; // Included for preview mode
}

export interface IEdiImportService {
  importEdi(ediContent: string, options?: EdiImportOptions): Promise<EdiImportResult>;
  previewEdi(ediContent: string, options?: EdiImportOptions): Promise<ParseResult>;
}

export class EdiImportService implements IEdiImportService {
  constructor(
    private prisma: PrismaClient,
    private parseService: IEDI850ParseService,
    private ordersRepo: IOrdersRepository,
    private customersRepo: ICustomersRepository,
    private locationsRepo: ILocationsRepository
  ) {}

  /**
   * Preview: parse EDI content without creating orders
   */
  async previewEdi(ediContent: string, options?: EdiImportOptions): Promise<ParseResult> {
    // Load partner field mapping if partnerId provided
    let fieldMapping = options?.fieldMapping;
    if (options?.partnerId && !fieldMapping) {
      const partner = await this.prisma.ediPartner.findUnique({
        where: { id: options.partnerId },
        select: { fieldMapping: true }
      });
      if (partner?.fieldMapping) {
        fieldMapping = partner.fieldMapping as Partial<EdiFieldMappingConfig>;
      }
    }

    return this.parseService.parse(ediContent, fieldMapping);
  }

  /**
   * Full import: parse EDI, create orders, track in EdiFile
   */
  async importEdi(ediContent: string, options: EdiImportOptions = {}): Promise<EdiImportResult> {
    const fileHash = createHash('sha256').update(ediContent).digest('hex');

    // Check for duplicate file
    const existing = await this.prisma.ediFile.findFirst({
      where: { fileHash, status: { in: ['completed', 'processing'] } }
    });
    if (existing) {
      return {
        success: false,
        fileId: existing.id,
        transactionType: existing.transactionType || '',
        transactionCount: existing.transactionCount,
        ordersCreated: 0,
        orders: [],
        errors: ['Duplicate EDI file — this content has already been imported.']
      };
    }

    // Load partner config if provided
    let customerId = options.customerId;
    let fieldMapping = options.fieldMapping;
    if (options.partnerId) {
      const partner = await this.prisma.ediPartner.findUnique({
        where: { id: options.partnerId },
        select: { customerId: true, fieldMapping: true, autoAssignShipments: true }
      });
      if (partner) {
        if (!customerId) customerId = partner.customerId;
        if (!fieldMapping && partner.fieldMapping) {
          fieldMapping = partner.fieldMapping as Partial<EdiFieldMappingConfig>;
        }
      }
    }

    // Create EdiFile record
    const ediFile = await this.prisma.ediFile.create({
      data: {
        partnerId: options.partnerId || null,
        fileName: options.fileName || `edi-${Date.now()}.x12`,
        fileSize: Buffer.byteLength(ediContent, 'utf-8'),
        fileContent: ediContent,
        fileHash,
        source: options.source || 'manual',
        status: 'processing'
      }
    });

    const result: EdiImportResult = {
      success: false,
      fileId: ediFile.id,
      transactionType: '',
      transactionCount: 0,
      ordersCreated: 0,
      orders: [],
      errors: []
    };

    try {
      // Parse EDI content
      const parseResult = this.parseService.parse(ediContent, fieldMapping);
      result.transactionType = parseResult.transactionType;
      result.transactionCount = parseResult.transactionCount;
      result.errors.push(...parseResult.errors);

      if (!parseResult.success || parseResult.orders.length === 0) {
        await this.updateFileStatus(ediFile.id, 'failed', result);
        return result;
      }

      // Update file with parsed data
      await this.prisma.ediFile.update({
        where: { id: ediFile.id },
        data: {
          parsedData: parseResult.orders as any,
          transactionType: parseResult.transactionType,
          transactionCount: parseResult.transactionCount
        }
      });

      // Process each parsed order
      for (const parsedOrder of parseResult.orders) {
        try {
          // Resolve customer
          let orderCustomerId = customerId;
          if (!orderCustomerId && parsedOrder.buyerName) {
            const customers = await this.customersRepo.all();
            const customer = customers.find(c =>
              c.name.toLowerCase() === parsedOrder.buyerName!.toLowerCase()
            );
            if (customer) orderCustomerId = customer.id;
          }

          if (!orderCustomerId) {
            result.errors.push(
              `Order ${parsedOrder.orderNumber}: No customer ID. ` +
              'Link an EDI partner to a customer, or ensure the N1*BY segment matches a customer name.'
            );
            continue;
          }

          // Resolve origin location
          let originId: string | undefined;
          let originData: any;
          if (parsedOrder.origin) {
            const locations = await this.locationsRepo.all();
            const match = locations.find(l =>
              l.name.toLowerCase() === parsedOrder.origin!.name.toLowerCase() &&
              l.city.toLowerCase() === parsedOrder.origin!.city.toLowerCase()
            );
            if (match) {
              originId = match.id;
            } else {
              originData = parsedOrder.origin;
            }
          }

          // Resolve destination location
          let destinationId: string | undefined;
          let destinationData: any;
          if (parsedOrder.destination) {
            const locations = await this.locationsRepo.all();
            const match = locations.find(l =>
              l.name.toLowerCase() === parsedOrder.destination!.name.toLowerCase() &&
              l.city.toLowerCase() === parsedOrder.destination!.city.toLowerCase()
            );
            if (match) {
              destinationId = match.id;
            } else {
              destinationData = parsedOrder.destination;
            }
          }

          // Build trackable units from line items
          // Group all line items into a single default unit (EDI 850 doesn't have package-level info)
          const trackableUnits = parsedOrder.lineItems.length > 0 ? [{
            identifier: `EDI-${parsedOrder.orderNumber}-001`,
            unitType: 'pallet',
            lineItems: parsedOrder.lineItems.map(item => ({
              sku: item.sku,
              description: item.description,
              quantity: item.quantity,
              weight: item.weight,
              weightUnit: item.weightUnit || 'kg'
            }))
          }] : [];

          // Create order
          const order = await this.ordersRepo.create({
            orderNumber: parsedOrder.orderNumber,
            poNumber: parsedOrder.poNumber,
            customerId: orderCustomerId,
            importSource: 'edi',
            ediData: { rawSegments: parsedOrder.rawSegments },
            originId,
            originData: !originId ? originData : undefined,
            destinationId,
            destinationData: !destinationId ? destinationData : undefined,
            orderDate: parsedOrder.orderDate ? new Date(parsedOrder.orderDate) : undefined,
            requestedPickupDate: parsedOrder.requestedPickupDate ? new Date(parsedOrder.requestedPickupDate) : undefined,
            requestedDeliveryDate: parsedOrder.requestedDeliveryDate ? new Date(parsedOrder.requestedDeliveryDate) : undefined,
            trackableUnits
          });

          result.ordersCreated++;
          result.orders.push({
            orderNumber: parsedOrder.orderNumber,
            id: (order as any).id
          });

        } catch (err: any) {
          result.errors.push(`Order ${parsedOrder.orderNumber}: ${err.message}`);
        }
      }

      result.success = result.ordersCreated > 0;
      await this.updateFileStatus(ediFile.id, result.success ? 'completed' : 'failed', result);

    } catch (err: any) {
      result.errors.push(`Import failed: ${err.message}`);
      await this.updateFileStatus(ediFile.id, 'failed', result);
    }

    return result;
  }

  private async updateFileStatus(fileId: string, status: string, result: EdiImportResult): Promise<void> {
    await this.prisma.ediFile.update({
      where: { id: fileId },
      data: {
        status,
        processedAt: new Date(),
        ordersCreated: result.ordersCreated,
        orderIds: result.orders.map(o => o.id),
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null
      }
    });
  }
}
