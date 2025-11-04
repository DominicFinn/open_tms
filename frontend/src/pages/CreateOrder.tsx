import React from 'react';
import { useNavigate } from 'react-router-dom';
import OrderCreationFormWithUnits from '../components/OrderCreationFormWithUnits';

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
          <div style={{ fontSize: '14px', color: 'var(--color-grey)' }}>
            Orders are organized into trackable units
          </div>
        </div>

        <OrderCreationFormWithUnits
          onOrderCreated={handleOrderCreated}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
