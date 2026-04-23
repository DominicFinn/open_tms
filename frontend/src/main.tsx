
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './ThemeProvider';
import { MapProvider } from './MapProvider';
import { installAuthFetchInterceptor } from './authFetch';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import RequireAuth from './components/RequireAuth';

installAuthFetchInterceptor();

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
import VNextShipmentTypes from './vnext-design/VNextShipmentTypes';
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
import VNextLoadBoard from './vnext-design/VNextLoadBoard';
import VNextRoles from './vnext-design/VNextRoles';
import VNextUsers from './vnext-design/VNextUsers';
import VNextMarginReports from './vnext-design/VNextMarginReports';
import VNextCommissions from './vnext-design/VNextCommissions';
import VNextReportsDashboard from './vnext-design/VNextReportsDashboard';

// Public Pages
import PublicTracking from './pages/PublicTracking';

// Customer Portal
import { CustomerPortalLayout } from './customer-portal-layout';
import CustomerLogin from './pages/customer-portal/CustomerLogin';
import CustomerDashboard from './pages/customer-portal/CustomerDashboard';
import CustomerOrders from './pages/customer-portal/CustomerOrders';
import CustomerShipments from './pages/customer-portal/CustomerShipments';
import CustomerShipmentDetail from './pages/customer-portal/CustomerShipmentDetail';
import CustomerDocuments from './pages/customer-portal/CustomerDocuments';
import CustomerInvoices from './pages/customer-portal/CustomerInvoices';
import CustomerProfile from './pages/customer-portal/CustomerProfile';
import CustomerCreateOrder from './pages/customer-portal/CustomerCreateOrder';
import CustomerReturns from './pages/customer-portal/CustomerReturns';
import CustomerRequestReturn from './pages/customer-portal/CustomerRequestReturn';
import CustomerReturnDetail from './pages/customer-portal/CustomerReturnDetail';
import CustomerDeveloperDashboard from './pages/customer-portal/developer/CustomerDeveloperDashboard';
import CustomerApiKeys from './pages/customer-portal/developer/CustomerApiKeys';
import CustomerWebhooks from './pages/customer-portal/developer/CustomerWebhooks';
import CustomerEdiSetup from './pages/customer-portal/developer/CustomerEdiSetup';
import CustomerIntegrationLogs from './pages/customer-portal/developer/CustomerIntegrationLogs';

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

// VNext Quality Centre Pages
import VNextQualityDashboard from './vnext-design/VNextQualityDashboard';
import VNextQualityIssueSummaries from './vnext-design/VNextQualityIssueSummaries';
import VNextQualityCapa from './vnext-design/VNextQualityCapa';
import VNextQualitySopChecklists from './vnext-design/VNextQualitySopChecklists';
import VNextQualitySopAudits from './vnext-design/VNextQualitySopAudits';
import VNextQualityCarrierScorecard from './vnext-design/VNextQualityCarrierScorecard';
import VNextQualityLaneAnalysis from './vnext-design/VNextQualityLaneAnalysis';
import VNextQualityCapaEffectiveness from './vnext-design/VNextQualityCapaEffectiveness';

