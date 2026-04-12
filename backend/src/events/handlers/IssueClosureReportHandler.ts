/**
 * IssueClosureReportHandler
 *
 * Auto-generates a PDF closure report when an issue is closed.
 * Listens to issue.closed events and triggers IssueClosureReportService.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { EVENT_TYPES } from '../eventTypes.js';
import { IBinaryStorageProvider } from '../../storage/IBinaryStorageProvider.js';
import { IssueClosureReportService } from '../../services/IssueClosureReportService.js';

export class IssueClosureReportHandler implements IEventHandler {
  readonly name = 'handler.issue_closure_report';
  readonly eventPatterns = ['issue.closed', 'issue.resolved'];
  readonly options: SubscribeOptions = {
    concurrency: 2,
    priority: 3,
    retryLimit: 3,
    expireInSeconds: 120,
  };

  constructor(
    private prisma: PrismaClient,
    private storageProvider: IBinaryStorageProvider,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    // Only generate on close (not resolve - user may want to reopen)
    if (event.type !== EVENT_TYPES.ISSUE_CLOSED) return;

    const issueId = event.entityId;

    // Check if report already exists (idempotent)
    const existing = await this.prisma.generatedDocument.findFirst({
      where: {
        documentType: 'issue_closure_report',
        metadata: { path: ['issueId'], equals: issueId },
      },
    });
    if (existing) return;

    try {
      const reportService = new IssueClosureReportService(this.prisma, this.storageProvider);
      const result = await reportService.generateReport(issueId);
      console.log(`[IssueClosureReportHandler] Generated closure report for issue ${issueId}: doc=${result.documentId}`);
    } catch (err: any) {
      console.error(`[IssueClosureReportHandler] Failed to generate report for issue ${issueId}: ${err.message}`);
      throw err; // Retry via pg-boss
    }
  }
}
