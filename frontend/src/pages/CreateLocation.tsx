import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';
import LocationCreationForm from '../components/LocationCreationForm';

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
  archived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function CreateLocation() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [editingLocation, setEditingLocation] = React.useState<Location | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isEditing = Boolean(id);

  // Load location data for editing
  React.useEffect(() => {
    if (id) {
      loadLocation(id);
    }
  }, [id]);

  const loadLocation = async (locationId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/v1/locations/${locationId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load location');
      }

      setEditingLocation(data.data);
    } catch (error) {
      console.error('Failed to load location:', error);
      setError(error instanceof Error ? error.message : 'Failed to load location');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationCreated = (location: Location) => {
    navigate('/locations');
  };

  const handleLocationUpdated = (location: Location) => {
    navigate('/locations');
  };

  const handleCancel = () => {
    navigate('/locations');
  };

  if (loading) {
    return (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
          <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
          Loading location...
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
            onClick={() => navigate('/locations')}
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
            Back to Locations
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
            onClick={() => navigate('/locations')}
            title="Back to locations list"
          >
            <span className="material-icons">arrow_back</span>
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
              {isEditing ? 'Edit Location' : 'Create New Location'}
            </h1>
            {isEditing && editingLocation && (
              <p style={{ margin: '4px 0 0 0', color: 'var(--on-surface-variant)', fontSize: '0.875rem' }}>
                {editingLocation.name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Location Creation/Edit Form */}
      <LocationCreationForm
        editingLocation={editingLocation}
        onLocationCreated={handleLocationCreated}
        onLocationUpdated={handleLocationUpdated}
        onCancel={handleCancel}
      />
    </div>
  );
}