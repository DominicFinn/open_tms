import React, { ReactNode } from 'react';

interface VnFilterBarProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  children?: ReactNode;
}

export function VnFilterBar({ searchPlaceholder = 'Search...', searchValue, onSearchChange, children }: VnFilterBarProps) {
  return (
    <div className="vn-filters">
      <div className="vn-filter-group" style={{ flex: 1 }}>
        <span className="material-icons">search</span>
        <input
          className="vn-filter-input"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>
      {children}
    </div>
  );
}
