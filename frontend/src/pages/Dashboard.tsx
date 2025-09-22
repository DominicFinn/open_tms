import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();

  const handleCardClick = (path: string) => {
    navigate(path);
  };

  return (
    <div>
      <div className="card">
        <h2>Welcome to Open TMS</h2>
        <p>The lightweight open source Transport Management System.</p>
        <p>Click on any card below to get started, or use the sidebar navigation.</p>
        <h3>Help needed</h3>
        <p>If you are interested in this project please feel free to contribute, ideally with feature requests, bug reports, or documentation improvements.</p>
        <p>You can find the project on GitHub at <a href="https://github.com/DominicFinn/open_tms" target="_blank" rel="noopener noreferrer">https://github.com/DominicFinn/open_tms</a></p>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--spacing-3)' }}>
        <div 
          className="card" 
          style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
          onClick={() => handleCardClick('/customers')}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow-2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-1)';
          }}
        >
          <div className="card-title">
            <span className="material-icons" style={{ marginRight: '8px', verticalAlign: 'middle' }}>people</span>
            Customers
          </div>
          <div className="card-content">
            Manage your customer database and contact information.
          </div>
        </div>
        
        <div 
          className="card" 
          style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
          onClick={() => handleCardClick('/locations')}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow-2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-1)';
          }}
        >
          <div className="card-title">
            <span className="material-icons" style={{ marginRight: '8px', verticalAlign: 'middle' }}>location_on</span>
            Locations
          </div>
          <div className="card-content">
            Set up pickup and delivery locations for your shipments.
          </div>
        </div>
        
        <div 
          className="card" 
          style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
          onClick={() => handleCardClick('/lanes')}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow-2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-1)';
          }}
        >
          <div className="card-title">
            <span className="material-icons" style={{ marginRight: '8px', verticalAlign: 'middle' }}>route</span>
            Lanes
          </div>
          <div className="card-content">
            Define commercial corridors between locations for customer contracts.
          </div>
        </div>
        
        <div 
          className="card" 
          style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
          onClick={() => handleCardClick('/shipments')}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow-2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-1)';
          }}
        >
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
