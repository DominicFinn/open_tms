
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Locations from './pages/Locations';
import Shipments from './pages/Shipments';
import ShipmentDetails from './pages/ShipmentDetails';
import './theme.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <BrowserRouter>
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/locations" element={<Locations />} />
        <Route path="/shipments" element={<Shipments />} />
        <Route path="/shipments/:id" element={<ShipmentDetails />} />
      </Routes>
    </Layout>
  </BrowserRouter>
);
