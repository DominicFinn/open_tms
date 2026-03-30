
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './layout';
import { IntegrationsLayout } from './integrations-layout';
import { AdminLayout } from './admin-layout';
import { ThemeProvider } from './ThemeProvider';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CreateCustomer from './pages/CreateCustomer';
import Carriers from './pages/Carriers';
import CreateCarrier from './pages/CreateCarrier';
import Locations from './pages/Locations';
import CreateLocation from './pages/CreateLocation';
import Lanes from './pages/Lanes';
import CreateLane from './pages/CreateLane';
import LaneDetails from './pages/LaneDetails';
import Shipments from './pages/Shipments';
import CreateShipment from './pages/CreateShipment';
import ShipmentDetails from './pages/ShipmentDetails';
import Orders from './pages/Orders';
import CreateOrder from './pages/CreateOrder';
import OrderDetails from './pages/OrderDetails';
import EditOrder from './pages/EditOrder';
import OrderImportCSV from './pages/OrderImportCSV';
import PendingLaneRequests from './pages/PendingLaneRequests';
import Settings from './pages/Settings';
import ApiKeys from './pages/ApiKeys';
import WebhookLogs from './pages/WebhookLogs';
import OutboundIntegrations from './pages/OutboundIntegrations';
import OutboundIntegrationLogs from './pages/OutboundIntegrationLogs';
import OrderImportEDI from './pages/OrderImportEDI';
import EdiPartners from './pages/EdiPartners';
import EdiFiles from './pages/EdiFiles';
import IntegrationsDashboard from './pages/IntegrationsDashboard';
import Documents from './pages/Documents';
import DocumentTemplates from './pages/DocumentTemplates';
import DailyReport from './pages/DailyReport';
import CustomFields from './pages/CustomFields';
import AdminDashboard from './pages/AdminDashboard';
import ThemeSettings from './pages/ThemeSettings';
import EmailSettings from './pages/EmailSettings';
import EmailTemplatesPage from './pages/EmailTemplates';
import StyleGuide from './pages/StyleGuide';
import './theme.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <BrowserRouter>
    <ThemeProvider>
      <Routes>
        {/* Integrations sub-app */}
        <Route path="/integrations" element={<IntegrationsLayout />}>
          <Route index element={<IntegrationsDashboard />} />
          <Route path="api-keys" element={<ApiKeys />} />
          <Route path="webhook-logs" element={<WebhookLogs />} />
          <Route path="outbound" element={<OutboundIntegrations />} />
          <Route path="outbound-logs" element={<OutboundIntegrationLogs />} />
          <Route path="edi-partners" element={<EdiPartners />} />
          <Route path="edi-files" element={<EdiFiles />} />
        </Route>

        {/* Admin sub-app */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="settings" element={<Settings />} />
          <Route path="theme" element={<ThemeSettings />} />
          <Route path="email" element={<EmailSettings />} />
          <Route path="email-templates" element={<EmailTemplatesPage />} />
          <Route path="document-templates" element={<DocumentTemplates />} />
          <Route path="custom-fields" element={<CustomFields />} />
          <Route path="style-guide" element={<StyleGuide />} />
        </Route>

        {/* Operations routes - wrapped in Layout */}
        <Route path="/*" element={
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />

              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/create" element={<CreateCustomer />} />
              <Route path="/customers/:id/edit" element={<CreateCustomer />} />

              <Route path="/carriers" element={<Carriers />} />
              <Route path="/carriers/create" element={<CreateCarrier />} />
              <Route path="/carriers/:id/edit" element={<CreateCarrier />} />

              <Route path="/locations" element={<Locations />} />
              <Route path="/locations/create" element={<CreateLocation />} />
              <Route path="/locations/:id/edit" element={<CreateLocation />} />

              <Route path="/lanes" element={<Lanes />} />
              <Route path="/lanes/create" element={<CreateLane />} />
              <Route path="/lanes/:id/edit" element={<CreateLane />} />
              <Route path="/lanes/:id" element={<LaneDetails />} />

              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/create" element={<CreateOrder />} />
              <Route path="/orders/import/csv" element={<OrderImportCSV />} />
              <Route path="/orders/import/edi" element={<OrderImportEDI />} />
              <Route path="/orders/:id" element={<OrderDetails />} />
              <Route path="/orders/:id/edit" element={<EditOrder />} />

              <Route path="/shipments" element={<Shipments />} />
              <Route path="/shipments/create" element={<CreateShipment />} />
              <Route path="/shipments/:id/edit" element={<CreateShipment />} />
              <Route path="/shipments/:id" element={<ShipmentDetails />} />

              <Route path="/pending-lane-requests" element={<PendingLaneRequests />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/reports/daily" element={<DailyReport />} />

              {/* Redirects from old settings paths to admin app */}
              <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
              <Route path="/settings/document-templates" element={<Navigate to="/admin/document-templates" replace />} />
              <Route path="/settings/custom-fields" element={<Navigate to="/admin/custom-fields" replace />} />

              {/* Redirects from old integration URLs */}
              <Route path="/api-keys" element={<Navigate to="/integrations/api-keys" replace />} />
              <Route path="/webhook-logs" element={<Navigate to="/integrations/webhook-logs" replace />} />
              <Route path="/outbound-integrations" element={<Navigate to="/integrations/outbound" replace />} />
              <Route path="/outbound-integration-logs" element={<Navigate to="/integrations/outbound-logs" replace />} />
              <Route path="/edi-partners" element={<Navigate to="/integrations/edi-partners" replace />} />
              <Route path="/edi-files" element={<Navigate to="/integrations/edi-files" replace />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </ThemeProvider>
  </BrowserRouter>
);
