
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CreateCustomer from './pages/CreateCustomer';
import Locations from './pages/Locations';
import CreateLocation from './pages/CreateLocation';
import Lanes from './pages/Lanes';
import CreateLane from './pages/CreateLane';
import Shipments from './pages/Shipments';
import CreateShipment from './pages/CreateShipment';
import ShipmentDetails from './pages/ShipmentDetails';
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
        <Route path="/locations" element={<Locations />} />
        <Route path="/locations/create" element={<CreateLocation />} />
        <Route path="/locations/:id/edit" element={<CreateLocation />} />
        <Route path="/lanes" element={<Lanes />} />
        <Route path="/lanes/create" element={<CreateLane />} />
        <Route path="/lanes/:id/edit" element={<CreateLane />} />
        <Route path="/shipments" element={<Shipments />} />
        <Route path="/shipments/create" element={<CreateShipment />} />
        <Route path="/shipments/:id/edit" element={<CreateShipment />} />
        <Route path="/shipments/:id" element={<ShipmentDetails />} />
      </Routes>
    </Layout>
  </BrowserRouter>
);
