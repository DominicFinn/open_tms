import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';
import LaneCreationForm from '../components/LaneCreationForm';

interface Location {
  id: string;
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  lat?: number;
  lng?: number;
}

interface Customer {
  id: string;
  name: string;
  contactEmail?: string;
}

interface Carrier {
  id: string;
  name: string;
  mcNumber?: string;
  dotNumber?: string;
}

interface LaneCarrier {
  id: string;
  price?: number;
  currency: string;
  serviceLevel?: string;
  notes?: string;
  carrier: Carrier;
}

interface CustomerLane {
  id: string;
  customer: Customer;
}

interface LaneStop {
  id: string;
  laneId: string;
  locationId: string;
  order: number;
  notes?: string;
  location: Location;
}

interface Lane {
  id: string;
  name: string;
  origin: Location;
  destination: Location;
  distance?: number;
  notes?: string;
  status: string;
  archived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
  stops: LaneStop[];
  customerLanes: CustomerLane[];
  laneCarriers: LaneCarrier[];
}

export default function CreateLane() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [editingLane, setEditingLane] = React.useState<Lane | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isEditing = Boolean(id);

  // Load lane data for editing
  React.useEffect(() => {
    if (id) {
      loadLane(id);
    }
  }, [id]);

  const loadLane = async (laneId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/v1/lanes/${laneId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load lane');
      }

      setEditingLane(data.data);
    } catch (error) {
      console.error('Failed to load lane:', error);
      setError(error instanceof Error ? error.message : 'Failed to load lane');
    } finally {
      setLoading(false);
    }
  };

  const handleLaneCreated = (lane: Lane) => {
    navigate('/lanes');
  };

  const handleLaneUpdated = (lane: Lane) => {
    navigate('/lanes');
  };

  const handleCancel = () => {
    navigate('/lanes');
  };

  if (loading) {
    return (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
          <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
          Loading lane...
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
            onClick={() => navigate('/lanes')}
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
            Back to Lanes
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
            onClick={() => navigate('/lanes')}
            title="Back to lanes list"
          >
            <span className="material-icons">arrow_back</span>
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
              {isEditing ? 'Edit Lane' : 'Create New Lane'}
            </h1>
            {isEditing && editingLane && (
              <p style={{ margin: '4px 0 0 0', color: 'var(--on-surface-variant)', fontSize: '0.875rem' }}>
                {editingLane.name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Lane Creation/Edit Form */}
      <LaneCreationForm
        editingLane={editingLane}
        onLaneCreated={handleLaneCreated}
        onLaneUpdated={handleLaneUpdated}
        onCancel={handleCancel}
      />
    </div>
  );
}