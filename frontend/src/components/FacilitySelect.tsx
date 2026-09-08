/**
 * The warehouse picker every WMS page shares (#234). Previously nineteen copies of the same
 * Select, each with its own fetch and its own client-side filter.
 */

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Facility } from '../hooks/useFacilities';

interface FacilitySelectProps {
  facilities: Facility[];
  value: string;
  onChange: (id: string) => void;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

export function FacilitySelect({
  facilities, value, onChange, loading = false, error = null, className = 'w-[260px]',
}: FacilitySelectProps) {
  // An org with no facilities gets an empty list on every WMS page, and so does a failed fetch.
  // Distinguishing them here explains all those pages at once, rather than each one claiming it
  // has no waves, no bins, no putaway tasks.
  const empty = facilities.length === 0;
  const placeholder = loading ? 'Loading facilities...'
    : error ? 'Could not load facilities'
    : empty ? 'No facilities'
    : 'Select facility';

  return (
    <Select value={value} onValueChange={onChange} disabled={empty}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {facilities.map(f => (
          <SelectItem key={f.id} value={f.id}>
            {f.code ? `${f.name} (${f.code})` : f.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
