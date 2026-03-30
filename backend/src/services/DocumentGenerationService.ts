import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import Handlebars from 'handlebars';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { IDocumentTemplateRepository } from '../repositories/DocumentTemplateRepository.js';
import { IGeneratedDocumentRepository, CreateGeneratedDocumentDTO } from '../repositories/GeneratedDocumentRepository.js';
import { IBinaryStorageProvider } from '../storage/IBinaryStorageProvider.js';
import { defaultBolTemplate } from './templates/bolTemplate.js';
import { defaultLabelTemplate } from './templates/labelTemplate.js';
import { defaultCustomsTemplate } from './templates/customsTemplate.js';

export interface IDocumentGenerationService {
  generateBOL(shipmentId: string, templateId?: string, userId?: string): Promise<{ id: string; fileName: string }>;
  generateLabels(orderId: string, templateId?: string, userId?: string): Promise<{ id: string; fileName: string }>;
  generateCustomsForm(shipmentId: string, templateId?: string, userId?: string): Promise<{ id: string; fileName: string }>;
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/**
 * Renders HTML template content using Handlebars and converts to a simple PDF
 * using pdf-lib (pure JS, no browser dependency).
 *
 * The PDF generation uses a text-based approach: the Handlebars template is rendered
 * to plain text (HTML tags stripped), then laid out line-by-line onto PDF pages.
 * This is lightweight and works in any environment without Chrome/puppeteer.
 */
export class DocumentGenerationService implements IDocumentGenerationService {
  private storageBackend: string;

  constructor(
    private prisma: PrismaClient,
    private templateRepo: IDocumentTemplateRepository,
    private docRepo: IGeneratedDocumentRepository,
    private storageProvider?: IBinaryStorageProvider,
  ) {
    this.storageBackend = process.env.S3_ENDPOINT && process.env.S3_BUCKET ? 's3' : 'database';
    // Register Handlebars helpers
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
  }

  async generateBOL(shipmentId: string, templateId?: string, userId?: string) {
    // Load shipment with all relations
    const shipment = await this.prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      include: {
        origin: true,
        destination: true,
        customer: true,
        carrier: true,
        loads: { include: { vehicle: true, driver: true } },
        stops: { include: { location: true }, orderBy: { sequenceNumber: 'asc' } },
        orderShipments: {
          include: {
            order: {
              include: {
                trackableUnits: { include: { lineItems: true }, orderBy: { sequenceNumber: 'asc' } },
                lineItems: true,
              },
            },
          },
        },
      },
    });

    // Generate BOL number
    const org = await this.prisma.organization.findFirst();
    const seqNum = (org?.bolSequenceNumber ?? 0) + 1;
    if (org) {
      await this.prisma.organization.update({
        where: { id: org.id },
        data: { bolSequenceNumber: seqNum },
      });
    }
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const bolNumber = `BOL-${dateStr}-${String(seqNum).padStart(4, '0')}`;

    // Build template data
    const orders = shipment.orderShipments.map(os => os.order);
    const allLineItems = orders.flatMap(o => o.lineItems);
    const allUnits = orders.flatMap(o => o.trackableUnits);
    const totalWeight = allLineItems.reduce((sum, li) => sum + (li.weight ?? 0), 0);

    const data = {
      bolNumber,
      date: formatDate(today),
      shipment: {
        reference: shipment.reference,
        status: shipment.status,
        pickupDate: formatDate(shipment.pickupDate),
        deliveryDate: formatDate(shipment.deliveryDate),
        origin: shipment.origin,
        destination: shipment.destination,
      },
      customer: shipment.customer,
      carrier: shipment.carrier || {},
      vehicle: shipment.loads[0]?.vehicle || null,
      driver: shipment.loads[0]?.driver || null,
      stops: shipment.stops.map(s => ({
        ...s,
        estimatedArrival: formatDate(s.estimatedArrival),
      })),
      orders: orders.map(o => ({
        orderNumber: o.orderNumber,
        poNumber: o.poNumber,
        serviceLevel: o.serviceLevel,
        temperatureControl: o.temperatureControl,
        requiresHazmat: o.requiresHazmat,
        specialInstructions: o.specialInstructions,
        trackableUnits: o.trackableUnits,
        lineItems: o.lineItems,
      })),
      totals: {
        orderCount: orders.length,
        unitCount: allUnits.length,
        itemCount: allLineItems.reduce((sum, li) => sum + li.quantity, 0),
        totalWeight: Math.round(totalWeight * 100) / 100,
      },
      specialInstructions: orders.map(o => o.specialInstructions).filter(Boolean).join('; '),
    };

