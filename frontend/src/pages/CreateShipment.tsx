import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';
import ShipmentCreationForm from '../components/ShipmentCreationForm';

interface Customer {
  id: string;
  name: string;
  contactEmail?: string;
}

interface Location {
  id: string;
  name: string;
  city: string;
  country: string;
}

interface Shipment {
  id: string;
  reference: string;
  status: string;
  pickupDate?: string;
  deliveryDate?: string;
  items?: any[];
  customer?: Customer;
  origin?: Location;
  destination?: Location;
  lane?: {
    id: string;
    name: string;
    origin: Location;
    destination: Location;
  };
  customerId: string;
  laneId?: string;
  originId: string;
  destinationId: string;
  archived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function CreateShipment() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [editingShipment, setEditingShipment] = React.useState<Shipment | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isEditing = Boolean(id);

  // Load shipment data for editing
  React.useEffect(() => {
    if (id) {
      loadShipment(id);
    }
  }, [id]);

  const loadShipment = async (shipmentId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/v1/shipments/${shipmentId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load shipment');
      }

      setEditingShipment(data.data);
    } catch (error) {
      console.error('Failed to load shipment:', error);
      setError(error instanceof Error ? error.message : 'Failed to load shipment');
    } finally {
      setLoading(false);
    }
  };

  const handleShipmentCreated = (shipment: Shipment) => {
    navigate('/shipments');
  };

  const handleShipmentUpdated = (shipment: Shipment) => {
    navigate('/shipments');
  };

  const handleCancel = () => {
    navigate('/shipments');
  };

  if (loading) {
    return (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
          <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
          Loading shipment...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div style={{
          backgroundColor: 'var(--error-container)',
          color: 'var(--on-error-container)',
          padding: 'var(--spacing-2)',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-1)'
        }}>
          <span className="material-icons">error</span>
          {error}
          <button
            onClick={() => navigate('/shipments')}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }}
          >
            Back to Shipments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with Back Button */}
      <div className="card" style={{ marginBottom: 'var(--spacing-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
          <button
            className="icon-btn"
            onClick={() => navigate('/shipments')}
            title="Back to shipments list"
          >
            <span className="material-icons">arrow_back</span>
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
              {isEditing ? 'Edit Shipment' : 'Create New Shipment'}
            </h1>
            {isEditing && editingShipment && (
              <p style={{ margin: '4px 0 0 0', color: 'var(--on-surface-variant)', fontSize: '0.875rem' }}>
                {editingShipment.reference}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Shipment Creation/Edit Form */}
      <ShipmentCreationForm
        editingShipment={editingShipment}
        onShipmentCreated={handleShipmentCreated}
        onShipmentUpdated={handleShipmentUpdated}
        onCancel={handleCancel}
      />
    </div>
  );
}