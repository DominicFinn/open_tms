import React from 'react';
import { API_URL } from '../api';

interface Customer {
  id: string;
  name: string;
  contactEmail?: string;
  archived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function Customers() {
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [editingCustomer, setEditingCustomer] = React.useState<Customer | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_URL + '/api/v1/customers');
      const result = await response.json();
      setCustomers(result.data || []);
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadCustomers();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingCustomer) {
        // Update existing customer
        await fetch(API_URL + `/api/v1/customers/${editingCustomer.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, contactEmail: email })
        });
        setEditingCustomer(null);
      } else {
        // Create new customer
        await fetch(API_URL + '/api/v1/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, contactEmail: email })
        });
      }
      setName('');
      setEmail('');
      await loadCustomers();
    } catch (error) {
      console.error('Failed to save customer:', error);
    } finally {
      setLoading(false);
    }
  };

  const editCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setName(customer.name);
    setEmail(customer.contactEmail || '');
  };

  const cancelEdit = () => {
    setEditingCustomer(null);
    setName('');
    setEmail('');
  };

  const deleteCustomer = async (id: string) => {
    setLoading(true);
    try {
      await fetch(API_URL + `/api/v1/customers/${id}`, {
        method: 'DELETE'
      });
      await loadCustomers();
    } catch (error) {
      console.error('Failed to delete customer:', error);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(null);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>Customers</h2>
        <form onSubmit={submit} style={{ marginBottom: 'var(--spacing-2)', display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap', alignItems: 'end' }}>
          <div className="text-field" style={{ flex: '1', minWidth: '200px' }}>
            <input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder=" " 
              required 
              disabled={loading}
            />
            <label>Customer Name</label>
          </div>
          <div className="text-field" style={{ flex: '1', minWidth: '200px' }}>
            <input 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder=" " 
              type="email" 
              disabled={loading}
            />
            <label>Email Address</label>
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
            <button className="button" type="submit" disabled={loading}>
              <span className="material-icons" style={{ fontSize: '18px' }}>
                {editingCustomer ? 'save' : 'add'}
              </span>
              {editingCustomer ? 'Update' : 'Add'} Customer
            </button>
            {editingCustomer && (
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
                <th>Email</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.contactEmail || '—'}</td>
                  <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
                      <button 
                        className="icon-btn" 
                        onClick={() => editCustomer(c)}
                        disabled={loading}
                        title="Edit customer"
                      >
                        <span className="material-icons">edit</span>
                      </button>
                      <button 
                        className="icon-btn" 
                        onClick={() => setShowDeleteConfirm(c.id)}
                        disabled={loading}
                        title="Delete customer"
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
            <h3>Delete Customer</h3>
            <p>Are you sure you want to delete this customer? This action cannot be undone.</p>
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
                onClick={() => deleteCustomer(showDeleteConfirm)}
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
