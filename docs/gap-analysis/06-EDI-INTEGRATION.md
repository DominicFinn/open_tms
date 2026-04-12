# EDI & Integration

## What's Built

### EDI Transaction Types
| Code | Name | Direction | Status |
|------|------|-----------|--------|
| 850 | Purchase Order | Inbound | Active |
| 856 | Advance Ship Notice | Outbound | Active |
| 204 | Motor Carrier Load Tender | Outbound | Active |
| 990 | Response to Load Tender | Inbound | Active |
| 997 | Functional Acknowledgment | Both | Active |
| 214 | Shipment Status | Both | Active |
| 210 | Freight Invoice | Inbound | Active |
| 810 | Invoice | Outbound | Active |
| 820 | Payment Order/Remittance | Inbound | Active |

### Infrastructure
- EdiRouterService: detect transaction type from ST segment, route to parser
- OutboundEdiDeliveryService: deliver EDI via SFTP or HTTP
- edi-collector service: SFTP polling with multi-type routing
- Unified TradingPartner model (replaces separate EdiPartner + OutboundIntegration)
- TradingPartnerTransaction registry per partner
- EdiTransactionLog: full audit log of every EDI exchange
- EDI 997 auto-generation on inbound transactions

### Integration Infrastructure
- pg-boss queue engine (PostgreSQL-backed)
- IQueueAdapter interface for cloud alternatives (SQS, Pub/Sub, Service Bus)
- Outbound carrier worker (EDI 856 + JSON adapters)
- Outbound tracking worker
- Inbound webhook worker (async with 202 Accepted)
- Retry with exponential backoff (3 attempts)
- OutboundIntegration model with URL, auth, carrier match pattern
- Full request/response audit trail
- REST API with Swagger/OpenAPI docs
- Customer API with API key auth
- Webhook event ingestion endpoint

## What's Partially Built

- **AS2 transport**: Not implemented. Only SFTP and HTTP currently.
- **997 receipt tracking**: Auto-generate outbound 997 works, but tracking whether our outbound 204/810 received a 997 back is not implemented.

## What's Planned (On Roadmap)

| Feature | Roadmap Phase | Notes |
|---------|--------------|-------|
| SAP iDoc mapping templates | Phase 8b | Not started |
| Configurable field mapping UI | Phase 8b | Not started |
| Flat file (CSV/fixed-width) adapter for legacy ERP | Phase 8b | Not started |
| REST/SOAP API adapter for modern ERP | Phase 8b | Not started |

## What's Missing

| Feature | Commercial Standard | Impact |
|---------|-------------------|--------|
| **ERP pre-built connectors** | SAP, Oracle, NetSuite, Dynamics 365 out-of-the-box integrations | High - enterprise requirement |
| **WMS integration** | Order release triggers, ASN exchange, receiving confirmation | High - warehouse-TMS link |
| **Carrier API integrations** | Direct API tendering + tracking with major carriers (FedEx, UPS, XPO, etc.) | High - modern alternative to EDI |
| **Webhook subscriptions** | Allow external systems to subscribe to events by type (shipment.delivered, etc.) | Medium - extensibility |
| **Parcel carrier integration** | UPS/FedEx/USPS rating, label generation, tracking API | High - parcel volume |
| **EDIFACT support** | International EDI standard (common in Europe, ocean, air) | Medium - international trade |
| **AS2 transport** | Applicability Statement 2 with MDN receipts, encryption | Medium - enterprise EDI |
| **VAN connectivity** | Value Added Network relay for partners who don't do direct EDI | Low - declining but still used |
| **GraphQL API** | Alternative to REST for flexible client queries | Low - emerging preference |
| **OAuth2 for API auth** | In addition to API keys, support OAuth2 client credentials flow | Medium - enterprise security |
