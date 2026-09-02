/**
 * Revoke a share link. The row stays so the access ledger keeps its parent and an operator can
 * still see who opened the link before it was pulled.
 *
 * Concurrency: two operators can revoke the same link at once. The revoke is written only when
 * `revokedAt` is still null, so the first one wins and the second reports the link as already
 * revoked rather than overwriting who pulled it and when.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { SHARE_LINK_NOT_FOUND, SHARE_LINK_ALREADY_REVOKED } from './UpdateShipmentShareLinkCommand.js';

export const REVOKE_SHIPMENT_SHARE_LINK = 'shipment_share_link.revoke';

export interface RevokeShipmentShareLinkPayload {
  shareLinkId: string;
}

export interface RevokeShipmentShareLinkResult {
  id: string;
  shipmentId: string;
  revokedAt: Date;
}

export class RevokeShipmentShareLinkCommandHandler extends BaseCommandHandler<
  RevokeShipmentShareLinkPayload,
  RevokeShipmentShareLinkResult
> {
  readonly commandType = REVOKE_SHIPMENT_SHARE_LINK;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<RevokeShipmentShareLinkPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<RevokeShipmentShareLinkResult> {
    const { shareLinkId } = command.payload;

    const existing = await tx.shipmentShareLink.findFirst({
      where: { id: shareLinkId, orgId: command.orgId },
      select: { id: true, shipmentId: true, revokedAt: true },
    });
    if (!existing) throw new Error(SHARE_LINK_NOT_FOUND);
    if (existing.revokedAt) throw new Error(SHARE_LINK_ALREADY_REVOKED);

    const revokedAt = new Date();
    const updated = await tx.shipmentShareLink.updateMany({
      where: { id: shareLinkId, orgId: command.orgId, revokedAt: null },
      data: { revokedAt, revokedBy: command.actorId ?? 'system' },
    });
    if (updated.count === 0) throw new Error(SHARE_LINK_ALREADY_REVOKED);

    emit(
      this.createEvent(command, {
        type: EVENT_TYPES.SHIPMENT_SHARE_LINK_REVOKED,
        entityType: 'shipment',
        entityId: existing.shipmentId,
        payload: { shareLinkId, shipmentId: existing.shipmentId, revokedAt: revokedAt.toISOString() },
      })
    );

    return { id: shareLinkId, shipmentId: existing.shipmentId, revokedAt };
  }
}
