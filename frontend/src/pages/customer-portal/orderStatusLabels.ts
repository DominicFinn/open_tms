// Customer-facing copy for Order.status / Order.deliveryStatus.
// Internal enum values (backend/prisma/schema/tms.prisma `Order.status` / `Order.deliveryStatus`)
// are ops jargon and shouldn't be shown to customers verbatim.

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  validated: 'Confirmed',
  location_error: 'Address needs review',
  converted: 'Processing',
  cancelled: 'Cancelled',
  archived: 'Archived',
};

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  unassigned: 'Awaiting carrier',
  assigned: 'Carrier assigned',
  in_transit: 'In transit',
  delivered: 'Delivered',
  exception: 'Delivery issue',
  cancelled: 'Cancelled',
};

export function orderStatusLabel(status: string | null | undefined): string {
  if (!status) return '-';
  return ORDER_STATUS_LABELS[status] || status;
}

export function deliveryStatusLabel(status: string | null | undefined): string {
  if (!status) return '-';
  return DELIVERY_STATUS_LABELS[status] || status;
}
