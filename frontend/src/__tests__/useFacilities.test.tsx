/**
 * Phase 2a batch 5b (#234): the WMS warehouse picker.
 *
 * Nineteen pages used to fetch /api/v1/locations and filter it down to warehouse-ish location
 * types. A Facility is a warehouse by definition, so the hook fetches /api/v1/facilities and the
 * filter is gone.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useFacilities } from '../hooks/useFacilities';

function Consumer() {
  const { facilities, facilityId, facility, loading, error } = useFacilities();
  return (
    <div>
      <span data-testid="count">{facilities.length}</span>
      <span data-testid="selected">{facilityId || 'none'}</span>
      <span data-testid="source-location">{facility?.sourceLocationId || 'none'}</span>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error || 'none'}</span>
    </div>
  );
}

const LEEDS = { id: 'fac-1', name: 'Leeds DC', code: 'LDS', sourceLocationId: 'loc-1' };
const HULL = { id: 'fac-2', name: 'Hull DC', code: null, sourceLocationId: 'loc-2' };

describe('useFacilities', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches facilities, not locations', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ data: [LEEDS], error: null }),
    });

    render(<Consumer />);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    const url = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toContain('/api/v1/facilities');
    expect(url).not.toContain('/api/v1/locations');
  });

  it('selects the first facility so a page has something to show', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ data: [LEEDS, HULL], error: null }),
    });

    render(<Consumer />);
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'));
    expect(screen.getByTestId('selected')).toHaveTextContent('fac-1');
  });

  it('exposes the selected facility so a create can still send its source location', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ data: [LEEDS], error: null }),
    });

    render(<Consumer />);
    await waitFor(() => expect(screen.getByTestId('source-location')).toHaveTextContent('loc-1'));
  });

  it('settles with no selection when the org has no facilities', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ data: [], error: null }),
    });

    render(<Consumer />);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('selected')).toHaveTextContent('none');
    expect(screen.getByTestId('error')).toHaveTextContent('none');
  });

  it('reports a failed fetch rather than looking like an empty org', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network'));

    render(<Consumer />);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('error')).toHaveTextContent('Could not load facilities');
  });
});
