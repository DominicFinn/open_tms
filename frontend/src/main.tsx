
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
import VNextCarriers from './vnext-design/VNextCarriers';
import VNextCarrierBidding from './vnext-design/VNextCarrierBidding';
import VNextCustomers from './vnext-design/VNextCustomers';
import VNextLocations from './vnext-design/VNextLocations';
import VNextLanes from './vnext-design/VNextLanes';
import VNextLaneDetail from './vnext-design/VNextLaneDetail';
import VNextDocuments from './vnext-design/VNextDocuments';
import VNextDailyReport from './vnext-design/VNextDailyReport';
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
import VNextOutboundIntegrations from './vnext-design/VNextOutboundIntegrations';
import VNextOutboundLogs from './vnext-design/VNextOutboundLogs';
import VNextEdiPartners from './vnext-design/VNextEdiPartners';
import VNextEdiFiles from './vnext-design/VNextEdiFiles';
import VNextOrderDetail from './vnext-design/VNextOrderDetail';
import VNextPendingLaneRequests from './vnext-design/VNextPendingLaneRequests';
import VNextOrderImportCSV from './vnext-design/VNextOrderImportCSV';
import VNextOrderImportEDI from './vnext-design/VNextOrderImportEDI';
import VNextThemeSettings from './vnext-design/VNextThemeSettings';
import VNextEmailSettings from './vnext-design/VNextEmailSettings';
import VNextEmailTemplates from './vnext-design/VNextEmailTemplates';
import VNextDocumentTemplates from './vnext-design/VNextDocumentTemplates';
import VNextCustomFields from './vnext-design/VNextCustomFields';
import VNextMapsSettings from './vnext-design/VNextMapsSettings';

import './theme.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <BrowserRouter>
    <ThemeProvider>
      <MapProvider>
      <Routes>
        <Route path="/" element={<VNextLayout />}>
          {/* Dashboard */}
          <Route index element={<VNextDashboard />} />

          {/* Shipments */}
          <Route path="shipments" element={<VNextShipments />} />
          <Route path="shipments/create" element={<VNextCreateShipment />} />
          <Route path="shipments/:id/edit" element={<VNextCreateShipment />} />
          <Route path="shipments/:id" element={<VNextShipmentDetail />} />

          {/* Orders */}
          <Route path="orders" element={<VNextOrders />} />
          <Route path="orders/create" element={<VNextCreateOrder />} />
          <Route path="orders/import/csv" element={<VNextOrderImportCSV />} />
          <Route path="orders/import/edi" element={<VNextOrderImportEDI />} />
          <Route path="orders/:id" element={<VNextOrderDetail />} />

          {/* Pending Lane Requests */}
          <Route path="pending-lane-requests" element={<VNextPendingLaneRequests />} />

          {/* Issues & Carrier Bidding */}
          <Route path="issues" element={<VNextIssueKanban />} />
          <Route path="carrier-bidding" element={<VNextCarrierBidding />} />

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

          {/* Lanes */}
          <Route path="lanes" element={<VNextLanes />} />
          <Route path="lanes/create" element={<VNextCreateLane />} />
          <Route path="lanes/:id/edit" element={<VNextCreateLane />} />
          <Route path="lanes/:id" element={<VNextLaneDetail />} />

          {/* Documents & Reports */}
          <Route path="documents" element={<VNextDocuments />} />
          <Route path="reports/daily" element={<VNextDailyReport />} />

          {/* Settings */}
          <Route path="settings" element={<VNextSettings />} />
          <Route path="settings/theme" element={<VNextThemeSettings />} />
          <Route path="settings/email" element={<VNextEmailSettings />} />
          <Route path="settings/email-templates" element={<VNextEmailTemplates />} />
          <Route path="settings/document-templates" element={<VNextDocumentTemplates />} />
          <Route path="settings/custom-fields" element={<VNextCustomFields />} />
          <Route path="settings/maps" element={<VNextMapsSettings />} />

          {/* Integrations (sub-layout with tabs) */}
          <Route path="integrations" element={<VNextIntegrationsLayout />}>
            <Route index element={<VNextIntegrationsDashboard />} />
            <Route path="api-keys" element={<VNextApiKeys />} />
            <Route path="webhook-logs" element={<VNextWebhookLogs />} />
            <Route path="outbound" element={<VNextOutboundIntegrations />} />
            <Route path="outbound-logs" element={<VNextOutboundLogs />} />
            <Route path="edi-partners" element={<VNextEdiPartners />} />
            <Route path="edi-files" element={<VNextEdiFiles />} />
          </Route>

          {/* Style Guide */}
          <Route path="style-guide" element={<VNextStyleGuide />} />
        </Route>
      </Routes>
      </MapProvider>
    </ThemeProvider>
  </BrowserRouter>
);