// WMS Pages (VNext)
import VNextWmsDashboard from './vnext-design/VNextWmsDashboard';
import VNextWmsOperationsDashboard from './vnext-design/VNextWmsOperationsDashboard';
import VNextPalletTypes from './vnext-design/VNextPalletTypes';
import VNextWmsZones from './vnext-design/VNextWmsZones';
import VNextWmsInventory from './vnext-design/VNextWmsInventory';
import VNextWmsReceiving from './vnext-design/VNextWmsReceiving';
import VNextWmsPutaway from './vnext-design/VNextWmsPutaway';
import VNextWmsWaves from './vnext-design/VNextWmsWaves';
import VNextWmsPicking from './vnext-design/VNextWmsPicking';
import VNextWmsPacking from './vnext-design/VNextWmsPacking';
import VNextWmsPackAudits from './vnext-design/VNextWmsPackAudits';
import VNextWmsReceivingAppointments from './vnext-design/VNextWmsReceivingAppointments';
import VNextCutoffDashboard from './vnext-design/VNextCutoffDashboard';
import VNextCarrierCutoffs from './vnext-design/VNextCarrierCutoffs';
import VNextWmsLoading from './vnext-design/VNextWmsLoading';
import VNextWmsCreateZone from './vnext-design/VNextWmsCreateZone';
import VNextWmsZoneDetail from './vnext-design/VNextWmsZoneDetail';
import VNextWmsBulkBins from './vnext-design/VNextWmsBulkBins';
import VNextWmsCreateReceiving from './vnext-design/VNextWmsCreateReceiving';
import VNextWmsReceivingDetail from './vnext-design/VNextWmsReceivingDetail';
import VNextWmsPutawayDetail from './vnext-design/VNextWmsPutawayDetail';
import VNextWmsCreateWave from './vnext-design/VNextWmsCreateWave';
import VNextWmsWaveDetail from './vnext-design/VNextWmsWaveDetail';
import VNextWmsPickTaskDetail from './vnext-design/VNextWmsPickTaskDetail';
import VNextWmsPackTaskDetail from './vnext-design/VNextWmsPackTaskDetail';
import VNextWmsCreateBin from './vnext-design/VNextWmsCreateBin';
import VNextWmsCycleCounts from './vnext-design/VNextWmsCycleCounts';
import VNextWmsCycleCountDetail from './vnext-design/VNextWmsCycleCountDetail';
import VNextWmsReplenishment from './vnext-design/VNextWmsReplenishment';
import VNextWmsWaveTemplates from './vnext-design/VNextWmsWaveTemplates';
import VNextWmsManifestUpload from './vnext-design/VNextWmsManifestUpload';
import VNextWmsProductUom from './vnext-design/VNextWmsProductUom';
import VNextWmsCartonCatalogue from './vnext-design/VNextWmsCartonCatalogue';
import VNextWmsLoadPlan from './vnext-design/VNextWmsLoadPlan';
import VNextWmsReturns from './vnext-design/VNextWmsReturns';
import VNextWmsCreateReturn from './vnext-design/VNextWmsCreateReturn';
import VNextWmsReturnDetail from './vnext-design/VNextWmsReturnDetail';
import VNextWmsRefundReview from './vnext-design/VNextWmsRefundReview';

