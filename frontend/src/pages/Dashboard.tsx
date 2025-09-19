import React from 'react';

export default function Dashboard() {
  return (
    <div>
      <div className="card">
        <h2>Welcome to Open TMS</h2>
        <p>The lightweight open source Transport Management System.</p>
        <p>Select an option from the sidebar to get started.</p>
        
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--spacing-3)' }}>
        <div className="card">
          <div className="card-title">
            <span className="material-icons" style={{ marginRight: '8px', verticalAlign: 'middle' }}>people</span>
            Customers
          </div>
          <div className="card-content">
            Manage your customer database and contact information.
          </div>
        </div>
        
        <div className="card">
          <div className="card-title">
            <span className="material-icons" style={{ marginRight: '8px', verticalAlign: 'middle' }}>location_on</span>
            Locations
          </div>
          <div className="card-content">
            Set up pickup and delivery locations for your shipments.
          </div>
        </div>
        
        <div className="card">
          <div className="card-title">
            <span className="material-icons" style={{ marginRight: '8px', verticalAlign: 'middle' }}>local_shipping</span>
            Shipments
          </div>
          <div className="card-content">
            Track and manage your transportation shipments.
          </div>
        </div>
      </div>
    </div>
  );
}
