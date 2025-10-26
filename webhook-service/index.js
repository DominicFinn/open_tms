const functions = require('@google-cloud/functions-framework');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

// Rate limiting middleware - 100 requests per minute
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: '60 seconds'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  validate: { trustProxy: false }, // Disable trust proxy validation for local dev
});

// API Key authentication middleware
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  const validApiKey = process.env.WEBHOOK_API_KEY;

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required. Please provide x-api-key header or Authorization Bearer token.'
    });
  }

  if (apiKey !== validApiKey) {
    return res.status(403).json({
      error: 'Invalid API key.'
    });
  }

  next();
};

// Main webhook handler
functions.http('webhook', (req, res) => {
  // Apply rate limiting
  limiter(req, res, (err) => {
    if (err) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: err.message
      });
    }

    // Apply API key authentication
    authenticateApiKey(req, res, async (authErr) => {
      if (authErr) {
        return; // Response already sent by middleware
      }

      // Only accept POST requests
      if (req.method !== 'POST') {
        return res.status(405).json({
          error: 'Method not allowed. Only POST requests are accepted.'
        });
      }

      try {
        // Log the request details
        const timestamp = new Date().toISOString();
        const logData = {
          timestamp,
          method: req.method,
          headers: {
            'content-type': req.headers['content-type'],
            'user-agent': req.headers['user-agent'],
            'x-forwarded-for': req.headers['x-forwarded-for'],
            'x-api-key': req.headers['x-api-key'] ? '[REDACTED]' : 'not provided'
          },
          body: req.body,
          query: req.query,
          ip: req.ip,
          path: req.path
        };

        console.log('Webhook request received:', JSON.stringify(logData, null, 2));

        // Validate that we have a request body
        if (!req.body || Object.keys(req.body).length === 0) {
          return res.status(400).json({
            error: 'Request body is required.',
            received: 'Empty or missing body'
          });
        }

        // Extract data from webhook payload
        // Handle both formats: { event: {...} } or direct event object
        const event = req.body.event || req.body;

        if (!event || !event.device || !event.device.name) {
          return res.status(400).json({
            error: 'Invalid webhook payload. Missing device.name',
            received: req.body
          });
        }

        const deviceName = event.device.name; // e.g., "SH-0001"
        const eventType = event.type || 'location';
        const eventTime = event.startTime || event.latestTime || new Date().toISOString();

        // Extract location data if available
        const location = event.location;
        const lat = location?.global?.lat;
        const lng = location?.global?.lon;
        const address = location?.global?.address;
        const locationSummary = location?.summary;

        // Skip events that don't have location data (like charging events)
        if (!lat || !lng) {
          console.log(`Skipping ${eventType} event for ${deviceName} - no location data`);
          return res.status(200).json({
            success: true,
            message: 'Event received but skipped - no location data',
            timestamp: new Date().toISOString(),
            data: {
              deviceName,
              eventType
            }
          });
        }

        // Find shipment by reference (device name matches shipment reference)
        const shipment = await prisma.shipment.findFirst({
          where: {
            reference: deviceName,
            archived: false
          }
        });

        if (!shipment) {
          console.warn(`Shipment not found for device name: ${deviceName}`);
          return res.status(404).json({
            error: 'Shipment not found',
            deviceName,
            message: `No active shipment found with reference: ${deviceName}`
          });
        }

        // Create shipment event
        const shipmentEvent = await prisma.shipmentEvent.create({
          data: {
            shipmentId: shipment.id,
            eventType,
            deviceId: event.device.id,
            deviceName,
            lat,
            lng,
            address,
            locationSummary,
            rawPayload: req.body,
            eventTime: new Date(eventTime)
          }
        });

        console.log('Shipment event created:', shipmentEvent.id);

        res.status(200).json({
          success: true,
          message: 'Webhook processed and shipment event created',
          timestamp,
          data: {
            eventId: shipmentEvent.id,
            shipmentId: shipment.id,
            shipmentReference: shipment.reference,
            eventType,
            location: lat && lng ? { lat, lng, address } : null
          }
        });

      } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({
          error: 'Internal server error while processing webhook',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  });
});

// Health check endpoint (for monitoring)
functions.http('health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'open-tms-webhook-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});
