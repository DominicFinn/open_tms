/**
 * EDI 850 (Purchase Order) Parse Service
 *
 * Uses node-x12 to parse inbound X12 850 documents and extract order data
 * compatible with the TMS CreateOrderDTO structure.
 */
import { X12Parser, X12Interchange, X12Transaction, X12Segment } from 'node-x12';

export interface EdiFieldMappingConfig {
  // Order-level segment mappings (segment-element references)
  orderNumber: string;            // default: BEG-03 (PO number)
  poNumber: string;               // default: BEG-03
  orderDate: string;              // default: BEG-05 (PO date CCYYMMDD)
  requestedDeliveryDate: string;  // default: DTM-02 where DTM-01=002
  requestedPickupDate: string;    // default: DTM-02 where DTM-01=010

  // N1 loop entity codes for ship-from / ship-to
  shipFromEntityCode: string;     // default: SF
  shipToEntityCode: string;       // default: ST

  // Line item PO1 element positions
  lineItemQuantity: string;       // default: PO1-02
  lineItemUom: string;            // default: PO1-03
  lineItemSku: string;            // default: PO1-07

  // Custom overrides (segment-element -> field name)
  customMappings?: Record<string, string>;
}

export const DEFAULT_FIELD_MAPPING: EdiFieldMappingConfig = {
  orderNumber: 'BEG-03',
  poNumber: 'BEG-03',
  orderDate: 'BEG-05',
  requestedDeliveryDate: 'DTM-02:002',
  requestedPickupDate: 'DTM-02:010',
  shipFromEntityCode: 'SF',
  shipToEntityCode: 'ST',
  lineItemQuantity: 'PO1-02',
  lineItemUom: 'PO1-03',
  lineItemSku: 'PO1-07',
};

export interface ParsedEdiAddress {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface ParsedEdiLineItem {
  sku: string;
  description?: string;
  quantity: number;
  uom?: string;
  weight?: number;
  weightUnit?: string;
}

export interface ParsedEdiOrder {
  orderNumber: string;
  poNumber?: string;
  orderDate?: string;
  requestedDeliveryDate?: string;
  requestedPickupDate?: string;
  origin?: ParsedEdiAddress;
  destination?: ParsedEdiAddress;
  buyerName?: string;
  lineItems: ParsedEdiLineItem[];
  rawSegments: string[]; // For preview/debugging
}

export interface ParseResult {
  success: boolean;
  transactionType: string;
  transactionCount: number;
  orders: ParsedEdiOrder[];
  errors: string[];
  rawInterchange?: any; // Parsed structure for preview
}

export interface IEDI850ParseService {
  parse(ediContent: string, fieldMapping?: Partial<EdiFieldMappingConfig>): ParseResult;
}

export class EDI850ParseService implements IEDI850ParseService {
  /**
   * Parse raw X12 EDI content and extract purchase orders
   */
  parse(ediContent: string, fieldMapping?: Partial<EdiFieldMappingConfig>): ParseResult {
    const mapping = { ...DEFAULT_FIELD_MAPPING, ...fieldMapping };
    const result: ParseResult = {
      success: false,
      transactionType: '',
      transactionCount: 0,
      orders: [],
      errors: []
    };

    try {
      const parser = new X12Parser();
      const interchange: X12Interchange = parser.parse(ediContent.trim()) as X12Interchange;

      if (!interchange || !interchange.functionalGroups || interchange.functionalGroups.length === 0) {
        result.errors.push('No functional groups found in EDI document');
        return result;
      }

      for (const group of interchange.functionalGroups) {
        for (const transaction of group.transactions) {
          result.transactionCount++;

          // Get transaction type from ST segment
          const stSegment = transaction.header;
          const txType = stSegment?.valueOf(1) || '';
          if (!result.transactionType) {
            result.transactionType = txType;
          }

          if (txType !== '850') {
            result.errors.push(`Skipping transaction type ${txType} (expected 850)`);
            continue;
          }

          try {
            const order = this.parseTransaction(transaction, mapping);
            result.orders.push(order);
          } catch (err: any) {
            result.errors.push(`Transaction parse error: ${err.message}`);
          }
        }
      }

      result.success = result.orders.length > 0;
    } catch (err: any) {
      result.errors.push(`EDI parse failed: ${err.message}`);
    }

    return result;
  }

