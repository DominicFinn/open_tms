import React, { useState, useEffect } from 'react';
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

interface CustomerCreationFormProps {
  onCustomerCreated?: (customer: Customer) => void;
  onCustomerUpdated?: (customer: Customer) => void;
  editingCustomer?: Customer | null;
  onCancel?: () => void;
}

export default function CustomerCreationForm({
  onCustomerCreated,
  onCustomerUpdated,
  editingCustomer,
  onCancel
}: CustomerCreationFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when editing
  useEffect(() => {
    if (editingCustomer) {
      setName(editingCustomer.name);
      setEmail(editingCustomer.contactEmail || '');
    } else {
      clearForm();
    }
  }, [editingCustomer]);

  const clearForm = () => {
    setName('');
    setEmail('');
    setError(null);
  };

  const validateForm = () => {
    if (!name.trim()) {
      setError('Please enter a customer name');
      return false;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }

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
      const customerData = {
        name: name.trim(),
        contactEmail: email.trim() || undefined
      };

      const url = editingCustomer
        ? `${API_URL}/api/v1/customers/${editingCustomer.id}`
        : `${API_URL}/api/v1/customers`;

      const method = editingCustomer ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save customer');
      }

      const result = await response.json();
      const savedCustomer = result.data;

      if (editingCustomer && onCustomerUpdated) {
        onCustomerUpdated(savedCustomer);
        // Don't clear form for updates - let the parent handle closing
      } else if (onCustomerCreated) {
        onCustomerCreated(savedCustomer);
        clearForm();
      }
    } catch (error) {
      console.error('Failed to save customer:', error);
      setError(error instanceof Error ? error.message : 'Failed to save customer');
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
      <h2>{editingCustomer ? 'Edit Customer' : 'Create New Customer'}</h2>

      <form onSubmit={submit} style={{ marginBottom: 'var(--spacing-2)' }}>
        {/* Customer Information */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--spacing-2)',
          marginBottom: 'var(--spacing-2)'
        }}>
          <div className="text-field">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder=" "
              required
              disabled={loading}
            />
            <label>Customer Name</label>
          </div>
          <div className="text-field">
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder=" "
              type="email"
              disabled={loading}
            />
            <label>Email Address (optional)</label>
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
            disabled={loading || !name.trim()}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>
              {editingCustomer ? 'save' : 'add'}
            </span>
            {loading ? 'Saving...' : (editingCustomer ? 'Update Customer' : 'Create Customer')}
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
          💡 Tips for adding customers:
        </h4>
        <ul style={{ margin: 0, paddingLeft: 'var(--spacing-2)' }}>
          <li>Customer name is required and should be unique</li>
          <li>Email address is optional but helpful for notifications</li>
          <li>You can edit customer details anytime from the customers list</li>
        </ul>
      </div>
    </div>
  );
}