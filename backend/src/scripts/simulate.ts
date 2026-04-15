#!/usr/bin/env npx tsx
/**
 * Open TMS Simulation: "A Week in Logistics"
 *
 * Drives the entire TMS lifecycle through the HTTP API:
 *   Order intake -> Shipment creation -> Carrier tendering -> Bids ->
 *   Award -> GPS tracking -> Stop arrivals -> Cargo scanning ->
 *   Delivery -> Charges -> Invoicing -> Payment
 *
 * Usage:
 *   1. Start the backend: cd backend && npm run dev
 *   2. Run:  npx tsx backend/src/scripts/simulate.ts
 *
 * The script expects the backend on http://localhost:3001
 */

const BASE = process.env.API_URL || 'http://localhost:3001';

// ── Helpers ──────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  white: '\x1b[37m',
};

function log(msg: string, color: keyof typeof COLORS = 'white') {
  const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
  console.log(`${COLORS.dim}[${ts}]${COLORS.reset} ${COLORS[color]}${msg}${COLORS.reset}`);
}

function header(msg: string) {
  console.log('');
  console.log(`${COLORS.bright}${COLORS.cyan}${'='.repeat(60)}${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.cyan}  ${msg}${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.cyan}${'='.repeat(60)}${COLORS.reset}`);
  console.log('');
}

function subheader(msg: string) {
  console.log('');
  log(`--- ${msg} ---`, 'yellow');
}

async function api(method: string, path: string, body?: unknown, headers?: Record<string, string>) {
  const url = `${BASE}${path}`;
  const opts: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const json = await res.json() as { data?: any; error?: any };

  if (!res.ok || json.error) {
    log(`  FAILED ${method} ${path}: ${res.status} - ${JSON.stringify(json.error || json)}`, 'red');
    return null;
  }
  return json.data;
}

// ── State accumulated across phases ──────────────────────────────────

interface SimState {
  customers: Record<string, any>;
  locations: Record<string, any>;
  carriers: Record<string, any>;
  carrierJwts: Record<string, string>;
  lanes: Record<string, any>;
  apiKey: string;
  // Per-shipment tracking
  shipments: Record<string, {
    order?: any;
    order2?: any;
    shipment?: any;
    tender?: any;
    bids?: any[];
    charges?: any[];
    invoice?: any;
    carrierInvoice?: any;
  }>;
}

const state: SimState = {
  customers: {},
  locations: {},
  carriers: {},
  carrierJwts: {},
  lanes: {},
  apiKey: '',
  shipments: { s1: {}, s2: {}, s3: {} },
};

// ── Phase 0: Seed reference data ─────────────────────────────────────

async function seedData() {
  header('Phase 0: Seeding Reference Data');

  log('Calling POST /api/v1/seed to create customers, locations, and lanes...', 'blue');
  const result = await api('POST', '/api/v1/seed');
  if (result) {
    log(`  Created ${result.customers} customers, ${result.locations} locations, ${result.lanes} lanes`, 'green');
  }

  await sleep(1000);

  // Fetch customers by name
  log('Fetching customers...', 'blue');
  const customersData = await api('GET', '/api/v1/customers');
  if (customersData) {
    for (const c of customersData) {
      const key = c.name.toLowerCase().replace(/\s+/g, '_');
      state.customers[key] = c;
    }
    log(`  Found ${customersData.length} customers: ${customersData.map((c: any) => c.name).join(', ')}`, 'green');
  }

  // Fetch locations
  log('Fetching locations...', 'blue');
  const locationsData = await api('GET', '/api/v1/locations');
  if (locationsData) {
    for (const loc of locationsData) {
      // Index by city for easy lookup
      const key = loc.city?.toLowerCase().replace(/\s+/g, '_');
      if (key) {
        // Keep all locations indexed; if multiple in same city, prefer DCs/warehouses
        if (!state.locations[key] || loc.locationType === 'distribution_center' || loc.locationType === 'warehouse') {
          state.locations[key] = loc;
        }
      }
      // Also index by name for specific lookups
      const nameKey = loc.name?.toLowerCase().replace(/\s+/g, '_');
      if (nameKey) state.locations[nameKey] = loc;
    }
    log(`  Indexed ${Object.keys(state.locations).length} location keys from ${locationsData.length} locations`, 'green');
  }

  // Create an API key for webhook calls
  log('Creating API key for IoT webhook...', 'blue');
  const apiKeyData = await api('POST', '/api/v1/api-keys', { name: 'Simulation IoT Key' });
  if (apiKeyData) {
    state.apiKey = apiKeyData.key;
    log(`  API key created: ${apiKeyData.keyPrefix}...`, 'green');
  }
}

// ── Phase 1: Create carriers ─────────────────────────────────────────

async function setupCarriers() {
  header('Phase 1: Creating Carriers');

  const carrierDefs = [
    {
      key: 'swift',
      name: 'Swift National Freight',
      scacCode: 'SWFT',
      mcNumber: 'MC-123456',
      dotNumber: 'DOT-7890123',
      contactName: 'Mike Johnson',
      contactEmail: 'dispatch@swiftnational.example.com',
      contactPhone: '(555) 100-2000',
      city: 'Phoenix',
      state: 'AZ',
      country: 'US',
    },
    {
      key: 'coldstar',
      name: 'ColdStar Logistics',
      scacCode: 'CLST',
      mcNumber: 'MC-234567',
      dotNumber: 'DOT-8901234',
      contactName: 'Sarah Chen',
      contactEmail: 'ops@coldstarlogistics.example.com',
      contactPhone: '(555) 200-3000',
      city: 'Dallas',
      state: 'TX',
      country: 'US',
    },
    {
      key: 'metro',
      name: 'Metro Regional Express',
      scacCode: 'MTRX',
      mcNumber: 'MC-345678',
      dotNumber: 'DOT-9012345',
      contactName: 'James Williams',
      contactEmail: 'dispatch@metroregional.example.com',
      contactPhone: '(555) 300-4000',
      city: 'Houston',
      state: 'TX',
      country: 'US',
    },
  ];

  for (const def of carrierDefs) {
    const { key, ...carrierBody } = def;
    log(`Creating carrier: ${carrierBody.name} (${carrierBody.scacCode})`, 'blue');
    const carrier = await api('POST', '/api/v1/carriers', carrierBody);
    if (carrier) {
      state.carriers[key] = carrier;
      log(`  Carrier created: ${carrier.id}`, 'green');
    }
  }

  // Create carrier portal users
  subheader('Creating Carrier Portal Users');

  const portalUsers = [
    { carrierKey: 'swift', email: 'mike@swiftnational.example.com', name: 'Mike Johnson', password: 'SwiftFreight2024!' },
    { carrierKey: 'coldstar', email: 'sarah@coldstarlogistics.example.com', name: 'Sarah Chen', password: 'ColdStar2024!' },
    { carrierKey: 'metro', email: 'james@metroregional.example.com', name: 'James Williams', password: 'MetroExpress2024!' },
  ];

  for (const u of portalUsers) {
    const carrier = state.carriers[u.carrierKey];
    if (!carrier) continue;
    log(`  Creating portal user for ${carrier.name}: ${u.email}`, 'blue');
    const user = await api('POST', `/api/v1/carriers/${carrier.id}/users`, {
      email: u.email,
      password: u.password,
      name: u.name,
      role: 'dispatcher',
    });
    if (user) {
      log(`    Portal user created: ${user.id}`, 'green');
    }

    // Login to get JWT
    const loginResult = await api('POST', '/api/v1/carrier-portal/login', {
      email: u.email,
      password: u.password,
    });
    if (loginResult?.token) {
      state.carrierJwts[u.carrierKey] = loginResult.token;
      log(`    JWT obtained for ${u.carrierKey}`, 'green');
    }
  }
}

