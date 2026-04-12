/** Shared location-type metadata: icons, labels, and chip color variants */

export const LOCATION_TYPE_META: Record<string, { icon: string; label: string; chip: string }> = {
  warehouse:           { icon: 'warehouse',               label: 'Warehouse',           chip: 'vn-chip-primary' },
  distribution_centre: { icon: 'hub',                     label: 'Distribution Centre', chip: 'vn-chip-info' },
  cross_dock:          { icon: 'swap_horiz',              label: 'Cross Dock',          chip: 'vn-chip-warning' },
  terminal:            { icon: 'domain',                  label: 'Terminal',            chip: 'vn-chip-secondary' },
  port:                { icon: 'directions_boat',         label: 'Port',                chip: 'vn-chip-info' },
  rail_yard:           { icon: 'train',                   label: 'Rail Yard',           chip: 'vn-chip-secondary' },
  customer:            { icon: 'storefront',              label: 'Customer',            chip: 'vn-chip-success' },
  store:               { icon: 'store',                   label: 'Store',               chip: 'vn-chip-success' },
  manufacturing:       { icon: 'precision_manufacturing', label: 'Manufacturing',       chip: 'vn-chip-error' },
};

export function getLocationTypeMeta(type?: string | null) {
  if (!type) return null;
  return LOCATION_TYPE_META[type] ?? { icon: 'place', label: type, chip: 'vn-chip-secondary' };
}
