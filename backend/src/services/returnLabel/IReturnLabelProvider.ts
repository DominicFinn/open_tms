export interface ReturnLabelAddress {
  name: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface ReturnLabelParcel {
  weightKg: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  description?: string;
  declaredValueCents?: number;
}

export interface GenerateLabelInput {
  rmaId: string;
  rmaNumber: string;
  serviceLevel: string;
  from: ReturnLabelAddress;
  to: ReturnLabelAddress;
  parcels: ReturnLabelParcel[];
  carrierAccountNumber?: string;
  reference?: string;
}

export interface GenerateLabelResult {
  trackingNumber: string;
  labelContent: Buffer;
  labelFormat: 'pdf' | 'zpl' | 'png';
  providerReference?: string;
}

export interface SchedulePickupInput {
  rmaId: string;
  rmaNumber: string;
  trackingNumber: string;
  pickupDate: Date;
  pickupWindow?: string;
  address: ReturnLabelAddress;
  carrierAccountNumber?: string;
  notes?: string;
}

export interface SchedulePickupResult {
  confirmationNumber: string;
  scheduledFor: Date;
  window?: string;
}

export interface CancelPickupInput {
  confirmationNumber: string;
  carrierAccountNumber?: string;
  reason?: string;
}

export interface IReturnLabelProvider {
  readonly name: string;
  generateLabel(input: GenerateLabelInput): Promise<GenerateLabelResult>;
  schedulePickup(input: SchedulePickupInput): Promise<SchedulePickupResult>;
  cancelPickup(input: CancelPickupInput): Promise<void>;
}

export interface IReturnLabelProviderRegistry {
  get(providerName: string): IReturnLabelProvider;
  list(): string[];
}
