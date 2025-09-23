const functions = require('@google-cloud/functions-framework');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

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
    authenticateApiKey(req, res, (authErr) => {
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

        // TODO: In future iterations, this is where we would:
        // 1. Validate the webhook payload structure
        // 2. Extract shipment reference and location data
        // 3. Connect to the database and update shipment locations
        // 4. Handle any business logic for location updates

        // For now, just return success with the logged data
        res.status(200).json({
          success: true,
          message: 'Webhook received and logged successfully',
          timestamp,
          dataReceived: {
            bodyKeys: Object.keys(req.body),
            bodySize: JSON.stringify(req.body).length
          },
          note: 'This is a placeholder implementation. Shipment updates will be implemented in future versions.'
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