// ── Phase 2: Set up lanes with carrier rates ─────────────────────────

async function setupLaneCarriers() {
  header('Phase 2: Assigning Carriers to Lanes');

  // Fetch all lanes to find the ones we need
  const allLanes = await api('GET', '/api/v1/lanes');
  if (!allLanes) {
    log('Failed to fetch lanes!', 'red');
    return;
  }

  // Find lanes by origin/destination city
  function findLane(originCity: string, destCity: string) {
    return allLanes.find((l: any) =>
      l.origin?.city?.toLowerCase().includes(originCity.toLowerCase()) &&
      l.destination?.city?.toLowerCase().includes(destCity.toLowerCase())
    );
  }

  // Lane 1: Phoenix -> Portland
  const lane1 = findLane('phoenix', 'portland');
  if (lane1) {
    state.lanes['phoenix_portland'] = lane1;
    log(`Found lane: ${lane1.origin.city} -> ${lane1.destination.city} (${lane1.id})`, 'green');
    // Add Swift and Metro as carriers
    for (const ck of ['swift', 'metro']) {
      const carrier = state.carriers[ck];
      if (carrier) {
        await api('POST', `/api/v1/lanes/${lane1.id}/carriers`, {
          carrierId: carrier.id,
          price: ck === 'swift' ? 2800 : 3100,
          currency: 'USD',
          serviceLevel: 'FTL',
        });
        log(`  Added ${carrier.name} to lane at $${ck === 'swift' ? '2,800' : '3,100'}`, 'blue');
      }
    }
  } else {
    log('Lane Phoenix -> Portland not found in seed data', 'yellow');
  }

  // Lane 2: Dallas -> Chicago
  const lane2 = findLane('dallas', 'chicago');
  if (lane2) {
    state.lanes['dallas_chicago'] = lane2;
    log(`Found lane: ${lane2.origin.city} -> ${lane2.destination.city} (${lane2.id})`, 'green');
    // Add all three carriers
    for (const ck of ['swift', 'coldstar', 'metro']) {
      const carrier = state.carriers[ck];
      if (carrier) {
        const price = ck === 'coldstar' ? 4000 : ck === 'swift' ? 3800 : 4200;
        await api('POST', `/api/v1/lanes/${lane2.id}/carriers`, {
          carrierId: carrier.id,
          price,
          currency: 'USD',
          serviceLevel: 'FTL',
        });
        log(`  Added ${carrier.name} to lane at $${price.toLocaleString()}`, 'blue');
      }
    }
  } else {
    log('Lane Dallas -> Chicago not found in seed data', 'yellow');
  }

  // Lane 3: Houston -> Atlanta
  const lane3 = findLane('houston', 'atlanta');
  if (lane3) {
    state.lanes['houston_atlanta'] = lane3;
    log(`Found lane: ${lane3.origin.city} -> ${lane3.destination.city} (${lane3.id})`, 'green');
    // Add Metro as primary LTL carrier
    const metro = state.carriers['metro'];
    if (metro) {
      await api('POST', `/api/v1/lanes/${lane3.id}/carriers`, {
        carrierId: metro.id,
        price: 1800,
        currency: 'USD',
        serviceLevel: 'LTL',
      });
      log(`  Added ${metro.name} to lane at $1,800`, 'blue');
    }
  } else {
    log('Lane Houston -> Atlanta not found in seed data', 'yellow');
  }
}

// ── Phase 3: Shipment 1 - FTL Electronics Phoenix -> Portland ────────

