/**
 * RecordCalibrationCommand — records a new calibration entry for a device.
 *
 * Creates a calibration record with certificate details, method, and
 * optional link to the certificate document in storage.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface RecordCalibrationPayload {
  deviceId: string;
  calibratedAt: string;
  calibratedBy: string;
  certificateNumber?: string;
  expiresAt: string;
  calibrationMethod?: string;
  accuracy?: number;
  notes?: string;
  documentStorageKey?: string;
}

export const RECORD_CALIBRATION = 'device.record_calibration';

export class RecordCalibrationCommandHandler extends BaseCommandHandler<RecordCalibrationPayload, { id: string }> {
  readonly commandType = RECORD_CALIBRATION;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<RecordCalibrationPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { deviceId, calibratedAt, calibratedBy, certificateNumber, expiresAt, calibrationMethod, accuracy, notes, documentStorageKey } = command.payload;

    const device = await tx.device.findUniqueOrThrow({
      where: { id: deviceId },
      select: { id: true, name: true },
    });

    const calibration = await tx.deviceCalibration.create({
      data: {
        orgId: command.orgId,
        deviceId,
        calibratedAt: new Date(calibratedAt),
        calibratedBy,
        certificateNumber,
        expiresAt: new Date(expiresAt),
        calibrationMethod,
        accuracy,
        notes,
        documentStorageKey,
        createdBy: command.actorId,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.DEVICE_CALIBRATION_RECORDED,
      entityType: 'device',
      entityId: deviceId,
      payload: {
        deviceId,
        deviceName: device.name,
        calibratedBy,
        certificateNumber,
        expiresAt: new Date(expiresAt).toISOString(),
      },
    }));

    return { id: calibration.id };
  }
}
