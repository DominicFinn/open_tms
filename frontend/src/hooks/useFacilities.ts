/**
 * The warehouses this organisation operates (#234).
 *
 * Phase 2a moved WMS off the conflated core `Location` and onto its own `Facility`. Every WMS page
 * used to fetch `/api/v1/locations` itself and filter the result down to warehouse-ish location
 * types; a Facility is a warehouse by definition, so that filter is gone, and the endpoint already
 * excludes archived ones.
 */

import { useState, useEffect } from 'react';
import { API_URL } from '../api';

export interface Facility {
  id: string;
  name: string;
  code: string | null;
  /**
   * The core Location this facility was derived from, or null in a WMS-only install.
   *
   * Reads go by `facilityId`, but the create commands still write a non-null `locationId` on the
   * row, so a page that both lists and creates sends this on the create. It goes when batch 6
   * makes `locationId` nullable and moves the commands onto `facilityId`.
   */
  sourceLocationId: string | null;
}

/** Matches MAX_PER_PAGE on the endpoint. An org with more warehouses than this needs a search box. */
const PER_PAGE = 100;

export interface UseFacilitiesResult {
  facilities: Facility[];
  /** The facility whose data the page should show. Defaults to the first one. */
  facilityId: string;
  setFacilityId: (id: string) => void;
  loading: boolean;
  error: string | null;
  /** The selected facility, for the pages that still need its `sourceLocationId` on a create. */
  facility: Facility | undefined;
}

export function useFacilities(): UseFacilitiesResult {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facilityId, setFacilityId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/api/v1/facilities?perPage=${PER_PAGE}`)
      .then(r => r.json())
      .then(res => {
        if (cancelled) return;
        const rows: Facility[] = res.data || [];
        setFacilities(rows);
        if (rows.length > 0) setFacilityId(rows[0].id);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load facilities');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return {
    facilities,
    facilityId,
    setFacilityId,
    loading,
    error,
    facility: facilities.find(f => f.id === facilityId),
  };
}