async function simulateShipment1() {
  header('Phase 3: Shipment 1 - FTL Electronics (Phoenix -> Portland)');

  const walmart = state.customers['walmart'];
  const lane = state.lanes['phoenix_portland'];
  if (!walmart || !lane) {
    log('Missing Walmart customer or Phoenix->Portland lane - skipping shipment 1', 'red');
    return;
  }

  // Create order
  subheader('Creating Order: Consumer Electronics for Walmart');

  const now = new Date();
  const pickupDate = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); // tomorrow
  const deliveryDate = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000); // 4 days

  const order = await api('POST', '/api/v1/orders', {
    orderNumber: `SIM-ORD-${Date.now()}-001`,
    poNumber: 'WM-PO-2024-8834',
    customerId: walmart.id,
    originId: lane.origin.id,
    destinationId: lane.destination.id,
    requestedPickupDate: pickupDate.toISOString(),
    requestedDeliveryDate: deliveryDate.toISOString(),
    serviceLevel: 'FTL',
    temperatureControl: 'ambient',
    trackableUnits: [
      {
        identifier: 'PLT-ELEC-001',
        unitType: 'pallet',
        barcode: '00100370005432101',
        lineItems: [
          { sku: 'TV-55-4K-SAM', description: '55" Samsung 4K Smart TV', quantity: 12, weight: 18.5, weightUnit: 'kg' },
          { sku: 'LAPTOP-HP-15', description: 'HP Pavilion 15" Laptop', quantity: 24, weight: 2.1, weightUnit: 'kg' },
        ],
      },
      {
        identifier: 'PLT-ELEC-002',
        unitType: 'pallet',
        barcode: '00100370005432102',
        lineItems: [
          { sku: 'TABLET-IPAD-10', description: 'Apple iPad 10th Gen', quantity: 48, weight: 0.48, weightUnit: 'kg' },
          { sku: 'SPEAKER-JBL-FL', description: 'JBL Flip 6 Bluetooth Speaker', quantity: 60, weight: 0.55, weightUnit: 'kg' },
        ],
      },
    ],
    specialInstructions: 'Fragile electronics - handle with care. No stacking above 2 pallets.',
  });

  if (!order) return;
  state.shipments.s1.order = order;
  log(`  Order created: ${order.orderNumber} (${order.id})`, 'green');

  await sleep(500);

  // Assign order to shipment (auto-matches lane)
  subheader('Assigning Order to Shipment');
  const assignment = await api('POST', `/api/v1/orders/${order.id}/assign-to-shipment`);
  if (assignment) {
    state.shipments.s1.shipment = assignment.shipment || assignment;
    log(`  Order assigned to shipment: ${assignment.shipment?.reference || assignment.shipmentId || 'created'}`, 'green');
  }

  await sleep(500);

  // If we got a shipment ID, fetch the full shipment
  let shipment = state.shipments.s1.shipment;
  if (assignment?.shipmentId && !shipment?.id) {
    shipment = await api('GET', `/api/v1/shipments/${assignment.shipmentId}`);
    state.shipments.s1.shipment = shipment;
  } else if (!shipment?.id) {
    // Try to find it via the order's read model
    const orderDetail = await api('GET', `/api/v1/orders/${order.id}`);
    if (orderDetail?.shipmentId) {
      shipment = await api('GET', `/api/v1/shipments/${orderDetail.shipmentId}`);
      state.shipments.s1.shipment = shipment;
    }
  }

  if (!shipment?.id) {
    log('  Could not find created shipment - skipping tender', 'red');
    return;
  }

  log(`  Shipment: ${shipment.reference} (${shipment.id})`, 'green');

  // Create tender - broadcast to Swift and Metro
  subheader('Creating Broadcast Tender');

  const swift = state.carriers['swift'];
  const metro = state.carriers['metro'];
  if (!swift || !metro) {
    log('  Missing carrier IDs for tender', 'red');
    return;
  }

  const tender = await api('POST', '/api/v1/tenders', {
    shipmentId: shipment.id,
    strategy: 'broadcast',
    carrierIds: [swift.id, metro.id],
    tenderDurationMinutes: 120,
    targetRate: 300000, // $3,000 target in cents
    currency: 'USD',
    equipmentType: '53ft Dry Van',
    notes: 'Standard FTL load - consumer electronics. Liftgate not required.',
  });

  if (!tender) return;
  state.shipments.s1.tender = tender;
  log(`  Tender created: ${tender.id} (broadcast to ${swift.name} and ${metro.name})`, 'green');

  // Open tender
  log('  Opening tender...', 'blue');
  await api('POST', `/api/v1/tenders/${tender.id}/open`);
  log('  Tender opened - carriers notified', 'green');

  await sleep(1000);

  // Carrier bids via portal
  subheader('Carriers Submitting Bids');

  // Swift bids $2,850
  if (state.carrierJwts['swift']) {
    log('  Swift National Freight reviewing tender...', 'blue');
    await sleep(500);
    const bid1 = await api('POST', `/api/v1/carrier-portal/tenders/${tender.id}/bid`, {
      rate: 285000, // cents
      currency: 'USD',
      transitDays: 3,
      equipmentType: '53ft Dry Van',
      notes: 'Can pick up tomorrow AM. Experienced electronics hauler.',
    }, { Authorization: `Bearer ${state.carrierJwts['swift']}` });
    if (bid1) {
      log(`  Swift bid: $2,850 / 3 days transit (${bid1.id})`, 'green');
      state.shipments.s1.bids = [bid1];
    }
  }

  // Metro bids $3,100
  if (state.carrierJwts['metro']) {
    log('  Metro Regional Express reviewing tender...', 'blue');
    await sleep(500);
    const bid2 = await api('POST', `/api/v1/carrier-portal/tenders/${tender.id}/bid`, {
      rate: 310000, // cents
      currency: 'USD',
      transitDays: 4,
      equipmentType: '53ft Dry Van',
      notes: 'Available day after tomorrow. Regional coverage included.',
    }, { Authorization: `Bearer ${state.carrierJwts['metro']}` });
    if (bid2) {
      log(`  Metro bid: $3,100 / 4 days transit (${bid2.id})`, 'green');
      state.shipments.s1.bids?.push(bid2);
    }
  }

  // Award to Swift (lower bid)
  subheader('Awarding Tender');
  const winningBid = state.shipments.s1.bids?.[0]; // Swift's bid
  if (winningBid) {
    log(`  Awarding to Swift National Freight at $2,850...`, 'blue');
    const awardResult = await api('POST', `/api/v1/tenders/${tender.id}/award`, {
      bidId: winningBid.id,
    });
    if (awardResult) {
      log('  Tender awarded! Cost charge auto-created from bid.', 'green');
    }
  }

  await sleep(1000);

  // Move shipment to in_transit
  subheader('Dispatching Shipment');
  log('  Setting shipment status to in_transit...', 'blue');
  await api('PUT', `/api/v1/shipments/${shipment.id}`, {
    status: 'in_transit',
    carrierId: swift.id,
    pickupDate: pickupDate.toISOString(),
    deliveryDate: deliveryDate.toISOString(),
  });
  log('  Shipment is now IN TRANSIT', 'green');

  await sleep(500);

  // Simulate GPS pings along the route
  subheader('GPS Tracking - In Transit');
  const waypoints = [
    { lat: 33.45, lon: -112.07, label: 'Phoenix, AZ (origin)' },
    { lat: 34.05, lon: -118.24, label: 'Los Angeles, CA (I-5 junction)' },
    { lat: 38.58, lon: -121.49, label: 'Sacramento, CA (mid-route)' },
    { lat: 42.37, lon: -122.91, label: 'Medford, OR (approaching destination)' },
    { lat: 45.52, lon: -122.68, label: 'Portland, OR (destination)' },
  ];

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const eventTime = new Date(now.getTime() + (1 + i * 0.5) * 24 * 60 * 60 * 1000);
    log(`  GPS ping ${i + 1}/${waypoints.length}: ${wp.label}`, 'blue');

    if (state.apiKey) {
      await api('POST', '/api/v1/webhook', {
        event: {
          device: { name: shipment.reference },
          type: 'location',
          startTime: eventTime.toISOString(),
          latestTime: eventTime.toISOString(),
          location: {
            global: { lat: wp.lat, lon: wp.lon },
            summary: wp.label,
          },
        },
      }, { 'x-api-key': state.apiKey });
    }
    await sleep(300);
  }
  log('  All GPS waypoints transmitted', 'green');

  await sleep(500);

  // Mark as delivered
  subheader('Delivery Confirmation');
  log('  Marking shipment as delivered...', 'blue');
  await api('PUT', `/api/v1/shipments/${shipment.id}`, { status: 'delivered' });
  log('  Shipment DELIVERED at Portland Walmart Supercenter', 'green');

  // Mark order delivered
  await api('POST', `/api/v1/orders/${order.id}/delivery-status`, {
    deliveryStatus: 'delivered',
    deliveryMethod: 'manual',
    deliveryConfirmedBy: 'Warehouse Receiver - Portland',
    deliveryNotes: 'All 2 pallets received in good condition. No damage.',
  });
  log('  Order delivery confirmed', 'green');

  // Add revenue charge
  subheader('Financial: Revenue Charge');
  const revCharge = await api('POST', '/api/v1/charges', {
    shipmentId: shipment.id,
    chargeType: 'linehaul',
    chargeCategory: 'revenue',
    description: 'FTL Linehaul - Phoenix to Portland (electronics)',
    amountCents: 320000, // $3,200
    currency: 'USD',
    source: 'contract_rate',
  });
  if (revCharge) {
    log(`  Revenue charge created: $3,200.00 (${revCharge.id})`, 'green');
    await api('POST', `/api/v1/charges/${revCharge.id}/approve`);
    log('  Revenue charge approved', 'green');
    state.shipments.s1.charges = [revCharge];
  }

  log('  Shipment 1 complete! Margin: $350 (10.9%)', 'green');
}

