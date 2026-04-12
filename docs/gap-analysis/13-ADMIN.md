# Administration & Configuration

## What's Built

- Organization model with comprehensive settings
- Theme/white-labeling: CSS custom properties, logo upload, color pickers, live preview
- Custom fields (versioned, any entity, 7 field types, server-side validation)
- Units of measure (org defaults + user overrides: weight, dimensions, temperature, distance)
- RBAC with 5 roles (admin, dispatcher, warehouse, readonly, customer) and fine-grained permissions
- OAuth 2.0 SSO (Google and Microsoft) with domain restrictions
- Magic link/QR code login for warehouse
- Account lockout (5 attempts, 15 min cooldown)
- Login audit log
- Email settings (provider selection, SMTP config, branding)
- Email templates with Handlebars (per-org, per-event-type)
- Event subscriptions (configurable notification routing)
- Document templates (BOL, label, customs, daily report)
- Agent/LLM settings (provider, model, key, temperature, enabled toggle)
- Automation rules (event pattern, conditions, actions, priority)
- Skills system (4 built-in skills, configurable per org)
- API key management (customer-scoped)
- Trading partner EDI configuration
- Google Maps API key management
- Queue monitoring dashboard (stats, DLQ, retry)
- Metrics endpoint (read model lag, event throughput, queue depths)

## What's Partially Built

- **Notification preferences**: Per-user preferences exist but the UI for configuring them is basic

## What's Planned (On Roadmap)

| Feature | Phase | Notes |
|---------|-------|-------|
| Prometheus-compatible metrics format | Phase 10 | Not started |
| Grafana dashboard templates | Phase 10 | Not started |

## What's Missing

| Feature | Commercial Standard | Impact |
|---------|-------------------|--------|
| **Multi-tenant / 3PL architecture** | Per-client data isolation, client-specific config, client-branded portals | High - blocks 3PL/broker market |
| **SSO for external users** | SAML/OIDC for customer portal and carrier portal (enterprise federated auth) | Medium - enterprise sales |
| **Multi-factor authentication** | TOTP or SMS-based MFA for internal and portal users | High - security requirement |
| **IP restriction & session controls** | IP allowlisting, configurable session timeout, concurrent session limits | Medium |
| **Configurable approval workflows** | Multi-step approvals for charges, invoices, credit notes, rate changes | Medium |
| **Business rules engine** | Configurable routing guide logic, auto-tender rules beyond current simple toggle | Medium - partially covered by automation rules |
| **Data import/export tools** | Bulk import for carriers, rates, locations, customers (beyond current CSV order import) | Medium |
| **System health dashboard** | Visual monitoring of job queues, integration error rates, API latency | Medium - partially exists |
| **Localization** | Date/time format, number format per locale (beyond just units of measure) | Medium - international markets |
| **Tax configuration** | VAT/GST rates by country/region for invoicing | High - international invoicing |
