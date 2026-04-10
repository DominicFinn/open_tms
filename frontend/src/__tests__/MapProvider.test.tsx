import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MapProvider, useMapProvider } from '../MapProvider';

function MapConsumer() {
  const { provider, isLoaded, apiKey } = useMapProvider();
  return (
    <div>
      <span data-testid="provider">{provider}</span>
      <span data-testid="is-loaded">{String(isLoaded)}</span>
      <span data-testid="api-key">{apiKey || 'none'}</span>
    </div>
  );
}

describe('MapProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({ data: { apiKey: null } }),
    });

    await act(async () => {
      render(
        <MapProvider>
          <div data-testid="child">Maps</div>
        </MapProvider>
      );
    });

    expect(screen.getByTestId('child')).toHaveTextContent('Maps');
  });

  it('falls back to OSM when no API key is returned', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({ data: { apiKey: null } }),
    });

    await act(async () => {
      render(
        <MapProvider>
          <MapConsumer />
        </MapProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('provider')).toHaveTextContent('osm');
      expect(screen.getByTestId('is-loaded')).toHaveTextContent('true');
      expect(screen.getByTestId('api-key')).toHaveTextContent('none');
    });
  });

  it('falls back to OSM when fetch fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    await act(async () => {
      render(
        <MapProvider>
          <MapConsumer />
        </MapProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('provider')).toHaveTextContent('osm');
      expect(screen.getByTestId('is-loaded')).toHaveTextContent('true');
    });
  });
});
