import type {
  IReturnLabelProvider,
  GenerateLabelInput,
  GenerateLabelResult,
  SchedulePickupInput,
  SchedulePickupResult,
  CancelPickupInput,
} from '../IReturnLabelProvider';

/**
 * FedEx return label provider. Uses FedEx Ship API with returnShipmentDetail to
 * produce a printable return shipping label. Pickup scheduling uses FedEx Pickup API.
 *
 * Wire up live credentials via CarrierTrackingIntegration for FedEx (OAuth 2.0).
 * Until real credentials are plumbed in, calls throw an explicit error rather
 * than silently succeeding with fake data.
 */
export class FedExReturnLabelProvider implements IReturnLabelProvider {
  readonly name = 'fedex';

  async generateLabel(_input: GenerateLabelInput): Promise<GenerateLabelResult> {
    throw new Error(
      'FedEx return label generation not yet implemented. Configure the FedEx Ship API integration or fall back to the manual provider.',
    );
  }

  async schedulePickup(_input: SchedulePickupInput): Promise<SchedulePickupResult> {
    throw new Error(
      'FedEx pickup scheduling not yet implemented. Configure the FedEx Pickup API or fall back to the manual provider.',
    );
  }

  async cancelPickup(_input: CancelPickupInput): Promise<void> {
    throw new Error('FedEx pickup cancellation not yet implemented.');
  }
}
