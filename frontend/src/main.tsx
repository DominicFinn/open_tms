
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './ThemeProvider';
import { MapProvider } from './MapProvider';

// VNext Layout & Pages
import VNextLayout from './vnext-design/vnext-layout';
import VNextDashboard from './vnext-design/VNextDashboard';
import VNextShipments from './vnext-design/VNextShipments';
import VNextShipmentDetail from './vnext-design/VNextShipmentDetail';
import VNextOrders from './vnext-design/VNextOrders';
import VNextIssueKanban from './vnext-design/VNextIssueKanban';
import VNextIssueDetail from './vnext-design/VNextIssueDetail';
import VNextCarriers from './vnext-design/VNextCarriers';
import VNextCarrierBidding from './vnext-design/VNextCarrierBidding';
import VNextCustomers from './vnext-design/VNextCustomers';
import VNextLocations from './vnext-design/VNextLocations';
import VNextLanes from './vnext-design/VNextLanes';
import VNextLaneDetail from './vnext-design/VNextLaneDetail';
import VNextDocuments from './vnext-design/VNextDocuments';
import VNextDailyReport from './vnext-design/VNextDailyReport';
import VNextLocationReport from './vnext-design/VNextLocationReport';
import VNextSettings from './vnext-design/VNextSettings';
import VNextStyleGuide from './vnext-design/VNextStyleGuide';

// VNext Create/Edit Pages
import VNextCreateShipment from './vnext-design/VNextCreateShipment';
import VNextCreateOrder from './vnext-design/VNextCreateOrder';
import VNextCreateLocation from './vnext-design/VNextCreateLocation';
import VNextCreateCarrier from './vnext-design/VNextCreateCarrier';
import VNextCreateCustomer from './vnext-design/VNextCreateCustomer';
import VNextCreateLane from './vnext-design/VNextCreateLane';

// VNext Integration Pages
import VNextIntegrationsLayout from './vnext-design/VNextIntegrationsLayout';
import VNextIntegrationsDashboard from './vnext-design/VNextIntegrationsDashboard';
import VNextApiKeys from './vnext-design/VNextApiKeys';
import VNextWebhookLogs from './vnext-design/VNextWebhookLogs';
import VNextEdiDashboard from './vnext-design/VNextEdiDashboard';
import VNextTradingPartnersPage from './vnext-design/VNextTradingPartners';
import VNextEdiTransactionLog from './vnext-design/VNextEdiTransactionLog';
import VNextEdiImport from './vnext-design/VNextEdiImport';
import VNextCarrierTracking from './vnext-design/VNextCarrierTracking';
import VNextCarrierTrackingSetup from './vnext-design/VNextCarrierTrackingSetup';
import VNextCarrierTrackingDetail from './vnext-design/VNextCarrierTrackingDetail';
import VNextOrderDetail from './vnext-design/VNextOrderDetail';
import VNextPendingLaneRequests from './vnext-design/VNextPendingLaneRequests';
import VNextOrderImportCSV from './vnext-design/VNextOrderImportCSV';
import VNextThemeSettings from './vnext-design/VNextThemeSettings';
import VNextEmailSettings from './vnext-design/VNextEmailSettings';
import VNextEmailTemplates from './vnext-design/VNextEmailTemplates';
import VNextDocumentTemplates from './vnext-design/VNextDocumentTemplates';
import VNextBolView from './vnext-design/VNextBolView';
import VNextCustomFields from './vnext-design/VNextCustomFields';
import VNextMapsSettings from './vnext-design/VNextMapsSettings';
import VNextDevices from './vnext-design/VNextDevices';
import VNextDeviceDetail from './vnext-design/VNextDeviceDetail';
import VNextShipmentMap from './vnext-design/VNextShipmentMap';
import VNextSlaDashboard from './vnext-design/VNextSlaDashboard';
import VNextSlaPolicies from './vnext-design/VNextSlaPolicies';
import VNextLocationOps from './vnext-design/VNextLocationOps';
import VNextAgentDecisions from './vnext-design/VNextAgentDecisions';
import VNextAgentDecisionDetail from './vnext-design/VNextAgentDecisionDetail';
import VNextLlmSettings from './vnext-design/VNextLlmSettings';
import VNextAgentConfig from './vnext-design/VNextAgentConfig';
import VNextAutomationRules from './vnext-design/VNextAutomationRules';
import VNextAutomationRuleDetail from './vnext-design/VNextAutomationRuleDetail';
import VNextSkillsConfig from './vnext-design/VNextSkillsConfig';
import VNextSkillChains from './vnext-design/VNextSkillChains';

