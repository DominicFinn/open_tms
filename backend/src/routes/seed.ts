import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { seedSystemRoles } from '../auth/seedRoles.js';

export async function seedRoutes(server: FastifyInstance) {
  // Block seed routes in production to prevent accidental data loss
  if (process.env.NODE_ENV === 'production') {
    server.post('/api/v1/seed/roles', async (_req: FastifyRequest, reply: FastifyReply) => {
      reply.code(403);
      return { data: null, error: 'Seed routes are disabled in production' };
    });
    server.post('/api/v1/seed', async (_req: FastifyRequest, reply: FastifyReply) => {
      reply.code(403);
      return { data: null, error: 'Seed routes are disabled in production' };
    });
    return;
  }

  // Seed system roles (idempotent - safe to call on every startup)
  server.post('/api/v1/seed/roles', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const result = await seedSystemRoles(server.prisma);
    return { data: result, error: null };
  });

  // Seed data endpoint
  server.post('/api/v1/seed', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Clear existing data in dependency order
      await server.prisma.orderShipment.deleteMany();
      await server.prisma.order.deleteMany();
      await server.prisma.shipment.deleteMany();
      await server.prisma.carrier.deleteMany();
      await server.prisma.location.deleteMany();
      await server.prisma.customer.deleteMany();

      const seedOrg = await server.prisma.organization.findFirst({ select: { id: true } });
      if (!seedOrg) {
        throw new Error('No Organization row exists — run migrations before seeding');
      }
      const seedOrgId = seedOrg.id;

      // ── Customers ─────────────────────────────────────────────────────────
      await server.prisma.customer.createMany({
        data: [
          { orgId: seedOrgId, name: 'Walmart Inc.', contactEmail: 'logistics@walmart.com' },
          { orgId: seedOrgId, name: 'Best Buy Co. Inc.', contactEmail: 'supply@bestbuy.com' },
          { orgId: seedOrgId, name: 'Target Corporation', contactEmail: 'operations@target.com' },
          { orgId: seedOrgId, name: 'Amazon.com Inc.', contactEmail: 'fulfillment@amazon.com' },
          { orgId: seedOrgId, name: 'Home Depot Inc.', contactEmail: 'distribution@homedepot.com' },
          { orgId: seedOrgId, name: "Lowe's Companies Inc.", contactEmail: 'logistics@lowes.com' },
          { orgId: seedOrgId, name: 'Costco Wholesale Corporation', contactEmail: 'supply@costco.com' },
          { orgId: seedOrgId, name: 'Kroger Company', contactEmail: 'distribution@kroger.com' },
          { orgId: seedOrgId, name: 'CVS Health Corporation', contactEmail: 'logistics@cvs.com' },
          { orgId: seedOrgId, name: 'Walgreens Boots Alliance', contactEmail: 'supply@walgreens.com' }
        ]
      });

      // ── Carriers ──────────────────────────────────────────────────────────
      await server.prisma.carrier.createMany({
        data: [
          {
            orgId: seedOrgId,
            name: 'J.B. Hunt Transport Services',
            mcNumber: 'MC-153771',
            dotNumber: '230058',
            contactName: 'Operations Desk',
            contactEmail: 'ops@jbhunt.com',
            contactPhone: '479-820-0000',
            city: 'Lowell',
            state: 'Arkansas',
            scacCode: 'JBHT',
            insuranceVerified: true,
            registrationChecked: true
          },
          {
            orgId: seedOrgId,
            name: 'Werner Enterprises',
            mcNumber: 'MC-149948',
            dotNumber: '104911',
            contactName: 'Dispatch',
            contactEmail: 'dispatch@werner.com',
            contactPhone: '402-895-6640',
            city: 'Omaha',
            state: 'Nebraska',
            scacCode: 'WERN',
            insuranceVerified: true,
            registrationChecked: true
          },
          {
            orgId: seedOrgId,
            name: 'XPO Logistics',
            mcNumber: 'MC-755544',
            dotNumber: '722325',
            contactName: 'Freight Ops',
            contactEmail: 'freight@xpo.com',
            contactPhone: '855-976-6951',
            city: 'Greenwich',
            state: 'Connecticut',
            scacCode: 'XPOL',
            insuranceVerified: true,
            registrationChecked: true
          },
          {
            orgId: seedOrgId,
            name: 'Old Dominion Freight Line',
            mcNumber: 'MC-29592',
            dotNumber: '76569',
            contactName: 'LTL Desk',
            contactEmail: 'ltl@odfl.com',
            contactPhone: '336-889-5000',
            city: 'Thomasville',
            state: 'North Carolina',
            scacCode: 'ODFL',
            insuranceVerified: true,
            registrationChecked: true
          },
          {
            orgId: seedOrgId,
            name: 'Swift Transportation',
            mcNumber: 'MC-107229',
            dotNumber: '145231',
            contactName: 'Driver Services',
            contactEmail: 'driverservices@swifttrans.com',
            contactPhone: '602-269-9700',
            city: 'Phoenix',
            state: 'Arizona',
            scacCode: 'SWFT',
            insuranceVerified: true,
            registrationChecked: true
          }
        ]
      });

      // ── Locations ─────────────────────────────────────────────────────────
      const seedLocationRows = [
        { name: 'Head Office - Dallas', address1: '1234 Commerce Street', city: 'Dallas', state: 'Texas', postalCode: '75201', country: 'USA', lat: 32.7767, lng: -96.7970 },
        { name: 'Central Distribution Center - Chicago', address1: '5000 W 159th St', city: 'Chicago', state: 'Illinois', postalCode: '60477', country: 'USA', lat: 41.8781, lng: -87.6298 },
        { name: 'West Coast Hub - Los Angeles', address1: '12000 E 40th St', city: 'Los Angeles', state: 'California', postalCode: '90058', country: 'USA', lat: 34.0522, lng: -118.2437 },
        { name: 'Northeast Distribution - New York', address1: '1000 6th Ave', city: 'New York', state: 'New York', postalCode: '10018', country: 'USA', lat: 40.7128, lng: -74.0060 },
        { name: 'Southeast Warehouse - Atlanta', address1: '2000 Peachtree Rd', city: 'Atlanta', state: 'Georgia', postalCode: '30309', country: 'USA', lat: 33.7490, lng: -84.3880 },
        { name: 'Midwest Logistics Center - Kansas City', address1: '3000 Main St', city: 'Kansas City', state: 'Missouri', postalCode: '64111', country: 'USA', lat: 39.0997, lng: -94.5786 },
        { name: 'Southwest Distribution - Phoenix', address1: '4000 N Central Ave', city: 'Phoenix', state: 'Arizona', postalCode: '85012', country: 'USA', lat: 33.4484, lng: -112.0740 },
        { name: 'Phoenix DC - Distribution Center', address1: '2500 W Buckeye Rd', city: 'Phoenix', state: 'Arizona', postalCode: '85009', country: 'USA', lat: 33.4200, lng: -112.1050 },
        { name: 'Northwest Hub - Seattle', address1: '5000 1st Ave S', city: 'Seattle', state: 'Washington', postalCode: '98134', country: 'USA', lat: 47.6062, lng: -122.3321 },
        { name: 'Rocky Mountain Distribution - Denver', address1: '6000 E Colfax Ave', city: 'Denver', state: 'Colorado', postalCode: '80220', country: 'USA', lat: 39.7392, lng: -104.9903 },
        { name: 'Gulf Coast Warehouse - Houston', address1: '7000 Main St', city: 'Houston', state: 'Texas', postalCode: '77002', country: 'USA', lat: 29.7604, lng: -95.3698 },
        { name: 'Great Lakes Distribution - Detroit', address1: '8000 Woodward Ave', city: 'Detroit', state: 'Michigan', postalCode: '48201', country: 'USA', lat: 42.3314, lng: -83.0458 },
        { name: 'Pacific Northwest Hub - Portland', address1: '9000 SW 5th Ave', city: 'Portland', state: 'Oregon', postalCode: '97204', country: 'USA', lat: 45.5152, lng: -122.6784 },
        { name: 'Walmart Supercenter - Portland', address1: '4200 SE 82nd Ave', city: 'Portland', state: 'Oregon', postalCode: '97266', country: 'USA', lat: 45.4960, lng: -122.5830 },
        { name: 'Southeast Logistics - Miami', address1: '10000 Biscayne Blvd', city: 'Miami', state: 'Florida', postalCode: '33132', country: 'USA', lat: 25.7617, lng: -80.1918 },
        { name: 'Central Plains Distribution - Omaha', address1: '11000 Dodge St', city: 'Omaha', state: 'Nebraska', postalCode: '68102', country: 'USA', lat: 41.2565, lng: -95.9345 },
        { name: 'Desert Southwest Hub - Las Vegas', address1: '12000 Las Vegas Blvd', city: 'Las Vegas', state: 'Nevada', postalCode: '89101', country: 'USA', lat: 36.1699, lng: -115.1398 },
        { name: 'Appalachian Distribution - Nashville', address1: '13000 Broadway', city: 'Nashville', state: 'Tennessee', postalCode: '37203', country: 'USA', lat: 36.1627, lng: -86.7816 },
        { name: 'Great Plains Logistics - Oklahoma City', address1: '14000 N Lincoln Blvd', city: 'Oklahoma City', state: 'Oklahoma', postalCode: '73105', country: 'USA', lat: 35.4676, lng: -97.5164 },
        { name: 'Mountain West Distribution - Salt Lake City', address1: '15000 S State St', city: 'Salt Lake City', state: 'Utah', postalCode: '84115', country: 'USA', lat: 40.7608, lng: -111.8910 },
        { name: 'Upper Midwest Hub - Minneapolis', address1: '16000 Nicollet Mall', city: 'Minneapolis', state: 'Minnesota', postalCode: '55403', country: 'USA', lat: 44.9778, lng: -93.2650 },
        { name: 'New England Distribution - Boston', address1: '17000 Boylston St', city: 'Boston', state: 'Massachusetts', postalCode: '02115', country: 'USA', lat: 42.3398, lng: -71.0882 },
        { name: 'Mid-Atlantic Logistics - Philadelphia', address1: '18000 Market St', city: 'Philadelphia', state: 'Pennsylvania', postalCode: '19107', country: 'USA', lat: 39.9526, lng: -75.1652 },
        { name: 'Deep South Distribution - New Orleans', address1: '19000 Canal St', city: 'New Orleans', state: 'Louisiana', postalCode: '70112', country: 'USA', lat: 29.9511, lng: -90.0715 },
        { name: 'Walmart Supercenter - Dallas', address1: '4000 E Mockingbird Ln', city: 'Dallas', state: 'Texas', postalCode: '75206', country: 'USA', lat: 32.8300, lng: -96.7800 },
        { name: 'Walmart Supercenter - Chicago', address1: '4650 W North Ave', city: 'Chicago', state: 'Illinois', postalCode: '60639', country: 'USA', lat: 41.9100, lng: -87.7400 },
        { name: 'Walmart Supercenter - Houston', address1: '11111 Katy Fwy', city: 'Houston', state: 'Texas', postalCode: '77079', country: 'USA', lat: 29.7760, lng: -95.5600 },
        { name: 'Best Buy - Atlanta', address1: '3500 Peachtree Rd NE', city: 'Atlanta', state: 'Georgia', postalCode: '30326', country: 'USA', lat: 33.8490, lng: -84.3630 },
        { name: 'Best Buy - Seattle', address1: '2800 SW Barton St', city: 'Seattle', state: 'Washington', postalCode: '98126', country: 'USA', lat: 47.5440, lng: -122.3700 },
        { name: 'Best Buy - Denver', address1: '7800 E Hampden Ave', city: 'Denver', state: 'Colorado', postalCode: '80231', country: 'USA', lat: 39.6520, lng: -104.8940 },
        { name: 'Target - Minneapolis', address1: '900 Nicollet Mall', city: 'Minneapolis', state: 'Minnesota', postalCode: '55402', country: 'USA', lat: 44.9750, lng: -93.2720 },
        { name: 'Amazon FC - Nashville', address1: '500 Duke Dr', city: 'Nashville', state: 'Tennessee', postalCode: '37207', country: 'USA', lat: 36.2130, lng: -86.7300 },
        { name: 'Home Depot DC - Atlanta', address1: '2455 Paces Ferry Rd NW', city: 'Atlanta', state: 'Georgia', postalCode: '30339', country: 'USA', lat: 33.8690, lng: -84.4640 },
        { name: "Lowe's DC - Charlotte", address1: '1000 Lowes Blvd', city: 'Charlotte', state: 'North Carolina', postalCode: '28103', country: 'USA', lat: 35.2271, lng: -80.8431 },
        { name: 'Costco DC - Seattle', address1: '999 Lake Dr', city: 'Issaquah', state: 'Washington', postalCode: '98027', country: 'USA', lat: 47.5301, lng: -122.0326 },
        { name: 'Kroger DC - Cincinnati', address1: '1014 Vine St', city: 'Cincinnati', state: 'Ohio', postalCode: '45202', country: 'USA', lat: 39.1031, lng: -84.5120 },
        { name: 'CVS DC - Rhode Island', address1: '1 CVS Dr', city: 'Woonsocket', state: 'Rhode Island', postalCode: '02895', country: 'USA', lat: 41.9990, lng: -71.5148 },
        { name: 'Walgreens DC - Chicago', address1: '200 Wilmot Rd', city: 'Deerfield', state: 'Illinois', postalCode: '60015', country: 'USA', lat: 42.1730, lng: -87.8370 },
        { name: 'Port of Los Angeles - Logistics Hub', address1: '425 S Palos Verdes St', city: 'San Pedro', state: 'California', postalCode: '90731', country: 'USA', lat: 33.7360, lng: -118.2650 },
        { name: 'San Antonio Distribution Center', address1: '5555 De Zavala Rd', city: 'San Antonio', state: 'Texas', postalCode: '78249', country: 'USA', lat: 29.5597, lng: -98.6160 }
      ];

      await server.prisma.location.createMany({
        data: seedLocationRows.map(r => ({ ...r, orgId: seedOrgId })),
      });

      const allLocations = await server.prisma.location.findMany();
      const allCustomers = await server.prisma.customer.findMany();
      const allCarriers = await server.prisma.carrier.findMany();

      const loc = (name: string) => allLocations.find((l: any) => l.name === name)!;
      const cust = (name: string) => allCustomers.find((c: any) => c.name === name)!;
      const carrier = (name: string) => allCarriers.find((c: any) => c.name === name)!;

      // ── Lanes ─────────────────────────────────────────────────────────────
      const laneDefinitions = [
        { from: 'Central Distribution Center - Chicago', to: 'Northeast Distribution - New York', distance: 790 },
        { from: 'Head Office - Dallas', to: 'Gulf Coast Warehouse - Houston', distance: 240 },
        { from: 'West Coast Hub - Los Angeles', to: 'Northwest Hub - Seattle', distance: 1140 },
        { from: 'Southeast Warehouse - Atlanta', to: 'Southeast Logistics - Miami', distance: 660 },
        { from: 'Phoenix DC - Distribution Center', to: 'Walmart Supercenter - Portland', distance: 1140 },
        { from: 'Rocky Mountain Distribution - Denver', to: 'Upper Midwest Hub - Minneapolis', distance: 920 },
        { from: 'New England Distribution - Boston', to: 'Mid-Atlantic Logistics - Philadelphia', distance: 310 },
        { from: 'Midwest Logistics Center - Kansas City', to: 'Central Distribution Center - Chicago', distance: 510 },
        { from: 'Deep South Distribution - New Orleans', to: 'Southeast Warehouse - Atlanta', distance: 470 },
        { from: 'Great Lakes Distribution - Detroit', to: 'Central Distribution Center - Chicago', distance: 280 },
        { from: 'Gulf Coast Warehouse - Houston', to: 'Deep South Distribution - New Orleans', distance: 350 },
        { from: 'Northwest Hub - Seattle', to: 'Rocky Mountain Distribution - Denver', distance: 1310 },
        { from: 'Great Plains Logistics - Oklahoma City', to: 'Head Office - Dallas', distance: 200 },
        { from: 'Mountain West Distribution - Salt Lake City', to: 'Rocky Mountain Distribution - Denver', distance: 520 },
        { from: 'Desert Southwest Hub - Las Vegas', to: 'West Coast Hub - Los Angeles', distance: 270 },
      ];

      if (laneDefinitions.length > 0) {
        await server.prisma.lane.createMany({
          data: laneDefinitions.map(l => ({
            orgId: seedOrgId,
            name: `${l.from.split(' - ').pop()} → ${l.to.split(' - ').pop() || l.to}`,
            originId: loc(l.from).id,
            destinationId: loc(l.to).id,
            distance: l.distance,
          }))
        });
      }

      // ── Shipments ─────────────────────────────────────────────────────────
      // Valid lifecycle statuses: draft | ready | in_progress | complete
      const now = new Date('2026-07-01T00:00:00Z');
      const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
      const daysAhead = (n: number) => new Date(now.getTime() + n * 86400000);

      const shipmentData = [
        // 1. FTL standard — draft, just created, not yet assigned
        {
          orgId: seedOrgId,
          reference: 'SH-2026-001',
          status: 'draft',
          customerId: cust('Walmart Inc.').id,
          originId: loc('Central Distribution Center - Chicago').id,
          destinationId: loc('Northeast Distribution - New York').id,
          carrierId: carrier('J.B. Hunt Transport Services').id,
          pickupDate: daysAhead(3),
          deliveryDate: daysAhead(5),
          items: [
            { sku: 'WAL-GEN-001', description: 'General Merchandise - Mixed Pallets', quantity: 24, weightKg: 14400, volumeM3: 72 }
          ]
        },
        // 2. FTL refrigerated — ready to dispatch, crew assigned
        {
          orgId: seedOrgId,
          reference: 'SH-2026-002',
          status: 'ready',
          customerId: cust('Kroger Company').id,
          originId: loc('Kroger DC - Cincinnati').id,
          destinationId: loc('Central Distribution Center - Chicago').id,
          carrierId: carrier('Werner Enterprises').id,
          pickupDate: daysAhead(1),
          deliveryDate: daysAhead(2),
          pickupWindowStart: new Date('2026-07-02T06:00:00Z'),
          pickupWindowEnd: new Date('2026-07-02T10:00:00Z'),
          deliveryWindowStart: new Date('2026-07-03T08:00:00Z'),
          deliveryWindowEnd: new Date('2026-07-03T14:00:00Z'),
          proNumber: 'PRO-2026-11842',
          items: [
            { sku: 'KRO-DAIRY-001', description: 'Refrigerated Dairy - Milk, Cheese, Yogurt', quantity: 480, weightKg: 9600, volumeM3: 38 },
            { sku: 'KRO-PRODUCE-001', description: 'Fresh Produce - Leafy Greens', quantity: 200, weightKg: 2000, volumeM3: 14 }
          ]
        },
        // 3. FTL standard — in progress, cross-country haul
        {
          orgId: seedOrgId,
          reference: 'SH-2026-003',
          status: 'in_progress',
          customerId: cust('Best Buy Co. Inc.').id,
          originId: loc('West Coast Hub - Los Angeles').id,
          destinationId: loc('Northwest Hub - Seattle').id,
          carrierId: carrier('J.B. Hunt Transport Services').id,
          pickupDate: daysAgo(1),
          deliveryDate: daysAhead(1),
          proNumber: 'PRO-2026-29341',
          trackingNumber: 'JBHT0029341TX',
          items: [
            { sku: 'BBY-TV-001', description: 'Consumer Electronics - Large TVs (65"+)', quantity: 60, weightKg: 4200, volumeM3: 48 },
            { sku: 'BBY-AUDIO-001', description: 'Home Audio Systems', quantity: 40, weightKg: 1800, volumeM3: 16 }
          ]
        },
        // 4. FTL standard — in progress with exception (delay)
        {
          orgId: seedOrgId,
          reference: 'SH-2026-004',
          status: 'in_progress',
          hasException: true,
          customerId: cust('Target Corporation').id,
          originId: loc('Southeast Warehouse - Atlanta').id,
          destinationId: loc('Southeast Logistics - Miami').id,
          carrierId: carrier('Swift Transportation').id,
          pickupDate: daysAgo(2),
          deliveryDate: daysAgo(1),
          proNumber: 'PRO-2026-44102',
          trackingNumber: 'SWFT0044102FL',
          items: [
            { sku: 'TGT-APPAREL-001', description: 'Seasonal Apparel - Summer Collection', quantity: 1200, weightKg: 3600, volumeM3: 62 }
          ]
        },
        // 5. FTL complete — delivered on time
        {
          orgId: seedOrgId,
          reference: 'SH-2026-005',
          status: 'complete',
          customerId: cust('Amazon.com Inc.').id,
          originId: loc('Head Office - Dallas').id,
          destinationId: loc('Amazon FC - Nashville').id,
          carrierId: carrier('Werner Enterprises').id,
          pickupDate: daysAgo(5),
          deliveryDate: daysAgo(3),
          proNumber: 'PRO-2026-55001',
          trackingNumber: 'WERN0055001TN',
          items: [
            { sku: 'AMZ-FURN-001', description: 'Flat-Pack Furniture - Bookshelves, Desks', quantity: 300, weightKg: 12000, volumeM3: 90 }
          ]
        },
        // 6. LTL — draft, small parcel consolidation
        {
          orgId: seedOrgId,
          reference: 'SH-2026-006',
          status: 'draft',
          customerId: cust('CVS Health Corporation').id,
          originId: loc('CVS DC - Rhode Island').id,
          destinationId: loc('New England Distribution - Boston').id,
          carrierId: carrier('Old Dominion Freight Line').id,
          pickupDate: daysAhead(2),
          deliveryDate: daysAhead(3),
          items: [
            { sku: 'CVS-HEALTH-001', description: 'OTC Health Products - Vitamins and Supplements', quantity: 600, weightKg: 1200, volumeM3: 8 },
            { sku: 'CVS-BEAUTY-001', description: 'Beauty and Personal Care', quantity: 400, weightKg: 600, volumeM3: 5 }
          ]
        },
        // 7. FTL hazmat — in progress
        {
          orgId: seedOrgId,
          reference: 'SH-2026-007',
          status: 'in_progress',
          customerId: cust('Home Depot Inc.').id,
          originId: loc('Home Depot DC - Atlanta').id,
          destinationId: loc('Gulf Coast Warehouse - Houston').id,
          carrierId: carrier('Swift Transportation').id,
          pickupDate: daysAgo(1),
          deliveryDate: daysAhead(1),
          proNumber: 'PRO-2026-70087',
          trackingNumber: 'SWFT0070087TX',
          items: [
            { sku: 'HD-CHEM-001', description: 'Cleaning Chemicals - Industrial Grade (Class 8)', quantity: 200, weightKg: 4000, volumeM3: 20, hazmat: true, unNumber: 'UN1760' },
            { sku: 'HD-PAINT-001', description: 'Paints and Coatings (Class 3)', quantity: 150, weightKg: 2250, volumeM3: 15, hazmat: true, unNumber: 'UN1263' }
          ]
        },
        // 8. Refrigerated cold chain — ready, pharma delivery
        {
          orgId: seedOrgId,
          reference: 'SH-2026-008',
          status: 'ready',
          customerId: cust('Walgreens Boots Alliance').id,
          originId: loc('Walgreens DC - Chicago').id,
          destinationId: loc('Mountain West Distribution - Salt Lake City').id,
          carrierId: carrier('XPO Logistics').id,
          pickupDate: daysAhead(1),
          deliveryDate: daysAhead(3),
          pickupWindowStart: new Date('2026-07-02T05:00:00Z'),
          pickupWindowEnd: new Date('2026-07-02T08:00:00Z'),
          proNumber: 'PRO-2026-80234',
          items: [
            { sku: 'WAG-PHARMA-001', description: 'Pharmaceutical Products - Refrigerated (2-8°C)', quantity: 1000, weightKg: 500, volumeM3: 4 },
            { sku: 'WAG-VACCINE-001', description: 'Vaccine Shipment - Cold Chain Required', quantity: 250, weightKg: 125, volumeM3: 1 }
          ]
        },
        // 9. FTL complete — building materials, oversize
        {
          orgId: seedOrgId,
          reference: 'SH-2026-009',
          status: 'complete',
          customerId: cust("Lowe's Companies Inc.").id,
          originId: loc("Lowe's DC - Charlotte").id,
          destinationId: loc('Deep South Distribution - New Orleans').id,
          carrierId: carrier('XPO Logistics').id,
          pickupDate: daysAgo(6),
          deliveryDate: daysAgo(4),
          proNumber: 'PRO-2026-90812',
          trackingNumber: 'XPOL0090812LA',
          items: [
            { sku: 'LOW-LUMBER-001', description: 'Dimensional Lumber - 2x4 and 2x6 Bundles', quantity: 50, weightKg: 15000, volumeM3: 82 },
            { sku: 'LOW-DRYWALL-001', description: 'Drywall Sheets - 4x8', quantity: 200, weightKg: 8000, volumeM3: 28 }
          ]
        },
        // 10. FTL standard — in progress, long haul west to east
        {
          orgId: seedOrgId,
          reference: 'SH-2026-010',
          status: 'in_progress',
          customerId: cust('Costco Wholesale Corporation').id,
          originId: loc('Costco DC - Seattle').id,
          destinationId: loc('Rocky Mountain Distribution - Denver').id,
          carrierId: carrier('J.B. Hunt Transport Services').id,
          pickupDate: daysAgo(2),
          deliveryDate: daysAhead(1),
          proNumber: 'PRO-2026-10042',
          trackingNumber: 'JBHT0010042CO',
          items: [
            { sku: 'CST-FOOD-001', description: 'Kirkland Signature Bulk Food - Dry Goods', quantity: 800, weightKg: 18000, volumeM3: 95 }
          ]
        },
        // 11. LTL — draft, multi-item retail replenishment
        {
          orgId: seedOrgId,
          reference: 'SH-2026-011',
          status: 'draft',
          customerId: cust('Walmart Inc.').id,
          originId: loc('Midwest Logistics Center - Kansas City').id,
          destinationId: loc('Upper Midwest Hub - Minneapolis').id,
          carrierId: carrier('Old Dominion Freight Line').id,
          pickupDate: daysAhead(4),
          deliveryDate: daysAhead(6),
          items: [
            { sku: 'WAL-HBA-001', description: 'Health and Beauty - Shampoo, Conditioner', quantity: 720, weightKg: 1440, volumeM3: 12 },
            { sku: 'WAL-CLEAN-001', description: 'Cleaning Supplies - Laundry Detergent', quantity: 360, weightKg: 2880, volumeM3: 18 },
            { sku: 'WAL-PAPER-001', description: 'Paper Goods - Toilet Paper, Paper Towels', quantity: 200, weightKg: 2000, volumeM3: 40 }
          ]
        },
        // 12. FTL complete — electronics, high-value
        {
          orgId: seedOrgId,
          reference: 'SH-2026-012',
          status: 'complete',
          customerId: cust('Amazon.com Inc.').id,
          originId: loc('West Coast Hub - Los Angeles').id,
          destinationId: loc('Central Distribution Center - Chicago').id,
          carrierId: carrier('Werner Enterprises').id,
          pickupDate: daysAgo(8),
          deliveryDate: daysAgo(5),
          proNumber: 'PRO-2026-12009',
          trackingNumber: 'WERN0012009IL',
          items: [
            { sku: 'AMZ-LAPTOP-001', description: 'Laptops and Tablets - High Value Electronics', quantity: 200, weightKg: 600, volumeM3: 8 },
            { sku: 'AMZ-PHONE-001', description: 'Smartphones - Sealed Retail Packaging', quantity: 500, weightKg: 250, volumeM3: 3 }
          ]
        },
        // 13. LTL — in progress, pharmaceutical replenishment
        {
          orgId: seedOrgId,
          reference: 'SH-2026-013',
          status: 'in_progress',
          customerId: cust('CVS Health Corporation').id,
          originId: loc('Mid-Atlantic Logistics - Philadelphia').id,
          destinationId: loc('New England Distribution - Boston').id,
          carrierId: carrier('Old Dominion Freight Line').id,
          pickupDate: daysAgo(1),
          deliveryDate: daysAhead(1),
          proNumber: 'PRO-2026-13501',
          trackingNumber: 'ODFL0013501MA',
          items: [
            { sku: 'CVS-RX-001', description: 'Prescription Drug Refills - Controlled Packaging', quantity: 5000, weightKg: 750, volumeM3: 5 }
          ]
        },
        // 14. Frozen cold chain — ready, food distribution
        {
          orgId: seedOrgId,
          reference: 'SH-2026-014',
          status: 'ready',
          customerId: cust('Kroger Company').id,
          originId: loc('Midwest Logistics Center - Kansas City').id,
          destinationId: loc('Great Plains Logistics - Oklahoma City').id,
          carrierId: carrier('XPO Logistics').id,
          pickupDate: daysAhead(1),
          deliveryDate: daysAhead(2),
          pickupWindowStart: new Date('2026-07-02T04:00:00Z'),
          pickupWindowEnd: new Date('2026-07-02T07:00:00Z'),
          deliveryWindowStart: new Date('2026-07-03T06:00:00Z'),
          deliveryWindowEnd: new Date('2026-07-03T10:00:00Z'),
          proNumber: 'PRO-2026-14800',
          items: [
            { sku: 'KRO-FROZEN-001', description: 'Frozen Meats - Beef, Pork, Poultry (-18°C)', quantity: 600, weightKg: 15000, volumeM3: 55 },
            { sku: 'KRO-ICECREAM-001', description: 'Ice Cream and Frozen Desserts (-20°C)', quantity: 200, weightKg: 2400, volumeM3: 18 }
          ]
        },
        // 15. FTL standard — in progress, Texas Triangle leg
        {
          orgId: seedOrgId,
          reference: 'SH-2026-015',
          status: 'in_progress',
          customerId: cust('Walmart Inc.').id,
          originId: loc('San Antonio Distribution Center').id,
          destinationId: loc('Head Office - Dallas').id,
          carrierId: carrier('Swift Transportation').id,
          pickupDate: daysAgo(1),
          deliveryDate: daysAhead(1),
          proNumber: 'PRO-2026-15350',
          trackingNumber: 'SWFT0015350TX',
          items: [
            { sku: 'WAL-TOYS-001', description: 'Toys and Games - Holiday Pre-stock', quantity: 960, weightKg: 4800, volumeM3: 64 }
          ]
        },
        // 16. FTL complete — completed with no issues
        {
          orgId: seedOrgId,
          reference: 'SH-2026-016',
          status: 'complete',
          customerId: cust('Target Corporation').id,
          originId: loc('Target - Minneapolis').id,
          destinationId: loc('Upper Midwest Hub - Minneapolis').id,
          carrierId: carrier('Werner Enterprises').id,
          pickupDate: daysAgo(4),
          deliveryDate: daysAgo(3),
          proNumber: 'PRO-2026-16020',
          trackingNumber: 'WERN0016020MN',
          items: [
            { sku: 'TGT-HOME-001', description: 'Home Decor - Seasonal Refresh Items', quantity: 400, weightKg: 2800, volumeM3: 36 }
          ]
        },
        // 17. LTL draft — auto parts, heavy freight
        {
          orgId: seedOrgId,
          reference: 'SH-2026-017',
          status: 'draft',
          customerId: cust('Home Depot Inc.').id,
          originId: loc('Great Lakes Distribution - Detroit').id,
          destinationId: loc('Central Distribution Center - Chicago').id,
          carrierId: carrier('Old Dominion Freight Line').id,
          pickupDate: daysAhead(5),
          deliveryDate: daysAhead(7),
          items: [
            { sku: 'HD-TOOLS-001', description: 'Power Tools - Drills, Saws, Sanders', quantity: 300, weightKg: 3600, volumeM3: 24 },
            { sku: 'HD-FASTENER-001', description: 'Fasteners and Hardware - Bulk Containers', quantity: 100, weightKg: 5000, volumeM3: 12 }
          ]
        },
        // 18. FTL in progress — cross-desert Southwest run
        {
          orgId: seedOrgId,
          reference: 'SH-2026-018',
          status: 'in_progress',
          customerId: cust('Walgreens Boots Alliance').id,
          originId: loc('Desert Southwest Hub - Las Vegas').id,
          destinationId: loc('West Coast Hub - Los Angeles').id,
          carrierId: carrier('Swift Transportation').id,
          pickupDate: daysAgo(1),
          deliveryDate: daysAhead(1),
          proNumber: 'PRO-2026-18740',
          trackingNumber: 'SWFT0018740CA',
          items: [
            { sku: 'WAG-BEAUTY-001', description: 'Beauty Products - Cosmetics and Skincare', quantity: 800, weightKg: 1600, volumeM3: 16 }
          ]
        },
        // 19. FTL complete — food grade, Southeast corridor
        {
          orgId: seedOrgId,
          reference: 'SH-2026-019',
          status: 'complete',
          customerId: cust("Lowe's Companies Inc.").id,
          originId: loc('Great Plains Logistics - Oklahoma City').id,
          destinationId: loc('Midwest Logistics Center - Kansas City').id,
          carrierId: carrier('XPO Logistics').id,
          pickupDate: daysAgo(7),
          deliveryDate: daysAgo(6),
          proNumber: 'PRO-2026-19003',
          trackingNumber: 'XPOL0019003MO',
          items: [
            { sku: 'LOW-GARDEN-001', description: 'Garden Supplies - Mulch, Soil, Fertilizer', quantity: 400, weightKg: 20000, volumeM3: 60 }
          ]
        },
        // 20. LTL in progress with exception — damaged goods reported
        {
          orgId: seedOrgId,
          reference: 'SH-2026-020',
          status: 'in_progress',
          hasException: true,
          customerId: cust('Costco Wholesale Corporation').id,
          originId: loc('Deep South Distribution - New Orleans').id,
          destinationId: loc('Southeast Warehouse - Atlanta').id,
          carrierId: carrier('Old Dominion Freight Line').id,
          pickupDate: daysAgo(2),
          deliveryDate: daysAhead(1),
          proNumber: 'PRO-2026-20500',
          trackingNumber: 'ODFL0020500GA',
          items: [
            { sku: 'CST-WINE-001', description: 'Wine and Spirits - Mixed Case Pallets', quantity: 120, weightKg: 2160, volumeM3: 18 },
            { sku: 'CST-OLIVE-001', description: 'Kirkland Olive Oil - Bulk Cases', quantity: 300, weightKg: 3600, volumeM3: 15 }
          ]
        }
      ];

      await server.prisma.shipment.createMany({ data: shipmentData });

      // ── Orders ────────────────────────────────────────────────────────────
      const allShipments = await server.prisma.shipment.findMany();
      const sh = (ref: string) => allShipments.find((s: any) => s.reference === ref)!;

      const orderData = [
        // 1. Pending order — just submitted, waiting for validation
        {
          orgId: seedOrgId,
          orderNumber: 'ORD-2026-0001',
          poNumber: 'PO-WAL-88231',
          status: 'pending',
          importSource: 'manual',
          customerId: cust('Walmart Inc.').id,
          originId: loc('Central Distribution Center - Chicago').id,
          destinationId: loc('Walmart Supercenter - Chicago').id,
          originValidated: true,
          destinationValidated: true,
          orderDate: daysAgo(1),
          requestedPickupDate: daysAhead(2),
          requestedDeliveryDate: daysAhead(3),
          serviceLevel: 'LTL',
          temperatureControl: 'ambient',
          requiresHazmat: false,
          deliveryStatus: 'unassigned',
          specialInstructions: 'Driver must check in at gate 3. Appointment required.',
          notes: 'Q3 replenishment order for Chicago stores.'
        },
        // 2. Validated order — ready to convert to shipment
        {
          orgId: seedOrgId,
          orderNumber: 'ORD-2026-0002',
          poNumber: 'PO-KRO-44180',
          status: 'validated',
          importSource: 'edi',
          customerId: cust('Kroger Company').id,
          originId: loc('Kroger DC - Cincinnati').id,
          destinationId: loc('Central Distribution Center - Chicago').id,
          originValidated: true,
          destinationValidated: true,
          orderDate: daysAgo(2),
          requestedPickupDate: daysAhead(1),
          requestedDeliveryDate: daysAhead(2),
          serviceLevel: 'FTL',
          temperatureControl: 'refrigerated',
          requiresHazmat: false,
          deliveryStatus: 'unassigned',
          specialInstructions: 'Temperature-controlled trailer required. Max 4°C throughout.',
          notes: 'EDI 850 imported. Carrier assignment pending.'
        },
        // 3. Converted order — linked to in-progress shipment SH-2026-003
        {
          orgId: seedOrgId,
          orderNumber: 'ORD-2026-0003',
          poNumber: 'PO-BBY-91002',
          status: 'converted',
          importSource: 'manual',
          customerId: cust('Best Buy Co. Inc.').id,
          originId: loc('West Coast Hub - Los Angeles').id,
          destinationId: loc('Northwest Hub - Seattle').id,
          originValidated: true,
          destinationValidated: true,
          orderDate: daysAgo(3),
          requestedPickupDate: daysAgo(1),
          requestedDeliveryDate: daysAhead(1),
          serviceLevel: 'FTL',
          temperatureControl: 'ambient',
          requiresHazmat: false,
          deliveryStatus: 'in_transit',
          specialInstructions: 'High-value electronics. Security seal required. Driver signature mandatory.',
          notes: 'Linked to shipment SH-2026-003.'
        },
        // 4. Converted order — linked to complete shipment SH-2026-005
        {
          orgId: seedOrgId,
          orderNumber: 'ORD-2026-0004',
          poNumber: 'PO-AMZ-71100',
          status: 'converted',
          importSource: 'manual',
          customerId: cust('Amazon.com Inc.').id,
          originId: loc('Head Office - Dallas').id,
          destinationId: loc('Amazon FC - Nashville').id,
          originValidated: true,
          destinationValidated: true,
          orderDate: daysAgo(7),
          requestedPickupDate: daysAgo(5),
          requestedDeliveryDate: daysAgo(3),
          serviceLevel: 'FTL',
          temperatureControl: 'ambient',
          requiresHazmat: false,
          deliveryStatus: 'delivered',
          deliveredAt: daysAgo(3),
          deliveryMethod: 'manual',
          deliveryNotes: 'Delivered and signed by warehouse supervisor.',
          specialInstructions: 'Pallets must be shrink-wrapped and banded.',
          notes: 'Completed delivery. Ready for invoice.'
        },
        // 5. Cancelled order
        {
          orgId: seedOrgId,
          orderNumber: 'ORD-2026-0005',
          poNumber: 'PO-TGT-33450',
          status: 'cancelled',
          importSource: 'manual',
          customerId: cust('Target Corporation').id,
          originId: loc('Southeast Warehouse - Atlanta').id,
          destinationId: loc('Southeast Logistics - Miami').id,
          originValidated: true,
          destinationValidated: true,
          orderDate: daysAgo(5),
          requestedPickupDate: daysAgo(3),
          requestedDeliveryDate: daysAgo(1),
          serviceLevel: 'FTL',
          temperatureControl: 'ambient',
          requiresHazmat: false,
          deliveryStatus: 'cancelled',
          notes: 'Cancelled by customer - store inventory exceeded requirements.'
        },
        // 6. Pending order — hazmat, requires special handling
        {
          orgId: seedOrgId,
          orderNumber: 'ORD-2026-0006',
          poNumber: 'PO-HD-55610',
          status: 'pending',
          importSource: 'manual',
          customerId: cust('Home Depot Inc.').id,
          originId: loc('Home Depot DC - Atlanta').id,
          destinationId: loc('Gulf Coast Warehouse - Houston').id,
          originValidated: true,
          destinationValidated: true,
          orderDate: daysAgo(1),
          requestedPickupDate: daysAhead(1),
          requestedDeliveryDate: daysAhead(3),
          serviceLevel: 'FTL',
          temperatureControl: 'ambient',
          requiresHazmat: true,
          deliveryStatus: 'unassigned',
          specialInstructions: 'Hazmat-certified driver required. UN1760 and UN1263 placards needed.',
          notes: 'Hazmat manifest attached. Awaiting compliance review.'
        },
        // 7. Converted order — cold chain pharma, in transit
        {
          orgId: seedOrgId,
          orderNumber: 'ORD-2026-0007',
          poNumber: 'PO-WAG-20987',
          status: 'converted',
          importSource: 'edi',
          customerId: cust('Walgreens Boots Alliance').id,
          originId: loc('Walgreens DC - Chicago').id,
          destinationId: loc('Mountain West Distribution - Salt Lake City').id,
          originValidated: true,
          destinationValidated: true,
          orderDate: daysAgo(2),
          requestedPickupDate: daysAhead(1),
          requestedDeliveryDate: daysAhead(3),
          serviceLevel: 'FTL',
          temperatureControl: 'refrigerated',
          requiresHazmat: false,
          deliveryStatus: 'assigned',
          specialInstructions: 'Pharma cold chain 2-8°C. Temperature logger must be included.',
          notes: 'GDP-compliant shipment. Pre-clearance with receiving pharmacy required.'
        },
        // 8. Pending order — LTL, bulk retail items
        {
          orgId: seedOrgId,
          orderNumber: 'ORD-2026-0008',
          poNumber: 'PO-WAL-66320',
          status: 'pending',
          importSource: 'csv',
          customerId: cust('Walmart Inc.').id,
          originId: loc('Midwest Logistics Center - Kansas City').id,
          destinationId: loc('Upper Midwest Hub - Minneapolis').id,
          originValidated: true,
          destinationValidated: true,
          orderDate: daysAgo(1),
          requestedPickupDate: daysAhead(4),
          requestedDeliveryDate: daysAhead(6),
          serviceLevel: 'LTL',
          temperatureControl: 'ambient',
          requiresHazmat: false,
          deliveryStatus: 'unassigned',
          notes: 'CSV import from WMS. 3 SKUs consolidated for LTL.'
        },
        // 9. Converted order with exception — linked to SH-2026-004
        {
          orgId: seedOrgId,
          orderNumber: 'ORD-2026-0009',
          poNumber: 'PO-TGT-90110',
          status: 'converted',
          importSource: 'manual',
          customerId: cust('Target Corporation').id,
          originId: loc('Southeast Warehouse - Atlanta').id,
          destinationId: loc('Southeast Logistics - Miami').id,
          originValidated: true,
          destinationValidated: true,
          orderDate: daysAgo(4),
          requestedPickupDate: daysAgo(2),
          requestedDeliveryDate: daysAgo(1),
          serviceLevel: 'FTL',
          temperatureControl: 'ambient',
          requiresHazmat: false,
          deliveryStatus: 'exception',
          exceptionType: 'delay',
          exceptionNotes: 'Driver reported traffic delays on I-75. ETA pushed by 6 hours.',
          notes: 'Linked to shipment SH-2026-004. Exception raised - tracking in progress.'
        },
        // 10. Validated order — frozen food, ready to dispatch
        {
          orgId: seedOrgId,
          orderNumber: 'ORD-2026-0010',
          poNumber: 'PO-KRO-80055',
          status: 'validated',
          importSource: 'edi',
          customerId: cust('Kroger Company').id,
          originId: loc('Midwest Logistics Center - Kansas City').id,
          destinationId: loc('Great Plains Logistics - Oklahoma City').id,
          originValidated: true,
          destinationValidated: true,
          orderDate: daysAgo(2),
          requestedPickupDate: daysAhead(1),
          requestedDeliveryDate: daysAhead(2),
          serviceLevel: 'FTL',
          temperatureControl: 'frozen',
          requiresHazmat: false,
          deliveryStatus: 'unassigned',
          specialInstructions: 'Frozen at -18°C or below. Continuous monitoring required. Rejection if temp breach.',
          notes: 'Validated via EDI 850. Carrier tender to be issued.'
        },
        // 11. Converted order — delivered, building materials
        {
          orgId: seedOrgId,
          orderNumber: 'ORD-2026-0011',
          poNumber: "PO-LOW-12400",
          status: 'converted',
          importSource: 'manual',
          customerId: cust("Lowe's Companies Inc.").id,
          originId: loc("Lowe's DC - Charlotte").id,
          destinationId: loc('Deep South Distribution - New Orleans').id,
          originValidated: true,
          destinationValidated: true,
          orderDate: daysAgo(9),
          requestedPickupDate: daysAgo(6),
          requestedDeliveryDate: daysAgo(4),
          serviceLevel: 'FTL',
          temperatureControl: 'ambient',
          requiresHazmat: false,
          deliveryStatus: 'delivered',
          deliveredAt: daysAgo(4),
          deliveryMethod: 'manual',
          deliveryNotes: 'All pallets received in good condition. Signed off by dock supervisor.',
          notes: 'Linked to completed shipment SH-2026-009.'
        },
        // 12. Pending order — electronics, high value
        {
          orgId: seedOrgId,
          orderNumber: 'ORD-2026-0012',
          poNumber: 'PO-AMZ-55009',
          status: 'pending',
          importSource: 'manual',
          customerId: cust('Amazon.com Inc.').id,
          originId: loc('Port of Los Angeles - Logistics Hub').id,
          destinationId: loc('West Coast Hub - Los Angeles').id,
          originValidated: true,
          destinationValidated: true,
          orderDate: daysAgo(1),
          requestedPickupDate: daysAhead(3),
          requestedDeliveryDate: daysAhead(4),
          serviceLevel: 'FTL',
          temperatureControl: 'ambient',
          requiresHazmat: false,
          deliveryStatus: 'unassigned',
          specialInstructions: 'Port drayage — container pickup at Pier 300. SCAC code required on BOL.',
          notes: 'Import container from Shanghai. Customs cleared.'
        },
        // 13. Validated order — LTL pharmacy supplies
        {
          orgId: seedOrgId,
          orderNumber: 'ORD-2026-0013',
          poNumber: 'PO-CVS-77831',
          status: 'validated',
          importSource: 'manual',
          customerId: cust('CVS Health Corporation').id,
          originId: loc('CVS DC - Rhode Island').id,
          destinationId: loc('Mid-Atlantic Logistics - Philadelphia').id,
          originValidated: true,
          destinationValidated: true,
          orderDate: daysAgo(2),
          requestedPickupDate: daysAhead(1),
          requestedDeliveryDate: daysAhead(2),
          serviceLevel: 'LTL',
          temperatureControl: 'ambient',
          requiresHazmat: false,
          deliveryStatus: 'unassigned',
          notes: 'Validated. Consolidating with ORD-2026-0006 on same lane if carrier confirms capacity.'
        },
        // 14. Converted order — in transit, bulk warehouse
        {
          orgId: seedOrgId,
          orderNumber: 'ORD-2026-0014',
          poNumber: 'PO-CST-39900',
          status: 'converted',
          importSource: 'edi',
          customerId: cust('Costco Wholesale Corporation').id,
          originId: loc('Costco DC - Seattle').id,
          destinationId: loc('Rocky Mountain Distribution - Denver').id,
          originValidated: true,
          destinationValidated: true,
          orderDate: daysAgo(4),
          requestedPickupDate: daysAgo(2),
          requestedDeliveryDate: daysAhead(1),
          serviceLevel: 'FTL',
          temperatureControl: 'ambient',
          requiresHazmat: false,
          deliveryStatus: 'in_transit',
          notes: 'Linked to shipment SH-2026-010. On track for delivery.'
        },
        // 15. Cancelled — customer pulled out
        {
          orgId: seedOrgId,
          orderNumber: 'ORD-2026-0015',
          poNumber: 'PO-BBY-18430',
          status: 'cancelled',
          importSource: 'manual',
          customerId: cust('Best Buy Co. Inc.').id,
          originId: loc('Best Buy - Denver').id,
          destinationId: loc('Rocky Mountain Distribution - Denver').id,
          originValidated: true,
          destinationValidated: true,
          orderDate: daysAgo(6),
          requestedPickupDate: daysAgo(3),
          requestedDeliveryDate: daysAgo(2),
          serviceLevel: 'LTL',
          temperatureControl: 'ambient',
          requiresHazmat: false,
          deliveryStatus: 'cancelled',
          notes: 'Cancelled 24h before pickup. Carrier notified. No charges applied.'
        },
        // 16. Converted order — exception, damaged in transit
        {
          orgId: seedOrgId,
          orderNumber: 'ORD-2026-0016',
          poNumber: 'PO-CST-71200',
          status: 'converted',
          importSource: 'manual',
          customerId: cust('Costco Wholesale Corporation').id,
          originId: loc('Deep South Distribution - New Orleans').id,
          destinationId: loc('Southeast Warehouse - Atlanta').id,
          originValidated: true,
          destinationValidated: true,
          orderDate: daysAgo(4),
          requestedPickupDate: daysAgo(2),
          requestedDeliveryDate: daysAhead(1),
          serviceLevel: 'LTL',
          temperatureControl: 'ambient',
          requiresHazmat: false,
          deliveryStatus: 'exception',
          exceptionType: 'damage',
          exceptionNotes: 'Pallet 3 of 8 reported as damaged. Photos taken by driver. Claim in progress.',
          notes: 'Linked to shipment SH-2026-020. Financial query raised.'
        },
        // 17. Pending order — seasonal, garden centre
        {
          orgId: seedOrgId,
          orderNumber: 'ORD-2026-0017',
          poNumber: 'PO-LOW-88001',
          status: 'pending',
          importSource: 'csv',
          customerId: cust("Lowe's Companies Inc.").id,
          originId: loc('Great Plains Logistics - Oklahoma City').id,
          destinationId: loc('Midwest Logistics Center - Kansas City').id,
          originValidated: true,
          destinationValidated: true,
          orderDate: daysAgo(1),
          requestedPickupDate: daysAhead(5),
          requestedDeliveryDate: daysAhead(7),
          serviceLevel: 'FTL',
          temperatureControl: 'ambient',
          requiresHazmat: false,
          deliveryStatus: 'unassigned',
          notes: 'Summer garden season top-up. CSV upload from category manager.'
        },
        // 18. Validated order — beauty products
        {
          orgId: seedOrgId,
          orderNumber: 'ORD-2026-0018',
          poNumber: 'PO-WAG-45002',
          status: 'validated',
          importSource: 'manual',
          customerId: cust('Walgreens Boots Alliance').id,
          originId: loc('Desert Southwest Hub - Las Vegas').id,
          destinationId: loc('West Coast Hub - Los Angeles').id,
          originValidated: true,
          destinationValidated: true,
          orderDate: daysAgo(2),
          requestedPickupDate: daysAhead(1),
          requestedDeliveryDate: daysAhead(2),
          serviceLevel: 'FTL',
          temperatureControl: 'ambient',
          requiresHazmat: false,
          deliveryStatus: 'unassigned',
          notes: 'Validated. Linked to lane Las Vegas to LA. Carrier assignment in progress.'
        },
        // 19. Converted order — delivered, high-value electronics
        {
          orgId: seedOrgId,
          orderNumber: 'ORD-2026-0019',
          poNumber: 'PO-AMZ-30812',
          status: 'converted',
          importSource: 'edi',
          customerId: cust('Amazon.com Inc.').id,
          originId: loc('West Coast Hub - Los Angeles').id,
          destinationId: loc('Central Distribution Center - Chicago').id,
          originValidated: true,
          destinationValidated: true,
          orderDate: daysAgo(10),
          requestedPickupDate: daysAgo(8),
          requestedDeliveryDate: daysAgo(5),
          serviceLevel: 'FTL',
          temperatureControl: 'ambient',
          requiresHazmat: false,
          deliveryStatus: 'delivered',
          deliveredAt: daysAgo(5),
          deliveryMethod: 'auto',
          deliveryNotes: 'Confirmed by geofence trigger at Chicago DC.',
          notes: 'Linked to shipment SH-2026-012. Invoice pending.'
        },
        // 20. Pending order — tools and hardware
        {
          orgId: seedOrgId,
          orderNumber: 'ORD-2026-0020',
          poNumber: 'PO-HD-92450',
          status: 'pending',
          importSource: 'manual',
          customerId: cust('Home Depot Inc.').id,
          originId: loc('Great Lakes Distribution - Detroit').id,
          destinationId: loc('Central Distribution Center - Chicago').id,
          originValidated: true,
          destinationValidated: true,
          orderDate: daysAgo(1),
          requestedPickupDate: daysAhead(5),
          requestedDeliveryDate: daysAhead(7),
          serviceLevel: 'LTL',
          temperatureControl: 'ambient',
          requiresHazmat: false,
          deliveryStatus: 'unassigned',
          specialInstructions: 'Liftgate required at destination. Heavy items on bottom pallets.',
          notes: 'Power tools and fasteners for Chicago stores. Pending carrier capacity.'
        }
      ];

      await server.prisma.order.createMany({ data: orderData });

      // Link converted orders to their corresponding shipments
      const createdOrders = await server.prisma.order.findMany();
      const ord = (num: string) => createdOrders.find((o: any) => o.orderNumber === num)!;

      const orderShipmentLinks = [
        { orderNumber: 'ORD-2026-0003', shipmentRef: 'SH-2026-003' },
        { orderNumber: 'ORD-2026-0004', shipmentRef: 'SH-2026-005' },
        { orderNumber: 'ORD-2026-0009', shipmentRef: 'SH-2026-004' },
        { orderNumber: 'ORD-2026-0011', shipmentRef: 'SH-2026-009' },
        { orderNumber: 'ORD-2026-0014', shipmentRef: 'SH-2026-010' },
        { orderNumber: 'ORD-2026-0016', shipmentRef: 'SH-2026-020' },
        { orderNumber: 'ORD-2026-0019', shipmentRef: 'SH-2026-012' },
      ];

      for (const link of orderShipmentLinks) {
        const order = ord(link.orderNumber);
        const shipment = sh(link.shipmentRef);
        if (order && shipment) {
          await server.prisma.orderShipment.create({
            data: { orderId: order.id, shipmentId: shipment.id }
          });
        }
      }

      const laneCount = await server.prisma.lane.count();
      reply.code(201);
      return {
        data: {
          message: 'Database seeded successfully',
          customers: allCustomers.length,
          carriers: allCarriers.length,
          locations: allLocations.length,
          lanes: laneCount,
          shipments: shipmentData.length,
          orders: orderData.length,
          orderShipmentLinks: orderShipmentLinks.length
        },
        error: null
      };
    } catch (error) {
      console.error('Seed error:', error);
      reply.code(500);
      return { data: null, error: `Failed to seed database: ${(error as Error).message}` };
    }
  });
}
