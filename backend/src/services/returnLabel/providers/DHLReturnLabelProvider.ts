import type {
  IReturnLabelProvider,
  GenerateLabelInput,
  GenerateLabelResult,
  SchedulePickupInput,
  SchedulePickupResult,
  CancelPickupInput,
} from '../IReturnLabelProvider';

/**
 * DHL return label provider. Uses DHL Parcel UK / DHL Express MyDHL API for return
 * label generation and pickup booking. API key based auth via
 * CarrierTrackingIntegration for DHL.
 */
export class DHLReturnLabelProvider implements IReturnLabelProvider {
  readonly name = 'dhl';

  async generateLabel(_input: GenerateLabelInput): Promise<GenerateLabelResult> {
    throw new Error(
      'DHL return label generation not yet implemented. Configure the DHL MyDHL API integration or fall back to the manual provider.',
    );
  }

  async schedulePickup(_input: SchedulePickupInput): Promise<SchedulePickupResult> {
    throw new Error(
      'DHL pickup scheduling not yet implemented. Configure the DHL MyDHL API or fall back to the manual provider.',
    );
  }

  async cancelPickup(_input: CancelPickupInput): Promise<void> {
    throw new Error('DHL pickup cancellation not yet implemented.');
  }
}
