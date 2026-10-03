-- #314: invoice, credit note, query, quote and order numbers, and shipment references, were unique
-- across every organization. Each org numbers its own documents (QTE-0001, INV-20260917-0001), so
-- a second org's first quote collided with the first org's, and an order number a customer supplied
-- could be refused because another tenant had used it. They are now unique within an org.
--
-- Table roles: Invoice, CreditNote, FinancialQuery, Quote and Order are authoritative; the three
-- read models are projections. No backfill: every existing row already satisfies the new,
-- weaker constraint.
--
-- Index budget: unchanged on every table. Each (orgId, number) unique index replaces the global
-- unique index on the number and the plain orgId index, which is its leftmost prefix.

DROP INDEX "Invoice_invoiceNumber_key";
DROP INDEX "Invoice_orgId_idx";
CREATE UNIQUE INDEX "Invoice_orgId_invoiceNumber_key" ON "Invoice"("orgId", "invoiceNumber");

DROP INDEX "FinancialQuery_queryNumber_key";
DROP INDEX "FinancialQuery_orgId_idx";
CREATE UNIQUE INDEX "FinancialQuery_orgId_queryNumber_key" ON "FinancialQuery"("orgId", "queryNumber");

DROP INDEX "CreditNote_creditNoteNumber_key";
DROP INDEX "CreditNote_orgId_idx";
CREATE UNIQUE INDEX "CreditNote_orgId_creditNoteNumber_key" ON "CreditNote"("orgId", "creditNoteNumber");

DROP INDEX "InvoiceReadModel_invoiceNumber_key";
DROP INDEX "InvoiceReadModel_orgId_idx";
CREATE UNIQUE INDEX "InvoiceReadModel_orgId_invoiceNumber_key" ON "InvoiceReadModel"("orgId", "invoiceNumber");

DROP INDEX "Order_orderNumber_key";
DROP INDEX "Order_orgId_idx";
CREATE UNIQUE INDEX "Order_orgId_orderNumber_key" ON "Order"("orgId", "orderNumber");

DROP INDEX "OrderReadModel_orderNumber_key";
DROP INDEX "OrderReadModel_orgId_idx";
CREATE UNIQUE INDEX "OrderReadModel_orgId_orderNumber_key" ON "OrderReadModel"("orgId", "orderNumber");

DROP INDEX "ShipmentReadModel_reference_key";
DROP INDEX "ShipmentReadModel_orgId_idx";
CREATE UNIQUE INDEX "ShipmentReadModel_orgId_reference_key" ON "ShipmentReadModel"("orgId", "reference");

DROP INDEX "Quote_quoteNumber_key";
DROP INDEX "Quote_orgId_idx";
CREATE UNIQUE INDEX "Quote_orgId_quoteNumber_key" ON "Quote"("orgId", "quoteNumber");
