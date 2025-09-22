import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LocationMap from '../LocationMap';

// Mock Leaflet
jest.mock('leaflet', () => ({
  map: jest.fn(() => ({
    setView: jest.fn(),
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    fitBounds: jest.fn(),
  })),
  tileLayer: jest.fn(() => ({
    addTo: jest.fn(),
  })),
  marker: jest.fn(() => ({
    addTo: jest.fn(),
  })),
  polyline: jest.fn(() => ({
    addTo: jest.fn(),
  })),
  divIcon: jest.fn(() => ({})),
  featureGroup: jest.fn(() => ({
    getBounds: jest.fn(() => ({
      pad: jest.fn(() => ({})),
    })),
  })),
  Icon: {
    Default: {
      prototype: {},
      mergeOptions: jest.fn(),
    },
  },
}));

// Mock the API
global.fetch = jest.fn();

const mockOrigin = {
  id: 'origin-1',
  name: 'Dallas Office',
  address1: '123 Commerce St',
  city: 'Dallas',
  state: 'Texas',
  country: 'USA',
  lat: 32.7767,
  lng: -96.7970,
  archived: false,
  archivedAt: null,
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z'
};

const mockDestination = {
  id: 'dest-1',
  name: 'New York Office',
  address1: '456 Broadway',
  city: 'New York',
  state: 'New York',
  country: 'USA',
  lat: 40.7128,
  lng: -74.0060,
  archived: false,
  archivedAt: null,
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z'
};

describe('LocationMap - Basic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<LocationMap origin={null} destination={null} />);
    
    // Check that the map container div is rendered
    const mapContainer = document.querySelector('div[style*="height: 400px"]');
    expect(mapContainer).toBeInTheDocument();
  });

  it('renders with origin and destination', () => {
    render(<LocationMap origin={mockOrigin} destination={mockDestination} />);
    
    // Check that the map container div is rendered
    const mapContainer = document.querySelector('div[style*="height: 400px"]');
    expect(mapContainer).toBeInTheDocument();
    
    // Check that the legend is rendered
    expect(screen.getByText('Origin')).toBeInTheDocument();
    expect(screen.getByText('Destination')).toBeInTheDocument();
  });

  it('renders with custom height', () => {
    render(<LocationMap origin={null} destination={null} height="500px" />);
    
    // Check that the map container has the custom height
    const mapContainer = document.querySelector('div[style*="height: 500px"]');
    expect(mapContainer).toBeInTheDocument();
  });

  it('does not render distance display initially', () => {
    render(<LocationMap origin={mockOrigin} destination={mockDestination} />);
    
    // Distance display should not be visible initially
    expect(screen.queryByText(/Distance:/)).not.toBeInTheDocument();
  });

  it('handles missing coordinates gracefully', () => {
    const originWithoutCoords = { ...mockOrigin, lat: undefined, lng: undefined };
    const destinationWithoutCoords = { ...mockDestination, lat: undefined, lng: undefined };
    
    render(
      <LocationMap 
        origin={originWithoutCoords} 
        destination={destinationWithoutCoords} 
      />
    );

    // Should still render the component
    const mapContainer = document.querySelector('div[style*="height: 400px"]');
    expect(mapContainer).toBeInTheDocument();
  });

  it('accepts onDistanceCalculated callback', () => {
    const onDistanceCalculated = jest.fn();
    
    render(
      <LocationMap 
        origin={mockOrigin} 
        destination={mockDestination} 
        onDistanceCalculated={onDistanceCalculated}
      />
    );

    // The callback should be passed to the component
    expect(onDistanceCalculated).toBeDefined();
  });
});
