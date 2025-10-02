import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';
import CarrierCreationForm from '../components/CarrierCreationForm';

interface Carrier {
  id: string;
  name: string;
  mcNumber?: string;
  dotNumber?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  archived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function CreateCarrier() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [editingCarrier, setEditingCarrier] = React.useState<Carrier | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isEditing = Boolean(id);

  // Load carrier data for editing
  React.useEffect(() => {
    if (id) {
      loadCarrier(id);
    }
  }, [id]);

  const loadCarrier = async (carrierId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/v1/carriers/${carrierId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load carrier');
      }

      setEditingCarrier(data.data);
    } catch (error) {
      console.error('Failed to load carrier:', error);
      setError(error instanceof Error ? error.message : 'Failed to load carrier');
    } finally {
      setLoading(false);
    }
  };

  const handleCarrierCreated = (carrier: Carrier) => {
    navigate('/carriers');
  };

  const handleCarrierUpdated = (carrier: Carrier) => {
    navigate('/carriers');
  };

  const handleCancel = () => {
    navigate('/carriers');
  };

  if (loading) {
    return (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
          <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
          Loading carrier...
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
            onClick={() => navigate('/carriers')}
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
            Back to Carriers
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
            onClick={() => navigate('/carriers')}
            title="Back to carriers list"
          >
            <span className="material-icons">arrow_back</span>
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
              {isEditing ? 'Edit Carrier' : 'Create New Carrier'}
            </h1>
            {isEditing && editingCarrier && (
              <p style={{ margin: '4px 0 0 0', color: 'var(--on-surface-variant)', fontSize: '0.875rem' }}>
                {editingCarrier.name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Carrier Creation/Edit Form */}
      <CarrierCreationForm
        editingCarrier={editingCarrier}
        onCarrierCreated={handleCarrierCreated}
        onCarrierUpdated={handleCarrierUpdated}
        onCancel={handleCancel}
      />
    </div>
  );
}
