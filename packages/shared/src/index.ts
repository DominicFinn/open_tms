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
  capacityKg?: number;
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