  /**
   * Parse a single 850 transaction into a ParsedEdiOrder
   */
  private parseTransaction(transaction: X12Transaction, mapping: EdiFieldMappingConfig): ParsedEdiOrder {
    const segments = transaction.segments;
    const rawSegments = segments.map((s: X12Segment) => s.toString());

    const order: ParsedEdiOrder = {
      orderNumber: '',
      lineItems: [],
      rawSegments
    };

    // Walk segments sequentially
    let currentN1Entity = '';
    let currentAddress: Partial<ParsedEdiAddress> = {};
    let currentLineItem: Partial<ParsedEdiLineItem> | null = null;

    for (const segment of segments) {
      const segId = segment.tag;

      switch (segId) {
        case 'BEG': {
          // BEG*00*NE*PO_NUMBER**DATE
          order.orderNumber = segment.valueOf(3) || '';
          order.poNumber = segment.valueOf(3) || '';
          const dateStr = segment.valueOf(5);
          if (dateStr) {
            order.orderDate = this.parseEdiDate(dateStr);
          }
          break;
        }

        case 'DTM': {
          // DTM*qualifier*date
          const qualifier = segment.valueOf(1) || '';
          const dateStr = segment.valueOf(2) || '';
          if (dateStr) {
            const parsed = this.parseEdiDate(dateStr);
            if (qualifier === '002' || qualifier === '017') {
              // Delivery requested date
              order.requestedDeliveryDate = parsed;
            } else if (qualifier === '010' || qualifier === '037') {
              // Pickup/ship date
              order.requestedPickupDate = parsed;
            }
          }
          break;
        }

        case 'N1': {
          // Flush previous N1 loop
          this.flushAddress(currentN1Entity, currentAddress, order, mapping);

          // N1*entity*name*idQualifier*id
          currentN1Entity = segment.valueOf(1) || '';
          currentAddress = {
            name: segment.valueOf(2) || '',
            country: 'US' // default
          };
          break;
        }

        case 'N3': {
          // N3*address1*address2
          currentAddress.address1 = segment.valueOf(1) || '';
          const addr2 = segment.valueOf(2);
          if (addr2) currentAddress.address2 = addr2;
          break;
        }

        case 'N4': {
          // N4*city*state*postalCode*country
          currentAddress.city = segment.valueOf(1) || '';
          currentAddress.state = segment.valueOf(2) || undefined;
          currentAddress.postalCode = segment.valueOf(3) || undefined;
          const country = segment.valueOf(4);
          if (country) currentAddress.country = country;
          break;
        }

        case 'PO1': {
          // Flush previous line item
          if (currentLineItem && currentLineItem.sku) {
            order.lineItems.push(currentLineItem as ParsedEdiLineItem);
          }
          // Flush N1 loop before PO1 loop starts
          this.flushAddress(currentN1Entity, currentAddress, order, mapping);
          currentN1Entity = '';
          currentAddress = {};

          // PO1*lineNumber*quantity*uom*unitPrice*basisOfPrice*idQualifier*productId
          currentLineItem = {
            quantity: parseInt(segment.valueOf(2) || '0', 10) || 0,
            uom: segment.valueOf(3) || undefined,
            sku: segment.valueOf(7) || segment.valueOf(9) || segment.valueOf(11) || ''
          };
          break;
        }

        case 'PID': {
          // PID*type*****description
          if (currentLineItem) {
            const desc = segment.valueOf(5);
            if (desc) currentLineItem.description = desc;
          }
          break;
        }

        case 'MEA': {
          // MEA*reference*qualifier*value*unit
          if (currentLineItem) {
            const value = parseFloat(segment.valueOf(3) || '0');
            if (value > 0) {
              currentLineItem.weight = value;
              currentLineItem.weightUnit = segment.valueOf(4) === 'LB' ? 'lb' : 'kg';
            }
          }
          break;
        }

        case 'CTT': {
          // End of detail — flush last line item
          if (currentLineItem && currentLineItem.sku) {
            order.lineItems.push(currentLineItem as ParsedEdiLineItem);
            currentLineItem = null;
          }
          break;
        }
      }
    }

    // Flush any remaining state
    this.flushAddress(currentN1Entity, currentAddress, order, mapping);
    if (currentLineItem && currentLineItem.sku) {
      order.lineItems.push(currentLineItem as ParsedEdiLineItem);
    }

    if (!order.orderNumber) {
      throw new Error('No BEG segment found — cannot extract order number');
    }

    return order;
  }

  /**
   * Assign a parsed N1 address to the appropriate order field
   */
  private flushAddress(
    entityCode: string,
    address: Partial<ParsedEdiAddress>,
    order: ParsedEdiOrder,
    mapping: EdiFieldMappingConfig
  ): void {
    if (!entityCode || !address.name) return;

    const fullAddress: ParsedEdiAddress = {
      name: address.name || '',
      address1: address.address1 || '',
      address2: address.address2,
      city: address.city || '',
      state: address.state,
      postalCode: address.postalCode,
      country: address.country || 'US'
    };

    if (entityCode === mapping.shipFromEntityCode) {
      order.origin = fullAddress;
    } else if (entityCode === mapping.shipToEntityCode) {
      order.destination = fullAddress;
    } else if (entityCode === 'BY') {
      order.buyerName = address.name;
    }
  }

  /**
   * Parse EDI date format (CCYYMMDD or YYMMDD) to ISO string
   */
  private parseEdiDate(dateStr: string): string {
    try {
      if (dateStr.length === 8) {
        // CCYYMMDD
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        return new Date(year, month, day).toISOString();
      } else if (dateStr.length === 6) {
        // YYMMDD
        const year = 2000 + parseInt(dateStr.substring(0, 2));
        const month = parseInt(dateStr.substring(2, 4)) - 1;
        const day = parseInt(dateStr.substring(4, 6));
        return new Date(year, month, day).toISOString();
      }
      return new Date().toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
}
