import React from 'react';
import { useNavigate } from 'react-router-dom';
import OrderCreationForm from '../components/OrderCreationForm';

export default function CreateOrder() {
  const navigate = useNavigate();

  const handleOrderCreated = (order: any) => {
    console.log('Order created:', order);
    navigate('/orders');
  };

  const handleCancel = () => {
    navigate('/orders');
  };

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
          <h2>Create New Order</h2>
        </div>

        <OrderCreationForm
          onOrderCreated={handleOrderCreated}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