    // Render template
    const htmlTemplate = await this.getTemplateHtml('bol', templateId);
    const html = Handlebars.compile(htmlTemplate)(data);

    // Generate PDF
    const pdfBytes = await this.htmlToPdf(html, `Bill of Lading - ${bolNumber}`);

    const fileName = `${bolNumber}.pdf`;
    const buffer = Buffer.from(pdfBytes);
    // Opaque key — no entity info or filenames in storage path
    const storageKey = `files/${randomUUID()}`;

    const doc = await this.storeDocument({
      documentType: 'bol',
      documentNumber: bolNumber,
      fileName,
      mimeType: 'application/pdf',
      fileSize: pdfBytes.length,
      fileContent: buffer,
      templateId,
      shipmentId,
      customerId: shipment.customerId,
      generatedBy: userId,
      metadata: data,
    }, storageKey);

    return { id: doc.id, fileName };
  }

  async generateLabels(orderId: string, templateId?: string, userId?: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        customer: true,
        origin: true,
        destination: true,
        trackableUnits: { orderBy: { sequenceNumber: 'asc' } },
        orderShipments: { include: { shipment: { include: { carrier: true } } } },
      },
    });

    const shipment = order.orderShipments[0]?.shipment;

    const data = {
      orderNumber: order.orderNumber,
      poNumber: order.poNumber || '',
      shipmentReference: shipment?.reference || '',
      carrierName: shipment?.carrier?.name || '',
      origin: order.origin || {},
      destination: order.destination || {},
      temperatureControl: order.temperatureControl,
      requiresHazmat: order.requiresHazmat,
      specialInstructions: order.specialInstructions || '',
      unitTotal: order.trackableUnits.length,
      units: order.trackableUnits,
    };

    const htmlTemplate = await this.getTemplateHtml('label', templateId);
    const html = Handlebars.compile(htmlTemplate)(data);

    const pdfBytes = await this.htmlToPdf(html, `Labels - ${order.orderNumber}`);

    const fileName = `Labels-${order.orderNumber}.pdf`;
    const buffer = Buffer.from(pdfBytes);
    const storageKey = `files/${randomUUID()}`;

    const doc = await this.storeDocument({
      documentType: 'label',
      fileName,
      mimeType: 'application/pdf',
      fileSize: pdfBytes.length,
      fileContent: buffer,
      templateId,
      orderId,
      customerId: order.customerId,
      generatedBy: userId,
      metadata: data,
    }, storageKey);

    return { id: doc.id, fileName };
  }

  async generateCustomsForm(shipmentId: string, templateId?: string, userId?: string) {
    const shipment = await this.prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      include: {
        origin: true,
        destination: true,
        customer: true,
        carrier: true,
        orderShipments: {
          include: { order: { include: { lineItems: true } } },
        },
      },
    });

    const orders = shipment.orderShipments.map(os => os.order);
    const allLineItems = orders.flatMap(o => o.lineItems);
    const totalWeight = allLineItems.reduce((sum, li) => sum + (li.weight ?? 0), 0);

    const data = {
      date: formatDate(new Date()),
      invoiceNumber: `CI-${shipment.reference}`,
      shipment: {
        reference: shipment.reference,
        pickupDate: formatDate(shipment.pickupDate),
        deliveryDate: formatDate(shipment.deliveryDate),
        origin: shipment.origin,
        destination: shipment.destination,
      },
      customer: shipment.customer,
      carrier: shipment.carrier || {},
      lineItems: allLineItems,
      totals: {
        itemCount: allLineItems.reduce((sum, li) => sum + li.quantity, 0),
        totalWeight: Math.round(totalWeight * 100) / 100,
      },
    };

    const htmlTemplate = await this.getTemplateHtml('customs', templateId);
    const html = Handlebars.compile(htmlTemplate)(data);

    const pdfBytes = await this.htmlToPdf(html, `Customs Form - ${shipment.reference}`);

    const fileName = `Customs-${shipment.reference}.pdf`;
    const buffer = Buffer.from(pdfBytes);
    const storageKey = `files/${randomUUID()}`;

    const doc = await this.storeDocument({
      documentType: 'customs',
      fileName,
      mimeType: 'application/pdf',
      fileSize: pdfBytes.length,
      fileContent: buffer,
      templateId,
      shipmentId,
      customerId: shipment.customerId,
      generatedBy: userId,
      metadata: data,
    }, storageKey);

    return { id: doc.id, fileName };
  }

  /**
   * Store document content via IBinaryStorageProvider (if available) or inline in DB.
   * When a storage provider is configured, fileContent is not stored in the DB row.
   */
  private async storeDocument(
    dto: CreateGeneratedDocumentDTO,
    storageKey: string,
  ) {
    // Default retention: 10 years
    const retentionExpiresAt = new Date();
    retentionExpiresAt.setFullYear(retentionExpiresAt.getFullYear() + 10);

    if (this.storageProvider && dto.fileContent) {
      // Store binary in external storage, keep only metadata in DB
      await this.storageProvider.store(storageKey, dto.fileContent);
      return this.docRepo.create({
        ...dto,
        fileContent: undefined as any, // Don't store binary in DB
        storageKey,
        storageBackend: this.storageBackend,
        retentionExpiresAt,
      });
    }
    // Fallback: store binary inline in DB (original behavior)
    return this.docRepo.create({
      ...dto,
      storageBackend: 'database',
      retentionExpiresAt,
    });
  }

  private async getTemplateHtml(documentType: string, templateId?: string): Promise<string> {
    if (templateId) {
      const template = await this.templateRepo.findById(templateId);
      if (template) return template.htmlTemplate;
    }

    // Try default template from DB
    const defaultTemplate = await this.templateRepo.findDefault(documentType);
    if (defaultTemplate) return defaultTemplate.htmlTemplate;

    // Fall back to built-in templates
    switch (documentType) {
      case 'bol': return defaultBolTemplate;
      case 'label': return defaultLabelTemplate;
      case 'customs': return defaultCustomsTemplate;
      default: return '<p>No template available for document type: {{documentType}}</p>';
    }
  }

  /**
   * Convert rendered HTML to PDF using pdf-lib.
   * Strips HTML tags and lays out text line-by-line.
   * Supports basic structure: headings (bold, larger), tables (tab-separated), paragraphs.
   */
  async htmlToPdf(html: string, title: string): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.setTitle(title);
    doc.setCreator('Open TMS');

    const font = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 612; // US Letter
    const pageHeight = 792;
    const margin = 50;
    const lineHeight = 14;
    const maxWidth = pageWidth - 2 * margin;

    let page = doc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const addLine = (text: string, fontSize: number, isBold = false) => {
      if (y < margin + lineHeight) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(text, {
        x: margin,
        y,
        size: fontSize,
        font: isBold ? boldFont : font,
        color: rgb(0, 0, 0),
        maxWidth,
      });
      y -= fontSize + 4;
    };

    const addSeparator = () => {
      if (y < margin + lineHeight) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawLine({
        start: { x: margin, y },
        end: { x: pageWidth - margin, y },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
      });
      y -= 8;
    };

    // Parse HTML into lines
    const lines = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .split(/(<h[1-3][^>]*>.*?<\/h[1-3]>|<tr[^>]*>.*?<\/tr>|<p[^>]*>.*?<\/p>|<div[^>]*>.*?<\/div>|<br\s*\/?>)/gi)
      .filter(Boolean);

    for (const segment of lines) {
      const stripped = segment
        .replace(/<th[^>]*>/gi, '')
        .replace(/<\/th>/gi, '\t')
        .replace(/<td[^>]*>/gi, '')
        .replace(/<\/td>/gi, '\t')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!stripped) continue;

      if (/<h1/i.test(segment)) {
        y -= 6;
        addLine(stripped, 18, true);
        addSeparator();
      } else if (/<h2/i.test(segment)) {
        y -= 4;
        addLine(stripped, 14, true);
      } else if (/<h3/i.test(segment)) {
        y -= 2;
        addLine(stripped, 12, true);
      } else if (/<tr/i.test(segment)) {
        // Table row - render tab-separated values
        const cells = stripped.split('\t').filter(Boolean);
        const cellText = cells.join('  |  ');
        addLine(cellText, 10);
      } else {
        // Regular text - wrap long lines
        const words = stripped.split(' ');
        let currentLine = '';
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const testWidth = font.widthOfTextAtSize(testLine, 10);
          if (testWidth > maxWidth && currentLine) {
            addLine(currentLine, 10);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          addLine(currentLine, 10);
        }
      }
    }

    return doc.save();
  }
}
