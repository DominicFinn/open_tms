# Compliance & Documentation

## What's Built

- Document template management (BOL, label, customs, daily_report) with Handlebars
- PDF generation with prefilled shipment details
- Auto-generated BOL with sequential numbering
- S3-compatible binary storage (AWS S3, MinIO, Azure Blob S3-compat)
- Opaque UUID-based storage keys (security-first design)
- File attachments on any entity with drag-and-drop upload
- Default 10-year retention period
- Immutable temperature logging with SHA-256 integrity hashes (CFR 21 Part 11)
- Cold chain compliance report PDF auto-generated on shipment complete
- Device calibration tracking (certificate, expiry, accuracy)
- CAPA reports (investigation, root cause, corrective/preventive actions)
- Immutable DomainEventLog event store for all state changes
- Login audit log (method, IP, success/failure)

## What's Partially Built

- **Hazmat documentation**: Hazmat flag exists on orders and line items, but no shipping papers, placard generation, or emergency response info generation per 49 CFR
- **Audit trail UI**: Events are stored immutably but there's no searchable audit log viewer (on roadmap Phase 9a)

## What's Planned (On Roadmap)

| Feature | Phase | Notes |
|---------|-------|-------|
| Audit trail review UI (searchable, filterable, exportable) | Phase 9a | Not started |
| Hash chains on DomainEventLog for tamper evidence | Phase 9a | Not started |

## What's Missing

| Feature | Commercial Standard | Impact |
|---------|-------------------|--------|
| **Electronic BOL with e-signature** | Legally binding eBOL with shipper/carrier/consignee digital signatures (DocuSign/Adobe Sign integration) | High - paperless operations |
| **Proof of delivery capture UI** | Driver captures e-signature + photo + geo-stamp on delivery | High - depends on driver app |
| **Hazmat shipping papers** | Auto-generate per 49 CFR: proper shipping name, UN number, packing group, emergency phone | Medium - required for hazmat shippers |
| **Commercial invoice generation** | Auto-generate commercial invoices for international shipments | High - blocks international |
| **Certificate of Origin** | Template-based generation linked to order data | Medium - international trade |
| **Customs declaration support** | AMS, ISF/10+2, export declaration fields and document generation | High - cross-border compliance |
| **Denied party screening** | OFAC, BIS, EU, UN sanctions list checking before shipping | High - legal requirement for exporters |
| **FMCSA data display** | Show carrier safety rating, inspections, authority status from SAFER system | Medium - carrier qualification |
| **IFTA mileage reporting** | State-by-state mileage tracking for fuel tax (carrier-side TMS) | Low - carrier-side feature |
| **SOC 2 / ISO 27001 evidence** | Pre-built compliance report templates for auditors | Low - enterprise sales requirement |
| **Data retention policy enforcement** | Configurable per-org retention with automatic purge | Medium - GDPR/compliance |
| **Document version control** | Track revisions to BOL, invoice, and other documents with diff history | Low |
