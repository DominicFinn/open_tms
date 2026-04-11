import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomUUID, createHash } from 'crypto';

/**
 * Warehouse App API Routes
 *
 * Mobile-first endpoints for warehouse operatives to launch shipments,
 * scan devices, and manage the day's work.
 */
export async function warehouseRoutes(server: FastifyInstance) {
  const prisma = server.prisma;

  // ─── Auth: Magic Link ───────────────────────────────────────────────────────

  /**
   * POST /api/v1/warehouse/auth/magic-link/generate
   * Generate a persistent magic link token for a user (admin action).
   * Returns a token that can be encoded into a QR code.
   */
  server.post('/api/v1/warehouse/auth/magic-link/generate', {
    schema: {
      tags: ['Warehouse'],
      summary: 'Generate magic link token for QR code login',
      body: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', format: 'uuid' },
          expiresInDays: { type: 'number', description: 'Days until expiry. Null = never expires.' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      userId: z.string().uuid(),
      expiresInDays: z.number().positive().optional(),
    }).parse(req.body);

    // Check magic links are enabled
    const org = await prisma.organization.findFirst();
    if (!org?.magicLinksEnabled) {
      reply.code(403);
      return { data: null, error: 'Magic links are disabled for this organization' };
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!user || !user.active) {
      reply.code(404);
      return { data: null, error: 'User not found or inactive' };
    }

    // Deactivate any existing active magic links for this user
    await prisma.magicLink.updateMany({
      where: { userId: body.userId, active: true },
      data: { active: false },
    });

    // Generate token
    const token = randomUUID() + '-' + randomUUID();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 86400000)
      : null;

    await prisma.magicLink.create({
      data: {
        userId: body.userId,
        tokenHash,
        expiresAt,
        active: true,
      },
    });

    reply.code(201);
    return {
      data: {
        token,
        userId: body.userId,
        userName: `${user.firstName} ${user.lastName}`,
        expiresAt,
      },
      error: null,
    };
  });

  /**
   * POST /api/v1/warehouse/auth/magic-link/validate
   * Validate a magic link token and return a JWT session.
   */
  server.post('/api/v1/warehouse/auth/magic-link/validate', {
    schema: {
      tags: ['Warehouse'],
      summary: 'Validate magic link and login',
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const magicLink = await prisma.magicLink.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            roles: { include: { role: true } },
          },
        },
      },
    });

    if (!magicLink || !magicLink.active) {
      // Log failed attempt
      await prisma.loginAuditLog.create({
        data: {
          userId: magicLink?.userId || 'unknown',
          method: 'magic_link',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || null,
          success: false,
          failReason: !magicLink ? 'invalid_token' : 'inactive_link',
        },
      });
      reply.code(401);
      return { data: null, error: 'Invalid or expired magic link' };
    }

    if (magicLink.expiresAt && magicLink.expiresAt < new Date()) {
      await prisma.magicLink.update({
        where: { id: magicLink.id },
        data: { active: false },
      });
      await prisma.loginAuditLog.create({
        data: {
          userId: magicLink.userId,
          method: 'magic_link',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || null,
          success: false,
          failReason: 'expired_link',
        },
      });
      reply.code(401);
      return { data: null, error: 'Magic link has expired' };
    }

    if (!magicLink.user.active) {
      reply.code(401);
      return { data: null, error: 'User account is inactive' };
    }

    // Magic link is valid — do NOT deactivate (reusable QR codes)
    // Update last login
    await prisma.user.update({
      where: { id: magicLink.userId },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0 },
    });

    // Log successful login
    await prisma.loginAuditLog.create({
      data: {
        userId: magicLink.userId,
        method: 'magic_link',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || null,
        success: true,
      },
    });

    // Build JWT-compatible user data (frontend will store this)
    const roles = magicLink.user.roles.map(r => r.role.name);
    const permissions = magicLink.user.roles.flatMap(r => {
      const perms = r.role.permissions;
      return Array.isArray(perms) ? perms as string[] : [];
    });

    return {
      data: {
        user: {
          id: magicLink.user.id,
          email: magicLink.user.email,
          firstName: magicLink.user.firstName,
          lastName: magicLink.user.lastName,
          roles,
          permissions,
          organizationId: magicLink.user.organizationId,
          preferredLocationId: magicLink.user.preferredLocationId,
        },
      },
      error: null,
    };
  });

  /**
   * POST /api/v1/warehouse/auth/login
   * Standard password login for warehouse app (also logs audit).
   */
  server.post('/api/v1/warehouse/auth/login', {
    schema: {
      tags: ['Warehouse'],
      summary: 'Password login for warehouse app',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });

    if (!user || !user.active) {
      await logLoginAttempt(prisma, user?.id, 'password', req, false, 'user_not_found');
      reply.code(401);
      return { data: null, error: 'Invalid credentials' };
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await logLoginAttempt(prisma, user.id, 'password', req, false, 'locked');
      reply.code(423);
      return { data: null, error: 'Account is locked. Try again later.' };
    }

    // Verify password (using same bcrypt approach as auth-service)
    if (!user.passwordHash) {
      await logLoginAttempt(prisma, user.id, 'password', req, false, 'no_password_set');
      reply.code(401);
      return { data: null, error: 'Invalid credentials' };
    }

    // Dynamic import bcrypt — may be bcrypt or bcryptjs depending on install
    let bcrypt: { compare: (data: string, hash: string) => Promise<boolean> };
    try {
      // @ts-expect-error Dynamic import of optional dependency
      bcrypt = await import('bcrypt');
    } catch {
      // @ts-expect-error Dynamic import of optional dependency
      bcrypt = await import('bcryptjs');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const lockData: any = { failedLoginAttempts: attempts };
      if (attempts >= 5) {
        lockData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lockout
      }
      await prisma.user.update({ where: { id: user.id }, data: lockData });
      await logLoginAttempt(prisma, user.id, 'password', req, false, 'invalid_password');
      reply.code(401);
      return { data: null, error: 'Invalid credentials' };
    }

    // Success
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });
    await logLoginAttempt(prisma, user.id, 'password', req, true);

    const roles = user.roles.map(r => r.role.name);
    const permissions = user.roles.flatMap(r => {
      const perms = r.role.permissions;
      return Array.isArray(perms) ? perms as string[] : [];
    });

    return {
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roles,
          permissions,
          organizationId: user.organizationId,
          preferredLocationId: user.preferredLocationId,
        },
      },
      error: null,
    };
  });

  // ─── User Preferences ────────────────────────────────────────────────────────

  /**
   * PUT /api/v1/warehouse/users/:id/preferences
   * Update warehouse preferences (e.g., preferred location).
   */
  server.put('/api/v1/warehouse/users/:id/preferences', {
    schema: {
      tags: ['Warehouse'],
      summary: 'Update user warehouse preferences',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      preferredLocationId: z.string().uuid().nullable().optional(),
    }).parse(req.body);

    const user = await prisma.user.update({
      where: { id },
      data: { preferredLocationId: body.preferredLocationId },
      select: { id: true, preferredLocationId: true },
    });

    return { data: user, error: null };
  });

  // ─── Shipment List (Today's Work) ─────────────────────────────────────────

  /**
   * GET /api/v1/warehouse/shipments
   * List shipments for today's warehouse operations.
   * Shows draft/ready shipments that haven't been launched, filtered by origin.
   */
  server.get('/api/v1/warehouse/shipments', {
    schema: {
      tags: ['Warehouse'],
      summary: 'List shipments for warehouse operations',
      querystring: {
        type: 'object',
        properties: {
          locationId: { type: 'string', description: 'Filter by origin location' },
          status: { type: 'string', description: 'Filter by status (draft, ready, launched)' },
          search: { type: 'string', description: 'Search by reference or ID' },
          includeArchive: { type: 'string', description: 'Include old shipments (>2 days)' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as {
      locationId?: string;
      status?: string;
      search?: string;
      includeArchive?: string;
    };

    const twoDaysAgo = new Date(Date.now() - 2 * 86400000);

    const where: any = {
      archived: false,
      // Only show draft/ready shipments (not in_transit/delivered)
      status: { in: ['draft', 'ready', 'picked'] },
    };

    // Filter by origin location
    if (query.locationId) {
      where.originId = query.locationId;
    }

    // Status filter
    if (query.status === 'launched') {
      where.launchedAt = { not: null };
      delete where.status; // Show launched regardless of status
    } else if (query.status === 'flagged') {
      where.flags = { some: { resolved: false } };
    }

    // Exclude old shipments unless archive requested
    if (query.includeArchive !== 'true') {
      where.OR = [
        { launchedAt: null, createdAt: { gte: twoDaysAgo } },
        { launchedAt: { not: null } },
      ];
    }

    // Search
    if (query.search) {
      const searchFilter = {
        OR: [
          { reference: { contains: query.search, mode: 'insensitive' as const } },
          { id: { contains: query.search, mode: 'insensitive' as const } },
          { proNumber: { contains: query.search, mode: 'insensitive' as const } },
        ],
      };
      where.AND = [searchFilter];
    }

    const shipments = await prisma.shipment.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        origin: { select: { id: true, name: true, city: true, state: true } },
        destination: { select: { id: true, name: true, city: true, state: true } },
        carrier: { select: { id: true, name: true } },
        loads: {
          include: {
            vehicle: { select: { id: true, plate: true, type: true } },
            driver: { select: { id: true, name: true, phone: true } },
          },
        },
        orderShipments: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                deliveryStatus: true,
                trackableUnits: {
                  select: {
                    id: true,
                    identifier: true,
                    unitType: true,
                    barcode: true,
                    condition: true,
                  },
                  orderBy: { sequenceNumber: 'asc' },
                },
              },
            },
          },
        },
        deviceAssignments: {
          where: { active: true },
          include: {
            device: { select: { id: true, name: true, displayId: true, externalId: true, status: true, batteryLevel: true } },
          },
        },
        accessories: true,
        flags: { where: { resolved: false } },
        stops: {
          include: {
            location: { select: { id: true, name: true, city: true, state: true } },
          },
          orderBy: { sequenceNumber: 'asc' },
        },
      },
      orderBy: [
        { pickupDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return { data: shipments, error: null };
  });

  // ─── Shipment Detail ──────────────────────────────────────────────────────

  /**
   * GET /api/v1/warehouse/shipments/:id
   * Full shipment detail for warehouse view.
   */
  server.get('/api/v1/warehouse/shipments/:id', {
    schema: {
      tags: ['Warehouse'],
      summary: 'Get shipment detail for warehouse',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const shipment = await prisma.shipment.findFirst({
      where: { id, archived: false },
      include: {
        customer: true,
        origin: true,
        destination: true,
        carrier: true,
        loads: {
          include: {
            vehicle: true,
            driver: true,
          },
        },
        orderShipments: {
          include: {
            order: {
              include: {
                trackableUnits: {
                  include: { lineItems: true },
                  orderBy: { sequenceNumber: 'asc' },
                },
                lineItems: true,
              },
            },
          },
        },
        deviceAssignments: {
          where: { active: true },
          include: {
            device: true,
          },
        },
        accessories: true,
        flags: { orderBy: { createdAt: 'desc' } },
        stops: {
          include: { location: true },
          orderBy: { sequenceNumber: 'asc' },
        },
      },
    });

    if (!shipment) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }

    return { data: shipment, error: null };
  });

  // ─── Flag a Shipment ──────────────────────────────────────────────────────

  /**
   * POST /api/v1/warehouse/shipments/:id/flag
   * Flag an issue with a shipment.
   */
  server.post('/api/v1/warehouse/shipments/:id/flag', {
    schema: {
      tags: ['Warehouse'],
      summary: 'Flag a shipment issue',
      body: {
        type: 'object',
        required: ['reason', 'flaggedBy', 'flaggedByName'],
        properties: {
          reason: { type: 'string' },
          flaggedBy: { type: 'string' },
          flaggedByName: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      reason: z.string().min(1),
      flaggedBy: z.string(),
      flaggedByName: z.string(),
    }).parse(req.body);

    const shipment = await prisma.shipment.findFirst({ where: { id, archived: false } });
    if (!shipment) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }

    const flag = await prisma.shipmentFlag.create({
      data: {
        shipmentId: id,
        flaggedBy: body.flaggedBy,
        flaggedByName: body.flaggedByName,
        reason: body.reason,
      },
    });

    reply.code(201);
    return { data: flag, error: null };
  });

  /**
   * PUT /api/v1/warehouse/shipments/:shipmentId/flags/:flagId/resolve
   * Resolve a flag on a shipment.
   */
  server.put('/api/v1/warehouse/shipments/:shipmentId/flags/:flagId/resolve', {
    schema: {
      tags: ['Warehouse'],
      summary: 'Resolve a shipment flag',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { flagId } = req.params as { shipmentId: string; flagId: string };
    const body = z.object({
      resolvedBy: z.string(),
    }).parse(req.body);

    const flag = await prisma.shipmentFlag.update({
      where: { id: flagId },
      data: { resolved: true, resolvedBy: body.resolvedBy, resolvedAt: new Date() },
    });

    return { data: flag, error: null };
  });

  // ─── Device Assignment (Tracker Scanning) ─────────────────────────────────

  /**
   * GET /api/v1/warehouse/devices/lookup
   * Look up a device by scanned barcode (externalId, displayId, or name).
   */
  server.get('/api/v1/warehouse/devices/lookup', {
    schema: {
      tags: ['Warehouse'],
      summary: 'Look up device by barcode scan',
      querystring: {
        type: 'object',
        required: ['barcode'],
        properties: {
          barcode: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { barcode } = req.query as { barcode: string };

    const device = await prisma.device.findFirst({
      where: {
        OR: [
          { externalId: barcode },
          { displayId: barcode },
          { name: barcode },
        ],
        status: 'active',
      },
      include: {
        assignments: {
          where: { active: true },
          include: {
            shipment: { select: { id: true, reference: true } },
          },
        },
      },
    });

    if (!device) {
      reply.code(404);
      return { data: null, error: 'Device not found. Check the barcode and try again.' };
    }

    // Warn if already assigned
    const activeAssignment = device.assignments[0];
    return {
      data: {
        ...device,
        alreadyAssigned: !!activeAssignment,
        currentShipmentRef: activeAssignment?.shipment?.reference || null,
      },
      error: null,
    };
  });

  /**
   * POST /api/v1/warehouse/shipments/:id/assign-device
   * Assign an IoT device to a shipment (scanned in warehouse).
   */
  server.post('/api/v1/warehouse/shipments/:id/assign-device', {
    schema: {
      tags: ['Warehouse'],
      summary: 'Assign IoT device to shipment',
      body: {
        type: 'object',
        required: ['deviceId'],
        properties: {
          deviceId: { type: 'string' },
          trackableUnitId: { type: 'string', description: 'Optional: assign to specific pallet/tote' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      deviceId: z.string(),
      trackableUnitId: z.string().optional(),
    }).parse(req.body);

    // Deactivate existing assignments for this device
    await prisma.deviceAssignment.updateMany({
      where: { deviceId: body.deviceId, active: true },
      data: { active: false, unassignedAt: new Date() },
    });

    const assignment = await prisma.deviceAssignment.create({
      data: {
        deviceId: body.deviceId,
        shipmentId: id,
        trackableUnitId: body.trackableUnitId || null,
      },
    });

    reply.code(201);
    return { data: assignment, error: null };
  });

  /**
   * DELETE /api/v1/warehouse/shipments/:id/devices/:deviceId
   * Remove a device assignment from a shipment.
   */
  server.delete('/api/v1/warehouse/shipments/:id/devices/:deviceId', {
    schema: {
      tags: ['Warehouse'],
      summary: 'Remove device from shipment',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id, deviceId } = req.params as { id: string; deviceId: string };

    await prisma.deviceAssignment.updateMany({
      where: { deviceId, shipmentId: id, active: true },
      data: { active: false, unassignedAt: new Date() },
    });

    return { data: { removed: true }, error: null };
  });

  // ─── Accessories (Door Seals, BLE Sensors) ────────────────────────────────

  /**
   * POST /api/v1/warehouse/shipments/:id/accessories
   * Add an accessory (door seal, temp sensor, etc.) to a shipment.
   */
  server.post('/api/v1/warehouse/shipments/:id/accessories', {
    schema: {
      tags: ['Warehouse'],
      summary: 'Add accessory to shipment',
      body: {
        type: 'object',
        required: ['accessoryType'],
        properties: {
          accessoryType: { type: 'string', enum: ['door_seal', 'temp_sensor_front', 'temp_sensor_middle', 'temp_sensor_back', 'door_sensor', 'ble_tracker'] },
          alias: { type: 'string' },
          identifier: { type: 'string' },
          isIoT: { type: 'boolean' },
          deviceId: { type: 'string' },
          notes: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      accessoryType: z.string(),
      alias: z.string().optional(),
      identifier: z.string().optional(),
      isIoT: z.boolean().default(false),
      deviceId: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    const accessory = await prisma.shipmentAccessory.create({
      data: {
        shipmentId: id,
        ...body,
      },
    });

    reply.code(201);
    return { data: accessory, error: null };
  });

  /**
   * DELETE /api/v1/warehouse/shipments/:id/accessories/:accessoryId
   * Remove an accessory from a shipment.
   */
  server.delete('/api/v1/warehouse/shipments/:id/accessories/:accessoryId', {
    schema: {
      tags: ['Warehouse'],
      summary: 'Remove accessory from shipment',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { accessoryId } = req.params as { id: string; accessoryId: string };

    await prisma.shipmentAccessory.delete({ where: { id: accessoryId } });
    return { data: { removed: true }, error: null };
  });

  // ─── Launch Shipment ──────────────────────────────────────────────────────

  /**
   * POST /api/v1/warehouse/shipments/:id/launch
   * Mark a shipment as launched (ready to go). Sets launchedAt and status to 'ready'.
   */
  server.post('/api/v1/warehouse/shipments/:id/launch', {
    schema: {
      tags: ['Warehouse'],
      summary: 'Launch shipment from warehouse',
      body: {
        type: 'object',
        required: ['launchedBy'],
        properties: {
          launchedBy: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { launchedBy } = z.object({
      launchedBy: z.string(),
    }).parse(req.body);

    const shipment = await prisma.shipment.findFirst({ where: { id, archived: false } });
    if (!shipment) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }

    // Check for unresolved flags
    const unresolvedFlags = await prisma.shipmentFlag.count({
      where: { shipmentId: id, resolved: false },
    });
    if (unresolvedFlags > 0) {
      reply.code(400);
      return { data: null, error: `Cannot launch: ${unresolvedFlags} unresolved flag(s)` };
    }

    const updated = await prisma.shipment.update({
      where: { id },
      data: {
        launchedAt: new Date(),
        launchedBy,
        status: shipment.status === 'draft' ? 'ready' : shipment.status,
      },
    });

    return { data: updated, error: null };
  });

  // ─── Create Basic Shipment (Admin only) ───────────────────────────────────

  /**
   * POST /api/v1/warehouse/shipments
   * Create a basic shipment from the warehouse app (admin users only).
   */
  server.post('/api/v1/warehouse/shipments', {
    schema: {
      tags: ['Warehouse'],
      summary: 'Create basic shipment (admin)',
      body: {
        type: 'object',
        required: ['reference', 'customerId', 'originId', 'destinationId'],
        properties: {
          reference: { type: 'string' },
          customerId: { type: 'string' },
          originId: { type: 'string' },
          destinationId: { type: 'string' },
          pickupDate: { type: 'string' },
          deliveryDate: { type: 'string' },
          carrierId: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      reference: z.string().min(1),
      customerId: z.string().uuid(),
      originId: z.string().uuid(),
      destinationId: z.string().uuid(),
      pickupDate: z.string().optional(),
      deliveryDate: z.string().optional(),
      carrierId: z.string().uuid().optional(),
    }).parse(req.body);

    const shipment = await prisma.shipment.create({
      data: {
        reference: body.reference,
        customerId: body.customerId,
        originId: body.originId,
        destinationId: body.destinationId,
        pickupDate: body.pickupDate ? new Date(body.pickupDate) : null,
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
        carrierId: body.carrierId || null,
        status: 'draft',
      },
      include: {
        customer: { select: { name: true } },
        origin: { select: { name: true, city: true, state: true } },
        destination: { select: { name: true, city: true, state: true } },
      },
    });

    reply.code(201);
    return { data: shipment, error: null };
  });

  // ─── Trackable Unit Lookup ────────────────────────────────────────────────

  /**
   * GET /api/v1/warehouse/trackable-units/lookup
   * Look up a trackable unit by barcode scan.
   */
  server.get('/api/v1/warehouse/trackable-units/lookup', {
    schema: {
      tags: ['Warehouse'],
      summary: 'Look up trackable unit by barcode',
      querystring: {
        type: 'object',
        required: ['barcode'],
        properties: {
          barcode: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { barcode } = req.query as { barcode: string };

    const unit = await prisma.trackableUnit.findFirst({
      where: {
        OR: [
          { barcode },
          { identifier: barcode },
        ],
      },
      include: {
        order: { select: { id: true, orderNumber: true } },
        lineItems: true,
      },
    });

    if (!unit) {
      reply.code(404);
      return { data: null, error: 'Trackable unit not found' };
    }

    return { data: unit, error: null };
  });

  // ─── Locations ────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/warehouse/locations
   * List origin locations for warehouse selection.
   */
  server.get('/api/v1/warehouse/locations', {
    schema: {
      tags: ['Warehouse'],
      summary: 'List locations for warehouse selection',
    },
  }, async (_req: FastifyRequest, _reply: FastifyReply) => {
    const locations = await prisma.location.findMany({
      where: { archived: false },
      select: { id: true, name: true, city: true, state: true, country: true },
      orderBy: { name: 'asc' },
    });

    return { data: locations, error: null };
  });

  // ─── Organization Settings ────────────────────────────────────────────────

  /**
   * GET /api/v1/warehouse/settings
   * Get warehouse-relevant organization settings.
   */
  server.get('/api/v1/warehouse/settings', {
    schema: {
      tags: ['Warehouse'],
      summary: 'Get warehouse app settings',
    },
  }, async (_req: FastifyRequest, _reply: FastifyReply) => {
    const org = await prisma.organization.findFirst({
      select: {
        magicLinksEnabled: true,
        warehouseScanMode: true,
        trackableUnitType: true,
        customUnitName: true,
        trackingMode: true,
      },
    });

    return { data: org, error: null };
  });

  /**
   * PUT /api/v1/warehouse/settings
   * Update warehouse settings (admin).
   */
  server.put('/api/v1/warehouse/settings', {
    schema: {
      tags: ['Warehouse'],
      summary: 'Update warehouse settings (admin)',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      magicLinksEnabled: z.boolean().optional(),
      warehouseScanMode: z.enum(['hid', 'camera']).optional(),
    }).parse(req.body);

    const org = await prisma.organization.findFirst();
    if (!org) {
      reply.code(404);
      return { data: null, error: 'Organization not found' };
    }

    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: body,
    });

    return { data: updated, error: null };
  });

  // ─── Connectivity Logging ─────────────────────────────────────────────────

  /**
   * POST /api/v1/warehouse/connectivity
   * Log a WiFi connectivity event.
   */
  server.post('/api/v1/warehouse/connectivity', {
    schema: {
      tags: ['Warehouse'],
      summary: 'Log WiFi connectivity event',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      userId: z.string().optional(),
      deviceInfo: z.string().optional(),
      eventType: z.enum(['wifi_lost', 'wifi_restored', 'slow_connection']),
      locationId: z.string().optional(),
      duration: z.number().int().optional(),
      metadata: z.record(z.any()).optional(),
    }).parse(req.body);

    const log = await prisma.connectivityLog.create({ data: body });
    reply.code(201);
    return { data: log, error: null };
  });

  // ─── Login Audit Log ──────────────────────────────────────────────────────

  /**
   * GET /api/v1/warehouse/audit/logins
   * Get login audit log (admin).
   */
  server.get('/api/v1/warehouse/audit/logins', {
    schema: {
      tags: ['Warehouse'],
      summary: 'Get login audit log (admin)',
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          method: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const query = req.query as { userId?: string; method?: string; limit?: string };
    const limit = Math.min(parseInt(query.limit || '100'), 500);

    const where: any = {};
    if (query.userId) where.userId = query.userId;
    if (query.method) where.method = query.method;

    const logs = await prisma.loginAuditLog.findMany({
      where,
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return { data: logs, error: null };
  });

  // ─── Magic Link Management ────────────────────────────────────────────────

  /**
   * DELETE /api/v1/warehouse/auth/magic-link/:userId
   * Revoke all magic links for a user (admin).
   */
  server.delete('/api/v1/warehouse/auth/magic-link/:userId', {
    schema: {
      tags: ['Warehouse'],
      summary: 'Revoke all magic links for user',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req.params as { userId: string };

    await prisma.magicLink.updateMany({
      where: { userId, active: true },
      data: { active: false },
    });

    return { data: { revoked: true }, error: null };
  });

  // ─── Archive Shipments ────────────────────────────────────────────────────

  /**
   * GET /api/v1/warehouse/shipments/archive
   * List old/stale shipments (>2 days in draft/loading state).
   */
  server.get('/api/v1/warehouse/shipments/archive', {
    schema: {
      tags: ['Warehouse'],
      summary: 'List archived/stale warehouse shipments',
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const query = req.query as { locationId?: string };
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000);

    const where: any = {
      archived: false,
      status: { in: ['draft', 'ready', 'picked'] },
      launchedAt: null,
      createdAt: { lt: twoDaysAgo },
    };

    if (query.locationId) {
      where.originId = query.locationId;
    }

    const shipments = await prisma.shipment.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        origin: { select: { id: true, name: true, city: true } },
        destination: { select: { id: true, name: true, city: true } },
        flags: { where: { resolved: false } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return { data: shipments, error: null };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function logLoginAttempt(
  prisma: any,
  userId: string | undefined,
  method: string,
  req: FastifyRequest,
  success: boolean,
  failReason?: string,
) {
  if (!userId) return;
  try {
    await prisma.loginAuditLog.create({
      data: {
        userId,
        method,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || null,
        success,
        failReason: failReason || null,
      },
    });
  } catch {
    // Don't fail the login for audit log issues
  }
}
