/**
 * Comprehensive seed script for Open TMS.
 *
 * Builds a realistic, interconnected dataset modelled on a global 3PL:
 * diverse customers (frozen foods, pharma, chemicals, electronics, grocery,
 * auto parts, apparel), carriers (FTL, LTL, reefer, hazmat, expedited),
 * lanes, orders with pallets + line items, shipments in various states,
 * tenders with bids, financials (quotes / invoices / AP), issues, SLA
 * policies, EDI trading partners, triage agent config, and IoT devices.
 *
 * Usage:
 *   npx tsx backend/src/scripts/comprehensive-seed.ts          # wipe + seed
 *   npx tsx backend/src/scripts/comprehensive-seed.ts --no-wipe
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { createHmac, randomBytes } from 'crypto';
import { seedSystemRoles } from '../auth/seedRoles.js';

const prisma = new PrismaClient();
const NO_WIPE = process.argv.includes('--no-wipe');

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHmac('sha256', salt).update(password).digest('hex');
  return `${salt}:${hash}`;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function minutesAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 1000);
}

// ─── Wipe ────────────────────────────────────────────────────────────────────

async function wipe() {
  console.log('Wiping existing data...');

  // Leaf-level / event tables first
  await prisma.automationExecutionLog.deleteMany();
  await prisma.automationRule.deleteMany();
  await prisma.agentDecisionReadModel.deleteMany();
  await prisma.agentDecision.deleteMany();
  await prisma.agentConfigVersion.deleteMany();
  await prisma.agentConfig.deleteMany();
  await prisma.skillChain.deleteMany();
  await prisma.skillConfig.deleteMany();

  await prisma.notification.deleteMany();
  await prisma.eventSubscription.deleteMany();
  await prisma.domainEventLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.loginAuditLog.deleteMany();
  await prisma.magicLink.deleteMany();
  await prisma.session.deleteMany();
  await prisma.webhookLog.deleteMany();
  await prisma.customerWebhookDelivery.deleteMany();
  await prisma.customerWebhook.deleteMany();
  await prisma.apiKey.deleteMany();

  await prisma.carrierTrackingEvent.deleteMany();
  await prisma.carrierTrackingIntegration.deleteMany();

  await prisma.sensorReading.deleteMany();
  await prisma.deviceEvent.deleteMany();
  await prisma.deviceCalibration.deleteMany();
  await prisma.immutableTemperatureLog.deleteMany();
  await prisma.coldChainExcursion.deleteMany();
  await prisma.deviceAssignment.deleteMany();
  await prisma.device.deleteMany();

  await prisma.cargoScan.deleteMany();
  await prisma.cargoDiscrepancy.deleteMany();

  await prisma.cAPAFollowUp.deleteMany();
  await prisma.cAPAReport.deleteMany();

  await prisma.commission.deleteMany();

  await prisma.payment.deleteMany();
  await prisma.invoiceLineItem.deleteMany();
  await prisma.invoiceReadModel.deleteMany();
  await prisma.creditNote.deleteMany();
  await prisma.financialQuery.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.carrierInvoiceLineItem.deleteMany();
  await prisma.carrierInvoice.deleteMany();
  await prisma.shipmentFinancialSummary.deleteMany();
  await prisma.charge.deleteMany();
  await prisma.quoteLineItem.deleteMany();
  await prisma.quote.deleteMany();

  await prisma.slaEvaluation.deleteMany();
  await prisma.slaRule.deleteMany();
  await prisma.slaPolicy.deleteMany();

  await prisma.ediTransactionLog.deleteMany();
  await prisma.tradingPartnerTransaction.deleteMany();
  await prisma.tradingPartner.deleteMany();

  await prisma.issueLabelAssignment.deleteMany();
  await prisma.issueLabel.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.issueReadModel.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.kanbanView.deleteMany();

  await prisma.tenderBid.deleteMany();
  await prisma.tenderOffer.deleteMany();
  await prisma.tender.deleteMany();

  await prisma.shipmentAccessory.deleteMany();
  await prisma.shipmentFlag.deleteMany();
  await prisma.connectivityLog.deleteMany();
  await prisma.shipmentEvent.deleteMany();
  await prisma.load.deleteMany();
  await prisma.orderShipment.deleteMany();
  await prisma.shipmentStop.deleteMany();
  await prisma.shipmentReadModel.deleteMany();
  await prisma.shipment.deleteMany();

  await prisma.pendingLaneRequest.deleteMany();
  await prisma.orderReadModel.deleteMany();
  await prisma.orderLineItem.deleteMany();
  await prisma.trackableUnit.deleteMany();
  await prisma.order.deleteMany();

  await prisma.laneCarrier.deleteMany();
  await prisma.customerLane.deleteMany();
  await prisma.laneStop.deleteMany();
  await prisma.laneRoute.deleteMany();
  await prisma.laneReadModel.deleteMany();
  await prisma.lane.deleteMany();

  await prisma.driver.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.carrierCutoff.deleteMany();
  await prisma.carrierUser.deleteMany();
  await prisma.carrierReadModel.deleteMany();
  await prisma.carrier.deleteMany();

  await prisma.customerUser.deleteMany();
  await prisma.customerReadModel.deleteMany();
  await prisma.customer.deleteMany();

  await prisma.coldChainProfile.deleteMany();
  await prisma.packagingType.deleteMany();

  // Warehouse PWA — wipe before Location (these all carry locationId FKs without cascade)
  await prisma.indoorZoneAnchor.deleteMany();
  await prisma.allocation.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.packAudit.deleteMany();
  await prisma.packLine.deleteMany();
  await prisma.pickLine.deleteMany();
  await prisma.receivingLine.deleteMany();
  await prisma.waveOrder.deleteMany();

  await prisma.putawayTask.deleteMany();
  await prisma.packTask.deleteMany();
  await prisma.pickTask.deleteMany();
  await prisma.stagingAssignment.deleteMany();
  await prisma.inventoryRecord.deleteMany();
  await prisma.receivingTask.deleteMany();
  await prisma.receivingAppointment.deleteMany();

  await prisma.wave.deleteMany();
  await prisma.waveTemplate.deleteMany();
  await prisma.putawayRule.deleteMany();
  await prisma.manifestUpload.deleteMany();

  await prisma.warehouseBin.deleteMany();
  await prisma.warehouseAisle.deleteMany();
  await prisma.warehouseZone.deleteMany();

  await prisma.arrivalCriteria.deleteMany();
  await prisma.location.deleteMany();

  await prisma.userRole.deleteMany();
  await prisma.userNotificationPreference.deleteMany();
  await prisma.user.deleteMany({ where: { email: { contains: '@meridian-tms.demo' } } });
  await prisma.user.deleteMany({ where: { email: { contains: '@meridian.demo' } } });

  await prisma.organization.deleteMany();
}

// ─── Organization ────────────────────────────────────────────────────────────

async function seedOrganization() {
  const org = await prisma.organization.create({
    data: {
      name: 'Meridian Global Logistics',
      organizationType: '3pl',
      mcNumber: 'MC-872341',
      bondAmountCents: 7500000,
      bondExpirationDate: daysFromNow(365),
      minMarginPercent: new Prisma.Decimal('12.00'),
      marginAlertEnabled: true,
      trackingMode: 'item',
      trackableUnitType: 'pallet',
      weightUnit: 'kg',
      dimUnit: 'cm',
      temperatureUnit: 'C',
      distanceUnit: 'km',
      autoTenderEnabled: true,
      autoDeliverShipmentDocs: true,
      magicLinksEnabled: true,
      warehouseScanMode: 'camera',
      emailProvider: 'console',
      emailFromAddress: 'ops@meridian-tms.demo',
      emailFromName: 'Meridian Ops',
      emailEnabled: true,
      llmProvider: 'anthropic',
      llmModel: 'claude-sonnet-4-20250514',
      llmEnabled: false,
    },
  });
  return org;
}

// ─── Internal Users ──────────────────────────────────────────────────────────

async function seedUsers(orgId: string) {
  const roles = await prisma.role.findMany();
  const roleByName = Object.fromEntries(roles.map((r) => [r.name, r]));
  const pwd = hashPassword('Password1!');

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@meridian-tms.demo',
        passwordHash: pwd,
        firstName: 'Avery',
        lastName: 'Chen',
        organizationId: orgId,
        timezone: 'America/Chicago',
      },
    }),
    prisma.user.create({
      data: {
        email: 'dispatch@meridian-tms.demo',
        passwordHash: pwd,
        firstName: 'Marcus',
        lastName: 'Okafor',
        organizationId: orgId,
        timezone: 'America/New_York',
      },
    }),
    prisma.user.create({
      data: {
        email: 'ops-manager@meridian-tms.demo',
        passwordHash: pwd,
        firstName: 'Priya',
        lastName: 'Shankar',
        organizationId: orgId,
        timezone: 'America/Los_Angeles',
      },
    }),
    prisma.user.create({
      data: {
        email: 'warehouse@meridian-tms.demo',
        passwordHash: pwd,
        firstName: 'Diego',
        lastName: 'Ramirez',
        organizationId: orgId,
        timezone: 'America/Denver',
      },
    }),
    prisma.user.create({
      data: {
        email: 'finance@meridian-tms.demo',
        passwordHash: pwd,
        firstName: 'Eleanor',
        lastName: 'Whitfield',
        organizationId: orgId,
        timezone: 'America/New_York',
      },
    }),
  ]);

  const assignments: Array<{ userId: string; roleName: string }> = [
    { userId: users[0].id, roleName: 'admin' },
    { userId: users[1].id, roleName: 'dispatcher' },
    { userId: users[2].id, roleName: 'admin' },
    { userId: users[3].id, roleName: 'warehouse' },
    { userId: users[4].id, roleName: 'admin' },
  ];
  for (const a of assignments) {
    const role = roleByName[a.roleName];
    if (role) {
      await prisma.userRole.create({
        data: { userId: a.userId, roleId: role.id },
      });
    }
  }

  return users;
}

// ─── Pallet Types ────────────────────────────────────────────────────────────

async function seedPalletTypes(orgId: string) {
  const types = [
    {
      code: 'EUR1',
      name: 'Euro Pallet (EUR 1)',
      description: 'Standard European pallet, ISPM-15 heat-treated',
      lengthMm: 1200,
      widthMm: 800,
      heightMm: 144,
      tareWeightGrams: 25000,
      maxLoadGrams: 1500000,
      maxStackHeightMm: 2200,
      material: 'wood',
      isoCertified: true,
    },
    {
      code: 'US_GMA_48x40',
      name: 'US GMA Pallet (48x40)',
      description: 'North American grocery standard',
      lengthMm: 1219,
      widthMm: 1016,
      heightMm: 140,
      tareWeightGrams: 22700,
      maxLoadGrams: 1360000,
      maxStackHeightMm: 2438,
      material: 'wood',
      isoCertified: false,
    },
    {
      code: 'CHEP_1210',
      name: 'CHEP Blue Pallet (1200x1000)',
      description: 'Pooled block pallet, exchange network',
      lengthMm: 1200,
      widthMm: 1000,
      heightMm: 162,
      tareWeightGrams: 32000,
      maxLoadGrams: 1500000,
      maxStackHeightMm: 2400,
      material: 'wood',
      isoCertified: true,
    },
    {
      code: 'HALF_PALLET',
      name: 'Half Pallet (800x600)',
      description: 'Display / retail-ready',
      lengthMm: 800,
      widthMm: 600,
      heightMm: 144,
      tareWeightGrams: 9000,
      maxLoadGrams: 500000,
      maxStackHeightMm: 1800,
      material: 'wood',
      isoCertified: false,
    },
    {
      code: 'PLASTIC_HYG',
      name: 'Plastic Hygienic Pallet',
      description: 'Food / pharma grade, washable',
      lengthMm: 1200,
      widthMm: 1000,
      heightMm: 150,
      tareWeightGrams: 22000,
      maxLoadGrams: 1000000,
      maxStackHeightMm: 2100,
      material: 'plastic',
      isoCertified: false,
    },
  ];

  const created = [];
  for (const t of types) {
    created.push(
      await prisma.packagingType.create({ data: { ...t, orgId } })
    );
  }
  return created;
}

// ─── Cold Chain Profiles ─────────────────────────────────────────────────────

async function seedColdChainProfiles(orgId: string, createdBy: string) {
  const profiles = [
    {
      name: 'Frozen (-25 to -18°C)',
      description: 'Ice cream, frozen seafood, long-haul frozen',
      minTemperature: -25,
      maxTemperature: -18,
      alertMinTemperature: -24,
      alertMaxTemperature: -19,
    },
    {
      name: 'Refrigerated (2 to 8°C)',
      description: 'Dairy, produce, fresh meat, cold-chain pharma',
      minTemperature: 2,
      maxTemperature: 8,
      alertMinTemperature: 3,
      alertMaxTemperature: 7,
      minHumidity: 30,
      maxHumidity: 80,
      alertMinHumidity: 35,
      alertMaxHumidity: 75,
    },
    {
      name: 'Controlled Ambient (15 to 25°C)',
      description: 'Pharmaceuticals, chocolate, wine',
      minTemperature: 15,
      maxTemperature: 25,
      alertMinTemperature: 16,
      alertMaxTemperature: 24,
    },
    {
      name: 'Ultra-Cold (-80°C)',
      description: 'mRNA vaccines, biological samples',
      minTemperature: -86,
      maxTemperature: -60,
      alertMinTemperature: -85,
      alertMaxTemperature: -65,
    },
    {
      name: 'Chilled Produce (0 to 4°C)',
      description: 'Fresh fruit and vegetables',
      minTemperature: 0,
      maxTemperature: 4,
      alertMinTemperature: 1,
      alertMaxTemperature: 3,
      minHumidity: 85,
      maxHumidity: 95,
      alertMinHumidity: 88,
      alertMaxHumidity: 93,
    },
  ];

  const created = [];
  for (const p of profiles) {
    created.push(
      await prisma.coldChainProfile.create({
        data: { ...p, orgId, createdBy },
      })
    );
  }
  return created;
}

// ─── Issue Labels ────────────────────────────────────────────────────────────

async function seedIssueLabels(orgId: string) {
  const labels = [
    { name: 'cold-chain', color: '#0EA5E9' },
    { name: 'hazmat', color: '#F97316' },
    { name: 'vip-customer', color: '#A855F7' },
    { name: 'delay', color: '#EAB308' },
    { name: 'damage', color: '#EF4444' },
    { name: 'compliance', color: '#10B981' },
    { name: 'route-deviation', color: '#6366F1' },
  ];
  const created = [];
  for (const l of labels) {
    created.push(await prisma.issueLabel.create({ data: { ...l, orgId } }));
  }
  return created;
}

// ─── Locations ───────────────────────────────────────────────────────────────

async function seedLocations(orgId: string) {
  const locs = [
    // Our own 3PL hubs
    {
      name: 'Meridian HQ - Chicago',
      address1: '2550 W Golf Rd',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60008',
      country: 'USA',
      lat: 41.9989,
      lng: -88.0158,
      locationType: 'distribution_centre',
      facilityCapabilities: { crossDockCapable: true, hasColdStorage: true, hasHazmatCert: true, hasBondedStorage: true },
      appointmentRequired: true,
      dockCount: 42,
    },
    {
      name: 'Meridian West Coast DC - Ontario',
      address1: '5200 Ontario Mills Pkwy',
      city: 'Ontario',
      state: 'CA',
      postalCode: '91764',
      country: 'USA',
      lat: 34.0633,
      lng: -117.6509,
      locationType: 'distribution_centre',
      facilityCapabilities: { crossDockCapable: true, hasColdStorage: true, hasHazmatCert: false, hasBondedStorage: true },
      dockCount: 36,
    },
    {
      name: 'Meridian Northeast DC - Secaucus',
      address1: '100 Plaza Dr',
      city: 'Secaucus',
      state: 'NJ',
      postalCode: '07094',
      country: 'USA',
      lat: 40.7895,
      lng: -74.0565,
      locationType: 'distribution_centre',
      dockCount: 28,
    },
    {
      name: 'Meridian South DC - Dallas',
      address1: '4200 S Pinemont Dr',
      city: 'Dallas',
      state: 'TX',
      postalCode: '75224',
      country: 'USA',
      lat: 32.7102,
      lng: -96.8435,
      locationType: 'distribution_centre',
      dockCount: 24,
    },
    // Cross-docks
    {
      name: 'Atlanta Cross-Dock',
      address1: '3800 Camp Creek Pkwy',
      city: 'Atlanta',
      state: 'GA',
      postalCode: '30331',
      country: 'USA',
      lat: 33.6407,
      lng: -84.4277,
      locationType: 'cross_dock',
    },
    {
      name: 'Memphis Cross-Dock',
      address1: '2491 Winchester Rd',
      city: 'Memphis',
      state: 'TN',
      postalCode: '38116',
      country: 'USA',
      lat: 35.0269,
      lng: -89.9889,
      locationType: 'cross_dock',
    },
    // Ports
    {
      name: 'Port of Long Beach - Terminal C',
      address1: '1171 Pier C',
      city: 'Long Beach',
      state: 'CA',
      postalCode: '90802',
      country: 'USA',
      lat: 33.7542,
      lng: -118.2165,
      locationType: 'port',
    },
    {
      name: 'Port of Savannah - Garden City Terminal',
      address1: '2 Main St',
      city: 'Savannah',
      state: 'GA',
      postalCode: '31408',
      country: 'USA',
      lat: 32.1395,
      lng: -81.1502,
      locationType: 'port',
    },
    // Customer pickup points (supplier factories / DCs)
    {
      name: 'Nordic Frost Production - Green Bay',
      address1: '1400 S Broadway',
      city: 'Green Bay',
      state: 'WI',
      postalCode: '54304',
      country: 'USA',
      lat: 44.5133,
      lng: -88.0133,
      locationType: 'manufacturing',
      facilityCapabilities: { hasColdStorage: true },
    },
    {
      name: 'Axiom Pharma Lab - Cambridge',
      address1: '75 Sidney St',
      city: 'Cambridge',
      state: 'MA',
      postalCode: '02139',
      country: 'USA',
      lat: 42.3654,
      lng: -71.1037,
      locationType: 'manufacturing',
    },
    {
      name: 'BluePeak Electronics Factory - San Jose',
      address1: '2200 Mission College Blvd',
      city: 'San Jose',
      state: 'CA',
      postalCode: '95054',
      country: 'USA',
      lat: 37.3858,
      lng: -121.9678,
      locationType: 'manufacturing',
    },
    {
      name: 'GreenField Chem Plant - Houston',
      address1: '5555 San Felipe St',
      city: 'Houston',
      state: 'TX',
      postalCode: '77056',
      country: 'USA',
      lat: 29.7444,
      lng: -95.4594,
      locationType: 'manufacturing',
      facilityCapabilities: { hasHazmatCert: true },
    },
    // Customer delivery points
    {
      name: 'Metro Grocer DC - Denver',
      address1: '1200 S Peoria St',
      city: 'Denver',
      state: 'CO',
      postalCode: '80231',
      country: 'USA',
      lat: 39.6819,
      lng: -104.8867,
      locationType: 'distribution_centre',
      facilityCapabilities: { hasColdStorage: true },
    },
    {
      name: 'Titan Auto Parts DC - Columbus',
      address1: '3900 Stelzer Rd',
      city: 'Columbus',
      state: 'OH',
      postalCode: '43219',
      country: 'USA',
      lat: 40.0501,
      lng: -82.9239,
      locationType: 'distribution_centre',
    },
    {
      name: 'Harbor Apparel Store - Miami',
      address1: '3401 NE 1st Ave',
      city: 'Miami',
      state: 'FL',
      postalCode: '33137',
      country: 'USA',
      lat: 25.8045,
      lng: -80.1918,
      locationType: 'store',
    },
    {
      name: 'StellarMed Hospital - Rochester',
      address1: '200 1st St SW',
      city: 'Rochester',
      state: 'MN',
      postalCode: '55905',
      country: 'USA',
      lat: 44.0225,
      lng: -92.4669,
      locationType: 'customer',
    },
    {
      name: 'Metro Grocer Store - Phoenix',
      address1: '7825 N 19th Ave',
      city: 'Phoenix',
      state: 'AZ',
      postalCode: '85021',
      country: 'USA',
      lat: 33.5503,
      lng: -112.0987,
      locationType: 'store',
      facilityCapabilities: { hasColdStorage: true },
    },
    {
      name: 'BluePeak Retail Hub - Seattle',
      address1: '1301 2nd Ave',
      city: 'Seattle',
      state: 'WA',
      postalCode: '98101',
      country: 'USA',
      lat: 47.6080,
      lng: -122.3351,
      locationType: 'store',
    },
  ];

  const created = [];
  for (const l of locs) {
    const loc = await prisma.location.create({ data: { ...l, orgId } as any });
    // Add a default geofence arrival criteria
    await prisma.arrivalCriteria.create({
      data: {
        locationId: loc.id,
        criteriaType: 'geofence',
        radiusMeters: 250,
        name: 'Default geofence',
        priority: 10,
      },
    });
    created.push(loc);
  }
  return created;
}

// ─── Customers + CustomerUsers ───────────────────────────────────────────────

async function seedCustomers(orgId: string) {
  const defs = [
    {
      name: 'Nordic Frost Foods',
      contactEmail: 'logistics@nordicfrost.demo',
      billingEmail: 'ap@nordicfrost.demo',
      billingCity: 'Green Bay',
      billingState: 'WI',
      paymentTermsDays: 30,
      creditLimitCents: 50_000_00,
      invoiceConsolidation: 'weekly',
      autoInvoice: true,
      targetMarginPercent: new Prisma.Decimal('14.00'),
      taxId: '38-5551234',
    },
    {
      name: 'Axiom Pharma',
      contactEmail: 'supply-chain@axiompharma.demo',
      billingEmail: 'ap@axiompharma.demo',
      billingCity: 'Cambridge',
      billingState: 'MA',
      paymentTermsDays: 45,
      creditLimitCents: 200_000_00,
      invoiceConsolidation: 'monthly',
      autoInvoice: false,
      targetMarginPercent: new Prisma.Decimal('22.00'),
      taxId: '04-8876543',
    },
    {
      name: 'BluePeak Electronics',
      contactEmail: 'ops@bluepeak.demo',
      billingEmail: 'accounts@bluepeak.demo',
      billingCity: 'San Jose',
      billingState: 'CA',
      paymentTermsDays: 30,
      creditLimitCents: 150_000_00,
      invoiceConsolidation: 'per_shipment',
      autoInvoice: true,
      targetMarginPercent: new Prisma.Decimal('12.50'),
    },
    {
      name: 'Metro Grocer Co',
      contactEmail: 'receiving@metrogrocer.demo',
      billingEmail: 'ap@metrogrocer.demo',
      billingCity: 'Denver',
      billingState: 'CO',
      paymentTermsDays: 21,
      creditLimitCents: 120_000_00,
      invoiceConsolidation: 'weekly',
      autoInvoice: true,
      targetMarginPercent: new Prisma.Decimal('10.00'),
    },
    {
      name: 'Titan Auto Parts',
      contactEmail: 'logistics@titanauto.demo',
      paymentTermsDays: 60,
      creditLimitCents: 80_000_00,
      invoiceConsolidation: 'monthly',
      targetMarginPercent: new Prisma.Decimal('13.00'),
    },
    {
      name: 'GreenField Chemicals',
      contactEmail: 'shipping@greenfieldchem.demo',
      paymentTermsDays: 30,
      creditLimitCents: 100_000_00,
      invoiceConsolidation: 'per_shipment',
      targetMarginPercent: new Prisma.Decimal('18.00'),
    },
    {
      name: 'Harbor Apparel Group',
      contactEmail: 'ops@harborapparel.demo',
      paymentTermsDays: 30,
      creditLimitCents: 40_000_00,
      invoiceConsolidation: 'weekly',
      targetMarginPercent: new Prisma.Decimal('11.00'),
    },
    {
      name: 'StellarMed Laboratories',
      contactEmail: 'logistics@stellarmed.demo',
      paymentTermsDays: 45,
      creditLimitCents: 300_000_00,
      invoiceConsolidation: 'monthly',
      targetMarginPercent: new Prisma.Decimal('25.00'),
    },
  ];

  const created = [];
  for (const d of defs) {
    const c = await prisma.customer.create({
      data: { ...d, currency: 'USD', billingCountry: 'USA', orgId } as any,
    });
    // Customer portal users
    const portalPwd = hashPassword('Portal123!');
    const slug = d.name.toLowerCase().split(' ')[0];
    await prisma.customerUser.create({
      data: {
        customerId: c.id,
        email: `admin@${slug}.demo`,
        passwordHash: portalPwd,
        name: 'Portal Admin',
        role: 'admin',
      },
    });
    await prisma.customerUser.create({
      data: {
        customerId: c.id,
        email: `viewer@${slug}.demo`,
        passwordHash: portalPwd,
        name: 'Portal Viewer',
        role: 'viewer',
      },
    });
    created.push(c);
  }
  return created;
}

// ─── Carriers + CarrierUsers + Vehicles + Drivers ───────────────────────────

async function seedCarriers(orgId: string) {
  const defs = [
    {
      name: 'Continental Freight Systems',
      scacCode: 'CFSX',
      mcNumber: 'MC-412301',
      dotNumber: 'DOT-2341567',
      validationTier: 'tier1',
      insuranceVerified: true,
      registrationChecked: true,
      identityConfirmed: true,
      complianceChecked: true,
      paymentTermsDays: 30,
    },
    {
      name: 'PolarChain Logistics',
      scacCode: 'POLC',
      mcNumber: 'MC-554322',
      dotNumber: 'DOT-3478901',
      validationTier: 'tier1',
      insuranceVerified: true,
      registrationChecked: true,
      identityConfirmed: true,
      complianceChecked: true,
      paymentTermsDays: 15,
    },
    {
      name: 'IronHaul Transport',
      scacCode: 'IRHL',
      mcNumber: 'MC-612344',
      dotNumber: 'DOT-4120987',
      validationTier: 'tier2',
      insuranceVerified: true,
      registrationChecked: true,
      paymentTermsDays: 30,
    },
    {
      name: 'SwiftLine Expedited',
      scacCode: 'SLEX',
      mcNumber: 'MC-712890',
      dotNumber: 'DOT-5567432',
      validationTier: 'tier1',
      insuranceVerified: true,
      registrationChecked: true,
      paymentTermsDays: 7,
    },
    {
      name: 'HazMark Specialized Carriers',
      scacCode: 'HZMK',
      mcNumber: 'MC-811234',
      dotNumber: 'DOT-6678123',
      validationTier: 'tier1',
      insuranceVerified: true,
      registrationChecked: true,
      identityConfirmed: true,
      complianceChecked: true,
      paymentTermsDays: 30,
    },
    {
      name: 'RegionalPlus LTL',
      scacCode: 'RPLT',
      mcNumber: 'MC-902233',
      dotNumber: 'DOT-7788234',
      validationTier: 'tier2',
      insuranceVerified: true,
      paymentTermsDays: 30,
    },
    {
      name: 'Atlantic Coastal Express',
      scacCode: 'ATCX',
      mcNumber: 'MC-1020234',
      dotNumber: 'DOT-8899012',
      validationTier: 'tier2',
      insuranceVerified: true,
      paymentTermsDays: 30,
    },
    {
      name: 'Pacific Horizon Trucking',
      scacCode: 'PCHR',
      mcNumber: 'MC-1155990',
      dotNumber: 'DOT-9900123',
      validationTier: 'tier1',
      insuranceVerified: true,
      registrationChecked: true,
      paymentTermsDays: 21,
    },
    {
      name: 'Ridgeline Parcel Services',
      scacCode: 'RPSV',
      mcNumber: 'MC-1234560',
      dotNumber: 'DOT-1011223',
      validationTier: 'tier3',
      paymentTermsDays: 30,
    },
  ];

  const created: any[] = [];
  for (const [i, d] of defs.entries()) {
    const carrier = await prisma.carrier.create({
      data: {
        ...d,
        orgId,
        country: 'USA',
        currency: 'USD',
        validatedAt: d.validationTier ? daysAgo(90) : null,
      } as any,
    });

    const portalPwd = hashPassword('Carrier123!');
    const slug = d.name.toLowerCase().split(' ')[0];
    await prisma.carrierUser.create({
      data: {
        carrierId: carrier.id,
        email: `dispatch@${slug}.demo`,
        passwordHash: portalPwd,
        name: `${slug.charAt(0).toUpperCase() + slug.slice(1)} Dispatch`,
        role: 'dispatcher',
      },
    });
    await prisma.carrierUser.create({
      data: {
        carrierId: carrier.id,
        email: `admin@${slug}.demo`,
        passwordHash: portalPwd,
        name: `${slug.charAt(0).toUpperCase() + slug.slice(1)} Admin`,
        role: 'admin',
      },
    });

    // Vehicles (2-3 per carrier)
    const vehicleTypes = i === 1 ? ['53\' Reefer', '53\' Reefer', '48\' Reefer']
      : i === 4 ? ['53\' Tanker', '53\' Hazmat Dry Van']
      : i === 3 ? ['Sprinter Van', 'Straight Truck', 'Team Sleeper']
      : ['53\' Dry Van', '48\' Dry Van', '53\' Dry Van'];
    for (const [v, vt] of vehicleTypes.entries()) {
      await prisma.vehicle.create({
        data: {
          orgId,
          carrierId: carrier.id,
          plate: `${d.scacCode}-${String(v + 1).padStart(3, '0')}`,
          type: vt,
          capacityKg: vt.includes('53') ? 20000 : vt.includes('48') ? 17000 : 3500,
          capacityM3: vt.includes('53') ? 100 : vt.includes('48') ? 88 : 15,
        },
      });
    }

    // Drivers (2-3 per carrier)
    const driverNames = [
      ['James', 'Mitchell'],
      ['Sofia', 'Alvarez'],
      ['Terrence', 'Washington'],
    ];
    for (const [idx, [first, last]] of driverNames.entries()) {
      await prisma.driver.create({
        data: {
          orgId,
          carrierId: carrier.id,
          name: `${first} ${last}`,
          phone: `+1-555-${String(1000 + i * 100 + idx).padStart(4, '0')}`,
          email: `${first.toLowerCase()}.${last.toLowerCase()}@${slug}.demo`,
        },
      });
    }

    // Cutoff — Mon-Fri, 16:00 local
    for (let dow = 1; dow <= 5; dow++) {
      await prisma.carrierCutoff.create({
        data: {
          orgId,
          carrierId: carrier.id,
          dayOfWeek: dow,
          cutoffLocalTime: '16:00',
          timezone: 'America/Chicago',
          active: true,
        },
      });
    }

    created.push(carrier);
  }

  // Wire up tracking integration for SwiftLine (index 3) and Ridgeline (index 8)
  await prisma.carrierTrackingIntegration.create({
    data: {
      carrierId: created[3].id,
      providerType: 'fedex',
      status: 'active',
      credentials: { apiKey: 'demo-fedex-key', accountNumber: '987654321' },
      pollingEnabled: true,
      pollingIntervalSeconds: 900,
      rateLimitDailyMax: 10000,
    },
  });
  await prisma.carrierTrackingIntegration.create({
    data: {
      carrierId: created[8].id,
      providerType: 'ups',
      status: 'active',
      credentials: { clientId: 'demo-ups-client', clientSecret: 'demo-secret' },
      pollingEnabled: true,
      webhookEnabled: true,
      pollingIntervalSeconds: 600,
      rateLimitDailyMax: 5000,
    },
  });

  return created;
}

// ─── Lanes with LaneCarriers ─────────────────────────────────────────────────

async function seedLanes(
  locations: { id: string; city: string; name: string }[],
  customers: { id: string; name: string }[],
  carriers: { id: string; name: string }[],
  orgId: string,
) {
  function loc(city: string) {
    return locations.find((l) => l.city === city)!;
  }

  const laneDefs = [
    { from: 'Green Bay', to: 'Denver', distance: 1580, serviceLevel: 'FTL', tempControl: true, customers: ['Nordic Frost Foods'], carriers: ['PolarChain Logistics', 'Continental Freight Systems'] },
    { from: 'Green Bay', to: 'Phoenix', distance: 2620, serviceLevel: 'FTL', tempControl: true, customers: ['Nordic Frost Foods'], carriers: ['PolarChain Logistics'] },
    { from: 'Cambridge', to: 'Rochester', distance: 2090, serviceLevel: 'FTL', tempControl: true, customers: ['Axiom Pharma', 'StellarMed Laboratories'], carriers: ['PolarChain Logistics', 'SwiftLine Expedited'] },
    { from: 'San Jose', to: 'Seattle', distance: 1280, serviceLevel: 'LTL', tempControl: false, customers: ['BluePeak Electronics'], carriers: ['Pacific Horizon Trucking', 'RegionalPlus LTL'] },
    { from: 'San Jose', to: 'Chicago', distance: 3400, serviceLevel: 'FTL', tempControl: false, customers: ['BluePeak Electronics'], carriers: ['Continental Freight Systems', 'Pacific Horizon Trucking'] },
    { from: 'Ontario', to: 'Denver', distance: 1440, serviceLevel: 'FTL', tempControl: true, customers: ['Metro Grocer Co'], carriers: ['PolarChain Logistics', 'Continental Freight Systems'] },
    { from: 'Ontario', to: 'Phoenix', distance: 580, serviceLevel: 'FTL', tempControl: true, customers: ['Metro Grocer Co'], carriers: ['PolarChain Logistics'] },
    { from: 'Dallas', to: 'Columbus', distance: 1730, serviceLevel: 'FTL', tempControl: false, customers: ['Titan Auto Parts'], carriers: ['IronHaul Transport', 'Continental Freight Systems'] },
    { from: 'Houston', to: 'Chicago', distance: 1750, serviceLevel: 'FTL', tempControl: false, hazmat: true, customers: ['GreenField Chemicals'], carriers: ['HazMark Specialized Carriers'] },
    { from: 'Houston', to: 'Atlanta', distance: 1280, serviceLevel: 'FTL', tempControl: false, hazmat: true, customers: ['GreenField Chemicals'], carriers: ['HazMark Specialized Carriers'] },
    { from: 'Long Beach', to: 'Chicago', distance: 3340, serviceLevel: 'FTL', tempControl: false, customers: ['Harbor Apparel Group', 'BluePeak Electronics'], carriers: ['Continental Freight Systems', 'Atlantic Coastal Express'] },
    { from: 'Savannah', to: 'Miami', distance: 860, serviceLevel: 'LTL', tempControl: false, customers: ['Harbor Apparel Group'], carriers: ['Atlantic Coastal Express', 'RegionalPlus LTL'] },
    { from: 'Secaucus', to: 'Atlanta', distance: 1380, serviceLevel: 'FTL', tempControl: false, customers: ['Titan Auto Parts', 'Harbor Apparel Group'], carriers: ['Atlantic Coastal Express', 'Continental Freight Systems'] },
    { from: 'Chicago', to: 'Memphis', distance: 860, serviceLevel: 'LTL', tempControl: false, customers: [], carriers: ['RegionalPlus LTL', 'Ridgeline Parcel Services'] },
    { from: 'Atlanta', to: 'Miami', distance: 1060, serviceLevel: 'Both', tempControl: false, customers: ['Harbor Apparel Group'], carriers: ['Atlantic Coastal Express', 'RegionalPlus LTL'] },
  ];

  const created: any[] = [];
  for (const d of laneDefs) {
    const origin = loc(d.from);
    const dest = loc(d.to);
    if (!origin || !dest) continue;

    const lane = await prisma.lane.create({
      data: {
        orgId,
        name: `${origin.city} → ${dest.city}`,
        originId: origin.id,
        destinationId: dest.id,
        distance: d.distance,
        serviceLevel: d.serviceLevel,
        supportsTemperatureControl: d.tempControl || false,
        supportsHazmat: d.hazmat || false,
        maxWeight: 22000,
        maxVolume: 100,
        status: 'active',
        notes: `${d.serviceLevel} lane${d.tempControl ? ', reefer capable' : ''}${d.hazmat ? ', hazmat certified' : ''}`,
      },
    });

    for (const custName of d.customers) {
      const cust = customers.find((c) => c.name === custName);
      if (cust) {
        await prisma.customerLane.create({
          data: { customerId: cust.id, laneId: lane.id },
        });
      }
    }

    for (const [idx, carName] of d.carriers.entries()) {
      const car = carriers.find((c) => c.name === carName);
      if (car) {
        const basePerMile = d.tempControl ? 280 : d.hazmat ? 320 : 220; // cents
        const priceCents = Math.floor(basePerMile * d.distance * (0.95 + idx * 0.08));
        await prisma.laneCarrier.create({
          data: {
            laneId: lane.id,
            carrierId: car.id,
            priceCents,
            currency: 'USD',
            serviceLevel: d.serviceLevel === 'Both' ? 'Standard' : d.serviceLevel,
            assigned: idx === 0,
            rateType: 'per_mile',
            isContractRate: true,
            contractStartDate: daysAgo(60),
            contractEndDate: daysFromNow(305),
            fuelSurchargePercent: 18.5,
            accessorialRates: { detention: 7500, lumper: 12500, liftgate: 5000 },
            targetMarginPercent: new Prisma.Decimal('15.00'),
          },
        });
      }
    }

    created.push(lane);
  }
  return created;
}

// ─── Orders with Line Items + Trackable Units ────────────────────────────────

async function seedOrders(
  customers: any[],
  locations: any[],
  palletTypes: any[],
  orgId: string
) {
  const eurPallet = palletTypes.find((p) => p.code === 'EUR1');
  const gmaPallet = palletTypes.find((p) => p.code === 'US_GMA_48x40');
  const plasticPallet = palletTypes.find((p) => p.code === 'PLASTIC_HYG');

  function custByName(name: string) {
    return customers.find((c) => c.name === name);
  }
  function locByCity(city: string) {
    return locations.find((l) => l.city === city);
  }

  const specs = [
    // Nordic Frost - frozen foods
    { cust: 'Nordic Frost Foods', origin: 'Green Bay', dest: 'Denver', service: 'FTL', temp: 'frozen', status: 'converted', delivery: 'in_transit', items: [
      { sku: 'NF-ICECREAM-001', desc: 'Vanilla Ice Cream 4L Tubs', qty: 480, weight: 2400, unitPrice: 850, fclass: '100' },
      { sku: 'NF-FROZENPEA-002', desc: 'Frozen Peas 2kg Bags', qty: 720, weight: 1440, unitPrice: 320, fclass: '125' },
    ], palletType: gmaPallet, unitCount: 20 },
    { cust: 'Nordic Frost Foods', origin: 'Green Bay', dest: 'Phoenix', service: 'FTL', temp: 'frozen', status: 'converted', delivery: 'assigned', items: [
      { sku: 'NF-FISH-004', desc: 'Frozen Atlantic Salmon Fillets', qty: 1200, weight: 6000, unitPrice: 1250, fclass: '85' },
    ], palletType: gmaPallet, unitCount: 24 },
    // Axiom Pharma - refrigerated
    { cust: 'Axiom Pharma', origin: 'Cambridge', dest: 'Rochester', service: 'FTL', temp: 'refrigerated', status: 'converted', delivery: 'delivered', items: [
      { sku: 'AX-VAX-112', desc: 'Flu Vaccine Vials (Refrigerated 2-8°C)', qty: 18000, weight: 540, unitPrice: 4200, fclass: '60' },
      { sku: 'AX-INSULIN-204', desc: 'Insulin Pens (Refrigerated)', qty: 5000, weight: 125, unitPrice: 3500, fclass: '60' },
    ], palletType: plasticPallet, unitCount: 6 },
    // BluePeak Electronics
    { cust: 'BluePeak Electronics', origin: 'San Jose', dest: 'Seattle', service: 'LTL', temp: 'ambient', status: 'validated', delivery: 'unassigned', items: [
      { sku: 'BP-LAPTOP-X1', desc: 'BluePeak X1 Pro Laptop', qty: 240, weight: 480, unitPrice: 180000, fclass: '77.5' },
      { sku: 'BP-MON-27', desc: '27" 4K Monitor', qty: 120, weight: 960, unitPrice: 45000, fclass: '92.5' },
    ], palletType: eurPallet, unitCount: 8 },
    { cust: 'BluePeak Electronics', origin: 'San Jose', dest: 'Chicago', service: 'FTL', temp: 'ambient', status: 'converted', delivery: 'in_transit', items: [
      { sku: 'BP-PHONE-14', desc: 'BluePeak Phone 14 Series', qty: 2400, weight: 480, unitPrice: 95000, fclass: '77.5' },
      { sku: 'BP-TABLET-A', desc: 'BluePeak Tab A10', qty: 800, weight: 320, unitPrice: 35000, fclass: '85' },
    ], palletType: eurPallet, unitCount: 12 },
    // Metro Grocer - refrigerated
    { cust: 'Metro Grocer Co', origin: 'Ontario', dest: 'Denver', service: 'FTL', temp: 'refrigerated', status: 'converted', delivery: 'delivered', items: [
      { sku: 'MG-DAIRY-MILK', desc: 'Whole Milk 4L Jugs', qty: 960, weight: 3840, unitPrice: 420, fclass: '70' },
      { sku: 'MG-PRODUCE-LET', desc: 'Iceberg Lettuce Cases', qty: 480, weight: 2400, unitPrice: 680, fclass: '125' },
      { sku: 'MG-MEAT-CHK', desc: 'Fresh Whole Chickens', qty: 720, weight: 1440, unitPrice: 890, fclass: '85' },
    ], palletType: plasticPallet, unitCount: 26 },
    { cust: 'Metro Grocer Co', origin: 'Ontario', dest: 'Phoenix', service: 'FTL', temp: 'refrigerated', status: 'converted', delivery: 'exception', items: [
      { sku: 'MG-DAIRY-YOG', desc: 'Greek Yogurt 1kg Tubs', qty: 1200, weight: 1200, unitPrice: 520, fclass: '92.5' },
    ], palletType: plasticPallet, unitCount: 15, exceptionType: 'delay', exceptionNotes: 'Stuck at weigh station - DOT inspection in progress' },
    // Titan Auto Parts
    { cust: 'Titan Auto Parts', origin: 'Dallas', dest: 'Columbus', service: 'FTL', temp: 'ambient', status: 'converted', delivery: 'in_transit', items: [
      { sku: 'TA-BRAKE-PAD-F150', desc: 'Brake Pad Set F-150', qty: 400, weight: 3200, unitPrice: 4500, fclass: '70' },
      { sku: 'TA-ALT-GEN2', desc: 'Alternator Assembly Gen2', qty: 150, weight: 1500, unitPrice: 18500, fclass: '85' },
    ], palletType: gmaPallet, unitCount: 18 },
    // GreenField Chemicals - hazmat
    { cust: 'GreenField Chemicals', origin: 'Houston', dest: 'Chicago', service: 'FTL', temp: 'ambient', hazmat: true, status: 'converted', delivery: 'in_transit', items: [
      { sku: 'GF-SOLV-101', desc: 'Industrial Solvent UN1993 (Class 3)', qty: 40, weight: 8000, unitPrice: 12000, fclass: '55' },
    ], palletType: gmaPallet, unitCount: 10 },
    { cust: 'GreenField Chemicals', origin: 'Houston', dest: 'Atlanta', service: 'FTL', temp: 'ambient', hazmat: true, status: 'pending', delivery: 'unassigned', items: [
      { sku: 'GF-ACID-205', desc: 'Sulfuric Acid 98% UN1830 (Class 8)', qty: 20, weight: 9000, unitPrice: 8500, fclass: '60' },
    ], palletType: plasticPallet, unitCount: 10 },
    // Harbor Apparel
    { cust: 'Harbor Apparel Group', origin: 'Long Beach', dest: 'Chicago', service: 'FTL', temp: 'ambient', status: 'converted', delivery: 'delivered', items: [
      { sku: 'HA-TSHIRT-SS24', desc: 'Summer T-Shirt Collection SS24', qty: 4800, weight: 1920, unitPrice: 520, fclass: '100' },
      { sku: 'HA-DENIM-CLSC', desc: 'Classic Denim Jeans', qty: 2400, weight: 2400, unitPrice: 1850, fclass: '100' },
    ], palletType: eurPallet, unitCount: 16 },
    { cust: 'Harbor Apparel Group', origin: 'Savannah', dest: 'Miami', service: 'LTL', temp: 'ambient', status: 'validated', delivery: 'unassigned', items: [
      { sku: 'HA-DRESS-FALL', desc: 'Fall Dress Collection', qty: 600, weight: 360, unitPrice: 3200, fclass: '150' },
    ], palletType: eurPallet, unitCount: 4 },
    // StellarMed - ultra-cold pharma
    { cust: 'StellarMed Laboratories', origin: 'Cambridge', dest: 'Rochester', service: 'FTL', temp: 'frozen', status: 'converted', delivery: 'in_transit', items: [
      { sku: 'SM-MRNA-BATCH22', desc: 'mRNA Therapeutic Batch-22 (-80°C)', qty: 1200, weight: 48, unitPrice: 28500, fclass: '60' },
      { sku: 'SM-BIOSAMP-X', desc: 'Biological Samples Type X', qty: 480, weight: 72, unitPrice: 9500, fclass: '60' },
    ], palletType: plasticPallet, unitCount: 3 },
    { cust: 'StellarMed Laboratories', origin: 'Cambridge', dest: 'Rochester', service: 'FTL', temp: 'frozen', status: 'pending', delivery: 'unassigned', items: [
      { sku: 'SM-BIOSAMP-Y', desc: 'Biological Samples Type Y', qty: 300, weight: 45, unitPrice: 11500, fclass: '60' },
    ], palletType: plasticPallet, unitCount: 2 },
    // Cancelled order
    { cust: 'BluePeak Electronics', origin: 'San Jose', dest: 'Seattle', service: 'LTL', temp: 'ambient', status: 'cancelled', delivery: 'cancelled', items: [
      { sku: 'BP-KBD-MX2', desc: 'Mechanical Keyboard MX2', qty: 200, weight: 200, unitPrice: 22000, fclass: '92.5' },
    ], palletType: eurPallet, unitCount: 3 },
    // Location error (pending lane request)
    { cust: 'Titan Auto Parts', origin: 'Dallas', dest: 'Columbus', service: 'FTL', temp: 'ambient', status: 'location_error', delivery: 'unassigned', items: [
      { sku: 'TA-SPARK-GEN3', desc: 'Spark Plug Set Gen3', qty: 300, weight: 180, unitPrice: 1250, fclass: '92.5' },
    ], palletType: gmaPallet, unitCount: 4 },
  ];

  const created: any[] = [];
  let i = 0;
  for (const s of specs) {
    i++;
    const cust = custByName(s.cust);
    const origin = locByCity(s.origin);
    const dest = locByCity(s.dest);
    if (!cust || !origin || !dest) continue;

    const order = await prisma.order.create({
      data: {
        orgId,
        orderNumber: `ORD-${String(10000 + i).padStart(5, '0')}`,
        poNumber: `PO-${cust.name.split(' ')[0].toUpperCase()}-${String(1000 + i)}`,
        status: s.status,
        importSource: i % 5 === 0 ? 'edi' : 'manual',
        customerId: cust.id,
        originId: origin.id,
        destinationId: dest.id,
        originValidated: true,
        destinationValidated: true,
        orderDate: daysAgo(14 - (i % 12)),
        requestedPickupDate: daysFromNow(-3 + (i % 7)),
        requestedDeliveryDate: daysFromNow(2 + (i % 9)),
        serviceLevel: s.service,
        temperatureControl: s.temp,
        requiresHazmat: s.hazmat || false,
        deliveryStatus: s.delivery,
        deliveredAt: s.delivery === 'delivered' ? daysAgo(2) : null,
        exceptionType: (s as any).exceptionType || null,
        exceptionNotes: (s as any).exceptionNotes || null,
        specialInstructions: s.hazmat ? 'Hazmat placards required. Driver must be HM certified.'
          : s.temp === 'frozen' ? 'Maintain -20°C. Pre-cool trailer prior to loading.'
          : s.temp === 'refrigerated' ? 'Maintain 2-8°C. Temperature log required.'
          : null,
      },
    });

    // Line items
    for (const [idx, item] of s.items.entries()) {
      await prisma.orderLineItem.create({
        data: {
          orderId: order.id,
          sku: item.sku,
          description: item.desc,
          quantity: item.qty,
          weight: item.weight,
          weightUnit: 'kg',
          length: 30 + idx * 5,
          width: 20 + idx * 5,
          height: 15 + idx * 5,
          dimUnit: 'cm',
          hazmat: s.hazmat || false,
          temperature: s.temp,
          unitPriceCents: item.unitPrice,
          totalPriceCents: item.unitPrice * item.qty,
          priceCurrency: 'USD',
          freightClass: item.fclass,
        },
      });
    }

    // Trackable units (pallets)
    for (let u = 1; u <= s.unitCount; u++) {
      await prisma.trackableUnit.create({
        data: {
          orderId: order.id,
          identifier: `${order.orderNumber}-P${String(u).padStart(2, '0')}`,
          unitType: 'pallet',
          sequenceNumber: u,
          barcode: `9${randomBytes(6).toString('hex').toUpperCase()}`,
          packagingTypeId: s.palletType?.id || null,
          condition: 'good',
          qualityStatus: 'available',
          ownerCustomerId: cust.id,
          lotNumber: s.temp !== 'ambient' ? `LOT-${daysAgo(7).toISOString().slice(0, 10)}-${u}` : null,
          expiryDate: s.temp !== 'ambient' ? daysFromNow(180) : null,
        },
      });
    }

    // Pending lane request for location_error orders
    if (s.status === 'location_error') {
      await prisma.pendingLaneRequest.create({
        data: {
          orderId: order.id,
          originId: origin.id,
          destinationId: dest.id,
          serviceLevel: s.service,
          requiresTemperatureControl: s.temp !== 'ambient',
          requiresHazmat: s.hazmat || false,
          status: 'pending',
          notes: 'No active lane for this route - needs ops review',
        },
      });
    }

    created.push(order);
  }

  // ── Bulk fill: more orders spread across the last 90 days so the shipments
  //    view has realistic volume + historical delivered orders.
  const bulk = await seedBulkOrders(
    customers,
    locations,
    palletTypes,
    orgId,
    specs.length,
    60
  );
  created.push(...bulk);

  return created;
}

// Generate N additional realistic orders, distributed across lane customer pairs
// and dated across the last 90 days. Delivery status is weighted so the user
// sees lots of in_transit + delivered and a sprinkle of exceptions / draft.
async function seedBulkOrders(
  customers: any[],
  locations: any[],
  palletTypes: any[],
  orgId: string,
  startIndex: number,
  count: number
): Promise<any[]> {
  const byCity = (city: string) => locations.find((l) => l.city === city);
  const cust = (name: string) => customers.find((c) => c.name === name);

  type RouteDef = {
    cust: string;
    origin: string;
    dest: string;
    service: 'FTL' | 'LTL';
    temp: 'ambient' | 'refrigerated' | 'frozen';
    hazmat?: boolean;
    itemSku: string;
    itemDesc: string;
    lineUnitPrice: number;
    lineWeight: number;
    lineQty: number;
    freightClass: string;
    palletCode: string;
    unitCount: number;
  };

  const routes: RouteDef[] = [
    { cust: 'Nordic Frost Foods', origin: 'Green Bay', dest: 'Denver', service: 'FTL', temp: 'frozen', itemSku: 'NF-PIZZA-005', itemDesc: 'Frozen Pizza 12-pack', lineUnitPrice: 780, lineWeight: 5200, lineQty: 1100, freightClass: '92.5', palletCode: 'US_GMA_48x40', unitCount: 22 },
    { cust: 'Nordic Frost Foods', origin: 'Green Bay', dest: 'Phoenix', service: 'FTL', temp: 'frozen', itemSku: 'NF-BURGER-006', itemDesc: 'Frozen Beef Patties 10kg', lineUnitPrice: 2100, lineWeight: 8000, lineQty: 800, freightClass: '85', palletCode: 'US_GMA_48x40', unitCount: 20 },
    { cust: 'Nordic Frost Foods', origin: 'Green Bay', dest: 'Dallas', service: 'FTL', temp: 'frozen', itemSku: 'NF-FRIES-007', itemDesc: 'Frozen French Fries 4kg', lineUnitPrice: 410, lineWeight: 3200, lineQty: 800, freightClass: '125', palletCode: 'US_GMA_48x40', unitCount: 18 },
    { cust: 'Axiom Pharma', origin: 'Cambridge', dest: 'Rochester', service: 'FTL', temp: 'refrigerated', itemSku: 'AX-VAX-BATCH-42', itemDesc: 'Seasonal Vaccine Batch 42', lineUnitPrice: 4500, lineWeight: 420, lineQty: 12000, freightClass: '60', palletCode: 'PLASTIC_HYG', unitCount: 6 },
    { cust: 'Axiom Pharma', origin: 'Cambridge', dest: 'Rochester', service: 'FTL', temp: 'refrigerated', itemSku: 'AX-BIOLOGIC-88', itemDesc: 'Biologic Monoclonal Antibody', lineUnitPrice: 8900, lineWeight: 180, lineQty: 1500, freightClass: '60', palletCode: 'PLASTIC_HYG', unitCount: 3 },
    { cust: 'BluePeak Electronics', origin: 'San Jose', dest: 'Seattle', service: 'LTL', temp: 'ambient', itemSku: 'BP-WATCH-S2', itemDesc: 'BluePeak Smartwatch S2', lineUnitPrice: 42000, lineWeight: 180, lineQty: 300, freightClass: '77.5', palletCode: 'EUR1', unitCount: 4 },
    { cust: 'BluePeak Electronics', origin: 'San Jose', dest: 'Chicago', service: 'FTL', temp: 'ambient', itemSku: 'BP-EARBUD-P2', itemDesc: 'BluePeak Pro Earbuds P2', lineUnitPrice: 29000, lineWeight: 240, lineQty: 1200, freightClass: '85', palletCode: 'EUR1', unitCount: 8 },
    { cust: 'BluePeak Electronics', origin: 'Long Beach', dest: 'Chicago', service: 'FTL', temp: 'ambient', itemSku: 'BP-TV-55', itemDesc: '55" BluePeak Smart TV', lineUnitPrice: 78000, lineWeight: 3200, lineQty: 200, freightClass: '125', palletCode: 'EUR1', unitCount: 12 },
    { cust: 'Metro Grocer Co', origin: 'Ontario', dest: 'Denver', service: 'FTL', temp: 'refrigerated', itemSku: 'MG-PROD-BER-22', itemDesc: 'Fresh Strawberries 1kg Clamshells', lineUnitPrice: 680, lineWeight: 1200, lineQty: 1200, freightClass: '125', palletCode: 'PLASTIC_HYG', unitCount: 18 },
    { cust: 'Metro Grocer Co', origin: 'Ontario', dest: 'Phoenix', service: 'FTL', temp: 'refrigerated', itemSku: 'MG-DAIRY-CHZ', itemDesc: 'Cheddar Cheese 2kg Blocks', lineUnitPrice: 920, lineWeight: 1840, lineQty: 920, freightClass: '85', palletCode: 'PLASTIC_HYG', unitCount: 20 },
    { cust: 'Metro Grocer Co', origin: 'Ontario', dest: 'Denver', service: 'FTL', temp: 'refrigerated', itemSku: 'MG-MEAT-BEEF', itemDesc: 'Ground Beef 2kg Chubs', lineUnitPrice: 1450, lineWeight: 1840, lineQty: 920, freightClass: '85', palletCode: 'PLASTIC_HYG', unitCount: 20 },
    { cust: 'Titan Auto Parts', origin: 'Dallas', dest: 'Columbus', service: 'FTL', temp: 'ambient', itemSku: 'TA-FILT-AIR', itemDesc: 'Air Filter Assembly', lineUnitPrice: 1800, lineWeight: 480, lineQty: 600, freightClass: '100', palletCode: 'US_GMA_48x40', unitCount: 16 },
    { cust: 'Titan Auto Parts', origin: 'Secaucus', dest: 'Atlanta', service: 'FTL', temp: 'ambient', itemSku: 'TA-BATT-12V', itemDesc: '12V Automotive Battery', lineUnitPrice: 14500, lineWeight: 5400, lineQty: 180, freightClass: '85', palletCode: 'US_GMA_48x40', unitCount: 20 },
    { cust: 'GreenField Chemicals', origin: 'Houston', dest: 'Chicago', service: 'FTL', temp: 'ambient', hazmat: true, itemSku: 'GF-ETHYL-UN1170', itemDesc: 'Ethanol UN1170 (Class 3)', lineUnitPrice: 9500, lineWeight: 9000, lineQty: 45, freightClass: '55', palletCode: 'US_GMA_48x40', unitCount: 10 },
    { cust: 'GreenField Chemicals', origin: 'Houston', dest: 'Atlanta', service: 'FTL', temp: 'ambient', hazmat: true, itemSku: 'GF-CAUSTIC-UN1823', itemDesc: 'Sodium Hydroxide UN1823', lineUnitPrice: 6800, lineWeight: 9200, lineQty: 40, freightClass: '60', palletCode: 'PLASTIC_HYG', unitCount: 10 },
    { cust: 'Harbor Apparel Group', origin: 'Long Beach', dest: 'Chicago', service: 'FTL', temp: 'ambient', itemSku: 'HA-JACKET-WTR', itemDesc: 'Winter Parka Collection', lineUnitPrice: 6800, lineWeight: 1800, lineQty: 900, freightClass: '150', palletCode: 'EUR1', unitCount: 14 },
    { cust: 'Harbor Apparel Group', origin: 'Savannah', dest: 'Miami', service: 'LTL', temp: 'ambient', itemSku: 'HA-SWIM-SS25', itemDesc: 'Summer Swimwear SS25', lineUnitPrice: 2400, lineWeight: 360, lineQty: 800, freightClass: '150', palletCode: 'EUR1', unitCount: 5 },
    { cust: 'StellarMed Laboratories', origin: 'Cambridge', dest: 'Rochester', service: 'FTL', temp: 'frozen', itemSku: 'SM-CELL-A12', itemDesc: 'Cell Therapy A12 (Ultra-Cold)', lineUnitPrice: 32000, lineWeight: 28, lineQty: 600, freightClass: '60', palletCode: 'PLASTIC_HYG', unitCount: 2 },
  ];

  // Delivery status distribution (weights out of 100) — focused on operational activity.
  // delivered:45 / in_transit:28 / assigned:10 / exception:6 / unassigned:8 / cancelled:3
  const pickDeliveryStatus = (rng: number): string => {
    if (rng < 45) return 'delivered';
    if (rng < 73) return 'in_transit';
    if (rng < 83) return 'assigned';
    if (rng < 89) return 'exception';
    if (rng < 97) return 'unassigned';
    return 'cancelled';
  };

  const created: any[] = [];
  for (let i = 0; i < count; i++) {
    const r = routes[i % routes.length];
    const customer = cust(r.cust);
    const origin = byCity(r.origin);
    const dest = byCity(r.dest);
    if (!customer || !origin || !dest) continue;

    const palletType = palletTypes.find((p) => p.code === r.palletCode);
    const delivery = pickDeliveryStatus(Math.floor((i * 37 + 11) % 100));
    // Spread ages: delivered orders 7-90 days ago, in_transit 0-6 days, others 0-21 days
    const ageDays = delivery === 'delivered'
      ? 7 + ((i * 13) % 84)
      : delivery === 'in_transit' || delivery === 'assigned' || delivery === 'exception'
        ? (i * 7) % 7
        : (i * 11) % 22;

    const orderDate = daysAgo(ageDays + 1);
    const pickupDate = daysAgo(ageDays);
    const deliveryDate = delivery === 'delivered'
      ? daysAgo(Math.max(0, ageDays - 2))
      : daysFromNow(2 + ((i * 5) % 6));
    const deliveredAt = delivery === 'delivered' ? daysAgo(Math.max(0, ageDays - 2)) : null;

    const status =
      delivery === 'cancelled' ? 'cancelled'
      : delivery === 'unassigned' ? 'validated'
      : 'converted';

    const orderNumber = `ORD-${String(10000 + startIndex + i + 1).padStart(5, '0')}`;
    const order = await prisma.order.create({
      data: {
        orgId,
        orderNumber,
        poNumber: `PO-${r.cust.split(' ')[0].toUpperCase()}-${String(startIndex + i + 2000)}`,
        status,
        importSource: i % 4 === 0 ? 'edi' : i % 5 === 0 ? 'csv' : 'manual',
        customerId: customer.id,
        originId: origin.id,
        destinationId: dest.id,
        originValidated: true,
        destinationValidated: true,
        orderDate,
        requestedPickupDate: pickupDate,
        requestedDeliveryDate: deliveryDate,
        serviceLevel: r.service,
        temperatureControl: r.temp,
        requiresHazmat: r.hazmat || false,
        deliveryStatus: delivery,
        deliveredAt,
        exceptionType: delivery === 'exception' ? pick(['delay', 'weather', 'address_issue', 'damage']) : null,
        exceptionNotes: delivery === 'exception' ? 'Auto-generated exception for demo data' : null,
        specialInstructions: r.hazmat ? 'Hazmat placards required.'
          : r.temp === 'frozen' ? 'Maintain -20°C. Pre-cool trailer.'
          : r.temp === 'refrigerated' ? 'Maintain 2-8°C.'
          : null,
      },
    });

    await prisma.orderLineItem.create({
      data: {
        orderId: order.id,
        sku: r.itemSku,
        description: r.itemDesc,
        quantity: r.lineQty,
        weight: r.lineWeight,
        weightUnit: 'kg',
        length: 40,
        width: 30,
        height: 20,
        dimUnit: 'cm',
        hazmat: r.hazmat || false,
        temperature: r.temp,
        unitPriceCents: r.lineUnitPrice,
        totalPriceCents: r.lineUnitPrice * r.lineQty,
        priceCurrency: 'USD',
        freightClass: r.freightClass,
      },
    });

    for (let u = 1; u <= r.unitCount; u++) {
      await prisma.trackableUnit.create({
        data: {
          orderId: order.id,
          identifier: `${orderNumber}-P${String(u).padStart(2, '0')}`,
          unitType: 'pallet',
          sequenceNumber: u,
          barcode: `9${randomBytes(6).toString('hex').toUpperCase()}`,
          packagingTypeId: palletType?.id || null,
          condition: 'good',
          qualityStatus: 'available',
          ownerCustomerId: customer.id,
          lotNumber: r.temp !== 'ambient' ? `LOT-${daysAgo(Math.min(30, ageDays + 3)).toISOString().slice(0, 10)}-${u}` : null,
          expiryDate: r.temp !== 'ambient' ? daysFromNow(180 - ageDays) : null,
        },
      });
    }

    created.push(order);
  }

  return created;
}

// ─── Shipments with Stops + Loads + OrderShipment links ─────────────────────

async function seedShipments(
  orders: any[],
  lanes: any[],
  carriers: any[],
  locations: any[],
  coldChainProfiles: any[],
  orgId: string,
) {
  const created: any[] = [];
  // Only convert non-pending / non-cancelled / non-location_error orders to shipments
  const shippableOrders = orders.filter((o) =>
    ['converted', 'validated'].includes(o.status) && o.deliveryStatus !== 'cancelled'
  );

  const frozenProfile = coldChainProfiles.find((p) => p.name.startsWith('Frozen'));
  const refrigProfile = coldChainProfiles.find((p) => p.name.startsWith('Refrigerated'));
  const ultraColdProfile = coldChainProfiles.find((p) => p.name.startsWith('Ultra-Cold'));

  let refCounter = 1;
  for (const order of shippableOrders) {
    const lane = lanes.find((l) => l.originId === order.originId && l.destinationId === order.destinationId);
    // Pick a carrier with a lane contract
    let carrier: any = null;
    if (lane) {
      const lc = await prisma.laneCarrier.findFirst({ where: { laneId: lane.id, assigned: true } });
      if (lc) carrier = carriers.find((c) => c.id === lc.carrierId);
    }
    if (!carrier) carrier = pick(carriers);

    const status =
      order.deliveryStatus === 'delivered' ? 'delivered'
      : order.deliveryStatus === 'in_transit' ? 'in_transit'
      : order.deliveryStatus === 'exception' ? 'exception'
      : order.deliveryStatus === 'assigned' ? 'in_transit'
      : 'draft';

    // Cold chain profile based on temp
    let profileId: string | null = null;
    let effMin: number | null = null;
    let effMax: number | null = null;
    let effAlertMin: number | null = null;
    let effAlertMax: number | null = null;
    let disposition = 'not_applicable';
    if (order.temperatureControl === 'frozen' && order.customerId) {
      const isStellar = (await prisma.customer.findUnique({ where: { id: order.customerId } }))?.name === 'StellarMed Laboratories';
      const profile = isStellar ? ultraColdProfile : frozenProfile;
      profileId = profile.id;
      effMin = profile.minTemperature;
      effMax = profile.maxTemperature;
      effAlertMin = profile.alertMinTemperature;
      effAlertMax = profile.alertMaxTemperature;
      disposition = status === 'delivered' ? 'released' : 'monitoring';
    } else if (order.temperatureControl === 'refrigerated') {
      profileId = refrigProfile.id;
      effMin = refrigProfile.minTemperature;
      effMax = refrigProfile.maxTemperature;
      effAlertMin = refrigProfile.alertMinTemperature;
      effAlertMax = refrigProfile.alertMaxTemperature;
      disposition = status === 'delivered' ? 'released' : 'monitoring';
    }

    const shipment = await prisma.shipment.create({
      data: {
        orgId,
        reference: `SHP-${String(refCounter++).padStart(5, '0')}`,
        status,
        pickupDate: order.requestedPickupDate,
        deliveryDate: order.requestedDeliveryDate,
        proNumber: `PRO-${randomBytes(4).toString('hex').toUpperCase()}`,
        customerId: order.customerId,
        originId: order.originId,
        destinationId: order.destinationId,
        laneId: lane?.id || null,
        carrierId: carrier.id,
        coldChainProfileId: profileId,
        effectiveMinTemp: effMin,
        effectiveMaxTemp: effMax,
        effectiveAlertMinTemp: effAlertMin,
        effectiveAlertMaxTemp: effAlertMax,
        coldChainDisposition: disposition,
        dispositionSetAt: disposition !== 'not_applicable' ? new Date() : null,
        trackingNumber: `TRK${randomBytes(5).toString('hex').toUpperCase()}`,
        launchedAt: status !== 'draft' ? (order.requestedPickupDate || daysAgo(1)) : null,
        items: {
          totalWeight: 2500,
          totalPallets: 10,
        },
      },
    });

    // Stops: pickup + delivery
    const pickupActual = order.requestedPickupDate || daysAgo(1);
    const pickup = await prisma.shipmentStop.create({
      data: {
        shipmentId: shipment.id,
        locationId: order.originId,
        sequenceNumber: 1,
        stopType: 'pickup',
        status: status === 'delivered' || status === 'in_transit' ? 'completed' : 'pending',
        estimatedArrival: order.requestedPickupDate,
        actualArrival: status !== 'draft' ? pickupActual : null,
        actualDeparture: status !== 'draft' ? pickupActual : null,
        geofenceEnabled: true,
        geofenceRadius: 250,
        instructions: 'Check in at dock office. Bring BOL.',
      },
    });
    const deliveryActual = order.deliveredAt || order.requestedDeliveryDate || daysAgo(0);
    const delivery = await prisma.shipmentStop.create({
      data: {
        shipmentId: shipment.id,
        locationId: order.destinationId,
        sequenceNumber: 2,
        stopType: 'delivery',
        status: status === 'delivered' ? 'completed' : 'pending',
        estimatedArrival: order.requestedDeliveryDate,
        actualArrival: status === 'delivered' ? deliveryActual : null,
        actualDeparture: status === 'delivered' ? deliveryActual : null,
        geofenceEnabled: true,
        geofenceRadius: 250,
        instructions: status === 'delivered' ? 'Delivered to receiving.' : 'Call ahead 30 min. Signature required.',
        signatureUrl: status === 'delivered' ? 'demo-signature.png' : null,
      },
    });

    // Link delivery stop to the order
    await prisma.order.update({
      where: { id: order.id },
      data: { deliveryStopId: delivery.id },
    });

    // Order <-> Shipment link
    await prisma.orderShipment.create({
      data: { orderId: order.id, shipmentId: shipment.id },
    });

    // Load
    const vehicle = await prisma.vehicle.findFirst({ where: { carrierId: carrier.id } });
    const driver = await prisma.driver.findFirst({ where: { carrierId: carrier.id } });
    if (vehicle && driver) {
      await prisma.load.create({
        data: {
          shipmentId: shipment.id,
          vehicleId: vehicle.id,
          driverId: driver.id,
          assignedAt: status !== 'draft' ? daysAgo(2) : null,
        },
      });
    }

    // Shipment events (for in_transit)
    if (status === 'in_transit' || status === 'exception') {
      await prisma.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          eventType: 'status_change',
          eventTime: daysAgo(1),
          locationSummary: `Picked up at ${order.originId}`,
        },
      });
    }

    created.push({ shipment, order, pickup, delivery });
  }
  return created;
}

// ─── Devices + Assignments + Sensor Readings ────────────────────────────────

async function seedDevices(shipmentRecords: any[], orgId: string) {
  const inTransit = shipmentRecords.filter((r) =>
    r.shipment.status === 'in_transit' || r.shipment.status === 'exception'
  );

  const devices: any[] = [];
  for (const [i, r] of inTransit.entries()) {
    const device = await prisma.device.create({
      data: {
        orgId,
        externalId: `SL-${randomBytes(8).toString('hex').toUpperCase()}`,
        displayId: `HG-${String(10000 + i).padStart(5, '0')}`,
        name: r.shipment.reference,
        provider: 'system_loco',
        model: 'HGx',
        manufacturer: 'System Loco',
        firmware: '4.2.1',
        status: 'active',
        batteryLevel: 60 + Math.floor(Math.random() * 40),
        lastSeenAt: minutesAgo(10 + Math.floor(Math.random() * 30)),
        lastLat: 37.5 + Math.random() * 10,
        lastLng: -95 - Math.random() * 20,
      },
    });

    await prisma.deviceAssignment.create({
      data: {
        deviceId: device.id,
        shipmentId: r.shipment.id,
        orderId: r.order.id,
        active: true,
        assignedAt: daysAgo(2),
      },
    });

    // Calibration for cold-chain devices
    if (r.shipment.coldChainProfileId) {
      await prisma.deviceCalibration.create({
        data: {
          orgId: (await prisma.organization.findFirst())!.id,
          deviceId: device.id,
          calibratedAt: daysAgo(30),
          calibratedBy: 'NIST Calibration Lab',
          certificateNumber: `CAL-${randomBytes(4).toString('hex').toUpperCase()}`,
          expiresAt: daysFromNow(335),
          calibrationMethod: 'NIST traceable, 2-point',
          accuracy: 0.5,
          status: 'valid',
        },
      });
    }

    // Sensor readings — one every 2 hours for last day
    const min = r.shipment.effectiveMinTemp ?? 15;
    const max = r.shipment.effectiveMaxTemp ?? 25;
    const centreTemp = (min + max) / 2;
    for (let h = 0; h < 12; h++) {
      // Inject an excursion for an exception shipment
      const isExcursion = r.shipment.status === 'exception' && h === 6;
      const temp = r.shipment.coldChainProfileId
        ? isExcursion ? max + 3 : centreTemp + (Math.random() - 0.5) * (max - min) * 0.6
        : 20 + (Math.random() - 0.5) * 5;

      await prisma.sensorReading.create({
        data: {
          deviceId: device.id,
          shipmentId: r.shipment.id,
          orderId: r.order.id,
          eventTime: minutesAgo(h * 120),
          temperature: temp,
          humidity: r.shipment.coldChainProfileId ? 55 + Math.random() * 20 : null,
          batteryLevel: 60 + Math.floor(Math.random() * 40) - h,
          movement: h < 10 ? 'moving' : 'stationary',
          lat: 37.5 + Math.random() * 10,
          lng: -95 - Math.random() * 20,
          tempMin: min,
          tempMax: max,
          isAlert: isExcursion,
          alertType: isExcursion ? 'temperature' : null,
        },
      });
    }

    devices.push(device);
  }
  return devices;
}

// ─── Tenders with Offers + Bids ─────────────────────────────────────────────

async function seedTenders(shipmentRecords: any[], carriers: any[], creatorUserId: string) {
  const tenders: any[] = [];
  let tndCounter = 1;

  // Pick a few shipments to have tenders in various states
  const tenderCandidates = shipmentRecords.filter((r) => r.shipment.status === 'draft').slice(0, 4);

  // Also add one "awarded" tender for an in_transit shipment
  const awardedCandidate = shipmentRecords.find((r) => r.shipment.status === 'in_transit');
  if (awardedCandidate) tenderCandidates.push(awardedCandidate);

  const states = ['draft', 'open', 'open', 'evaluating', 'awarded'];

  for (const [idx, r] of tenderCandidates.entries()) {
    const state = states[idx % states.length];
    const strategy = idx % 2 === 0 ? 'broadcast' : 'waterfall';
    const targetCarriers = carriers.slice(0, 4);

    const tender = await prisma.tender.create({
      data: {
        shipmentId: r.shipment.id,
        reference: `TND-${String(tndCounter++).padStart(4, '0')}`,
        strategy,
        status: state,
        tenderDurationMinutes: 180,
        targetRate: 1800 + idx * 200,
        currency: 'USD',
        equipmentType: r.shipment.coldChainProfileId ? "53' Reefer" : "53' Dry Van",
        notes: `Auto-created from shipment ${r.shipment.reference}`,
        specialInstructions: 'Temperature-controlled, contract lane carriers preferred.',
        openedAt: state !== 'draft' ? daysAgo(1) : null,
        closedAt: state === 'awarded' ? minutesAgo(60) : null,
        awardedAt: state === 'awarded' ? minutesAgo(55) : null,
        createdBy: creatorUserId,
      },
    });

    // Offers (1 per carrier)
    const offers: any[] = [];
    for (const [i, c] of targetCarriers.entries()) {
      const offerStatus =
        state === 'draft' ? 'pending'
        : state === 'awarded' && i === 0 ? 'viewed'
        : state === 'open' ? (i === 0 ? 'viewed' : 'sent')
        : 'sent';

      const offer = await prisma.tenderOffer.create({
        data: {
          tenderId: tender.id,
          carrierId: c.id,
          sequence: strategy === 'waterfall' ? i + 1 : 1,
          status: offerStatus,
          sentAt: state !== 'draft' ? daysAgo(1) : null,
          expiresAt: state !== 'draft' ? daysFromNow(1) : null,
          viewedAt: offerStatus === 'viewed' ? minutesAgo(90) : null,
          ediSent: i === 0,
          edi204Content: i === 0 ? `ISA*00* *00* *ZZ*MERIDIAN       *ZZ*${c.scacCode || 'CARRIER'}        *...demo EDI 204...` : null,
        },
      });
      offers.push(offer);
    }

    // Bids — only for open/evaluating/awarded tenders
    if (state !== 'draft') {
      const bidCount = state === 'awarded' ? 3 : Math.min(offers.length, 2 + Math.floor(Math.random() * 2));
      for (let b = 0; b < bidCount; b++) {
        const offer = offers[b];
        const carrier = targetCarriers[b];
        const carrierUser = await prisma.carrierUser.findFirst({ where: { carrierId: carrier.id } });
        const rate = 1850 + b * 120 + Math.floor(Math.random() * 200);
        const bidStatus = state === 'awarded' && b === 0 ? 'accepted' : state === 'awarded' ? 'rejected' : 'submitted';

        await prisma.tenderBid.create({
          data: {
            tenderId: tender.id,
            tenderOfferId: offer.id,
            carrierId: carrier.id,
            rate,
            currency: 'USD',
            transitDays: 2 + b,
            equipmentType: "53' Dry Van",
            notes: b === 0 ? 'Can commit to pickup window. Team driver available.' : null,
            status: bidStatus,
            submittedAt: minutesAgo(120 - b * 20),
            respondedAt: bidStatus !== 'submitted' ? minutesAgo(60) : null,
            submittedById: carrierUser?.id || null,
            sourceType: b === 1 ? 'edi_990' : 'portal',
            edi990Content: b === 1 ? 'ISA*00*...demo EDI 990...' : null,
          },
        });
      }
    }

    tenders.push(tender);
  }
  return tenders;
}

// ─── Charges + Financial Summary ────────────────────────────────────────────

async function seedCharges(shipmentRecords: any[], orgId: string) {
  for (const r of shipmentRecords) {
    if (r.shipment.status === 'draft') continue;

    const lineItems = await prisma.orderLineItem.findMany({ where: { orderId: r.order.id } });
    const declaredValue = lineItems.reduce((sum, li) => sum + (li.totalPriceCents || 0), 0);

    // Revenue charges (what customer pays us)
    const baseRevenue = Math.max(180000, Math.floor(declaredValue * 0.08));
    await prisma.charge.create({
      data: {
        orgId,
        shipmentId: r.shipment.id,
        orderId: r.order.id,
        chargeType: 'linehaul',
        chargeCategory: 'revenue',
        description: 'Linehaul charge (customer)',
        amountCents: baseRevenue,
        source: 'contract_rate',
        status: 'approved',
      },
    });
    const fuelRev = Math.floor(baseRevenue * 0.22);
    await prisma.charge.create({
      data: {
        orgId,
        shipmentId: r.shipment.id,
        orderId: r.order.id,
        chargeType: 'fuel_surcharge',
        chargeCategory: 'revenue',
        description: 'Fuel surcharge (customer)',
        amountCents: fuelRev,
        source: 'contract_rate',
        status: 'approved',
      },
    });

    // Cost charges (what we pay carrier)
    const baseCost = Math.floor(baseRevenue * 0.78);
    await prisma.charge.create({
      data: {
        orgId,
        shipmentId: r.shipment.id,
        orderId: r.order.id,
        chargeType: 'linehaul',
        chargeCategory: 'cost',
        description: 'Linehaul cost (carrier)',
        amountCents: baseCost,
        source: 'tender_bid',
        status: 'approved',
      },
    });
    const fuelCost = Math.floor(baseCost * 0.22);
    await prisma.charge.create({
      data: {
        orgId,
        shipmentId: r.shipment.id,
        orderId: r.order.id,
        chargeType: 'fuel_surcharge',
        chargeCategory: 'cost',
        description: 'Fuel surcharge (carrier)',
        amountCents: fuelCost,
        source: 'tender_bid',
        status: 'approved',
      },
    });

    const expectedRevenue = baseRevenue + fuelRev;
    const expectedCost = baseCost + fuelCost;

    await prisma.shipmentFinancialSummary.create({
      data: {
        orgId,
        shipmentId: r.shipment.id,
        expectedRevenueCents: expectedRevenue,
        expectedCostCents: expectedCost,
        expectedMarginCents: expectedRevenue - expectedCost,
        actualRevenueCents: r.shipment.status === 'delivered' ? expectedRevenue : 0,
        actualCostCents: r.shipment.status === 'delivered' ? expectedCost : 0,
        actualMarginCents: r.shipment.status === 'delivered' ? expectedRevenue - expectedCost : 0,
        billingStatus: r.shipment.status === 'delivered' ? 'ready_to_invoice' : 'not_ready',
        podReceived: r.shipment.status === 'delivered',
        carrierPaymentStatus: r.shipment.status === 'delivered' ? 'invoice_received' : 'not_ready',
      },
    });
  }
}

// ─── Quotes ─────────────────────────────────────────────────────────────────

async function seedQuotes(customers: any[], locations: any[], orgId: string, creatorId: string) {
  const defs = [
    { cust: 'Nordic Frost Foods', origin: 'Green Bay', dest: 'Denver', status: 'accepted', lh: 320000, fuel: 70000 },
    { cust: 'BluePeak Electronics', origin: 'San Jose', dest: 'Chicago', status: 'sent', lh: 480000, fuel: 105000 },
    { cust: 'Axiom Pharma', origin: 'Cambridge', dest: 'Rochester', status: 'draft', lh: 560000, fuel: 125000 },
    { cust: 'Harbor Apparel Group', origin: 'Long Beach', dest: 'Chicago', status: 'declined', lh: 440000, fuel: 98000 },
  ];
  let i = 1;
  for (const d of defs) {
    const cust = customers.find((c) => c.name === d.cust);
    const origin = locations.find((l) => l.city === d.origin);
    const dest = locations.find((l) => l.city === d.dest);
    if (!cust || !origin || !dest) continue;

    const revenue = d.lh + d.fuel;
    const cost = Math.floor(revenue * 0.80);
    const margin = revenue - cost;
    const quote = await prisma.quote.create({
      data: {
        orgId,
        quoteNumber: `QTE-${String(1000 + i).padStart(5, '0')}`,
        version: 1,
        status: d.status,
        customerId: cust.id,
        originId: origin.id,
        destinationId: dest.id,
        serviceLevel: 'FTL',
        equipmentType: "53' Dry Van",
        totalRevenueCents: revenue,
        totalCostCents: cost,
        marginCents: margin,
        marginPercent: new Prisma.Decimal((margin / revenue * 100).toFixed(2)),
        currency: 'USD',
        validFrom: daysAgo(7),
        validUntil: daysFromNow(21),
        createdBy: creatorId,
      },
    });
    await prisma.quoteLineItem.create({
      data: { quoteId: quote.id, chargeType: 'linehaul', description: 'Linehaul', amountCents: d.lh },
    });
    await prisma.quoteLineItem.create({
      data: { quoteId: quote.id, chargeType: 'fuel_surcharge', description: 'Fuel surcharge', amountCents: d.fuel },
    });
    i++;
  }
}

// ─── Invoices (AR) ──────────────────────────────────────────────────────────

async function seedInvoices(shipmentRecords: any[], orgId: string) {
  const delivered = shipmentRecords.filter((r) => r.shipment.status === 'delivered');
  let i = 1;
  for (const r of delivered) {
    const charges = await prisma.charge.findMany({
      where: { shipmentId: r.shipment.id, chargeCategory: 'revenue' },
    });
    const subtotal = charges.reduce((s, c) => s + c.amountCents, 0);
    const tax = 0;
    const total = subtotal + tax;
    const firstTwo = i === 1; // mark first one as paid
    const paid = firstTwo ? total : Math.floor(total * (i === 2 ? 0.5 : 0));
    const status = paid === total ? 'paid' : paid > 0 ? 'partial_paid' : 'sent';

    const inv = await prisma.invoice.create({
      data: {
        orgId,
        invoiceNumber: `INV-${daysAgo(0).toISOString().slice(0, 10).replace(/-/g, '')}-${String(i).padStart(4, '0')}`,
        customerId: r.order.customerId,
        status,
        subtotalCents: subtotal,
        taxCents: tax,
        totalCents: total,
        paidCents: paid,
        balanceCents: total - paid,
        paymentTermsDays: 30,
        issueDate: daysAgo(10),
        dueDate: daysFromNow(20),
        sentAt: daysAgo(9),
        paidAt: paid === total ? daysAgo(2) : null,
      },
    });

    for (const c of charges) {
      await prisma.invoiceLineItem.create({
        data: {
          invoiceId: inv.id,
          shipmentId: r.shipment.id,
          orderId: r.order.id,
          chargeId: c.id,
          chargeType: c.chargeType,
          description: c.description,
          quantity: 1,
          unitPriceCents: c.amountCents,
          totalCents: c.amountCents,
        },
      });
    }

    if (paid > 0) {
      await prisma.payment.create({
        data: {
          orgId,
          invoiceId: inv.id,
          amountCents: paid,
          paymentMethod: 'ach',
          referenceNumber: `ACH-${randomBytes(4).toString('hex').toUpperCase()}`,
          receivedDate: daysAgo(3),
        },
      });
    }

    i++;
  }
}

// ─── Carrier Invoices (AP) ──────────────────────────────────────────────────

async function seedCarrierInvoices(shipmentRecords: any[], orgId: string) {
  const delivered = shipmentRecords.filter((r) => r.shipment.status === 'delivered');
  let i = 1;
  for (const r of delivered) {
    const charges = await prisma.charge.findMany({
      where: { shipmentId: r.shipment.id, chargeCategory: 'cost' },
    });
    const total = charges.reduce((s, c) => s + c.amountCents, 0);
    // Inject a small variance on the second invoice
    const invoicedTotal = i === 2 ? total + 15000 : total;
    const variance = invoicedTotal - total;
    const matchStatus = variance === 0 ? 'matched' : Math.abs(variance) <= 5000 ? 'partial_match' : 'mismatch';
    const status = matchStatus === 'matched' ? 'approved' : 'discrepancy';

    const inv = await prisma.carrierInvoice.create({
      data: {
        orgId,
        invoiceNumber: `CAR-INV-${randomBytes(3).toString('hex').toUpperCase()}-${i}`,
        carrierId: r.shipment.carrierId!,
        status,
        totalCents: invoicedTotal,
        approvedCents: status === 'approved' ? invoicedTotal : null,
        paidCents: 0,
        receivedDate: daysAgo(5),
        dueDate: daysFromNow(25),
        matchStatus,
        varianceCents: variance,
        variancePercent: new Prisma.Decimal((variance / total * 100).toFixed(2)),
        autoApproved: status === 'approved' && variance === 0,
      },
    });

    for (const c of charges) {
      await prisma.carrierInvoiceLineItem.create({
        data: {
          carrierInvoiceId: inv.id,
          shipmentId: r.shipment.id,
          chargeId: c.id,
          chargeType: c.chargeType,
          description: c.description,
          amountCents: c.amountCents + (i === 2 && c.chargeType === 'linehaul' ? 15000 : 0),
          expectedAmountCents: c.amountCents,
          varianceCents: i === 2 && c.chargeType === 'linehaul' ? 15000 : 0,
          matchStatus: i === 2 && c.chargeType === 'linehaul' ? 'variance' : 'matched',
        },
      });
    }

    i++;
  }
}

// ─── Issues + Labels + Comments ─────────────────────────────────────────────

async function seedIssues(
  orgId: string,
  shipmentRecords: any[],
  labels: any[],
  userId: string
) {
  const labelByName = Object.fromEntries(labels.map((l) => [l.name, l]));

  // Issue 1: Open, delay, on an exception shipment
  const exceptionShipment = shipmentRecords.find((r) => r.shipment.status === 'exception');
  if (exceptionShipment) {
    const issue = await prisma.issue.create({
      data: {
        orgId,
        title: `Delay: ${exceptionShipment.shipment.reference} stuck at weigh station`,
        description: 'Driver reported stuck at Arizona weigh station, DOT inspection in progress. ETA impacted by 4-6 hours.',
        status: 'in_progress',
        priority: 'high',
        category: 'delay',
        sourceEntityType: 'shipment',
        sourceEntityId: exceptionShipment.shipment.id,
        assigneeId: userId,
        assigneeName: 'Marcus Okafor',
      },
    });
    await prisma.issueLabelAssignment.create({
      data: { issueId: issue.id, labelId: labelByName['delay'].id },
    });
    await prisma.issueLabelAssignment.create({
      data: { issueId: issue.id, labelId: labelByName['cold-chain'].id },
    });
    await prisma.comment.create({
      data: {
        orgId,
        entityType: 'issue',
        entityId: issue.id,
        authorId: userId,
        authorName: 'Marcus Okafor',
        authorType: 'user',
        body: 'Contacted driver. Reefer is holding +4°C, within range. DOT ETA release: ~2 hours.',
      },
    });
    await prisma.comment.create({
      data: {
        orgId,
        entityType: 'issue',
        entityId: issue.id,
        authorName: 'Triage Agent',
        authorType: 'agent',
        body: 'Classified as delay / high priority. Customer (Metro Grocer Co) has weekly consolidation, no immediate customer impact. Monitoring temperature telemetry.',
      },
    });
  }

  // Issue 2: Resolved, damage
  const deliveredShipment = shipmentRecords.find((r) => r.shipment.status === 'delivered');
  if (deliveredShipment) {
    const issue = await prisma.issue.create({
      data: {
        orgId,
        title: `Damage reported: 2 pallets on ${deliveredShipment.shipment.reference}`,
        description: 'Receiver flagged 2 pallets with crushed corners. Photos uploaded to POD.',
        status: 'resolved',
        priority: 'medium',
        category: 'damage',
        sourceEntityType: 'shipment',
        sourceEntityId: deliveredShipment.shipment.id,
        resolvedAt: daysAgo(1),
        resolvedBy: userId,
        resolution: 'Filed claim with carrier. Credit issued to customer $420.',
        needsCapa: true,
      },
    });
    await prisma.issueLabelAssignment.create({
      data: { issueId: issue.id, labelId: labelByName['damage'].id },
    });
  }

  // Issue 3: Open, compliance, hazmat
  const hazmatOrder = await prisma.order.findFirst({ where: { requiresHazmat: true } });
  if (hazmatOrder) {
    const issue = await prisma.issue.create({
      data: {
        orgId,
        title: `Hazmat placard check required: ${hazmatOrder.orderNumber}`,
        description: 'Load contains UN1993 Class 3. Driver must confirm placarding before departure.',
        status: 'open',
        priority: 'critical',
        category: 'compliance',
        sourceEntityType: 'order',
        sourceEntityId: hazmatOrder.id,
      },
    });
    await prisma.issueLabelAssignment.create({
      data: { issueId: issue.id, labelId: labelByName['hazmat'].id },
    });
    await prisma.issueLabelAssignment.create({
      data: { issueId: issue.id, labelId: labelByName['compliance'].id },
    });
  }

  // Issue 4: Snoozed
  await prisma.issue.create({
    data: {
      orgId,
      title: 'Review carrier insurance expiry: RegionalPlus LTL',
      description: 'Certificate of insurance expires in 45 days. Follow up with carrier ops.',
      status: 'open',
      priority: 'low',
      category: 'compliance',
      snoozedUntil: daysFromNow(14),
      snoozedBy: userId,
      snoozedReason: 'Follow up in 2 weeks',
    },
  });

  // Issue 5: Closed
  await prisma.issue.create({
    data: {
      orgId,
      title: 'Missing POD: prior shipment investigation',
      description: 'Receiver did not sign POD. Resolved via photo evidence from driver app.',
      status: 'closed',
      priority: 'medium',
      category: 'exception',
      resolvedAt: daysAgo(5),
      resolution: 'POD reconstructed from driver photos and geofence confirmation.',
      closedAt: daysAgo(4),
      closedBy: userId,
    },
  });
}

// ─── SLA Policies + Rules ───────────────────────────────────────────────────

async function seedSla(orgId: string, customers: any[]) {
  const orgPolicy = await prisma.slaPolicy.create({
    data: {
      orgId,
      name: 'Standard SLA',
      description: 'Org-wide default service level',
      active: true,
    },
  });

  const rules = [
    { ruleType: 'eta_delivery', name: 'On-time delivery', warningThresholdMinutes: 30, breachThresholdMinutes: 60, criticalThresholdMinutes: 120, autoCreateIssue: true, issuePriorityOnBreach: 'high' },
    { ruleType: 'issue_response', name: 'Critical issue response', warningThresholdMinutes: 15, breachThresholdMinutes: 30, issuePriority: 'critical', autoCreateIssue: false, issuePriorityOnBreach: 'critical' },
    { ruleType: 'issue_resolution', name: 'High priority issue resolution', warningThresholdMinutes: 240, breachThresholdMinutes: 480, issuePriority: 'high', autoCreateIssue: false, issuePriorityOnBreach: 'critical' },
    { ruleType: 'dwell_time', name: 'Dock dwell time', maxDwellMinutes: 120, dwellLocationType: 'any', autoCreateIssue: true, issuePriorityOnBreach: 'medium' },
    { ruleType: 'temperature_excursion', name: 'Temperature excursion tolerance', maxExcursionMinutes: 15, autoCreateIssue: true, issuePriorityOnBreach: 'critical' },
  ];

  for (const r of rules) {
    await prisma.slaRule.create({ data: { policyId: orgPolicy.id, ...r } as any });
  }

  // Customer override for Axiom Pharma - tighter SLA
  const axiom = customers.find((c) => c.name === 'Axiom Pharma');
  if (axiom) {
    const override = await prisma.slaPolicy.create({
      data: {
        orgId,
        customerId: axiom.id,
        name: 'Axiom Pharma Premium SLA',
        description: 'Tighter thresholds for cold-chain pharma customer',
        active: true,
      },
    });
    await prisma.slaRule.create({
      data: {
        policyId: override.id,
        ruleType: 'eta_delivery',
        name: 'On-time delivery (pharma)',
        warningThresholdMinutes: 15,
        breachThresholdMinutes: 30,
        criticalThresholdMinutes: 60,
        autoCreateIssue: true,
        issuePriorityOnBreach: 'critical',
      },
    });
    await prisma.slaRule.create({
      data: {
        policyId: override.id,
        ruleType: 'temperature_excursion',
        name: 'Zero-tolerance temperature excursion',
        maxExcursionMinutes: 5,
        autoCreateIssue: true,
        issuePriorityOnBreach: 'critical',
      },
    });
  }
}

// ─── Trading Partners + EDI Logs ────────────────────────────────────────────

async function seedTradingPartners(customers: any[], carriers: any[], orgId: string) {
  const nordic = customers.find((c) => c.name === 'Nordic Frost Foods');
  const metro = customers.find((c) => c.name === 'Metro Grocer Co');
  const continental = carriers.find((c) => c.name === 'Continental Freight Systems');
  const polar = carriers.find((c) => c.name === 'PolarChain Logistics');

  const partners = [];
  if (nordic) {
    const p = await prisma.tradingPartner.create({
      data: {
        orgId,
        name: 'Nordic Frost Foods EDI',
        entityType: 'customer',
        customerId: nordic.id,
        sftpHost: 'sftp.nordicfrost.demo',
        sftpUsername: 'meridian',
        senderId: 'MERIDIAN',
        receiverId: 'NORDIC',
        inboundEnabled: true,
        inboundDir: '/inbound',
        pollingInterval: 900,
        outboundEnabled: true,
        outboundDir: '/outbound',
        outboundTransport: 'sftp',
      },
    });
    partners.push(p);
    for (const tx of [
      { transactionType: '850', direction: 'inbound' },
      { transactionType: '855', direction: 'outbound' },
      { transactionType: '856', direction: 'outbound' },
      { transactionType: '810', direction: 'outbound' },
    ]) {
      await prisma.tradingPartnerTransaction.create({
        data: { partnerId: p.id, ...tx, autoProcess: true, ack997Required: true },
      });
    }
    // Sample inbound 850 log
    await prisma.ediTransactionLog.create({
      data: {
        partnerId: p.id,
        transactionType: '850',
        direction: 'inbound',
        fileName: 'PO_NORDIC_20260418.edi',
        fileSize: 2048,
        transport: 'sftp',
        status: 'success',
        processedAt: daysAgo(2),
        transactionCount: 1,
        entitiesCreated: 1,
        source: 'sftp',
        ack997Sent: true,
      },
    });
  }

  if (metro) {
    const p = await prisma.tradingPartner.create({
      data: {
        orgId,
        name: 'Metro Grocer API',
        entityType: 'customer',
        customerId: metro.id,
        httpUrl: 'https://api.metrogrocer.demo/edi',
        httpAuthType: 'bearer',
        httpAuthHeader: 'Authorization',
        httpAuthValue: 'Bearer demo-token',
        senderId: 'MERIDIAN',
        receiverId: 'METROGROC',
        outboundEnabled: true,
        outboundTransport: 'http',
      },
    });
    partners.push(p);
    for (const tx of [
      { transactionType: '850', direction: 'inbound' },
      { transactionType: '214', direction: 'outbound' },
      { transactionType: '810', direction: 'outbound' },
    ]) {
      await prisma.tradingPartnerTransaction.create({
        data: { partnerId: p.id, ...tx, autoProcess: true },
      });
    }
  }

  if (continental) {
    const p = await prisma.tradingPartner.create({
      data: {
        orgId,
        name: 'Continental Freight EDI',
        entityType: 'carrier',
        carrierId: continental.id,
        sftpHost: 'sftp.continental.demo',
        sftpUsername: 'meridian-edi',
        senderId: 'MERIDIAN',
        receiverId: continental.scacCode || 'CFSX',
        inboundEnabled: true,
        inboundDir: '/from-carrier',
        outboundEnabled: true,
        outboundDir: '/to-carrier',
      },
    });
    partners.push(p);
    for (const tx of [
      { transactionType: '204', direction: 'outbound' },
      { transactionType: '990', direction: 'inbound' },
      { transactionType: '214', direction: 'inbound' },
      { transactionType: '210', direction: 'inbound' },
    ]) {
      await prisma.tradingPartnerTransaction.create({
        data: { partnerId: p.id, ...tx, autoProcess: true },
      });
    }
  }

  if (polar) {
    const p = await prisma.tradingPartner.create({
      data: {
        orgId,
        name: 'PolarChain Logistics EDI',
        entityType: 'carrier',
        carrierId: polar.id,
        sftpHost: 'sftp.polarchain.demo',
        sftpUsername: 'meridian',
        senderId: 'MERIDIAN',
        receiverId: polar.scacCode || 'POLC',
        inboundEnabled: true,
        outboundEnabled: true,
      },
    });
    partners.push(p);
    for (const tx of [
      { transactionType: '204', direction: 'outbound' },
      { transactionType: '990', direction: 'inbound' },
      { transactionType: '214', direction: 'inbound' },
    ]) {
      await prisma.tradingPartnerTransaction.create({
        data: { partnerId: p.id, ...tx, autoProcess: true },
      });
    }
  }

  return partners;
}

// ─── Agent Config ────────────────────────────────────────────────────────────

async function seedAgentConfig(orgId: string, createdBy: string) {
  const config = await prisma.agentConfig.create({
    data: {
      orgId,
      agentType: 'triage',
      name: 'Shipment Triage Agent',
      description: 'Classifies exception events and drafts issues for ops review',
      enabled: false,
      subscribedEvents: [
        'shipment.exception',
        'sla.breached',
        'cargo.misdrop_detected',
        'cargo.missing_at_stop',
        'cargo.left_on_vehicle',
        'cold_chain.excursion_detected',
      ],
      temperature: 0.2,
      maxTokens: 512,
      confidenceThreshold: 0.65,
      deduplicationWindowMinutes: 30,
    },
  });

  const version = await prisma.agentConfigVersion.create({
    data: {
      configId: config.id,
      versionNumber: 1,
      systemPrompt:
        'You are a logistics triage agent. Given an exception event and shipment context, decide whether to create_issue, escalate_issue, add_comment, or no_action. Respond with JSON: {action, priority, category, title, description, reasoning, confidence, matchedConditions}.\n\nEvent: {{event}}\nShipment: {{shipment}}\nExisting issues: {{issues}}\nSLA status: {{sla_status}}',
      changeNote: 'Initial seeded prompt',
      createdBy,
    },
  });

  await prisma.agentConfig.update({
    where: { id: config.id },
    data: { activeVersionId: version.id },
  });
}

// ─── Kanban View ────────────────────────────────────────────────────────────

async function seedKanbanView(orgId: string, createdBy: string) {
  await prisma.kanbanView.create({
    data: {
      orgId,
      name: 'All Open Issues',
      description: 'Default board - all non-closed issues grouped by status',
      filters: { status: ['open', 'in_progress', 'resolved'] },
      groupBy: 'status',
      sortBy: 'priority',
      isDefault: true,
      createdBy,
    },
  });
  await prisma.kanbanView.create({
    data: {
      orgId,
      name: 'Cold Chain Watch',
      description: 'Issues tagged cold-chain or temperature excursion',
      filters: { labels: ['cold-chain'] },
      groupBy: 'priority',
      sortBy: 'createdAt',
      createdBy,
    },
  });
}

// ─── Backfill Read Models ───────────────────────────────────────────────────

async function backfillReadModels(orgId: string) {
  console.log('Backfilling read models...');

  // Shipments (list view reads from ShipmentReadModel)
  const shipments = await prisma.shipment.findMany({
    where: { archived: false },
    include: {
      customer: { select: { id: true, name: true } },
      origin: { select: { name: true, city: true, state: true } },
      destination: { select: { name: true, city: true, state: true } },
      carrier: { select: { id: true, name: true } },
      lane: { select: { id: true, name: true } },
      stops: { select: { id: true } },
      orderShipments: { select: { id: true } },
    },
  });
  for (const s of shipments) {
    await prisma.shipmentReadModel.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        orgId,
        reference: s.reference,
        status: s.status,
        customerName: s.customer.name,
        customerId: s.customerId,
        originName: s.origin?.name ?? null,
        originCity: s.origin?.city ?? null,
        originState: s.origin?.state ?? null,
        destinationName: s.destination?.name ?? null,
        destinationCity: s.destination?.city ?? null,
        destinationState: s.destination?.state ?? null,
        carrierName: s.carrier?.name ?? null,
        carrierId: s.carrierId,
        laneName: s.lane?.name ?? null,
        laneId: s.laneId,
        proNumber: s.proNumber,
        pickupDate: s.pickupDate,
        deliveryDate: s.deliveryDate,
        orderCount: s.orderShipments.length,
        stopCount: s.stops.length,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      },
      update: {},
    });
  }

  // Orders (list view reads from OrderReadModel)
  const orders = await prisma.order.findMany({
    where: { archived: false },
    include: {
      customer: { select: { id: true, name: true } },
      origin: { select: { name: true, city: true, state: true } },
      destination: { select: { name: true, city: true, state: true } },
      trackableUnits: { select: { id: true, weight: true } },
      lineItems: { select: { id: true, weight: true, quantity: true } },
      orderShipments: {
        include: { shipment: { select: { id: true, reference: true } } },
        take: 1,
      },
    },
  });
  for (const o of orders) {
    // Match OrderProjection: per-unit overrides win when set, else sum line
    // weight × quantity (line `weight` is per-piece).
    const unitOverrideTotal = o.trackableUnits.reduce((s, u) => s + (u.weight ?? 0), 0);
    const hasUnitOverride = o.trackableUnits.some(u => u.weight != null && u.weight > 0);
    const lineTotal = o.lineItems.reduce((s, li) => s + ((li.weight ?? 0) * (li.quantity ?? 1)), 0);
    const totalWeightRaw = hasUnitOverride ? unitOverrideTotal : lineTotal;
    const totalWeight = totalWeightRaw > 0 ? totalWeightRaw : null;
    const shipment = o.orderShipments[0]?.shipment;
    await prisma.orderReadModel.upsert({
      where: { id: o.id },
      create: {
        id: o.id,
        orgId,
        orderNumber: o.orderNumber,
        poNumber: o.poNumber,
        status: o.status,
        deliveryStatus: o.deliveryStatus || 'unassigned',
        customerName: o.customer.name,
        customerId: o.customerId,
        originName: o.origin?.name ?? null,
        originCity: o.origin?.city ?? null,
        originState: o.origin?.state ?? null,
        destinationName: o.destination?.name ?? null,
        destinationCity: o.destination?.city ?? null,
        destinationState: o.destination?.state ?? null,
        shipmentId: shipment?.id ?? null,
        shipmentReference: shipment?.reference ?? null,
        serviceLevel: o.serviceLevel,
        temperatureRequired: o.temperatureControl !== 'ambient',
        hazmat: o.requiresHazmat || false,
        trackableUnitCount: o.trackableUnits.length,
        lineItemCount: o.lineItems.length,
        totalWeight: totalWeight > 0 ? totalWeight : null,
        requestedDeliveryDate: o.requestedDeliveryDate,
        deliveredAt: o.deliveredAt,
        exceptionType: o.exceptionType,
        importSource: o.importSource,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      },
      update: {},
    });
  }

  // Customers
  const customers = await prisma.customer.findMany();
  for (const c of customers) {
    const totalOrders = await prisma.order.count({ where: { customerId: c.id } });
    const activeOrders = await prisma.order.count({
      where: { customerId: c.id, archived: false, status: { notIn: ['cancelled', 'archived'] } },
    });
    await prisma.customerReadModel.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        orgId,
        name: c.name,
        contactEmail: c.contactEmail,
        activeOrderCount: activeOrders,
        totalOrderCount: totalOrders,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      },
      update: {},
    });
  }

  // Carriers
  const carriers = await prisma.carrier.findMany();
  for (const c of carriers) {
    const vehicleCount = await prisma.vehicle.count({ where: { carrierId: c.id } });
    const driverCount = await prisma.driver.count({ where: { carrierId: c.id } });
    const activeLaneCount = await prisma.laneCarrier.count({ where: { carrierId: c.id, assigned: true } });
    await prisma.carrierReadModel.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        orgId,
        name: c.name,
        mcNumber: c.mcNumber,
        dotNumber: c.dotNumber,
        contactEmail: c.contactEmail,
        status: c.archived ? 'archived' : 'active',
        validationTier: c.validationTier,
        vehicleCount,
        driverCount,
        activeLaneCount,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      },
      update: {},
    });
  }

  // Lanes
  const lanes = await prisma.lane.findMany({
    include: { origin: true, destination: true },
  });
  for (const l of lanes) {
    const activeShipmentCount = await prisma.shipment.count({
      where: { laneId: l.id, status: { in: ['draft', 'in_transit', 'exception'] } },
    });
    await prisma.laneReadModel.upsert({
      where: { id: l.id },
      create: {
        id: l.id,
        orgId,
        name: l.name,
        originName: l.origin.name,
        originCity: l.origin.city,
        destinationName: l.destination.name,
        destinationCity: l.destination.city,
        distance: l.distance,
        serviceLevel: l.serviceLevel,
        status: l.status,
        carrierCount: await prisma.laneCarrier.count({ where: { laneId: l.id } }),
        activeShipmentCount,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      },
      update: {},
    });
  }

  // Issues
  const issues = await prisma.issue.findMany({
    include: { labelAssignments: { include: { label: true } } },
  });
  for (const i of issues) {
    await prisma.issueReadModel.upsert({
      where: { id: i.id },
      create: {
        id: i.id,
        orgId,
        title: i.title,
        description: i.description,
        status: i.status,
        priority: i.priority,
        category: i.category,
        sourceEntityType: i.sourceEntityType,
        sourceEntityId: i.sourceEntityId,
        assigneeId: i.assigneeId,
        assigneeName: i.assigneeName,
        resolvedAt: i.resolvedAt,
        resolution: i.resolution,
        snoozedUntil: i.snoozedUntil,
        snoozedBy: i.snoozedBy,
        needsCapa: i.needsCapa,
        labels: i.labelAssignments.map((a) => a.label.name),
        closedAt: i.closedAt,
        commentCount: await prisma.comment.count({
          where: { entityType: 'issue', entityId: i.id },
        }),
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      },
      update: {},
    });
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚚 Open TMS Comprehensive Seed');
  console.log('================================\n');

  if (!NO_WIPE) {
    await wipe();
    console.log('✓ Wiped existing data\n');
  }

  console.log('Seeding system roles...');
  const roleResult = await seedSystemRoles(prisma);
  console.log(`✓ Roles: ${roleResult.created} created, ${roleResult.updated} updated`);

  console.log('Seeding organization...');
  const org = await seedOrganization();
  console.log(`✓ Organization: ${org.name}`);

  console.log('Seeding internal users...');
  const users = await seedUsers(org.id);
  console.log(`✓ Users: ${users.length}`);

  console.log('Seeding pallet types...');
  const palletTypes = await seedPalletTypes(org.id);
  console.log(`✓ Pallet types: ${palletTypes.length}`);

  console.log('Seeding cold chain profiles...');
  const ccProfiles = await seedColdChainProfiles(org.id, users[0].id);
  console.log(`✓ Cold chain profiles: ${ccProfiles.length}`);

  console.log('Seeding issue labels...');
  const labels = await seedIssueLabels(org.id);
  console.log(`✓ Labels: ${labels.length}`);

  console.log('Seeding locations...');
  const locations = await seedLocations(org.id);
  console.log(`✓ Locations: ${locations.length}`);

  console.log('Seeding customers + portal users...');
  const customers = await seedCustomers(org.id);
  console.log(`✓ Customers: ${customers.length} (+${customers.length * 2} portal users)`);

  console.log('Seeding carriers + users + vehicles + drivers...');
  const carriers = await seedCarriers(org.id);
  console.log(`✓ Carriers: ${carriers.length}`);

  console.log('Seeding lanes + carrier contracts...');
  const lanes = await seedLanes(locations as any, customers, carriers, org.id);
  console.log(`✓ Lanes: ${lanes.length}`);

  console.log('Seeding orders + line items + trackable units...');
  const orders = await seedOrders(customers, locations, palletTypes, org.id);
  console.log(`✓ Orders: ${orders.length}`);

  console.log('Seeding shipments + stops + loads...');
  const shipmentRecords = await seedShipments(orders, lanes, carriers, locations, ccProfiles, org.id);
  console.log(`✓ Shipments: ${shipmentRecords.length}`);

  console.log('Seeding devices + sensor readings...');
  const devices = await seedDevices(shipmentRecords, org.id);
  console.log(`✓ Devices: ${devices.length}`);

  console.log('Seeding tenders + offers + bids...');
  const tenders = await seedTenders(shipmentRecords, carriers, users[1].id);
  console.log(`✓ Tenders: ${tenders.length}`);

  console.log('Seeding charges + financial summaries...');
  await seedCharges(shipmentRecords, org.id);
  console.log('✓ Charges + summaries');

  console.log('Seeding quotes...');
  await seedQuotes(customers, locations, org.id, users[4].id);
  console.log('✓ Quotes');

  console.log('Seeding invoices (AR)...');
  await seedInvoices(shipmentRecords, org.id);
  console.log('✓ Invoices');

  console.log('Seeding carrier invoices (AP)...');
  await seedCarrierInvoices(shipmentRecords, org.id);
  console.log('✓ Carrier invoices');

  console.log('Seeding issues + comments + labels...');
  await seedIssues(org.id, shipmentRecords, labels, users[1].id);
  console.log('✓ Issues');

  console.log('Seeding SLA policies + rules...');
  await seedSla(org.id, customers);
  console.log('✓ SLA');

  console.log('Seeding trading partners + EDI config...');
  await seedTradingPartners(customers, carriers, org.id);
  console.log('✓ Trading partners');

  console.log('Seeding triage agent config...');
  await seedAgentConfig(org.id, users[0].id);
  console.log('✓ Agent config');

  console.log('Seeding kanban views...');
  await seedKanbanView(org.id, users[0].id);
  console.log('✓ Kanban views');

  await backfillReadModels(org.id);
  console.log('✓ Read models backfilled');

  console.log('\n================================');
  console.log('✓ Seed complete!');
  console.log('================================\n');
  console.log('Demo credentials:');
  console.log('  TMS admin:       admin@meridian-tms.demo       / Password1!');
  console.log('  TMS dispatcher:  dispatch@meridian-tms.demo    / Password1!');
  console.log('  TMS ops mgr:     ops-manager@meridian-tms.demo / Password1!');
  console.log('  TMS warehouse:   warehouse@meridian-tms.demo   / Password1!');
  console.log('  TMS finance:     finance@meridian-tms.demo     / Password1!');
  console.log('  Customer portal: admin@nordic.demo             / Portal123!');
  console.log('  Customer portal: viewer@axiom.demo             / Portal123!');
  console.log('  Carrier portal:  dispatch@continental.demo     / Carrier123!');
  console.log('  Carrier portal:  dispatch@polarchain.demo      / Carrier123!');
  console.log('\nRun with --no-wipe to preserve existing data.');
}

main()
  .catch(async (err) => {
    console.error('Seed failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
