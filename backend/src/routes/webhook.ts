import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authenticateApiKey, checkRateLimit, redactApiKey } from '../middleware/apiKeyAuth.js';

export async function webhookRoutes(server: FastifyInstance) {
  // Webhook endpoint
  server.post('/api/v1/webhook', async (req: FastifyRequest, reply: FastifyReply) => {
    // Rate limiting check
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(ip)) {
      reply.code(429);
      return {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: '60 seconds'
      };
    }
    const timestamp = new Date();
    let webhookLogId: string | null = null;
    let apiKeyId: string | null = null;

    try {
      // Authenticate API key
      const authResult = await authenticateApiKey(server, req, reply);
      if (authResult.error) {
        // Create log entry for failed auth
        const logEntry = await server.prisma.webhookLog.create({
          data: {
            apiKeyId: null,
            method: req.method,
            path: req.url,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || undefined,
            headers: redactApiKey(req.headers),
            status: 'error',
            shipmentFound: false,
            shipmentUpdated: false,
            errorMessage: authResult.error,
            responseCode: reply.statusCode,
            rawPayload: (req.body as any) || {},
            receivedAt: timestamp,
            processedAt: new Date()
          }
        });

        return {
          error: authResult.error,
          timestamp: timestamp.toISOString()
        };
      }
      apiKeyId = authResult.apiKeyId!;

      // Validate request body
      if (!req.body || Object.keys(req.body as any).length === 0) {
        const logEntry = await server.prisma.webhookLog.create({
          data: {
            apiKeyId,
            method: req.method,
            path: req.url,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || undefined,
            headers: redactApiKey(req.headers),
            status: 'error',
            shipmentFound: false,
            shipmentUpdated: false,
            errorMessage: 'Request body is required',
            responseCode: 400,
            rawPayload: {},
            receivedAt: timestamp,
            processedAt: new Date()
          }
        });

        reply.code(400);
        return {
          error: 'Request body is required.',
          received: 'Empty or missing body'
        };
      }

      // Extract data from webhook payload
      const body = req.body as any;
      const event = body.event || body;

      if (!event || !event.device || !event.device.name) {
        const logEntry = await server.prisma.webhookLog.create({
          data: {
            apiKeyId,
            method: req.method,
            path: req.url,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || undefined,
            headers: redactApiKey(req.headers),
            deviceName: event?.device?.name,
            status: 'error',
            shipmentFound: false,
            shipmentUpdated: false,
            errorMessage: 'Invalid webhook payload. Missing device.name',
            responseCode: 400,
            rawPayload: body,
            receivedAt: timestamp,
            processedAt: new Date()
          }
        });

        reply.code(400);
        return {
          error: 'Invalid webhook payload. Missing device.name',
          received: body
        };
      }

      const deviceName = event.device.name;
      const deviceId = event.device.id;
      const eventType = event.type || 'location';
      const eventTime = event.startTime || event.latestTime || new Date().toISOString();

      // Extract location data
      const location = event.location;
      const lat = location?.global?.lat;
      const lng = location?.global?.lon;
      const address = location?.global?.address;
      const locationSummary = location?.summary;
      const hasLocation = !!(lat && lng);

      // Create initial log entry
      const logEntry = await server.prisma.webhookLog.create({
        data: {
          apiKeyId: apiKeyId ?? null,
          method: req.method,
          path: req.url ?? null,
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
          headers: redactApiKey(req.headers) as any,
          deviceName: deviceName ?? null,
          deviceId: deviceId ?? null,
          eventType: eventType ?? null,
          hasLocation,
          lat: lat ?? null,
          lng: lng ?? null,
          rawPayload: body as any,
          receivedAt: timestamp,
          status: 'pending',
          shipmentFound: false,
          shipmentUpdated: false
        } as any
      });
      webhookLogId = logEntry.id;

      // Skip events that don't have location data
      if (!hasLocation) {
        const responseBody = {
          success: true,
          message: 'Event received but skipped - no location data',
          timestamp: timestamp.toISOString(),
          data: {
            deviceName,
            eventType
          }
        };

        await server.prisma.webhookLog.update({
          where: { id: webhookLogId },
          data: {
            status: 'skipped',
            shipmentFound: false,
            shipmentUpdated: false,
            responseCode: 200,
            responseBody,
            processedAt: new Date()
          }
        });

        return responseBody;
      }

      // Find shipment by reference (device name matches shipment reference)
      const shipment = await server.prisma.shipment.findFirst({
        where: {
          reference: deviceName,
          archived: false
        }
      });

      if (!shipment) {
        const responseBody = {
          error: 'Shipment not found',
          deviceName,
          message: `No active shipment found with reference: ${deviceName}`
        };

        await server.prisma.webhookLog.update({
          where: { id: webhookLogId },
          data: {
            status: 'not_found',
            shipmentFound: false,
            shipmentUpdated: false,
            responseCode: 404,
            responseBody,
            processedAt: new Date()
          }
        });

        reply.code(404);
        return responseBody;
      }

      // Create shipment event
      const shipmentEvent = await server.prisma.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          eventType,
          deviceId,
          deviceName,
          lat: lat!,
          lng: lng!,
          address,
          locationSummary,
          rawPayload: body,
          eventTime: new Date(eventTime)
        }
      });

      const responseBody = {
        success: true,
        message: 'Webhook processed and shipment event created',
        timestamp: timestamp.toISOString(),
        data: {
          eventId: shipmentEvent.id,
          shipmentId: shipment.id,
          shipmentReference: shipment.reference,
          eventType,
          location: { lat, lng, address }
        }
      };

      // Update log with success
      await server.prisma.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          status: 'success',
          shipmentFound: true,
          shipmentUpdated: true,
          shipmentId: shipment.id,
          shipmentReference: shipment.reference,
          shipmentEventId: shipmentEvent.id,
          responseCode: 200,
          responseBody,
          processedAt: new Date()
        }
      });

      return responseBody;

    } catch (error: any) {
      console.error('Error processing webhook:', error);

      const errorResponse = {
        error: 'Internal server error while processing webhook',
        message: error.message,
        timestamp: timestamp.toISOString()
      };

      // Update log if we have one
      if (webhookLogId) {
        await server.prisma.webhookLog.update({
          where: { id: webhookLogId },
          data: {
            status: 'error',
            errorMessage: error.message,
            responseCode: 500,
            responseBody: errorResponse,
            processedAt: new Date()
          }
        });
      } else {
        // Create log entry for unhandled errors
        await server.prisma.webhookLog.create({
          data: {
            apiKeyId,
            method: req.method,
            path: req.url,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || undefined,
            headers: redactApiKey(req.headers),
            status: 'error',
            shipmentFound: false,
            shipmentUpdated: false,
            errorMessage: error.message,
            responseCode: 500,
            responseBody: errorResponse,
            rawPayload: (req.body as any) || {},
            receivedAt: timestamp,
            processedAt: new Date()
          }
        });
      }

      reply.code(500);
      return errorResponse;
    }
  });
}
