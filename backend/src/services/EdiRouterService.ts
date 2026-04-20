/**
 * EDI Router Service
 *
 * Detects transaction type from raw EDI content and routes to the appropriate parser.
 * This is the central inbound processing hub — the edi-collector sends files here,
 * and this service figures out what they are and what to do with them.
 */

export interface EdiRouteResult {
  transactionType: string;
  endpoint: string;
  description: string;
}

export interface IEdiRouterService {
  detectTransactionType(content: string): string | null;
  getRouteForTransaction(transactionType: string): EdiRouteResult | null;
  getSupportedTransactionTypes(): EdiRouteResult[];
}

// Map of transaction type → processing endpoint
const TRANSACTION_ROUTES: Record<string, EdiRouteResult> = {
  '850': {
    transactionType: '850',
    endpoint: '/api/v1/orders/import/edi',
    description: 'Purchase Order → Create Orders',
  },
  '990': {
    transactionType: '990',
    endpoint: '/api/v1/edi/tender/990',
    description: 'Response to Load Tender → Process Carrier Accept/Decline',
  },
  '997': {
    transactionType: '997',
    endpoint: '/api/v1/edi/997/inbound',
    description: 'Functional Acknowledgment → Track Ack Status',
  },
  '214': {
    transactionType: '214',
    endpoint: '/api/v1/edi/214/inbound',
    description: 'Shipment Status → Update Tracking',
  },
  '210': {
    transactionType: '210',
    endpoint: '/api/v1/edi/210/inbound',
    description: 'Freight Invoice → Create Carrier Invoice',
  },
  '820': {
    transactionType: '820',
    endpoint: '/api/v1/edi/820/inbound',
    description: 'Payment Order/Remittance Advice → Record Payments',
  },
  '180': {
    transactionType: '180',
    endpoint: '/api/v1/edi/180/inbound',
    description: 'Return Merchandise Authorization → Create RMA',
  },
  '940': {
    transactionType: '940',
    endpoint: '/api/v1/edi/940/inbound',
    description: 'Warehouse Shipping Order → Create Order',
  },
};

export class EdiRouterService implements IEdiRouterService {
  /**
   * Detect the X12 transaction type from raw EDI content.
   * Looks for the ST segment which identifies the transaction set.
   * ST*850*0001 → 850, ST*990*0001 → 990, etc.
   */
  detectTransactionType(content: string): string | null {
    // Normalize line endings
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Try to find ST segment — could be delimited by ~ or newline
    // ST segment format: ST*{transactionType}*{controlNumber}
    const stPatterns = [
      /ST\*(\d{3})\*/,          // Standard: ST*850*...
      /ST\~(\d{3})\~/,          // Tilde as element separator (rare)
    ];

    for (const pattern of stPatterns) {
      const match = normalized.match(pattern);
      if (match) {
        return match[1];
      }
    }

    // Fallback: check GS segment functional identifier code
    // GS*PO = Purchase Order (850), GS*SM = Ship Notice (856), etc.
    const gsMatch = normalized.match(/GS\*([A-Z]{2})\*/);
    if (gsMatch) {
      const gsCode = gsMatch[1];
      const gsToTransaction: Record<string, string> = {
        'PO': '850',   // Purchase Order
        'SH': '856',   // Ship Notice
        'SM': '204',   // Motor Carrier Load Tender
        'GF': '990',   // Response to Load Tender
        'QM': '214',   // Shipment Status
        'IM': '210',   // Freight Invoice
        'FA': '997',   // Functional Acknowledgment
      };
      return gsToTransaction[gsCode] || null;
    }

    return null;
  }

  getRouteForTransaction(transactionType: string): EdiRouteResult | null {
    return TRANSACTION_ROUTES[transactionType] || null;
  }

  getSupportedTransactionTypes(): EdiRouteResult[] {
    return Object.values(TRANSACTION_ROUTES);
  }
}
