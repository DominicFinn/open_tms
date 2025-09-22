import '@testing-library/jest-dom';

// Mock fetch globally
global.fetch = jest.fn();

// Mock Vite environment variables
Object.defineProperty(global, 'import', {
  value: {
    meta: {
      env: {
        VITE_API_URL: 'http://localhost:3001'
      }
    }
  }
});

// Mock API module
jest.mock('../api', () => ({
  API_URL: 'http://localhost:3001'
}));

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
