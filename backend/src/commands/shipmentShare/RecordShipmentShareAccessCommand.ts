/**
 * Decide whether an access attempt on a share link succeeds, and record it either way.
 *
 * This is the whole gate. The public route resolves the token to a tenant and then hands the
 * decision here, so the check and the counters it moves happen in one transaction.
 *
 * Concurrency: several people can be typing the access code for the same link at once, and an
 * operator can revoke it mid-attempt. The link row is re-read inside the transaction and the
 * failed-attempt counter is incremented atomically, so parallel wrong guesses each count and the
 * lockout cannot be outrun by firing requests in parallel. A revoke that commits first is seen
 * by every attempt that has not yet read the row.
 *
 * PII: the viewer's email is written to the access ledger, which is the point of the ledger. It
 * must not appear on the emitted event, in a log line, or in the response.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { IShipmentShareService, ShareLinkRejection } from '../../services/ShipmentShareService.js';
import { SHARE_LINK_NOT_FOUND } from './UpdateShipmentShareLinkCommand.js';

export const RECORD_SHIPMENT_SHARE_ACCESS = 'shipment_share_link.record_access';

export interface RecordShipmentShareAccessPayload {
  shareLinkId: string;
  accessCode: string;
  email: string;
  /** Raw client address. Hashed here; never stored or emitted in the clear. */
  ip?: string;
}

export interface RecordShipmentShareAccessResult {
  granted: boolean;
  reason: ShareLinkRejection | null;
  shipmentId: string;
  sections: string[];
  linkExpiresAt: Date;
  /** Set when a wrong code tripped the lockout, so the route can say when to try again. */
  lockedUntil: Date | null;
}

export class RecordShipmentShareAccessCommandHandler extends BaseCommandHandler<
  RecordShipmentShareAccessPayload,
  RecordShipmentShareAccessResult
> {
  readonly commandType = RECORD_SHIPMENT_SHARE_ACCESS;

  constructor(
    prisma: PrismaClient,
    eventBus: PgBossEventBus,
    private shareService: IShipmentShareService
  ) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<RecordShipmentShareAccessPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<RecordShipmentShareAccessResult> {
    const { shareLinkId, accessCode, email, ip } = command.payload;

    const link = await tx.shipmentShareLink.findFirst({
      where: { id: shareLinkId, orgId: command.orgId },
      select: {
        id: true,
        shipmentId: true,
        sections: true,
        accessCodeHash: true,
        expiresAt: true,
        revokedAt: true,
        lockedUntil: true,
      },
    });
    if (!link) throw new Error(SHARE_LINK_NOT_FOUND);

    const now = new Date();
    const unavailable = this.shareService.checkAvailability(link, now);
    const codeValid = unavailable === null && this.shareService.verifyAccessCode(accessCode, link.accessCodeHash);
    const outcome: ShareLinkRejection | null = unavailable ?? (codeValid ? null : 'denied_bad_code');

    let lockedUntil: Date | null = null;
    if (outcome === null) {
      // A correct code clears the failure count, so an honest recipient who mistyped twice
      // does not carry those attempts toward a future lockout.
      await tx.shipmentShareLink.update({
        where: { id: link.id },
        data: {
          accessCount: { increment: 1 },
          lastAccessedAt: now,
          failedAttempts: 0,
          lockedUntil: null,
        },
      });
    } else if (outcome === 'denied_bad_code') {
      const bumped = await tx.shipmentShareLink.update({
        where: { id: link.id },
        data: { failedAttempts: { increment: 1 } },
        select: { failedAttempts: true },
      });
      if (this.shareService.isLockoutTriggered(bumped.failedAttempts)) {
        lockedUntil = this.shareService.lockoutUntil(now);
        await tx.shipmentShareLink.update({
          where: { id: link.id },
          data: { lockedUntil, failedAttempts: 0 },
        });
      }
    }

    await tx.shipmentShareAccess.create({
      data: {
        orgId: command.orgId,
        shareLinkId: link.id,
        shipmentId: link.shipmentId,
        email,
        ipHash: this.shareService.hashIp(ip),
        outcome: outcome ?? 'granted',
      },
    });

    emit(
      this.createEvent(command, {
        type: EVENT_TYPES.SHIPMENT_SHARE_LINK_ACCESSED,
        entityType: 'shipment',
        entityId: link.shipmentId,
        payload: {
          shareLinkId: link.id,
          shipmentId: link.shipmentId,
          outcome: outcome ?? 'granted',
        },
      })
    );

    return {
      granted: outcome === null,
      reason: outcome,
      shipmentId: link.shipmentId,
      sections: link.sections,
      linkExpiresAt: link.expiresAt,
      lockedUntil,
    };
  }
}
