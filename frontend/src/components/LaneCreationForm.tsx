import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';
import LocationSearch from './LocationSearch';
import LocationMap from './LocationMap';

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
  customerLanes: CustomerLane[];
  laneCarriers: LaneCarrier[];
}

interface LaneCreationFormProps {
  onLaneCreated?: (lane: Lane) => void;
  onLaneUpdated?: (lane: Lane) => void;
  editingLane?: Lane | null;
  onCancel?: () => void;
}

export default function LaneCreationForm({
  onLaneCreated,
  onLaneUpdated,
  editingLane,
  onCancel
}: LaneCreationFormProps) {
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [origin, setOrigin] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [distance, setDistance] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when editing
  useEffect(() => {
    if (editingLane) {
      setOriginId(editingLane.origin.id);
      setDestinationId(editingLane.destination.id);
      setOrigin(editingLane.origin);
      setDestination(editingLane.destination);
      setDistance(editingLane.distance || 0);
      setNotes(editingLane.notes || '');
    } else {
      clearForm();
    }
  }, [editingLane]);

  const clearForm = () => {
    setOriginId('');
    setDestinationId('');
    setOrigin(null);
    setDestination(null);
    setDistance(0);
    setNotes('');
    setError(null);
  };

  const handleOriginSelect = (location: Location) => {
    setOrigin(location);
    setError(null);
  };

  const handleDestinationSelect = (location: Location) => {
    setDestination(location);
    setError(null);
  };

  const handleDistanceCalculated = (calculatedDistance: number) => {
    setDistance(calculatedDistance);
  };

  const validateForm = () => {
    if (!originId || !destinationId) {
      setError('Please select both origin and destination locations');
      return false;
    }
    if (originId === destinationId) {
      setError('Origin and destination must be different locations');
      return false;
    }
    // Note: We don't require coordinates - distance calculation is optional
    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const laneData = {
        originId,
        destinationId,
        distance: distance > 0 ? distance : undefined,
        notes: notes || undefined
      };

      const url = editingLane 
        ? `${API_URL}/api/v1/lanes/${editingLane.id}`
        : `${API_URL}/api/v1/lanes`;
      
      const method = editingLane ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(laneData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save lane');
      }

      const result = await response.json();
      const savedLane = result.data;

      if (editingLane && onLaneUpdated) {
        onLaneUpdated(savedLane);
        // Don't clear form for updates - let the parent handle closing
      } else if (onLaneCreated) {
        onLaneCreated(savedLane);
        clearForm();
      }
    } catch (error) {
      console.error('Failed to save lane:', error);
      setError(error instanceof Error ? error.message : 'Failed to save lane');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    clearForm();
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="card">
      <h2>{editingLane ? 'Edit Lane' : 'Create New Lane'}</h2>
      
      <form onSubmit={submit} style={{ marginBottom: 'var(--spacing-2)' }}>
        {/* Location Selection */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: 'var(--spacing-2)', 
          marginBottom: 'var(--spacing-2)' 
        }}>
          <LocationSearch
            value={originId}
            onChange={setOriginId}
            placeholder="Search for origin location..."
            label="Origin Location"
            disabled={loading}
            onLocationSelect={handleOriginSelect}
          />
          <LocationSearch
            value={destinationId}
            onChange={setDestinationId}
            placeholder="Search for destination location..."
            label="Destination Location"
            disabled={loading}
            onLocationSelect={handleDestinationSelect}
          />
        </div>

        {/* Map Visualization */}
        {(origin || destination) && (
          <div style={{ marginBottom: 'var(--spacing-2)' }}>
            <h3 style={{ marginBottom: 'var(--spacing-1)', fontSize: '1.1rem' }}>
              Route Visualization
            </h3>
            <LocationMap
              origin={origin}
              destination={destination}
              onDistanceCalculated={handleDistanceCalculated}
              height="300px"
            />
          </div>
        )}

        {/* Distance and Notes */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '200px 1fr', 
          gap: 'var(--spacing-2)', 
          marginBottom: 'var(--spacing-2)' 
        }}>
          <div className="text-field">
            <input 
              value={distance > 0 ? distance.toFixed(1) : ''} 
              onChange={e => setDistance(parseFloat(e.target.value) || 0)} 
              placeholder=" " 
              type="number"
              step="0.1"
              disabled={loading}
            />
            <label>Distance (km)</label>
          </div>
          <div className="text-field">
            <input 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder=" " 
              disabled={loading}
            />
            <label>Notes (optional)</label>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            backgroundColor: 'var(--error-container)',
            color: 'var(--on-error-container)',
            padding: 'var(--spacing-1)',
            borderRadius: '4px',
            marginBottom: 'var(--spacing-2)',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
          <button 
            className="button" 
            type="submit" 
            disabled={loading || !originId || !destinationId}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>
              {editingLane ? 'save' : 'add'}
            </span>
            {loading ? 'Saving...' : (editingLane ? 'Update Lane' : 'Create Lane')}
          </button>
          
          <button 
            type="button" 
            className="button outlined" 
            onClick={handleCancel}
            disabled={loading}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>cancel</span>
            Cancel
          </button>
        </div>
      </form>

      {/* Help Text */}
      <div style={{
        backgroundColor: 'var(--surface-variant)',
        padding: 'var(--spacing-2)',
        borderRadius: '4px',
        fontSize: '0.875rem',
        color: 'var(--on-surface-variant)'
      }}>
        <h4 style={{ margin: '0 0 var(--spacing-1) 0', fontSize: '0.875rem' }}>
          💡 Tips for creating lanes:
        </h4>
        <ul style={{ margin: 0, paddingLeft: 'var(--spacing-2)' }}>
          <li>Search for locations by name, city, state, or address</li>
          <li>Distance is automatically calculated when both locations have coordinates</li>
          <li>You can manually adjust the distance if needed</li>
          <li>Add notes to provide additional context about the lane</li>
        </ul>
      </div>
    </div>
  );
}