// ── Phase 4: Shipment 2 - Cold Chain Pharma Dallas -> Chicago ────────

async function simulateShipment2() {
  header('Phase 4: Shipment 2 - Cold Chain Pharmaceuticals (Dallas -> Chicago)');

  const cvs = state.customers['cvs'];
  const lane = state.lanes['dallas_chicago'];
  if (!cvs || !lane) {
    log('Missing CVS customer or Dallas->Chicago lane - skipping shipment 2', 'red');
    return;
  }

  const now = new Date();
  const pickupDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const deliveryDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  // Create order
  subheader('Creating Order: Pharmaceuticals for CVS');

  const order = await api('POST', '/api/v1/orders', {
    orderNumber: `SIM-ORD-${Date.now()}-002`,
    poNumber: 'CVS-RX-2024-4421',
    customerId: cvs.id,
    originId: lane.origin.id,
    destinationId: lane.destination.id,
    requestedPickupDate: pickupDate.toISOString(),
    requestedDeliveryDate: deliveryDate.toISOString(),
    serviceLevel: 'FTL',
    temperatureControl: 'refrigerated',
    trackableUnits: [
      {
        identifier: 'PLT-PHARMA-001',
        unitType: 'pallet',
        barcode: '00200480006543201',
        lineItems: [
          { sku: 'RX-INSULIN-HUM', description: 'Humalog Insulin KwikPens (100 units)', quantity: 200, weight: 0.3, weightUnit: 'kg', temperature: 'refrigerated' },
          { sku: 'RX-VACCINE-FLU', description: 'Fluzone Quadrivalent Vaccine', quantity: 500, weight: 0.1, weightUnit: 'kg', temperature: 'refrigerated' },
        ],
      },
      {
        identifier: 'PLT-PHARMA-002',
        unitType: 'pallet',
        barcode: '00200480006543202',
        lineItems: [
          { sku: 'RX-EPIPEN-AD', description: 'EpiPen Auto-Injector Adult', quantity: 150, weight: 0.15, weightUnit: 'kg', temperature: 'refrigerated' },
        ],
      },
      {
        identifier: 'PLT-PHARMA-003',
        unitType: 'pallet',
        barcode: '00200480006543203',
        lineItems: [
          { sku: 'RX-BIOLOGIC-AB', description: 'Humira Adalimumab Injection', quantity: 80, weight: 0.25, weightUnit: 'kg', temperature: 'refrigerated' },
        ],
      },
      {
        identifier: 'PLT-PHARMA-004',
        unitType: 'pallet',
        barcode: '00200480006543204',
        lineItems: [
          { sku: 'RX-OZEMPIC-1MG', description: 'Ozempic 1mg Semaglutide Pens', quantity: 300, weight: 0.2, weightUnit: 'kg', temperature: 'refrigerated' },
        ],
      },
    ],
    specialInstructions: 'TEMPERATURE SENSITIVE - Maintain 2-8C at all times. Do not freeze. GDP compliant transport required.',
  });

  if (!order) return;
  state.shipments.s2.order = order;
  log(`  Order created: ${order.orderNumber} (${order.id})`, 'green');

  await sleep(500);

  // Assign order to shipment
  subheader('Assigning Order to Shipment');
  const assignment = await api('POST', `/api/v1/orders/${order.id}/assign-to-shipment`);
  if (assignment) {
    log(`  Order assigned to shipment`, 'green');
  }

  await sleep(500);

  // Find the shipment
  let shipment: any = null;
  const orderDetail = await api('GET', `/api/v1/orders/${order.id}`);
  if (orderDetail?.shipmentId) {
    shipment = await api('GET', `/api/v1/shipments/${orderDetail.shipmentId}`);
  } else if (assignment?.shipmentId) {
    shipment = await api('GET', `/api/v1/shipments/${assignment.shipmentId}`);
  } else if (assignment?.shipment?.id) {
    shipment = assignment.shipment;
  }

  if (!shipment?.id) {
    log('  Could not find created shipment - skipping', 'red');
    return;
  }
  state.shipments.s2.shipment = shipment;
  log(`  Shipment: ${shipment.reference} (${shipment.id})`, 'green');

  // Create tender - broadcast to all 3 carriers
  subheader('Creating Broadcast Tender (Temperature-Controlled)');

  const carrierIds = Object.values(state.carriers).map((c: any) => c.id);

  const tender = await api('POST', '/api/v1/tenders', {
    shipmentId: shipment.id,
    strategy: 'broadcast',
    carrierIds,
    tenderDurationMinutes: 90,
    targetRate: 450000, // $4,500 target
    currency: 'USD',
    equipmentType: '53ft Reefer',
    notes: 'TEMPERATURE CONTROLLED: 2-8C. GDP compliance required. Continuous monitoring mandatory.',
    specialInstructions: 'Carrier must have reefer certification and real-time temperature monitoring capability.',
  });

  if (!tender) return;
  state.shipments.s2.tender = tender;
  log(`  Tender created: ${tender.id}`, 'green');

  // Open tender
  await api('POST', `/api/v1/tenders/${tender.id}/open`);
  log('  Tender opened - all carriers notified', 'green');

  await sleep(1000);

  // Only ColdStar bids (they're the reefer specialist)
  subheader('Carrier Bidding');

  log('  Swift National Freight: Reviewing... no reefer equipment. Declining.', 'yellow');
  if (state.carrierJwts['swift']) {
    await api('POST', `/api/v1/carrier-portal/tenders/${tender.id}/decline`, {}, {
      Authorization: `Bearer ${state.carrierJwts['swift']}`,
    });
  }

  log('  Metro Regional Express: Reviewing... no cold chain capability. Declining.', 'yellow');
  if (state.carrierJwts['metro']) {
    await api('POST', `/api/v1/carrier-portal/tenders/${tender.id}/decline`, {}, {
      Authorization: `Bearer ${state.carrierJwts['metro']}`,
    });
  }

  await sleep(500);

  // ColdStar bids $4,100
  let coldstarBid: any = null;
  if (state.carrierJwts['coldstar']) {
    log('  ColdStar Logistics: Reviewing... reefer fleet available. Bidding.', 'blue');
    coldstarBid = await api('POST', `/api/v1/carrier-portal/tenders/${tender.id}/bid`, {
      rate: 410000, // $4,100
      currency: 'USD',
      transitDays: 2,
      equipmentType: '53ft Reefer - Thermo King SLXi',
      notes: 'GDP certified fleet. Real-time PharmaWatch monitoring included. 24/7 dispatch support.',
    }, { Authorization: `Bearer ${state.carrierJwts['coldstar']}` });
    if (coldstarBid) {
      log(`  ColdStar bid: $4,100 / 2 days transit (${coldstarBid.id})`, 'green');
      state.shipments.s2.bids = [coldstarBid];
    }
  }

  // Award to ColdStar (only bidder)
  if (coldstarBid) {
    subheader('Awarding Tender');
    log('  Single qualified bidder - awarding to ColdStar Logistics at $4,100...', 'blue');
    await api('POST', `/api/v1/tenders/${tender.id}/award`, { bidId: coldstarBid.id });
    log('  Tender awarded!', 'green');
  }

  await sleep(1000);

  // Dispatch
  subheader('Dispatching Shipment');
  const coldstar = state.carriers['coldstar'];
  await api('PUT', `/api/v1/shipments/${shipment.id}`, {
    status: 'in_transit',
    carrierId: coldstar.id,
    pickupDate: pickupDate.toISOString(),
    deliveryDate: deliveryDate.toISOString(),
  });
  log('  Shipment is now IN TRANSIT (reefer unit active, 4C setpoint)', 'green');

  // GPS pings with a temperature excursion mid-route
  subheader('GPS Tracking - In Transit (with Temperature Excursion)');
  const waypoints = [
    { lat: 32.78, lon: -96.80, label: 'Dallas, TX (origin)', tempOk: true },
    { lat: 35.22, lon: -97.44, label: 'Oklahoma City, OK', tempOk: true },
    { lat: 36.15, lon: -95.99, label: 'Tulsa, OK (TEMP EXCURSION!)', tempOk: false },
    { lat: 38.63, lon: -90.20, label: 'St. Louis, MO', tempOk: true },
    { lat: 41.88, lon: -87.63, label: 'Chicago, IL (destination)', tempOk: true },
  ];

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const eventTime = new Date(now.getTime() + (2 + i * 0.4) * 24 * 60 * 60 * 1000);

    if (wp.tempOk) {
      log(`  GPS ping ${i + 1}/${waypoints.length}: ${wp.label} - Temp: 4.2C [OK]`, 'blue');
    } else {
      log(`  GPS ping ${i + 1}/${waypoints.length}: ${wp.label} - Temp: 12.8C [EXCURSION!]`, 'red');
      log('    Temperature exceeded 8C threshold! Reefer unit malfunction detected.', 'red');
      log('    Creating shipment exception...', 'yellow');

      // Create an exception on the order
      await api('POST', `/api/v1/orders/${order.id}/delivery-status`, {
        deliveryStatus: 'exception',
        exceptionType: 'other',
        exceptionNotes: 'Cold chain excursion detected: temperature reached 12.8C (threshold: 8C) near Tulsa, OK. Reefer unit malfunction suspected.',
      });

      // Create an issue for the excursion
      await api('POST', '/api/v1/issues', {
        title: 'Cold Chain Excursion - Pharma Shipment CVS-RX-2024-4421',
        description: `Temperature excursion detected on shipment ${shipment.reference}. Temperature reached 12.8C, exceeding the 8C maximum for pharmaceutical cargo. Location: near Tulsa, OK. Reefer unit malfunction suspected. Cargo integrity assessment required before delivery acceptance.`,
        priority: 'critical',
        category: 'compliance',
        sourceEntityType: 'shipment',
        sourceEntityId: shipment.id,
      });
      log('    Issue created in Triage Centre', 'yellow');
    }

    if (state.apiKey) {
      await api('POST', '/api/v1/webhook', {
        event: {
          device: { name: shipment.reference },
          type: 'location',
          startTime: eventTime.toISOString(),
          latestTime: eventTime.toISOString(),
          location: {
            global: { lat: wp.lat, lon: wp.lon },
            summary: wp.label,
          },
        },
      }, { 'x-api-key': state.apiKey });
    }
    await sleep(300);
  }

  // Deliver despite exception (cargo needs disposition decision)
  subheader('Delivery with Exception');
  await api('PUT', `/api/v1/shipments/${shipment.id}`, { status: 'delivered' });
  log('  Shipment DELIVERED at Chicago DC - pending quality review', 'yellow');

  await api('POST', `/api/v1/orders/${order.id}/delivery-status`, {
    deliveryStatus: 'delivered',
    deliveryMethod: 'manual',
    deliveryConfirmedBy: 'QA Inspector - Chicago DC',
    deliveryNotes: 'Cargo received. Temperature excursion logged. Quarantine hold pending disposition decision. 2 of 4 pallets may be affected.',
  });
  log('  Order delivered with quality hold', 'yellow');

  // Revenue charge
  subheader('Financial: Charges and Query');
  const revCharge = await api('POST', '/api/v1/charges', {
    shipmentId: shipment.id,
    chargeType: 'linehaul',
    chargeCategory: 'revenue',
    description: 'FTL Reefer Linehaul - Dallas to Chicago (pharmaceuticals)',
    amountCents: 480000, // $4,800
    currency: 'USD',
    source: 'contract_rate',
  });
  if (revCharge) {
    log(`  Revenue charge: $4,800.00`, 'green');
    await api('POST', `/api/v1/charges/${revCharge.id}/approve`);
    state.shipments.s2.charges = [revCharge];
  }

  // Raise a financial query for the temperature excursion
  const query = await api('POST', '/api/v1/financial-queries', {
    shipmentId: shipment.id,
    queryType: 'claim',
    description: 'Temperature excursion during transit - potential cargo damage. Insulin and vaccine pallets may be compromised. Estimated loss: $45,000 wholesale value.',
    amountCents: 4500000, // $45,000 claim
    priority: 'high',
  });
  if (query) {
    log(`  Financial query raised: $45,000 potential claim (${query.id})`, 'yellow');
  }

  log('  Shipment 2 complete - pending exception resolution and quality disposition', 'yellow');
}

