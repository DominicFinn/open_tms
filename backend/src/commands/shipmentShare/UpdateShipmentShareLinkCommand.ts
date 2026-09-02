/**
 * Edit what an existing share link exposes and how long it lasts.
 *
 * Concurrency: two operators editing the same link race on the same row. The link is re-read
 * inside the transaction and a revoked link is never editable, so a revoke that lands first
 * always wins over a concurrent edit. Neither credential can be changed here: to replace a
 * token or an access code, revoke the link and issue a new one.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { normaliseShareSections } from '@open-tms/shared';
import { SHARE_LINK_NO_SECTIONS, SHARE_LINK_EXPIRY_IN_PAST } from './CreateShipmentShareLinkCommand.js';

export const UPDATE_SHIPMENT_SHARE_LINK = 'shipment_share_link.update';

export const SHARE_LINK_NOT_FOUND = 'SHARE_LINK_NOT_FOUND';
export const SHARE_LINK_ALREADY_REVOKED = 'SHARE_LINK_ALREADY_REVOKED';

export interface UpdateShipmentShareLinkPayload {
  shareLinkId: string;
  sections?: string[];
  expiresAt?: string | Date;
  label?: string | null;
}

export interface UpdateShipmentShareLinkResult {
  id: string;
  shipmentId: string;
  sections: string[];
  expiresAt: Date;
  label: string | null;
}

export class UpdateShipmentShareLinkCommandHandler extends BaseCommandHandler<
  UpdateShipmentShareLinkPayload,
  UpdateShipmentShareLinkResult
> {
  readonly commandType = UPDATE_SHIPMENT_SHARE_LINK;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateShipmentShareLinkPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<UpdateShipmentShareLinkResult> {
    const { shareLinkId } = command.payload;

    const existing = await tx.shipmentShareLink.findFirst({
      where: { id: shareLinkId, orgId: command.orgId },
      select: { id: true, shipmentId: true, revokedAt: true },
    });
    if (!existing) throw new Error(SHARE_LINK_NOT_FOUND);
    if (existing.revokedAt) throw new Error(SHARE_LINK_ALREADY_REVOKED);

    const data: { sections?: string[]; expiresAt?: Date; label?: string | null } = {};

    if (command.payload.sections !== undefined) {
      const sections = normaliseShareSections(command.payload.sections);
      if (sections.length === 0) throw new Error(SHARE_LINK_NO_SECTIONS);
      data.sections = sections;
    }

    if (command.payload.expiresAt !== undefined) {
      const expiresAt = new Date(command.payload.expiresAt);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        throw new Error(SHARE_LINK_EXPIRY_IN_PAST);
      }
      data.expiresAt = expiresAt;
    }

    if (command.payload.label !== undefined) data.label = command.payload.label;

    const link = await tx.shipmentShareLink.update({
      where: { id: shareLinkId },
      data,
      select: { id: true, shipmentId: true, sections: true, expiresAt: true, label: true },
    });

    emit(
      this.createEvent(command, {
        type: EVENT_TYPES.SHIPMENT_SHARE_LINK_UPDATED,
        entityType: 'shipment',
        entityId: link.shipmentId,
        payload: {
          shareLinkId: link.id,
          shipmentId: link.shipmentId,
          sections: link.sections,
          expiresAt: link.expiresAt.toISOString(),
        },
      })
    );

    return link;
  }
}