// Warehouse App
import { WarehouseLayout } from './warehouse/warehouse-layout';
import WarehouseLogin from './warehouse/WarehouseLogin';
import WarehouseSelectLocation from './warehouse/WarehouseSelectLocation';
import WarehouseShipments from './warehouse/WarehouseShipments';
import WarehouseShipmentDetail from './warehouse/WarehouseShipmentDetail';
import WarehouseArchive from './warehouse/WarehouseArchive';
import WarehouseCreateShipment from './warehouse/WarehouseCreateShipment';
import WarehouseSettings from './warehouse/WarehouseSettings';
import WarehouseTasks from './warehouse/WarehouseTasks';
import WarehousePickTask from './warehouse/WarehousePickTask';
import WarehousePutawayTask from './warehouse/WarehousePutawayTask';
import WarehouseReturnReceive from './warehouse/WarehouseReturnReceive';
import WarehouseReturnInspect from './warehouse/WarehouseReturnInspect';
import WarehousePackAudit from './warehouse/WarehousePackAudit';
import WarehouseAppointments from './warehouse/WarehouseAppointments';
import WarehouseReceive from './warehouse/WarehouseReceive';
import WarehousePack from './warehouse/WarehousePack';
import './theme.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <BrowserRouter>
    <ThemeProvider>
      <MapProvider>
      <Routes>
        {/* Main TMS auth pages (standalone — outside main layout) */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Carrier Portal (standalone — outside main layout) */}
        <Route path="/carrier-portal/login" element={<CarrierLogin />} />
        <Route path="/carrier-portal" element={<CarrierPortalLayout />}>
          <Route index element={<CarrierDashboard />} />
          <Route path="tenders/:id" element={<CarrierTenderView />} />
          <Route path="history" element={<CarrierTenderHistory />} />
          <Route path="bids" element={<CarrierBidHistory />} />
          <Route path="profile" element={<CarrierProfile />} />
        </Route>

        {/* Public tracking page (no auth required) */}
        <Route path="/track/:token" element={<PublicTracking />} />

        {/* Customer Portal (standalone — outside main layout) */}
        <Route path="/customer-portal/login" element={<CustomerLogin />} />
        <Route path="/customer-portal" element={<CustomerPortalLayout />}>
          <Route index element={<CustomerDashboard />} />
          <Route path="orders" element={<CustomerOrders />} />
          <Route path="orders/create" element={<CustomerCreateOrder />} />
          <Route path="shipments" element={<CustomerShipments />} />
          <Route path="shipments/:id" element={<CustomerShipmentDetail />} />
          <Route path="documents" element={<CustomerDocuments />} />
          <Route path="invoices" element={<CustomerInvoices />} />
          <Route path="returns" element={<CustomerReturns />} />
          <Route path="returns/new" element={<CustomerRequestReturn />} />
          <Route path="returns/:id" element={<CustomerReturnDetail />} />
          <Route path="profile" element={<CustomerProfile />} />
          <Route path="developer" element={<CustomerDeveloperDashboard />} />
          <Route path="developer/api-keys" element={<CustomerApiKeys />} />
          <Route path="developer/webhooks" element={<CustomerWebhooks />} />
          <Route path="developer/edi" element={<CustomerEdiSetup />} />
          <Route path="developer/logs" element={<CustomerIntegrationLogs />} />
        </Route>

        {/* Warehouse App (standalone — outside main layout) */}
        <Route path="/warehouse/login" element={<WarehouseLogin />} />
        <Route path="/warehouse/select-location" element={<WarehouseSelectLocation />} />
        <Route path="/warehouse" element={<WarehouseLayout />}>
          <Route index element={<WarehouseShipments />} />
          <Route path="shipments/:id" element={<WarehouseShipmentDetail />} />
          <Route path="archive" element={<WarehouseArchive />} />
          <Route path="create" element={<WarehouseCreateShipment />} />
          <Route path="tasks" element={<WarehouseTasks />} />
          <Route path="tasks/pick/:id" element={<WarehousePickTask />} />
          <Route path="tasks/putaway/:id" element={<WarehousePutawayTask />} />
          <Route path="tasks/return-receive/:id" element={<WarehouseReturnReceive />} />
          <Route path="tasks/return-inspect/:id" element={<WarehouseReturnInspect />} />
          <Route path="tasks/pack-audit/:id" element={<WarehousePackAudit />} />
          <Route path="tasks/receive/:id" element={<WarehouseReceive />} />
          <Route path="tasks/pack/:id" element={<WarehousePack />} />
          <Route path="appointments" element={<WarehouseAppointments />} />
          <Route path="settings" element={<WarehouseSettings />} />
        </Route>

        {/* Main app (VNext layout) — requires internal user auth */}
        <Route path="/" element={<RequireAuth><VNextLayout /></RequireAuth>}>
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
          <Route path="orders/:id/edit" element={<VNextCreateOrder />} />
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
          <Route path="loadboard" element={<VNextLoadBoard />} />

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

          {/* Quality Centre */}
          <Route path="quality" element={<VNextQualityDashboard />} />
          <Route path="quality/summaries" element={<VNextQualityIssueSummaries />} />
          <Route path="quality/capa" element={<VNextQualityCapa />} />
          <Route path="quality/sop-checklists" element={<VNextQualitySopChecklists />} />
          <Route path="quality/sop-audits" element={<VNextQualitySopAudits />} />
          <Route path="quality/carrier-scorecard" element={<VNextQualityCarrierScorecard />} />
          <Route path="quality/lane-analysis" element={<VNextQualityLaneAnalysis />} />
          <Route path="quality/capa-effectiveness" element={<VNextQualityCapaEffectiveness />} />

          {/* Documents & Reports */}
          <Route path="documents" element={<VNextDocuments />} />
          <Route path="documents/:id/view" element={<VNextBolView />} />
          <Route path="reports" element={<VNextReportsDashboard />} />
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
          <Route path="settings/roles" element={<VNextRoles />} />
          <Route path="settings/users" element={<VNextUsers />} />
          <Route path="settings/shipment-types" element={<VNextShipmentTypes />} />

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
          <Route path="finance/margin-reports" element={<VNextMarginReports />} />
          <Route path="finance/commissions" element={<VNextCommissions />} />

          {/* WMS */}
          <Route path="wms" element={<VNextWmsDashboard />} />
          <Route path="wms/operations" element={<VNextWmsOperationsDashboard />} />
          <Route path="wms/pallet-types" element={<VNextPalletTypes />} />
          <Route path="wms/zones" element={<VNextWmsZones />} />
          <Route path="wms/zones/create" element={<VNextWmsCreateZone />} />
          <Route path="wms/zones/:id" element={<VNextWmsZoneDetail />} />
          <Route path="wms/zones/:id/edit" element={<VNextWmsCreateZone />} />
          <Route path="wms/zones/:zoneId/bins/bulk" element={<VNextWmsBulkBins />} />
          <Route path="wms/zones/:zoneId/bins/create" element={<VNextWmsCreateBin />} />
          <Route path="wms/bins/create" element={<VNextWmsCreateBin />} />
          <Route path="wms/inventory" element={<VNextWmsInventory />} />
          <Route path="wms/receiving" element={<VNextWmsReceiving />} />
          <Route path="wms/receiving/create" element={<VNextWmsCreateReceiving />} />
          <Route path="wms/manifest" element={<VNextWmsManifestUpload />} />
          <Route path="wms/receiving/:id" element={<VNextWmsReceivingDetail />} />
          <Route path="wms/putaway" element={<VNextWmsPutaway />} />
          <Route path="wms/putaway/:id" element={<VNextWmsPutawayDetail />} />
          <Route path="wms/waves" element={<VNextWmsWaves />} />
          <Route path="wms/waves/create" element={<VNextWmsCreateWave />} />
          <Route path="wms/waves/templates" element={<VNextWmsWaveTemplates />} />
          <Route path="wms/waves/:id" element={<VNextWmsWaveDetail />} />
          <Route path="wms/picking" element={<VNextWmsPicking />} />
          <Route path="wms/picking/:id" element={<VNextWmsPickTaskDetail />} />
          <Route path="wms/packing" element={<VNextWmsPacking />} />
          <Route path="wms/packing/:id" element={<VNextWmsPackTaskDetail />} />
          <Route path="wms/pack-audits" element={<VNextWmsPackAudits />} />
          <Route path="wms/receiving-appointments" element={<VNextWmsReceivingAppointments />} />
          <Route path="wms/cutoff-monitor" element={<VNextCutoffDashboard />} />
          <Route path="wms/carrier-cutoffs" element={<VNextCarrierCutoffs />} />
          <Route path="wms/loading" element={<VNextWmsLoading />} />
          <Route path="wms/cycle-counts" element={<VNextWmsCycleCounts />} />
          <Route path="wms/cycle-counts/:id" element={<VNextWmsCycleCountDetail />} />
          <Route path="wms/replenishment" element={<VNextWmsReplenishment />} />
          <Route path="wms/product-dimensions" element={<VNextWmsProductUom />} />
          <Route path="wms/carton-catalogue" element={<VNextWmsCartonCatalogue />} />
          <Route path="wms/load-plans" element={<VNextWmsLoadPlan />} />
          <Route path="wms/returns" element={<VNextWmsReturns />} />
          <Route path="wms/returns/create" element={<VNextWmsCreateReturn />} />
          <Route path="wms/returns/refund-review" element={<VNextWmsRefundReview />} />
          <Route path="wms/returns/:id" element={<VNextWmsReturnDetail />} />

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

          {/* Redirect legacy /admin paths to /settings */}
          <Route path="admin" element={<Navigate to="/settings" replace />} />
          <Route path="admin/*" element={<Navigate to="/settings" replace />} />
        </Route>
      </Routes>
      </MapProvider>
    </ThemeProvider>
  </BrowserRouter>
);
