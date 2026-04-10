/**
 * Maps device model names from System Loco to SVG image paths.
 * Images are in /public/devices/{model}.svg
 *
 * The model field from the API can be things like "HGx", "HGR4", "E1BL", etc.
 * We try exact match first, then strip trailing letters/version for family match.
 */

const KNOWN_MODELS = new Set([
  'BLESecure', 'C2PL', 'E1BL', 'E4B', 'E4BL', 'E4P',
  'HFR4', 'HGC4', 'HGD4', 'HGP4', 'HGR4',
  'P4B', 'P4P', 'S14BL', 'T1B', 'U4B',
]);

// Family mappings: "HGx" → "HGR4", etc.
const FAMILY_MAP: Record<string, string> = {
  'HGx': 'HGR4',
  'HG': 'HGR4',
  'E1': 'E1BL',
  'E4': 'E4B',
  'P4': 'P4B',
  'S14': 'S14BL',
};

export function getDeviceImageUrl(model: string | null | undefined): string | null {
  if (!model) return null;

  const clean = model.trim();

  // Exact match
  if (KNOWN_MODELS.has(clean)) {
    return `/devices/${clean}.svg`;
  }

  // Case-insensitive exact match
  for (const known of KNOWN_MODELS) {
    if (known.toLowerCase() === clean.toLowerCase()) {
      return `/devices/${known}.svg`;
    }
  }

  // Family match
  if (FAMILY_MAP[clean]) {
    return `/devices/${FAMILY_MAP[clean]}.svg`;
  }

  // Prefix match — try progressively shorter prefixes
  for (let i = clean.length; i >= 2; i--) {
    const prefix = clean.substring(0, i);
    if (FAMILY_MAP[prefix]) {
      return `/devices/${FAMILY_MAP[prefix]}.svg`;
    }
    for (const known of KNOWN_MODELS) {
      if (known.startsWith(prefix)) {
        return `/devices/${known}.svg`;
      }
    }
  }

  return null;
}
