import type {
  IReturnLabelProvider,
  GenerateLabelInput,
  GenerateLabelResult,
  SchedulePickupInput,
  SchedulePickupResult,
  CancelPickupInput,
} from '../IReturnLabelProvider';

/**
 * UPS return label provider. Uses UPS Shipping API with ReturnService codes
 * (Print Return Label, Electronic Return Label, Print and Mail). Pickup scheduling
 * uses UPS Pickup API.
 *
 * Requires OAuth 2.0 credentials from CarrierTrackingIntegration for UPS.
 */
export class UPSReturnLabelProvider implements IReturnLabelProvider {
  readonly name = 'ups';

  async generateLabel(_input: GenerateLabelInput): Promise<GenerateLabelResult> {
    throw new Error(
      'UPS return label generation not yet implemented. Configure the UPS Shipping API integration or fall back to the manual provider.',
    );
  }

  async schedulePickup(_input: SchedulePickupInput): Promise<SchedulePickupResult> {
    throw new Error(
      'UPS pickup scheduling not yet implemented. Configure the UPS Pickup API or fall back to the manual provider.',
    );
  }

  async cancelPickup(_input: CancelPickupInput): Promise<void> {
    throw new Error('UPS pickup cancellation not yet implemented.');
  }
}
