import { randomUUID } from 'crypto';
import type {
  IReturnLabelProvider,
  GenerateLabelInput,
  GenerateLabelResult,
  SchedulePickupInput,
  SchedulePickupResult,
  CancelPickupInput,
} from '../IReturnLabelProvider';

/**
 * Manual provider — used when no carrier API is configured. The admin supplies
 * the tracking number and pickup confirmation themselves; this provider just
 * wraps the manual data in the standard result shape and produces a minimal
 * placeholder label buffer. Real carrier integrations replace this.
 */
export class ManualReturnLabelProvider implements IReturnLabelProvider {
  readonly name = 'manual';

  async generateLabel(input: GenerateLabelInput): Promise<GenerateLabelResult> {
    const tracking = `MANUAL-${input.rmaNumber}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const placeholder = Buffer.from(
      `Manual return label\nRMA: ${input.rmaNumber}\nTracking: ${tracking}\nService: ${input.serviceLevel}\n` +
        `From: ${input.from.name}, ${input.from.address1}, ${input.from.city} ${input.from.postalCode} ${input.from.country}\n` +
        `To: ${input.to.name}, ${input.to.address1}, ${input.to.city} ${input.to.postalCode} ${input.to.country}\n`,
      'utf8',
    );
    return {
      trackingNumber: tracking,
      labelContent: placeholder,
      labelFormat: 'pdf',
      providerReference: 'manual',
    };
  }

  async schedulePickup(input: SchedulePickupInput): Promise<SchedulePickupResult> {
    return {
      confirmationNumber: `MANUAL-PU-${randomUUID().slice(0, 8).toUpperCase()}`,
      scheduledFor: input.pickupDate,
      window: input.pickupWindow,
    };
  }

  async cancelPickup(_input: CancelPickupInput): Promise<void> {
    return;
  }
}
