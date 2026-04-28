import { PrismaClient } from '@prisma/client';

/**
 * Seed the built-in shipment types on first startup. Idempotent: existing rows
 * with the same name are left alone. Admins can create their own types on top.
 */
const BUILT_IN_TYPES: Array<{
  name: string;
  icon: string;
  color: string;
  description: string;
  requiredFields: string[];
}> = [
  {
    name: 'Standard',
    icon: 'local_shipping',
    color: '#6366F1',
    description: 'Default template — customer, origin, destination required.',
    requiredFields: ['customerId', 'originId', 'destinationId'],
  },
  {
    name: 'Cold Chain',
    icon: 'ac_unit',
    color: '#0EA5E9',
    description: 'Temperature-controlled freight. Pickup window required to align with reefer scheduling.',
    requiredFields: ['customerId', 'originId', 'destinationId', 'pickupWindowStart', 'pickupWindowEnd'],
  },
  {
    name: 'Hazmat',
    icon: 'warning',
    color: '#F59E0B',
    description: 'Dangerous goods. PRO number and delivery window required for compliance.',
    requiredFields: ['customerId', 'originId', 'destinationId', 'proNumber', 'deliveryWindowStart', 'deliveryWindowEnd'],
  },
  {
    name: 'Parcel',
    icon: 'inventory_2',
    color: '#10B981',
    description: 'Small parcel / LTL. Delivery date required.',
    requiredFields: ['customerId', 'originId', 'destinationId', 'deliveryDate'],
  },
];

export async function seedBuiltInShipmentTypes(prisma: PrismaClient): Promise<void> {
  for (const t of BUILT_IN_TYPES) {
    const existing = await prisma.shipmentType.findFirst({ where: { name: t.name } });
    if (existing) continue;
    await prisma.shipmentType.create({
      data: {
        name: t.name,
        icon: t.icon,
        color: t.color,
        description: t.description,
        defaults: {},
        requiredFields: t.requiredFields,
        isBuiltIn: true,
      },
    });
  }
}