// VNext Finance Pages
import VNextFinanceDashboard from './vnext-design/VNextFinanceDashboard';
import VNextFinanceInvoices from './vnext-design/VNextFinanceInvoices';
import VNextFinanceCarrierInvoices from './vnext-design/VNextFinanceCarrierInvoices';
import VNextFinanceQuotes from './vnext-design/VNextFinanceQuotes';
import VNextFinanceQueries from './vnext-design/VNextFinanceQueries';
import VNextFinanceCreditNotes from './vnext-design/VNextFinanceCreditNotes';
import VNextFinanceInvoiceDetail from './vnext-design/VNextFinanceInvoiceDetail';
import VNextFinanceCarrierInvoiceDetail from './vnext-design/VNextFinanceCarrierInvoiceDetail';
import VNextFinanceQuoteDetail from './vnext-design/VNextFinanceQuoteDetail';
import VNextFinanceQueryDetail from './vnext-design/VNextFinanceQueryDetail';
import VNextFinanceCreateInvoice from './vnext-design/VNextFinanceCreateInvoice';
import VNextFinanceCreateQuote from './vnext-design/VNextFinanceCreateQuote';
import VNextFinanceAgingReport from './vnext-design/VNextFinanceAgingReport';
import VNextFinanceRecordPayments from './vnext-design/VNextFinanceRecordPayments';
import VNextFinanceExports from './vnext-design/VNextFinanceExports';

// Carrier Tendering & Portal
import Tenders from './pages/Tenders';
import TenderDetail from './pages/TenderDetail';
import CreateTender from './pages/CreateTender';
import { CarrierPortalLayout } from './carrier-portal-layout';
import CarrierLogin from './pages/carrier-portal/CarrierLogin';
import CarrierDashboard from './pages/carrier-portal/CarrierDashboard';
import CarrierTenderView from './pages/carrier-portal/CarrierTenderView';
import CarrierBidHistory from './pages/carrier-portal/CarrierBidHistory';
import CarrierTenderHistory from './pages/carrier-portal/CarrierTenderHistory';
import CarrierProfile from './pages/carrier-portal/CarrierProfile';
import VNextColdChainProfiles from './pages/VNextColdChainProfiles';
import VNextCAPAReports from './pages/VNextCAPAReports';