// ── Phase 5: Shipment 3 - LTL Consolidation Houston -> Atlanta ───────

async function simulateShipment3() {
  header('Phase 5: Shipment 3 - LTL Consolidation (Houston -> Atlanta)');

  const target = state.customers['target'] || state.customers['best_buy'];
  const lane = state.lanes['houston_atlanta'];
  if (!target || !lane) {
    log('Missing Target/Best Buy customer or Houston->Atlanta lane - skipping shipment 3', 'red');
    return;
  }

  const now = new Date();
  const pickupDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const deliveryDate = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);

  // Create Order A - Home Goods
  subheader('Creating Order A: Home Goods');

  const orderA = await api('POST', '/api/v1/orders', {
    orderNumber: `SIM-ORD-${Date.now()}-003A`,
    poNumber: 'TGT-HG-2024-1122',
    customerId: target.id,
    originId: lane.origin.id,
    destinationId: lane.destination.id,
    requestedPickupDate: pickupDate.toISOString(),
    requestedDeliveryDate: deliveryDate.toISOString(),
    serviceLevel: 'LTL',
    temperatureControl: 'ambient',
    trackableUnits: [
      {
        identifier: 'PLT-HOME-001',
        unitType: 'pallet',
        barcode: '00300590007654301',
        lineItems: [
          { sku: 'BEDDING-QUEEN-SET', description: 'Premium Queen Bedding Set', quantity: 20, weight: 3.2, weightUnit: 'kg' },
          { sku: 'TOWEL-BATH-6PK', description: 'Egyptian Cotton Bath Towel 6-Pack', quantity: 40, weight: 2.8, weightUnit: 'kg' },
          { sku: 'PILLOW-MEM-STD', description: 'Memory Foam Standard Pillow', quantity: 30, weight: 1.5, weightUnit: 'kg' },
        ],
      },
    ],
    notes: 'LTL consolidation candidate - same destination as sporting goods order.',
  });

  if (!orderA) return;
  state.shipments.s3.order = orderA;
  log(`  Order A created: ${orderA.orderNumber} (${orderA.id})`, 'green');

  // Create Order B - Sporting Goods
  subheader('Creating Order B: Sporting Goods');

  const orderB = await api('POST', '/api/v1/orders', {
    orderNumber: `SIM-ORD-${Date.now()}-003B`,
    poNumber: 'TGT-SG-2024-1123',
    customerId: target.id,
    originId: lane.origin.id,
    destinationId: lane.destination.id,
    requestedPickupDate: pickupDate.toISOString(),
    requestedDeliveryDate: deliveryDate.toISOString(),
    serviceLevel: 'LTL',
    temperatureControl: 'ambient',
    trackableUnits: [
      {
        identifier: 'PLT-SPORT-001',
        unitType: 'pallet',
        barcode: '00300590007654302',
        lineItems: [
          { sku: 'YOGA-MAT-PRO', description: 'Professional Yoga Mat 6mm', quantity: 50, weight: 1.8, weightUnit: 'kg' },
          { sku: 'DUMBBELL-SET-ADJ', description: 'Adjustable Dumbbell Set 5-52.5lb', quantity: 15, weight: 24.0, weightUnit: 'kg' },
          { sku: 'RESIST-BAND-KIT', description: 'Resistance Band Kit (5 bands)', quantity: 100, weight: 0.5, weightUnit: 'kg' },
        ],
      },
    ],
    notes: 'LTL consolidation candidate - same destination as home goods order.',
  });

  if (!orderB) return;
  state.shipments.s3.order2 = orderB;
  log(`  Order B created: ${orderB.orderNumber} (${orderB.id})`, 'green');

  await sleep(500);

  // Batch convert both orders into one combined shipment
  subheader('Consolidating Orders into Single LTL Shipment');

  const batchResult = await api('POST', '/api/v1/orders/batch-convert', {
    orderIds: [orderA.id, orderB.id],
    mode: 'combine',
  });

  let shipment: any = null;
  if (batchResult) {
    log('  Orders consolidated into single shipment', 'green');
    // Find the shipment
    const orderADetail = await api('GET', `/api/v1/orders/${orderA.id}`);
    if (orderADetail?.shipmentId) {
      shipment = await api('GET', `/api/v1/shipments/${orderADetail.shipmentId}`);
    }
  }

  if (!shipment?.id) {
    // Fallback: assign individually
    log('  Batch convert may not have worked - trying individual assignment', 'yellow');
    await api('POST', `/api/v1/orders/${orderA.id}/assign-to-shipment`);
    await sleep(300);
    const orderADetail = await api('GET', `/api/v1/orders/${orderA.id}`);
    if (orderADetail?.shipmentId) {
      await api('POST', `/api/v1/orders/${orderB.id}/assign-to-shipment`);
      shipment = await api('GET', `/api/v1/shipments/${orderADetail.shipmentId}`);
    }
  }

  if (!shipment?.id) {
    log('  Could not create consolidated shipment - skipping', 'red');
    return;
  }
  state.shipments.s3.shipment = shipment;
  log(`  Shipment: ${shipment.reference} (${shipment.id}) - 2 orders consolidated`, 'green');

  // Create waterfall tender - Metro first
  subheader('Creating Waterfall Tender');

  const metro = state.carriers['metro'];
  const swift = state.carriers['swift'];
  if (!metro || !swift) {
    log('  Missing carrier IDs for tender', 'red');
    return;
  }

  const tender = await api('POST', '/api/v1/tenders', {
    shipmentId: shipment.id,
    strategy: 'waterfall',
    carrierIds: [metro.id, swift.id], // Metro first in waterfall
    tenderDurationMinutes: 60,
    targetRate: 200000, // $2,000 target
    currency: 'USD',
    equipmentType: 'LTL - Shared Trailer',
    notes: 'LTL consolidated load: 2 pallets (home goods + sporting goods). Houston to Atlanta.',
  });

  if (!tender) return;
  state.shipments.s3.tender = tender;
  log(`  Waterfall tender created: Metro first, then Swift`, 'green');

  // Open tender
  await api('POST', `/api/v1/tenders/${tender.id}/open`);
  log('  Tender opened - Metro Regional Express notified first', 'green');

  await sleep(1000);

  // Metro accepts via portal
  subheader('Carrier Response');
  if (state.carrierJwts['metro']) {
    log('  Metro Regional Express: Reviewing LTL load... Accepting!', 'blue');
    const bid = await api('POST', `/api/v1/carrier-portal/tenders/${tender.id}/bid`, {
      rate: 185000, // $1,850
      currency: 'USD',
      transitDays: 3,
      equipmentType: 'LTL Shared Trailer',
      notes: 'Houston-Atlanta is our core lane. Daily departures.',
    }, { Authorization: `Bearer ${state.carrierJwts['metro']}` });
    if (bid) {
      log(`  Metro bid: $1,850 / 3 days transit`, 'green');
      state.shipments.s3.bids = [bid];

      // Award immediately (waterfall - first acceptable bid)
      log('  Waterfall: First carrier accepted - awarding...', 'blue');
      await api('POST', `/api/v1/tenders/${tender.id}/award`, { bidId: bid.id });
      log('  Tender awarded to Metro Regional Express!', 'green');
    }
  }

  await sleep(1000);

  // Dispatch
  subheader('Dispatching Shipment');
  await api('PUT', `/api/v1/shipments/${shipment.id}`, {
    status: 'in_transit',
    carrierId: metro.id,
    pickupDate: pickupDate.toISOString(),
    deliveryDate: deliveryDate.toISOString(),
  });
  log('  Shipment is now IN TRANSIT (LTL consolidated)', 'green');

  // GPS pings
  subheader('GPS Tracking - In Transit');
  const waypoints = [
    { lat: 29.76, lon: -95.37, label: 'Houston, TX (origin)' },
    { lat: 30.46, lon: -91.19, label: 'Baton Rouge, LA' },
    { lat: 32.30, lon: -90.18, label: 'Jackson, MS' },
    { lat: 32.37, lon: -86.30, label: 'Montgomery, AL' },
    { lat: 33.75, lon: -84.39, label: 'Atlanta, GA (destination)' },
  ];

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const eventTime = new Date(now.getTime() + (3 + i * 0.6) * 24 * 60 * 60 * 1000);
    log(`  GPS ping ${i + 1}/${waypoints.length}: ${wp.label}`, 'blue');

    if (state.apiKey) {
      await api('POST', '/api/v1/webhook', {
        event: {
          device: { name: shipment.reference },
          type: 'location',
          startTime: eventTime.toISOString(),
          latestTime: eventTime.toISOString(),
          location: {
            global: { lat: wp.lat, lon: wp.lon },
            summary: wp.label,
          },
        },
      }, { 'x-api-key': state.apiKey });
    }
    await sleep(300);
  }

  // Deliver
  subheader('Delivery Confirmation');
  await api('PUT', `/api/v1/shipments/${shipment.id}`, { status: 'delivered' });
  log('  Shipment DELIVERED at Atlanta', 'green');

  // Mark both orders delivered
  for (const ord of [orderA, orderB]) {
    await api('POST', `/api/v1/orders/${ord.id}/delivery-status`, {
      deliveryStatus: 'delivered',
      deliveryMethod: 'manual',
      deliveryConfirmedBy: 'Atlanta DC Receiving',
      deliveryNotes: 'Pallet received, cargo in good condition.',
    });
  }
  log('  Both orders confirmed delivered', 'green');

  // Revenue charges for both orders
  subheader('Financial: Revenue Charges');
  const revA = await api('POST', '/api/v1/charges', {
    shipmentId: shipment.id,
    orderId: orderA.id,
    chargeType: 'linehaul',
    chargeCategory: 'revenue',
    description: 'LTL Linehaul - Home Goods (Houston to Atlanta)',
    amountCents: 125000, // $1,250
    currency: 'USD',
    source: 'contract_rate',
  });
  if (revA) {
    log('  Revenue charge (Order A - Home Goods): $1,250.00', 'green');
    await api('POST', `/api/v1/charges/${revA.id}/approve`);
  }

  const revB = await api('POST', '/api/v1/charges', {
    shipmentId: shipment.id,
    orderId: orderB.id,
    chargeType: 'linehaul',
    chargeCategory: 'revenue',
    description: 'LTL Linehaul - Sporting Goods (Houston to Atlanta)',
    amountCents: 115000, // $1,150
    currency: 'USD',
    source: 'contract_rate',
  });
  if (revB) {
    log('  Revenue charge (Order B - Sporting Goods): $1,150.00', 'green');
    await api('POST', `/api/v1/charges/${revB.id}/approve`);
  }

  state.shipments.s3.charges = [revA, revB].filter(Boolean);
  log('  Shipment 3 complete! Combined revenue: $2,400 / Cost: $1,850 / Margin: $550 (22.9%)', 'green');
}

