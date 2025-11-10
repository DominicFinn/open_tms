
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './layout';
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
import './theme.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <BrowserRouter>
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
        <Route path="/orders/:id" element={<OrderDetails />} />
        <Route path="/orders/:id/edit" element={<EditOrder />} />

        <Route path="/shipments" element={<Shipments />} />
        <Route path="/shipments/create" element={<CreateShipment />} />
        <Route path="/shipments/:id/edit" element={<CreateShipment />} />
        <Route path="/shipments/:id" element={<ShipmentDetails />} />
        
        <Route path="/pending-lane-requests" element={<PendingLaneRequests />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/api-keys" element={<ApiKeys />} />
        <Route path="/webhook-logs" element={<WebhookLogs />} />
        <Route path="/outbound-integrations" element={<OutboundIntegrations />} />
        <Route path="/outbound-integration-logs" element={<OutboundIntegrationLogs />} />
      </Routes>
    </Layout>
  </BrowserRouter>
);
