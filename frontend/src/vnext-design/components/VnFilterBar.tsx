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
      <div className="vn-filter-group">
        <span className="material-icons">search</span>
        <input
          className="vn-filter-input"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>
      {children}
    </div>
  );
}