// ── Phase 6: Financial Settlement ────────────────────────────────────

async function settleFinancials() {
  header('Phase 6: Financial Settlement');

  // Carrier invoices
  subheader('Receiving Carrier Invoices');

  // Shipment 1: Swift invoice
  const s1 = state.shipments.s1;
  if (s1.shipment?.id && state.carriers['swift']?.id) {
    const ci1 = await api('POST', '/api/v1/carrier-invoices', {
      carrierId: state.carriers['swift'].id,
      invoiceNumber: 'SWFT-INV-2024-0891',
      totalCents: 287500, // $2,875 (slightly above bid - fuel surcharge)
      currency: 'USD',
      lineItems: [
        {
          shipmentId: s1.shipment.id,
          chargeType: 'linehaul',
          description: 'FTL Phoenix to Portland',
          amountCents: 285000,
        },
        {
          shipmentId: s1.shipment.id,
          chargeType: 'fuel_surcharge',
          description: 'Fuel surcharge (0.88%)',
          amountCents: 2500,
        },
      ],
      notes: 'Standard 30-day payment terms',
    });
    if (ci1) {
      log(`  Swift invoice received: $2,875.00 - Match: ${ci1.matchStatus || 'pending'}`, 'green');
      state.shipments.s1.carrierInvoice = ci1;
    }
  }

  // Shipment 2: ColdStar invoice
  const s2 = state.shipments.s2;
  if (s2.shipment?.id && state.carriers['coldstar']?.id) {
    const ci2 = await api('POST', '/api/v1/carrier-invoices', {
      carrierId: state.carriers['coldstar'].id,
      invoiceNumber: 'CLST-INV-2024-0445',
      totalCents: 415000, // $4,150 (includes reefer fuel premium)
      currency: 'USD',
      lineItems: [
        {
          shipmentId: s2.shipment.id,
          chargeType: 'linehaul',
          description: 'FTL Reefer Dallas to Chicago',
          amountCents: 410000,
        },
        {
          shipmentId: s2.shipment.id,
          chargeType: 'fuel_surcharge',
          description: 'Reefer fuel premium',
          amountCents: 5000,
        },
      ],
      notes: 'Note: Temperature excursion occurred during transit - see incident report CLST-IR-2024-0089',
    });
    if (ci2) {
      log(`  ColdStar invoice received: $4,150.00 - Match: ${ci2.matchStatus || 'pending'}`, 'green');
      state.shipments.s2.carrierInvoice = ci2;
    }
  }

  // Shipment 3: Metro invoice
  const s3 = state.shipments.s3;
  if (s3.shipment?.id && state.carriers['metro']?.id) {
    const ci3 = await api('POST', '/api/v1/carrier-invoices', {
      carrierId: state.carriers['metro'].id,
      invoiceNumber: 'MTRX-INV-2024-0672',
      totalCents: 185000, // $1,850 (exact match to bid)
      currency: 'USD',
      lineItems: [
        {
          shipmentId: s3.shipment.id,
          chargeType: 'linehaul',
          description: 'LTL Houston to Atlanta (2 pallets consolidated)',
          amountCents: 185000,
        },
      ],
    });
    if (ci3) {
      log(`  Metro invoice received: $1,850.00 - Match: ${ci3.matchStatus || 'pending'}`, 'green');
      state.shipments.s3.carrierInvoice = ci3;
    }
  }

  await sleep(1000);

  // Customer invoices
  subheader('Creating Customer Invoices');

  // Invoice for Shipment 1 (Walmart)
  if (s1.shipment?.id && state.customers['walmart']?.id) {
    const inv1 = await api('POST', '/api/v1/invoices', {
      customerId: state.customers['walmart'].id,
      shipmentIds: [s1.shipment.id],
      notes: 'FTL Electronics shipment - Phoenix to Portland',
    });
    if (inv1) {
      log(`  Walmart invoice created: ${inv1.invoiceNumber || inv1.id}`, 'green');
      state.shipments.s1.invoice = inv1;

      // Approve and send
      await api('POST', `/api/v1/invoices/${inv1.id}/approve`);
      log('    Invoice approved', 'green');
      await api('POST', `/api/v1/invoices/${inv1.id}/send`);
      log('    Invoice sent to customer', 'green');

      // Record payment
      await sleep(500);
      await api('POST', `/api/v1/invoices/${inv1.id}/payments`, {
        amountCents: 320000,
        paymentMethod: 'ach',
        referenceNumber: 'WM-ACH-2024-44821',
        receivedDate: new Date().toISOString().split('T')[0],
        notes: 'Payment received via ACH',
      });
      log('    Payment received: $3,200.00 via ACH - PAID IN FULL', 'green');
    }
  }

  // Invoice for Shipment 2 (CVS) - noting the pending quality query
  if (s2.shipment?.id && state.customers['cvs']?.id) {
    const inv2 = await api('POST', '/api/v1/invoices', {
      customerId: state.customers['cvs'].id,
      shipmentIds: [s2.shipment.id],
      notes: 'FTL Reefer Pharma shipment - Dallas to Chicago. Note: temperature excursion query pending resolution.',
      internalNotes: 'DO NOT send until quality query CLST-IR-2024-0089 is resolved. Potential credit note needed.',
    });
    if (inv2) {
      log(`  CVS invoice created: ${inv2.invoiceNumber || inv2.id} (HOLD - pending quality review)`, 'yellow');
      state.shipments.s2.invoice = inv2;
      // Approve but don't send yet - pending query
      await api('POST', `/api/v1/invoices/${inv2.id}/approve`);
      log('    Invoice approved but held pending exception resolution', 'yellow');
    }
  }

  // Invoice for Shipment 3 (Target) - consolidated
  if (s3.shipment?.id && (state.customers['target']?.id || state.customers['best_buy']?.id)) {
    const customerId = state.customers['target']?.id || state.customers['best_buy']?.id;
    const inv3 = await api('POST', '/api/v1/invoices', {
      customerId,
      shipmentIds: [s3.shipment.id],
      notes: 'LTL Consolidated shipment (2 orders) - Houston to Atlanta',
    });
    if (inv3) {
      log(`  Target invoice created: ${inv3.invoiceNumber || inv3.id}`, 'green');
      state.shipments.s3.invoice = inv3;

      await api('POST', `/api/v1/invoices/${inv3.id}/approve`);
      log('    Invoice approved', 'green');
      await api('POST', `/api/v1/invoices/${inv3.id}/send`);
      log('    Invoice sent to customer', 'green');

      // Partial payment
      await sleep(500);
      await api('POST', `/api/v1/invoices/${inv3.id}/payments`, {
        amountCents: 240000,
        paymentMethod: 'wire',
        referenceNumber: 'TGT-WIRE-2024-7891',
        receivedDate: new Date().toISOString().split('T')[0],
        notes: 'Full payment via wire transfer',
      });
      log('    Payment received: $2,400.00 via wire - PAID IN FULL', 'green');
    }
  }
}

