import { ISkill, SkillDefinition, SkillExecutionParams, SkillExecutionResult } from './ISkill.js';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * ContactDriverSkill
 *
 * Looks up the driver assigned to a shipment and posts a comment
 * on the associated issue with driver contact details plus the
 * reason for contact. If no driver is assigned, the comment notes
 * that and suggests contacting the carrier directly.
 */
export class ContactDriverSkill implements ISkill {
  readonly definition: SkillDefinition = {
    type: 'contact_driver',
    name: 'Contact Driver',
    description: 'Look up driver on a shipment and post contact details as an issue comment',
    icon: 'phone',
    category: 'triage',
    fields: [
      { key: 'issueId', label: 'Issue ID', type: 'template', required: true, placeholder: '{{context.openIssues.0.id}}', templateHelp: 'ID of the issue to comment on' },
      { key: 'shipmentId', label: 'Shipment ID', type: 'template', required: true, placeholder: '{{context.shipment.id}}', templateHelp: 'Shipment to look up driver from' },
      { key: 'reason', label: 'Contact Reason', type: 'template', required: true, placeholder: 'Delay notification: {{payload.description}}', templateHelp: 'Why the driver needs to be contacted' },
    ],
    configSchema: [],
    requiresConfig: false,
  };

  constructor(private prisma: PrismaClient) {}

  validateConfig(): { valid: boolean } { return { valid: true }; }

  async execute(params: SkillExecutionParams): Promise<SkillExecutionResult> {
    const issueId = String(params.fields.issueId || '');
    const shipmentId = String(params.fields.shipmentId || '');
    const reason = String(params.fields.reason || '');

    if (!issueId || !shipmentId) {
      return { success: false, error: 'issueId and shipmentId are required' };
    }

    try {
      // Look up driver via shipment loads
      const loads = await this.prisma.load.findMany({
        where: { shipmentId },
        include: {
          driver: { select: { id: true, name: true, phone: true, email: true } },
          vehicle: { select: { plate: true, type: true } },
        },
        take: 1,
      });

      const driver = loads[0]?.driver;
      const vehicle = loads[0]?.vehicle;

      let commentBody: string;
      let hasDriverInfo = false;

      if (driver && (driver.phone || driver.email)) {
        hasDriverInfo = true;
        commentBody = `**Driver contact requested**\n\n`
          + `Driver: ${driver.name}\n`
          + (driver.phone ? `Phone: ${driver.phone}\n` : '')
          + (driver.email ? `Email: ${driver.email}\n` : '')
          + (vehicle ? `Vehicle: ${vehicle.plate} (${vehicle.type})\n` : '')
          + `\nReason: ${reason}`;
      } else {
        commentBody = `**Driver contact attempted - no driver assigned**\n\n`
          + `No driver is currently assigned to this shipment (${shipmentId.slice(0, 8)}). `
          + `Please assign a driver or contact the carrier directly.\n\n`
          + `Reason for contact: ${reason}`;
      }

      const comment = await this.prisma.comment.create({
        data: {
          id: randomUUID(),
          orgId: params.orgId,
          entityType: 'issue',
          entityId: issueId,
          authorId: null,
          authorName: 'AI Triage Agent',
          authorType: 'agent',
          body: commentBody,
        },
      });

      // Update comment count
      await this.prisma.issueReadModel.update({
        where: { id: issueId },
        data: { commentCount: { increment: 1 }, updatedAt: new Date() },
      }).catch(() => {});

      return {
        success: true,
        data: {
          commentId: comment.id,
          driverName: driver?.name ?? null,
          driverPhone: driver?.phone ?? null,
          hasDriverInfo,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