// Warehouse App
import { WarehouseLayout } from './warehouse/warehouse-layout';
import WarehouseLogin from './warehouse/WarehouseLogin';
import WarehouseSelectLocation from './warehouse/WarehouseSelectLocation';
import WarehouseShipments from './warehouse/WarehouseShipments';
import WarehouseShipmentDetail from './warehouse/WarehouseShipmentDetail';
import WarehouseArchive from './warehouse/WarehouseArchive';
import WarehouseCreateShipment from './warehouse/WarehouseCreateShipment';
import WarehouseSettings from './warehouse/WarehouseSettings';
import './theme.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <BrowserRouter>
    <ThemeProvider>
      <MapProvider>
      <Routes>
        {/* Carrier Portal (standalone — outside main layout) */}
        <Route path="/carrier-portal/login" element={<CarrierLogin />} />
        <Route path="/carrier-portal" element={<CarrierPortalLayout />}>
          <Route index element={<CarrierDashboard />} />
          <Route path="tenders/:id" element={<CarrierTenderView />} />
          <Route path="history" element={<CarrierTenderHistory />} />
          <Route path="bids" element={<CarrierBidHistory />} />
          <Route path="profile" element={<CarrierProfile />} />
        </Route>

        {/* Warehouse App (standalone — outside main layout) */}
        <Route path="/warehouse/login" element={<WarehouseLogin />} />
        <Route path="/warehouse/select-location" element={<WarehouseSelectLocation />} />
        <Route path="/warehouse" element={<WarehouseLayout />}>
          <Route index element={<WarehouseShipments />} />
          <Route path="shipments/:id" element={<WarehouseShipmentDetail />} />
          <Route path="archive" element={<WarehouseArchive />} />
          <Route path="create" element={<WarehouseCreateShipment />} />
          <Route path="settings" element={<WarehouseSettings />} />
        </Route>

        {/* Main app (VNext layout) */}
        <Route path="/" element={<VNextLayout />}>
          {/* Dashboard */}
          <Route index element={<VNextDashboard />} />

          {/* Map & Dashboard */}
          <Route path="map" element={<VNextShipmentMap />} />
          <Route path="sla" element={<VNextSlaDashboard />} />

          {/* Shipments */}
          <Route path="shipments" element={<VNextShipments />} />
          <Route path="shipments/create" element={<VNextCreateShipment />} />
          <Route path="shipments/:id/edit" element={<VNextCreateShipment />} />
          <Route path="shipments/:id" element={<VNextShipmentDetail />} />

          {/* Orders */}
          <Route path="orders" element={<VNextOrders />} />
          <Route path="orders/create" element={<VNextCreateOrder />} />
          <Route path="orders/import/csv" element={<VNextOrderImportCSV />} />
          <Route path="orders/import/edi" element={<VNextEdiImport />} />
          <Route path="orders/:id" element={<VNextOrderDetail />} />

          {/* Pending Lane Requests */}
          <Route path="pending-lane-requests" element={<VNextPendingLaneRequests />} />

          {/* Tenders */}
          <Route path="tenders" element={<Tenders />} />
          <Route path="tenders/create" element={<CreateTender />} />
          <Route path="tenders/:id" element={<TenderDetail />} />

          {/* Issues & Carrier Bidding */}
          <Route path="issues" element={<VNextIssueKanban />} />
          <Route path="issues/:id" element={<VNextIssueDetail />} />
          <Route path="carrier-bidding" element={<VNextCarrierBidding />} />

          {/* Agent Decisions */}
          <Route path="agent-decisions" element={<VNextAgentDecisions />} />
          <Route path="agent-decisions/:id" element={<VNextAgentDecisionDetail />} />

          {/* Automation Rules */}
          <Route path="automation-rules" element={<VNextAutomationRules />} />
          <Route path="automation-rules/:id" element={<VNextAutomationRuleDetail />} />

          {/* Devices */}
          <Route path="devices" element={<VNextDevices />} />
          <Route path="devices/:id" element={<VNextDeviceDetail />} />

          {/* Carriers */}
          <Route path="carriers" element={<VNextCarriers />} />
          <Route path="carriers/create" element={<VNextCreateCarrier />} />
          <Route path="carriers/:id/edit" element={<VNextCreateCarrier />} />

          {/* Customers */}
          <Route path="customers" element={<VNextCustomers />} />
          <Route path="customers/create" element={<VNextCreateCustomer />} />
          <Route path="customers/:id/edit" element={<VNextCreateCustomer />} />

          {/* Locations */}
          <Route path="locations" element={<VNextLocations />} />
          <Route path="locations/create" element={<VNextCreateLocation />} />
          <Route path="locations/:id/edit" element={<VNextCreateLocation />} />
          <Route path="locations/:id/ops" element={<VNextLocationOps />} />

          {/* Lanes */}
          <Route path="lanes" element={<VNextLanes />} />
          <Route path="lanes/create" element={<VNextCreateLane />} />
          <Route path="lanes/:id/edit" element={<VNextCreateLane />} />
          <Route path="lanes/:id" element={<VNextLaneDetail />} />

          {/* Cold Chain & Compliance */}
          <Route path="cold-chain/profiles" element={<VNextColdChainProfiles />} />
          <Route path="cold-chain/capa" element={<VNextCAPAReports />} />

          {/* Documents & Reports */}
          <Route path="documents" element={<VNextDocuments />} />
          <Route path="documents/:id/view" element={<VNextBolView />} />
          <Route path="reports/daily" element={<VNextDailyReport />} />
          <Route path="reports/locations" element={<VNextLocationReport />} />

          {/* Settings */}
          <Route path="settings" element={<VNextSettings />} />
          <Route path="settings/theme" element={<VNextThemeSettings />} />
          <Route path="settings/email" element={<VNextEmailSettings />} />
          <Route path="settings/email-templates" element={<VNextEmailTemplates />} />
          <Route path="settings/document-templates" element={<VNextDocumentTemplates />} />
          <Route path="settings/custom-fields" element={<VNextCustomFields />} />
          <Route path="settings/maps" element={<VNextMapsSettings />} />
          <Route path="settings/sla" element={<VNextSlaPolicies />} />
          <Route path="settings/llm" element={<VNextLlmSettings />} />
          <Route path="settings/agents" element={<VNextAgentConfig />} />
          <Route path="settings/skills" element={<VNextSkillsConfig />} />
          <Route path="settings/skill-chains" element={<VNextSkillChains />} />

          {/* Finance */}
          <Route path="finance" element={<VNextFinanceDashboard />} />
          <Route path="finance/invoices" element={<VNextFinanceInvoices />} />
          <Route path="finance/invoices/create" element={<VNextFinanceCreateInvoice />} />
          <Route path="finance/invoices/:id" element={<VNextFinanceInvoiceDetail />} />
          <Route path="finance/carrier-invoices" element={<VNextFinanceCarrierInvoices />} />
          <Route path="finance/carrier-invoices/:id" element={<VNextFinanceCarrierInvoiceDetail />} />
          <Route path="finance/quotes" element={<VNextFinanceQuotes />} />
          <Route path="finance/quotes/create" element={<VNextFinanceCreateQuote />} />
          <Route path="finance/quotes/:id" element={<VNextFinanceQuoteDetail />} />
          <Route path="finance/queries" element={<VNextFinanceQueries />} />
          <Route path="finance/queries/:id" element={<VNextFinanceQueryDetail />} />
          <Route path="finance/credit-notes" element={<VNextFinanceCreditNotes />} />
          <Route path="finance/aging" element={<VNextFinanceAgingReport />} />
          <Route path="finance/payments" element={<VNextFinanceRecordPayments />} />
          <Route path="finance/exports" element={<VNextFinanceExports />} />

          {/* Integrations (sub-layout with tabs) */}
          <Route path="integrations" element={<VNextIntegrationsLayout />}>
            <Route index element={<VNextIntegrationsDashboard />} />
            <Route path="api-keys" element={<VNextApiKeys />} />
            <Route path="webhook-logs" element={<VNextWebhookLogs />} />
            <Route path="edi" element={<VNextEdiDashboard />} />
            <Route path="edi/partners" element={<VNextTradingPartnersPage />} />
            <Route path="edi/logs" element={<VNextEdiTransactionLog />} />
            <Route path="edi/import" element={<VNextEdiImport />} />
            <Route path="carrier-tracking" element={<VNextCarrierTracking />} />
            <Route path="carrier-tracking/setup" element={<VNextCarrierTrackingSetup />} />
            <Route path="carrier-tracking/:id" element={<VNextCarrierTrackingDetail />} />
          </Route>

          {/* Style Guide */}
          <Route path="style-guide" element={<VNextStyleGuide />} />
        </Route>
      </Routes>
      </MapProvider>
    </ThemeProvider>
  </BrowserRouter>
);
