/**
 * EDI Import Service
 *
 * Orchestrates the EDI import flow:
 * 1. Stores raw EDI file in EdiTransactionLog
 * 2. Calls EDI850ParseService to parse the file
 * 3. Resolves customers and locations
 * 4. Creates orders via OrdersRepository
 * 5. Tracks results in EdiTransactionLog (unified logging)
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { IOrdersRepository } from '../repositories/OrdersRepository.js';
import { ICustomersRepository } from '../repositories/CustomersRepository.js';
import { ILocationsRepository } from '../repositories/LocationsRepository.js';
import { IEDI850ParseService, ParseResult, EdiFieldMappingConfig } from './EDI850ParseService.js';
import { ILocationResolutionService } from './LocationResolutionService.js';
import { ITradingPartnerRepository } from '../repositories/TradingPartnerRepository.js';

export interface EdiImportOptions {
  /** Multi-tenancy scope. Required post phase-2 tightening. */
  orgId?: string;
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
  logId?: string; // EdiTransactionLog ID
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
    private locationsRepo: ILocationsRepository,
    private locationResolutionService?: ILocationResolutionService,
    private tradingPartnerRepo?: ITradingPartnerRepository
  ) {}

  /**
   * Preview: parse EDI content without creating orders
   */
  async previewEdi(ediContent: string, options?: EdiImportOptions): Promise<ParseResult> {
    // Load partner field mapping if partnerId provided
    let fieldMapping = options?.fieldMapping;
    if (options?.partnerId && !fieldMapping) {
      const tp = this.tradingPartnerRepo
        ? await this.tradingPartnerRepo.findById(options.partnerId)
        : null;
      if (tp) {
        const txn = tp.transactions?.find(
          (t: any) => t.transactionType === '850' && t.direction === 'inbound'
        );
        if (txn?.fieldMapping) {
          fieldMapping = txn.fieldMapping as Partial<EdiFieldMappingConfig>;
        }
      }
    }

    return this.parseService.parse(ediContent, fieldMapping);
  }

  /**
   * Full import: parse EDI, create orders, track in EdiTransactionLog
   */
  async importEdi(ediContent: string, options: EdiImportOptions = {}): Promise<EdiImportResult> {
    const fileHash = createHash('sha256').update(ediContent).digest('hex');

    // Check for duplicate in EdiTransactionLog
    const existingLog = await this.prisma.ediTransactionLog.findFirst({
      where: { fileHash, status: { in: ['success', 'processing'] }, transactionType: '850' }
    });
    if (existingLog) {
      return {
        success: false,
        fileId: existingLog.id,
        logId: existingLog.id,
        transactionType: '850',
        transactionCount: existingLog.transactionCount || 0,
        ordersCreated: 0,
        orders: [],
        errors: ['Duplicate EDI file - this content has already been imported.']
      };
    }

    // Load partner config from TradingPartner
    let customerId = options.customerId;
    let fieldMapping = options.fieldMapping;
    let tradingPartnerId: string | null = null;

    if (options.partnerId) {
      const tp = this.tradingPartnerRepo
        ? await this.tradingPartnerRepo.findById(options.partnerId)
        : null;
      if (tp) {
        tradingPartnerId = tp.id;
        if (!customerId) customerId = tp.customerId || undefined;
        const txn = tp.transactions?.find(
          (t: any) => t.transactionType === '850' && t.direction === 'inbound'
        );
        if (!fieldMapping && txn?.fieldMapping) {
          fieldMapping = txn.fieldMapping as Partial<EdiFieldMappingConfig>;
        }
      }
    }

    // Create EdiTransactionLog entry
    const logEntry = this.tradingPartnerRepo
      ? await this.tradingPartnerRepo.createLog({
          partnerId: tradingPartnerId,
          transactionType: '850',
          direction: 'inbound',
          fileName: options.fileName || `edi-${Date.now()}.x12`,
          fileSize: Buffer.byteLength(ediContent, 'utf-8'),
          fileContent: ediContent,
          fileHash,
          transport: 'api',
          status: 'processing',
          source: options.source || 'manual',
        })
      : null;

    const fileId = logEntry?.id || `edi-${Date.now()}`;

    const result: EdiImportResult = {
      success: false,
      fileId,
      logId: logEntry?.id,
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
        await this.updateStatus(logEntry?.id, 'failed', result, parseResult);
        return result;
      }

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
            if (this.locationResolutionService) {
              const locResult = await this.locationResolutionService.resolveOrCreate({
                name: parsedOrder.origin.name,
                address1: parsedOrder.origin.address1 || parsedOrder.origin.name,
                city: parsedOrder.origin.city,
                state: parsedOrder.origin.state,
                postalCode: parsedOrder.origin.postalCode,
                country: parsedOrder.origin.country || 'US',
              });
              originId = locResult.location.id;
            } else {
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
          }

          // Resolve destination location
          let destinationId: string | undefined;
          let destinationData: any;
          if (parsedOrder.destination) {
            if (this.locationResolutionService) {
              const locResult = await this.locationResolutionService.resolveOrCreate({
                name: parsedOrder.destination.name,
                address1: parsedOrder.destination.address1 || parsedOrder.destination.name,
                city: parsedOrder.destination.city,
                state: parsedOrder.destination.state,
                postalCode: parsedOrder.destination.postalCode,
                country: parsedOrder.destination.country || 'US',
              });
              destinationId = locResult.location.id;
            } else {
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
          }

          // Build trackable units from line items
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

          // Create order. orgId comes from options (passed by the route
          // from the JWT) or — for backward compat — falls back to the
          // customer's orgId. Customer.orgId is NOT NULL post phase 2.
          let resolvedOrgId = options.orgId;
          if (!resolvedOrgId) {
            const cust = await this.customersRepo.findById(orderCustomerId);
            resolvedOrgId = cust?.orgId;
          }
          if (!resolvedOrgId) {
            throw new Error('Cannot import EDI: no orgId in options and customer has no orgId');
          }
          const order = await this.ordersRepo.create({
            orgId: resolvedOrgId,
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
      await this.updateStatus(logEntry?.id, result.success ? 'completed' : 'failed', result, parseResult);

    } catch (err: any) {
      result.errors.push(`Import failed: ${err.message}`);
      await this.updateStatus(logEntry?.id, 'failed', result);
    }

    return result;
  }

  private async updateStatus(
    logId: string | undefined,
    status: string,
    result: EdiImportResult,
    parseResult?: ParseResult,
  ): Promise<void> {
    // Update EdiTransactionLog
    if (logId && this.tradingPartnerRepo) {
      await this.tradingPartnerRepo.updateLog(logId, {
        status: status === 'completed' ? 'success' : status === 'failed' ? 'error' : status,
        processedAt: new Date(),
        transactionCount: result.transactionCount,
        entitiesCreated: result.ordersCreated,
        entityIds: result.orders.map(o => o.id),
        parsedData: parseResult?.orders || null,
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
      });
    }
  }
}
