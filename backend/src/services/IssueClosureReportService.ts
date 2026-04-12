/**
 * IssueClosureReportService
 *
 * Generates a PDF closure report when an issue is resolved or closed.
 * Pulls together: issue details, triggering event, activity timeline,
 * comments, temperature telemetry (if cold chain), CAPA reports,
 * SLA evaluations, and resolution notes.
 *
 * Stored via IBinaryStorageProvider and recorded as a GeneratedDocument.
 */

import { PrismaClient } from '@prisma/client';
import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib';
import { randomUUID } from 'crypto';
import { IBinaryStorageProvider } from '../storage/IBinaryStorageProvider.js';

interface IssueReportContext {
  issue: any;
  comments: any[];
  events: any[];
  triggerEvent: any | null;
  shipment: any | null;
  order: any | null;
  capaReports: any[];
  slaEvaluations: any[];
  temperatureSummary: any | null;
  excursions: any[];
  labels: any[];
}

export class IssueClosureReportService {
  constructor(
    private prisma: PrismaClient,
    private storageProvider: IBinaryStorageProvider,
  ) {}

  async generateReport(issueId: string): Promise<{ documentId: string; storageKey: string }> {
    // 1. Gather all data
    const ctx = await this.gatherReportData(issueId);

    // 2. Build PDF
    const pdfBytes = await this.buildPdf(ctx);

    // 3. Store via binary storage provider
    const storageKey = `files/${randomUUID()}`;
    await this.storageProvider.store(storageKey, Buffer.from(pdfBytes), { 'Content-Type': 'application/pdf' });

    // 4. Create GeneratedDocument record
    const retentionUntil = new Date();
    retentionUntil.setFullYear(retentionUntil.getFullYear() + 10);

    const doc = await this.prisma.generatedDocument.create({
      data: {
        documentType: 'issue_closure_report',
        fileName: `Issue-Closure-${ctx.issue.id.slice(0, 8)}.pdf`,
        shipmentId: ctx.issue.sourceEntityType === 'shipment' ? ctx.issue.sourceEntityId : undefined,
        storageKey,
        storageBackend: 's3',
        mimeType: 'application/pdf',
        fileSize: pdfBytes.length,
        retentionExpiresAt: retentionUntil,
        metadata: {
          reportType: 'issue_closure_report',
          issueId: ctx.issue.id,
          issueTitle: ctx.issue.title,
          category: ctx.issue.category,
          priority: ctx.issue.priority,
          commentCount: ctx.comments.length,
          capaCount: ctx.capaReports.length,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    return { documentId: doc.id, storageKey };
  }

  private async gatherReportData(issueId: string): Promise<IssueReportContext> {
    const issue = await this.prisma.issue.findUniqueOrThrow({
      where: { id: issueId },
      include: {
        capaReports: { orderBy: { createdAt: 'desc' } },
        labelAssignments: { include: { label: true } },
      },
    });

    // Comments on this issue
    const comments = await this.prisma.comment.findMany({
      where: { entityType: 'issue', entityId: issueId },
      orderBy: { createdAt: 'asc' },
    });

    // Domain events for this issue
    const events = await this.prisma.domainEventLog.findMany({
      where: { entityType: 'issue', entityId: issueId },
      orderBy: { createdAt: 'asc' },
    });

    // Triggering event
    let triggerEvent = null;
    if (issue.sourceEventId) {
      triggerEvent = await this.prisma.domainEventLog.findUnique({
        where: { id: issue.sourceEventId },
      });
    }

    // SLA evaluations
    const slaEvaluations = await this.prisma.slaEvaluation.findMany({
      where: { entityType: 'issue', entityId: issueId },
      orderBy: { createdAt: 'desc' },
    });

    // Source entity data
    let shipment = null;
    let order = null;
    let temperatureSummary = null;
    let excursions: any[] = [];

    if (issue.sourceEntityType === 'shipment' && issue.sourceEntityId) {
      shipment = await this.prisma.shipment.findUnique({
        where: { id: issue.sourceEntityId },
        include: {
          customer: true,
          origin: true,
          destination: true,
          carrier: true,
          loads: { include: { driver: true } },
        },
      });

      // Temperature data if cold chain shipment
      if (shipment) {
        const tempAgg = await this.prisma.immutableTemperatureLog.aggregate({
          where: { shipmentId: shipment.id },
          _count: { id: true },
          _min: { temperature: true },
          _max: { temperature: true },
          _avg: { temperature: true },
        });
        if (tempAgg._count.id > 0) {
          const excursionCount = await this.prisma.immutableTemperatureLog.count({
            where: { shipmentId: shipment.id, isExcursion: true },
          });
          temperatureSummary = {
            totalReadings: tempAgg._count.id,
            minTemp: tempAgg._min.temperature,
            maxTemp: tempAgg._max.temperature,
            avgTemp: tempAgg._avg.temperature ? Math.round(tempAgg._avg.temperature * 10) / 10 : null,
            excursionReadings: excursionCount,
          };
        }

        excursions = await this.prisma.coldChainExcursion.findMany({
          where: { shipmentId: shipment.id },
          orderBy: { startedAt: 'asc' },
        });
      }
    }

    if (issue.sourceEntityType === 'order' && issue.sourceEntityId) {
      order = await this.prisma.order.findUnique({
        where: { id: issue.sourceEntityId },
        include: { customer: true },
      });
    }

    const labels = (issue.labelAssignments || []).map((a: any) => a.label);

    return {
      issue,
      comments,
      events,
      triggerEvent,
      shipment,
      order,
      capaReports: issue.capaReports || [],
      slaEvaluations,
      temperatureSummary,
      excursions,
      labels,
    };
  }

  private async buildPdf(ctx: IssueReportContext): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595.28; // A4
    const pageHeight = 841.89;
    const margin = 50;

    let page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const drawText = (text: string, x: number, yPos: number, size: number, f: PDFFont = font, color = rgb(0.1, 0.1, 0.1)) => {
      // Sanitize text for WinAnsi encoding
      const safe = String(text).replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
      page.drawText(safe, { x, y: yPos, size, font: f, color });
    };

    const addNewPageIfNeeded = (needed: number) => {
      if (y - needed < margin) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
    };

    const drawLine = (yPos: number) => {
      page.drawLine({
        start: { x: margin, y: yPos },
        end: { x: pageWidth - margin, y: yPos },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });
    };

    const sectionHeader = (title: string) => {
      addNewPageIfNeeded(40);
      y -= 10;
      drawLine(y);
      y -= 20;
      drawText(title, margin, y, 14, fontBold, rgb(0.15, 0.3, 0.6));
      y -= 20;
    };

    const labelValue = (label: string, value: string, xOffset = 0) => {
      addNewPageIfNeeded(20);
      drawText(label + ':', margin + xOffset, y, 9, fontBold, rgb(0.4, 0.4, 0.4));
      drawText(value || 'N/A', margin + xOffset + 140, y, 9);
      y -= 16;
    };

    const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, fontSize);
        if (width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines;
    };

    // ── Title ──
    drawText('ISSUE CLOSURE REPORT', margin, y, 18, fontBold, rgb(0.15, 0.3, 0.6));
    y -= 14;
    drawText(`Generated: ${new Date().toISOString().split('T')[0]} ${new Date().toTimeString().split(' ')[0]}`, margin, y, 8, font, rgb(0.5, 0.5, 0.5));
    y -= 25;
    drawLine(y);
    y -= 20;

    // ── 1. Issue Summary ──
    sectionHeader('1. Issue Summary');
    labelValue('Issue ID', ctx.issue.id.slice(0, 12));
    labelValue('Title', ctx.issue.title);
    labelValue('Status', ctx.issue.status.toUpperCase());
    labelValue('Priority', ctx.issue.priority.toUpperCase());
    labelValue('Category', ctx.issue.category);
    if (ctx.labels.length > 0) {
      labelValue('Labels', ctx.labels.map((l: any) => l.name).join(', '));
    }
    labelValue('Created', new Date(ctx.issue.createdAt).toLocaleString());
    if (ctx.issue.resolvedAt) {
      labelValue('Resolved', new Date(ctx.issue.resolvedAt).toLocaleString());
    }
    if (ctx.issue.closedAt) {
      labelValue('Closed', new Date(ctx.issue.closedAt).toLocaleString());
    }
    if (ctx.issue.assigneeName) {
      labelValue('Assigned To', ctx.issue.assigneeName);
    }
    if (ctx.issue.escalatedTo) {
      labelValue('Escalated To', ctx.issue.escalatedTo);
    }
    if (ctx.issue.needsCapa) {
      labelValue('CAPA Required', 'YES');
    }

    // Description
    if (ctx.issue.description) {
      addNewPageIfNeeded(40);
      drawText('Description:', margin, y, 9, fontBold, rgb(0.4, 0.4, 0.4));
      y -= 14;
      const descLines = wrapText(ctx.issue.description, pageWidth - 2 * margin, 9);
      for (const line of descLines) {
        addNewPageIfNeeded(14);
        drawText(line, margin, y, 9);
        y -= 14;
      }
    }

    // Resolution
    if (ctx.issue.resolution) {
      addNewPageIfNeeded(40);
      y -= 5;
      drawText('Resolution:', margin, y, 9, fontBold, rgb(0.4, 0.4, 0.4));
      y -= 14;
      const resLines = wrapText(ctx.issue.resolution, pageWidth - 2 * margin, 9);
      for (const line of resLines) {
        addNewPageIfNeeded(14);
        drawText(line, margin, y, 9);
        y -= 14;
      }
    }

    // ── 2. Trigger Event ──
    if (ctx.triggerEvent) {
      sectionHeader('2. Triggering Event');
      labelValue('Event Type', ctx.triggerEvent.type);
      labelValue('Occurred', ctx.triggerEvent.timestamp || new Date(ctx.triggerEvent.createdAt).toLocaleString());
      labelValue('Entity', `${ctx.triggerEvent.entityType} / ${ctx.triggerEvent.entityId.slice(0, 12)}`);
      const payload = ctx.triggerEvent.payload;
      if (payload && typeof payload === 'object') {
        const summary = (payload as any).summary || (payload as any).description || (payload as any).reason;
        if (summary) {
          addNewPageIfNeeded(30);
          drawText('Payload Summary:', margin, y, 9, fontBold, rgb(0.4, 0.4, 0.4));
          y -= 14;
          const sumLines = wrapText(String(summary), pageWidth - 2 * margin, 9);
          for (const line of sumLines) {
            addNewPageIfNeeded(14);
            drawText(line, margin, y, 9);
            y -= 14;
          }
        }
      }
    }

    // ── 3. Source Entity ──
    if (ctx.shipment) {
      sectionHeader(ctx.triggerEvent ? '3. Related Shipment' : '2. Related Shipment');
      labelValue('Reference', ctx.shipment.reference);
      labelValue('Status', ctx.shipment.status);
      labelValue('Customer', ctx.shipment.customer?.name || 'N/A');
      labelValue('Origin', ctx.shipment.origin ? `${ctx.shipment.origin.name}, ${ctx.shipment.origin.city}` : 'N/A');
      labelValue('Destination', ctx.shipment.destination ? `${ctx.shipment.destination.name}, ${ctx.shipment.destination.city}` : 'N/A');
      labelValue('Carrier', ctx.shipment.carrier?.name || 'N/A');
      const driver = ctx.shipment.loads?.[0]?.driver;
      if (driver) {
        labelValue('Driver', `${driver.name}${driver.phone ? ' (' + driver.phone + ')' : ''}`);
      }
    } else if (ctx.order) {
      sectionHeader(ctx.triggerEvent ? '3. Related Order' : '2. Related Order');
      labelValue('Reference', ctx.order.reference);
      labelValue('Status', ctx.order.status);
      labelValue('Customer', ctx.order.customer?.name || 'N/A');
    }

    // ── 4. Temperature Telemetry (if applicable) ──
    if (ctx.temperatureSummary) {
      sectionHeader('4. Temperature Monitoring');
      labelValue('Total Readings', String(ctx.temperatureSummary.totalReadings));
      labelValue('Min Temperature', `${ctx.temperatureSummary.minTemp}C`);
      labelValue('Max Temperature', `${ctx.temperatureSummary.maxTemp}C`);
      labelValue('Avg Temperature', `${ctx.temperatureSummary.avgTemp}C`);
      labelValue('Excursion Readings', String(ctx.temperatureSummary.excursionReadings));

      if (ctx.excursions.length > 0) {
        addNewPageIfNeeded(30);
        y -= 5;
        drawText('Excursions:', margin, y, 10, fontBold);
        y -= 16;
        for (const exc of ctx.excursions) {
          addNewPageIfNeeded(60);
          labelValue('Type', exc.excursionType, 10);
          labelValue('Severity', exc.severity, 10);
          labelValue('Peak Value', `${exc.peakValue}C (threshold: ${exc.thresholdValue}C)`, 10);
          labelValue('Duration', exc.durationMinutes ? `${exc.durationMinutes} minutes` : 'Ongoing', 10);
          labelValue('Status', exc.status, 10);
          y -= 5;
        }
      }
    }

    // ── 5. SLA Evaluations ──
    if (ctx.slaEvaluations.length > 0) {
      const sectionNum = ctx.temperatureSummary ? '5' : '4';
      sectionHeader(`${sectionNum}. SLA Evaluations`);
      for (const sla of ctx.slaEvaluations) {
        addNewPageIfNeeded(40);
        labelValue('Rule', sla.ruleName || sla.ruleType);
        labelValue('Status', sla.status.toUpperCase());
        if (sla.slaDueAt) {
          labelValue('Due', new Date(sla.slaDueAt).toLocaleString());
        }
        if (sla.metAt) {
          labelValue('Met At', new Date(sla.metAt).toLocaleString());
        }
        if (sla.breachedAt) {
          labelValue('Breached At', new Date(sla.breachedAt).toLocaleString());
        }
        y -= 5;
      }
    }

    // ── Activity Timeline ──
    const nextSection = ctx.temperatureSummary ? (ctx.slaEvaluations.length > 0 ? '6' : '5') : (ctx.slaEvaluations.length > 0 ? '5' : '4');
    sectionHeader(`${nextSection}. Activity Timeline`);

    // Merge events and comments chronologically
    const timeline = [
      ...ctx.events.map(e => ({
        type: 'event' as const,
        timestamp: e.timestamp || e.createdAt.toISOString(),
        text: `[${e.type}] ${this.summarizeEvent(e)}`,
        actor: e.actorId || 'system',
      })),
      ...ctx.comments.map(c => ({
        type: 'comment' as const,
        timestamp: c.createdAt.toISOString(),
        text: c.body,
        actor: `${c.authorName} (${c.authorType})`,
      })),
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const item of timeline) {
      addNewPageIfNeeded(40);
      const timeStr = new Date(item.timestamp).toLocaleString();
      const icon = item.type === 'comment' ? 'Comment' : 'Event';
      drawText(`${timeStr} | ${icon} | ${item.actor}`, margin, y, 8, fontBold, rgb(0.4, 0.4, 0.4));
      y -= 12;
      const lines = wrapText(item.text, pageWidth - 2 * margin - 10, 9);
      for (const line of lines) {
        addNewPageIfNeeded(14);
        drawText(line, margin + 10, y, 9);
        y -= 14;
      }
      y -= 4;
    }

    if (timeline.length === 0) {
      drawText('No activity recorded.', margin, y, 9, font, rgb(0.5, 0.5, 0.5));
      y -= 16;
    }

    // ── CAPA Reports ──
    if (ctx.capaReports.length > 0) {
      const capaSection = parseInt(nextSection) + 1;
      sectionHeader(`${capaSection}. CAPA Reports`);
      for (const capa of ctx.capaReports) {
        addNewPageIfNeeded(80);
        labelValue('Report Number', capa.reportNumber);
        labelValue('Title', capa.title);
        labelValue('Status', capa.status);
        labelValue('Priority', capa.priority);
        if (capa.rootCause) {
          labelValue('Root Cause', capa.rootCause);
        }
        if (capa.rootCauseCategory) {
          labelValue('Root Cause Category', capa.rootCauseCategory);
        }
        if (capa.correctiveAction) {
          addNewPageIfNeeded(30);
          drawText('Corrective Action:', margin, y, 9, fontBold, rgb(0.4, 0.4, 0.4));
          y -= 14;
          const caLines = wrapText(capa.correctiveAction, pageWidth - 2 * margin, 9);
          for (const line of caLines) {
            addNewPageIfNeeded(14);
            drawText(line, margin, y, 9);
            y -= 14;
          }
        }
        if (capa.lessonsLearned) {
          addNewPageIfNeeded(30);
          drawText('Lessons Learned:', margin, y, 9, fontBold, rgb(0.4, 0.4, 0.4));
          y -= 14;
          const llLines = wrapText(capa.lessonsLearned, pageWidth - 2 * margin, 9);
          for (const line of llLines) {
            addNewPageIfNeeded(14);
            drawText(line, margin, y, 9);
            y -= 14;
          }
        }
        y -= 10;
      }
    }

    // ── Footer ──
    addNewPageIfNeeded(40);
    y -= 20;
    drawLine(y);
    y -= 15;
    drawText('This report was automatically generated by Open TMS Issue Closure system.', margin, y, 8, font, rgb(0.5, 0.5, 0.5));
    y -= 12;
    drawText(`Issue ID: ${ctx.issue.id}`, margin, y, 8, font, rgb(0.5, 0.5, 0.5));

    return pdf.save();
  }

  private summarizeEvent(event: any): string {
    const p = event.payload || {};
    const t = event.type || '';
    if (t === 'issue.created') return `Issue created - ${p.title || ''}`;
    if (t === 'issue.status_changed') return `Status: ${p.previousStatus} -> ${p.newStatus}`;
    if (t === 'issue.assigned') return `Assigned to ${p.assigneeName || p.assigneeId || 'someone'}`;
    if (t === 'issue.escalated') return `Escalated to ${p.escalatedTo || 'someone'}`;
    if (t === 'issue.resolved') return `Resolved - ${p.resolution || ''}`;
    if (t === 'issue.closed') return 'Issue closed';
    if (t === 'issue.reopened') return `Reopened from ${p.previousStatus}`;
    if (t === 'issue.snoozed') return `Snoozed until ${p.snoozedUntil || 'later'}`;
    if (t === 'issue.unsnoozed') return 'Snooze cleared';
    if (t === 'issue.needs_capa_marked') return p.needsCapa ? 'Marked as needs CAPA' : 'CAPA requirement cleared';
    if (t === 'issue.label_added') return 'Label added';
    if (t === 'issue.label_removed') return 'Label removed';
    return t.replace('issue.', '');
  }
}
