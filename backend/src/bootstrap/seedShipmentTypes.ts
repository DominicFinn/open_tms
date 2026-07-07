import { PrismaClient } from '@prisma/client';

/**
 * Seed the built-in shipment types on first startup. These are restriction
 * presets shown at the top of the Restrictions section on shipment creation —
 * picking one auto-fills the restriction fields below (still editable after).
 * Idempotent: existing built-in rows are updated in place by name so their
 * `defaults` stay in sync with the current Shipment restriction columns.
 * Admins can still create their own types on top (e.g. transport-mode types
 * like LTL) via the Shipment Types admin page — those are left alone here.
 */
const BUILT_IN_TYPES: Array<{
  name: string;
  icon: string;
  color: string;
  description: string;
  defaults: Record<string, unknown>;
}> = [
  {
    name: 'Standard',
    icon: 'local_shipping',
    color: '#6366F1',
    description: 'No restrictions.',
    defaults: {},
  },
  {
    name: 'Refrigerated',
    icon: 'ac_unit',
    color: '#3b82f6',
    description: 'Cold chain 2-8°C.',
    defaults: { tempControlled: true, tempMinC: 2, tempMaxC: 8 },
  },
  {
    name: 'Frozen',
    icon: 'severe_cold',
    color: '#06b6d4',
    description: 'Cold chain frozen, -25 to -18°C.',
    defaults: { tempControlled: true, tempMinC: -25, tempMaxC: -18 },
  },
  {
    name: 'Hazmat',
    icon: 'warning',
    color: '#ef4444',
    description: 'Hazardous materials.',
    defaults: { hazmat: true },
  },
];

export async function seedBuiltInShipmentTypes(prisma: PrismaClient): Promise<void> {
  for (const t of BUILT_IN_TYPES) {
    const existing = await prisma.shipmentType.findFirst({ where: { name: t.name } });
    if (existing) {
      if (existing.isBuiltIn) {
        await prisma.shipmentType.update({
          where: { id: existing.id },
          data: { icon: t.icon, color: t.color, description: t.description, defaults: t.defaults as any },
        });
      }
      continue;
    }
    await prisma.shipmentType.create({
      data: {
        name: t.name,
        icon: t.icon,
        color: t.color,
        description: t.description,
        defaults: t.defaults as any,
        requiredFields: [],
        isBuiltIn: true,
      },
    });
  }
}
