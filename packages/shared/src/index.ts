export type ID = string;

export type Timestamped = {
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

// Core TMS domain types (initial)
export interface Customer extends Timestamped {
  id: ID;
  name: string;
  contactEmail?: string;
}

export type LocationType =
  | 'warehouse'
  | 'distribution_centre'
  | 'cross_dock'
  | 'terminal'
  | 'port'
  | 'rail_yard'
  | 'customer'
  | 'store'
  | 'manufacturing';

export interface FacilityCapabilities {
  crossDockCapable?: boolean;
  hasColdStorage?: boolean;
  hasHazmatCert?: boolean;
  hasBondedStorage?: boolean;
  [key: string]: boolean | undefined;
}

export interface OperatingHoursEntry {
  open: string;   // e.g. "08:00"
  close: string;  // e.g. "17:00"
}

export interface Location {
  id: ID;
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  lat?: number;
  lng?: number;
  locationType?: LocationType;
  facilityCapabilities?: FacilityCapabilities;
  operatingHours?: Record<string, OperatingHoursEntry>;
  appointmentRequired?: boolean;
  dockCount?: number;
  maxTrailerLengthFt?: number;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export type ShipmentStatus =
  | "draft"
  | "planned"
  | "in_transit"
  | "delivered"
  | "cancelled";

export interface Shipment extends Timestamped {
  id: ID;
  reference: string; // customer ref / order number
  customerId: ID;
  laneId?: ID; // Optional lane reference
  originId: ID;
  destinationId: ID;
  pickupDate?: string; // ISO
  deliveryDate?: string; // ISO
  status: ShipmentStatus;
  items: Array<{ sku: string; description?: string; quantity: number; weightKg?: number; volumeM3?: number }>;
}

export interface Carrier extends Timestamped {
  id: ID;
  name: string;
  mcNumber?: string;
  dotNumber?: string;
}

export interface Vehicle extends Timestamped {
  id: ID;
  carrierId: ID;
  plate: string;
  type: "van" | "box_truck" | "semi" | "container";
  /** Capacity in whole kilograms (matches Prisma Int type) */
  capacityKg?: number;
  /** Capacity in whole cubic metres (matches Prisma Int type) */
  capacityM3?: number;
}

export interface Driver extends Timestamped {
  id: ID;
  carrierId: ID;
  name: string;
  phone?: string;
  email?: string;
}

export interface Load extends Timestamped {
  id: ID;
  shipmentId: ID;
  vehicleId?: ID;
  driverId?: ID;
  assignedAt?: string;
}

export interface ApiResponse<T> {
  data: T;
  error?: { message: string; code?: string } | null;
}

// Tender types
export type TenderStrategy = 'broadcast' | 'waterfall';
export type TenderStatus = 'draft' | 'open' | 'evaluating' | 'awarded' | 'cancelled' | 'expired';
export type TenderOfferStatus = 'pending' | 'sent' | 'viewed' | 'expired' | 'cancelled';
export type TenderBidStatus = 'submitted' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';
export type TenderBidSource = 'portal' | 'edi_990' | 'manual';

export interface Tender extends Timestamped {
  id: ID;
  shipmentId: ID;
  reference: string;
  strategy: TenderStrategy;
  status: TenderStatus;
  tenderDurationMinutes: number;
  targetRate?: number;
  currency: string;
  equipmentType?: string;
  notes?: string;
  specialInstructions?: string;
  openedAt?: string;
  closedAt?: string;
  awardedAt?: string;
  createdBy?: string;
}

export interface TenderOffer extends Timestamped {
  id: ID;
  tenderId: ID;
  carrierId: ID;
  sequence: number;
  status: TenderOfferStatus;
  sentAt?: string;
  expiresAt?: string;
  viewedAt?: string;
  ediSent: boolean;
}

export interface TenderBid extends Timestamped {
  id: ID;
  tenderId: ID;
  tenderOfferId: ID;
  carrierId: ID;
  rate: number;
  currency: string;
  transitDays?: number;
  equipmentType?: string;
  notes?: string;
  status: TenderBidStatus;
  submittedAt: string;
  respondedAt?: string;
  sourceType: TenderBidSource;
}

export interface CarrierUser {
  id: ID;
  carrierId: ID;
  email: string;
  name: string;
  role: string;
  active: boolean;
}
