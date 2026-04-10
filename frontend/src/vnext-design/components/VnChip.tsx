import React, { ReactNode } from 'react';

interface VnChipProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'primary' | 'secondary';
  icon?: string;
  children: ReactNode;
}

export function VnChip({ variant = 'primary', icon, children }: VnChipProps) {
  return (
    <span className={`vn-chip vn-chip-${variant}`}>
      {icon && <span className="material-icons" style={{ fontSize: '14px' }}>{icon}</span>}
      {children}
    </span>
  );
}
