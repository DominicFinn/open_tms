// Order.deliveryStatus: null (not moving yet), in_transit, delivered, exception
// — only ever set once status is 'assigned'.

export type DeliveryStatusVariant = 'success' | 'info' | 'destructive' | 'muted';

const DELIVERY_STATUS_LABEL: Record<string, string> = {
  in_transit: 'In transit',
  delivered: 'Delivered',
  exception: 'Exception',
};

export function deliveryStatusLabel(status?: string | null): string {
  if (!status) return 'Not moving yet';
  return DELIVERY_STATUS_LABEL[status] || status;
}

export function deliveryStatusVariant(status?: string | null): DeliveryStatusVariant {
  if (status === 'delivered') return 'success';
  if (status === 'in_transit') return 'info';
  if (status === 'exception') return 'destructive';
  return 'muted';
}
