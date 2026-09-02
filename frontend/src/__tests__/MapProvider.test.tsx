import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MapProvider, useMapProvider } from '../MapProvider';

function MapConsumer() {
  const { provider, capabilities, isLoaded, apiKey } = useMapProvider();
  return (
    <div>
      <span data-testid="provider">{provider}</span>
      <span data-testid="is-loaded">{String(isLoaded)}</span>
      <span data-testid="api-key">{apiKey || 'none'}</span>
      <span data-testid="route-planning">{String(capabilities.routePlanning)}</span>
      <span data-testid="autocomplete">{String(capabilities.addressAutocomplete)}</span>
    </div>
  );
}

describe('MapProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
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
    // `ok: true` matters: without it the provider takes the catch path and the test would pass
    // for the wrong reason, which is what it did before.
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
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

  it('offers address search but not route planning in OSM mode', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
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
      // Nominatim covers search without a key. Route planning needs a live directions service.
      expect(screen.getByTestId('autocomplete')).toHaveTextContent('true');
      expect(screen.getByTestId('route-planning')).toHaveTextContent('false');
    });
  });

  it('enters Google mode and unlocks route planning once the script loads', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: { apiKey: 'test-key' } }),
    });

    // The provider injects a <script> and waits for onload; drive that by hand.
    const appendChild = jest
      .spyOn(document.head, 'appendChild')
      .mockImplementation((node: any) => {
        setTimeout(() => node.onload?.(), 0);
        return node;
      });

    await act(async () => {
      render(
        <MapProvider>
          <MapConsumer />
        </MapProvider>
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('provider')).toHaveTextContent('google');
      expect(screen.getByTestId('route-planning')).toHaveTextContent('true');
      expect(screen.getByTestId('api-key')).toHaveTextContent('test-key');
    });

    appendChild.mockRestore();
  });
});
