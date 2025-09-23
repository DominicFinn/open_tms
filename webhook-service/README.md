# Open TMS Webhook Service

A Google Cloud Function that handles webhook requests for shipment location updates in the Open TMS system.

## Features

- ✅ Rate limiting (100 requests per minute)
- ✅ API key authentication
- ✅ Request logging
- ✅ Google Cloud Function deployment ready
- 🚧 Database integration (planned)
- 🚧 Shipment location updates (planned)

## Setup

### Prerequisites

- Node.js 20+
- Google Cloud CLI (`gcloud`)
- Google Cloud Project with Functions API enabled

### Local Development

1. Install dependencies:
```bash
cd webhook-service
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your API key
```

3. Run locally:
```bash
npm run dev
```

The function will be available at `http://localhost:8080`

### Testing Locally

```bash
curl -X POST 'http://localhost:8080' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: tms_webhook_dev_key_2024_change_in_production' \
  -d '{"test": "data", "shipment_id": "SH-001", "lat": 33.4484, "lng": -112.0740}'
```

## Deployment

### Quick Deploy

```bash
./deploy.sh
```

### Manual Deploy

```bash
gcloud functions deploy open-tms-webhook \
  --runtime=nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --source=. \
  --entry-point=webhook \
  --set-env-vars="WEBHOOK_API_KEY=your_api_key_here"
```

## API Documentation

### Webhook Endpoint

**POST** `/webhook`

#### Headers
- `Content-Type: application/json`
- `x-api-key: YOUR_API_KEY` (required)

#### Request Body
```json
{
  "shipment_id": "SH-001",
  "lat": 33.4484,
  "lng": -112.0740,
  "timestamp": "2024-01-01T12:00:00Z",
  "additional_data": "any other fields"
}
```

#### Response
```json
{
  "success": true,
  "message": "Webhook received and logged successfully",
  "timestamp": "2024-01-01T12:00:00Z",
  "dataReceived": {
    "bodyKeys": ["shipment_id", "lat", "lng", "timestamp"],
    "bodySize": 125
  }
}
```

#### Error Responses

**401 Unauthorized** - Missing API key
```json
{
  "error": "API key required. Please provide x-api-key header or Authorization Bearer token."
}
```

**403 Forbidden** - Invalid API key
```json
{
  "error": "Invalid API key."
}
```

**429 Too Many Requests** - Rate limit exceeded
```json
{
  "error": "Too many requests, please try again later.",
  "retryAfter": "60 seconds"
}
```

### Health Check Endpoint

**GET** `/health`

Returns service health status.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WEBHOOK_API_KEY` | API key for webhook authentication | Required |
| `NODE_ENV` | Environment (development/production) | development |

## Security

- Rate limiting: 100 requests per minute per IP
- API key authentication required
- Request/response logging (API keys are redacted)
- Input validation

## Future Enhancements

This is a placeholder implementation. Future versions will include:

1. **Database Integration**
   - Connect to Open TMS PostgreSQL database
   - Update shipment locations in real-time

2. **Enhanced Validation**
   - Webhook payload schema validation
   - Shipment ID verification
   - Coordinate validation

3. **Security Improvements**
   - Google Cloud Secret Manager integration
   - Webhook signature verification
   - Enhanced rate limiting per API key

4. **Monitoring**
   - Cloud Monitoring integration
   - Error alerting
   - Performance metrics

## GitHub Issue

Track the full implementation progress: [GitHub Issue #TBD - Implement webhook shipment location updates](https://github.com/your-repo/open_tms/issues/TBD)

## Logs and Monitoring

View function logs:
```bash
gcloud functions logs read open-tms-webhook --region=us-central1
```

Monitor function metrics:
```bash
gcloud functions describe open-tms-webhook --region=us-central1
```