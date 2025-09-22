import React from 'react';
import { API_URL } from '../api';

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

interface Lane {
  id: string;
  name: string;
  originId: string;
  destinationId: string;
  origin: Location;
  destination: Location;
  distance?: number;
  notes?: string;
}

interface RouteSelectionProps {
  useLane: boolean;
  onUseLaneChange: (useLane: boolean) => void;
  laneId: string;
  onLaneChange: (laneId: string) => void;
  originId: string;
  onOriginChange: (originId: string) => void;
  destinationId: string;
  onDestinationChange: (destinationId: string) => void;
  disabled?: boolean;
}

export default function RouteSelection({
  useLane,
  onUseLaneChange,
  laneId,
  onLaneChange,
  originId,
  onOriginChange,
  destinationId,
  onDestinationChange,
  disabled = false
}: RouteSelectionProps) {
  const [lanes, setLanes] = React.useState<Lane[]>([]);
  const [locations, setLocations] = React.useState<Location[]>([]);
  const [loading, setLoading] = React.useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [lanesRes, locationsRes] = await Promise.all([
        fetch(API_URL + '/api/v1/lanes'),
        fetch(API_URL + '/api/v1/locations')
      ]);
      
      const [lanesData, locationsData] = await Promise.all([
        lanesRes.json(),
        locationsRes.json()
      ]);
      
      setLanes(lanesData.data || []);
      setLocations(locationsData.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  // When lane is selected, update origin and destination
  React.useEffect(() => {
    if (useLane && laneId) {
      const selectedLane = lanes.find(lane => lane.id === laneId);
      if (selectedLane) {
        onOriginChange(selectedLane.originId);
        onDestinationChange(selectedLane.destinationId);
      }
    }
  }, [laneId, lanes, useLane, onOriginChange, onDestinationChange]);

  // Handle checkbox change - clear lane when switching off
  const handleUseLaneChange = (checked: boolean) => {
    onUseLaneChange(checked);
    if (!checked) {
      onLaneChange(''); // Clear selected lane when switching off
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
      {/* Route Type Selection */}
      <div style={{ marginBottom: 'var(--spacing-1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
          <label className="switch">
            <input
              type="checkbox"
              checked={useLane}
              onChange={e => handleUseLaneChange(e.target.checked)}
              disabled={disabled}
            />
            <span className="slider"></span>
          </label>
          <span>Use Lane</span>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
          <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
          Loading...
        </div>
      )}

      {useLane ? (
        <div className="text-field">
          <select
            value={laneId}
            onChange={e => onLaneChange(e.target.value)}
            required
            disabled={disabled || loading}
          >
            <option value="">Select lane</option>
            {lanes.map(lane => (
              <option key={lane.id} value={lane.id}>
                {lane.name} ({lane.origin.city} → {lane.destination.city})
              </option>
            ))}
          </select>
          <label>Lane</label>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-2)' }}>
          <div className="text-field">
            <select
              value={originId}
              onChange={e => onOriginChange(e.target.value)}
              required
              disabled={disabled || loading}
            >
              <option value="">Select origin</option>
              {locations.map(location => (
                <option key={location.id} value={location.id}>
                  {location.name} - {location.city}
                </option>
              ))}
            </select>
            <label>Origin</label>
          </div>
          <div className="text-field">
            <select
              value={destinationId}
              onChange={e => onDestinationChange(e.target.value)}
              required
              disabled={disabled || loading}
            >
              <option value="">Select destination</option>
              {locations.map(location => (
                <option key={location.id} value={location.id}>
                  {location.name} - {location.city}
                </option>
              ))}
            </select>
            <label>Destination</label>
          </div>
        </div>
      )}

      {/* Show selected route info */}
      {useLane && laneId && (
        <div style={{ 
          padding: 'var(--spacing-2)', 
          backgroundColor: 'var(--surface-variant)', 
          borderRadius: 'var(--border-radius)',
          fontSize: '0.9em'
        }}>
          <strong>Selected Lane:</strong> {lanes.find(l => l.id === laneId)?.name}
          <br />
          <strong>Route:</strong> {lanes.find(l => l.id === laneId)?.origin.city} → {lanes.find(l => l.id === laneId)?.destination.city}
          {lanes.find(l => l.id === laneId)?.distance && (
            <>
              <br />
              <strong>Distance:</strong> {Math.round(lanes.find(l => l.id === laneId)!.distance!)} km
            </>
          )}
        </div>
      )}

      {!useLane && originId && destinationId && (
        <div style={{ 
          padding: 'var(--spacing-2)', 
          backgroundColor: 'var(--surface-variant)', 
          borderRadius: 'var(--border-radius)',
          fontSize: '0.9em'
        }}>
          <strong>Selected Route:</strong> {locations.find(l => l.id === originId)?.city} → {locations.find(l => l.id === destinationId)?.city}
        </div>
      )}
    </div>
  );
}
