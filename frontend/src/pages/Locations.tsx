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
  archived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function Locations() {
  const [locations, setLocations] = React.useState<Location[]>([]);
  const [name, setName] = React.useState('');
  const [address1, setAddress1] = React.useState('');
  const [address2, setAddress2] = React.useState('');
  const [city, setCity] = React.useState('');
  const [state, setState] = React.useState('');
  const [postalCode, setPostalCode] = React.useState('');
  const [country, setCountry] = React.useState('');
  const [lat, setLat] = React.useState('');
  const [lng, setLng] = React.useState('');
  const [editingLocation, setEditingLocation] = React.useState<Location | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const loadLocations = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_URL + '/api/v1/locations');
      const result = await response.json();
      setLocations(result.data || []);
    } catch (error) {
      console.error('Failed to load locations:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadLocations();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const locationData = {
        name,
        address1,
        address2: address2 || undefined,
        city,
        state: state || undefined,
        postalCode: postalCode || undefined,
        country,
        lat: lat ? parseFloat(lat) : undefined,
        lng: lng ? parseFloat(lng) : undefined
      };

      if (editingLocation) {
        // Update existing location
        await fetch(API_URL + `/api/v1/locations/${editingLocation.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(locationData)
        });
        setEditingLocation(null);
      } else {
        // Create new location
        await fetch(API_URL + '/api/v1/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(locationData)
        });
      }
      clearForm();
      await loadLocations();
    } catch (error) {
      console.error('Failed to save location:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setName('');
    setAddress1('');
    setAddress2('');
    setCity('');
    setState('');
    setPostalCode('');
    setCountry('');
    setLat('');
    setLng('');
  };

  const editLocation = (location: Location) => {
    setEditingLocation(location);
    setName(location.name);
    setAddress1(location.address1);
    setAddress2(location.address2 || '');
    setCity(location.city);
    setState(location.state || '');
    setPostalCode(location.postalCode || '');
    setCountry(location.country);
    setLat(location.lat?.toString() || '');
    setLng(location.lng?.toString() || '');
  };

  const cancelEdit = () => {
    setEditingLocation(null);
    clearForm();
  };

  const deleteLocation = async (id: string) => {
    setLoading(true);
    try {
      await fetch(API_URL + `/api/v1/locations/${id}`, {
        method: 'DELETE'
      });
      await loadLocations();
    } catch (error) {
      console.error('Failed to delete location:', error);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(null);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>Locations</h2>
        <form onSubmit={submit} style={{ marginBottom: 'var(--spacing-2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)' }}>
            <div className="text-field">
              <input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder=" " 
                required 
                disabled={loading}
              />
              <label>Location Name</label>
            </div>
            <div className="text-field">
              <input 
                value={address1} 
                onChange={e => setAddress1(e.target.value)} 
                placeholder=" " 
                required 
                disabled={loading}
              />
              <label>Address Line 1</label>
            </div>
            <div className="text-field">
              <input 
                value={address2} 
                onChange={e => setAddress2(e.target.value)} 
                placeholder=" " 
                disabled={loading}
              />
              <label>Address Line 2</label>
            </div>
            <div className="text-field">
              <input 
                value={city} 
                onChange={e => setCity(e.target.value)} 
                placeholder=" " 
                required 
                disabled={loading}
              />
              <label>City</label>
            </div>
            <div className="text-field">
              <input 
                value={state} 
                onChange={e => setState(e.target.value)} 
                placeholder=" " 
                disabled={loading}
              />
              <label>State/Province</label>
            </div>
            <div className="text-field">
              <input 
                value={postalCode} 
                onChange={e => setPostalCode(e.target.value)} 
                placeholder=" " 
                disabled={loading}
              />
              <label>Postal Code</label>
            </div>
            <div className="text-field">
              <input 
                value={country} 
                onChange={e => setCountry(e.target.value)} 
                placeholder=" " 
                required 
                disabled={loading}
              />
              <label>Country</label>
            </div>
            <div className="text-field">
              <input 
                value={lat} 
                onChange={e => setLat(e.target.value)} 
                placeholder=" " 
                type="number"
                step="any"
                disabled={loading}
              />
              <label>Latitude</label>
            </div>
            <div className="text-field">
              <input 
                value={lng} 
                onChange={e => setLng(e.target.value)} 
                placeholder=" " 
                type="number"
                step="any"
                disabled={loading}
              />
              <label>Longitude</label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
            <button className="button" type="submit" disabled={loading}>
              <span className="material-icons" style={{ fontSize: '18px' }}>
                {editingLocation ? 'save' : 'add'}
              </span>
              {editingLocation ? 'Update' : 'Add'} Location
            </button>
            {editingLocation && (
              <button type="button" className="button outlined" onClick={cancelEdit} disabled={loading}>
                <span className="material-icons" style={{ fontSize: '18px' }}>cancel</span>
                Cancel
              </button>
            )}
          </div>
        </form>
        
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', marginBottom: 'var(--spacing-2)' }}>
            <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
            Loading...
          </div>
        )}
        
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>City</th>
                <th>State</th>
                <th>Country</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.map(l => (
                <tr key={l.id}>
                  <td>{l.name}</td>
                  <td>
                    <div>
                      <div>{l.address1}</div>
                      {l.address2 && <div style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>{l.address2}</div>}
                    </div>
                  </td>
                  <td>{l.city}</td>
                  <td>{l.state || '—'}</td>
                  <td>{l.country}</td>
                  <td>{new Date(l.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
                      <button 
                        className="icon-btn" 
                        onClick={() => editLocation(l)}
                        disabled={loading}
                        title="Edit location"
                      >
                        <span className="material-icons">edit</span>
                      </button>
                      <button 
                        className="icon-btn" 
                        onClick={() => setShowDeleteConfirm(l.id)}
                        disabled={loading}
                        title="Delete location"
                        style={{ color: 'var(--error)' }}
                      >
                        <span className="material-icons">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: '400px', margin: 'var(--spacing-2)' }}>
            <h3>Delete Location</h3>
            <p>Are you sure you want to delete this location? This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 'var(--spacing-1)', justifyContent: 'flex-end', marginTop: 'var(--spacing-2)' }}>
              <button 
                className="button outlined" 
                onClick={() => setShowDeleteConfirm(null)}
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                className="button" 
                onClick={() => deleteLocation(showDeleteConfirm)}
                disabled={loading}
                style={{ backgroundColor: 'var(--error)', color: 'var(--on-error)' }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>delete</span>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
