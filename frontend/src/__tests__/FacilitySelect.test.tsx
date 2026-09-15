/**
 * The picker's placeholder has to distinguish "this org has no warehouses" from "the fetch
 * failed" (#234). Both leave every WMS page empty, and they need different responses.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FacilitySelect } from '../components/FacilitySelect';

const LEEDS = { id: 'fac-1', name: 'Leeds DC', code: 'LDS', sourceLocationId: 'loc-1' };
const HULL = { id: 'fac-2', name: 'Hull DC', code: null, sourceLocationId: 'loc-2' };

describe('FacilitySelect', () => {
  it('says so when the org has no facilities', () => {
    render(<FacilitySelect facilities={[]} value="" onChange={() => {}} />);
    expect(screen.getByText('No facilities')).toBeInTheDocument();
  });

  it('distinguishes a failed fetch from an empty org', () => {
    render(<FacilitySelect facilities={[]} value="" onChange={() => {}} error="Could not load facilities" />);
    expect(screen.getByText('Could not load facilities')).toBeInTheDocument();
    expect(screen.queryByText('No facilities')).not.toBeInTheDocument();
  });

  it('shows a loading placeholder while the fetch is in flight', () => {
    render(<FacilitySelect facilities={[]} value="" onChange={() => {}} loading />);
    expect(screen.getByText('Loading facilities...')).toBeInTheDocument();
  });

  it('shows the selected facility, with its code only when it has one', () => {
    const { rerender } = render(<FacilitySelect facilities={[LEEDS, HULL]} value="fac-1" onChange={() => {}} />);
    expect(screen.getByText('Leeds DC (LDS)')).toBeInTheDocument();

    rerender(<FacilitySelect facilities={[LEEDS, HULL]} value="fac-2" onChange={() => {}} />);
    expect(screen.getByText('Hull DC')).toBeInTheDocument();
  });
});