// ── Summary ──────────────────────────────────────────────────────────

function printSummary() {
  header('Simulation Summary');

  console.log(`${COLORS.bright}Shipments Created:${COLORS.reset}`);
  console.log('');

  const rows = [
    {
      name: '1. FTL Electronics',
      route: 'Phoenix -> Portland',
      customer: 'Walmart',
      carrier: 'Swift National Freight',
      status: 'Delivered + Paid',
      revenue: '$3,200',
      cost: '$2,875',
      margin: '$325',
    },
    {
      name: '2. Cold Chain Pharma',
      route: 'Dallas -> Chicago',
      customer: 'CVS',
      carrier: 'ColdStar Logistics',
      status: 'Delivered + Exception',
      revenue: '$4,800',
      cost: '$4,150',
      margin: '$650 (query pending)',
    },
    {
      name: '3. LTL Consolidated',
      route: 'Houston -> Atlanta',
      customer: 'Target',
      carrier: 'Metro Regional Express',
      status: 'Delivered + Paid',
      revenue: '$2,400',
      cost: '$1,850',
      margin: '$550',
    },
  ];

  for (const r of rows) {
    console.log(`  ${COLORS.bright}${r.name}${COLORS.reset}`);
    console.log(`    Route:    ${r.route}`);
    console.log(`    Customer: ${r.customer}`);
    console.log(`    Carrier:  ${r.carrier}`);
    console.log(`    Status:   ${r.status}`);
    console.log(`    Revenue:  ${r.revenue}  |  Cost: ${r.cost}  |  Margin: ${r.margin}`);
    console.log('');
  }

  console.log(`${COLORS.bright}Total Portfolio:${COLORS.reset}`);
  console.log(`  Revenue: $10,400  |  Cost: $8,875  |  Gross Margin: $1,525 (14.7%)`);
  console.log('');

  console.log(`${COLORS.bright}What to explore in the UI:${COLORS.reset}`);
  console.log('  - Operations dashboard: 3 shipments with GPS tracks');
  console.log('  - Triage Centre: Cold chain excursion issue (critical)');
  console.log('  - Financial Reports: Revenue, cost, and margin breakdown');
  console.log('  - Domain Event Log: Full event cascade for all operations');
  console.log('  - Carrier portal (login as any carrier to see bid history)');
  console.log('');
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log(`${COLORS.bright}${COLORS.magenta}`);
  console.log('  ___                    _____ __  __ ____  ');
  console.log(' / _ \\ _ __   ___ _ __  |_   _|  \\/  / ___| ');
  console.log('| | | | \'_ \\ / _ \\ \'_ \\   | | | |\\/| \\___ \\ ');
  console.log('| |_| | |_) |  __/ | | |  | | | |  | |___) |');
  console.log(' \\___/| .__/ \\___|_| |_|  |_| |_|  |_|____/ ');
  console.log('      |_|                                     ');
  console.log(`${COLORS.reset}`);
  console.log(`${COLORS.bright}  A Week in Logistics - Full Simulation${COLORS.reset}`);
  console.log(`  Backend: ${BASE}`);
  console.log('');

  // Check backend is running
  try {
    const res = await fetch(`${BASE}/api/v1/customers`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
  } catch {
    console.error(`${COLORS.red}ERROR: Backend not reachable at ${BASE}`);
    console.error(`Start the backend first: cd backend && npm run dev${COLORS.reset}`);
    process.exit(1);
  }

  const startTime = Date.now();

  try {
    await seedData();
    await setupCarriers();
    await setupLaneCarriers();
    await simulateShipment1();
    await simulateShipment2();
    await simulateShipment3();
    await settleFinancials();
    printSummary();
  } catch (err) {
    console.error(`${COLORS.red}Simulation error:${COLORS.reset}`, err);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`Simulation completed in ${elapsed}s`, 'cyan');
}

main().catch(console.error);
