import {
  ArrowLeftRight,
  Building2,
  Factory,
  MapPin,
  Network,
  Ship,
  Store,
  Train,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info'
  | 'muted';

export interface LocationTypeMeta {
  icon: LucideIcon;
  label: string;
  variant: BadgeVariant;
}

/** Shared location-type metadata: icons (lucide components) and Badge variants. */
export const LOCATION_TYPE_META: Record<string, LocationTypeMeta> = {
  warehouse:           { icon: Warehouse,      label: 'Warehouse',           variant: 'default' },
  distribution_centre: { icon: Network,        label: 'Distribution Centre', variant: 'info' },
  cross_dock:          { icon: ArrowLeftRight, label: 'Cross Dock',          variant: 'warning' },
  terminal:            { icon: Building2,      label: 'Terminal',            variant: 'muted' },
  port:                { icon: Ship,           label: 'Port',                variant: 'info' },
  rail_yard:           { icon: Train,          label: 'Rail Yard',           variant: 'muted' },
  customer:            { icon: Store,          label: 'Customer',            variant: 'success' },
  store:               { icon: Store,          label: 'Store',               variant: 'success' },
  manufacturing:       { icon: Factory,        label: 'Manufacturing',       variant: 'destructive' },
};

const FALLBACK: LocationTypeMeta = { icon: MapPin, label: 'Location', variant: 'muted' };

export function getLocationTypeMeta(type?: string | null): LocationTypeMeta | null {
  if (!type) return null;
  return LOCATION_TYPE_META[type] ?? { ...FALLBACK, label: type };
}
