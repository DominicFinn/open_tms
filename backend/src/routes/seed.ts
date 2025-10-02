import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export async function seedRoutes(server: FastifyInstance) {
  // Seed data endpoint
  server.post('/api/v1/seed', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Clear existing data
      await server.prisma.shipment.deleteMany();
      await server.prisma.location.deleteMany();
      await server.prisma.customer.deleteMany();

      // Create customers
      const customers = await server.prisma.customer.createMany({
        data: [
          { name: 'Walmart Inc.', contactEmail: 'logistics@walmart.com' },
          { name: 'Best Buy Co. Inc.', contactEmail: 'supply@bestbuy.com' },
          { name: 'Target Corporation', contactEmail: 'operations@target.com' },
          { name: 'Amazon.com Inc.', contactEmail: 'fulfillment@amazon.com' },
          { name: 'Home Depot Inc.', contactEmail: 'distribution@homedepot.com' },
          { name: 'Lowe\'s Companies Inc.', contactEmail: 'logistics@lowes.com' },
          { name: 'Costco Wholesale Corporation', contactEmail: 'supply@costco.com' },
          { name: 'Kroger Company', contactEmail: 'distribution@kroger.com' },
          { name: 'CVS Health Corporation', contactEmail: 'logistics@cvs.com' },
          { name: 'Walgreens Boots Alliance', contactEmail: 'supply@walgreens.com' }
        ]
      });

      // Create locations (20 warehouses/distribution centers + real Walmart/Best Buy locations)
      const locations = await server.prisma.location.createMany({
        data: [
          // Head Office - Dallas, Texas
          {
            name: 'Head Office - Dallas',
            address1: '1234 Commerce Street',
            city: 'Dallas',
            state: 'Texas',
            postalCode: '75201',
            country: 'USA',
            lat: 32.7767,
            lng: -96.7970
          },
          // Warehouses and Distribution Centers (20)
          {
            name: 'Central Distribution Center - Chicago',
            address1: '5000 W 159th St',
            city: 'Chicago',
            state: 'Illinois',
            postalCode: '60477',
            country: 'USA',
            lat: 41.8781,
            lng: -87.6298
          },
          {
            name: 'West Coast Hub - Los Angeles',
            address1: '12000 E 40th St',
            city: 'Los Angeles',
            state: 'California',
            postalCode: '90058',
            country: 'USA',
            lat: 34.0522,
            lng: -118.2437
          },
          {
            name: 'Northeast Distribution - New York',
            address1: '1000 6th Ave',
            city: 'New York',
            state: 'New York',
            postalCode: '10018',
            country: 'USA',
            lat: 40.7128,
            lng: -74.0060
          },
          {
            name: 'Southeast Warehouse - Atlanta',
            address1: '2000 Peachtree Rd',
            city: 'Atlanta',
            state: 'Georgia',
            postalCode: '30309',
            country: 'USA',
            lat: 33.7490,
            lng: -84.3880
          },
          {
            name: 'Midwest Logistics Center - Kansas City',
            address1: '3000 Main St',
            city: 'Kansas City',
            state: 'Missouri',
            postalCode: '64111',
            country: 'USA',
            lat: 39.0997,
            lng: -94.5786
          },
          {
            name: 'Southwest Distribution - Phoenix',
            address1: '4000 N Central Ave',
            city: 'Phoenix',
            state: 'Arizona',
            postalCode: '85012',
            country: 'USA',
            lat: 33.4484,
            lng: -112.0740
          },
          {
            name: 'Phoenix DC - Distribution Center',
            address1: '2500 W Buckeye Rd',
            city: 'Phoenix',
            state: 'Arizona',
            postalCode: '85009',
            country: 'USA',
            lat: 33.4484,
            lng: -112.0740
          },
          {
            name: 'Northwest Hub - Seattle',
            address1: '5000 1st Ave S',
            city: 'Seattle',
            state: 'Washington',
            postalCode: '98134',
            country: 'USA',
            lat: 47.6062,
            lng: -122.3321
          },
          {
            name: 'Rocky Mountain Distribution - Denver',
            address1: '6000 E Colfax Ave',
            city: 'Denver',
            state: 'Colorado',
            postalCode: '80220',
            country: 'USA',
            lat: 39.7392,
            lng: -104.9903
          },
          {
            name: 'Gulf Coast Warehouse - Houston',
            address1: '7000 Main St',
            city: 'Houston',
            state: 'Texas',
            postalCode: '77002',
            country: 'USA',
            lat: 29.7604,
            lng: -95.3698
          },
          {
            name: 'Great Lakes Distribution - Detroit',
            address1: '8000 Woodward Ave',
            city: 'Detroit',
            state: 'Michigan',
            postalCode: '48201',
            country: 'USA',
            lat: 42.3314,
            lng: -83.0458
          },
          {
            name: 'Pacific Northwest Hub - Portland',
            address1: '9000 SW 5th Ave',
            city: 'Portland',
            state: 'Oregon',
            postalCode: '97204',
            country: 'USA',
            lat: 45.5152,
            lng: -122.6784
          },
          {
            name: 'Walmart Supercenter - Portland',
            address1: '4200 SE 82nd Ave',
            city: 'Portland',
            state: 'Oregon',
            postalCode: '97266',
            country: 'USA',
            lat: 45.5152,
            lng: -122.6784
          },
          {
            name: 'Southeast Logistics - Miami',
            address1: '10000 Biscayne Blvd',
            city: 'Miami',
            state: 'Florida',
            postalCode: '33132',
            country: 'USA',
            lat: 25.7617,
            lng: -80.1918
          },
          {
            name: 'Central Plains Distribution - Omaha',
            address1: '11000 Dodge St',
            city: 'Omaha',
            state: 'Nebraska',
            postalCode: '68102',
            country: 'USA',
            lat: 41.2565,
            lng: -95.9345
          },
          {
            name: 'Desert Southwest Hub - Las Vegas',
            address1: '12000 Las Vegas Blvd',
            city: 'Las Vegas',
            state: 'Nevada',
            postalCode: '89101',
            country: 'USA',
            lat: 36.1699,
            lng: -115.1398
          },
          {
            name: 'Appalachian Distribution - Nashville',
            address1: '13000 Broadway',
            city: 'Nashville',
            state: 'Tennessee',
            postalCode: '37203',
            country: 'USA',
            lat: 36.1627,
            lng: -86.7816
          },
          {
            name: 'Great Plains Logistics - Oklahoma City',
            address1: '14000 N Lincoln Blvd',
            city: 'Oklahoma City',
            state: 'Oklahoma',
            postalCode: '73105',
            country: 'USA',
            lat: 35.4676,
            lng: -97.5164
          },
          {
            name: 'Mountain West Distribution - Salt Lake City',
            address1: '15000 S State St',
            city: 'Salt Lake City',
            state: 'Utah',
            postalCode: '84115',
            country: 'USA',
            lat: 40.7608,
            lng: -111.8910
          },
          {
            name: 'Upper Midwest Hub - Minneapolis',
            address1: '16000 Nicollet Mall',
            city: 'Minneapolis',
            state: 'Minnesota',
            postalCode: '55403',
            country: 'USA',
            lat: 44.9778,
            lng: -93.2650
          },
          {
            name: 'New England Distribution - Boston',
            address1: '17000 Boylston St',
            city: 'Boston',
            state: 'Massachusetts',
            postalCode: '02115',
            country: 'USA',
            lat: 42.3398,
            lng: -71.0882
          },
          {
            name: 'Mid-Atlantic Logistics - Philadelphia',
            address1: '18000 Market St',
            city: 'Philadelphia',
            state: 'Pennsylvania',
            postalCode: '19107',
            country: 'USA',
            lat: 39.9526,
            lng: -75.1652
          },
          {
            name: 'Deep South Distribution - New Orleans',
            address1: '19000 Canal St',
            city: 'New Orleans',
            state: 'Louisiana',
            postalCode: '70112',
            country: 'USA',
            lat: 29.9511,
            lng: -90.0715
          },
          // Real Walmart Locations (10 major stores)
          {
            name: 'Walmart Supercenter - Dallas',
            address1: '4000 E Mockingbird Ln',
            city: 'Dallas',
            state: 'Texas',
            postalCode: '75206',
            country: 'USA',
            lat: 32.7767,
            lng: -96.7970
          },
          {
            name: 'Walmart Supercenter - Los Angeles',
            address1: '6040 S Vermont Ave',
            city: 'Los Angeles',
            state: 'California',
            postalCode: '90044',
            country: 'USA',
            lat: 34.0522,
            lng: -118.2437
          },
          {
            name: 'Walmart Supercenter - New York',
            address1: '2500 Broadway',
            city: 'New York',
            state: 'New York',
            postalCode: '10025',
            country: 'USA',
            lat: 40.7128,
            lng: -74.0060
          },
          {
            name: 'Walmart Supercenter - Chicago',
            address1: '4650 W North Ave',
            city: 'Chicago',
            state: 'Illinois',
            postalCode: '60639',
            country: 'USA',
            lat: 41.8781,
            lng: -87.6298
          },
          {
            name: 'Walmart Supercenter - Houston',
            address1: '11111 Katy Fwy',
            city: 'Houston',
            state: 'Texas',
            postalCode: '77079',
            country: 'USA',
            lat: 29.7604,
            lng: -95.3698
          },
          {
            name: 'Walmart Supercenter - Phoenix',
            address1: '8080 N 19th Ave',
            city: 'Phoenix',
            state: 'Arizona',
            postalCode: '85021',
            country: 'USA',
            lat: 33.4484,
            lng: -112.0740
          },
          {
            name: 'Walmart Supercenter - Philadelphia',
            address1: '2200 S 67th St',
            city: 'Philadelphia',
            state: 'Pennsylvania',
            postalCode: '19142',
            country: 'USA',
            lat: 39.9526,
            lng: -75.1652
          },
          {
            name: 'Walmart Supercenter - San Antonio',
            address1: '5555 De Zavala Rd',
            city: 'San Antonio',
            state: 'Texas',
            postalCode: '78249',
            country: 'USA',
            lat: 29.4241,
            lng: -98.4936
          },
          {
            name: 'Walmart Supercenter - San Diego',
            address1: '3040 Market St',
            city: 'San Diego',
            state: 'California',
            postalCode: '92101',
            country: 'USA',
            lat: 32.7157,
            lng: -117.1611
          },
          {
            name: 'Walmart Supercenter - Jacksonville',
            address1: '8800 Beach Blvd',
            city: 'Jacksonville',
            state: 'Florida',
            postalCode: '32216',
            country: 'USA',
            lat: 30.3322,
            lng: -81.6557
          },
          // Real Best Buy Locations (10 major stores)
          {
            name: 'Best Buy - Dallas',
            address1: '11661 Preston Rd',
            city: 'Dallas',
            state: 'Texas',
            postalCode: '75230',
            country: 'USA',
            lat: 32.7767,
            lng: -96.7970
          },
          {
            name: 'Best Buy - Los Angeles',
            address1: '10820 W Pico Blvd',
            city: 'Los Angeles',
            state: 'California',
            postalCode: '90064',
            country: 'USA',
            lat: 34.0522,
            lng: -118.2437
          },
          {
            name: 'Best Buy - New York',
            address1: '517 86th St',
            city: 'New York',
            state: 'New York',
            postalCode: '10028',
            country: 'USA',
            lat: 40.7128,
            lng: -74.0060
          },
          {
            name: 'Best Buy - Chicago',
            address1: '1200 N Clark St',
            city: 'Chicago',
            state: 'Illinois',
            postalCode: '60610',
            country: 'USA',
            lat: 41.8781,
            lng: -87.6298
          },
          {
            name: 'Best Buy - Houston',
            address1: '5929 Westheimer Rd',
            city: 'Houston',
            state: 'Texas',
            postalCode: '77057',
            country: 'USA',
            lat: 29.7604,
            lng: -95.3698
          },
          {
            name: 'Best Buy - Phoenix',
            address1: '4730 E Cactus Rd',
            city: 'Phoenix',
            state: 'Arizona',
            postalCode: '85032',
            country: 'USA',
            lat: 33.4484,
            lng: -112.0740
          },
          {
            name: 'Best Buy - Atlanta',
            address1: '3500 Peachtree Rd NE',
            city: 'Atlanta',
            state: 'Georgia',
            postalCode: '30326',
            country: 'USA',
            lat: 33.7490,
            lng: -84.3880
          },
          {
            name: 'Best Buy - Miami',
            address1: '11401 NW 12th St',
            city: 'Miami',
            state: 'Florida',
            postalCode: '33172',
            country: 'USA',
            lat: 25.7617,
            lng: -80.1918
          },
          {
            name: 'Best Buy - Seattle',
            address1: '2800 SW Barton St',
            city: 'Seattle',
            state: 'Washington',
            postalCode: '98126',
            country: 'USA',
            lat: 47.6062,
            lng: -122.3321
          },
          {
            name: 'Best Buy - Denver',
            address1: '7800 E Hampden Ave',
            city: 'Denver',
            state: 'Colorado',
            postalCode: '80231',
            country: 'USA',
            lat: 39.7392,
            lng: -104.9903
          }
        ]
      });

      // Create realistic lane routes based on locations
      const allLocations = await server.prisma.location.findMany();

      // Group locations by city for easier reference
      const locationsByCity = allLocations.reduce((acc, location) => {
        if (!acc[location.city]) {
          acc[location.city] = [];
        }
        acc[location.city].push(location);
        return acc;
      }, {} as Record<string, typeof allLocations>);

      // Define major interstate routes (realistic trucking lanes)
      const majorRoutes = [
        // East Coast Corridor
        { from: 'New York', to: 'Philadelphia', distance: 95 },
        { from: 'Philadelphia', to: 'Atlanta', distance: 750 },
        { from: 'Atlanta', to: 'Miami', distance: 660 },
        { from: 'New York', to: 'Boston', distance: 215 },

        // I-95 Corridor
        { from: 'Boston', to: 'New York', distance: 215 },
        { from: 'New York', to: 'Philadelphia', distance: 95 },
        { from: 'Philadelphia', to: 'Atlanta', distance: 750 },
        { from: 'Atlanta', to: 'Jacksonville', distance: 350 },
        { from: 'Jacksonville', to: 'Miami', distance: 350 },

        // I-10 Corridor (Southern Route)
        { from: 'Los Angeles', to: 'Phoenix', distance: 370 },
        { from: 'Phoenix', to: 'San Antonio', distance: 870 },
        { from: 'San Antonio', to: 'Houston', distance: 200 },
        { from: 'Houston', to: 'New Orleans', distance: 350 },
        { from: 'New Orleans', to: 'Jacksonville', distance: 500 },

        // I-40 Corridor (Central Route)
        { from: 'Los Angeles', to: 'Phoenix', distance: 370 },
        { from: 'Phoenix', to: 'Oklahoma City', distance: 850 },
        { from: 'Oklahoma City', to: 'Nashville', distance: 650 },
        { from: 'Nashville', to: 'Atlanta', distance: 250 },

        // I-80 Corridor (Northern Route)
        { from: 'San Francisco', to: 'Salt Lake City', distance: 650 },
        { from: 'Salt Lake City', to: 'Denver', distance: 520 },
        { from: 'Denver', to: 'Chicago', distance: 920 },
        { from: 'Chicago', to: 'New York', distance: 790 },

        // I-35 Corridor (North-South Central)
        { from: 'Dallas', to: 'Oklahoma City', distance: 200 },
        { from: 'Oklahoma City', to: 'Kansas City', distance: 350 },
        { from: 'Kansas City', to: 'Minneapolis', distance: 400 },
        { from: 'Dallas', to: 'San Antonio', distance: 280 },
        { from: 'San Antonio', to: 'Houston', distance: 200 },

        // Regional Routes
        { from: 'Seattle', to: 'Denver', distance: 1020 },
        { from: 'Denver', to: 'Phoenix', distance: 600 },
        { from: 'Chicago', to: 'Minneapolis', distance: 400 },
        { from: 'Minneapolis', to: 'Denver', distance: 680 },
        { from: 'Atlanta', to: 'Nashville', distance: 250 },
        { from: 'Nashville', to: 'Chicago', distance: 470 },
        { from: 'Houston', to: 'Dallas', distance: 240 },
        { from: 'Dallas', to: 'Atlanta', distance: 800 },
        { from: 'Los Angeles', to: 'San Diego', distance: 120 },
        { from: 'San Francisco', to: 'Los Angeles', distance: 380 },
        { from: 'Miami', to: 'Atlanta', distance: 660 },
        { from: 'Jacksonville', to: 'Atlanta', distance: 350 },
        { from: 'New Orleans', to: 'Atlanta', distance: 470 },
        { from: 'Boston', to: 'Philadelphia', distance: 310 },
        { from: 'Philadelphia', to: 'New York', distance: 95 }
      ];

      // Create lanes from the route definitions
      const lanesToCreate = [];
      for (const route of majorRoutes) {
        const fromLocations = locationsByCity[route.from];
        const toLocations = locationsByCity[route.to];

        if (fromLocations && toLocations) {
          // Create lanes between different location types in each city
          for (const fromLocation of fromLocations) {
            for (const toLocation of toLocations) {
              if (fromLocation.id !== toLocation.id) {
                lanesToCreate.push({
                  name: `${fromLocation.city} → ${toLocation.city}`,
                  originId: fromLocation.id,
                  destinationId: toLocation.id,
                  distance: route.distance,
                  notes: `Major ${route.from} → ${route.to} route`
                });
              }
            }
          }
        }
      }

      // Add some additional regional and local routes
      const additionalRoutes = [
        // Texas Triangle
        { from: 'Dallas', to: 'Houston', distance: 240 },
        { from: 'Houston', to: 'San Antonio', distance: 200 },
        { from: 'San Antonio', to: 'Dallas', distance: 280 },

        // California Routes
        { from: 'Los Angeles', to: 'San Francisco', distance: 380 },
        { from: 'San Francisco', to: 'San Diego', distance: 500 },
        { from: 'Los Angeles', to: 'San Diego', distance: 120 },

        // Florida Routes
        { from: 'Miami', to: 'Jacksonville', distance: 350 },
        { from: 'Jacksonville', to: 'Atlanta', distance: 350 },

        // Midwest Routes
        { from: 'Chicago', to: 'Minneapolis', distance: 400 },
        { from: 'Minneapolis', to: 'Denver', distance: 680 },
        { from: 'Chicago', to: 'Nashville', distance: 470 },

        // Northeast Routes
        { from: 'Boston', to: 'New York', distance: 215 },
        { from: 'New York', to: 'Philadelphia', distance: 95 },
        { from: 'Philadelphia', to: 'Boston', distance: 310 },

        // Phoenix to Portland Route
        { from: 'Phoenix', to: 'Portland', distance: 1140 }
      ];

      for (const route of additionalRoutes) {
        const fromLocations = locationsByCity[route.from];
        const toLocations = locationsByCity[route.to];

        if (fromLocations && toLocations) {
          // Create one lane per city pair (not all combinations)
          const fromLocation = fromLocations[0]; // Take first location of each type
          const toLocation = toLocations[0];

          if (fromLocation.id !== toLocation.id) {
            lanesToCreate.push({
              name: `${fromLocation.city} → ${toLocation.city}`,
              originId: fromLocation.id,
              destinationId: toLocation.id,
              distance: route.distance,
              notes: `Regional ${route.from} → ${route.to} route`
            });
          }
        }
      }

      // Create all lanes
      if (lanesToCreate.length > 0) {
        await server.prisma.lane.createMany({
          data: lanesToCreate
        });
      }

      // Create some sample shipments
      const allCustomers = await server.prisma.customer.findMany();

      // Find Phoenix DC and Portland Walmart locations
      const phoenixDC = allLocations.find(loc => loc.name === 'Phoenix DC - Distribution Center');
      const portlandWalmart = allLocations.find(loc => loc.name === 'Walmart Supercenter - Portland');
      const walmartCustomer = allCustomers.find(customer => customer.name === 'Walmart Inc.');

      const sampleShipments = [];

      // Add specific Phoenix to Portland shipment
      if (phoenixDC && portlandWalmart && walmartCustomer) {
        sampleShipments.push({
          reference: 'SH-PHX-PDX-001',
          customerId: walmartCustomer.id,
          originId: phoenixDC.id,
          destinationId: portlandWalmart.id,
          status: 'in_transit',
          items: [
            {
              sku: 'WAL-ELEC-001',
              description: 'Electronics - Tablets and Accessories',
              quantity: 120,
              weightKg: 580,
              volumeM3: 12
            },
            {
              sku: 'WAL-HOME-002',
              description: 'Home Goods - Kitchen Appliances',
              quantity: 85,
              weightKg: 920,
              volumeM3: 18
            }
          ]
        });
      }

      // Add random shipments
      for (let i = 0; i < 14; i++) {
        const customer = allCustomers[Math.floor(Math.random() * allCustomers.length)];
        const origin = allLocations[Math.floor(Math.random() * allLocations.length)];
        const destination = allLocations[Math.floor(Math.random() * allLocations.length)];

        sampleShipments.push({
          reference: `SH-${String(i + 2).padStart(4, '0')}`,
          customerId: customer.id,
          originId: origin.id,
          destinationId: destination.id,
          status: ['draft', 'in_transit', 'delivered'][Math.floor(Math.random() * 3)],
          items: [
            {
              sku: `ITEM-${Math.floor(Math.random() * 1000)}`,
              description: `Product ${i + 2}`,
              quantity: Math.floor(Math.random() * 50) + 1,
              weightKg: Math.floor(Math.random() * 100) + 1,
              volumeM3: Math.floor(Math.random() * 10) + 1
            }
          ]
        });
      }

      await server.prisma.shipment.createMany({
        data: sampleShipments
      });

      // Get count of created lanes
      const laneCount = await server.prisma.lane.count();

      reply.code(201);
      return {
        data: {
          message: 'Database seeded successfully',
          customers: allCustomers.length,
          locations: allLocations.length,
          lanes: laneCount,
          shipments: sampleShipments.length
        },
        error: null
      };
    } catch (error) {
      reply.code(500);
      return { data: null, error: 'Failed to seed database' };
    }
  });
}
